// @vitest-environment jsdom
// Isometry v5 — Phase 10 ImportToast Unit Tests
// Tests DOM manipulation, class toggles, and timer management.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImportToast } from '../../src/ui/ImportToast';
import type { ImportResult } from '../../src/etl/types';

describe('ImportToast', () => {
  let container: HTMLDivElement;
  let toast: ImportToast;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    toast = new ImportToast(container);
  });

  afterEach(() => {
    toast.destroy();
    container.remove();
    vi.restoreAllMocks();
  });

  it('creates a DOM element with class import-toast and aria-live polite', () => {
    const el = container.querySelector('.import-toast');
    expect(el).not.toBeNull();
    expect(el!.getAttribute('aria-live')).toBe('polite');
  });

  it('showProgress makes toast visible with correct format', () => {
    toast.showProgress(200, 500, 48);

    const el = container.querySelector('.import-toast')!;
    expect(el.classList.contains('is-visible')).toBe(true);
    expect(el.textContent).toContain('200/500');
    expect(el.textContent).toContain('48 cards/sec');
  });

  it('showProgress includes filename when provided', () => {
    toast.showProgress(100, 300, 25, 'notes.md');

    const el = container.querySelector('.import-toast')!;
    expect(el.textContent).toContain('notes.md');
    expect(el.textContent).toContain('100/300');
  });

  it('showFinalizing shows 100% finalizing text', () => {
    toast.showFinalizing();

    const el = container.querySelector('.import-toast')!;
    expect(el.classList.contains('is-visible')).toBe(true);
    expect(el.textContent).toContain('100%');
    expect(el.textContent).toContain('finalizing');
  });

  it('showSuccess shows imported card count', () => {
    vi.useFakeTimers();

    const result: ImportResult = {
      inserted: 500,
      updated: 23,
      unchanged: 0,
      skipped: 0,
      errors: 0,
      connections_created: 10,
      insertedIds: [],
      errors_detail: [],
    };

    toast.showSuccess(result);

    const el = container.querySelector('.import-toast')!;
    expect(el.classList.contains('is-visible')).toBe(true);
    expect(el.textContent).toContain('523 cards');

    vi.useRealTimers();
  });

  it('showSuccess with errors shows error count', () => {
    vi.useFakeTimers();

    const result: ImportResult = {
      inserted: 500,
      updated: 23,
      unchanged: 0,
      skipped: 3,
      errors: 3,
      connections_created: 10,
      insertedIds: [],
      errors_detail: [
        { index: 0, source_id: 'note-1', message: 'Invalid format' },
        { index: 1, source_id: 'note-2', message: 'Missing title' },
        { index: 2, source_id: null, message: 'Parse error' },
      ],
    };

    toast.showSuccess(result);

    const el = container.querySelector('.import-toast')!;
    expect(el.textContent).toContain('523 cards');
    expect(el.textContent).toContain('3 errors');

    vi.useRealTimers();
  });

  it('showSuccess auto-dismisses after 5 seconds', () => {
    vi.useFakeTimers();

    const result: ImportResult = {
      inserted: 10,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      errors: 0,
      connections_created: 0,
      insertedIds: [],
      errors_detail: [],
    };

    toast.showSuccess(result);

    const el = container.querySelector('.import-toast')!;
    expect(el.classList.contains('is-visible')).toBe(true);

    vi.advanceTimersByTime(5000);
    expect(el.classList.contains('is-visible')).toBe(false);

    vi.useRealTimers();
  });

  it('showError shows error message', () => {
    toast.showError('Import failed: network timeout');

    const el = container.querySelector('.import-toast')!;
    expect(el.classList.contains('is-visible')).toBe(true);
    expect(el.textContent).toContain('Import failed: network timeout');
  });

  it('dismiss removes is-visible class', () => {
    toast.showProgress(100, 200, 50);

    const el = container.querySelector('.import-toast')!;
    expect(el.classList.contains('is-visible')).toBe(true);

    toast.dismiss();
    expect(el.classList.contains('is-visible')).toBe(false);
  });

  it('destroy removes the element from DOM', () => {
    expect(container.querySelector('.import-toast')).not.toBeNull();

    toast.destroy();
    expect(container.querySelector('.import-toast')).toBeNull();
  });

  it('showSuccess clears previous dismiss timer before setting new one (Pitfall 5)', () => {
    vi.useFakeTimers();

    const result: ImportResult = {
      inserted: 10,
      updated: 0,
      unchanged: 0,
      skipped: 0,
      errors: 0,
      connections_created: 0,
      insertedIds: [],
      errors_detail: [],
    };

    // First showSuccess — starts 5s timer
    toast.showSuccess(result);

    // Advance 3 seconds
    vi.advanceTimersByTime(3000);

    // Second showSuccess — should clear old timer and start new one
    toast.showSuccess(result);

    // Advance 3 more seconds (6s since first, 3s since second)
    vi.advanceTimersByTime(3000);

    // Should still be visible (second timer hasn't expired yet)
    const el = container.querySelector('.import-toast')!;
    expect(el.classList.contains('is-visible')).toBe(true);

    // Advance past second timer
    vi.advanceTimersByTime(2001);
    expect(el.classList.contains('is-visible')).toBe(false);

    vi.useRealTimers();
  });

  it('error detail section is expandable via click when errors exist', () => {
    vi.useFakeTimers();

    const result: ImportResult = {
      inserted: 10,
      updated: 0,
      unchanged: 0,
      skipped: 2,
      errors: 2,
      connections_created: 0,
      insertedIds: [],
      errors_detail: [
        { index: 0, source_id: 'note-1', message: 'Invalid format' },
        { index: 1, source_id: null, message: 'Parse error' },
      ],
    };

    toast.showSuccess(result);

    // Error section should exist
    const errorsEl = container.querySelector('.import-toast-errors');
    expect(errorsEl).not.toBeNull();

    // Detail should be collapsed by default
    const detailEl = container.querySelector('.import-toast-errors-detail');
    expect(detailEl).not.toBeNull();
    expect(detailEl!.classList.contains('is-expanded')).toBe(false);

    // Click to expand
    errorsEl!.dispatchEvent(new Event('click'));
    expect(detailEl!.classList.contains('is-expanded')).toBe(true);

    // Click to collapse
    errorsEl!.dispatchEvent(new Event('click'));
    expect(detailEl!.classList.contains('is-expanded')).toBe(false);

    vi.useRealTimers();
  });
});
