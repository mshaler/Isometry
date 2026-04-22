// @vitest-environment jsdom
// Isometry v13.3 — Phase 174 Plan 01 TabSlot type shape and helper tests

import { describe, expect, it } from 'vitest';
import { makeTabSlot, removeTab, reorderTabs } from '../../src/superwidget/TabSlot';
import type { TabSlot } from '../../src/superwidget/TabSlot';

// ---------------------------------------------------------------------------
// TABS-09: TabSlot type shape
// ---------------------------------------------------------------------------

describe('TabSlot: type shape', () => {
  it('TabSlot has required fields: tabId, label, projection', () => {
    const slot = makeTabSlot();
    expect(slot).toHaveProperty('tabId');
    expect(slot).toHaveProperty('label');
    expect(slot).toHaveProperty('projection');
  });

  it('TabSlot badge field is optional (undefined by default)', () => {
    const slot = makeTabSlot();
    expect(slot.badge).toBeUndefined();
  });

  it('TabSlot satisfies TypeScript interface structurally (runtime)', () => {
    const slot: TabSlot = makeTabSlot();
    expect(typeof slot.tabId).toBe('string');
    expect(typeof slot.label).toBe('string');
    expect(typeof slot.projection).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// TABS-09: makeTabSlot factory — View Bound defaults (D-01)
// ---------------------------------------------------------------------------

describe('makeTabSlot: default values (D-01)', () => {
  it('makeTabSlot with no args returns label "View"', () => {
    const slot = makeTabSlot();
    expect(slot.label).toBe('View');
  });

  it('makeTabSlot default projection has canvasType "View"', () => {
    const slot = makeTabSlot();
    expect(slot.projection.canvasType).toBe('View');
  });

  it('makeTabSlot default projection has canvasBinding "Bound"', () => {
    const slot = makeTabSlot();
    expect(slot.projection.canvasBinding).toBe('Bound');
  });

  it('makeTabSlot default projection has zoneRole "primary"', () => {
    const slot = makeTabSlot();
    expect(slot.projection.zoneRole).toBe('primary');
  });

  it('makeTabSlot default projection has canvasId "view-canvas"', () => {
    const slot = makeTabSlot();
    expect(slot.projection.canvasId).toBe('view-canvas');
  });

  it('makeTabSlot tabId and projection.activeTabId are the same value', () => {
    const slot = makeTabSlot();
    expect(slot.tabId).toBe(slot.projection.activeTabId);
  });

  it('makeTabSlot projection.enabledTabIds contains the tabId', () => {
    const slot = makeTabSlot();
    expect(slot.projection.enabledTabIds).toContain(slot.tabId);
  });

  it('makeTabSlot generates a non-empty tabId string', () => {
    const slot = makeTabSlot();
    expect(slot.tabId.length).toBeGreaterThan(0);
  });

  it('makeTabSlot generates unique tabIds on successive calls', () => {
    const s1 = makeTabSlot();
    const s2 = makeTabSlot();
    expect(s1.tabId).not.toBe(s2.tabId);
  });
});

// ---------------------------------------------------------------------------
// makeTabSlot with overrides
// ---------------------------------------------------------------------------

describe('makeTabSlot: overrides', () => {
  it('makeTabSlot({ label: "Editor" }) returns label "Editor"', () => {
    const slot = makeTabSlot({ label: 'Editor' });
    expect(slot.label).toBe('Editor');
  });

  it('makeTabSlot({ badge: "3" }) returns badge "3"', () => {
    const slot = makeTabSlot({ badge: '3' });
    expect(slot.badge).toBe('3');
  });

  it('makeTabSlot with explicit tabId uses it for both tabId and projection.activeTabId', () => {
    const slot = makeTabSlot({ tabId: 'my-tab' });
    expect(slot.tabId).toBe('my-tab');
    expect(slot.projection.activeTabId).toBe('my-tab');
  });

  it('makeTabSlot with explicit tabId includes it in enabledTabIds', () => {
    const slot = makeTabSlot({ tabId: 'my-tab' });
    expect(slot.projection.enabledTabIds).toContain('my-tab');
  });

  it('makeTabSlot with explicit projection uses it as-is', () => {
    const customProj = {
      canvasType: 'Explorer' as const,
      canvasBinding: 'Unbound' as const,
      zoneRole: 'secondary' as const,
      canvasId: 'explorer-canvas',
      activeTabId: 'exp-1',
      enabledTabIds: ['exp-1'],
    };
    const slot = makeTabSlot({ projection: customProj });
    expect(slot.projection).toBe(customProj);
  });
});

// ---------------------------------------------------------------------------
// removeTab helper
// ---------------------------------------------------------------------------

describe('removeTab: helper', () => {
  it('removeTab returns new array without the removed tab', () => {
    const s1 = makeTabSlot({ tabId: 'a' });
    const s2 = makeTabSlot({ tabId: 'b' });
    const tabs = [s1, s2] as const;
    const result = removeTab(tabs, 'a');
    expect(result).not.toContain(s1);
    expect(result).toContain(s2);
  });

  it('removeTab returns original array reference if tabId not found (D-06 guard)', () => {
    const s1 = makeTabSlot({ tabId: 'a' });
    const s2 = makeTabSlot({ tabId: 'b' });
    const tabs = [s1, s2] as const;
    const result = removeTab(tabs, 'z');
    expect(result).toBe(tabs);
  });

  it('removeTab returns original array reference if only one tab remains (D-06 guard)', () => {
    const s1 = makeTabSlot({ tabId: 'a' });
    const tabs = [s1] as const;
    const result = removeTab(tabs, 'a');
    expect(result).toBe(tabs);
  });

  it('removeTab with two tabs returns array of length 1', () => {
    const s1 = makeTabSlot({ tabId: 'a' });
    const s2 = makeTabSlot({ tabId: 'b' });
    const result = removeTab([s1, s2], 'a');
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// reorderTabs helper
// ---------------------------------------------------------------------------

describe('reorderTabs: helper', () => {
  it('reorderTabs returns original reference when fromIndex === toIndex', () => {
    const s1 = makeTabSlot({ tabId: 'a' });
    const s2 = makeTabSlot({ tabId: 'b' });
    const tabs = [s1, s2];
    const result = reorderTabs(tabs, 1, 1);
    expect(result).toBe(tabs);
  });

  it('reorderTabs with out-of-bounds fromIndex returns original reference', () => {
    const s1 = makeTabSlot({ tabId: 'a' });
    const s2 = makeTabSlot({ tabId: 'b' });
    const tabs = [s1, s2];
    const result = reorderTabs(tabs, 5, 0);
    expect(result).toBe(tabs);
  });

  it('reorderTabs with out-of-bounds toIndex returns original reference', () => {
    const s1 = makeTabSlot({ tabId: 'a' });
    const s2 = makeTabSlot({ tabId: 'b' });
    const tabs = [s1, s2];
    const result = reorderTabs(tabs, 0, 10);
    expect(result).toBe(tabs);
  });

  it('reorderTabs with negative fromIndex returns original reference', () => {
    const s1 = makeTabSlot({ tabId: 'a' });
    const s2 = makeTabSlot({ tabId: 'b' });
    const tabs = [s1, s2];
    const result = reorderTabs(tabs, -1, 0);
    expect(result).toBe(tabs);
  });

  it('reorderTabs moves tab from fromIndex to toIndex (forward)', () => {
    const s1 = makeTabSlot({ tabId: 'a' });
    const s2 = makeTabSlot({ tabId: 'b' });
    const s3 = makeTabSlot({ tabId: 'c' });
    const result = reorderTabs([s1, s2, s3], 0, 2);
    expect(result[0]).toBe(s2);
    expect(result[1]).toBe(s3);
    expect(result[2]).toBe(s1);
  });

  it('reorderTabs moves tab from fromIndex to toIndex (backward)', () => {
    const s1 = makeTabSlot({ tabId: 'a' });
    const s2 = makeTabSlot({ tabId: 'b' });
    const s3 = makeTabSlot({ tabId: 'c' });
    const result = reorderTabs([s1, s2, s3], 2, 0);
    expect(result[0]).toBe(s3);
    expect(result[1]).toBe(s1);
    expect(result[2]).toBe(s2);
  });

  it('reorderTabs returns a new array (not the original reference)', () => {
    const s1 = makeTabSlot({ tabId: 'a' });
    const s2 = makeTabSlot({ tabId: 'b' });
    const tabs = [s1, s2];
    const result = reorderTabs(tabs, 0, 1);
    expect(result).not.toBe(tabs);
  });

  it('reorderTabs preserves all elements (no duplicates, no drops)', () => {
    const s1 = makeTabSlot({ tabId: 'a' });
    const s2 = makeTabSlot({ tabId: 'b' });
    const s3 = makeTabSlot({ tabId: 'c' });
    const result = reorderTabs([s1, s2, s3], 1, 0);
    expect(result).toHaveLength(3);
    expect(result).toContain(s1);
    expect(result).toContain(s2);
    expect(result).toContain(s3);
  });
});
