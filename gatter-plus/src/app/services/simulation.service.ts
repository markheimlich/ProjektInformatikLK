import { Injectable } from '@angular/core';
import { GateInstance, GateType, WireConnection, GATE_PIN_OFFSETS } from '../models/gate.model';

/**
 * Signalzustand einer einzelnen Komponente im Simulations-Modus.
 *
 * null = unbekannt (kein Eingang verbunden oder Simulation noch nicht durchgelaufen)
 * false = logisch 0 (LOW)
 * true  = logisch 1 (HIGH)
 */
export interface ComponentSignalState {
  /** Eingangs-Signale für jeden Input-Pin (Index = Pin-Index) */
  inputSignals: (boolean | null)[];
  /** Ausgangs-Signale für jeden Output-Pin */
  outputSignals: (boolean | null)[];
}

/**
 * Service für die Logik-Simulation der Schaltung.
 *
 * Algorithmus: Breiten-Suche (BFS) topologische Verarbeitung
 * 1. Start bei allen Eingangs-Schaltern (type='input')
 * 2. Berechne deren Ausgang (= der Schalter-Zustand)
 * 3. Propagiere das Signal über Leitungen zu Folge-Gattern
 * 4. Berechne Gatter-Ausgänge sobald alle Eingänge bekannt sind
 * 5. Wiederhole bis keine neuen Signale mehr propagiert werden können
 */
@Injectable({ providedIn: 'root' })
export class SimulationService {
  /**
   * Berechnet alle Signalzustände der Schaltung.
   *
   * @param gates  Alle platzierten Komponenten auf dem Whiteboard
   * @param wires  Alle Leitungsverbindungen zwischen Komponenten
   * @returns      Map: GateInstance.id → ComponentSignalState
   */
  computeSignals(
    gates: GateInstance[],
    wires: WireConnection[]
  ): Map<string, ComponentSignalState> {
    // Ergebnis-Map: jede Komponente bekommt einen initialen Zustand
    const result = new Map<string, ComponentSignalState>();

    for (const gate of gates) {
      const inputCount = GATE_PIN_OFFSETS[gate.type].inputs.length;
      const outputCount = GATE_PIN_OFFSETS[gate.type].outputs.length;
      result.set(gate.id, {
        inputSignals: new Array(inputCount).fill(null),
        outputSignals: new Array(outputCount).fill(null),
      });
    }

    // Eingangs-Schalter: ihr Ausgang ist direkt der Schalter-Zustand
    for (const gate of gates) {
      if (gate.type === 'input') {
        const state = result.get(gate.id)!;
        state.outputSignals = [gate.inputValue ?? false];
      }
    }

    // BFS-Queue: starte mit allen Eingangs-Schaltern
    const queue: string[] = gates
      .filter((g) => g.type === 'input')
      .map((g) => g.id);

    const processed = new Set<string>();

    while (queue.length > 0) {
      const gateId = queue.shift()!;
      if (processed.has(gateId)) continue;
      processed.add(gateId);

      const gate = gates.find((g) => g.id === gateId);
      if (!gate) continue;

      const state = result.get(gateId)!;

      // Gatter-Ausgang berechnen (außer für 'input', das wurde bereits gesetzt)
      if (gate.type !== 'input') {
        state.outputSignals = this.computeGateOutput(gate.type, state.inputSignals);
      }

      // Ausgangs-Signal über alle abgehenden Leitungen propagieren
      const outgoingWires = wires.filter((w) => w.fromGateId === gateId);
      for (const wire of outgoingWires) {
        const destState = result.get(wire.toGateId);
        if (destState) {
          // Signal am Quell-Ausgang auf den Ziel-Eingang schreiben
          destState.inputSignals[wire.toPinIndex] =
            state.outputSignals[wire.fromPinIndex] ?? null;
        }
        // Ziel-Gatter zur Queue hinzufügen (wird neu berechnet)
        if (!processed.has(wire.toGateId)) {
          queue.push(wire.toGateId);
        }
      }
    }

    return result;
  }

  /**
   * Berechnet den Ausgang eines einzelnen Gatters basierend auf seinen Eingängen.
   *
   * Wenn ein Eingang null (unbekannt) ist, ist der Ausgang ebenfalls null –
   * außer bei OR, wo ein HIGH-Eingang immer HIGH ergibt (auch wenn der andere unbekannt ist).
   *
   * @param type    Gatter-Typ
   * @param inputs  Eingangs-Signale (boolean | null pro Pin)
   * @returns       Ausgangs-Signale (boolean | null pro Output-Pin)
   */
  private computeGateOutput(
    type: GateType,
    inputs: (boolean | null)[]
  ): (boolean | null)[] {
    switch (type) {
      case 'and':
        // Ausgang HIGH nur wenn BEIDE Eingänge HIGH
        if (inputs[0] === null || inputs[1] === null) return [null];
        return [inputs[0] && inputs[1]];

      case 'or':
        // Ausgang HIGH wenn MINDESTENS EIN Eingang HIGH
        if (inputs[0] === true || inputs[1] === true) return [true];
        if (inputs[0] === null || inputs[1] === null) return [null];
        return [false];

      case 'not':
        // Ausgang ist Umkehrung des Eingangs
        if (inputs[0] === null) return [null];
        return [!inputs[0]];

      case 'output':
        // LED: kein Ausgang, nur Anzeige
        return [];

      default:
        return [];
    }
  }
}
