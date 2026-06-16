/**
 * Alle unterstützten Komponenten-Typen in GatterPLUS.
 *
 * Gatter:  'and' | 'or' | 'not'
 * I/O:     'input' (Eingang-Schalter) | 'output' (Ausgang-LED)
 */
export type GateType = 'and' | 'or' | 'not' | 'input' | 'output';

/**
 * Eine auf dem Whiteboard platzierte Komponenten-Instanz.
 * (x, y) sind logische Canvas-Koordinaten, unabhängig vom Pan-Versatz.
 */
export interface GateInstance {
  /** Eindeutige ID, z.B. 'gate-1' */
  id: string;
  /** Typ der Komponente */
  type: GateType;
  /** Horizontale Canvas-Position (Pixel, wächst nach rechts) */
  x: number;
  /** Vertikale Canvas-Position (Pixel, wächst nach unten) */
  y: number;
  /**
   * Nur für type === 'input': aktueller Schalter-Zustand.
   * true = logisch 1 (HIGH), false = logisch 0 (LOW).
   */
  inputValue?: boolean;
}

/**
 * Eine Leitungsverbindung zwischen dem Ausgangs-Pin einer Komponente
 * und dem Eingangs-Pin einer anderen.
 */
export interface WireConnection {
  /** Eindeutige Leitungs-ID, z.B. 'wire-1' */
  id: string;
  /** ID der Quell-Komponente (Ausgangs-Seite) */
  fromGateId: string;
  /** Index des Ausgangs-Pins der Quell-Komponente (immer 0 bei einfachen Gattern) */
  fromPinIndex: number;
  /** ID der Ziel-Komponente (Eingangs-Seite) */
  toGateId: string;
  /** Index des Eingangs-Pins der Ziel-Komponente (0 = erster Pin, 1 = zweiter) */
  toPinIndex: number;
}

/**
 * X/Y-Versatz eines Pins relativ zur linken oberen Ecke der Komponente.
 * Diese Werte müssen exakt mit der gerenderten CSS-Größe der Komponente übereinstimmen.
 */
export interface PinOffset {
  /** Horizontaler Abstand vom linken Rand der Komponente (Pixel) */
  x: number;
  /** Vertikaler Abstand vom oberen Rand der Komponente (Pixel) */
  y: number;
}

/**
 * Radius (in logischen Pixeln) in dem ein Klick auf einen Pin erkannt wird.
 * Größerer Wert = einfacher zu treffen, aber mehr versehentliche Treffer.
 */
export const PIN_HIT_RADIUS = 12;

/**
 * Defines alle Pin-Positionen für jeden Komponenten-Typ.
 *
 * Die Positionen sind in Pixel relativ zur linken oberen Ecke
 * des jeweiligen Komponenten-DOM-Elements gemessen.
 *
 * Alle Komponenten folgen dem Layout:
 *   [Eingangs-Drähte 12px] + [Körper 52px] + [Ausgangs-Draht 12px] = 76px Breite
 *   Höhe: 52px
 *
 * Input-Pins (y-Position) werden anhand der CSS justify-content: space-around berechnet:
 *   Bei 2 Pins in 52px Höhe (10px Padding oben/unten → 32px innere Höhe):
 *   space-around: 7px Abstand → Pin 0 bei y=18, Pin 1 bei y=34
 */
export const GATE_PIN_OFFSETS: Record<
  GateType,
  { inputs: PinOffset[]; outputs: PinOffset[] }
> = {
  /** UND-Gatter: 2 Eingänge links, 1 Ausgang rechts */
  and: {
    inputs: [
      { x: 0, y: 18 }, // Eingang A (oben)
      { x: 0, y: 34 }, // Eingang B (unten)
    ],
    outputs: [
      { x: 76, y: 26 }, // Ausgang Q (rechts, zentriert)
    ],
  },

  /** ODER-Gatter: gleiche Pin-Positionen wie AND */
  or: {
    inputs: [
      { x: 0, y: 18 },
      { x: 0, y: 34 },
    ],
    outputs: [{ x: 76, y: 26 }],
  },

  /** NICHT-Gatter: 1 Eingang links (zentriert), 1 Ausgang rechts */
  not: {
    inputs: [
      { x: 0, y: 26 }, // Eingang A (einziger, vertikal zentriert)
    ],
    outputs: [
      { x: 76, y: 26 }, // Ausgang Q
    ],
  },

  /**
   * Eingangs-Schalter: kein Eingang, 1 Ausgang rechts.
   * Breite: 76px (64px Körper + 12px Ausgangs-Draht).
   */
  input: {
    inputs: [],
    outputs: [
      { x: 76, y: 26 }, // Ausgang (rechts, zentriert)
    ],
  },

  /**
   * Ausgangs-LED: 1 Eingang links, kein Ausgang.
   * Breite: 76px (12px Eingangs-Draht + 64px Körper).
   */
  output: {
    inputs: [
      { x: 0, y: 26 }, // Eingang (links, zentriert)
    ],
    outputs: [],
  },
};
