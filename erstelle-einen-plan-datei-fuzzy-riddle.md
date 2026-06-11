# Anforderungsdokument: Moderner LogikSim als Webanwendung

> **Zweck dieses Dokuments:** Sammlung aller Anforderungen, Technologien und Rahmenbedingungen für die Entwicklung einer modernen, webbasierten Neuentwicklung von LogikSim — geeignet für den Schulunterricht (Informatik/Digitaltechnik) inklusive Prüfungsmodus. Dieses Dokument ist kein Implementierungsplan, sondern eine Anforderungsbasis für eine neue Entwicklungssitzung.

---

## 1. Was ist LogikSim? (Bestandsaufnahme der bestehenden Plattform)

### Ursprung und Technologie
- **Name:** LogikSim (auch: LogicSim)
- **Erscheinungsjahr:** 2006
- **Programmiersprache:** Delphi (Pascal-basiert)
- **Plattform:** Windows-Desktop-Applikation (`.exe`)
- **Lizenz:** Open Source (GPLv2)
- **Kosten:** Kostenlos
- **Status:** Letzte Aktualisierung ~2006, nicht mehr aktiv weiterentwickelt

### Funktionsumfang (Ist-Zustand)
- Grundgatter: AND, OR, NOT
- Integrierte Schaltkreise: Volladdierer, Decoder, Flip-Flops (nur JK-Flip-Flop vorhanden — andere müssen abgeleitet werden)
- Flexibles Verbindungskonzept (Leitungen zwischen Komponenten)
- Echtzeit-Signalverfolgung (Stromfluss-Visualisierung)
- Eigene Module/Komponenten baubar und wiederverwendbar
- 7-Segment-Anzeigen, Wertetabellen, Zeitdiagramme (in verwandten Tools vorhanden)
- **Kein Undo/Redo (kein Ctrl+Z)**
- **Keine Webversion**
- **Kein Nutzerkonten-System**
- **Kein Prüfungsmodus**
- **Keine Echtzeit-Kollaboration**
- **Keine Tablet-/Mobilunterstützung**

### UI-Analyse (Screenshot LogikSim 0.6.4)

Aus einem Screenshot von Version 0.6.4 (serieller_Addierer.sim) lassen sich folgende Details ableiten:

**Menüstruktur:**
- Menüleiste: Datei, Bearbeiten, Ansicht, Bauteile, Leitungen, Hilfe
- Toolbar oben: DEL, Auswahlwerkzeuge, dann direkte Buttons für alle Komponenten

**Sichtbare Komponenten in der Toolbar:**
- Gatter: `&` (AND), `≥1` (OR), `=1` (XOR) — **IEC/DIN-Notation bestätigt**
- Flip-Flops: JK-FF (mit J, C, S, R, K Pins), Register
- Sonderkomponenten: HA (Halbaddierer), VA (Volladdierer)
- Ein-/Ausgabe: LED, Text-Label (`oA`), Taktgeber (TG)
- Bus/Register: Mehrbit-Blöcke (0 0 0 0)

**Rechte Seitenleiste ("Standardbauteile"):**
- Konfiguration der Eingangsanzahl (Spinner: 2–N)
- 4 Ausrichtungs-/Rotations-Buttons (0°, 90°, 180°, 270°)
- Farb-Auswahl für Komponenten (grün, rot, gelb, orange, grün)
- Taktgeber-Konfiguration: Taktanzahl (n), Taktlänge (ms), Wellenform-Auswahl

**Schaltkreis-Darstellung:**
- Komponenten: gelb ausgefüllt, orthogonale Verdrahtung (rechtwinklig)
- Beschriftungen mit vorangestelltem `°`-Symbol (Kreis als Label-Marker)
- Drahtfarbe: schwarz, Signalzustand nicht im Screenshot erkennbar (Simulation evtl. nicht aktiv)

**Was dies für die Webanwendung bedeutet:**
- IEC-Notation ist Pflicht (kein ANSI-Fallback als Standard)
- Rotierbarkeit aller Komponenten in 4 Richtungen Pflicht
- Farbgebung von Komponenten als Feature gewünscht
- Taktgeber mit einstellbarer Länge/Anzahl Pflicht
- Seitenleiste für Eigenschaften der selektierten Komponente

---

### Bekannte Alternativen (Vergleichslandschaft 2024–2026)

