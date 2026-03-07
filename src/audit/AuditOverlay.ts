// Isometry v5 — Phase 37 AuditOverlay
// Toggle button and keyboard shortcut for audit mode activation.
//
// Creates a fixed-position button in bottom-right corner.
// Click or Shift+A toggles .audit-mode class on the container (#app).
// Subscribes to AuditState for external state changes.
//
// Requirements: AUDIT-06, AUDIT-08

import type { AuditState } from './AuditState';

/**
 * AuditOverlay manages the audit toggle button and keyboard shortcut.
 *
 * mount(container) creates the button, registers keyboard handler,
 * and subscribes to AuditState for visual sync.
 *
 * destroy() cleans up all DOM and event listeners.
 */
export class AuditOverlay {
  private _auditState: AuditState;
  private _container: HTMLElement | null = null;
  private _button: HTMLButtonElement | null = null;
  private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private _unsubscribe: (() => void) | null = null;
  private _legend: import('./AuditLegend').AuditLegend | null = null;

  constructor(auditState: AuditState) {
    this._auditState = auditState;
  }

  /**
   * Create toggle button, register keyboard shortcut, subscribe to state.
   */
  mount(container: HTMLElement): void {
    this._container = container;

    // Create toggle button
    const btn = document.createElement('button');
    btn.className = 'audit-toggle-btn';
    btn.title = 'Toggle Audit Mode (Shift+A)';
    btn.type = 'button';
    // Use a simple SVG eye icon
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
      <circle cx="8" cy="8" r="2"/>
    </svg>`;
    btn.addEventListener('click', this._handleClick);
    container.appendChild(btn);
    this._button = btn;

    // Register keyboard shortcut
    this._keydownHandler = (e: KeyboardEvent) => {
      // Guard: don't fire in text input elements
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }
      if (e.shiftKey && e.key === 'A') {
        e.preventDefault();
        this._auditState.toggle();
      }
    };
    document.addEventListener('keydown', this._keydownHandler);

    // Subscribe to audit state changes
    this._unsubscribe = this._auditState.subscribe(() => {
      this._syncVisuals();
    });

    // Sync initial visual state
    this._syncVisuals();
  }

  /**
   * Remove button, keyboard handler, and unsubscribe from state.
   */
  destroy(): void {
    if (this._button) {
      this._button.removeEventListener('click', this._handleClick);
      this._button.remove();
      this._button = null;
    }
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this._legend) {
      this._legend.destroy();
      this._legend = null;
    }
    this._container = null;
  }

  // ---------------------------------------------------------------------------
  // Legend integration
  // ---------------------------------------------------------------------------

  /**
   * Set the legend instance for show/hide management.
   * Called after AuditLegend is created (Task 2).
   */
  setLegend(legend: import('./AuditLegend').AuditLegend): void {
    this._legend = legend;
    // Sync legend visibility with current state
    if (this._auditState.enabled) {
      this._legend.show();
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _handleClick = (): void => {
    this._auditState.toggle();
  };

  private _syncVisuals(): void {
    const enabled = this._auditState.enabled;

    // Toggle active class on button
    if (this._button) {
      this._button.classList.toggle('active', enabled);
    }

    // Toggle .audit-mode on container
    if (this._container) {
      this._container.classList.toggle('audit-mode', enabled);
    }

    // Toggle legend visibility
    if (this._legend) {
      if (enabled) {
        this._legend.show();
      } else {
        this._legend.hide();
      }
    }
  }
}
