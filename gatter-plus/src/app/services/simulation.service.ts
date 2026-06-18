import { Injectable } from '@angular/core';
import { GateInstance, WireConnection, getGatePinOffsets } from '../models/gate.model';

/**
 * Signalzustand einer einzelnen Komponente im Simulations-Modus.
 *
 * null  = unbekannt (Eingang nicht verbunden / Simulation noch nicht durchgelaufen)
 * false = logisch 0 (LOW)
 * true  = logisch 1 (HIGH)
 */
export interface ComponentSignalState {
  /** Eingangs-Signale pro Pin (Index = Pin-Index der Komponente) */
  inputSignals: (boolean | null)[];
  /** Ausgangs-Signale pro Pin */
  outputSignals: (boolean | null)[];
}

/**
 * Service für die Logik-Simulation der Schaltung.
 *
 * Algorithmus: BFS-Topologische Verarbeitung
 * 1. Start bei Eingangs-Schaltern und Taktgebern (type 'input' / 'clock-gen')
 * 2. Berechne deren Ausgang direkt aus dem gespeicherten Zustand
 * 3. Propagiere über Leitungen zu nachgelagerten Bauteilen
 * 4. Berechne Gatter-Ausgänge sobald alle nötigen Eingänge bekannt sind
 *
 * JK-Flip-Flops sind speichernd: ihr Q-Ausgang hängt vom vorherigen Zustand ab.
 * Der Zustand wird in gate.ffState gespeichert und bei jedem Simulationsschritt
 * anhand der aktuellen Eingangs-Signale fortgeschrieben.
 */
@Injectable({ providedIn: 'root' })
export class SimulationService {
  /**
   * Berechnet alle Signalzustände der gesamten Schaltung.
   *
   * @param gates  Alle platzierten Komponenten-Instanzen
   * @param wires  Alle Leitungsverbindungen
   * @returns      Map: GateInstance.id → ComponentSignalState
   */
  computeSignals(
    gates: GateInstance[],
    wires: WireConnection[]
  ): Map<string, ComponentSignalState> {
    const result = new Map<string, ComponentSignalState>();

    // Initialer Zustand: alle Signale unbekannt (null)
    for (const gate of gates) {
      const offsets = getGatePinOffsets(gate);
      result.set(gate.id, {
        inputSignals:  new Array(offsets.inputs.length).fill(null),
        outputSignals: new Array(offsets.outputs.length).fill(null),
      });
    }

    // Signalquellen: Eingangs-Schalter und Taktgeber setzen ihre Ausgänge direkt
    for (const gate of gates) {
      if (gate.type === 'input' || gate.type === 'clock-gen') {
        result.get(gate.id)!.outputSignals = [gate.inputValue ?? false];
      }
    }

    // BFS startet mit allen Signalquellen
    const queue: string[] = gates
      .filter(g => g.type === 'input' || g.type === 'clock-gen')
      .map(g => g.id);

    const processed = new Set<string>();

    while (queue.length > 0) {
      const gateId = queue.shift()!;
      if (processed.has(gateId)) continue;
      processed.add(gateId);

      const gate = gates.find(g => g.id === gateId);
      if (!gate) continue;

      const state = result.get(gateId)!;

      // Ausgang berechnen (außer Quellen, die bereits gesetzt wurden)
      if (gate.type !== 'input' && gate.type !== 'clock-gen') {
        const newOutputs = this.computeGateOutput(gate, state.inputSignals);
        state.outputSignals = newOutputs;
      }

      // Ausgangs-Signal über abgehende Leitungen weiterleiten
      const outgoing = wires.filter(w => w.fromGateId === gateId);
      for (const wire of outgoing) {
        const dest = result.get(wire.toGateId);
        if (dest) {
          dest.inputSignals[wire.toPinIndex] =
            state.outputSignals[wire.fromPinIndex] ?? null;
        }
        if (!processed.has(wire.toGateId)) {
          queue.push(wire.toGateId);
        }
      }
    }

    return result;
  }

  /**
   * Berechnet die Ausgangs-Signale eines einzelnen Bauteils.
   *
   * Für AND/OR/XOR mit variabler Eingangsanzahl werden alle Eingänge ausgewertet.
   * Für das JK-Flip-Flop wird gate.ffState direkt aktualisiert (Zustandsspeicher).
   *
   * @param gate    Bauteil-Instanz (enthält Typ, inputCount, ffState)
   * @param inputs  Aktuelle Eingangs-Signale
   */
  private computeGateOutput(
    gate: GateInstance,
    inputs: (boolean | null)[]
  ): (boolean | null)[] {
    switch (gate.type) {
      // ── AND: HIGH nur wenn ALLE Eingänge HIGH ─────────────────────────────
      case 'and': {
        if (inputs.some(v => v === null)) return [null];
        return [inputs.every(v => v === true)];
      }

      // ── OR: HIGH wenn MINDESTENS EIN Eingang HIGH ─────────────────────────
      case 'or': {
        if (inputs.some(v => v === true)) return [true];
        if (inputs.some(v => v === null)) return [null];
        return [false];
      }

      // ── NOT: Umkehrung des einzigen Eingangs ──────────────────────────────
      case 'not': {
        if (inputs[0] === null) return [null];
        return [!inputs[0]];
      }

      // ── XOR: HIGH wenn UNGERADE ANZAHL von Eingängen HIGH ─────────────────
      case 'xor': {
        if (inputs.some(v => v === null)) return [null];
        const highCount = inputs.filter(v => v === true).length;
        return [highCount % 2 === 1];
      }

      // ── Ausgangs-LED: kein Ausgang ─────────────────────────────────────────
      case 'output':
        return [];

      // ── JK-Flip-Flop (getaktet, speichernd) ───────────────────────────────
      // Eingänge (nach Index): 0=S, 1=J, 2=C(Takt), 3=K, 4=R
      // Ausgänge:              0=Q, 1=Q̄
      case 'jk-ff': {
        const [s, j, c, k, r] = inputs;
        let q = gate.ffState ?? false;

        // Asynchrones Set (S=1 → Q=1, unabhängig vom Takt)
        if (s === true) {
          q = true;
        }
        // Asynchrones Reset (R=1 → Q=0, Vorrang vor S)
        else if (r === true) {
          q = false;
        }
        // Getaktete J/K-Logik (nur wenn Takt HIGH)
        else if (c === true) {
          if (j === true && k === false)  q = true;       // Setzen
          else if (j === false && k === true)  q = false; // Rücksetzen
          else if (j === true && k === true)   q = !q;    // Togglen
          // J=0, K=0 → kein Zustandswechsel (Halten)
        }

        // Zustand für nächsten Simulationsschritt speichern
        gate.ffState = q;
        return [q, !q];
      }

      // ── Halbaddierer: S = A XOR B,  C = A AND B ───────────────────────────
      case 'half-adder': {
        const [a, b] = inputs;
        if (a === null || b === null) return [null, null];
        return [a !== b, a && b];
      }

      // ── Volladdierer: S = A XOR B XOR Cin, Cout = Majorität ──────────────
      case 'full-adder': {
        const [a, b, cin] = inputs;
        if (a === null || b === null || cin === null) return [null, null];
        const sum  = (a ? 1 : 0) + (b ? 1 : 0) + (cin ? 1 : 0);
        const s    = (sum % 2) === 1;        // Summen-Bit
        const cout = sum >= 2;               // Übertrags-Bit
        return [s, cout];
      }

      // ── Text-Label, Taktgeber: kein berechenbarer Ausgang ─────────────────
      case 'text-label':
      case 'clock-gen':
        return [];

      default:
        return [];
    }
  }
}
