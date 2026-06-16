import {
  Component,
  ElementRef,
  HostListener,
  inject,
  ViewChild,
} from '@angular/core';
import { AndGate } from '../gates/and-gate/and-gate';
import { OrGate } from '../gates/or-gate/or-gate';
import { NotGate } from '../gates/not-gate/not-gate';
import { InputSwitch } from '../io/input-switch/input-switch';
import { OutputLed } from '../io/output-led/output-led';
import {
  GateInstance,
  GateType,
  GATE_PIN_OFFSETS,
  PIN_HIT_RADIUS,
  WireConnection,
} from '../../models/gate.model';
import { DragStateService } from '../../services/drag-state.service';
import {
  ComponentSignalState,
  SimulationService,
} from '../../services/simulation.service';
import { ToolMode } from '../toolbar-left/toolbar-left';

/** Zustand während des Leitungs-Zeichnens */
interface WireDrawingState {
  fromGateId: string;
  fromPinIndex: number;
  /** Startpunkt der Leitung in logischen Canvas-Koordinaten */
  x1: number;
  y1: number;
}

/**
 * Das unendliche, gerasterte Whiteboard.
 *
 * Verantwortlich für:
 * - Raster-Anzeige (CSS background-image auf dem Viewport)
 * - Pan (Verschieben des Canvas)
 * - Komponenten platzieren (per mousedown in Toolbar → mouseup hier)
 * - Leitungen zeichnen (Klick auf Ausgangs-Pin → Klick auf Eingangs-Pin)
 * - Simulations-Modus: Signale berechnen und anzeigen
 * - Eingangs-Schalter umschalten (Klick im Simulations-Modus)
 */
@Component({
  selector: 'app-whiteboard',
  imports: [AndGate, OrGate, NotGate, InputSwitch, OutputLed],
  templateUrl: './whiteboard.html',
  styleUrl: './whiteboard.scss',
})
export class Whiteboard {
  // ─── Services ──────────────────────────────────────────────────────────────

  private readonly dragState = inject(DragStateService);
  private readonly simulationService = inject(SimulationService);

  // ─── DOM-Referenz ───────────────────────────────────────────────────────────

  @ViewChild('viewport') viewportRef!: ElementRef<HTMLDivElement>;

  // ─── Pan-Zustand ───────────────────────────────────────────────────────────

  panX = 0;
  panY = 0;
  protected isPanning = false;
  private panStartMouseX = 0;
  private panStartMouseY = 0;
  private panStartOffsetX = 0;
  private panStartOffsetY = 0;

  // ─── Werkzeug-Modus ────────────────────────────────────────────────────────

  /** Aktives Werkzeug: 'pan' (Standard) oder 'wire' (Leitungen ziehen) */
  toolMode: ToolMode = 'pan';

  // ─── Leitungs-Zeichnen ─────────────────────────────────────────────────────

  /** Zustand während des Leitungs-Zeichnens; null wenn keine Leitung begonnen */
  wireDrawing: WireDrawingState | null = null;

  /** Aktueller Maus-Endpunkt der gerade gezogenen Leitung (logische Koordinaten) */
  tentativeX = 0;
  tentativeY = 0;

  // ─── Schaltungs-Daten ──────────────────────────────────────────────────────

  /** Alle platzierten Komponenten-Instanzen */
  gates: GateInstance[] = [];

  /** Alle Leitungsverbindungen zwischen Komponenten */
  wires: WireConnection[] = [];

  private gateIdCounter = 0;
  private wireIdCounter = 0;

  // ─── Simulations-Modus ─────────────────────────────────────────────────────

  /** Ob die Simulation gerade läuft */
  simulationMode = false;

  /** Berechnete Signalzustände (wird bei jeder Änderung neu berechnet) */
  private signalStates = new Map<string, ComponentSignalState>();

  // ─── Werkzeug-Wechsel (von Toolbar-Left) ───────────────────────────────────

