// @vitest-environment jsdom
// Isometry v5 — TimelineView Tests
// Tests for SVG timeline view with d3.scaleUtc() time axis and swimlane grouping.
//
// Design:
//   - TimelineView renders SVG with g.card elements keyed by d => d.id (VIEW-09)
//   - Cards positioned along x-axis by due_at date via d3.scaleUtc()
//   - Cards grouped into swimlane rows by groupByField (default: 'status')
//   - Overlapping cards within same swimlane stack vertically (sub-rows)
//   - Cards with null due_at are excluded from timeline display
//   - g.card class matches ListView/GridView for morphTransition compatibility
//
// Requirements: VIEW-05

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { TimelineView } from '../../src/views/TimelineView';
import type { CardDatum } from '../../src/views/types';

// ---------------------------------------------------------------------------
// jsdom getBBox mock — jsdom does not implement getBBox; d3.axisBottom calls it
// ---------------------------------------------------------------------------

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (SVGElement.prototype as any).getBBox = () => ({ x: 0, y: 0, width: 80, height: 16 });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function makeCard(overrides: Partial<CardDatum> = {}): CardDatum {
  idCounter++;
  return {
    id: `card-${idCounter}`,
    name: `Card ${idCounter}`,
    folder: null,
    status: 'active',
    card_type: 'note',
    created_at: '2026-01-01T00:00:00Z',
    modified_at: '2026-01-01T00:00:00Z',
    priority: 0,
    sort_order: 0,
    due_at: '2026-03-15T10:00:00Z',
    body_text: null,
    ...overrides,
  };
}

