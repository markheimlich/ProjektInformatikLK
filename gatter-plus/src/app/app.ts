import { Component, ViewChild } from '@angular/core';
import { ToolbarTop } from './components/toolbar-top/toolbar-top';
import { ToolbarLeft } from './components/toolbar-left/toolbar-left';
import { Whiteboard } from './components/whiteboard/whiteboard';
import { ToolMode } from './components/toolbar-left/toolbar-left';

/**
 * Root-Komponente der GatterPLUS Anwendung.
 *
 * Verbindet die drei Haupt-Bereiche:
 * - Toolbar-Top: Gatter-Palette + Simulations-Toggle
 * - Toolbar-Left: Werkzeug-Wahl (Pan / Leitung)
 * - Whiteboard: der eigentliche Schaltkreis-Editor
 *
 * Events zwischen den Komponenten werden hier weitergeleitet.
 */
@Component({
  selector: 'app-root',
  imports: [ToolbarTop, ToolbarLeft, Whiteboard],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  /** Direkter Zugriff auf das Whiteboard für Event-Weiterleitung */
  @ViewChild(Whiteboard) whiteboardRef!: Whiteboard;

  /** Aktuelles Werkzeug (wird zwischen Toolbar-Left und Whiteboard geteilt) */
  activeTool: ToolMode = 'pan';

  /** Ob Simulations-Modus aktiv ist (für Toolbar-Top-Anzeige) */
  simulationMode = false;

  /** Wird aufgerufen wenn Toolbar-Left ein Werkzeug auswählt */
  onToolSelected(tool: ToolMode): void {
    this.activeTool = tool;
    this.whiteboardRef.setToolMode(tool);
  }

  /** Wird aufgerufen wenn Toolbar-Top den Simulations-Toggle klickt */
  onSimulationToggle(): void {
    this.whiteboardRef.toggleSimulation();
    this.simulationMode = this.whiteboardRef.simulationMode;
  }
}
