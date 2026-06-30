import { Component, ViewChild } from '@angular/core';
import { ToolbarTop }    from './components/toolbar-top/toolbar-top';
import { ToolbarLeft }   from './components/toolbar-left/toolbar-left';
import { Whiteboard }    from './components/whiteboard/whiteboard';
import { PropertiesPanel, GatePropertyChange } from './components/properties-panel/properties-panel';
import { ToolMode }      from './components/toolbar-left/toolbar-left';
import { GateInstance }  from './models/gate.model';

/**
 * Root-Komponente von GatterPLUS.
 *
 * Layout (links → rechts):
 *   Toolbar-Left | Whiteboard | Properties-Panel (wenn Bauteil ausgewählt)
 */
@Component({
  selector: 'app-root',
  imports: [ToolbarTop, ToolbarLeft, Whiteboard, PropertiesPanel],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  @ViewChild(Whiteboard) whiteboardRef!: Whiteboard;

  activeTool:    ToolMode = 'pan';
  simulationMode = false;

  onToolSelected(tool: ToolMode): void {
    this.activeTool = tool;
    this.whiteboardRef.setToolMode(tool);
  }

  onSimulationToggle(): void {
    this.whiteboardRef.toggleSimulation();
    this.simulationMode = this.whiteboardRef.simulationMode;
    // Toolbar-Anzeige mit dem Modus des Whiteboards synchronisieren:
    // toggleSimulation() schaltet intern auf Pan um, daher muss activeTool
    // hier nachgezogen werden, damit der Toolbar-Button korrekt hervorgehoben ist.
    this.activeTool = this.whiteboardRef.toolMode;
  }

  /** Ausgewähltes Bauteil (für Properties Panel) */
  get selectedGate(): GateInstance | null {
    return this.whiteboardRef?.selectedGate ?? null;
  }

  /** Eigenschafts-Änderungen vom Properties Panel ans Whiteboard weiterleiten */
  onGateChange(changes: GatePropertyChange): void {
    // color kommt als string aus dem Panel, cast zum engeren Typ ist hier sicher
    this.whiteboardRef.updateGate(changes as any);
  }

  /** Lösch-Anfragen vom Properties Panel ans Whiteboard weiterleiten */
  onGateDelete(gateId: string): void {
    this.whiteboardRef.deleteGate(gateId);
  }

  onUndo():  void { this.whiteboardRef.undo(); }
  onRedo():  void { this.whiteboardRef.redo(); }
  onCopy():  void { this.whiteboardRef.copySelected(); }
  onPaste(): void { this.whiteboardRef.pasteClipboard(); }

  get canUndo():  boolean { return this.whiteboardRef?.canUndo  ?? false; }
  get canRedo():  boolean { return this.whiteboardRef?.canRedo  ?? false; }
  get canPaste(): boolean { return this.whiteboardRef?.canPaste ?? false; }
}
