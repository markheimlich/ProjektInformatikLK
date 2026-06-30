import { Injectable } from '@angular/core';
import { GateInstance, WireConnection } from '../models/gate.model';

/** Ein einziger Schnappschuss des Schaltkreis-Zustands für Undo. */
export interface BoardSnapshot {
  gates: GateInstance[];
  wires: WireConnection[];
}

/**
 * Verwaltet die Undo-Historie als LIFO-Stack von Schnappschüssen.
 *
 * Wann wird ein Schnappschuss gespeichert?
 *   Vor jedem destruktiven Eingriff (Bauteil/Leitung löschen oder platzieren,
 *   Leitung verbinden, Einfügen aus Zwischenablage, Label-Umbenennung).
 *   Der Zustand NACH der Aktion wird nicht gespeichert — der Stack enthält
 *   immer den Zustand BEVOR die jeweilige Aktion ausgeführt wurde.
 *
 * Undo springt dann einen Schritt zurück: pop → Zustand wiederherstellen.
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  /** Maximale Stack-Tiefe (schützt vor unbegrenztem Speicherwachstum). */
  static readonly MAX_SIZE = 50;

  private stack: BoardSnapshot[] = [];

  /**
   * Speichert den aktuellen Zustand als Schnappschuss (flache Kopie).
   * Alle Objekte werden dabei kopiert, damit spätere Änderungen den Schnappschuss
   * nicht rückwirkend verändern.
   */
  push(gates: GateInstance[], wires: WireConnection[]): void {
    this.stack.push({
      gates: gates.map(g => ({ ...g })),
      wires: wires.map(w => ({ ...w, points: w.points.map(p => ({ ...p })) })),
    });
    // Ältesten Eintrag entfernen wenn die Obergrenze erreicht ist
    if (this.stack.length > HistoryService.MAX_SIZE) {
      this.stack.shift();
    }
  }

  /**
   * Gibt den letzten Schnappschuss zurück und entfernt ihn vom Stack.
   * Gibt null zurück, wenn der Stack leer ist.
   */
  pop(): BoardSnapshot | null {
    return this.stack.pop() ?? null;
  }

  /** True wenn mindestens ein Schritt rückgängig gemacht werden kann. */
  canUndo(): boolean {
    return this.stack.length > 0;
  }

  /** Leert den gesamten Undo-Stack (z.B. beim Zurücksetzen der Simulation). */
  clear(): void {
    this.stack = [];
  }

  /** Aktuelle Stack-Tiefe (für Tests und Debugging). */
  get size(): number {
    return this.stack.length;
  }
}
