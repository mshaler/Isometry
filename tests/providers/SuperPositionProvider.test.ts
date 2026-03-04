// Isometry v5 — SuperPositionProvider Tests
// Unit tests for Tier 3 ephemeral scroll/zoom position cache.
//
// Design:
//   - SuperPositionProvider holds scrollTop, scrollLeft, zoomLevel as ephemeral state
//   - NOT a StateProvider — no subscribe/notify, NOT registered with StateCoordinator
//   - savePosition / restorePosition bridge HTMLElement scroll state
//   - zoomLevel clamped to [ZOOM_MIN=0.5, ZOOM_MAX=3.0]
//   - reset() clears scroll/axis state but PRESERVES zoomLevel (zoom is a preference)
//
// Requirements: POSN-01, POSN-02

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SuperPositionProvider,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
} from '../../src/providers/SuperPositionProvider';

// ---------------------------------------------------------------------------
// Mock HTMLElement for scroll tests (node environment — no DOM available)
// ---------------------------------------------------------------------------

function makeMockElement(overrides: { scrollTop?: number; scrollLeft?: number } = {}): HTMLElement {
  const el = {
    scrollTop: overrides.scrollTop ?? 0,
    scrollLeft: overrides.scrollLeft ?? 0,
  } as HTMLElement;
  return el;
}

// ---------------------------------------------------------------------------
// Tests: Constants
// ---------------------------------------------------------------------------

