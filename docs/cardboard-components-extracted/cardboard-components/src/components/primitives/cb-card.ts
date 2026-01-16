/**
 * cb-card - The Atomic Value Unit
 *
 * Renders any LPG Value (Node or Edge) as a visual card.
 * This is the foundational primitive for CardBoard's polymorphic views.
 *
 * @example
 * ```ts
 * const card = cbCard()
 *   .variant('glass')
 *   .interactive(true)
 *   .on('select', (e) => console.log('Selected:', e.data.id));
 *
 * d3.select('#container')
 *   .selectAll('.card-wrapper')
 *   .data(cards, d => d.id)
 *   .join('div')
 *   .call(card);
 * ```
 */

import * as d3 from 'd3';
import {
  createAccessors,
  cx,
  enterTransition,
  exitTransition,
  generateInstanceId,
  keyById,
} from '../factory';
import type {
  CardValue,
  CardVariant,
  D3Selection,
  EventHandler,
  Size,
  isNode,
} from '../types';

// ============================================
// Types
// ============================================

export interface CardProps {
  /** Visual variant */
  variant: CardVariant;
  /** Size preset */
  size: Size;
  /** Allow interaction (hover, click) */
  interactive: boolean;
  /** Selected state */
  selected: boolean;
  /** Draggable */
  draggable: boolean;
  /** Show category badge from LATCH */
  showBadge: boolean;
  /** Show footer metadata */
  showFooter: boolean;
  /** Maximum lines for content */
  contentLines: number;
  /** Custom class names */
  className: string;
}

export interface CardEventData {
  id: string;
}

export interface CardSelectEventData extends CardEventData {
  selected: boolean;
}

export interface CardDragEventData extends CardEventData {
  position: [number, number];
}

export interface CardEvents {
  select: EventHandler<CardSelectEventData>;
  click: EventHandler<CardEventData>;
  dblclick: EventHandler<CardEventData>;
  dragstart: EventHandler<CardDragEventData>;
  drag: EventHandler<CardDragEventData>;
  dragend: EventHandler<CardDragEventData>;
  mouseenter: EventHandler<CardEventData>;
  mouseleave: EventHandler<CardEventData>;
}

// ============================================
// Default Props
// ============================================

const defaultProps: CardProps = {
  variant: 'default',
  size: 'md',
  interactive: true,
  selected: false,
  draggable: false,
  showBadge: true,
  showFooter: true,
  contentLines: 3,
  className: '',
};

// ============================================
// Component
// ============================================

