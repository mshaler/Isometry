/**
 * CardBoard Component System - Factory Utilities
 *
 * Core utilities for building D3 components with the reusable chart pattern.
 * Provides getter/setter generation, transitions, and DOM helpers.
 */

import * as d3 from 'd3';
import type { D3Selection, D3Transition } from './types';

// ============================================
// Accessor Factory
// ============================================

/**
 * Creates a getter/setter method for a component property.
 * Follows D3's fluent API pattern:
 * - component.prop() returns current value
 * - component.prop(value) sets value and returns component for chaining
 *
 * @example
 * ```ts
 * const props = { width: 100 };
 * component.width = createAccessor(component, props, 'width');
 * component.width(200).height(100); // chainable
 * component.width(); // returns 200
 * ```
 */
export function createAccessor<TComponent, TValue>(
  component: TComponent,
  props: Record<string, unknown>,
  key: string,
): {
  (): TValue;
  (value: TValue): TComponent;
} {
  function accessor(): TValue;
  function accessor(value: TValue): TComponent;
  function accessor(value?: TValue): TValue | TComponent {
    if (arguments.length === 0) {
      return props[key] as TValue;
    }
    props[key] = value;
    return component;
  }
  return accessor;
}

/**
 * Creates multiple accessors for a component from a props object.
 * Each key in props gets a corresponding getter/setter method.
 */
export function createAccessors<TComponent, TProps extends Record<string, unknown>>(
  component: TComponent,
  props: TProps,
): {
  [K in keyof TProps]: {
    (): TProps[K];
    (value: TProps[K]): TComponent;
  };
} {
  const accessors = {} as {
    [K in keyof TProps]: {
      (): TProps[K];
      (value: TProps[K]): TComponent;
    };
  };

  for (const key of Object.keys(props) as (keyof TProps)[]) {
    accessors[key] = createAccessor(component, props, key as string);
  }

  return accessors;
}

// ============================================
// Instance ID Generation
// ============================================

let instanceCounter = 0;

/**
 * Generates a unique ID for component instances.
 * Format: {prefix}-{counter}-{timestamp}
 */
export function generateInstanceId(prefix: string = 'cb'): string {
  return `${prefix}-${++instanceCounter}-${Date.now().toString(36)}`;
}

/**
 * Resets the instance counter (useful for testing)
 */
export function resetInstanceCounter(): void {
  instanceCounter = 0;
}

// ============================================
// Transitions
// ============================================

/** Standard transition configurations */
export const transitions = {
  /** Fast transitions (150ms) - hover states, quick feedback */
  fast: { duration: 150, ease: d3.easeCubicOut },
  /** Normal transitions (300ms) - default for most animations */
  normal: { duration: 300, ease: d3.easeCubicInOut },
  /** Slow transitions (500ms) - emphasis, page transitions */
  slow: { duration: 500, ease: d3.easeCubicInOut },
  /** Spring transitions (400ms) - playful, bouncy feedback */
  spring: { duration: 400, ease: d3.easeElasticOut.amplitude(1).period(0.4) },
  /** No transition - immediate */
  none: { duration: 0, ease: d3.easeLinear },
} as const;

export type TransitionPreset = keyof typeof transitions;

/**
 * Apply standard enter transition (fade in)
 */
export function enterTransition<GElement extends d3.BaseType, Datum>(
  selection: D3Selection<GElement, Datum>,
  preset: TransitionPreset = 'normal',
): D3Transition<GElement, Datum> {
  const { duration, ease } = transitions[preset];
  return selection
    .style('opacity', 0)
    .transition()
    .duration(duration)
    .ease(ease)
    .style('opacity', 1) as D3Transition<GElement, Datum>;
}

/**
 * Apply standard exit transition (fade out and remove)
 */
export function exitTransition<GElement extends d3.BaseType, Datum>(
  selection: D3Selection<GElement, Datum>,
  preset: TransitionPreset = 'fast',
): D3Transition<GElement, Datum> {
  const { duration, ease } = transitions[preset];
  return selection
    .transition()
    .duration(duration)
    .ease(ease)
    .style('opacity', 0)
    .remove() as D3Transition<GElement, Datum>;
}

/**
 * Apply scale transition (grow/shrink)
 */
