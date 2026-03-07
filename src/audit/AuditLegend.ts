// Isometry v5 — Phase 37 AuditLegend (stub)
// Floating legend panel for audit overlay.
// Full implementation in Task 2 of Plan 03.
//
// Requirements: AUDIT-06, AUDIT-08

/**
 * AuditLegend displays a floating panel with change indicator and source
 * provenance color explanations.
 *
 * Stub: show/hide/destroy are no-ops until Task 2 fills in the DOM creation.
 */
export class AuditLegend {
  private _container: HTMLElement;
  private _panel: HTMLDivElement | null = null;

  constructor(container: HTMLElement) {
    this._container = container;
  }

  show(): void {
    // Task 2 will implement
  }

  hide(): void {
    // Task 2 will implement
  }

  destroy(): void {
    this.hide();
  }
}