describe('SuperPositionProvider — constants', () => {
  it('ZOOM_MIN is 0.5', () => {
    expect(ZOOM_MIN).toBe(0.5);
  });

  it('ZOOM_MAX is 3.0', () => {
    expect(ZOOM_MAX).toBe(3.0);
  });

  it('ZOOM_DEFAULT is 1.0', () => {
    expect(ZOOM_DEFAULT).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Constructor defaults
// ---------------------------------------------------------------------------

describe('SuperPositionProvider — constructor defaults', () => {
  let provider: SuperPositionProvider;

  beforeEach(() => {
    provider = new SuperPositionProvider();
  });

  it('initializes with scrollTop = 0', () => {
    const coords = provider.getCoordinates();
    expect(coords.scrollTop).toBe(0);
  });

  it('initializes with scrollLeft = 0', () => {
    const coords = provider.getCoordinates();
    expect(coords.scrollLeft).toBe(0);
  });

  it('initializes with zoomLevel = 1.0', () => {
    expect(provider.zoomLevel).toBe(1.0);
  });

  it('initializes with empty rowValues', () => {
    const coords = provider.getCoordinates();
    expect(coords.rowValues).toEqual([]);
  });

  it('initializes with empty colValues', () => {
    const coords = provider.getCoordinates();
    expect(coords.colValues).toEqual([]);
  });

  it('initializes with scrollAnchorCard = null', () => {
    const coords = provider.getCoordinates();
    expect(coords.scrollAnchorCard).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: savePosition / restorePosition
// ---------------------------------------------------------------------------

describe('SuperPositionProvider — savePosition / restorePosition', () => {
  let provider: SuperPositionProvider;

  beforeEach(() => {
    provider = new SuperPositionProvider();
  });

  it('savePosition reads scrollTop from element', () => {
    const el = makeMockElement({ scrollTop: 200, scrollLeft: 0 });
    provider.savePosition(el);
    expect(provider.getCoordinates().scrollTop).toBe(200);
  });

  it('savePosition reads scrollLeft from element', () => {
    const el = makeMockElement({ scrollTop: 0, scrollLeft: 350 });
    provider.savePosition(el);
    expect(provider.getCoordinates().scrollLeft).toBe(350);
  });

  it('restorePosition writes saved scrollTop to element', () => {
    const saveEl = makeMockElement({ scrollTop: 400, scrollLeft: 0 });
    provider.savePosition(saveEl);

    const restoreEl = makeMockElement({ scrollTop: 0, scrollLeft: 0 });
    provider.restorePosition(restoreEl);
    expect(restoreEl.scrollTop).toBe(400);
  });

  it('restorePosition writes saved scrollLeft to element', () => {
    const saveEl = makeMockElement({ scrollTop: 0, scrollLeft: 150 });
    provider.savePosition(saveEl);

    const restoreEl = makeMockElement({ scrollTop: 0, scrollLeft: 0 });
    provider.restorePosition(restoreEl);
    expect(restoreEl.scrollLeft).toBe(150);
  });

  it('round-trip: savePosition then restorePosition restores exact values', () => {
    const original = makeMockElement({ scrollTop: 750, scrollLeft: 300 });
    provider.savePosition(original);

    const target = makeMockElement({ scrollTop: 0, scrollLeft: 0 });
    provider.restorePosition(target);

    expect(target.scrollTop).toBe(750);
    expect(target.scrollLeft).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Tests: zoomLevel getter/setter
// ---------------------------------------------------------------------------

describe('SuperPositionProvider — zoomLevel', () => {
  let provider: SuperPositionProvider;

  beforeEach(() => {
    provider = new SuperPositionProvider();
  });

  it('zoomLevel getter/setter works (set 1.5, get returns 1.5)', () => {
    provider.zoomLevel = 1.5;
    expect(provider.zoomLevel).toBe(1.5);
  });

  it('zoomLevel is clamped to ZOOM_MIN=0.5 when set below minimum', () => {
    provider.zoomLevel = 0.1;
    expect(provider.zoomLevel).toBe(ZOOM_MIN);
  });

  it('zoomLevel is clamped to ZOOM_MAX=3.0 when set above maximum', () => {
    provider.zoomLevel = 5.0;
    expect(provider.zoomLevel).toBe(ZOOM_MAX);
  });

  it('zoomLevel accepts exact minimum boundary (0.5)', () => {
    provider.zoomLevel = 0.5;
    expect(provider.zoomLevel).toBe(0.5);
  });

  it('zoomLevel accepts exact maximum boundary (3.0)', () => {
    provider.zoomLevel = 3.0;
    expect(provider.zoomLevel).toBe(3.0);
  });

  it('zoomLevel accepts midrange values (2.0)', () => {
    provider.zoomLevel = 2.0;
    expect(provider.zoomLevel).toBe(2.0);
  });
});

// ---------------------------------------------------------------------------
// Tests: setAxisCoordinates / getCoordinates
// ---------------------------------------------------------------------------

describe('SuperPositionProvider — setAxisCoordinates / getCoordinates', () => {
  let provider: SuperPositionProvider;

  beforeEach(() => {
    provider = new SuperPositionProvider();
  });

  it('setAxisCoordinates stores rowValues and colValues', () => {
    provider.setAxisCoordinates(['a', 'b', 'c'], ['x', 'y']);
    const coords = provider.getCoordinates();
    expect(coords.rowValues).toEqual(['a', 'b', 'c']);
    expect(coords.colValues).toEqual(['x', 'y']);
  });

  it('getCoordinates returns defensive copies of rowValues', () => {
    provider.setAxisCoordinates(['a', 'b'], ['x']);
    const coords1 = provider.getCoordinates();
    coords1.rowValues.push('INJECTED');
    const coords2 = provider.getCoordinates();
    expect(coords2.rowValues).toEqual(['a', 'b']); // not mutated
  });

  it('getCoordinates returns defensive copies of colValues', () => {
    provider.setAxisCoordinates(['a'], ['x', 'y']);
    const coords1 = provider.getCoordinates();
    coords1.colValues.push('INJECTED');
    const coords2 = provider.getCoordinates();
    expect(coords2.colValues).toEqual(['x', 'y']); // not mutated
  });

  it('setAxisCoordinates with anchorCard stores scrollAnchorCard', () => {
    provider.setAxisCoordinates(['a'], ['x'], 'card-42');
    const coords = provider.getCoordinates();
    expect(coords.scrollAnchorCard).toBe('card-42');
  });

  it('setAxisCoordinates without anchorCard defaults to null', () => {
    provider.setAxisCoordinates(['a'], ['x']);
    const coords = provider.getCoordinates();
    expect(coords.scrollAnchorCard).toBeNull();
  });

  it('setAxisCoordinates with explicit null anchorCard stores null', () => {
    provider.setAxisCoordinates(['a'], ['x'], null);
    const coords = provider.getCoordinates();
    expect(coords.scrollAnchorCard).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: scrollAnchorCard
// ---------------------------------------------------------------------------

describe('SuperPositionProvider — scrollAnchorCard', () => {
  let provider: SuperPositionProvider;

  beforeEach(() => {
    provider = new SuperPositionProvider();
  });

  it('scrollAnchorCard can be set via setAxisCoordinates and read back', () => {
    provider.setAxisCoordinates([], [], 'card-99');
    expect(provider.getCoordinates().scrollAnchorCard).toBe('card-99');
  });

  it('scrollAnchorCard starts as null', () => {
    expect(provider.getCoordinates().scrollAnchorCard).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: reset()
// ---------------------------------------------------------------------------

describe('SuperPositionProvider — reset()', () => {
  let provider: SuperPositionProvider;

  beforeEach(() => {
    provider = new SuperPositionProvider();
  });

  it('reset() clears scrollTop to 0', () => {
    const el = makeMockElement({ scrollTop: 500, scrollLeft: 0 });
    provider.savePosition(el);
    provider.reset();
    expect(provider.getCoordinates().scrollTop).toBe(0);
  });

  it('reset() clears scrollLeft to 0', () => {
    const el = makeMockElement({ scrollTop: 0, scrollLeft: 400 });
    provider.savePosition(el);
    provider.reset();
    expect(provider.getCoordinates().scrollLeft).toBe(0);
  });

  it('reset() clears rowValues to empty array', () => {
    provider.setAxisCoordinates(['a', 'b'], ['x']);
    provider.reset();
    expect(provider.getCoordinates().rowValues).toEqual([]);
  });

  it('reset() clears colValues to empty array', () => {
    provider.setAxisCoordinates(['a'], ['x', 'y']);
    provider.reset();
    expect(provider.getCoordinates().colValues).toEqual([]);
  });

  it('reset() clears scrollAnchorCard to null', () => {
    provider.setAxisCoordinates(['a'], ['x'], 'card-1');
    provider.reset();
    expect(provider.getCoordinates().scrollAnchorCard).toBeNull();
  });

  it('reset() PRESERVES zoomLevel (zoom is a preference, not a session state)', () => {
    provider.zoomLevel = 2.5;
    provider.reset();
    expect(provider.zoomLevel).toBe(2.5);
  });

  it('reset() does not affect zoomLevel at its default', () => {
    provider.reset(); // reset from initial state
    expect(provider.zoomLevel).toBe(ZOOM_DEFAULT);
  });
});

// ---------------------------------------------------------------------------
// Tests: No StateCoordinator integration
// ---------------------------------------------------------------------------

describe('SuperPositionProvider — no StateCoordinator integration', () => {
  it('SuperPositionProvider has no subscribe method', () => {
    const provider = new SuperPositionProvider();
    expect(typeof (provider as unknown as Record<string, unknown>)['subscribe']).not.toBe('function');
  });

  it('SuperPositionProvider has no notify method', () => {
    const provider = new SuperPositionProvider();
    expect(typeof (provider as unknown as Record<string, unknown>)['notify']).not.toBe('function');
  });

  it('SuperPositionProvider has no registerProvider method', () => {
    const provider = new SuperPositionProvider();
    expect(typeof (provider as unknown as Record<string, unknown>)['registerProvider']).not.toBe('function');
  });
});
