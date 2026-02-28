// @vitest-environment jsdom
// Isometry v5 — GalleryView Tests
// Tests for GalleryView: tile rendering, responsive columns, image fallback, icon display, lifecycle.
//
// Requirements: VIEW-06

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GalleryView } from '../../src/views/GalleryView';
import type { CardDatum } from '../../src/views/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<CardDatum> = {}): CardDatum {
  return {
    id: 'c1',
    name: 'Test Card',
    folder: null,
    status: null,
    card_type: 'note',
    created_at: '2026-01-01T00:00:00Z',
    modified_at: '2026-01-01T00:00:00Z',
    priority: 0,
    sort_order: 0,
    due_at: null,
    body_text: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GalleryView tests
// ---------------------------------------------------------------------------

describe('GalleryView', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('mounts gallery grid into container', () => {
    const view = new GalleryView();
    view.mount(container);

    const grid = container.querySelector('.gallery-grid');
    expect(grid).not.toBeNull();
    expect(grid?.tagName).toBe('DIV');
  });

  it('renders resource card with img tag', () => {
    const view = new GalleryView();
    view.mount(container);

    const card = makeCard({
      id: 'res1',
      card_type: 'resource',
      body_text: 'https://example.com/img.png',
    });
    view.render([card]);

    const img = container.querySelector('img.tile-image') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.src).toBe('https://example.com/img.png');
  });

  it('renders non-resource card with icon fallback', () => {
    const view = new GalleryView();
    view.mount(container);

    const card = makeCard({ card_type: 'note' });
    view.render([card]);

    const icon = container.querySelector('.tile-icon');
    expect(icon).not.toBeNull();
    expect(icon?.textContent).toBe('N');
  });

  it('renders card name below tile content', () => {
    const view = new GalleryView();
    view.mount(container);

    const card = makeCard({ name: 'My Tile Card' });
    view.render([card]);

    const nameEl = container.querySelector('span.tile-name');
    expect(nameEl).not.toBeNull();
    expect(nameEl?.textContent).toBe('My Tile Card');
  });

  it('falls back to icon when image fails to load', () => {
    const view = new GalleryView();
    view.mount(container);

    const card = makeCard({
      id: 'res2',
      card_type: 'resource',
      body_text: 'https://example.com/broken.png',
    });
    view.render([card]);

    const img = container.querySelector('img.tile-image') as HTMLImageElement | null;
    expect(img).not.toBeNull();

    // Simulate image load error (jsdom does not fire error automatically)
    img!.dispatchEvent(new Event('error'));

    // img should be replaced by a div.tile-icon
    const icon = container.querySelector('.tile-icon');
    expect(icon).not.toBeNull();
    // The img should no longer be in the DOM
    expect(container.querySelector('img.tile-image')).toBeNull();
  });

  it('adapts column count to container width', () => {
    const view = new GalleryView();
    view.mount(container);

    // Set container width to 1200px → 1200/240 = 5 columns
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 1200 });

    view.render([makeCard()]);

    const grid = container.querySelector('.gallery-grid') as HTMLElement | null;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(5, 240px)');
  });

  it('uses minimum 1 column for narrow containers', () => {
    const view = new GalleryView();
    view.mount(container);

    // Set container width to 100px → 100/240 = 0 → clamp to 1
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 100 });

    view.render([makeCard()]);

    const grid = container.querySelector('.gallery-grid') as HTMLElement | null;
    expect(grid?.style.gridTemplateColumns).toBe('repeat(1, 240px)');
  });

  it('each tile has data-id attribute matching card id', () => {
    const view = new GalleryView();
    view.mount(container);

    const cards = [
      makeCard({ id: 'card-x', name: 'Card X' }),
      makeCard({ id: 'card-y', name: 'Card Y' }),
    ];
    view.render(cards);

    const tiles = container.querySelectorAll('.gallery-tile');
    expect(tiles.length).toBe(2);

    const ids = Array.from(tiles).map(t => (t as HTMLElement).dataset['id']);
    expect(ids).toContain('card-x');
    expect(ids).toContain('card-y');
  });

  it('renders empty state gracefully with no tiles', () => {
    const view = new GalleryView();
    view.mount(container);

    view.render([]);

    const tiles = container.querySelectorAll('.gallery-tile');
    expect(tiles.length).toBe(0);
  });

  it('destroy removes DOM and clears references', () => {
    const view = new GalleryView();
    view.mount(container);
    view.render([makeCard()]);

    expect(container.querySelector('.gallery-grid')).not.toBeNull();

    view.destroy();

    expect(container.querySelector('.gallery-grid')).toBeNull();
    expect(container.children.length).toBe(0);
  });
});
