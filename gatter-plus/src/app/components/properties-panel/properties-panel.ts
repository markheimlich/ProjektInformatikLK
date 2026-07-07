import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface GatePropertyChange {
  id: string;
  rotation?: 0 | 90 | 180 | 270;
  color?: string;
  inputCount?: number;
  label?: string;
  clockPeriodMs?: number;
}

/**
 * Eigenschaften-Panel (rechte Seitenleiste).
 *
 * Wird angezeigt, wenn ein Element auf dem Whiteboard ausgewählt ist.
 * Ermöglicht das Ändern von Ausrichtung, Farbe, Eingangszahl usw.
 */
@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './properties-panel.html',
  styleUrl: './properties-panel.scss',
})
export class PropertiesPanel {
  /** Aktuell ausgewähltes Element (GateInstance vom Whiteboard) */
  @Input() selectedGate: any | null = null;

  /**
   * ID der aktuell ausgewählten Leitung (falls kein Bauteil, sondern eine
   * Leitung ausgewählt ist). Zeigt einen eigenen kleinen Block mit
   * Löschen-Button, damit Leitungen unabhängig von den angeschlossenen
   * Bauteilen gelöscht werden können — bisher ging das nur per Del-Taste
   * ohne sichtbaren Hinweis darauf.
   */
  @Input() selectedWireId: string | null = null;

  /** Wird ausgelöst, wenn eine Eigenschaft geändert wird */
  @Output() gateChange = new EventEmitter<GatePropertyChange>();

  /** Wird ausgelöst, wenn das Element gelöscht werden soll (gibt die ID zurück) */
  @Output() gateDelete = new EventEmitter<string>();

  /** Wird ausgelöst, wenn die ausgewählte Leitung gelöscht werden soll */
  @Output() wireDelete = new EventEmitter<string>();

  deleteWire(): void {
    if (!this.selectedWireId) return;
    this.wireDelete.emit(this.selectedWireId);
  }

  get hasVariableInputs(): boolean {
    return ['and', 'or', 'xor'].includes(this.selectedGate?.type);
  }

  get isClockGen(): boolean {
    return this.selectedGate?.type === 'clock-gen';
  }

  get isTextLabel(): boolean {
    return this.selectedGate?.type === 'text-label';
  }

  setRotation(rotation: 0 | 90 | 180 | 270): void {
    if (!this.selectedGate) return;
    this.gateChange.emit({ id: this.selectedGate.id, rotation });
  }

  setColor(color: string): void {
    if (!this.selectedGate) return;
    this.gateChange.emit({ id: this.selectedGate.id, color });
  }

  setInputCount(count: number): void {
    if (!this.selectedGate) return;
    const clamped = Math.max(2, Math.min(8, count));
    this.gateChange.emit({ id: this.selectedGate.id, inputCount: clamped });
  }

  setLabel(label: string): void {
    if (!this.selectedGate) return;
    this.gateChange.emit({ id: this.selectedGate.id, label });
  }

  setClockPeriod(ms: number): void {
    if (!this.selectedGate) return;
    const clamped = Math.max(100, Math.min(10000, ms));
    this.gateChange.emit({ id: this.selectedGate.id, clockPeriodMs: clamped });
  }

  deleteGate(): void {
    if (!this.selectedGate) return;
    this.gateDelete.emit(this.selectedGate.id);
  }

  getTypeName(): string {
    const names: Record<string, string> = {
      'and': 'UND-Gatter',
      'or': 'ODER-Gatter',
      'not': 'NICHT-Gatter',
      'xor': 'XOR-Gatter',
      'input': 'Eingang',
      'output': 'Ausgang',
      'jk-ff': 'JK-Flip-Flop',
      'half-adder': 'Halbaddierer',
      'full-adder': 'Volladdierer',
      'text-label': 'Beschriftung',
      'clock-gen': 'Taktgeber',
    };
    return names[this.selectedGate?.type] ?? this.selectedGate?.type ?? '';
  }
}