  /** Wird vom App-Component aufgerufen, wenn der Benutzer ein Werkzeug wählt */
  setToolMode(mode: ToolMode): void {
    this.toolMode = mode;
    // Angefangene Leitung abbrechen wenn Werkzeug wechselt
    this.wireDrawing = null;
  }

  /** Schaltet den Simulations-Modus um */
  toggleSimulation(): void {
    this.simulationMode = !this.simulationMode;
    if (this.simulationMode) {
      this.recomputeSimulation();
    } else {
      // Simulation stoppen: Signalzustände zurücksetzen
      this.signalStates.clear();
    }
  }

  // ─── Maus-Events ───────────────────────────────────────────────────────────

  /**
   * Haupt-Maus-Handler auf dem Whiteboard.
   *
   * Verzweigt je nach aktivem Werkzeug und Zustand:
   * 1. Drag-Drop (Komponente aus Toolbar): Warten auf mouseup
   * 2. Wire-Modus: Pin-Klick erkennen, Leitung starten/beenden
   * 3. Pan-Modus: Panning starten
   * 4. Simulation: Eingangs-Schalter umschalten
   */
  onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();

    // Wenn ein Gatter aus der Toolbar gezogen wird, nur auf mouseup warten
    if (this.dragState.isDragging()) return;

    const { logicalX, logicalY } = this.toLogical(event);

    // ── Wire-Modus ───────────────────────────────────────────────────────────
    if (this.toolMode === 'wire') {
      this.handleWireClick(logicalX, logicalY);
      return;
    }

    // ── Simulations-Modus + Pan: Eingangs-Schalter umschalten ───────────────
    if (this.simulationMode) {
      const toggled = this.tryToggleInputSwitch(logicalX, logicalY);
      if (toggled) return;
    }