function makeContainer(width = 800): HTMLElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { configurable: true, value: width });
  document.body.appendChild(container);
  return container;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimelineView', () => {
  let container: HTMLElement;
  let view: TimelineView;

  beforeEach(() => {
    idCounter = 0;
    container = makeContainer();
    view = new TimelineView();
  });

  afterEach(() => {
    try { view.destroy(); } catch { /* ignore */ }
    if (container.parentNode) container.parentNode.removeChild(container);
  });

  // -------------------------------------------------------------------------
  // mount
  // -------------------------------------------------------------------------

  it('mounts SVG with axis group and swimlane group', () => {
    view.mount(container);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    const axisGroup = svg!.querySelector('g.timeline-axis');
    expect(axisGroup).not.toBeNull();

    const swimlanesGroup = svg!.querySelector('g.swimlanes');
    expect(swimlanesGroup).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // render: basic card output
  // -------------------------------------------------------------------------

  it('renders g.card elements keyed by d.id', () => {
    view.mount(container);

    const cards = [
      makeCard({ id: 'a', due_at: '2026-03-10T10:00:00Z' }),
      makeCard({ id: 'b', due_at: '2026-03-15T10:00:00Z' }),
      makeCard({ id: 'c', due_at: '2026-03-20T10:00:00Z' }),
    ];
    view.render(cards);

    const cardEls = container.querySelectorAll('g.card');
    expect(cardEls.length).toBe(3);
  });

  // -------------------------------------------------------------------------
  // render: x-axis positioning
  // -------------------------------------------------------------------------

  it('positions cards along x-axis by due_at date', () => {
    view.mount(container);

    const cards = [
      makeCard({ id: 'early', due_at: '2026-03-01T10:00:00Z', status: 'todo' }),
      makeCard({ id: 'late',  due_at: '2026-03-30T10:00:00Z', status: 'todo' }),
    ];
    view.render(cards);

    const cardEls = container.querySelectorAll<SVGGElement>('g.card');
    expect(cardEls.length).toBe(2);

    // Extract x-positions from transform attribute
    const transforms = Array.from(cardEls).map(el => el.getAttribute('transform') ?? '');
    const xValues = transforms.map(t => {
      const m = /translate\(([^,)]+)/.exec(t);
      return m?.[1] != null ? parseFloat(m[1]) : NaN;
    });

    // Both should be valid numbers
    expect(xValues.every(x => !isNaN(x))).toBe(true);
    // Earlier date should have smaller x (left side)
    // Cards could be in either order in the DOM; find min/max
    expect(Math.min(...xValues)).toBeLessThan(Math.max(...xValues));
  });

  // -------------------------------------------------------------------------
  // render: swimlane grouping
  // -------------------------------------------------------------------------

  it('groups cards into swimlane rows', () => {
    view.mount(container);
    const timeline = new TimelineView({ groupByField: 'status' });
    timeline.mount(makeContainer());

    const cards = [
      makeCard({ id: 'a', due_at: '2026-03-10T10:00:00Z', status: 'todo' }),
      makeCard({ id: 'b', due_at: '2026-03-15T10:00:00Z', status: 'done' }),
      makeCard({ id: 'c', due_at: '2026-03-20T10:00:00Z', status: 'todo' }),
    ];
    timeline.render(cards);

    const swimlaneGroups = timeline['container']!.querySelectorAll('g.swimlane');
    expect(swimlaneGroups.length).toBe(2); // todo and done

    timeline.destroy();
  });

  // -------------------------------------------------------------------------
  // render: swimlane labels
  // -------------------------------------------------------------------------

  it('swimlane labels show groupBy field values', () => {
    const timeline = new TimelineView({ groupByField: 'status' });
    const cont = makeContainer();
    timeline.mount(cont);

    const cards = [
      makeCard({ id: 'a', due_at: '2026-03-10T10:00:00Z', status: 'todo' }),
      makeCard({ id: 'b', due_at: '2026-03-15T10:00:00Z', status: 'done' }),
    ];
    timeline.render(cards);

    const labels = Array.from(cont.querySelectorAll('text.swimlane-label')).map(
      el => el.textContent ?? ''
    );
    expect(labels).toContain('todo');
    expect(labels).toContain('done');

    timeline.destroy();
    if (cont.parentNode) cont.parentNode.removeChild(cont);
  });

  // -------------------------------------------------------------------------
  // render: null due_at filtering
  // -------------------------------------------------------------------------

  it('excludes cards with null due_at', () => {
    view.mount(container);

    const cards = [
      makeCard({ id: 'a', due_at: '2026-03-15T10:00:00Z' }),
      makeCard({ id: 'b', due_at: null }),
      makeCard({ id: 'c', due_at: '2026-03-20T10:00:00Z' }),
      makeCard({ id: 'd', due_at: null }),
    ];
    view.render(cards);

    const cardEls = container.querySelectorAll('g.card');
    expect(cardEls.length).toBe(2); // only a and c have due_at
  });

  // -------------------------------------------------------------------------
  // render: overlap stacking
  // -------------------------------------------------------------------------

  it('stacks overlapping cards vertically in same swimlane', () => {
    const timeline = new TimelineView({ groupByField: 'status' });
    const cont = makeContainer();
    timeline.mount(cont);

    // 3 cards with identical due_at and same status — all will overlap
    const sameDate = '2026-03-15T10:00:00Z';
    const cards = [
      makeCard({ id: 'a', due_at: sameDate, status: 'active' }),
      makeCard({ id: 'b', due_at: sameDate, status: 'active' }),
      makeCard({ id: 'c', due_at: sameDate, status: 'active' }),
    ];
    timeline.render(cards);

    const cardEls = cont.querySelectorAll<SVGGElement>('g.card');
    expect(cardEls.length).toBe(3);

    // Extract y-positions from transforms
    const transforms = Array.from(cardEls).map(el => el.getAttribute('transform') ?? '');
    const yValues = transforms.map(t => {
      const m = /translate\([^,]+,\s*([^)]+)\)/.exec(t);
      return m?.[1] != null ? parseFloat(m[1]) : NaN;
    });

    // y-values should not all be the same (cards are in different sub-rows)
    const uniqueY = new Set(yValues);
    expect(uniqueY.size).toBeGreaterThan(1);

    timeline.destroy();
    if (cont.parentNode) cont.parentNode.removeChild(cont);
  });

  // -------------------------------------------------------------------------
  // render: time axis tick marks
  // -------------------------------------------------------------------------

  it('renders d3 time axis with tick marks', () => {
    view.mount(container);

    const cards = [
      makeCard({ id: 'a', due_at: '2026-03-01T10:00:00Z' }),
      makeCard({ id: 'b', due_at: '2026-03-31T10:00:00Z' }),
    ];
    view.render(cards);

    const axisGroup = container.querySelector('g.timeline-axis');
    expect(axisGroup).not.toBeNull();
    // Axis should have child elements (ticks/text rendered by d3.axisBottom)
    expect(axisGroup!.children.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // render: SVG height adjusts to swimlane count
  // -------------------------------------------------------------------------

  it('adjusts SVG height to fit all swimlanes', () => {
    const timeline = new TimelineView({ groupByField: 'status' });
    const cont = makeContainer();
    timeline.mount(cont);

    // 3 different swimlanes
    const cards = [
      makeCard({ id: 'a', due_at: '2026-03-01T10:00:00Z', status: 'todo' }),
      makeCard({ id: 'b', due_at: '2026-03-10T10:00:00Z', status: 'inprogress' }),
      makeCard({ id: 'c', due_at: '2026-03-20T10:00:00Z', status: 'done' }),
    ];
    timeline.render(cards);

    const svg = cont.querySelector('svg');
    expect(svg).not.toBeNull();
    const height = parseFloat(svg!.getAttribute('height') ?? '0');
    // With 3 swimlanes, total height must be larger than a single swimlane
    expect(height).toBeGreaterThan(60); // SWIMLANE_HEIGHT = 60

    // Now render with just 1 swimlane
    const singleLaneCards = [
      makeCard({ id: 'x', due_at: '2026-03-01T10:00:00Z', status: 'todo' }),
    ];
    timeline.render(singleLaneCards);
    const height1 = parseFloat(svg!.getAttribute('height') ?? '0');

    expect(height).toBeGreaterThan(height1);

    timeline.destroy();
    if (cont.parentNode) cont.parentNode.removeChild(cont);
  });

  // -------------------------------------------------------------------------
  // render: g.card CSS class for morph compatibility
  // -------------------------------------------------------------------------

  it('uses g.card CSS class for morph transition compatibility', () => {
    view.mount(container);

    const cards = [
      makeCard({ id: 'a', due_at: '2026-03-15T10:00:00Z' }),
      makeCard({ id: 'b', due_at: '2026-03-20T10:00:00Z' }),
    ];
    view.render(cards);

    const cardEls = container.querySelectorAll('g.card');
    expect(cardEls.length).toBe(2);

    // Verify each has class 'card' (not 'timeline-card' or similar)
    for (const el of cardEls) {
      expect(el.getAttribute('class')).toBe('card');
    }
  });

  // -------------------------------------------------------------------------
  // destroy
  // -------------------------------------------------------------------------

  it('destroy removes SVG and clears references', () => {
    view.mount(container);

    const cards = [makeCard({ id: 'a', due_at: '2026-03-15T10:00:00Z' })];
    view.render(cards);

    expect(container.querySelector('svg')).not.toBeNull();

    view.destroy();

    // Container should be empty after destroy
    expect(container.querySelector('svg')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // density provider integration
  // -------------------------------------------------------------------------

  it('subscribes to densityProvider if provided and unsubscribes on destroy', () => {
    const unsubFn = vi.fn();
    const mockDensityProvider = {
      getState: vi.fn(() => ({ timeField: 'due_at', granularity: 'month' as const })),
      subscribe: vi.fn().mockReturnValue(unsubFn),
    };

    const timeline = new TimelineView({ densityProvider: mockDensityProvider as never });
    const cont = makeContainer();
    timeline.mount(cont);

    expect(mockDensityProvider.subscribe).toHaveBeenCalledOnce();

    timeline.destroy();
    expect(unsubFn).toHaveBeenCalledOnce();

    if (cont.parentNode) cont.parentNode.removeChild(cont);
  });
});
