/**
 * Alle unterstützten Komponenten-Typen in GatterPLUS (Phase 2).
 *
 * Gatter:    'and' | 'or' | 'not' | 'xor'
 * Flip-Flop: 'jk-ff'
 * Kombi:     'half-adder' | 'full-adder'
 * I/O:       'input' | 'output' | 'clock-gen' | 'text-label'
 */
export type GateType =
  | 'and' | 'or' | 'not' | 'xor'
  | 'jk-ff'
  | 'half-adder' | 'full-adder'
  | 'input' | 'output'
  | 'clock-gen' | 'text-label';

/**
 * Drehwinkel einer Komponente (im Uhrzeigersinn, 0 = Standard-Ausrichtung).
 */
export type Rotation = 0 | 90 | 180 | 270;

/**
 * Gehäuse-Farbe einer Komponente.
 * 'default' = weißer Körper (Standard).
 */
export type GateColor = 'default' | 'yellow' | 'green' | 'red' | 'orange';

/**
 * Eine auf dem Whiteboard platzierte Komponenten-Instanz.
 * (x, y) sind die Canvas-Koordinaten der linken oberen Ecke NACH Rotation.
 */
export interface GateInstance {
  /** Eindeutige ID, z.B. 'gate-1' */
  id: string;
  /** Typ der Komponente */
  type: GateType;
  /** Horizontale Canvas-Position (Pixel) */
  x: number;
  /** Vertikale Canvas-Position (Pixel) */
  y: number;
  /** Drehwinkel (Uhrzeigersinn). Standard: 0. */
  rotation: Rotation;
  /** Gehäuse-Farbe. Standard: 'default' (weiß). */
  color: GateColor;
  /**
   * Anzahl der Eingangspins (nur für and/or/xor: 2–8).
   * Für alle anderen Typen: fixed (durch getGatePinOffsets bestimmt).
   */
  inputCount: number;
  /**
   * Nur für type === 'input' / 'clock-gen': aktueller Ausgangs-Zustand.
   * true = HIGH, false = LOW.
   */
  inputValue?: boolean;
  /**
   * Nur für type === 'jk-ff': gespeicherter Q-Zustand (Flip-Flop-Speicher).
   */
  ffState?: boolean;
  /**
   * Nur für type === 'text-label': anzuzeigender Text.
   */
  label?: string;
  /**
   * Nur für type === 'clock-gen': Periodendauer in Millisekunden.
   */
  clockPeriodMs?: number;
}

/**
 * Eine Leitungsverbindung zwischen Ausgangs-Pin und Eingangs-Pin.
 * Enthält optional Wegpunkte für eine orthogonale (rechtwinklige) Führung.
 */
export interface WireConnection {
  /** Eindeutige Leitungs-ID */
  id: string;
  /** ID der Quell-Komponente */
  fromGateId: string;
  /** Pin-Index des Ausgangs */
  fromPinIndex: number;
  /** ID der Ziel-Komponente */
  toGateId: string;
  /** Pin-Index des Eingangs */
  toPinIndex: number;
  /**
   * Zwischenpunkte für die rechtwinklige Leitungsführung.
   * Leer = gerade Linie von Start zu Ende.
   * In der Regel 2 Punkte für einen horizontalen Knick:
   *   Start → (midX, startY) → (midX, endY) → Ende
   */
  points: { x: number; y: number }[];
}

/**
 * X/Y-Versatz eines Pins relativ zur linken oberen Ecke der NICHT-rotierten Komponente.
 */
export interface PinOffset {
  x: number;
  y: number;
}

/**
 * Erkennungs-Radius für Pin-Klicks (logische Pixel).
 */
export const PIN_HIT_RADIUS = 12;

/**
 * Feste Abmessungen aller Komponenten-Typen (nicht-rotiert, ohne variable Eingänge).
 * width  = Breite des gesamten visuellen Elements (inkl. Drähte)
 * height = Höhe des gesamten visuellen Elements
 */
export const GATE_BASE_SIZE: Record<GateType, { w: number; h: number }> = {
  and:          { w: 76, h: 52 },
  or:           { w: 76, h: 52 },
  not:          { w: 76, h: 52 },
  xor:          { w: 76, h: 52 },
  'jk-ff':      { w: 76, h: 100 },
  'half-adder': { w: 76, h: 52 },
  'full-adder': { w: 76, h: 70 },
  input:        { w: 76, h: 52 },
  output:       { w: 76, h: 52 },
  'clock-gen':  { w: 76, h: 52 },
  'text-label': { w: 80, h: 30 },
};

/**
 * Gibt die tatsächlichen Abmessungen einer Komponenten-Instanz zurück.
 * Für and/or/xor wächst die Höhe mit der Eingangsanzahl.
 */
export function getGateDimensions(gate: GateInstance): { w: number; h: number } {
  const base = GATE_BASE_SIZE[gate.type];
  if (gate.type === 'and' || gate.type === 'or' || gate.type === 'xor') {
    // Höhe wächst mit Eingangsanzahl: min. 52px, dann 16px pro Eingang
    const h = Math.max(base.h, (gate.inputCount + 1) * 16 + 8);
    return { w: base.w, h };
  }
  return { ...base };
}

