/**
 * iso-card Component Tests
 *
 * TDD tests for Isometry card D3 component.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as d3 from 'd3';
import { cbCard } from './cb-card';
import type { NodeValue } from '@/types/lpg';

// Helper to create a test container
function createContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);
  return container;
}

// Helper to create mock NodeValue
function createMockNode(overrides: Partial<NodeValue> = {}): NodeValue {
  return {
    id: 'node-1',
    type: 'node',
    nodeType: 'Task',
    name: 'Test Task',
    content: 'Task description',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T12:00:00Z'),
    latch: {
      location: [37.7749, -122.4194],
      alphabet: 'Test Task',
      time: new Date('2024-01-20T17:00:00Z'),
      category: ['Work', 'urgent'],
      hierarchy: 1,
    },
    properties: {
      status: 'active',
    },
    ...overrides,
  };
}

describe('cbCard', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    container.remove();
  });

  describe('factory function', () => {
    it('returns a component function', () => {
      const card = cbCard();
      expect(typeof card).toBe('function');
    });

    it('has fluent API accessors', () => {
      const card = cbCard();

      expect(typeof card.variant).toBe('function');
      expect(typeof card.size).toBe('function');
      expect(typeof card.interactive).toBe('function');
      expect(typeof card.draggable).toBe('function');
      expect(typeof card.on).toBe('function');
    });
  });

  describe('fluent API', () => {
    it('variant getter returns default value', () => {
      const card = cbCard();
      expect(card.variant()).toBe('default');
    });

    it('variant setter returns component for chaining', () => {
      const card = cbCard();
      const result = card.variant('glass');

      expect(result).toBe(card);
      expect(card.variant()).toBe('glass');
    });

    it('supports method chaining', () => {
      const card = cbCard()
        .variant('elevated')
        .size('lg')
        .interactive(true)
        .draggable(true);

      expect(card.variant()).toBe('elevated');
      expect(card.size()).toBe('lg');
      expect(card.interactive()).toBe(true);
      expect(card.draggable()).toBe(true);
    });

    it('size defaults to md', () => {
      const card = cbCard();
      expect(card.size()).toBe('md');
    });

    it('interactive defaults to false', () => {
      const card = cbCard();
      expect(card.interactive()).toBe(false);
    });
  });

  describe('rendering', () => {
    it('renders card element for each data item', () => {
      const card = cbCard();
      const data = [createMockNode({ id: 'node-1' }), createMockNode({ id: 'node-2' })];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      const cards = container.querySelectorAll('.cb-card');
      expect(cards.length).toBe(2);
    });

    it('renders card with base class', () => {
      const card = cbCard();
      const data = [createMockNode()];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl).not.toBeNull();
    });

    it('applies variant modifier class', () => {
      const card = cbCard().variant('glass');
      const data = [createMockNode()];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      const cardEl = container.querySelector('.cb-card--glass');
      expect(cardEl).not.toBeNull();
    });

    it('applies size modifier class', () => {
      const card = cbCard().size('lg');
      const data = [createMockNode()];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      const cardEl = container.querySelector('.cb-card--lg');
      expect(cardEl).not.toBeNull();
    });

    it('applies interactive modifier class when interactive', () => {
      const card = cbCard().interactive(true);
      const data = [createMockNode()];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      const cardEl = container.querySelector('.cb-card--interactive');
      expect(cardEl).not.toBeNull();
    });

    it('renders card title with name', () => {
      const card = cbCard();
      const data = [createMockNode({ name: 'My Task Title' })];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      const title = container.querySelector('.cb-card__title');
      expect(title?.textContent).toBe('My Task Title');
    });

    it('renders card content when present', () => {
      const card = cbCard();
      const data = [createMockNode({ content: 'Some description' })];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      const content = container.querySelector('.cb-card__content');
      expect(content?.textContent).toBe('Some description');
    });

    it('renders node type badge', () => {
      const card = cbCard();
      const data = [createMockNode({ nodeType: 'Task' })];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      const badge = container.querySelector('.cb-card__badge');
      expect(badge?.textContent).toBe('Task');
    });
  });

  describe('data updates', () => {
    it('updates card on data change', () => {
      const card = cbCard();
      const initialData = [createMockNode({ id: 'node-1', name: 'Initial' })];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(initialData, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      // Verify initial render
      expect(container.querySelector('.cb-card__title')?.textContent).toBe('Initial');

      // Update data
      const updatedData = [createMockNode({ id: 'node-1', name: 'Updated' })];
      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(updatedData, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      // Verify update
      expect(container.querySelector('.cb-card__title')?.textContent).toBe('Updated');
    });

    it('removes cards when data is removed', () => {
      const card = cbCard();
      const initialData = [
        createMockNode({ id: 'node-1' }),
        createMockNode({ id: 'node-2' }),
      ];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(initialData, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      expect(container.querySelectorAll('.cb-card').length).toBe(2);

      // Remove one item
      const reducedData = [createMockNode({ id: 'node-1' })];
      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(reducedData, (d) => d.id)
        .join(
          (enter) => enter.append('div').attr('class', 'card-wrapper'),
          (update) => update,
          (exit) => exit.remove()
        )
        .call(card);

      expect(container.querySelectorAll('.cb-card').length).toBe(1);
    });
  });

  describe('events', () => {
    it('registers click handler via on()', () => {
      const handleClick = vi.fn();
      const card = cbCard().interactive(true).on('click', handleClick);
      const data = [createMockNode()];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      // Simulate click
      const cardEl = container.querySelector('.cb-card') as HTMLElement;
      cardEl?.click();

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'click',
          target: data[0],
        })
      );
    });

    it('registers select handler', () => {
      const handleSelect = vi.fn();
      const card = cbCard().interactive(true).on('select', handleSelect);
      const data = [createMockNode()];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      // Simulate click (triggers select)
      const cardEl = container.querySelector('.cb-card') as HTMLElement;
      cardEl?.click();

      expect(handleSelect).toHaveBeenCalledTimes(1);
    });

    it('supports on() method chaining', () => {
      const handleClick = vi.fn();
      const handleSelect = vi.fn();

      const card = cbCard()
        .interactive(true)
        .on('click', handleClick)
        .on('select', handleSelect);

      expect(typeof card.variant).toBe('function'); // Still chainable
    });
  });

  describe('selection state', () => {
    it('applies selected class when card is selected', () => {
      const card = cbCard().interactive(true);
      const data = [createMockNode({ id: 'node-1' })];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      // Simulate selection
      card.select('node-1');

      const cardEl = container.querySelector('.cb-card--selected');
      expect(cardEl).not.toBeNull();
    });

    it('removes selected class when card is deselected', () => {
      const card = cbCard().interactive(true);
      const data = [createMockNode({ id: 'node-1' })];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      card.select('node-1');
      expect(container.querySelector('.cb-card--selected')).not.toBeNull();

      card.deselect('node-1');
      expect(container.querySelector('.cb-card--selected')).toBeNull();
    });

    it('getSelected returns array of selected IDs', () => {
      const card = cbCard().interactive(true);
      const data = [
        createMockNode({ id: 'node-1' }),
        createMockNode({ id: 'node-2' }),
      ];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      card.select('node-1');
      card.select('node-2');

      expect(card.getSelected()).toEqual(['node-1', 'node-2']);
    });

    it('clearSelection removes all selections', () => {
      const card = cbCard().interactive(true);
      const data = [
        createMockNode({ id: 'node-1' }),
        createMockNode({ id: 'node-2' }),
      ];

      d3.select(container)
        .selectAll<HTMLDivElement, NodeValue>('.card-wrapper')
        .data(data, (d) => d.id)
        .join('div')
        .attr('class', 'card-wrapper')
        .call(card);

      card.select('node-1');
      card.select('node-2');
      card.clearSelection();

      expect(card.getSelected()).toEqual([]);
      expect(container.querySelectorAll('.cb-card--selected').length).toBe(0);
    });
  });
});
