// Isometry v13.3 — Phase 177 Plan 01 SuperWidgetStateProvider
// PersistableProvider for tab state serialization and restoration.
//
// Implements PersistableProvider (toJSON/setState/resetToDefaults) and
// SubscribableProvider (subscribe) for integration with StateManager.
//
// Requirements: PRST-01, PRST-02, PRST-04

import type { PersistableProvider } from '../providers/types';
import { makeTabSlot } from './TabSlot';
import type { TabSlot } from './TabSlot';

// ---------------------------------------------------------------------------
// Type guard for serialized tab state shape
// ---------------------------------------------------------------------------

function isTabEntry(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry['tabId'] === 'string' &&
    typeof entry['label'] === 'string' &&
    typeof entry['projection'] === 'object' &&
    entry['projection'] !== null
  );
}

function isTabStateShape(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj['tabs'])) return false;
  if ((obj['tabs'] as unknown[]).length === 0) return false;
  if (!(obj['tabs'] as unknown[]).every(isTabEntry)) return false;
  if (typeof obj['activeTabSlotId'] !== 'string') return false;
  return true;
}

// ---------------------------------------------------------------------------
// SuperWidgetStateProvider
// ---------------------------------------------------------------------------

/**
 * PersistableProvider for SuperWidget tab state.
 *
 * Serializes TabSlot[] + activeTabSlotId to the ui_state table via StateManager.
 * Follows the PAFVProvider pattern: setState/resetToDefaults do NOT notify
 * (snap-to-state on restore), while setTabs() notifies via queueMicrotask.
 */
export class SuperWidgetStateProvider implements PersistableProvider {
  private _tabs: TabSlot[];
  private _activeTabSlotId: string;
  private readonly _subscribers = new Set<() => void>();
  private _pendingNotify = false;

  constructor() {
    const defaultTab = makeTabSlot();
    this._tabs = [defaultTab];
    this._activeTabSlotId = defaultTab.tabId;
  }

  // ---------------------------------------------------------------------------
  // PersistableProvider
  // ---------------------------------------------------------------------------

  /**
   * Serialize current tab state to a JSON string for the ui_state table.
   */
  toJSON(): string {
    return JSON.stringify({ tabs: this._tabs, activeTabSlotId: this._activeTabSlotId });
  }

  /**
   * Restore state from a parsed plain object (from ui_state JSON).
   * Does NOT notify subscribers (snap-to-state pattern per PAFVProvider).
   *
   * @throws {Error} if the state shape is invalid
   */
  setState(state: unknown): void {
    if (!isTabStateShape(state)) {
      throw new Error('[SuperWidgetStateProvider] setState: invalid state shape');
    }
    const obj = state as { tabs: TabSlot[]; activeTabSlotId: string };
    this._tabs = [...obj.tabs];
    this._activeTabSlotId = obj.activeTabSlotId;
    // Do NOT notify — snap-to-state on restore
  }

  /**
   * Reset to default state: one default tab via makeTabSlot().
   * Does NOT notify subscribers.
   */
  resetToDefaults(): void {
    const defaultTab = makeTabSlot();
    this._tabs = [defaultTab];
    this._activeTabSlotId = defaultTab.tabId;
    // Do NOT notify — consistent with setState
  }

  // ---------------------------------------------------------------------------
  // SubscribableProvider
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to tab state changes.
   * Notifications are batched via queueMicrotask — multiple synchronous
   * setTabs() calls produce one callback per tick.
   *
   * @returns Unsubscribe function
   */
  subscribe(callback: () => void): () => void {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  // ---------------------------------------------------------------------------
  // Mutation API
  // ---------------------------------------------------------------------------

  /**
   * Update tabs and active ID, then notify subscribers.
   * SuperWidget calls this on every tab create, close, switch, and reorder.
   */
  setTabs(tabs: TabSlot[], activeTabSlotId: string): void {
    this._tabs = [...tabs];
    this._activeTabSlotId = activeTabSlotId;
    this._scheduleNotify();
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  getTabs(): readonly TabSlot[] {
    return this._tabs;
  }

  getActiveTabSlotId(): string {
    return this._activeTabSlotId;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Batch subscriber notifications via queueMicrotask.
   * Multiple synchronous mutations produce exactly one notification per tick.
   */
  private _scheduleNotify(): void {
    if (this._pendingNotify) return;
    this._pendingNotify = true;
    queueMicrotask(() => {
      this._pendingNotify = false;
      this._subscribers.forEach((cb) => cb());
    });
  }
}