/**
 * Berechnet alle Pin-Positionen für eine Komponenten-Instanz.
 * Berücksichtigt variable Eingangsanzahl (and/or/xor).
 * Positionen sind relativ zur linken oberen Ecke der NICHT-rotierten Komponente.
 */
export function getGatePinOffsets(
  gate: GateInstance
): { inputs: PinOffset[]; outputs: PinOffset[] } {
  const dim = getGateDimensions(gate);

  switch (gate.type) {
    case 'and':
    case 'or':
    case 'xor': {
      // Pin-Positionen exakt nach CSS-Logik berechnen:
      //   .pins-in { justify-content: space-around; padding: 10px 0 }
      //   .wire    { height: 2px }
      // CSS space-around: jedes Element bekommt (freier_platz / n) als Einheit,
      // davon je eine halbe Einheit vor und nach dem Element.
      const PAD = 10;     // padding oben und unten
      const T   = 2;      // Draht-Höhe in px
      const n   = gate.inputCount;
      const unit    = (dim.h - 2 * PAD - n * T) / n;
      const halfUnit = unit / 2;
      const inputs = Array.from({ length: n }, (_, i) => ({
        x: 0,
        y: Math.round(PAD + halfUnit + T / 2 + i * (unit + T)),
      }));
      return { inputs, outputs: [{ x: dim.w, y: Math.round(dim.h / 2) }] };
    }

    case 'not':
      return {
        inputs:  [{ x: 0,      y: 26 }],
        outputs: [{ x: dim.w,  y: 26 }],
      };

    case 'input':
      return {
        inputs:  [],
        outputs: [{ x: dim.w, y: 26 }],
      };

    case 'output':
      return {
        inputs:  [{ x: 0, y: 26 }],
        outputs: [],
      };

    case 'clock-gen':
      return {
        inputs:  [],
        outputs: [{ x: dim.w, y: 26 }],
      };

    case 'text-label':
      return { inputs: [], outputs: [] };

    case 'jk-ff':
      // Eingänge (oben→unten): S, J, C (Takt), K, R
      // Ausgänge: Q (oben), Q̄ (unten)
      return {
        inputs: [
          { x: 0, y: 15 }, // S
          { x: 0, y: 30 }, // J
          { x: 0, y: 50 }, // C (Takt)
          { x: 0, y: 70 }, // K
          { x: 0, y: 85 }, // R
        ],
        outputs: [
          { x: dim.w, y: 30 }, // Q
          { x: dim.w, y: 70 }, // Q̄
        ],
      };

    case 'half-adder':
      // Eingänge: A, B — Ausgänge: S (Summe), C (Carry)
      return {
        inputs:  [{ x: 0, y: 18 }, { x: 0, y: 34 }],
        outputs: [{ x: dim.w, y: 18 }, { x: dim.w, y: 34 }],
      };

    case 'full-adder':
      // Eingänge: A, B, Cin — Ausgänge: S (Summe), Cout (Übertrag)
      return {
        inputs:  [{ x: 0, y: 14 }, { x: 0, y: 35 }, { x: 0, y: 56 }],
        outputs: [{ x: dim.w, y: 22 }, { x: dim.w, y: 48 }],
      };

    default:
      return { inputs: [], outputs: [] };
  }
}

/**
 * Berechnet die Weltkoordinaten eines Pins unter Berücksichtigung der Rotation.
 *
 * Algorithmus:
 * 1. Offset des Pins relativ zur linken oberen Ecke (nicht-rotiert)
 * 2. Offset relativ zum Mittelpunkt des Bauteils umrechnen
 * 3. Um den Mittelpunkt um den Drehwinkel rotieren (Uhrzeigersinn)
 * 4. Wieder in Weltkoordinaten umrechnen
 *
 * @param gate      Die Komponenten-Instanz (enthält Position, Typ, Rotation)
 * @param pinType   'input' oder 'output'
 * @param pinIndex  Index des Pins innerhalb des Typs
 */
