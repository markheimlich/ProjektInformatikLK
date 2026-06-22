import {
  Component,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { AndGate }     from '../gates/and-gate/and-gate';
import { OrGate }      from '../gates/or-gate/or-gate';
import { NotGate }     from '../gates/not-gate/not-gate';
import { XorGate }     from '../gates/xor-gate/xor-gate';
import { JkFlipflop }  from '../gates/jk-flipflop/jk-flipflop';
import { HalfAdder }   from '../gates/half-adder/half-adder';
import { FullAdder }   from '../gates/full-adder/full-adder';
import { InputSwitch } from '../io/input-switch/input-switch';
import { OutputLed }   from '../io/output-led/output-led';
import { ClockGen }    from '../io/clock-gen/clock-gen';
import { TextLabel }   from '../io/text-label/text-label';
import {
  GateInstance, GateType, WireConnection,
  Rotation, GateColor,
  getGatePinOffsets, getGateDimensions,
  getPinWorldPos, isPointInGate,
  PIN_HIT_RADIUS, createGateInstance, computeOrthogonalWaypoints,
} from '../../models/gate.model';
import { DragStateService }    from '../../services/drag-state.service';
import { SimulationService, ComponentSignalState } from '../../services/simulation.service';
import { ToolMode }            from '../toolbar-left/toolbar-left';

/** Zustand während des Leitungs-Zeichnens */
interface WireDrawingState {
  fromGateId: string;
  fromPinIndex: number;
  x1: number;
  y1: number;
}

/** Zustand während des Verschiebens eines platzierten Bauteils */
interface GateDragState {
  gateId: string;
  /** Logische Ausgangsposition beim Drag-Start */
  originX: number;
  originY: number;
  /** Mausposition beim Drag-Start (Bildschirm) */
  startMouseX: number;
  startMouseY: number;
}

/**
 * Das unendliche, gerasterte Whiteboard.
 *
 * Verantwortlich für:
 * - SVG-Raster (scrollt mit dem Pan-Versatz)
 * - Pan (Maus ziehen, Leinwand verschieben)
 * - Gatter-Drop (Toolbar → mousedown → mouseup auf Whiteboard)
 * - Gatter verschieben (Klick-Drag auf platziertes Bauteil)
 * - Gatter auswählen (Klick auf Bauteil → Properties Panel)
 * - Leitungen zeichnen (Wire-Modus, rechtwinklige Führung)
 * - Simulation: BFS-Signalpropagierung + Taktgeber-Intervalle
 * - Eingangs-Schalter umschalten (Klick im Simulations-Modus)
 */
@Component({
  selector: 'app-whiteboard',
  imports: [
    AndGate, OrGate, NotGate, XorGate,
    JkFlipflop, HalfAdder, FullAdder,
    InputSwitch, OutputLed, ClockGen, TextLabel,
  ],
  templateUrl: './whiteboard.html',
  styleUrl:    './whiteboard.scss',
})
export class Whiteboard implements OnDestroy {
  // ─── Services ──────────────────────────────────────────────────────────────
  private readonly dragState        = inject(DragStateService);
  private readonly simulationService = inject(SimulationService);

  // ─── DOM-Referenz ───────────────────────────────────────────────────────────
  @ViewChild('viewport') viewportRef!: ElementRef<HTMLDivElement>;

  // ─── Pan-Zustand ───────────────────────────────────────────────────────────
  panX = 0;
  panY = 0;
  protected isPanning   = false;
  private panStartMouseX  = 0;
  private panStartMouseY  = 0;
  private panStartOffsetX = 0;
  private panStartOffsetY = 0;

  // ─── Werkzeug-Modus ────────────────────────────────────────────────────────
  toolMode: ToolMode = 'pan';

  // ─── Leitungs-Zeichnen ─────────────────────────────────────────────────────
  wireDrawing: WireDrawingState | null = null;
  tentativeX = 0;
  tentativeY = 0;

  // ─── Gatter verschieben ────────────────────────────────────────────────────
  private gateDragState: GateDragState | null = null;
  /** true sobald die Maus sich >4px vom Klickpunkt entfernt hat */
  private gateDragStarted = false;

  // ─── Schaltungs-Daten ──────────────────────────────────────────────────────
  gates: GateInstance[] = [];
  wires: WireConnection[] = [];
  private gateIdCounter = 0;
  private wireIdCounter = 0;

  // ─── Auswahl ───────────────────────────────────────────────────────────────
  /** ID des aktuell ausgewählten Bauteils (null = nichts ausgewählt) */
  selectedGateId: string | null = null;
  /** ID der aktuell ausgewählten Leitung (null = keine ausgewählt) */
  selectedWireId: string | null = null;

  get selectedGate(): GateInstance | null {
    return this.selectedGateId
      ? (this.gates.find(g => g.id === this.selectedGateId) ?? null)
      : null;
  }

  // ─── Simulations-Modus ─────────────────────────────────────────────────────
  simulationMode = false;
  private signalStates = new Map<string, ComponentSignalState>();
  /** setInterval-Handles für jeden Taktgeber (gateId → intervalId) */
  private clockIntervals = new Map<string, ReturnType<typeof setInterval>>();

  // ─── Werkzeug-Wechsel ──────────────────────────────────────────────────────
  setToolMode(mode: ToolMode): void {
    this.toolMode  = mode;
    this.wireDrawing = null;
  }

  /** Schaltet den Simulations-Modus um */
  toggleSimulation(): void {
    this.simulationMode = !this.simulationMode;
    if (this.simulationMode) {
      this.startClockIntervals();
      this.recomputeSimulation();
    } else {
      this.stopClockIntervals();
      this.signalStates.clear();
    }
  }

  // ─── Taktgeber-Intervalle ──────────────────────────────────────────────────

  private startClockIntervals(): void {
    for (const gate of this.gates) {
      if (gate.type === 'clock-gen') {
        this.startClockInterval(gate);
      }
    }
  }

  private startClockInterval(gate: GateInstance): void {
    if (this.clockIntervals.has(gate.id)) return;
    const period = Math.max(100, gate.clockPeriodMs ?? 1000);
    const handle = setInterval(() => {
      // Zustand toggeln und Simulation neu berechnen
      this.gates = this.gates.map(g =>
        g.id === gate.id ? { ...g, inputValue: !g.inputValue } : g
      );
      this.recomputeSimulation();
    }, period);
    this.clockIntervals.set(gate.id, handle);
  }

  private stopClockIntervals(): void {
    for (const handle of this.clockIntervals.values()) {
      clearInterval(handle);
    }
    this.clockIntervals.clear();
  }

  /** Muss bei Periodenänderung aufgerufen werden */
  restartClockInterval(gate: GateInstance): void {
    const handle = this.clockIntervals.get(gate.id);
    if (handle !== undefined) clearInterval(handle);
    this.clockIntervals.delete(gate.id);
    if (this.simulationMode) this.startClockInterval(gate);
  }

  ngOnDestroy(): void {
    this.stopClockIntervals();
  }

  // ─── Gatter-Eigenschaften aktualisieren ────────────────────────────────────

  /**
   * Aktualisiert beliebige Felder eines platzierten Bauteils.
   * Wird vom Properties Panel über app.ts aufgerufen.
   */
  updateGate(changes: Partial<GateInstance> & { id: string }): void {
    const periodChanged = changes.clockPeriodMs !== undefined;
    this.gates = this.gates.map(g => {
      if (g.id !== changes.id) return g;
      const updated = { ...g, ...changes };
      return updated;
    });
    // Taktgeber-Intervall neu starten wenn Periode geändert
    if (periodChanged) {
      const gate = this.gates.find(g => g.id === changes.id);
      if (gate) this.restartClockInterval(gate);
    }
    if (this.simulationMode) this.recomputeSimulation();
  }

  /** Löscht ein Bauteil und alle zugehörigen Leitungen */
  deleteGate(gateId: string): void {
    const handle = this.clockIntervals.get(gateId);
    if (handle !== undefined) clearInterval(handle);
    this.clockIntervals.delete(gateId);

    this.gates = this.gates.filter(g => g.id !== gateId);
    this.wires = this.wires.filter(
      w => w.fromGateId !== gateId && w.toGateId !== gateId
    );
    if (this.selectedGateId === gateId) this.selectedGateId = null;
    if (this.simulationMode) this.recomputeSimulation();
  }

  /** Löscht eine einzelne Leitung */
  deleteWire(wireId: string): void {
    this.wires = this.wires.filter(w => w.id !== wireId);
    if (this.selectedWireId === wireId) this.selectedWireId = null;
    if (this.simulationMode) this.recomputeSimulation();
  }

  // ─── Maus-Events ───────────────────────────────────────────────────────────

  /**
   * Haupt-Maus-Handler auf dem Viewport-Div.
   * Verzweigt nach Modus:
   *  1. Gatter aus Toolbar wird gezogen → nur warten
   *  2. Wire-Modus → Pin-Klick auswerten
   *  3. Pan-Modus + Simulation → Eingangs-Schalter / Taktgeber togglen
   *  4. Pan-Modus → Gatter-Klick (Auswahl/Drag) oder Panning starten
   */
  onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();

    // Toolbar-Drag läuft → nur auf mouseup warten
    if (this.dragState.isDragging()) return;

    const { lx, ly } = this.toLogical(event);

    // ── Wire-Modus ──────────────────────────────────────────────────────────
    if (this.toolMode === 'wire') {
      this.handleWireClick(lx, ly);
      return;
    }

    // ── Simulation: Schalter / Taktgeber umschalten ─────────────────────────
    if (this.simulationMode) {
      if (this.tryToggleSwitch(lx, ly)) return;
    }

    // ── Gatter-Klick erkennen (Auswahl + Drag) ──────────────────────────────
    const hitGate = this.findGateAt(lx, ly);
    if (hitGate) {
      this.selectedGateId = hitGate.id;
      this.selectedWireId = null;
      this.gateDragState  = {
        gateId:      hitGate.id,
        originX:     hitGate.x,
        originY:     hitGate.y,
        startMouseX: event.clientX,
        startMouseY: event.clientY,
      };
      this.gateDragStarted = false;
      return;
    }

    // ── Klick ins Leere → Auswahl aufheben, Panning starten ─────────────────
    this.selectedGateId = null;
    this.selectedWireId = null;
    this.isPanning        = true;
    this.panStartMouseX   = event.clientX;
    this.panStartMouseY   = event.clientY;
    this.panStartOffsetX  = this.panX;
    this.panStartOffsetY  = this.panY;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    // Panning
    if (this.isPanning) {
      this.panX = this.panStartOffsetX + (event.clientX - this.panStartMouseX);
      this.panY = this.panStartOffsetY + (event.clientY - this.panStartMouseY);
    }

    // Gatter verschieben
    if (this.gateDragState) {
      const dx = event.clientX - this.gateDragState.startMouseX;
      const dy = event.clientY - this.gateDragState.startMouseY;
      if (!this.gateDragStarted && Math.hypot(dx, dy) > 4) {
        this.gateDragStarted = true;
      }
      if (this.gateDragStarted) {
        const movedId = this.gateDragState.gateId;
        const newX = this.gateDragState.originX + dx;
        const newY = this.gateDragState.originY + dy;
        const updatedGates = this.gates.map(g =>
          g.id === movedId ? { ...g, x: newX, y: newY } : g
        );
        this.gates = updatedGates;
        // Waypoints aller angeschlossenen Leitungen neu berechnen (Bug 1: keine Diagonalen)
        this.wires = this.wires.map(wire => {
          if (wire.fromGateId !== movedId && wire.toGateId !== movedId) return wire;
          const from = updatedGates.find(g => g.id === wire.fromGateId);
          const to   = updatedGates.find(g => g.id === wire.toGateId);
          if (!from || !to) return wire;
          const start = getPinWorldPos(from, 'output', wire.fromPinIndex);
          const end   = getPinWorldPos(to,   'input',  wire.toPinIndex);
          return { ...wire, points: computeOrthogonalWaypoints(start.x, start.y, end.x, end.y) };
        });
        if (this.simulationMode) this.recomputeSimulation();
      }
    }

    // Leitungs-Vorschau aktualisieren
    if (this.wireDrawing) {
      const { lx, ly } = this.toLogical(event);
      this.tentativeX = lx;
      this.tentativeY = ly;
    }
  }

  @HostListener('document:mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    // Panning beenden
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    // Gatter-Drag beenden
    if (this.gateDragState) {
      this.gateDragState   = null;
      this.gateDragStarted = false;
      return;
    }

    // Gatter-Drop aus Toolbar
    if (!this.dragState.isDragging()) return;

    const viewport = this.viewportRef?.nativeElement;
    if (!viewport) { this.dragState.endDrag(); return; }

    const rect = viewport.getBoundingClientRect();
    const onBoard =
      event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top  && event.clientY <= rect.bottom;

    if (onBoard) {
      const type = this.dragState.gateType() as GateType;
      if (type) {
        const vx = event.clientX - rect.left;
        const vy = event.clientY - rect.top;
        this.placeGate(type, vx - this.panX, vy - this.panY);
      }
    }
    this.dragState.endDrag();
  }

  /** Del-Taste → ausgewähltes Bauteil oder Leitung löschen */
  @HostListener('document:keydown.delete', ['$event'])
  @HostListener('document:keydown.backspace', ['$event'])
  onDeleteKey(event: Event): void {
    // Nicht auslösen wenn ein Eingabefeld fokussiert ist
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
    if (this.selectedGateId) {
      event.preventDefault();
      this.deleteGate(this.selectedGateId);
    } else if (this.selectedWireId) {
      event.preventDefault();
      this.deleteWire(this.selectedWireId);
    }
  }

  /** Klick auf eine Leitung → Leitung auswählen */
  onWireClick(wire: WireConnection, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedWireId = wire.id;
    this.selectedGateId = null;
  }

  // ─── Leitungs-Logik ────────────────────────────────────────────────────────

  private handleWireClick(lx: number, ly: number): void {
    const near = this.findNearestPin(lx, ly);

    if (!this.wireDrawing) {
      // Phase 1: Ausgangs-Pin anklicken → Leitung starten
      if (near?.pinType === 'output') {
        const pos = getPinWorldPos(near.gate, 'output', near.pinIndex);
        this.wireDrawing = {
          fromGateId:   near.gate.id,
          fromPinIndex: near.pinIndex,
          x1: pos.x, y1: pos.y,
        };
        this.tentativeX = pos.x;
        this.tentativeY = pos.y;
      }
    } else {
      // Phase 2: Eingangs-Pin anklicken → Leitung abschließen
      if (near?.pinType === 'input' && near.gate.id !== this.wireDrawing.fromGateId) {
        const alreadyUsed = this.wires.some(
          w => w.toGateId === near.gate.id && w.toPinIndex === near.pinIndex
        );
        if (!alreadyUsed) {
          const endPos = getPinWorldPos(near.gate, 'input', near.pinIndex);
          const newWire: WireConnection = {
            id:           `wire-${++this.wireIdCounter}`,
            fromGateId:   this.wireDrawing.fromGateId,
            fromPinIndex: this.wireDrawing.fromPinIndex,
            toGateId:     near.gate.id,
            toPinIndex:   near.pinIndex,
            // Orthogonale Wegpunkte für rechtwinklige Leitungsführung
            points: computeOrthogonalWaypoints(
              this.wireDrawing.x1, this.wireDrawing.y1,
              endPos.x, endPos.y
            ),
          };
          this.wires = [...this.wires, newWire];
          if (this.simulationMode) this.recomputeSimulation();
        }
      }
      this.wireDrawing = null;
    }
  }

  // ─── Simulations-Hilfsmethoden ─────────────────────────────────────────────

  private recomputeSimulation(): void {
    this.signalStates = this.simulationService.computeSignals(this.gates, this.wires);
  }

  private tryToggleSwitch(lx: number, ly: number): boolean {
    for (const gate of this.gates) {
      if (gate.type !== 'input') continue;
      if (isPointInGate(lx, ly, gate)) {
        this.gates = this.gates.map(g =>
          g.id === gate.id ? { ...g, inputValue: !g.inputValue } : g
        );
        this.recomputeSimulation();
        return true;
      }
    }
    return false;
  }

  // ─── Bauteil platzieren ────────────────────────────────────────────────────

  private placeGate(type: GateType, lx: number, ly: number): void {
    const gate = createGateInstance(`gate-${++this.gateIdCounter}`, type, 0, 0);
    const dim  = getGateDimensions(gate);
    gate.x = Math.round(lx - dim.w / 2);
    gate.y = Math.round(ly - dim.h / 2);
    this.gates = [...this.gates, gate];

    // Neuen Taktgeber sofort starten wenn Simulation läuft
    if (type === 'clock-gen' && this.simulationMode) {
      this.startClockInterval(gate);
    }
    if (this.simulationMode) this.recomputeSimulation();
  }

  // ─── Pin-Erkennung ─────────────────────────────────────────────────────────

  private findNearestPin(
    lx: number, ly: number
  ): { gate: GateInstance; pinType: 'input' | 'output'; pinIndex: number } | null {
    for (const gate of this.gates) {
      const offsets = getGatePinOffsets(gate);

      for (let i = 0; i < offsets.outputs.length; i++) {
        const pos = getPinWorldPos(gate, 'output', i);
        if (this.dist(lx, ly, pos.x, pos.y) <= PIN_HIT_RADIUS)
          return { gate, pinType: 'output', pinIndex: i };
      }
      for (let i = 0; i < offsets.inputs.length; i++) {
        const pos = getPinWorldPos(gate, 'input', i);
        if (this.dist(lx, ly, pos.x, pos.y) <= PIN_HIT_RADIUS)
          return { gate, pinType: 'input', pinIndex: i };
      }
    }
    return null;
  }

  private findGateAt(lx: number, ly: number): GateInstance | null {
    // Rückwärts iterieren damit oberstes Bauteil zuerst getroffen wird
    for (let i = this.gates.length - 1; i >= 0; i--) {
      if (isPointInGate(lx, ly, this.gates[i])) return this.gates[i];
    }
    return null;
  }

  // ─── Template-Hilfsmethoden ────────────────────────────────────────────────

  getGatesLayerTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px)`;
  }

  getGateTransform(gate: GateInstance): string {
    return gate.rotation !== 0 ? `rotate(${gate.rotation}deg)` : '';
  }

  /** CSS-Filter-Wert für die Gehäuse-Farbe (für [style.filter] Binding) */
  getGateColorFilter(gate: GateInstance): string {
    const map: Record<GateColor, string> = {
      default: '',
      yellow:  'sepia(1) saturate(8) hue-rotate(15deg)',
      green:   'sepia(1) saturate(8) hue-rotate(100deg) brightness(0.9)',
      red:     'sepia(1) saturate(8) hue-rotate(300deg) brightness(0.9)',
      orange:  'sepia(1) saturate(10) hue-rotate(25deg) brightness(1.1)',
    };
    return map[gate.color] ?? '';
  }

  /** Erzeugt den SVG-Punkte-String für eine Polyline-Leitung */
  getWirePointsString(wire: WireConnection): string | null {
    const from = this.gates.find(g => g.id === wire.fromGateId);
    const to   = this.gates.find(g => g.id === wire.toGateId);
    if (!from || !to) return null;

    const start = getPinWorldPos(from, 'output', wire.fromPinIndex);
    const end   = getPinWorldPos(to,   'input',  wire.toPinIndex);

    if (wire.points.length === 0) {
      // Gerade Linie
      return `${start.x},${start.y} ${end.x},${end.y}`;
    }

    // Rechtwinklige Führung mit Wegpunkten
    const pts = [start, ...wire.points, end];
    return pts.map(p => `${p.x},${p.y}`).join(' ');
  }

  /** Tentative-Leitung als SVG-Punkte-String (orthogonal) */
  getTentativePointsString(): string {
    if (!this.wireDrawing) return '';
    const x1 = this.wireDrawing.x1;
    const y1 = this.wireDrawing.y1;
    const midX = Math.round((x1 + this.tentativeX) / 2);
    return `${x1},${y1} ${midX},${y1} ${midX},${this.tentativeY} ${this.tentativeX},${this.tentativeY}`;
  }

  isWireHigh(wire: WireConnection): boolean {
    return this.signalStates.get(wire.fromGateId)
      ?.outputSignals[wire.fromPinIndex] === true;
  }

  getSignalOutput(gateId: string, pinIndex = 0): boolean | null {
    return this.signalStates.get(gateId)?.outputSignals[pinIndex] ?? null;
  }

  getSignalInput(gateId: string, pinIndex = 0): boolean | null {
    return this.signalStates.get(gateId)?.inputSignals[pinIndex] ?? null;
  }

  getPinWorldPosForTemplate(
    gate: GateInstance,
    pinType: 'input' | 'output',
    pinIndex: number
  ): { x: number; y: number } {
    return getPinWorldPos(gate, pinType, pinIndex);
  }

  getPinOffsets(gate: GateInstance) {
    return getGatePinOffsets(gate);
  }

  /** true wenn dieser Ausgangs-Pin bereits eine Leitung hat */
  isOutputPinConnected(gateId: string, pinIndex: number): boolean {
    return this.wires.some(w => w.fromGateId === gateId && w.fromPinIndex === pinIndex);
  }

  /** true wenn dieser Eingangs-Pin bereits eine Leitung hat */
  isInputPinConnected(gateId: string, pinIndex: number): boolean {
    return this.wires.some(w => w.toGateId === gateId && w.toPinIndex === pinIndex);
  }

  /**
   * Positionen wo sich Leitungen aufteilen (ein Ausgang → mehrere Eingänge).
   * An diesen Punkten wird ein Verbindungs-Dot gezeichnet.
   */
  getWireJunctions(): { x: number; y: number }[] {
    const sourceCount = new Map<string, number>();
    for (const wire of this.wires) {
      const key = `${wire.fromGateId}:${wire.fromPinIndex}`;
      sourceCount.set(key, (sourceCount.get(key) ?? 0) + 1);
    }
    const result: { x: number; y: number }[] = [];
    for (const [key, count] of sourceCount.entries()) {
      if (count < 2) continue;
      const [gateId, idxStr] = key.split(':');
      const gate = this.gates.find(g => g.id === gateId);
      if (gate) result.push(getPinWorldPos(gate, 'output', +idxStr));
    }
    return result;
  }

  get isDraggingGate(): boolean { return this.dragState.isDragging(); }
  get isDrawingWire(): boolean  { return this.wireDrawing !== null; }

  // ─── Koordinaten-Hilfe ─────────────────────────────────────────────────────

  private toLogical(event: MouseEvent): { lx: number; ly: number } {
    const rect = this.viewportRef.nativeElement.getBoundingClientRect();
    return {
      lx: event.clientX - rect.left - this.panX,
      ly: event.clientY - rect.top  - this.panY,
    };
  }

  private dist(x1: number, y1: number, x2: number, y2: number): number {
    return Math.hypot(x1 - x2, y1 - y2);
  }
}