| Tool | Plattform | Besonderheiten | Nachteile |
|------|-----------|----------------|-----------|
| Logisim Evolution | Java Desktop | Ausgereift, IEC-Notation, Logic Analyzer | Benötigt Java, kein Browser |
| Digital (H. Neemann) | Java Desktop | TTL-Komponenten, Timing-Analyse | Kein Browser |
| CircuitVerse | Web (Browser) | Timing-Diagramme, Open Source | ANSI-Notation (kein IEC/DIN) |
| LogiJS | Web (Browser) | JSON-Format, GPL | Eingeschränkter Funktionsumfang |
| Piiri | Web (Browser) | Impulse-Diagramme, Klassenmanagement | Kostenpflichtig für Schulen |
| Logigator | Web + Desktop | Modern, schnell | Kein Prüfungsmodus |
| Logisim (original) | Java Desktop | Klassiker | Seit 2011 eingestellt |

**Marktlücke:** Keine der bestehenden Lösungen bietet einen vollständigen Prüfungsmodus mit Lehrer-/Schüler-Konten und sicherer Klausurumgebung im Browser.

---

## 2. Zielbeschreibung der neuen Webanwendung

Eine moderne, browserbasierte Neuentwicklung von LogikSim, die:
- ohne Installation direkt im Browser läuft (Schüler brauchen nur eine URL)
- Lehrkräfte unterstützt beim Erstellen, Verteilen und Bewerten von Aufgaben
- einen sicheren Prüfungsmodus mit Einschränkungen bietet
- professionelle UX-Standards erfüllt (Keyboard Shortcuts, Undo/Redo, etc.)
- offen und wartbar bleibt (kein Vendor Lock-in)

---

## 3. Technologie-Anforderungen

### 3.1 Frontend

**Framework:**
- **Angular** (TypeScript-first, opinioniertes Full-Framework — gesetzt)
- Angular CLI für Projektstruktur und Build
- Angular Material oder PrimeNG als UI-Komponentenbibliothek
- Responsive Design (Desktop-first, Tablet-kompatibel)

**Zeichenfläche / Schaltungseditor:**
- **Canvas-basiert** (HTML5 Canvas API oder WebGL via PixiJS/Konva.js) für Performance bei großen Schaltkreisen — ODER —
- **SVG-basiert** (leichter für Accessibility und Vektordruck)
- Empfehlung: Kombinierter Ansatz (SVG für statische Elemente, Canvas für Simulation)
- Alternativ: Spezialbibliothek wie **Rete.js**, **React Flow**, **JointJS**, **Fabric.js** prüfen

**State Management & Undo/Redo:**
- Zentraler Store: **NgRx** (Angular-native Redux-Implementierung) oder **NgXs** als leichtere Alternative
- **Command Pattern** (jede Aktion ist ein reversibler Command) für Undo/Redo
- Undo-Stack mit konfigurierbarer Tiefe (min. 50 Schritte)
- Persistenz des Stands via LocalStorage / IndexedDB als Autosave

**Keyboard Shortcuts (Pflicht):**

| Kürzel | Funktion |
|--------|----------|
| `Ctrl+Z` | Rückgängig (Undo) |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Wiederholen (Redo) |
| `Ctrl+C` | Kopieren (selektierte Elemente) |
| `Ctrl+V` | Einfügen |
| `Ctrl+X` | Ausschneiden |
| `Ctrl+A` | Alles auswählen |
| `Ctrl+S` | Speichern |
| `Ctrl+Z` (mehrfach) | Mehrfach rückgängig |
| `Del` / `Backspace` | Selektierte Elemente löschen |
| `Escape` | Auswahl aufheben / Werkzeug abbrechen |
| `Space` | Pan-Modus aktivieren (Schaltfläche verschieben) |
| `+` / `-` / `Ctrl+Scroll` | Zoom in/out |
| `Ctrl+0` | Zoom zurücksetzen |
| `Ctrl+G` | Gruppieren / Subschaltkreis erstellen |
| `F5` | Simulation starten/stoppen |
| `R` | Selektiertes Objekt rotieren |

**Notationsunterstützung:**
- IEC 60617 (europäischer Standard, für Schulen in D/A/CH Pflicht)
- ANSI/IEEE (optional umschaltbar)
- DIN-Symbole

### 3.2 Backend

**Sprache/Framework:**
- Node.js + Express/Fastify oder
- Python + FastAPI oder
- Go (Gin/Fiber) für Performance
- Empfehlung: **Node.js + TypeScript** (Codesharing mit Frontend möglich)

