import { Component, HostListener, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

/**
 * Klassische Desktop-Menüleiste (wie LogikSim 0.6.4).
 *
 * Enthält die Menüs „Datei" und „Hilfe" mit Klick-Dropdowns sowie rechts
 * einen Umschalter für Light/Dark Mode.
 *
 * Verhalten:
 * - Klick auf einen Menütitel öffnet das zugehörige Dropdown.
 * - Erneuter Klick auf denselben Titel schließt es wieder.
 * - Es ist immer nur ein Dropdown gleichzeitig geöffnet.
 * - Ein Klick irgendwo außerhalb der Menüleiste schließt das offene Dropdown.
 *
 * Die Datei-Aktionen sind aktuell Platzhalter (console.log) und können später
 * mit echter Logik (Speichern/Laden usw.) gefüllt werden.
 */
@Component({
  selector: 'app-menu-bar',
  standalone: true,
  imports: [],
  templateUrl: './menu-bar.html',
  styleUrl: './menu-bar.scss',
})
export class MenuBar {
  private readonly themeService = inject(ThemeService);

  /**
   * Name des aktuell geöffneten Menüs ('datei' | 'hilfe') oder null,
   * wenn kein Dropdown offen ist.
   */
  openMenu: 'datei' | 'hilfe' | null = null;

  /** True, wenn gerade Dark Mode aktiv ist (für das Umschalt-Icon). */
  get isDark(): boolean {
    return this.themeService.isDark;
  }

  /**
   * Öffnet oder schließt ein Menü.
   * Klick auf den bereits offenen Titel schließt ihn (Toggle-Verhalten).
   */
  toggleMenu(menu: 'datei' | 'hilfe', event: MouseEvent): void {
    event.stopPropagation(); // verhindert sofortiges Schließen durch document-Listener
    this.openMenu = this.openMenu === menu ? null : menu;
  }

  /** Schließt jedes offene Dropdown. */
  closeMenu(): void {
    this.openMenu = null;
  }

  /**
   * Schließt das Menü bei einem Klick irgendwo im Dokument.
   * (Klicks auf Menütitel stoppen die Propagation und lösen dies nicht aus.)
   */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  /** Escape schließt ebenfalls das offene Menü. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }

  /** Wechselt zwischen Light und Dark Mode. */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  // ─── Datei-Aktionen (Platzhalter) ──────────────────────────────────────────
  // Werden nach Auswahl eines Menüeintrags aufgerufen. Noch ohne echte Logik.

  onNew():        void { console.log('[Menü] Neu');                this.closeMenu(); }
  onOpen():       void { console.log('[Menü] Öffnen');             this.closeMenu(); }
  onSave():       void { console.log('[Menü] Speichern');          this.closeMenu(); }
  onSaveAs():     void { console.log('[Menü] Speichern unter');    this.closeMenu(); }
  onImportLws():  void { console.log('[Menü] Importieren (LWS)');  this.closeMenu(); }
  onConvertLws(): void { console.log('[Menü] Konvertieren (LWS)'); this.closeMenu(); }
  onExit():       void { console.log('[Menü] Beenden');            this.closeMenu(); }

  // ─── Hilfe-Aktionen (Platzhalter) ──────────────────────────────────────────

  onAbout(): void { console.log('[Menü] About'); this.closeMenu(); }
}
