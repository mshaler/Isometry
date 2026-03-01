// @vitest-environment jsdom
// Isometry v5 — SuperGrid Benchmark
// Performance benchmark verifying <16ms render for 100 cards at p95.
//
// Run with: npx vitest bench tests/views/SuperGrid.bench.ts
//
// Requirements: REND-06

import { describe, bench, beforeEach, afterEach } from 'vitest';
import { SuperGrid } from '../../src/views/SuperGrid';
import type { CardDatum } from '../../src/views/types';
import type { CardType } from '../../src/database/queries/types';

function makeCardDatum(overrides: Partial<CardDatum> = {}): CardDatum {
  return {
    id: 'bench-card',
    name: 'Bench Card',
    folder: null,
    status: null,
    card_type: 'note' as CardType,
    created_at: '2026-01-01T00:00:00Z',
    modified_at: '2026-01-01T00:00:00Z',
    priority: 0,
    sort_order: 0,
    due_at: null,
    body_text: null,
    ...overrides,
  };
}

describe('SuperGrid performance', () => {
  let container: HTMLElement;
  let superGrid: SuperGrid;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    superGrid = new SuperGrid();
    superGrid.mount(container);
  });

  afterEach(() => {
    superGrid.destroy();
    document.body.removeChild(container);
  });

  bench(
    'render 100 cards <16ms',
    () => {
      const cards = Array.from({ length: 100 }, (_, i) =>
        makeCardDatum({
          id: `bench-card-${i}`,
          card_type: (['note', 'task', 'event'] as CardType[])[i % 3]!,
          folder: ['A', 'B', 'C', 'D'][i % 4] ?? null,
          status: ['active', 'done'][i % 2] ?? null,
        })
      );
      superGrid.render(cards);
    },
    {
      time: 2000,
      iterations: 50,
    }
  );
});
