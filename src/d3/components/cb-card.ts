/**
 * iso-card - Isometry Card Component
 *
 * D3 component for rendering cards using the reusable chart pattern.
 * Follows factory + closure + fluent API pattern.
 */

import * as d3 from 'd3';
import { createAccessor, cx } from '../factory';
import type { NodeValue, CardVariant, Size, IsometryEvent } from '@/types/lpg';

// ============================================
// Types
// ============================================

/** Card component props (index signature required for createAccessor) */
interface CardProps {
  variant: CardVariant;
  size: Size;
  interactive: boolean;
  draggable: boolean;
  [key: string]: CardVariant | Size | boolean;
}

/** Card event types */
interface CardEvents {
  click: (event: IsometryEvent<{ id: string }>) => void;
  dblclick: (event: IsometryEvent<{ id: string }>) => void;
  select: (event: IsometryEvent<{ id: string; selected: boolean }>) => void;
  hover: (event: IsometryEvent<{ id: string; hovering: boolean }>) => void;
}

/** D3 selection type for card - uses BaseType for parent flexibility */
type CardSelection = d3.Selection<HTMLDivElement, NodeValue, d3.BaseType, unknown>;

// ============================================
// Default Props
// ============================================

const defaultProps: CardProps = {
  variant: 'default',
  size: 'md',
  interactive: false,
  draggable: false,
};

// ============================================
// Component Factory
// ============================================

/**
 * Creates a cb-card component with fluent API.
 *
 * @example
 * ```ts
 * const card = cbCard()
 *   .variant('glass')
 *   .interactive(true)
 *   .on('select', handleSelect);
 *
 * d3.select(container)
 *   .selectAll('.card-wrapper')
 *   .data(cards, d => d.id)
 *   .join('div')
 *   .call(card);
 * ```
 */
export function cbCard() {
  // Private state (closure)
  const props: CardProps = { ...defaultProps };
  const events: Partial<CardEvents> = {};
  const selectedIds = new Set<string>();
  let lastContainer: HTMLElement | null = null;

  // ============================================
  // Render Function
  // ============================================

  function card(selection: CardSelection): CardSelection {
    lastContainer = selection.node()?.parentElement || null;

    selection.each(function (d) {
      const wrapper = d3.select(this);

      // Build class list
      const classNames = cx(
        'cb-card',
        {
          glass: props.variant === 'glass',
          elevated: props.variant === 'elevated',
          outline: props.variant === 'outline',
          sm: props.size === 'sm',
          lg: props.size === 'lg',
          interactive: props.interactive,
          draggable: props.draggable,
          selected: selectedIds.has(d.id),
        },
        []
      );

      // Check if card already exists
      let cardEl = wrapper.select<HTMLDivElement>('.cb-card');

      if (cardEl.empty()) {
        // Create new card structure
        cardEl = wrapper.append('div');

        // Header with badge and title
        const header = cardEl.append('div').attr('class', 'cb-card__header');
        header.append('span').attr('class', 'cb-card__badge');
        header.append('h3').attr('class', 'cb-card__title');

        // Content
        cardEl.append('div').attr('class', 'cb-card__content');
      }

      // Update card
      cardEl
        .attr('class', classNames)
        .attr('data-id', d.id);

      // Update badge
      cardEl.select('.cb-card__badge').text(d.nodeType);

      // Update title
      cardEl.select('.cb-card__title').text(d.name);

      // Update content
      cardEl.select('.cb-card__content').text(d.content || '');

      // Attach event handlers
      if (props.interactive) {
        cardEl
          .on('click', function (event) {
            const cbEvent: IsometryEvent<{ id: string }> = {
              type: 'click',
              target: d,
              data: { id: d.id },
              originalEvent: event,
            };

            events.click?.(cbEvent);

            // Also trigger select
            const selectEvent: IsometryEvent<{ id: string; selected: boolean }> = {
              type: 'select',
              target: d,
              data: { id: d.id, selected: true },
              originalEvent: event,
            };
            events.select?.(selectEvent);
          })
          .on('dblclick', function (event) {
            const cbEvent: IsometryEvent<{ id: string }> = {
              type: 'dblclick',
              target: d,
              data: { id: d.id },
              originalEvent: event,
            };
            events.dblclick?.(cbEvent);
          })
          .on('mouseenter', function (event) {
            const cbEvent: IsometryEvent<{ id: string; hovering: boolean }> = {
              type: 'hover',
              target: d,
              data: { id: d.id, hovering: true },
              originalEvent: event,
            };
            events.hover?.(cbEvent);
          })
          .on('mouseleave', function (event) {
            const cbEvent: IsometryEvent<{ id: string; hovering: boolean }> = {
              type: 'hover',
              target: d,
              data: { id: d.id, hovering: false },
              originalEvent: event,
            };
            events.hover?.(cbEvent);
          });
      }
    });

    return selection;
  }

  // ============================================
  // Fluent API - Accessors
  // ============================================

  card.variant = createAccessor<typeof card, CardVariant>(card, props, 'variant');
  card.size = createAccessor<typeof card, Size>(card, props, 'size');
  card.interactive = createAccessor<typeof card, boolean>(card, props, 'interactive');
  card.draggable = createAccessor<typeof card, boolean>(card, props, 'draggable');

  // ============================================
  // Event Registration
  // ============================================

  card.on = function <K extends keyof CardEvents>(
    eventType: K,
    handler: CardEvents[K]
  ): typeof card {
    events[eventType] = handler;
    return card;
  };

  // ============================================
  // Selection Management
  // ============================================

  card.select = function (id: string): typeof card {
    selectedIds.add(id);
    updateSelectionClasses();
    return card;
  };

  card.deselect = function (id: string): typeof card {
    selectedIds.delete(id);
    updateSelectionClasses();
    return card;
  };

  card.toggleSelect = function (id: string): typeof card {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    updateSelectionClasses();
    return card;
  };

  card.clearSelection = function (): typeof card {
    selectedIds.clear();
    updateSelectionClasses();
    return card;
  };

  card.getSelected = function (): string[] {
    return Array.from(selectedIds);
  };

  // Helper to update selection classes in DOM
  function updateSelectionClasses(): void {
    if (!lastContainer) return;

    d3.select(lastContainer)
      .selectAll<HTMLDivElement, NodeValue>('.cb-card')
      .classed('cb-card--selected', function () {
        const id = d3.select(this).attr('data-id');
        return selectedIds.has(id);
      });
  }

  return card;
}

// ============================================
// Type Export for Component
// ============================================

export type CbCard = ReturnType<typeof cbCard>;
