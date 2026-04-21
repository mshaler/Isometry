// @vitest-environment jsdom
// Isometry v13.1 — Phase 169 Plan 02 Status Slot Tests
// Covers STAT-01, STAT-02, STAT-03, STAT-04

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime, renderStatusSlot, updateStatusSlot } from '../../src/superwidget/statusSlot';

// Fixed "now" for all relative-time tests: 2026-04-21T12:00:00Z
const NOW = new Date('2026-04-21T12:00:00Z').getTime();

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for timestamps < 60s ago', () => {
    expect(formatRelativeTime('2026-04-21T11:59:30Z')).toBe('just now');
  });

  it('returns "{N} min ago" for 1-59 minutes ago', () => {
    expect(formatRelativeTime('2026-04-21T11:55:00Z')).toBe('5 min ago');
  });

  it('returns "1 hour ago" for singular hour', () => {
    expect(formatRelativeTime('2026-04-21T11:00:00Z')).toBe('1 hour ago');
  });

  it('returns "{N} hours ago" for plural hours', () => {
    expect(formatRelativeTime('2026-04-21T09:00:00Z')).toBe('3 hours ago');
  });

  it('returns "yesterday" for 24-48 hours ago', () => {
    expect(formatRelativeTime('2026-04-20T06:00:00Z')).toBe('yesterday');
  });

  it('returns short date for older timestamps', () => {
    expect(formatRelativeTime('2026-04-16T12:00:00Z')).toMatch(/^Apr 16$/);
  });
});

describe('renderStatusSlot', () => {
  let statusEl: HTMLElement;

  beforeEach(() => {
    statusEl = document.createElement('div');
  });

  it('creates .sw-status-bar wrapper with 5 children', () => {
    renderStatusSlot(statusEl);
    const bar = statusEl.querySelector('.sw-status-bar');
    expect(bar).not.toBeNull();
    expect(bar!.children.length).toBe(5);
  });

  it('sets data-stat attributes on item spans', () => {
    renderStatusSlot(statusEl);
    const items = statusEl.querySelectorAll('[data-stat]');
    expect(items.length).toBe(3);
    const values = Array.from(items).map((el) => (el as HTMLElement).dataset['stat']);
    expect(values).toContain('cards');
    expect(values).toContain('connections');
    expect(values).toContain('last-import');
  });

  it('sets separator text to middle dot (U+00B7)', () => {
    renderStatusSlot(statusEl);
    const seps = statusEl.querySelectorAll('.sw-status-bar__sep');
    expect(seps.length).toBe(2);
    expect(seps[0]!.textContent).toBe('\u00B7');
    expect(seps[1]!.textContent).toBe('\u00B7');
  });

  it('sets initial zero-state text', () => {
    renderStatusSlot(statusEl);
    expect(statusEl.querySelector('[data-stat="cards"]')!.textContent).toBe('0 cards');
    expect(statusEl.querySelector('[data-stat="connections"]')!.textContent).toBe('0 connections');
    expect(statusEl.querySelector('[data-stat="last-import"]')!.textContent).toBe('No imports yet');
  });

  it('is idempotent — second call does not duplicate bar', () => {
    renderStatusSlot(statusEl);
    renderStatusSlot(statusEl);
    expect(statusEl.querySelectorAll('.sw-status-bar').length).toBe(1);
  });
});

describe('updateStatusSlot', () => {
  let statusEl: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    statusEl = document.createElement('div');
    renderStatusSlot(statusEl);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates card count text (STAT-01)', () => {
    updateStatusSlot(statusEl, { card_count: 42, connection_count: 0, last_import_at: null });
    expect(statusEl.querySelector('[data-stat="cards"]')!.textContent).toBe('42 cards');
  });

  it('uses singular "card" for count of 1', () => {
    updateStatusSlot(statusEl, { card_count: 1, connection_count: 0, last_import_at: null });
    expect(statusEl.querySelector('[data-stat="cards"]')!.textContent).toBe('1 card');
  });

  it('updates connection count text (STAT-02)', () => {
    updateStatusSlot(statusEl, { card_count: 0, connection_count: 18, last_import_at: null });
    expect(statusEl.querySelector('[data-stat="connections"]')!.textContent).toBe('18 connections');
  });

  it('uses singular "connection" for count of 1', () => {
    updateStatusSlot(statusEl, { card_count: 0, connection_count: 1, last_import_at: null });
    expect(statusEl.querySelector('[data-stat="connections"]')!.textContent).toBe('1 connection');
  });

  it('formats last import timestamp (STAT-03)', () => {
    updateStatusSlot(statusEl, {
      card_count: 0,
      connection_count: 0,
      last_import_at: '2026-04-21T11:55:00Z',
    });
    const text = statusEl.querySelector('[data-stat="last-import"]')!.textContent!;
    expect(text).toMatch(/^Imported /);
  });

  it('shows "No imports yet" when last_import_at is null', () => {
    updateStatusSlot(statusEl, { card_count: 0, connection_count: 0, last_import_at: null });
    expect(statusEl.querySelector('[data-stat="last-import"]')!.textContent).toBe('No imports yet');
  });

  it('does not modify data-render-count (STAT-04)', () => {
    statusEl.dataset['renderCount'] = '5';
    updateStatusSlot(statusEl, { card_count: 10, connection_count: 3, last_import_at: null });
    expect(statusEl.dataset['renderCount']).toBe('5');
  });

  it('does not throw on element without status bar (silent failure)', () => {
    const bare = document.createElement('div');
    expect(() =>
      updateStatusSlot(bare, { card_count: 0, connection_count: 0, last_import_at: null }),
    ).not.toThrow();
  });
});
