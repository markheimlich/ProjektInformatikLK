import {
  getOutputPinMaxConnections,
  computeOrthogonalWaypoints,
  GateType,
} from './gate.model';

// ─── Tests: getOutputPinMaxConnections ────────────────────────────────────────

describe('getOutputPinMaxConnections', () => {
  const basicTypes: GateType[] = [
    'and', 'or', 'not', 'xor',
    'jk-ff', 'half-adder', 'full-adder',
    'input', 'output', 'clock-gen', 'text-label',
  ];

  it('gibt 1 für alle Basistypen zurück (kein Fan-out)', () => {
    for (const type of basicTypes) {
      expect(getOutputPinMaxConnections(type)).toBe(1);
    }
  });

  it('gibt eine positive ganze Zahl zurück', () => {
    for (const type of basicTypes) {
      expect(getOutputPinMaxConnections(type)).toBeGreaterThan(0);
    }
  });
});

// ─── Tests: computeOrthogonalWaypoints ────────────────────────────────────────

describe('computeOrthogonalWaypoints', () => {

  // ── Vorwärts-Fall ──────────────────────────────────────────────────────────

  it('Gerade horizontale Linie (gleiche Y) → keine Waypoints', () => {
    const pts = computeOrthogonalWaypoints(0, 50, 100, 50);
    expect(pts).toEqual([]);
  });

  it('Vorwärts, unterschiedliche Y → Z-Form mit 2 Waypoints', () => {
    const pts = computeOrthogonalWaypoints(0, 0, 100, 60);
    expect(pts).toHaveLength(2);
    expect(pts[0].x).toBe(50); // midX
    expect(pts[0].y).toBe(0);  // startY
    expect(pts[1].x).toBe(50); // midX
    expect(pts[1].y).toBe(60); // endY
  });

  it('Vorwärts, leicht anderer Y → Z-Form (kein Spezialfall für kleine Abstände)', () => {
    const pts = computeOrthogonalWaypoints(0, 0, 80, 2);
    expect(pts).toHaveLength(2);
  });

  // ── Rückwärts-Fall ─────────────────────────────────────────────────────────

  it('Rückwärts → 4 Waypoints (U-Kurve)', () => {
    const pts = computeOrthogonalWaypoints(200, 50, 50, 50);
    expect(pts).toHaveLength(4);
  });

  it('Rückwärts, Pin oben und unten ähnlich → Route geht nach oben (kürzer)', () => {
    // Start: x=200, y=10; Ende: x=0, y=10 — beide oben → oben kürzer als unten
    const pts = computeOrthogonalWaypoints(200, 10, 0, 10, 100, 100);
    // routeY sollte kleiner als min(10,10) sein → also negativ / < 10
    const routeY = pts[1].y;
    expect(routeY).toBeLessThan(10);
  });

  it('Rückwärts, Pin unten → Route geht nach unten wenn kürzer', () => {
    // Start: x=200, y=90; Ende: x=0, y=90; Bauteile bis y=100
    const pts = computeOrthogonalWaypoints(200, 90, 0, 90, 100, 100);
    // aboveY = 90 - 24 = 66, belowY = 100 + 24 = 124
    // costAbove = |90-66| + |90-66| = 48; costBelow = |90-124| + |90-124| = 68
    // → oben kürzer
    const routeY = pts[1].y;
    expect(routeY).toBeLessThan(90);
  });

  it('Rückwärts, ohne fromGateBottomY → fällt auf einfache obere Route zurück', () => {
    const pts = computeOrthogonalWaypoints(200, 50, 0, 50);
    expect(pts).toHaveLength(4);
    // Wenn keine Gate-Dimensionen → belowY = max(50,50) + GAP = 74
    // costAbove = |50-26| + |50-26| = 48; costBelow = |50-74| + |50-74| = 48
    // Bei Gleichstand: oben bevorzugt
    expect(pts[1].y).toBeLessThanOrEqual(50);
  });

  it('x-Koordinaten der Waypoints liegen immer zwischen Start und Ende (mit GAP)', () => {
    const pts = computeOrthogonalWaypoints(200, 30, 50, 80);
    expect(pts[0].x).toBeGreaterThan(200); // start.x + GAP
    expect(pts[3].x).toBeLessThan(50);     // end.x - GAP
  });

  // ── Regression: Leitung um "erweiterte" (hohe) Gatter herumleiten ──────────

  it('Rückwärts, erweitertes (hohes) Ziel-Gatter → obere Route räumt die echte Gatter-Oberkante frei, nicht nur die Pin-Höhe', () => {
    // Szenario aus dem gemeldeten Bug: Das Ziel ist ein AND-Gatter mit vielen
    // Eingängen (dadurch y-Bereich 50–350, "erweitert"). Der verbundene
    // Eingangs-Pin liegt bei y=200 — weit unterhalb der echten Oberkante (50).
    // Ohne toGateTopY würde aboveY = min(200,200)-24 = 176 betragen, was
    // MITTEN IM Gatter liegt (zwischen 50 und 350) — die Leitung hätte
    // sichtbar durch den Gatter-Körper geschnitten (der gemeldete Bug).
    const pts = computeOrthogonalWaypoints(
      300, 200,   // Start: Ausgangs-Pin eines normalen Gatters
      50, 200,    // Ende: Eingangs-Pin des erweiterten Ziel-Gatters
      220, 350,   // fromGateBottomY, toGateBottomY
      180, 50     // fromGateTopY, toGateTopY
    );
    const routeY = pts[1].y;
    // Route muss oberhalb der ECHTEN Ziel-Gatter-Oberkante (50) liegen,
    // nicht nur oberhalb der reinen Pin-Höhe (200).
    expect(routeY).toBeLessThan(50);
  });

  it('Ohne Top-Angabe (Fallback) orientiert sich die obere Route nur an der Pin-Höhe', () => {
    // Dokumentiert das frühere (fehlerhafte) Verhalten als Kontrast zum Test
    // oben: ohne die echten Gatter-Oberkanten wird nur ein fester Abstand
    // (GAP) von der Pin-Höhe genommen — bei einem hohen Gatter reicht das
    // nicht aus, um über dessen tatsächliche Oberkante zu gelangen.
    const pts = computeOrthogonalWaypoints(300, 200, 50, 200, 220, 350);
    const routeY = pts[1].y;
    expect(routeY).toBe(176); // min(200,200) - 24, ignoriert die Gatter-Höhe
  });
});
