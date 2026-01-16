/**
 * cb-card Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as d3 from 'd3';
import { cbCard } from './cb-card';
import type { NodeValue, EdgeValue } from '../types';

// Test utilities
function createContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);
  return container;
}

function cleanupContainer(): void {
  const container = document.getElementById('test-container');
  if (container) container.remove();
}

// Mock data
const mockNode: NodeValue = {
  id: 'node-1',
  type: 'node',
  nodeType: 'Task',
  name: 'Test Task',
  content: 'This is test content for the card',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  properties: {},
  latch: {
    category: 'Work',
    hierarchy: 1,
  },
};

const mockEdge: EdgeValue = {
  id: 'edge-1',
  type: 'edge',
  edgeType: 'LINK',
  sourceId: 'node-1',
  targetId: 'node-2',
  label: 'depends on',
  directed: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  properties: {},
  latch: {},
};

describe('cbCard', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    cleanupContainer();
  });

  describe('Rendering', () => {
    it('should create a card element', () => {
      const card = cbCard();

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl).not.toBeNull();
    });

    it('should render node title from name', () => {
      const card = cbCard();

      d3.select(container).datum(mockNode).call(card);

      const titleEl = container.querySelector('.cb-card__title');
      expect(titleEl?.textContent).toBe('Test Task');
    });

    it('should render edge title from label', () => {
      const card = cbCard();

      d3.select(container).datum(mockEdge).call(card);

      const titleEl = container.querySelector('.cb-card__title');
      expect(titleEl?.textContent).toBe('depends on');
    });

    it('should render edge title from edgeType when no label', () => {
      const card = cbCard();
      const edgeNoLabel = { ...mockEdge, label: undefined };

      d3.select(container).datum(edgeNoLabel).call(card);

      const titleEl = container.querySelector('.cb-card__title');
      expect(titleEl?.textContent).toBe('LINK');
    });

    it('should render content for nodes', () => {
      const card = cbCard();

      d3.select(container).datum(mockNode).call(card);

      const contentEl = container.querySelector('.cb-card__content');
      expect(contentEl?.textContent).toBe('This is test content for the card');
    });

    it('should hide content when node has no content', () => {
      const card = cbCard();
      const nodeNoContent = { ...mockNode, content: undefined };

      d3.select(container).datum(nodeNoContent).call(card);

      const contentEl = container.querySelector('.cb-card__content') as HTMLElement;
      expect(contentEl?.style.display).toBe('none');
    });

    it('should show badge when category is present', () => {
      const card = cbCard().showBadge(true);

      d3.select(container).datum(mockNode).call(card);

      const badgeEl = container.querySelector('.cb-card__badge');
      expect(badgeEl?.textContent).toBe('Work');
    });

    it('should hide badge when showBadge is false', () => {
      const card = cbCard().showBadge(false);

      d3.select(container).datum(mockNode).call(card);

      const badgeEl = container.querySelector('.cb-card__badge') as HTMLElement;
      expect(badgeEl?.style.display).toBe('none');
    });

    it('should show footer with nodeType', () => {
      const card = cbCard().showFooter(true);

      d3.select(container).datum(mockNode).call(card);

      const footerEl = container.querySelector('.cb-card__footer');
      expect(footerEl?.textContent).toBe('Task');
    });

    it('should set data-card-id attribute', () => {
      const card = cbCard();

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.getAttribute('data-card-id')).toBe('node-1');
    });
  });

  describe('Variants', () => {
    it('should apply default variant class', () => {
      const card = cbCard().variant('default');

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.classList.contains('cb-card--default')).toBe(true);
    });

    it('should apply glass variant class', () => {
      const card = cbCard().variant('glass');

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.classList.contains('cb-card--glass')).toBe(true);
    });

    it('should apply elevated variant class', () => {
      const card = cbCard().variant('elevated');

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.classList.contains('cb-card--elevated')).toBe(true);
    });

    it('should apply outline variant class', () => {
      const card = cbCard().variant('outline');

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.classList.contains('cb-card--outline')).toBe(true);
    });
  });

  describe('Sizes', () => {
    it('should apply sm size class', () => {
      const card = cbCard().size('sm');

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.classList.contains('cb-card--sm')).toBe(true);
    });

    it('should apply md size class', () => {
      const card = cbCard().size('md');

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.classList.contains('cb-card--md')).toBe(true);
    });

    it('should apply lg size class', () => {
      const card = cbCard().size('lg');

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.classList.contains('cb-card--lg')).toBe(true);
    });
  });

  describe('States', () => {
    it('should apply interactive class when interactive', () => {
      const card = cbCard().interactive(true);

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.classList.contains('cb-card--interactive')).toBe(true);
    });

    it('should set tabindex when interactive', () => {
      const card = cbCard().interactive(true);

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.getAttribute('tabindex')).toBe('0');
    });

    it('should set tabindex to -1 when not interactive', () => {
      const card = cbCard().interactive(false);

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.getAttribute('tabindex')).toBe('-1');
    });

    it('should apply selected class when selected', () => {
      const card = cbCard().selected(true);

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.classList.contains('cb-card--selected')).toBe(true);
    });

    it('should set aria-selected when selected', () => {
      const card = cbCard().selected(true);

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.getAttribute('aria-selected')).toBe('true');
    });

    it('should apply draggable class when draggable', () => {
      const card = cbCard().draggable(true);

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.classList.contains('cb-card--draggable')).toBe(true);
    });
  });

  describe('Events', () => {
    it('should fire click event when clicked', () => {
      const onClick = vi.fn();
      const card = cbCard().interactive(true).on('click', onClick);

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card') as HTMLElement;
      cardEl.click();

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'click',
          data: { id: 'node-1' },
        }),
      );
    });

    it('should fire select event on Enter key', () => {
      const onSelect = vi.fn();
      const card = cbCard().interactive(true).selected(false).on('select', onSelect);

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card') as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      cardEl.dispatchEvent(event);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'select',
          data: { id: 'node-1', selected: true },
        }),
      );
    });

    it('should fire select event on Space key', () => {
      const onSelect = vi.fn();
      const card = cbCard().interactive(true).selected(true).on('select', onSelect);

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card') as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: ' ' });
      cardEl.dispatchEvent(event);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'select',
          data: { id: 'node-1', selected: false },
        }),
      );
    });

    it('should not fire events when not interactive', () => {
      const onClick = vi.fn();
      const card = cbCard().interactive(false).on('click', onClick);

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card') as HTMLElement;
      cardEl.click();

      expect(onClick).not.toHaveBeenCalled();
    });

    it('should remove event handler when set to null', () => {
      const onClick = vi.fn();
      const card = cbCard().interactive(true).on('click', onClick).on('click', null);

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card') as HTMLElement;
      cardEl.click();

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('Fluent API', () => {
    it('should return component for chaining on setter', () => {
      const card = cbCard();
      const result = card.variant('glass');

      expect(result).toBe(card);
    });

    it('should return current value on getter', () => {
      const card = cbCard().variant('elevated');

      expect(card.variant()).toBe('elevated');
    });

    it('should support method chaining', () => {
      const card = cbCard()
        .variant('glass')
        .size('lg')
        .interactive(true)
        .selected(true)
        .draggable(false);

      expect(card.variant()).toBe('glass');
      expect(card.size()).toBe('lg');
      expect(card.interactive()).toBe(true);
      expect(card.selected()).toBe(true);
      expect(card.draggable()).toBe(false);
    });

    it('should have unique instance ID', () => {
      const card1 = cbCard();
      const card2 = cbCard();

      expect(card1.instanceId()).not.toBe(card2.instanceId());
    });
  });

  describe('Data Updates', () => {
    it('should update content when data changes', () => {
      const card = cbCard();
      const sel = d3.select(container);

      sel.datum(mockNode).call(card);
      expect(container.querySelector('.cb-card__title')?.textContent).toBe('Test Task');

      sel.datum({ ...mockNode, name: 'Updated Task' }).call(card);
      expect(container.querySelector('.cb-card__title')?.textContent).toBe('Updated Task');
    });

    it('should handle data with array category', () => {
      const card = cbCard().showBadge(true);
      const nodeWithArrayCategory = {
        ...mockNode,
        latch: { category: ['Work', 'Important', 'Q1'] },
      };

      d3.select(container).datum(nodeWithArrayCategory).call(card);

      const badgeEl = container.querySelector('.cb-card__badge');
      // Should show first category
      expect(badgeEl?.textContent).toBe('Work');
    });
  });

  describe('Custom Class', () => {
    it('should apply custom className', () => {
      const card = cbCard().className('my-custom-class');

      d3.select(container).datum(mockNode).call(card);

      const cardEl = container.querySelector('.cb-card');
      expect(cardEl?.classList.contains('my-custom-class')).toBe(true);
    });
  });
});
