// Isometry v13.3 — Phase 174 Plan 01 TabSlot type and helpers
//
// TabSlot wraps a Projection with shell-level metadata (label, badge).
// Shell tab identity (tabId) matches projection.activeTabId — they are the same value.
//
// Requirements: TABS-09, TABS-10

import type { Projection } from './projection';

// ---------------------------------------------------------------------------
// TabSlot interface
// ---------------------------------------------------------------------------

export interface TabSlot {
  readonly tabId: string;
  readonly label: string;
  readonly badge?: string;
  readonly projection: Projection;
}

// ---------------------------------------------------------------------------
// makeTabSlot factory (D-01: View Bound defaults)
// ---------------------------------------------------------------------------

/**
 * Create a TabSlot with View Bound defaults.
 *
 * Default values per D-01:
 *   - label: 'View'
 *   - canvasType: 'View', canvasBinding: 'Bound', zoneRole: 'primary', canvasId: 'view-canvas'
 *   - tabId == projection.activeTabId (shell identity matches canvas active tab)
 *
 * Override rules:
 *   - If overrides.tabId is provided, it is used for both tabId AND projection.activeTabId/enabledTabIds
 *     (unless overrides.projection is also provided).
 *   - If overrides.projection is provided, it is used as-is without modification.
 */
export function makeTabSlot(overrides?: Partial<TabSlot>): TabSlot {
  const tabId = overrides?.tabId ?? `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const projection: Projection =
    overrides?.projection ??
    {
      canvasType: 'View',
      canvasBinding: 'Bound',
      zoneRole: 'primary',
      canvasId: 'view-canvas',
      activeTabId: tabId,
      enabledTabIds: [tabId],
    };

  return {
    tabId,
    label: overrides?.label ?? 'View',
    ...(overrides?.badge !== undefined ? { badge: overrides.badge } : {}),
    projection,
  };
}

// ---------------------------------------------------------------------------
// removeTab helper (D-06: never remove the last tab)
// ---------------------------------------------------------------------------

/**
 * Remove a tab by tabId from the tabs array.
 *
 * Guards (return original reference for reference-equality bail-out):
 *   - If tabs.length <= 1, return tabs (D-06: never remove last tab)
 *   - If tabId not found in tabs, return tabs
 */
export function removeTab(tabs: readonly TabSlot[], tabId: string): readonly TabSlot[] {
  if (tabs.length <= 1) return tabs;
  const idx = tabs.findIndex((t) => t.tabId === tabId);
  if (idx === -1) return tabs;
  return tabs.filter((t) => t.tabId !== tabId);
}

// ---------------------------------------------------------------------------
// reorderTabs helper
// ---------------------------------------------------------------------------

/**
 * Move a tab from fromIndex to toIndex.
 *
 * Guards (return original reference for reference-equality bail-out):
 *   - fromIndex === toIndex
 *   - Either index is out of bounds (< 0 or >= tabs.length)
 */
export function reorderTabs(tabs: readonly TabSlot[], fromIndex: number, toIndex: number): readonly TabSlot[] {
  if (fromIndex === toIndex) return tabs;
  if (fromIndex < 0 || fromIndex >= tabs.length) return tabs;
  if (toIndex < 0 || toIndex >= tabs.length) return tabs;

  const result = [...tabs];
  // splice returns an array; index already bounds-checked above so moved is always defined
  const moved = result.splice(fromIndex, 1)[0] as TabSlot;
  result.splice(toIndex, 0, moved);
  return result;
}
