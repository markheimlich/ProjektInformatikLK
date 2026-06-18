import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { AndGate }    from '../gates/and-gate/and-gate';
import { OrGate }     from '../gates/or-gate/or-gate';
import { NotGate }    from '../gates/not-gate/not-gate';
import { XorGate }    from '../gates/xor-gate/xor-gate';
import { JkFlipflop } from '../gates/jk-flipflop/jk-flipflop';
import { HalfAdder }  from '../gates/half-adder/half-adder';
import { FullAdder }  from '../gates/full-adder/full-adder';
import { InputSwitch } from '../io/input-switch/input-switch';
import { OutputLed }   from '../io/output-led/output-led';
import { ClockGen }    from '../io/clock-gen/clock-gen';
import { TextLabel }   from '../io/text-label/text-label';
import { DragStateService } from '../../services/drag-state.service';
import { GateType } from '../../models/gate.model';

/**
 * Obere horizontale Toolbar.
 *
 * Paletten:
 * - Gatter:      AND, OR, NOT, XOR
 * - Kombinatorik: Halbaddierer (HA), Volladdierer (VA)
 * - Flip-Flops:  JK-FF
 * - Ein/Ausgang: Eingangs-Schalter, Ausgangs-LED, Taktgeber, Text-Label
 */
@Component({
  selector: 'app-toolbar-top',
  imports: [
    AndGate, OrGate, NotGate, XorGate,
    JkFlipflop, HalfAdder, FullAdder,
    InputSwitch, OutputLed, ClockGen, TextLabel,
  ],
  templateUrl: './toolbar-top.html',
  styleUrl: './toolbar-top.scss',
})
export class ToolbarTop {
  private readonly dragState = inject(DragStateService);

  @Input() simulationMode = false;
  @Output() simulationToggle = new EventEmitter<void>();

  /**
   * Startet einen Drag-Vorgang aus der Palette.
   * Kein document:mouseup hier – das Whiteboard übernimmt das Cleanup.
   */
  onGateMouseDown(event: MouseEvent, gateType: GateType): void {
    event.preventDefault();
    this.dragState.startDrag(gateType);
  }
}