export function getPinWorldPos(
  gate: GateInstance,
  pinType: 'input' | 'output',
  pinIndex: number
): { x: number; y: number } {
  const offsets = getGatePinOffsets(gate);
  const pin = pinType === 'input' ? offsets.inputs[pinIndex] : offsets.outputs[pinIndex];
  if (!pin) return { x: gate.x, y: gate.y };

  const dim = getGateDimensions(gate);

  // Mittelpunkt des Bauteils in Weltkoordinaten
  const cx = gate.x + dim.w / 2;
  const cy = gate.y + dim.h / 2;

  // Versatz des Pins relativ zum Mittelpunkt
  const dx = pin.x - dim.w / 2;
  const dy = pin.y - dim.h / 2;

  // Rotation im Uhrzeigersinn: cos(θ) für x-Komponente, sin(θ) für y-Komponente
  const angle = (gate.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Rotierter Versatz (Uhrzeigersinn: x' = x·cos + y·sin, y' = -x·sin + y·cos)
  const rx = dx * cos + dy * sin;
  const ry = -dx * sin + dy * cos;

  return { x: Math.round(cx + rx), y: Math.round(cy + ry) };
}

/**
 * Prüft ob ein Punkt (px, py) innerhalb des Bounding-Box eines Bauteils liegt.
 * Berücksichtigt die Rotation durch inverse Rotation des Testpunkts.
 */
export function isPointInGate(
  px: number,
  py: number,
  gate: GateInstance
): boolean {
  const dim = getGateDimensions(gate);
  const cx = gate.x + dim.w / 2;
  const cy = gate.y + dim.h / 2;

  // Testpunkt relativ zum Mittelpunkt
  const dx = px - cx;
  const dy = py - cy;

  // Inverse Rotation (gegen Uhrzeigersinn = negativer Winkel)
  const angle = -(gate.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;

  // Im rotierten Referenzrahmen: ist der Punkt innerhalb des Rechtecks?
  return (
    lx >= -dim.w / 2 && lx <= dim.w / 2 &&
    ly >= -dim.h / 2 && ly <= dim.h / 2
  );
}

/**
 * Hilfsfunktion: Erstellt eine neue GateInstance mit Standardwerten.
 */
export function createGateInstance(
  id: string,
  type: GateType,
  x: number,
  y: number
): GateInstance {
  return {
    id,
    type,
    x,
    y,
    rotation: 0,
    color: 'default',
    inputCount: type === 'and' || type === 'or' || type === 'xor' ? 2 : 1,
    inputValue: false,
    ffState: false,
    clockPeriodMs: 1000,
    label: type === 'text-label' ? 'Label' : undefined,
  };
}

/**
 * Berechnet die Wegpunkte für eine orthogonale (rechtwinklige) Leitung.
 *
 * Vorwärts (x2 >= x1): Mittelknick horizontal.
 *   Start → (midX, y1) → (midX, y2) → Ende
 *
 * Rückwärts (x2 < x1): U-Kurve um die Komponenten herum.
 *   Start → (x1+GAP, y1) → (x1+GAP, midY) → (x2-GAP, midY) → (x2-GAP, y2) → Ende
 */
export function computeOrthogonalWaypoints(
  x1: number, y1: number,
  x2: number, y2: number
): { x: number; y: number }[] {
  if (x2 >= x1) {
    // Normalfall: Ziel liegt rechts → Mittelknick
    const midX = Math.round((x1 + x2) / 2);
    return [{ x: midX, y: y1 }, { x: midX, y: y2 }];
  }
  // Rückwärts-Fall: Ziel liegt links → U-Kurve
  const GAP = 20;
  const xRight = x1 + GAP;
  const xLeft  = x2 - GAP;
  // Wenn beide Pins auf ähnlicher Höhe sind → über die Komponenten routen
  const midY = Math.abs(y2 - y1) > 40
    ? Math.round((y1 + y2) / 2)
    : Math.min(y1, y2) - 35;
  return [
    { x: xRight, y: y1 },
    { x: xRight, y: midY },
    { x: xLeft,  y: midY },
    { x: xLeft,  y: y2 },
  ];
}

// ─── Legacy-Kompatibilität ────────────────────────────────────────────────────
// Wird von simulation.service.ts und whiteboard.ts nicht mehr direkt genutzt,
// aber zum Übergang behalten. Alle neuen Stellen nutzen getGatePinOffsets().
export const GATE_PIN_OFFSETS: Record<GateType, { inputs: PinOffset[]; outputs: PinOffset[] }> = {
  and:          { inputs: [{ x:0, y:18 }, { x:0, y:34 }], outputs: [{ x:76, y:26 }] },
  or:           { inputs: [{ x:0, y:18 }, { x:0, y:34 }], outputs: [{ x:76, y:26 }] },
  not:          { inputs: [{ x:0, y:26 }],                outputs: [{ x:76, y:26 }] },
  xor:          { inputs: [{ x:0, y:18 }, { x:0, y:34 }], outputs: [{ x:76, y:26 }] },
  'jk-ff':      { inputs: [{ x:0,y:15 },{x:0,y:30},{x:0,y:50},{x:0,y:70},{x:0,y:85}], outputs: [{ x:76,y:30 },{ x:76,y:70 }] },
  'half-adder': { inputs: [{ x:0, y:18 }, { x:0, y:34 }], outputs: [{ x:76,y:18 }, { x:76,y:34 }] },
  'full-adder': { inputs: [{ x:0,y:14 },{x:0,y:35},{x:0,y:56}], outputs: [{ x:76,y:22 },{ x:76,y:48 }] },
  input:        { inputs: [],             outputs: [{ x:76, y:26 }] },
  output:       { inputs: [{ x:0, y:26 }], outputs: [] },
  'clock-gen':  { inputs: [],             outputs: [{ x:76, y:26 }] },
  'text-label': { inputs: [],             outputs: [] },
};
