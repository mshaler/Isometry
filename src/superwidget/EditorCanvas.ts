// Isometry v13.2 — Phase 172 EditorCanvas
// Production CanvasComponent wrapping NotebookExplorer with SelectionProvider-driven status slot.
// Requirements: ECNV-01, ECNV-02, ECNV-03, ECNV-04
//
// Per CANV-06: This file must NOT be imported by SuperWidget.ts.
// Wired via registry.ts and main.ts only.

import type { AliasProvider } from '../providers/AliasProvider';
import type { FilterProvider } from '../providers/FilterProvider';
import type { SelectionProvider } from '../providers/SelectionProvider';
import type { SchemaProvider } from '../providers/SchemaProvider';
import type { MutationManager } from '../mutations/MutationManager';
import type { WorkerBridge } from '../worker/WorkerBridge';
import { NotebookExplorer } from '../ui/NotebookExplorer';
import type { CanvasComponent } from './projection';

// ---------------------------------------------------------------------------
// EditorCanvasConfig
// ---------------------------------------------------------------------------

export interface EditorCanvasConfig {
  canvasId: string;
  bridge: WorkerBridge;
  selection: SelectionProvider;
  filter: FilterProvider;
  alias: AliasProvider;
  schema?: SchemaProvider;
  mutations: MutationManager;
}

// ---------------------------------------------------------------------------
// EditorCanvas
// ---------------------------------------------------------------------------

/**
 * Production CanvasComponent that wraps NotebookExplorer.
 *
 * Isolation: NotebookExplorer receives a wrapper div, never the raw canvas slot element
 * directly (wrapper-div isolation per D-13).
 *
 * Status slot: reactively shows selected card title via SelectionProvider subscription (D-05, D-06).
 *
 * Destroy ordering: selectionUnsub -> NE.destroy() -> wrapper.remove() -> statusEl null (D-14).
 *
 * Per CANV-06: This file must NOT be imported by SuperWidget.ts.
 */
export class EditorCanvas implements CanvasComponent {
  private _config: EditorCanvasConfig;
  private _notebookExplorer: NotebookExplorer | null = null;
  private _wrapperEl: HTMLElement | null = null;
  private _statusEl: HTMLElement | null = null;
  private _selectionUnsub: (() => void) | null = null;

  constructor(config: EditorCanvasConfig) {
    this._config = config;
  }

  mount(container: HTMLElement): void {
    // Create wrapper div for NE isolation (D-13)
    const wrapper = document.createElement('div');
    wrapper.className = 'editor-canvas';
    this._wrapperEl = wrapper;

    // Instantiate and mount NotebookExplorer (D-11)
    this._notebookExplorer = new NotebookExplorer({
      bridge: this._config.bridge,
      selection: this._config.selection,
      filter: this._config.filter,
      alias: this._config.alias,
      ...(this._config.schema !== undefined && { schema: this._config.schema }),
      mutations: this._config.mutations,
    });
    this._notebookExplorer.mount(wrapper);

    container.appendChild(wrapper);

    // DOM traversal: status slot is sibling of canvas slot inside SuperWidget root (D-07)
    const statusEl = container.parentElement?.querySelector<HTMLElement>('[data-slot="status"]');
    if (statusEl) this._setupStatus(statusEl);

    // Subscribe to selection changes for reactive status updates (D-07)
    this._selectionUnsub = this._config.selection.subscribe(() => this._updateStatus());

    // Set initial status immediately
    this._updateStatus();
  }

  destroy(): void {
    // Ordering per D-14: selectionUnsub -> NE.destroy() -> wrapper.remove() -> statusEl null
    if (this._selectionUnsub) {
      this._selectionUnsub();
      this._selectionUnsub = null;
    }
    if (this._notebookExplorer) {
      this._notebookExplorer.destroy();
      this._notebookExplorer = null;
    }
    if (this._wrapperEl) {
      this._wrapperEl.remove();
      this._wrapperEl = null;
    }
    this._statusEl = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _setupStatus(el: HTMLElement): void {
    this._statusEl = el;
  }

  private _updateStatus(): void {
    if (!this._statusEl) return;

    // Idempotent DOM setup: only create bar once (per ViewCanvas pattern)
    if (!this._statusEl.querySelector('.sw-editor-status-bar')) {
      const bar = document.createElement('div');
      bar.className = 'sw-editor-status-bar';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'sw-status-bar__item';
      titleSpan.dataset['stat'] = 'card-title';

      bar.appendChild(titleSpan);
      this._statusEl.appendChild(bar);
    }

    const titleSpan = this._statusEl.querySelector<HTMLElement>('[data-stat="card-title"]');
    if (!titleSpan) return;

    const ids = this._config.selection.getSelectedIds();

    if (ids.length === 0) {
      // D-06: no card selected
      titleSpan.textContent = 'No card selected';
      return;
    }

    // D-05: show selected card title (async bridge query)
    const cardId = ids[0]!;
    void this._config.bridge.send('card:get', { id: cardId }).then((card) => {
      // Guard: do not write to DOM after destroy
      if (!this._statusEl) return;
      const span = this._statusEl.querySelector<HTMLElement>('[data-stat="card-title"]');
      if (span) {
        span.textContent = (card as { name: string }).name;
      }
    });
  }
}