**Datenbank:**
- **PostgreSQL** (relational, bewährt für Benutzer-/Rollenverwaltung)
- **Redis** (Session-Cache, Prüfungs-State, Echtzeit-Locks)

**Authentifizierung:**
- JWT-basierte Authentifizierung (Access + Refresh Token)
- Optional: OAuth 2.0 / SAML für Schulen mit SSO (z.B. Microsoft 365 / Google Workspace)
- Rollenmodell: `admin`, `teacher`, `student`, `guest`
- Schul-/Institutionen-Verwaltung (Multi-Tenant)

**API:**
- RESTful API für CRUD-Operationen
- WebSocket (via Socket.io oder native WebSocket API) für:
  - Echtzeit-Kollaboration (optional)
  - Prüfungs-Monitoring (Live-Status der Schüler)
  - Zeitsteuerung bei Klausuren

**Dateispeicherung:**
- Schaltkreise als JSON im Backend gespeichert
- Optionaler Export als PNG, SVG, PDF
- Import/Export im eigenen Format + Kompatibilität zu Logisim (.circ) prüfen

### 3.3 Deployment / Infrastruktur

- **Build:** `ng build --configuration production` → statischer Output in `dist/`
- **Containerisierung:** Docker + Docker Compose
- **Reverse Proxy:** nginx (served Angular-Build als statische Dateien + Proxy zum Backend)
- **Deployment-Ziel: Eigener Server** (die Webanwendung soll über eine URL erreichbar sein)
  - Frontend: nginx serviert den Angular `dist/`-Build
  - Backend: Node.js-Prozess hinter nginx (via Reverse Proxy)
  - Datenbank: PostgreSQL auf demselben Server oder separater Managed DB
