import { Component, Input } from '@angular/core';

/**
 * Visuelles UND-Gatter (AND) nach DIN 40900.
 * Symbol: "&"
 *
 * Wahrheitstabelle:
 *   A=0, B=0 → Q=0
 *   A=0, B=1 → Q=0
 *   A=1, B=0 → Q=0
 *   A=1, B=1 → Q=1
 */
@Component({
  selector: 'app-and-gate',
  imports: [],
  templateUrl: './and-gate.html',
  styleUrl: './and-gate.scss',
})
export class AndGate {
  /** Kompakter Toolbar-Modus (kleiner) */
  @Input() toolbarMode = false;

  /**
   * Aktueller Ausgangs-Signal-Zustand (für Simulations-Visualisierung).
   * null = unbekannt, false = LOW, true = HIGH
   */
  @Input() signalOutput: boolean | null = null;
}
