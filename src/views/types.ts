// Isometry v5 — Phase 5 View Types
// IView interface contract, CardDatum type, ViewConfig, and helpers.
//
// Design:
//   - IView is the canonical contract all view implementations must satisfy
//   - CardDatum is the minimal projection of Card fields needed for rendering
//   - D3 key function `d => d.id` is MANDATORY on every .data() call (VIEW-09)
//   - ViewConfig carries all dependencies views need from their environment
//
// Requirements: VIEW-09, VIEW-10, VIEW-11, REND-07, REND-08

import type { ViewType } from '../providers/types';
import type { StateCoordinator } from '../providers/StateCoordinator';
import type { QueryBuilder } from '../providers/QueryBuilder';
import type { CardType } from '../database/queries/types';

// ---------------------------------------------------------------------------
// CardDatum — minimal projection of Card for view rendering
// ---------------------------------------------------------------------------

/**
 * The subset of Card fields needed by view renderers.
 * Projected from raw Worker response rows via toCardDatum().
 *
 * Only includes fields required for visual rendering and sorting.
 * Full Card schema has 26 fields — views only need these 9.
 */
export interface CardDatum {
  /** Primary key — MUST be used as D3 key function: `.data(cards, d => d.id)` */
  id: string;
  /** Display name — primary text in card */
  name: string;
  /** Folder path for grouping/subtitle */
  folder: string | null;
  /** Status string for Kanban columns and subtitles */
  status: string | null;
  /** Card type for icon badges */
  card_type: CardType;
  /** ISO timestamp for sorting and display */
  created_at: string;
  /** ISO timestamp for sorting and display */
  modified_at: string;
  /** Numeric priority (higher = more important) */
  priority: number;
  /** Explicit sort order within a group */
  sort_order: number;
  /** ISO timestamp for time-axis views (Calendar, Timeline); null if no due date */
  due_at: string | null;
  /** Raw body content; Gallery uses as img src for resource cards; other views ignore */
  body_text: string | null;
}

// ---------------------------------------------------------------------------
// IView — canonical view interface contract
// ---------------------------------------------------------------------------

/**
 * Every D3 view implementation MUST implement this interface.
 *
 * Lifecycle:
 *   1. mount(container) — called once, creates DOM structure
 *   2. render(cards) — called on every data update, performs D3 data join
 *   3. destroy() — called before view is replaced, MUST unsubscribe all listeners
 *
 * @see ViewManager which calls destroy() before mounting the next view (VIEW-10)
 */
export interface IView {
  /**
   * Mount the view into the given container element.
   * Called once by ViewManager before the first render.
   * Should create the root SVG or div structure inside container.
   */
  mount(container: HTMLElement): void;

  /**
   * Render cards using a D3 data join.
   *
   * MANDATORY: Every `.data()` call MUST use key function `d => d.id` (VIEW-09).
   * This ensures D3 correctly matches DOM nodes to data items during transitions,
   * preventing index-based position bugs when cards are sorted or filtered.
   *
   * @param cards - Array of CardDatum to render. Empty array = show empty state.
   */
  render(cards: CardDatum[]): void;

  /**
   * Tear down this view — remove event listeners, cancel animations, clear DOM.
   * Called by ViewManager before mounting the next view.
   * MUST unsubscribe from all subscriptions to prevent memory leaks.
   */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// WorkerBridgeLike — minimal interface for testable bridge injection
// ---------------------------------------------------------------------------

/**
 * Minimal interface for WorkerBridge, extracted for testability.
 * Concrete WorkerBridge satisfies this interface.
 * Test mocks can implement this without importing the full WorkerBridge.
 */
export interface WorkerBridgeLike {
  send(type: string, payload: unknown): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// PAFVProviderLike — minimal interface for testable PAFV injection
// ---------------------------------------------------------------------------

/**
 * Minimal interface for PAFVProvider, extracted for testability.
 */
export interface PAFVProviderLike {
  setViewType(viewType: ViewType): void;
}

// ---------------------------------------------------------------------------
// SuperGrid narrow interfaces — Phase 17 dependency injection
// ---------------------------------------------------------------------------

import type { CellDatum, SuperGridQueryConfig } from '../worker/protocol';
import type { AxisMapping } from '../providers/types';

/**
 * Minimal interface for WorkerBridge as seen by SuperGrid.
 * SuperGrid only needs superGridQuery — not the full WorkerBridge.
 * Concrete WorkerBridge satisfies this interface.
 */
export interface SuperGridBridgeLike {
  superGridQuery(config: SuperGridQueryConfig): Promise<CellDatum[]>;
}

/**
 * Minimal interface for PAFVProvider as seen by SuperGrid.
 * SuperGrid needs getStackedGroupBySQL to read axes, and setColAxes/setRowAxes
 * to commit axis changes from drag-drop transpose (Phase 18 DYNM-01/DYNM-02).
 * Concrete PAFVProvider satisfies this interface.
 */
export interface SuperGridProviderLike {
  getStackedGroupBySQL(): { colAxes: AxisMapping[]; rowAxes: AxisMapping[] };
  setColAxes(axes: AxisMapping[]): void;
  setRowAxes(axes: AxisMapping[]): void;
}

/**
 * Minimal interface for FilterProvider as seen by SuperGrid.
 * SuperGrid only needs compile() — not the full FilterProvider.
 * Concrete FilterProvider satisfies this interface.
 */
export interface SuperGridFilterLike {
  compile(): { where: string; params: unknown[] };
}

// ---------------------------------------------------------------------------
// ViewConfig — dependency bundle for view construction
// ---------------------------------------------------------------------------

/**
 * All dependencies injected into a view by ViewManager.
 * Views receive this config in their constructor.
 */
export interface ViewConfig {
  /** Root container element that the view should mount into */
  container: HTMLElement;
  /** StateCoordinator for subscribing to provider change notifications */
  coordinator: StateCoordinator;
  /** QueryBuilder for composing SQL queries from provider state */
  queryBuilder: QueryBuilder;
  /** WorkerBridge for executing queries against sql.js */
  bridge: WorkerBridgeLike;
}

// ---------------------------------------------------------------------------
// toCardDatum — row mapping helper
// ---------------------------------------------------------------------------

/**
 * Convert a raw Worker response row (Record<string, unknown>) to a typed CardDatum.
 * Worker rows come back as plain objects with string keys.
 *
 * Applies defaults for missing/null numeric fields to prevent NaN in renders.
 */
export function toCardDatum(row: Record<string, unknown>): CardDatum {
  return {
    id: String(row['id'] ?? ''),
    name: String(row['name'] ?? ''),
    folder: row['folder'] != null ? String(row['folder']) : null,
    status: row['status'] != null ? String(row['status']) : null,
    card_type: (row['card_type'] as CardType) ?? 'note',
    created_at: String(row['created_at'] ?? ''),
    modified_at: String(row['modified_at'] ?? ''),
    priority: typeof row['priority'] === 'number' ? row['priority'] : 0,
    sort_order: typeof row['sort_order'] === 'number' ? row['sort_order'] : 0,
    due_at: row['due_at'] != null ? String(row['due_at']) : null,
    body_text: row['body_text'] != null ? String(row['body_text']) : null,
  };
}
