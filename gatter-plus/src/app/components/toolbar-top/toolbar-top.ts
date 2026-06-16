import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { AndGate } from '../gates/and-gate/and-gate';
import { OrGate } from '../gates/or-gate/or-gate';
import { NotGate } from '../gates/not-gate/not-gate';
import { InputSwitch } from '../io/input-switch/input-switch';
import { OutputLed } from '../io/output-led/output-led';
import { DragStateService } from '../../services/drag-state.service';
import { GateType } from '../../models/gate.model';

/**
 * Obere horizontale Toolbar.
 *
 * Enthält:
 * - App-Titel "GatterPLUS"
 * - Gatter-Palette: AND, OR, NOT (per Maus-Drag auf Whiteboard)
 * - I/O-Palette: Eingang-Schalter, Ausgang-LED
 * - Simulations-Toggle (Start/Stop)
 */
@Component({
  selector: 'app-toolbar-top',
  imports: [AndGate, OrGate, NotGate, InputSwitch, OutputLed],
  templateUrl: './toolbar-top.html',
  styleUrl: './toolbar-top.scss',
})
export class ToolbarTop {
  private readonly dragState = inject(DragStateService);

  /** Ob der Simulations-Modus aktiv ist (kommt vom Whiteboard via App) */
  @Input() simulationMode = false;

  /** Wird emittiert wenn der Benutzer Simulation starten/stoppen möchte */
  @Output() simulationToggle = new EventEmitter<void>();

  /**
   * Startet das Ziehen einer Komponente aus der Palette.
   * Speichert den Typ im DragStateService – das Whiteboard platziert sie beim mouseup.
   */
  onGateMouseDown(event: MouseEvent, gateType: GateType): void {
    event.preventDefault();
    this.dragState.startDrag(gateType);
  }

  /*
   * KEIN document:mouseup-Handler hier!
   * Das Whiteboard hat seinen eigenen document:mouseup-Handler der:
   *   1. Das Gatter platziert (wenn auf dem Whiteboard losgelassen)
   *   2. endDrag() aufruft
   * Wenn die Toolbar ebenfalls document:mouseup abhört und endDrag() aufruft,
   * entsteht eine Race Condition: die Toolbar läuft zuerst und löscht den
   * DragState bevor das Whiteboard ihn lesen kann → kein Gatter wird platziert.
   */
}