- **HTTPS:** Pflicht (Let's Encrypt via Certbot oder Caddy)
- **Datenschutz:** DSGVO-konform (Daten auf deutschen/europäischen Servern)
- **Domain:** Schulspezifische Domain oder Subdomain (z.B. logiksim.schule.de)
- **Offline-Fähigkeit:** Progressive Web App (PWA) optional — zumindest Basis-Funktionalität ohne Internet

---

## 4. Funktionale Anforderungen (Schaltungseditor)

### 4.1 Verfügbare Komponenten (Mindestumfang)

**Grundgatter:**
- AND, OR, NOT, NAND, NOR, XOR, XNOR
- Puffer, Tristate-Puffer
- Gatter mit einstellbarer Eingangsanzahl (2–8 Eingänge)
- Direktinvertierung an Eingängen (Bubble-Notation)

**Flip-Flops:**
- SR-Flip-Flop (SR-Latch)
- D-Flip-Flop
- JK-Flip-Flop
- T-Flip-Flop
- Getaktete Varianten (clocked, master-slave)
- Register

**Kombinatorische Bausteine:**
- Multiplexer / Demultiplexer
- Encoder / Decoder
- Halb- und Volladdierer
- Komparatoren
- ROM/RAM (einfach)

**Ein-/Ausgabe:**
- Schalter (Toggle, Push-Button)
- LED (ein/aus, farbig)
- 7-Segment-Anzeige mit BCD-Decoder
- Taktgenerator (einstellbare Frequenz)
- Bus-Leitungen (mehrere Bits gebündelt)
- Konstante (0 / 1)

**Analyse-Werkzeuge:**
- Wahrheitstabelle (automatisch generiert aus Schaltkreis)
- Timing-Diagramm / Logikanalysator
- Zustandstabelle für Flip-Flop-Schaltungen

### 4.2 Editor-Funktionen

- Drag-and-Drop-Platzierung aus Komponentenbibliothek
- Leitungsroutung (auto-routing + manuell)
- Gruppenauswahl (Lasso-Selektion, Shift-Click)
- Kopieren/Einfügen von Teilschaltungen
- Subschaltkreise / eigene Komponenten erstellen und benennen
- Zoom & Pan (Maus + Keyboard)
- Raster-Snapping (einstellbar)
- Minimap für große Schaltkreise
- Mehrere Tabs / Sheets pro Projekt
- Bennenung von Leitungen (Net-Labels)
- Kommentarfelder / Beschriftungen auf der Zeichenfläche
- Schaltkreis-Validierung (Kurzschluss-Erkennung etc.)

### 4.3 Simulation

- Ereignisgesteuerte Simulation (Event-Driven, nicht takt-synchron by default)
- Signalverzögerung einstellbar (optional)
- Echtzeit-Darstellung von Signalzuständen (0/1/unbekannt/hochohmig)
- Manuelle Schrittweise-Simulation (Step-by-Step-Modus)
- Simulation pausieren / zurücksetzen

---

## 5. Benutzerkonten-System

### 5.1 Rollen und Rechte

| Rolle | Beschreibung |
|-------|-------------|
| `admin` | Verwaltet die Plattform, legt Schulen/Klassen an |
| `teacher` | Erstellt Aufgaben, verwaltet Klassen, startet Prüfungen |
| `student` | Bearbeitet Aufgaben, nimmt an Prüfungen teil |
| `guest` | Kann Editor nutzen ohne Speichern (Demo-Modus) |

### 5.2 Lehrer-Funktionen

- Klassen anlegen und Schüler einladen (per Code oder E-Mail)
- Aufgaben/Schaltkreise erstellen und Schülern zuweisen
- Musterlösung hinterlegen (für automatische Auswertung)
- Abgaben einsehen und bewerten (manuell oder halbautomatisch)
- Prüfungen planen und verwalten (Start/Ende, Zeitlimit)
- Live-Dashboard während Prüfungen (Wer ist fertig, wer ist online)
- Abgaben exportieren (PDF, JSON)
- Aufgaben-Bibliothek verwalten (eigene + geteilte Aufgaben)

### 5.3 Schüler-Funktionen

- Schultauglich registrieren (per Klassen-Code, ohne E-Mail-Pflicht)
- Zugewiesene Aufgaben einsehen
- Eigene Schaltkreise speichern und benennen
- Abgabe einreichen (mit Timestamp)
- Ergebnisse/Feedback einsehen (nach Freigabe durch Lehrer)
- Schaltkreis-Verlauf / Versionen einsehen (optional)

---

## 6. Prüfungsmodus (Klausur-Modus)

### 6.1 Anforderungen an einen sicheren Prüfungsmodus

Ein „sicherer" Prüfungsmodus im Browser hat naturgemäß Grenzen ohne spezielle Hardware (SafeExamBrowser etc.). Die Anforderungen gliedern sich in **Soft-Security** (Browser-seitig) und **Hard-Security** (zusätzliche Software/Infrastruktur).

### 6.2 Prüfungsablauf (Workflow)

1. **Lehrer erstellt Prüfung:**
   - Aufgaben auswählen oder neu erstellen
   - Zeitlimit festlegen (z.B. 45 Minuten)
   - Startzeit (sofort / geplant) definieren
   - Erlaubte Hilfsmittel konfigurieren (z.B. nur bestimmte Gatter)
   - Prüfungs-PIN/Code generieren

2. **Schüler tritt der Prüfung bei:**
   - Prüfungs-Code eingeben
   - Identität bestätigen (Name, Klasse)
   - Browser wechselt in Prüfungsmodus (Vollbild-Modus wird empfohlen)

3. **Während der Prüfung:**
   - Schüler arbeitet in gesicherter Umgebung
   - Lehrer sieht Live-Status (online, aktiv, abgegeben)
   - Automatisches Speichern alle X Sekunden
   - Timer sichtbar (Countdownanzeige)

4. **Prüfungsende:**
   - Automatische Abgabe bei Zeitablauf
   - Schüler kann vorzeitig einreichen
   - Lehrer beendet Prüfung manuell (Notfallabbruch)
   - Abgaben werden versioniert gespeichert

### 6.3 Soft-Security (Browser-seitig, ohne Zusatzsoftware)

- **Vollbild-Erzwingung** (Fullscreen API): Beim Verlassen des Vollbilds erscheint Warnung
- **Tab-Wechsel-Erkennung** (Page Visibility API): Protokollierung wenn Tab gewechselt wird
- **Rechtsklick deaktivieren** auf Prüfungsinhalten
- **Kopieren/Einfügen deaktivieren** (nur innerhalb der App erlaubt)
- **Entwicklerkonsole-Erkennung** (eingeschränkt möglich)
- **Sitzungstoken** (jede Prüfungssitzung einmalig, nicht übertragbar)
- **IP-Protokollierung** (Anomalien erkennbar)
- **Timestamped Activity Log:** Alle Aktionen des Schülers werden mit Timestamp serverseitig gespeichert
- **Verdachts-Indikatoren** für Lehrer: Anzahl Tab-Wechsel, Fokus-Verluste, ungewöhnliche Pausen

### 6.4 Hard-Security (mit zusätzlicher Infrastruktur, optional)

- **Safe Exam Browser (SEB)-Integration:** Open-Source-Browser, der alle anderen Anwendungen sperrt — Kompatibilität als optionaler Modus
- **Schulnetz-Einschränkung:** App prüft ob Schüler im Schulnetzwerk (IP-Range) — nur dort verfügbar
- **Classroom-Management-Integration:** Kompatibilität zu Tools wie Apple Classroom, Relution, LanSchool
- **Kamera-Proctoring (optional, DSGVO-kritisch):** Webcam-Stream für manuelle Aufsicht (nur mit expliziter Einwilligung)

### 6.5 Aufgabentypen im Prüfungsmodus

- **Schaltkreis-Aufgabe:** Schüler baut Schaltkreis von Grund auf
- **Schaltkreis-Ergänzung:** Vorgegebener Teilschaltkreis, Lücken füllen
- **Wahrheitstabelle:** Schüler trägt Werte ein (Tabellen-Interface)
- **Multiple Choice / Single Choice:** Für Theoriefragen
- **Freitext-Antwort:** Kurze schriftliche Begründungen
- **Bewertungsoptionen für Lehrer:** Manuell, halbautomatisch (Sim-Test: Schaltkreis wird gegen Testfälle geprüft)

### 6.6 Automatische Bewertung (optional, fortgeschritten)

- Schaltkreis des Schülers gegen definierte Testfälle simulieren
- Erwartete Ausgaben bei gegebenen Eingaben vergleichen
- Bewertungsschema: Punkte pro bestandenem Testfall
- Lehrer definiert Testfälle + Musterlösung

---

## 7. Nicht-funktionale Anforderungen

### 7.1 Performance
- Flüssige Interaktion bei Schaltkreisen mit bis zu 500 Komponenten (60 fps)
- Simulationsloop muss in Web Worker ausgelagert werden (kein UI-Blocking)
- Ladezeit < 3 Sekunden auf Schulnetz-Hardware

### 7.2 Browser-Kompatibilität
- Chrome/Chromium (aktuell -1)
- Firefox (aktuell -1)
- Safari (aktuell -1)
- Edge (aktuell -1)
- Keine IE-Unterstützung erforderlich

### 7.3 Geräteklassen
- **Desktop** (primär): Vollständiger Funktionsumfang
- **Tablet** (sekundär): Touch-Interaktion für Basis-Funktionen, kein Texteingabe-Fokus
- **Smartphone** (tertiär): Nur Read-Only-Ansicht oder sehr eingeschränkte Bearbeitung

### 7.4 Datenschutz & Datensicherheit (DSGVO)
- Keine Weitergabe von Schülerdaten an Dritte
- Hosting auf europäischen Servern
- Pseudonymisierung möglich (Schüler ohne echten Namen)
- Passwörter: bcrypt/Argon2 gehasht
- Datenlöschung auf Anfrage (Right to be forgotten)
- Audit-Log für alle datenschutzrelevanten Aktionen
- Datenschutzerklärung & AV-Vertrag für Schulen

### 7.5 Barrierefreiheit
- WCAG 2.1 Level AA anstreben
- Tastaturnavigation im Editor vollständig möglich
- Screenreader-Kompatibilität für Nicht-Editor-Bereiche (Aufgaben, Dashboard)
- Ausreichende Farbkontraste

### 7.6 Internationalisierung
- Primär: Deutsch
- Sekundär: Englisch
- i18n-Bibliothek von Anfang an einplanen

---

## 8. Offene Fragen / Entscheidungspunkte für die Umsetzung

1. **Notation:** Nur IEC oder auch ANSI umschaltbar?
2. **Kollaboration:** Echtzeit-Zusammenarbeit (wie Google Docs) in der ersten Version oder als späteres Feature?
3. **Offline-Modus:** Wie weit soll die PWA-Offline-Fähigkeit gehen?
4. **SEB-Integration:** Verpflichtend oder optional?
5. **Schul-SSO:** Microsoft 365 / Google Workspace Login von Anfang an?
6. **Automatische Bewertung:** In Phase 1 oder Phase 2?
7. **Mobilgerät-Unterstützung:** Tablet-native Touch-UX oder erstmal weglassen?
8. **Bestehende Dateiformate:** Soll `.circ`-Import von Logisim unterstützt werden?
9. **Self-Hosting vs. SaaS:** Soll die Schule selbst hosten oder gibt es eine zentrale Instanz?
10. **Lizenz:** Wieder Open Source (GPL) oder proprietär für Nachhaltigkeitsfinanzierung?

---

## 9. Grafik-Assets / Komponenten-Icons

### Müssen selbst erstellt werden

Da LogikSim die **IEC 60617-Notation** (rechteckige Symbole mit Beschriftung) verwendet — nicht die amerikanischen ANSI-Kurvenformen — gibt es **keine gebrauchsfertigen Icon-Bibliotheken** dafür. Folgende Assets müssen manuell als **SVG** erstellt werden:

**Grundgatter (IEC-Stil):**
- `&` — AND-Gatter (Rechteck mit `&`)
- `≥1` — OR-Gatter (Rechteck mit `≥1`)
- `=1` — XOR-Gatter (Rechteck mit `=1`)
- `1` — Puffer (Dreieck oder Rechteck mit `1`)
- Invertierkreis (`°`) an Eingängen/Ausgängen

**Flip-Flops:**
- SR-Latch, D-FF, JK-FF, T-FF jeweils mit korrekt beschrifteten Pins (S, R, J, K, C, Q, Q̄)

**Komplexe Bausteine:**
- Volladdierer (VA), Halbaddierer (HA)
- Multiplexer, Decoder
- Register-Blöcke (Mehrbit)

**Ein-/Ausgabe:**
- LED (aus/an, verschiedene Farben)
- 7-Segment-Anzeige
- Schalter / Taster
- Taktgeber (TG)
- Konstante (0 / 1)

**Design-Vorgaben für die Icons:**
- Einheitliches Raster (z.B. 40×40px Basis-Zelle, skalierbar)
- Pins an definierten Gitterpositionen (damit Leitungen einrasten)
- Exportformat: SVG (inline im DOM für Interaktivität und Skalierung)
- Variantenset: normal, ausgewählt (highlighted), fehlerhaft (rot), deaktiviert (grau)
- Farbige Füllung der Komponente wählbar (gelb als Default, wie in LogikSim)

**Werkzeuge für die Icon-Erstellung:**
- Inkscape (kostenlos, SVG-nativ)
- Figma / Sketch (kollaborativ)
- Direkt als SVG-Code (für Entwickler, einfachere Symbole)

---

## 10. Technologie-Stack-Empfehlung (Zusammenfassung)

| Bereich | Empfehlung | Alternativen |
|---------|-----------|--------------|
| Frontend Framework | **Angular** + TypeScript | — (gesetzt) |
| UI-Bibliothek | Angular Material oder PrimeNG | — |
| Schaltungseditor | Fabric.js / Konva.js oder custom Canvas | SVG mit Angular directives |
| State/Undo | **NgRx** + Command-Pattern | NgXs |
| Backend | Node.js + Fastify + TypeScript | Python FastAPI, Go |
| Datenbank | PostgreSQL | MySQL |
| Cache/Sessions | Redis | Memcached |
| Echtzeit | Socket.io | native WebSocket |
| Auth | JWT + Passport.js | Auth0, Keycloak |
| Deployment | **Eigener Server** + Docker + nginx + Let's Encrypt | Cloud (Hetzner, AWS) |
| CI/CD | GitHub Actions | GitLab CI |
| Testing | Jest + Angular Testing Library + Playwright (E2E) | Cypress |

---

## 11. Quellen (Recherche-Basis)

- [logiksim.dbclan.de](https://logiksim.dbclan.de/) — Offizielle LogikSim-Seite
- [OER Informatik: Software für den Einstieg in die Digitaltechnik](https://oer-informatik.de/logik-simulation) — Vergleich von 11 Logiksimulatoren
- [inf-schule: LogicSim](https://inf-schule.de/rechner/digitaltechnik/Simulatoren/LogicSim) — Schulischer Einsatz
- [TU Dresden: Einfache Logiksimulatoren PDF](https://tu-dresden.de/ing/informatik/ti/vlsi/ressourcen/dateien/dateien_studium/dateien_lehstuhlseminar/vortraege_lehrstuhlseminar/folder-2010-04-30-7782863372/logiksim.pdf) — Akademische Analyse
- [e-teaching.org: E-Klausur](https://www.e-teaching.org/lehrszenarien/pruefung/pruefungsform/e-pruefung) — Anforderungen digitaler Prüfungen
- [Respondus LockDown Browser](https://web.respondus.com/k12/lockdownbrowser/) — Referenz für Browser-Lockdown-Technik