    // ── Pan starten ─────────────────────────────────────────────────────────
    this.isPanning = true;
    this.panStartMouseX = event.clientX;
    this.panStartMouseY = event.clientY;
    this.panStartOffsetX = this.panX;
    this.panStartOffsetY = this.panY;
  }

  /** Aktualisiert Pan und Leitungs-Endpunkt während Mausbewegung */
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    // Pan aktualisieren
    if (this.isPanning) {
      this.panX = this.panStartOffsetX + (event.clientX - this.panStartMouseX);
      this.panY = this.panStartOffsetY + (event.clientY - this.panStartMouseY);
    }

    // Leitungs-Endpunkt aktualisieren (für die gestrichelte Vorschau)
    if (this.wireDrawing) {
      const { logicalX, logicalY } = this.toLogical(event);
      this.tentativeX = logicalX;
      this.tentativeY = logicalY;
    }
  }

  /**
   * Haupt-mouseup-Handler (global auf dem Dokument).
   *
   * Behandelt:
   * 1. Panning beenden
   * 2. Gatter-Drop vom Drag-State
   */
  @HostListener('document:mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    // Panning beenden
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    // Gatter aus Toolbar droppen
    if (!this.dragState.isDragging()) return;

    const viewport = this.viewportRef?.nativeElement;
    if (!viewport) { this.dragState.endDrag(); return; }

    const rect = viewport.getBoundingClientRect();
    const isOnWhiteboard =
      event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top  && event.clientY <= rect.bottom;

    if (isOnWhiteboard) {
      const gateType = this.dragState.gateType() as GateType;
      if (gateType) {
        const viewX = event.clientX - rect.left;
        const viewY = event.clientY - rect.top;
        this.placeGate(gateType, viewX - this.panX, viewY - this.panY);
      }
    }
    this.dragState.endDrag();
  }

  // ─── Leitungs-Logik ────────────────────────────────────────────────────────

  /**
   * Verarbeitet einen Klick im Wire-Modus.
   *
   * Phase 1: Klick auf Ausgangs-Pin → beginnt Leitung
   * Phase 2: Klick auf Eingangs-Pin → beendet Leitung und speichert Verbindung
   * Klick ins Leere → bricht angefangene Leitung ab
   */
  private handleWireClick(logicalX: number, logicalY: number): void {
    const nearPin = this.findNearestPin(logicalX, logicalY);

    if (!this.wireDrawing) {
      // Phase 1: Starte Leitung an Ausgangs-Pin
      if (nearPin && nearPin.pinType === 'output') {
        const pos = this.getPinWorldPos(nearPin.gate, 'output', nearPin.pinIndex);
        this.wireDrawing = {
          fromGateId: nearPin.gate.id,
          fromPinIndex: nearPin.pinIndex,
          x1: pos.x,
          y1: pos.y,
        };
        this.tentativeX = pos.x;
        this.tentativeY = pos.y;
      }
    } else {
      // Phase 2: Beende Leitung an Eingangs-Pin
      if (nearPin && nearPin.pinType === 'input') {
        // Keine Verbindung auf sich selbst erlauben
        if (nearPin.gate.id !== this.wireDrawing.fromGateId) {
          // Prüfe ob dieser Eingangs-Pin bereits verbunden ist
          const alreadyConnected = this.wires.some(
            (w) => w.toGateId === nearPin.gate.id && w.toPinIndex === nearPin.pinIndex
          );
          if (!alreadyConnected) {
            const newWire: WireConnection = {
              id: `wire-${++this.wireIdCounter}`,
              fromGateId: this.wireDrawing.fromGateId,
              fromPinIndex: this.wireDrawing.fromPinIndex,
              toGateId: nearPin.gate.id,
              toPinIndex: nearPin.pinIndex,
            };
            this.wires = [...this.wires, newWire];
            if (this.simulationMode) this.recomputeSimulation();
          }
        }
      }
      // Leitung beenden (egal ob erfolgreich oder nicht)
      this.wireDrawing = null;
    }
  }

  // ─── Simulations-Logik ─────────────────────────────────────────────────────

  /** Startet Simulation neu und berechnet alle Signalzustände */
  private recomputeSimulation(): void {
    this.signalStates = this.simulationService.computeSignals(this.gates, this.wires);
  }

  /**
   * Schaltet einen Eingangs-Schalter um, wenn der Klick auf einen trifft.
   * Gibt true zurück wenn ein Schalter getroffen wurde.
   */
  private tryToggleInputSwitch(logicalX: number, logicalY: number): boolean {
    // Input-Switch-Abmessungen: Breite ~70px (58 Körper + 12 Draht), Höhe 52px
    for (const gate of this.gates) {
      if (gate.type !== 'input') continue;
      if (
        logicalX >= gate.x && logicalX <= gate.x + 70 &&
        logicalY >= gate.y && logicalY <= gate.y + 52
      ) {
        // Zustand umschalten (immutable update für Change Detection)
        this.gates = this.gates.map((g) =>
          g.id === gate.id ? { ...g, inputValue: !g.inputValue } : g
        );
        this.recomputeSimulation();
        return true;
      }
    }
    return false;
  }

  // ─── Komponenten platzieren ────────────────────────────────────────────────

  private placeGate(type: GateType, logicalX: number, logicalY: number): void {
    // Gatter am Drop-Punkt zentrieren
    const offsets = GATE_PIN_OFFSETS[type];
    const totalPins = offsets.inputs.length + offsets.outputs.length;
    const centerX = totalPins > 0 ? 38 : 30;

    const newGate: GateInstance = {
      id: `gate-${++this.gateIdCounter}`,
      type,
      x: logicalX - centerX,
      y: logicalY - 26,
      inputValue: false,
    };
    this.gates = [...this.gates, newGate];
    if (this.simulationMode) this.recomputeSimulation();
  }

  // ─── Pin-Erkennung ─────────────────────────────────────────────────────────

  /**
   * Sucht den nächsten Pin im Klick-Radius um (logicalX, logicalY).
   * Gibt null zurück wenn kein Pin in Reichweite ist.
   */
  private findNearestPin(
    logicalX: number,
    logicalY: number
  ): { gate: GateInstance; pinType: 'input' | 'output'; pinIndex: number } | null {
    for (const gate of this.gates) {
      const offsets = GATE_PIN_OFFSETS[gate.type];

      // Ausgangs-Pins prüfen
      for (let i = 0; i < offsets.outputs.length; i++) {
        const pos = {
          x: gate.x + offsets.outputs[i].x,
          y: gate.y + offsets.outputs[i].y,
        };
        if (this.dist(logicalX, logicalY, pos.x, pos.y) <= PIN_HIT_RADIUS) {
          return { gate, pinType: 'output', pinIndex: i };
        }
      }

      // Eingangs-Pins prüfen
      for (let i = 0; i < offsets.inputs.length; i++) {
        const pos = {
          x: gate.x + offsets.inputs[i].x,
          y: gate.y + offsets.inputs[i].y,
        };
        if (this.dist(logicalX, logicalY, pos.x, pos.y) <= PIN_HIT_RADIUS) {
          return { gate, pinType: 'input', pinIndex: i };
        }
      }
    }
    return null;
  }

  /** Berechnet die Weltposition eines Pins */
  getPinWorldPos(
    gate: GateInstance,
    pinType: 'input' | 'output',
    pinIndex: number
  ): { x: number; y: number } {
    const offsets = GATE_PIN_OFFSETS[gate.type];
    const pin =
      pinType === 'input' ? offsets.inputs[pinIndex] : offsets.outputs[pinIndex];
    return { x: gate.x + pin.x, y: gate.y + pin.y };
  }

  // ─── Template-Hilfsmethoden ────────────────────────────────────────────────

  getGridBackgroundPosition(): string {
    return `${this.panX}px ${this.panY}px`;
  }

  getGatesLayerTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px)`;
  }

  /** Gibt den Ausgangs-Signalzustand einer Komponente zurück */
  getSignalOutput(gateId: string): boolean | null {
    return this.signalStates.get(gateId)?.outputSignals[0] ?? null;
  }

  /** Gibt den Eingangs-Signalzustand einer Komponente zurück (für Output-LED) */
  getSignalInput(gateId: string): boolean | null {
    return this.signalStates.get(gateId)?.inputSignals[0] ?? null;
  }

  /**
   * Berechnet Start- und Endpunkt einer gespeicherten Leitung für SVG-Rendering.
   * Gibt null zurück wenn ein Gate nicht gefunden wird.
   */
  getWireCoords(
    wire: WireConnection
  ): { x1: number; y1: number; x2: number; y2: number } | null {
    const fromGate = this.gates.find((g) => g.id === wire.fromGateId);
    const toGate = this.gates.find((g) => g.id === wire.toGateId);
    if (!fromGate || !toGate) return null;

    const start = this.getPinWorldPos(fromGate, 'output', wire.fromPinIndex);
    const end = this.getPinWorldPos(toGate, 'input', wire.toPinIndex);
    return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  }

  /**
   * Gibt an ob eine Leitung ein HIGH-Signal führt (für grüne Farbe).
   */
  isWireHigh(wire: WireConnection): boolean {
    return (
      this.signalStates.get(wire.fromGateId)?.outputSignals[wire.fromPinIndex] === true
    );
  }

  /** Ob die aktive Leitung gezeichnet wird */
  get isDrawingWire(): boolean {
    return this.wireDrawing !== null;
  }

  get isDraggingGate(): boolean {
    return this.dragState.isDragging();
  }

  // ─── Koordinaten-Hilfe ─────────────────────────────────────────────────────

  /** Konvertiert Bildschirm-Koordinaten eines MouseEvent in logische Canvas-Koordinaten */
  private toLogical(event: MouseEvent): { logicalX: number; logicalY: number } {
    const rect = this.viewportRef.nativeElement.getBoundingClientRect();
    return {
      logicalX: event.clientX - rect.left - this.panX,
      logicalY: event.clientY - rect.top - this.panY,
    };
  }

  private dist(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }
}
