/**
 * statusSlot.ts — Phase 169 (STAT-01, STAT-02, STAT-03, STAT-04)
 *
 * Standalone renderer for the SuperWidget status slot.
 * No coupling to SuperWidget.ts or ExplorerCanvas.ts.
 * Does NOT touch data-render-count (STAT-04 guarantee).
 */

/**
 * Format an ISO 8601 timestamp as a human-readable relative time string.
 *
 * Rules:
 *   < 1 min   → 'just now'
 *   1–59 min  → '{N} min ago'
 *   1–23 hr   → '1 hour ago' / '{N} hours ago'
 *   24–47 hr  → 'yesterday'
 *   48hr+     → short date e.g. 'Apr 19'
 */
export function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();

  if (diffMs < 60_000) {
    return 'just now';
  }
  if (diffMs < 3_600_000) {
    return `${Math.floor(diffMs / 60_000)} min ago`;
  }
  if (diffMs < 86_400_000) {
    const hours = Math.floor(diffMs / 3_600_000);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (diffMs < 172_800_000) {
    return 'yesterday';
  }
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * One-time DOM setup for the status slot.
 * Creates the .sw-status-bar wrapper with three data-stat spans and two separators.
 * Safe to call multiple times — idempotent guard via existing children check.
 *
 * Does NOT touch statusEl's data-render-count.
 */
export function renderStatusSlot(statusEl: HTMLElement): void {
  // Idempotent: skip if already rendered
  if (statusEl.querySelector('.sw-status-bar')) return;

  const bar = document.createElement('div');
  bar.className = 'sw-status-bar';

  const cardsSpan = document.createElement('span');
  cardsSpan.className = 'sw-status-bar__item';
  cardsSpan.dataset['stat'] = 'cards';
  cardsSpan.textContent = '0 cards';

  const sep1 = document.createElement('span');
  sep1.className = 'sw-status-bar__sep';
  sep1.textContent = '\u00B7';

  const connectionsSpan = document.createElement('span');
  connectionsSpan.className = 'sw-status-bar__item';
  connectionsSpan.dataset['stat'] = 'connections';
  connectionsSpan.textContent = '0 connections';

  const sep2 = document.createElement('span');
  sep2.className = 'sw-status-bar__sep';
  sep2.textContent = '\u00B7';

  const importSpan = document.createElement('span');
  importSpan.className = 'sw-status-bar__item';
  importSpan.dataset['stat'] = 'last-import';
  importSpan.textContent = 'No imports yet';

  bar.appendChild(cardsSpan);
  bar.appendChild(sep1);
  bar.appendChild(connectionsSpan);
  bar.appendChild(sep2);
  bar.appendChild(importSpan);

  statusEl.appendChild(bar);
}

/**
 * Update the status slot spans with live counts.
 * Silent failure if spans are not present (slot not yet rendered).
 *
 * Does NOT touch statusEl's data-render-count (STAT-04).
 */
export function updateStatusSlot(
  statusEl: HTMLElement,
  stats: { card_count: number; connection_count: number; last_import_at: string | null },
): void {
  const cardsSpan = statusEl.querySelector<HTMLElement>('[data-stat="cards"]');
  const connectionsSpan = statusEl.querySelector<HTMLElement>('[data-stat="connections"]');
  const importSpan = statusEl.querySelector<HTMLElement>('[data-stat="last-import"]');

  if (!cardsSpan || !connectionsSpan || !importSpan) return;

  cardsSpan.textContent = stats.card_count === 1 ? '1 card' : `${stats.card_count} cards`;
  connectionsSpan.textContent =
    stats.connection_count === 1 ? '1 connection' : `${stats.connection_count} connections`;
  importSpan.textContent = stats.last_import_at
    ? `Imported ${formatRelativeTime(stats.last_import_at)}`
    : 'No imports yet';
}