export function scaleTransition<GElement extends d3.BaseType, Datum>(
  selection: D3Selection<GElement, Datum>,
  fromScale: number,
  toScale: number,
  preset: TransitionPreset = 'normal',
): D3Transition<GElement, Datum> {
  const { duration, ease } = transitions[preset];
  return selection
    .style('transform', `scale(${fromScale})`)
    .transition()
    .duration(duration)
    .ease(ease)
    .style('transform', `scale(${toScale})`) as D3Transition<GElement, Datum>;
}

/**
 * Create a named transition for coordination
 */
export function namedTransition<GElement extends d3.BaseType, Datum>(
  selection: D3Selection<GElement, Datum>,
  name: string,
  preset: TransitionPreset = 'normal',
): D3Transition<GElement, Datum> {
  const { duration, ease } = transitions[preset];
  return selection.transition(name).duration(duration).ease(ease) as D3Transition<
    GElement,
    Datum
  >;
}

// ============================================
// Event Dispatcher
// ============================================

/**
 * Create a D3 dispatch object for component events
 */
export function createDispatcher<TEvents extends string>(
  ...eventTypes: TEvents[]
): d3.Dispatch<object> {
  return d3.dispatch(...eventTypes);
}

// ============================================
// Class Name Utilities
// ============================================

/**
 * Build class names with BEM-like conventions.
 * Supports base class, modifiers (conditionally applied), and extras.
 *
 * @example
 * ```ts
 * cx('cb-card', { glass: true, selected: false }, ['custom-class'])
 * // Returns: 'cb-card cb-card--glass custom-class'
 * ```
 */
export function cx(
  base: string,
  modifiers: Record<string, boolean | undefined> = {},
  extras: string[] = [],
): string {
  const classes = [base];

  for (const [modifier, active] of Object.entries(modifiers)) {
    if (active) {
      classes.push(`${base}--${modifier}`);
    }
  }

  return [...classes, ...extras.filter(Boolean)].join(' ');
}

/**
 * Parse a class string into an array
 */
export function parseClasses(classString: string): string[] {
  return classString.split(/\s+/).filter(Boolean);
}

/**
 * Merge multiple class sources
 */
export function mergeClasses(...sources: (string | string[] | undefined)[]): string {
  const classes: string[] = [];

  for (const source of sources) {
    if (typeof source === 'string') {
      classes.push(...parseClasses(source));
    } else if (Array.isArray(source)) {
      classes.push(...source.filter(Boolean));
    }
  }

  return [...new Set(classes)].join(' ');
}

// ============================================
// DOM Utilities
// ============================================

/**
 * Get computed dimensions of an element
 */
export function getElementDimensions(
  element: Element | null,
): { width: number; height: number } {
  if (!element) {
    return { width: 0, height: 0 };
  }

  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

/**
 * Check if an element is visible in the viewport
 */
export function isElementInViewport(element: Element | null): boolean {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================
// Data Utilities
// ============================================

/**
 * Standard key function for D3 data joins.
 * Uses the `id` property of CardValue.
 */
export function keyById<T extends { id: string }>(d: T): string {
  return d.id;
}

/**
 * Create a key function that combines multiple properties
 */
export function keyByProps<T>(...props: (keyof T)[]): (d: T) => string {
  return (d: T) => props.map((p) => String(d[p])).join('-');
}

// ============================================
// SVG Icon Utilities
// ============================================

/** Common icon paths */
export const icons = {
  plus: '<path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  minus:
    '<path d="M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  check:
    '<path d="M3 8l4 4 6-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  x: '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  chevronDown:
    '<path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  chevronRight:
    '<path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  arrowRight:
    '<path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  search:
    '<circle cx="7" cy="7" r="4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M10 10l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  menu: '<path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  grip: '<circle cx="5" cy="4" r="1" fill="currentColor"/><circle cx="11" cy="4" r="1" fill="currentColor"/><circle cx="5" cy="8" r="1" fill="currentColor"/><circle cx="11" cy="8" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="11" cy="12" r="1" fill="currentColor"/>',
} as const;

export type IconName = keyof typeof icons;

/**
 * Get SVG markup for an icon
 */
export function getIconSvg(name: IconName, size: number = 16): string {
  const path = icons[name];
  if (!path) return '';

  return `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none">${path}</svg>`;
}

/**
 * Get spinner SVG markup
 */
export function getSpinnerSvg(size: number = 16): string {
  return `<svg class="cb-spinner" viewBox="0 0 16 16" width="${size}" height="${size}" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-opacity="0.25"/>
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}