export function cbCard() {
  // Private state
  const instanceId = generateInstanceId('card');
  const props: CardProps = { ...defaultProps };
  const events: Partial<CardEvents> = {};

  // Render function - called via selection.call(card)
  function card(
    selection: D3Selection<HTMLElement, CardValue, HTMLElement, unknown>,
  ): D3Selection<HTMLElement, CardValue, HTMLElement, unknown> {
    selection.each(function (d) {
      const container = d3.select(this);

      // Data join for card wrapper
      const cardEl = container
        .selectAll<HTMLDivElement, CardValue>('.cb-card')
        .data([d], keyById)
        .join(
          // ENTER: Create new card
          (enter) => {
            const wrapper = enter
              .append('div')
              .attr('data-card-id', (d) => d.id)
              .attr('data-instance-id', instanceId)
              .call(createCardStructure);

            // Enter transition
            enterTransition(wrapper, 'normal');

            return wrapper;
          },
          // UPDATE: Return existing
          (update) => update,
          // EXIT: Remove with transition
          (exit) => exitTransition(exit, 'fast'),
        );

      // Update attributes and classes
      updateCardAttributes(cardEl, d, props);

      // Update content
      updateCardContent(cardEl, d, props);

      // Bind events
      bindCardEvents(cardEl, d, props, events);
    });

    return selection;
  }

  // ============================================
  // Internal Functions
  // ============================================

  /**
   * Create the card's DOM structure
   */
  function createCardStructure(
    sel: D3Selection<HTMLDivElement, CardValue, HTMLElement, unknown>,
  ): D3Selection<HTMLDivElement, CardValue, HTMLElement, unknown> {
    // Header: title + badge
    const header = sel.append('div').attr('class', 'cb-card__header');
    header.append('span').attr('class', 'cb-card__title');
    header.append('span').attr('class', 'cb-card__badge');

    // Content area
    sel.append('div').attr('class', 'cb-card__content');

    // Footer: metadata
    sel.append('div').attr('class', 'cb-card__footer');

    return sel;
  }

  /**
   * Update card attributes and classes based on props
   */
  function updateCardAttributes(
    cardEl: D3Selection<HTMLDivElement, CardValue, HTMLElement, unknown>,
    d: CardValue,
    props: CardProps,
  ): void {
    // Build class string
    const className = cx(
      'cb-card',
      {
        [props.variant]: true,
        [props.size]: true,
        interactive: props.interactive,
        selected: props.selected,
        draggable: props.draggable,
      },
      props.className ? [props.className] : [],
    );

    cardEl
      .attr('class', className)
      .attr('tabindex', props.interactive ? 0 : -1)
      .attr('role', 'article')
      .attr('aria-selected', props.selected ? 'true' : null);
  }

  /**
   * Update card content based on data
   */
  function updateCardContent(
    cardEl: D3Selection<HTMLDivElement, CardValue, HTMLElement, unknown>,
    d: CardValue,
    props: CardProps,
  ): void {
    // Title
    const title = d.type === 'node' ? d.name : d.label || d.edgeType;
    cardEl.select('.cb-card__title').text(title);

    // Content (for nodes with content)
    const contentEl = cardEl.select('.cb-card__content');
    if (d.type === 'node' && d.content) {
      contentEl
        .text(d.content)
        .style('display', null)
        .style('-webkit-line-clamp', props.contentLines);
    } else {
      contentEl.style('display', 'none');
    }

    // Badge (LATCH category)
    const badgeEl = cardEl.select('.cb-card__badge');
    const category = d.latch?.category;

    if (props.showBadge && category) {
      const categoryText = Array.isArray(category) ? category[0] : category;
      badgeEl.text(categoryText).style('display', null);
    } else {
      badgeEl.style('display', 'none');
    }

    // Footer (metadata)
    const footerEl = cardEl.select('.cb-card__footer');
    if (props.showFooter) {
      if (d.type === 'node') {
        footerEl.text(d.nodeType).style('display', null);
      } else {
        // For edges, show connection info
        footerEl.text(`${d.edgeType}`).style('display', null);
      }
    } else {
      footerEl.style('display', 'none');
    }
  }

  /**
   * Bind event handlers to card
   */
  function bindCardEvents(
    cardEl: D3Selection<HTMLDivElement, CardValue, HTMLElement, unknown>,
    d: CardValue,
    props: CardProps,
    events: Partial<CardEvents>,
  ): void {
    // Remove existing handlers if not interactive
    if (!props.interactive) {
      cardEl
        .on('click', null)
        .on('dblclick', null)
        .on('keydown', null)
        .on('mouseenter', null)
        .on('mouseleave', null);
      return;
    }

    // Click handler
    cardEl.on('click', function (event: MouseEvent) {
      event.stopPropagation();
      events.click?.({ type: 'click', target: d, data: { id: d.id } });
    });

    // Double-click handler
    cardEl.on('dblclick', function (event: MouseEvent) {
      event.stopPropagation();
      events.dblclick?.({ type: 'dblclick', target: d, data: { id: d.id } });
    });

    // Keyboard handler (Enter/Space to select)
    cardEl.on('keydown', function (event: KeyboardEvent) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        events.select?.({
          type: 'select',
          target: d,
          data: { id: d.id, selected: !props.selected },
        });
      }
    });

    // Hover handlers
    cardEl.on('mouseenter', function (event: MouseEvent) {
      events.mouseenter?.({ type: 'mouseenter', target: d, data: { id: d.id } });
    });

    cardEl.on('mouseleave', function (event: MouseEvent) {
      events.mouseleave?.({ type: 'mouseleave', target: d, data: { id: d.id } });
    });

    // Drag behavior (if enabled)
    if (props.draggable) {
      const drag = d3
        .drag<HTMLDivElement, CardValue>()
        .on('start', function (event) {
          d3.select(this).classed('cb-card--dragging', true);
          events.dragstart?.({
            type: 'dragstart',
            target: d,
            data: { id: d.id, position: [event.x, event.y] },
          });
        })
        .on('drag', function (event) {
          events.drag?.({
            type: 'drag',
            target: d,
            data: { id: d.id, position: [event.x, event.y] },
          });
        })
        .on('end', function (event) {
          d3.select(this).classed('cb-card--dragging', false);
          events.dragend?.({
            type: 'dragend',
            target: d,
            data: { id: d.id, position: [event.x, event.y] },
          });
        });

      cardEl.call(drag);
    }
  }

  // ============================================
  // Fluent API
  // ============================================

  // Create getter/setters for all props
  const accessors = createAccessors(card, props);
  Object.assign(card, accessors);

  // Event binding method
  card.on = function <K extends keyof CardEvents>(
    eventType: K,
    handler: CardEvents[K] | null,
  ): typeof card {
    if (handler === null) {
      delete events[eventType];
    } else {
      events[eventType] = handler;
    }
    return card;
  };

  // Get the instance ID
  card.instanceId = function (): string {
    return instanceId;
  };

  return card;
}

// Type export for the component
export type CbCard = ReturnType<typeof cbCard>;
