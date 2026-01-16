# CardBoard D3.js Component System Implementation Plan

*January 2025*

A darwin-ui–inspired component architecture for CardBoard's polymorphic data visualization platform, built on D3.js data binding patterns.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Phase 1: Foundation](#phase-1-foundation)
4. [Phase 2: Core Components](#phase-2-core-components)
5. [Phase 3: View Components](#phase-3-view-components)
6. [Phase 4: Integration](#phase-4-integration)
7. [Testing Strategy](#testing-strategy)
8. [Implementation Checklist](#implementation-checklist)

---

## Architecture Overview

### Design Principles

1. **D3 Data Binding IS State Management** — No separate state layer; D3's enter/update/exit pattern handles all UI state
2. **Boring Stack** — SQLite + D3.js, no additional frameworks
3. **Polymorphic by Design** — Same components render across Grid/Kanban/Network/Timeline views
4. **PAFV Alignment** — Components map to Planes (containers), Axes (controls), Facets (configuration), Values (cards)

### Component Taxonomy (aligned with PAFV)

```
PAFV Layer          Component Category       Examples
─────────────────────────────────────────────────────────
Planes              Containers               cb-canvas, cb-window, cb-panel
Axes                Controls                 cb-button, cb-input, cb-select
Facets              Configuration            cb-toggle, cb-slider, cb-badge
Values              Cards                    cb-card, cb-avatar, cb-edge
```

### Component Pattern: Factory + Closure + Fluent API

Every CardBoard component follows this pattern:

```typescript
function cbComponent() {
  // 1. Private state (closure)
  let props = { /* defaults */ };
  
  // 2. Render function (called via selection.call())
  function component(selection) {
    selection.each(function(d) {
      // D3 data binding logic
    });
    return selection;
  }
  
  // 3. Fluent API (getter/setter for each prop)
  component.propName = function(_) {
    return arguments.length ? (props.propName = _, component) : props.propName;
  };
  
  return component;
}
```

---

## File Structure

```
src/
├── components/
│   ├── index.ts                    # Registry + exports
│   ├── types.ts                    # Shared type definitions
│   ├── factory.ts                  # Base component factory utilities
│   │
│   ├── primitives/
│   │   ├── cb-card.ts              # Core card component
│   │   ├── cb-card.test.ts
│   │   ├── cb-badge.ts             # LATCH category indicator
│   │   ├── cb-badge.test.ts
│   │   ├── cb-avatar.ts            # Person node representation
│   │   ├── cb-avatar.test.ts
│   │   ├── cb-icon.ts              # Semantic icon wrapper
│   │   └── cb-icon.test.ts
│   │
│   ├── controls/
│   │   ├── cb-button.ts            # Action button
│   │   ├── cb-button.test.ts
│   │   ├── cb-input.ts             # Text input
│   │   ├── cb-input.test.ts
│   │   ├── cb-select.ts            # Dropdown select
│   │   ├── cb-select.test.ts
│   │   ├── cb-toggle.ts            # On/off toggle
│   │   ├── cb-toggle.test.ts
│   │   ├── cb-slider.ts            # Range slider
│   │   └── cb-slider.test.ts
│   │
│   ├── containers/
│   │   ├── cb-canvas.ts            # Root visualization container
│   │   ├── cb-canvas.test.ts
│   │   ├── cb-window.ts            # macOS-style window
│   │   ├── cb-window.test.ts
│   │   ├── cb-panel.ts             # Sidebar panel
│   │   ├── cb-panel.test.ts
│   │   └── cb-toolbar.ts           # Action toolbar
│   │
│   ├── overlays/
│   │   ├── cb-modal.ts             # Modal dialog
│   │   ├── cb-tooltip.ts           # Hover tooltip
│   │   ├── cb-popover.ts           # Rich popover
│   │   └── cb-contextmenu.ts       # Right-click menu
│   │
│   └── views/
│       ├── cb-grid.ts              # Grid layout view
│       ├── cb-kanban.ts            # Kanban columns view
│       ├── cb-network.ts           # Force-directed graph view
│       └── cb-timeline.ts          # Timeline view
│
├── styles/
│   ├── index.css                   # Main stylesheet entry
│   ├── variables.css               # CSS custom properties
│   ├── primitives.css              # Primitive component styles
│   ├── controls.css                # Control component styles
│   ├── containers.css              # Container component styles
│   └── views.css                   # View-specific styles
│
└── utils/
    ├── scales.ts                   # LATCH axis scale factories
    ├── transitions.ts              # Shared transition configurations
    └── dom.ts                      # DOM helper utilities
```

---

## Phase 1: Foundation

**Goal**: Establish base infrastructure before any components.

### 1.1 Type Definitions (`src/components/types.ts`)

```typescript
import * as d3 from 'd3';

// ============================================
// LATCH Types (from architecture truth)
// ============================================

export type LATCHAxis = 'location' | 'alphabet' | 'time' | 'category' | 'hierarchy';

export interface LATCHCoordinates {
  location?: string | [number, number];
  alphabet?: string;
  time?: Date | string;
  category?: string | string[];
  hierarchy?: number;
}

// ============================================
// LPG Types (Nodes + Edges are both Values)
// ============================================

export interface BaseValue {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  latch: LATCHCoordinates;
}

export interface NodeValue extends BaseValue {
  type: 'node';
  nodeType: 'Task' | 'Note' | 'Person' | 'Project' | 'Event' | 'Resource' | 'Custom';
  name: string;
  content?: string;
  properties: Record<string, unknown>;
}

export interface EdgeValue extends BaseValue {
  type: 'edge';
  edgeType: 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';
  sourceId: string;
  targetId: string;
  label?: string;
  weight?: number;
  directed: boolean;
  properties: Record<string, unknown>;
}

export type CardValue = NodeValue | EdgeValue;

// ============================================
// Component Types
// ============================================

export type D3Selection<
  GElement extends d3.BaseType = d3.BaseType,
  Datum = unknown,
  PElement extends d3.BaseType = d3.BaseType,
  PDatum = unknown
> = d3.Selection<GElement, Datum, PElement, PDatum>;

export interface ComponentLifecycle<TData> {
  create?: (container: D3Selection<HTMLElement, TData>) => void;
  render: (selection: D3Selection<HTMLElement, TData>) => void;
  update?: (selection: D3Selection<HTMLElement, TData>) => void;
  destroy?: (selection: D3Selection<HTMLElement, TData>) => void;
}

export interface ComponentAPI<TProps> {
  [K in keyof TProps]: {
    (): TProps[K];
    (value: TProps[K]): this;
  };
}

// ============================================
// View Projection Types
// ============================================

export interface ViewProjection {
  xAxis: LATCHAxis;
  yAxis: LATCHAxis;
  zAxis?: LATCHAxis; // For stacking/layering
}

export type ViewType = 'grid' | 'kanban' | 'network' | 'timeline' | 'calendar';

// ============================================
// Event Types
// ============================================

export interface CardboardEvent<T = unknown> {
  type: string;
  target: CardValue;
  data?: T;
  originalEvent?: Event;
}

export type EventHandler<T = unknown> = (event: CardboardEvent<T>) => void;
```

### 1.2 Component Factory (`src/components/factory.ts`)

```typescript
import * as d3 from 'd3';
import type { D3Selection } from './types';

/**
 * Creates a getter/setter method for a component property.
 * Follows D3's fluent API pattern: component.prop() gets, component.prop(value) sets and returns component.
 */
export function createAccessor<TComponent, TValue>(
  component: TComponent,
  props: Record<string, unknown>,
  key: string
): {
  (): TValue;
  (value: TValue): TComponent;
} {
  return function(value?: TValue) {
    if (arguments.length === 0) {
      return props[key] as TValue;
    }
    props[key] = value;
    return component;
  } as any;
}

/**
 * Creates multiple accessors for a component from a props object.
 */
export function createAccessors<TComponent, TProps extends Record<string, unknown>>(
  component: TComponent,
  props: TProps
): { [K in keyof TProps]: ReturnType<typeof createAccessor<TComponent, TProps[K]>> } {
  const accessors = {} as any;
  for (const key of Object.keys(props)) {
    accessors[key] = createAccessor(component, props, key);
  }
  return accessors;
}

/**
 * Unique ID generator for component instances
 */
let instanceCounter = 0;
export function generateInstanceId(prefix: string = 'cb'): string {
  return `${prefix}-${++instanceCounter}-${Date.now().toString(36)}`;
}

/**
 * Standard transition configuration
 */
export const transitions = {
  fast: { duration: 150, ease: d3.easeCubicOut },
  normal: { duration: 300, ease: d3.easeCubicInOut },
  slow: { duration: 500, ease: d3.easeCubicInOut },
  spring: { duration: 400, ease: d3.easeElasticOut.amplitude(1).period(0.4) },
} as const;

/**
 * Apply standard enter transition
 */
export function enterTransition<GElement extends d3.BaseType, Datum>(
  selection: D3Selection<GElement, Datum>,
  config: keyof typeof transitions = 'normal'
): d3.Transition<GElement, Datum, d3.BaseType, unknown> {
  const { duration, ease } = transitions[config];
  return selection
    .style('opacity', 0)
    .transition()
    .duration(duration)
    .ease(ease)
    .style('opacity', 1);
}

/**
 * Apply standard exit transition
 */
export function exitTransition<GElement extends d3.BaseType, Datum>(
  selection: D3Selection<GElement, Datum>,
  config: keyof typeof transitions = 'fast'
): d3.Transition<GElement, Datum, d3.BaseType, unknown> {
  const { duration, ease } = transitions[config];
  return selection
    .transition()
    .duration(duration)
    .ease(ease)
    .style('opacity', 0)
    .remove();
}

/**
 * Dispatch custom events from components
 */
export function createDispatcher<TEvents extends string>(...eventTypes: TEvents[]) {
  return d3.dispatch(...eventTypes);
}

/**
 * Class name builder with BEM-like conventions
 */
export function cx(
  base: string,
  modifiers: Record<string, boolean | undefined> = {},
  extras: string[] = []
): string {
  const classes = [base];
  
  for (const [modifier, active] of Object.entries(modifiers)) {
    if (active) {
      classes.push(`${base}--${modifier}`);
    }
  }
  
  return [...classes, ...extras].join(' ');
}
```

### 1.3 CSS Variables (`src/styles/variables.css`)

```css
/* ============================================
   CardBoard Design Tokens
   Darwin-UI inspired, macOS glass aesthetic
   ============================================ */

:root {
  /* ---- Color Palette ---- */
  
  /* Background layers (dark mode default) */
  --cb-bg-base: #0a0a0a;
  --cb-bg-raised: #1a1a1a;
  --cb-bg-overlay: #2a2a2a;
  --cb-bg-glass: rgba(30, 30, 30, 0.7);
  
  /* Foreground / text */
  --cb-fg-primary: #f5f5f5;
  --cb-fg-secondary: #a0a0a0;
  --cb-fg-muted: #666666;
  --cb-fg-inverse: #0a0a0a;
  
  /* Accent colors (macOS-inspired) */
  --cb-accent-blue: #0a84ff;
  --cb-accent-purple: #bf5af2;
  --cb-accent-pink: #ff375f;
  --cb-accent-orange: #ff9f0a;
  --cb-accent-yellow: #ffd60a;
  --cb-accent-green: #30d158;
  --cb-accent-teal: #64d2ff;
  --cb-accent-red: #ff453a;
  
  /* Current accent (user-configurable) */
  --cb-accent: var(--cb-accent-blue);
  --cb-accent-hover: color-mix(in srgb, var(--cb-accent) 85%, white);
  --cb-accent-active: color-mix(in srgb, var(--cb-accent) 70%, black);
  
  /* Borders */
  --cb-border-subtle: rgba(255, 255, 255, 0.06);
  --cb-border-default: rgba(255, 255, 255, 0.1);
  --cb-border-strong: rgba(255, 255, 255, 0.2);
  --cb-border-accent: var(--cb-accent);
  
  /* Shadows */
  --cb-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --cb-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --cb-shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
  --cb-shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.6);
  --cb-shadow-glow: 0 0 20px color-mix(in srgb, var(--cb-accent) 30%, transparent);
  
  /* ---- Typography ---- */
  
  --cb-font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
  --cb-font-mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', Consolas, monospace;
  
  --cb-text-xs: 0.75rem;    /* 12px */
  --cb-text-sm: 0.875rem;   /* 14px */
  --cb-text-base: 1rem;     /* 16px */
  --cb-text-lg: 1.125rem;   /* 18px */
  --cb-text-xl: 1.25rem;    /* 20px */
  --cb-text-2xl: 1.5rem;    /* 24px */
  --cb-text-3xl: 2rem;      /* 32px */
  
  --cb-leading-tight: 1.25;
  --cb-leading-normal: 1.5;
  --cb-leading-relaxed: 1.75;
  
  --cb-tracking-tight: -0.02em;
  --cb-tracking-normal: 0;
  --cb-tracking-wide: 0.02em;
  
  /* ---- Spacing ---- */
  
  --cb-space-1: 0.25rem;    /* 4px */
  --cb-space-2: 0.5rem;     /* 8px */
  --cb-space-3: 0.75rem;    /* 12px */
  --cb-space-4: 1rem;       /* 16px */
  --cb-space-5: 1.25rem;    /* 20px */
  --cb-space-6: 1.5rem;     /* 24px */
  --cb-space-8: 2rem;       /* 32px */
  --cb-space-10: 2.5rem;    /* 40px */
  --cb-space-12: 3rem;      /* 48px */
  
  /* ---- Border Radius ---- */
  
  --cb-radius-sm: 4px;
  --cb-radius-md: 8px;
  --cb-radius-lg: 12px;
  --cb-radius-xl: 16px;
  --cb-radius-2xl: 24px;
  --cb-radius-full: 9999px;
  
  /* ---- Effects ---- */
  
  --cb-blur-sm: blur(4px);
  --cb-blur-md: blur(12px);
  --cb-blur-lg: blur(20px);
  --cb-blur-xl: blur(40px);
  
  /* Glass effect */
  --cb-glass-bg: var(--cb-bg-glass);
  --cb-glass-border: var(--cb-border-default);
  --cb-glass-blur: var(--cb-blur-lg);
  
  /* ---- Transitions ---- */
  
  --cb-transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --cb-transition-normal: 300ms cubic-bezier(0.4, 0, 0.2, 1);
  --cb-transition-slow: 500ms cubic-bezier(0.4, 0, 0.2, 1);
  
  /* ---- Z-Index Scale ---- */
  
  --cb-z-base: 0;
  --cb-z-raised: 10;
  --cb-z-dropdown: 100;
  --cb-z-sticky: 200;
  --cb-z-modal: 300;
  --cb-z-popover: 400;
  --cb-z-tooltip: 500;
  --cb-z-toast: 600;
  
  /* ---- Component-Specific ---- */
  
  /* Card */
  --cb-card-padding: var(--cb-space-4);
  --cb-card-radius: var(--cb-radius-lg);
  --cb-card-gap: var(--cb-space-3);
  
  /* Button */
  --cb-button-height-sm: 28px;
  --cb-button-height-md: 36px;
  --cb-button-height-lg: 44px;
  --cb-button-padding-x: var(--cb-space-4);
  --cb-button-radius: var(--cb-radius-md);
  
  /* Input */
  --cb-input-height: 36px;
  --cb-input-padding-x: var(--cb-space-3);
  --cb-input-radius: var(--cb-radius-md);
  
  /* Window */
  --cb-window-header-height: 38px;
  --cb-window-radius: var(--cb-radius-xl);
  --cb-window-traffic-light-size: 12px;
}

/* ---- Light Mode Override ---- */

[data-theme="light"] {
  --cb-bg-base: #f5f5f7;
  --cb-bg-raised: #ffffff;
  --cb-bg-overlay: #f0f0f0;
  --cb-bg-glass: rgba(255, 255, 255, 0.7);
  
  --cb-fg-primary: #1d1d1f;
  --cb-fg-secondary: #6e6e73;
  --cb-fg-muted: #aeaeb2;
  --cb-fg-inverse: #ffffff;
  
  --cb-border-subtle: rgba(0, 0, 0, 0.04);
  --cb-border-default: rgba(0, 0, 0, 0.1);
  --cb-border-strong: rgba(0, 0, 0, 0.2);
  
  --cb-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.08);
  --cb-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.12);
  --cb-shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.16);
  --cb-shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.2);
}
```

### 1.4 Base Styles (`src/styles/index.css`)

```css
@import './variables.css';

/* ============================================
   CardBoard Base Styles
   ============================================ */

/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Base */
html {
  font-family: var(--cb-font-sans);
  font-size: 16px;
  line-height: var(--cb-leading-normal);
  color: var(--cb-fg-primary);
  background: var(--cb-bg-base);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Focus visible (keyboard navigation) */
:focus-visible {
  outline: 2px solid var(--cb-accent);
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}

/* Selection */
::selection {
  background: color-mix(in srgb, var(--cb-accent) 30%, transparent);
}

/* Scrollbar (webkit) */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--cb-border-strong);
  border-radius: var(--cb-radius-full);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--cb-fg-muted);
}

/* ---- Utility Classes ---- */

.cb-glass {
  background: var(--cb-glass-bg);
  backdrop-filter: var(--cb-glass-blur);
  -webkit-backdrop-filter: var(--cb-glass-blur);
  border: 1px solid var(--cb-glass-border);
}

.cb-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cb-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Import component styles */
@import './primitives.css';
@import './controls.css';
@import './containers.css';
@import './views.css';
```

---

## Phase 2: Core Components

**Goal**: Implement the three foundational components.

### 2.1 `cb-card` — The Atomic Value Unit

**Purpose**: Represents any LPG Value (Node or Edge) as a visual card.

**File**: `src/components/primitives/cb-card.ts`

```typescript
import * as d3 from 'd3';
import { createAccessors, cx, enterTransition, exitTransition, generateInstanceId } from '../factory';
import type { CardValue, D3Selection, EventHandler } from '../types';

// ============================================
// Types
// ============================================

export interface CardProps {
  /** Visual variant */
  variant: 'default' | 'glass' | 'elevated' | 'outline';
  /** Size preset */
  size: 'sm' | 'md' | 'lg';
  /** Allow interaction (hover, click) */
  interactive: boolean;
  /** Selected state */
  selected: boolean;
  /** Draggable */
  draggable: boolean;
  /** Show category badge */
  showBadge: boolean;
  /** Custom class names */
  className: string;
}

export interface CardEvents {
  select: EventHandler<{ id: string; selected: boolean }>;
  click: EventHandler<{ id: string }>;
  dblclick: EventHandler<{ id: string }>;
  dragstart: EventHandler<{ id: string; position: [number, number] }>;
  dragend: EventHandler<{ id: string; position: [number, number] }>;
}

// ============================================
// Component
// ============================================

export function cbCard() {
  // Private state
  const instanceId = generateInstanceId('card');
  
  const props: CardProps = {
    variant: 'default',
    size: 'md',
    interactive: true,
    selected: false,
    draggable: false,
    showBadge: true,
    className: '',
  };
  
  const events: Partial<CardEvents> = {};
  
  // Render function
  function card(selection: D3Selection<HTMLElement, CardValue>) {
    selection.each(function(d) {
      const container = d3.select(this);
      
      // Data join for card wrapper
      const cardEl = container
        .selectAll<HTMLDivElement, CardValue>('.cb-card')
        .data([d], d => d.id)
        .join(
          // ENTER
          enter => {
            const wrapper = enter.append('div')
              .attr('data-card-id', d => d.id)
              .attr('tabindex', props.interactive ? 0 : -1)
              .call(createCardStructure);
            
            enterTransition(wrapper, 'normal');
            return wrapper;
          },
          // UPDATE
          update => update,
          // EXIT
          exit => exitTransition(exit, 'fast')
        );
      
      // Update classes
      cardEl.attr('class', d => cx('cb-card', {
        [`cb-card--${props.variant}`]: true,
        [`cb-card--${props.size}`]: true,
        'cb-card--interactive': props.interactive,
        'cb-card--selected': props.selected,
        'cb-card--draggable': props.draggable,
      }, props.className ? [props.className] : []));
      
      // Update content
      updateCardContent(cardEl, d, props);
      
      // Bind events
      bindCardEvents(cardEl, d, props, events);
    });
    
    return selection;
  }
  
  // Create card DOM structure
  function createCardStructure(sel: D3Selection<HTMLDivElement, CardValue>) {
    // Header
    const header = sel.append('div').attr('class', 'cb-card__header');
    header.append('span').attr('class', 'cb-card__title');
    header.append('span').attr('class', 'cb-card__badge');
    
    // Content
    sel.append('div').attr('class', 'cb-card__content');
    
    // Footer (optional metadata)
    sel.append('div').attr('class', 'cb-card__footer');
    
    return sel;
  }
  
  // Update card content
  function updateCardContent(
    cardEl: D3Selection<HTMLDivElement, CardValue>,
    d: CardValue,
    props: CardProps
  ) {
    // Title
    const title = d.type === 'node' ? d.name : d.label || `${d.edgeType}`;
    cardEl.select('.cb-card__title').text(title);
    
    // Content (for nodes only)
    if (d.type === 'node' && d.content) {
      cardEl.select('.cb-card__content')
        .text(d.content)
        .style('display', null);
    } else {
      cardEl.select('.cb-card__content').style('display', 'none');
    }
    
    // Badge (category from LATCH)
    const category = d.latch?.category;
    const badgeEl = cardEl.select('.cb-card__badge');
    
    if (props.showBadge && category) {
      const categoryText = Array.isArray(category) ? category[0] : category;
      badgeEl.text(categoryText).style('display', null);
    } else {
      badgeEl.style('display', 'none');
    }
    
    // Footer metadata
    const footer = cardEl.select('.cb-card__footer');
    if (d.type === 'node') {
      footer.text(d.nodeType).style('display', null);
    } else {
      footer.text(`${d.sourceId} → ${d.targetId}`).style('display', null);
    }
  }
  
  // Bind event handlers
  function bindCardEvents(
    cardEl: D3Selection<HTMLDivElement, CardValue>,
    d: CardValue,
    props: CardProps,
    events: Partial<CardEvents>
  ) {
    if (!props.interactive) {
      cardEl.on('click', null).on('dblclick', null).on('keydown', null);
      return;
    }
    
    cardEl
      .on('click', (event: MouseEvent) => {
        event.stopPropagation();
        events.click?.({ type: 'click', target: d, data: { id: d.id } });
      })
      .on('dblclick', (event: MouseEvent) => {
        event.stopPropagation();
        events.dblclick?.({ type: 'dblclick', target: d, data: { id: d.id } });
      })
      .on('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          events.select?.({
            type: 'select',
            target: d,
            data: { id: d.id, selected: !props.selected }
          });
        }
      });
    
    // Drag behavior (if enabled)
    if (props.draggable) {
      const drag = d3.drag<HTMLDivElement, CardValue>()
        .on('start', (event) => {
          events.dragstart?.({
            type: 'dragstart',
            target: d,
            data: { id: d.id, position: [event.x, event.y] }
          });
        })
        .on('end', (event) => {
          events.dragend?.({
            type: 'dragend',
            target: d,
            data: { id: d.id, position: [event.x, event.y] }
          });
        });
      
      cardEl.call(drag);
    }
  }
  
  // Fluent API
  const accessors = createAccessors(card, props);
  Object.assign(card, accessors);
  
  // Event handlers
  card.on = function<K extends keyof CardEvents>(
    eventType: K,
    handler: CardEvents[K]
  ) {
    events[eventType] = handler;
    return card;
  };
  
  return card;
}

export type CbCard = ReturnType<typeof cbCard>;
```

**Styles**: `src/styles/primitives.css` (card section)

```css
/* ============================================
   cb-card
   ============================================ */

.cb-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--cb-card-gap);
  padding: var(--cb-card-padding);
  border-radius: var(--cb-card-radius);
  background: var(--cb-bg-raised);
  border: 1px solid var(--cb-border-subtle);
  transition: 
    transform var(--cb-transition-fast),
    box-shadow var(--cb-transition-fast),
    border-color var(--cb-transition-fast);
}

/* Variants */
.cb-card--default {
  background: var(--cb-bg-raised);
}

.cb-card--glass {
  background: var(--cb-glass-bg);
  backdrop-filter: var(--cb-glass-blur);
  -webkit-backdrop-filter: var(--cb-glass-blur);
  border-color: var(--cb-glass-border);
}

.cb-card--elevated {
  background: var(--cb-bg-overlay);
  box-shadow: var(--cb-shadow-md);
}

.cb-card--outline {
  background: transparent;
  border-color: var(--cb-border-default);
}

/* Sizes */
.cb-card--sm {
  padding: var(--cb-space-2) var(--cb-space-3);
  gap: var(--cb-space-2);
}

.cb-card--sm .cb-card__title {
  font-size: var(--cb-text-sm);
}

.cb-card--lg {
  padding: var(--cb-space-5) var(--cb-space-6);
  gap: var(--cb-space-4);
}

.cb-card--lg .cb-card__title {
  font-size: var(--cb-text-lg);
}

/* Interactive states */
.cb-card--interactive {
  cursor: pointer;
}

.cb-card--interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--cb-shadow-lg);
  border-color: var(--cb-border-default);
}

.cb-card--interactive:active {
  transform: translateY(0);
  box-shadow: var(--cb-shadow-sm);
}

/* Selected state */
.cb-card--selected {
  border-color: var(--cb-accent);
  box-shadow: 
    0 0 0 1px var(--cb-accent),
    var(--cb-shadow-glow);
}

/* Draggable */
.cb-card--draggable {
  cursor: grab;
}

.cb-card--draggable:active {
  cursor: grabbing;
}

/* Card structure */
.cb-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--cb-space-2);
}

.cb-card__title {
  font-weight: 500;
  color: var(--cb-fg-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cb-card__badge {
  flex-shrink: 0;
  padding: var(--cb-space-1) var(--cb-space-2);
  font-size: var(--cb-text-xs);
  font-weight: 500;
  color: var(--cb-accent);
  background: color-mix(in srgb, var(--cb-accent) 15%, transparent);
  border-radius: var(--cb-radius-sm);
}

.cb-card__content {
  font-size: var(--cb-text-sm);
  color: var(--cb-fg-secondary);
  line-height: var(--cb-leading-relaxed);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cb-card__footer {
  font-size: var(--cb-text-xs);
  color: var(--cb-fg-muted);
  text-transform: uppercase;
  letter-spacing: var(--cb-tracking-wide);
}
```

### 2.2 `cb-canvas` — The Root Container

**Purpose**: Root container for CardBoard visualizations. Manages view projections and child component rendering.

**File**: `src/components/containers/cb-canvas.ts`

```typescript
import * as d3 from 'd3';
import { createAccessors, generateInstanceId } from '../factory';
import type { CardValue, D3Selection, ViewProjection, ViewType } from '../types';

// ============================================
// Types
// ============================================

export interface CanvasProps {
  /** Unique canvas identifier */
  id: string;
  /** Canvas width (px or 'auto') */
  width: number | 'auto';
  /** Canvas height (px or 'auto') */
  height: number | 'auto';
  /** Current view type */
  viewType: ViewType;
  /** LATCH axis projection */
  projection: ViewProjection;
  /** Padding inside canvas */
  padding: { top: number; right: number; bottom: number; left: number };
  /** Enable zoom/pan */
  zoomable: boolean;
  /** Zoom extent [min, max] */
  zoomExtent: [number, number];
  /** Grid snap size (0 = disabled) */
  gridSnap: number;
  /** Background style */
  background: 'solid' | 'dots' | 'grid' | 'none';
}

export interface CanvasDimensions {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
}

// ============================================
// Component
// ============================================

export function cbCanvas() {
  const instanceId = generateInstanceId('canvas');
  
  const props: CanvasProps = {
    id: instanceId,
    width: 'auto',
    height: 'auto',
    viewType: 'grid',
    projection: { xAxis: 'category', yAxis: 'time' },
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    zoomable: true,
    zoomExtent: [0.1, 4],
    gridSnap: 0,
    background: 'dots',
  };
  
  // Internal state
  let zoomBehavior: d3.ZoomBehavior<HTMLElement, unknown> | null = null;
  let currentTransform = d3.zoomIdentity;
  
  // Render function
  function canvas(selection: D3Selection<HTMLElement, CardValue[]>) {
    selection.each(function(data) {
      const container = d3.select(this);
      
      // Compute dimensions
      const dims = computeDimensions(container, props);
      
      // Create/update canvas structure
      let canvasEl = container.select<HTMLDivElement>('.cb-canvas');
      
      if (canvasEl.empty()) {
        canvasEl = container.append('div')
          .attr('class', 'cb-canvas')
          .attr('id', props.id)
          .call(createCanvasStructure);
      }
      
      // Update dimensions
      canvasEl
        .style('width', dims.width + 'px')
        .style('height', dims.height + 'px')
        .attr('data-view-type', props.viewType)
        .attr('data-background', props.background);
      
      // Update content area
      const contentArea = canvasEl.select<HTMLDivElement>('.cb-canvas__content');
      contentArea
        .style('padding', `${props.padding.top}px ${props.padding.right}px ${props.padding.bottom}px ${props.padding.left}px`);
      
      // Setup zoom behavior
      if (props.zoomable) {
        setupZoom(canvasEl, contentArea, props);
      } else if (zoomBehavior) {
        canvasEl.on('.zoom', null);
        zoomBehavior = null;
      }
      
      // Store computed dimensions for child components
      canvasEl.datum({ ...data, __dimensions: dims });
    });
    
    return selection;
  }
  
  // Create canvas DOM structure
  function createCanvasStructure(sel: D3Selection<HTMLDivElement, unknown>) {
    // Background layer (dots/grid)
    sel.append('div').attr('class', 'cb-canvas__background');
    
    // Content layer (where cards render)
    sel.append('div').attr('class', 'cb-canvas__content');
    
    // Overlay layer (selections, drag previews)
    sel.append('div').attr('class', 'cb-canvas__overlay');
    
    return sel;
  }
  
  // Compute dimensions
  function computeDimensions(
    container: D3Selection<HTMLElement, unknown>,
    props: CanvasProps
  ): CanvasDimensions {
    const node = container.node();
    const rect = node?.getBoundingClientRect() ?? { width: 800, height: 600 };
    
    const width = props.width === 'auto' ? rect.width : props.width;
    const height = props.height === 'auto' ? rect.height : props.height;
    
    return {
      width,
      height,
      innerWidth: width - props.padding.left - props.padding.right,
      innerHeight: height - props.padding.top - props.padding.bottom,
    };
  }
  
  // Setup zoom behavior
  function setupZoom(
    canvasEl: D3Selection<HTMLDivElement, unknown>,
    contentArea: D3Selection<HTMLDivElement, unknown>,
    props: CanvasProps
  ) {
    zoomBehavior = d3.zoom<HTMLDivElement, unknown>()
      .scaleExtent(props.zoomExtent)
      .on('zoom', (event) => {
        currentTransform = event.transform;
        contentArea.style(
          'transform',
          `translate(${event.transform.x}px, ${event.transform.y}px) scale(${event.transform.k})`
        );
      });
    
    canvasEl.call(zoomBehavior);
  }
  
  // Public methods
  canvas.getContentArea = function(): D3Selection<HTMLDivElement, unknown> | null {
    const el = d3.select(`#${props.id}`);
    return el.empty() ? null : el.select('.cb-canvas__content');
  };
  
  canvas.resetZoom = function(transition = true) {
    const el = d3.select(`#${props.id}`);
    if (!el.empty() && zoomBehavior) {
      const target = transition 
        ? el.transition().duration(300)
        : el;
      target.call(zoomBehavior.transform as any, d3.zoomIdentity);
    }
    return canvas;
  };
  
  canvas.zoomTo = function(scale: number, transition = true) {
    const el = d3.select(`#${props.id}`);
    if (!el.empty() && zoomBehavior) {
      const target = transition 
        ? el.transition().duration(300)
        : el;
      target.call(zoomBehavior.scaleTo as any, scale);
    }
    return canvas;
  };
  
  canvas.getCurrentTransform = function() {
    return currentTransform;
  };
  
  // Fluent API
  const accessors = createAccessors(canvas, props);
  Object.assign(canvas, accessors);
  
  return canvas;
}

export type CbCanvas = ReturnType<typeof cbCanvas>;
```

**Styles**: `src/styles/containers.css` (canvas section)

```css
/* ============================================
   cb-canvas
   ============================================ */

.cb-canvas {
  position: relative;
  overflow: hidden;
  background: var(--cb-bg-base);
  border-radius: var(--cb-radius-lg);
  border: 1px solid var(--cb-border-subtle);
}

/* Background patterns */
.cb-canvas__background {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cb-canvas[data-background="dots"] .cb-canvas__background {
  background-image: radial-gradient(
    circle,
    var(--cb-border-subtle) 1px,
    transparent 1px
  );
  background-size: 24px 24px;
}

.cb-canvas[data-background="grid"] .cb-canvas__background {
  background-image: 
    linear-gradient(var(--cb-border-subtle) 1px, transparent 1px),
    linear-gradient(90deg, var(--cb-border-subtle) 1px, transparent 1px);
  background-size: 24px 24px;
}

.cb-canvas[data-background="solid"] .cb-canvas__background {
  background: var(--cb-bg-raised);
}

/* Content area */
.cb-canvas__content {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
  will-change: transform;
}

/* Overlay (selections, etc.) */
.cb-canvas__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: var(--cb-z-raised);
}

/* View-specific adjustments */
.cb-canvas[data-view-type="network"] {
  cursor: grab;
}

.cb-canvas[data-view-type="network"]:active {
  cursor: grabbing;
}
```

### 2.3 `cb-button` — The Basic Control

**Purpose**: Action trigger with multiple variants matching darwin-ui aesthetics.

**File**: `src/components/controls/cb-button.ts`

```typescript
import * as d3 from 'd3';
import { createAccessors, cx, generateInstanceId } from '../factory';
import type { D3Selection, EventHandler } from '../types';

// ============================================
// Types
// ============================================

export interface ButtonProps {
  /** Button variant */
  variant: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
  /** Size preset */
  size: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth: boolean;
  /** Disabled state */
  disabled: boolean;
  /** Loading state */
  loading: boolean;
  /** Icon position */
  iconPosition: 'left' | 'right' | 'only';
  /** Custom class */
  className: string;
}

export interface ButtonData {
  id: string;
  label: string;
  icon?: string; // SVG path or icon name
}

// ============================================
// Component
// ============================================

export function cbButton() {
  const instanceId = generateInstanceId('button');
  
  const props: ButtonProps = {
    variant: 'secondary',
    size: 'md',
    fullWidth: false,
    disabled: false,
    loading: false,
    iconPosition: 'left',
    className: '',
  };
  
  let onClick: EventHandler<{ id: string }> | null = null;
  
  // Render function
  function button(selection: D3Selection<HTMLElement, ButtonData>) {
    selection.each(function(d) {
      const container = d3.select(this);
      
      // Data join
      const buttonEl = container
        .selectAll<HTMLButtonElement, ButtonData>('.cb-button')
        .data([d], d => d.id)
        .join(
          enter => enter.append('button')
            .attr('type', 'button')
            .call(createButtonStructure),
          update => update,
          exit => exit.remove()
        );
      
      // Update classes
      buttonEl.attr('class', cx('cb-button', {
        [`cb-button--${props.variant}`]: true,
        [`cb-button--${props.size}`]: true,
        'cb-button--full-width': props.fullWidth,
        'cb-button--loading': props.loading,
        'cb-button--icon-only': props.iconPosition === 'only',
      }, props.className ? [props.className] : []));
      
      // Update state
      buttonEl
        .attr('disabled', props.disabled || props.loading ? '' : null)
        .attr('aria-busy', props.loading ? 'true' : null);
      
      // Update content
      updateButtonContent(buttonEl, d, props);
      
      // Bind click
      buttonEl.on('click', (event: MouseEvent) => {
        if (props.disabled || props.loading) return;
        event.stopPropagation();
        onClick?.({ type: 'click', target: d as any, data: { id: d.id } });
      });
    });
    
    return selection;
  }
  
  // Create button structure
  function createButtonStructure(sel: D3Selection<HTMLButtonElement, ButtonData>) {
    sel.append('span').attr('class', 'cb-button__icon cb-button__icon--left');
    sel.append('span').attr('class', 'cb-button__label');
    sel.append('span').attr('class', 'cb-button__icon cb-button__icon--right');
    sel.append('span').attr('class', 'cb-button__spinner');
    return sel;
  }
  
  // Update button content
  function updateButtonContent(
    buttonEl: D3Selection<HTMLButtonElement, ButtonData>,
    d: ButtonData,
    props: ButtonProps
  ) {
    // Label
    const labelEl = buttonEl.select('.cb-button__label');
    if (props.iconPosition === 'only') {
      labelEl.text('').attr('class', 'cb-button__label cb-sr-only');
      labelEl.text(d.label); // For accessibility
    } else {
      labelEl.attr('class', 'cb-button__label').text(d.label);
    }
    
    // Icons
    const leftIcon = buttonEl.select('.cb-button__icon--left');
    const rightIcon = buttonEl.select('.cb-button__icon--right');
    
    if (d.icon) {
      if (props.iconPosition === 'left' || props.iconPosition === 'only') {
        leftIcon.html(getIconSvg(d.icon)).style('display', null);
        rightIcon.style('display', 'none');
      } else {
        rightIcon.html(getIconSvg(d.icon)).style('display', null);
        leftIcon.style('display', 'none');
      }
    } else {
      leftIcon.style('display', 'none');
      rightIcon.style('display', 'none');
    }
    
    // Spinner
    buttonEl.select('.cb-button__spinner')
      .html(props.loading ? getSpinnerSvg() : '');
  }
  
  // Simple icon lookup (expand as needed)
  function getIconSvg(icon: string): string {
    const icons: Record<string, string> = {
      'plus': '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      'check': '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      'x': '<svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      'arrow-right': '<svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    };
    return icons[icon] || '';
  }
  
  function getSpinnerSvg(): string {
    return `<svg class="cb-spinner" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-opacity="0.25"/>
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }
  
  // Fluent API
  const accessors = createAccessors(button, props);
  Object.assign(button, accessors);
  
  button.onClick = function(handler: EventHandler<{ id: string }>) {
    onClick = handler;
    return button;
  };
  
  return button;
}

export type CbButton = ReturnType<typeof cbButton>;
```

**Styles**: `src/styles/controls.css` (button section)

```css
/* ============================================
   cb-button
   ============================================ */

.cb-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--cb-space-2);
  height: var(--cb-button-height-md);
  padding: 0 var(--cb-button-padding-x);
  border: 1px solid transparent;
  border-radius: var(--cb-button-radius);
  font-family: inherit;
  font-size: var(--cb-text-sm);
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: 
    background var(--cb-transition-fast),
    border-color var(--cb-transition-fast),
    color var(--cb-transition-fast),
    box-shadow var(--cb-transition-fast),
    transform var(--cb-transition-fast);
  user-select: none;
  -webkit-user-select: none;
}

.cb-button:focus-visible {
  outline: 2px solid var(--cb-accent);
  outline-offset: 2px;
}

.cb-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Sizes */
.cb-button--sm {
  height: var(--cb-button-height-sm);
  padding: 0 var(--cb-space-3);
  font-size: var(--cb-text-xs);
  border-radius: var(--cb-radius-sm);
}

.cb-button--lg {
  height: var(--cb-button-height-lg);
  padding: 0 var(--cb-space-6);
  font-size: var(--cb-text-base);
}

/* Variants */
.cb-button--primary {
  background: var(--cb-accent);
  color: white;
}

.cb-button--primary:hover:not(:disabled) {
  background: var(--cb-accent-hover);
}

.cb-button--primary:active:not(:disabled) {
  background: var(--cb-accent-active);
  transform: scale(0.98);
}

.cb-button--secondary {
  background: var(--cb-bg-overlay);
  color: var(--cb-fg-primary);
  border-color: var(--cb-border-default);
}

.cb-button--secondary:hover:not(:disabled) {
  background: var(--cb-bg-raised);
  border-color: var(--cb-border-strong);
}

.cb-button--ghost {
  background: transparent;
  color: var(--cb-fg-secondary);
}

.cb-button--ghost:hover:not(:disabled) {
  background: var(--cb-bg-overlay);
  color: var(--cb-fg-primary);
}

.cb-button--outline {
  background: transparent;
  color: var(--cb-accent);
  border-color: var(--cb-accent);
}

.cb-button--outline:hover:not(:disabled) {
  background: color-mix(in srgb, var(--cb-accent) 10%, transparent);
}

.cb-button--danger {
  background: var(--cb-accent-red);
  color: white;
}

.cb-button--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--cb-accent-red) 85%, white);
}

.cb-button--success {
  background: var(--cb-accent-green);
  color: white;
}

.cb-button--success:hover:not(:disabled) {
  background: color-mix(in srgb, var(--cb-accent-green) 85%, white);
}

/* Modifiers */
.cb-button--full-width {
  width: 100%;
}

.cb-button--icon-only {
  width: var(--cb-button-height-md);
  padding: 0;
}

.cb-button--icon-only.cb-button--sm {
  width: var(--cb-button-height-sm);
}

.cb-button--icon-only.cb-button--lg {
  width: var(--cb-button-height-lg);
}

/* Icon */
.cb-button__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.cb-button__icon svg {
  width: 100%;
  height: 100%;
}

/* Loading */
.cb-button--loading .cb-button__label,
.cb-button--loading .cb-button__icon {
  opacity: 0;
}

.cb-button__spinner {
  position: absolute;
  display: none;
}

.cb-button--loading .cb-button__spinner {
  display: flex;
}

.cb-spinner {
  width: 16px;
  height: 16px;
  animation: cb-spin 0.8s linear infinite;
}

@keyframes cb-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

---

## Phase 3: View Components

**Goal**: Implement polymorphic view components that use the same data with different PAFV projections.

### 3.1 View Component Interface

All view components share this interface:

```typescript
// src/components/views/types.ts

import type { CardValue, D3Selection, ViewProjection, LATCHAxis } from '../types';
import type { CbCard } from '../primitives/cb-card';

export interface ViewProps {
  /** LATCH axis projection */
  projection: ViewProjection;
  /** Card component to use for rendering */
  cardComponent: CbCard;
  /** Gap between cards */
  gap: number;
  /** Animate transitions */
  animated: boolean;
}

export interface ViewComponent {
  (selection: D3Selection<HTMLElement, CardValue[]>): D3Selection<HTMLElement, CardValue[]>;
  projection: (value?: ViewProjection) => ViewComponent | ViewProjection;
  cardComponent: (value?: CbCard) => ViewComponent | CbCard;
  gap: (value?: number) => ViewComponent | number;
  animated: (value?: boolean) => ViewComponent | boolean;
}
```

### 3.2 Implementation Order

1. **`cb-grid`** — Grid layout (LATCH separation)
2. **`cb-kanban`** — Kanban columns (Category axis projection)
3. **`cb-timeline`** — Timeline (Time axis projection)
4. **`cb-network`** — Force-directed graph (GRAPH connection)

Each view uses the same `cb-card` component but positions cards according to its projection.

---

## Phase 4: Integration

### 4.1 Component Registry (`src/components/index.ts`)

```typescript
// Primitives
export { cbCard } from './primitives/cb-card';
export type { CbCard, CardProps, CardEvents } from './primitives/cb-card';

export { cbBadge } from './primitives/cb-badge';
export { cbAvatar } from './primitives/cb-avatar';
export { cbIcon } from './primitives/cb-icon';

// Controls
export { cbButton } from './controls/cb-button';
export type { CbButton, ButtonProps } from './controls/cb-button';

export { cbInput } from './controls/cb-input';
export { cbSelect } from './controls/cb-select';
export { cbToggle } from './controls/cb-toggle';
export { cbSlider } from './controls/cb-slider';

// Containers
export { cbCanvas } from './containers/cb-canvas';
export type { CbCanvas, CanvasProps } from './containers/cb-canvas';

export { cbWindow } from './containers/cb-window';
export { cbPanel } from './containers/cb-panel';
export { cbToolbar } from './containers/cb-toolbar';

// Views
export { cbGrid } from './views/cb-grid';
export { cbKanban } from './views/cb-kanban';
export { cbTimeline } from './views/cb-timeline';
export { cbNetwork } from './views/cb-network';

// Types
export * from './types';

// Utilities
export * from './factory';
```

### 4.2 Usage Example

```typescript
import * as d3 from 'd3';
import { cbCanvas, cbCard, cbButton } from './components';
import type { CardValue } from './components';

// Initialize components
const canvas = cbCanvas()
  .viewType('grid')
  .projection({ xAxis: 'category', yAxis: 'time' })
  .zoomable(true);

const card = cbCard()
  .variant('glass')
  .interactive(true)
  .on('select', (e) => console.log('Selected:', e.data.id));

// Fetch data from SQLite
const cards: CardValue[] = await fetchCardsFromSQLite();

// Render
d3.select('#app')
  .datum(cards)
  .call(canvas);

// Render cards into canvas
canvas.getContentArea()!
  .selectAll('.card-wrapper')
  .data(cards, d => d.id)
  .join('div')
    .attr('class', 'card-wrapper')
    .call(card);
```

---

## Testing Strategy

### Unit Tests (Vitest)

Each component has a corresponding `.test.ts` file:

```typescript
// src/components/primitives/cb-card.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as d3 from 'd3';
import { JSDOM } from 'jsdom';
import { cbCard } from './cb-card';
import type { NodeValue } from '../types';

describe('cbCard', () => {
  let container: HTMLElement;
  
  const mockNode: NodeValue = {
    id: 'test-1',
    type: 'node',
    nodeType: 'Task',
    name: 'Test Card',
    content: 'Test content',
    createdAt: new Date(),
    updatedAt: new Date(),
    properties: {},
    latch: { category: 'Work' },
  };
  
  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>');
    container = dom.window.document.getElementById('root')!;
  });
  
  it('should create a card element', () => {
    const card = cbCard();
    
    d3.select(container)
      .datum(mockNode)
      .call(card);
    
    const cardEl = container.querySelector('.cb-card');
    expect(cardEl).not.toBeNull();
  });
  
  it('should apply variant class', () => {
    const card = cbCard().variant('glass');
    
    d3.select(container)
      .datum(mockNode)
      .call(card);
    
    const cardEl = container.querySelector('.cb-card');
    expect(cardEl?.classList.contains('cb-card--glass')).toBe(true);
  });
  
  it('should display title from node name', () => {
    const card = cbCard();
    
    d3.select(container)
      .datum(mockNode)
      .call(card);
    
    const titleEl = container.querySelector('.cb-card__title');
    expect(titleEl?.textContent).toBe('Test Card');
  });
  
  it('should show badge when category is present', () => {
    const card = cbCard().showBadge(true);
    
    d3.select(container)
      .datum(mockNode)
      .call(card);
    
    const badgeEl = container.querySelector('.cb-card__badge');
    expect(badgeEl?.textContent).toBe('Work');
  });
  
  it('should fire select event on click', () => {
    const onSelect = vi.fn();
    const card = cbCard()
      .interactive(true)
      .on('select', onSelect);
    
    d3.select(container)
      .datum(mockNode)
      .call(card);
    
    const cardEl = container.querySelector('.cb-card') as HTMLElement;
    cardEl.click();
    
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'select',
        data: { id: 'test-1', selected: true }
      })
    );
  });
  
  it('should update when data changes', () => {
    const card = cbCard();
    const sel = d3.select(container);
    
    sel.datum(mockNode).call(card);
    expect(container.querySelector('.cb-card__title')?.textContent).toBe('Test Card');
    
    sel.datum({ ...mockNode, name: 'Updated Card' }).call(card);
    expect(container.querySelector('.cb-card__title')?.textContent).toBe('Updated Card');
  });
  
  it('should handle getter/setter pattern', () => {
    const card = cbCard();
    
    // Setter returns component (chainable)
    expect(card.variant('elevated')).toBe(card);
    
    // Getter returns value
    expect(card.variant()).toBe('elevated');
  });
});
```

### E2E Tests (Playwright)

Test full rendering and interaction flows:

```typescript
// tests/e2e/card-interactions.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Card Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-harness');
  });
  
  test('card hover shows elevation', async ({ page }) => {
    const card = page.locator('.cb-card').first();
    
    await card.hover();
    
    await expect(card).toHaveCSS('transform', /translateY\(-2px\)/);
  });
  
  test('card selection toggles state', async ({ page }) => {
    const card = page.locator('.cb-card').first();
    
    await card.click();
    await expect(card).toHaveClass(/cb-card--selected/);
    
    await card.click();
    await expect(card).not.toHaveClass(/cb-card--selected/);
  });
  
  test('keyboard navigation works', async ({ page }) => {
    const card = page.locator('.cb-card').first();
    
    await card.focus();
    await page.keyboard.press('Enter');
    
    await expect(card).toHaveClass(/cb-card--selected/);
  });
});
```

---

## Implementation Checklist

### Phase 1: Foundation ✅ (Week 1)

- [ ] Set up project structure
- [ ] Create `src/components/types.ts`
- [ ] Create `src/components/factory.ts`
- [ ] Create `src/styles/variables.css`
- [ ] Create `src/styles/index.css`
- [ ] Configure build (tsup/esbuild)
- [ ] Configure Vitest for unit tests
- [ ] Write initial type tests

### Phase 2: Core Components (Week 2-3)

- [ ] **cb-card**
  - [ ] Implement component
  - [ ] Write styles
  - [ ] Write unit tests (80% coverage)
  - [ ] Test with sample data

- [ ] **cb-canvas**
  - [ ] Implement component
  - [ ] Write styles
  - [ ] Implement zoom behavior
  - [ ] Write unit tests

- [ ] **cb-button**
  - [ ] Implement component
  - [ ] Write styles (all variants)
  - [ ] Write unit tests

### Phase 3: View Components (Week 4-5)

- [ ] **cb-grid** — Grid layout view
- [ ] **cb-kanban** — Kanban columns view
- [ ] **cb-timeline** — Timeline view
- [ ] **cb-network** — Force graph view

### Phase 4: Extended Components (Week 6+)

- [ ] **Primitives**: cb-badge, cb-avatar, cb-icon
- [ ] **Controls**: cb-input, cb-select, cb-toggle, cb-slider
- [ ] **Containers**: cb-window, cb-panel, cb-toolbar
- [ ] **Overlays**: cb-modal, cb-tooltip, cb-popover, cb-contextmenu

### Ongoing

- [ ] Integration with SQLite data layer
- [ ] Performance profiling
- [ ] Accessibility audit
- [ ] Documentation site

---

## Dependencies

```json
{
  "dependencies": {
    "d3": "^7.9.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "jsdom": "^23.0.0",
    "@playwright/test": "^1.40.0",
    "tsup": "^8.0.0"
  }
}
```

---

## Summary

This plan establishes a darwin-ui–inspired component system built on D3.js data binding patterns. Key architectural decisions:

1. **Factory + Closure + Fluent API** — Components follow D3's reusable chart pattern
2. **CSS Custom Properties** — Theming via variables, darwin-inspired glass aesthetic
3. **PAFV Alignment** — Components map to Planes/Axes/Facets/Values
4. **TDD Approach** — Tests accompany every component
5. **Polymorphic Views** — Same data, multiple projections via view components

Start with Phase 1 (foundation), then implement the three core components in Phase 2. The view components in Phase 3 tie everything together with CardBoard's polymorphic rendering vision.
