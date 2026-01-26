/**
 * useD3DataBinding Hook
 *
 * Manages D3 data binding lifecycle with enter/update/exit transitions.
 * Provides helpers for common data join patterns.
 */

import { useCallback, useRef } from 'react';
import * as d3 from 'd3';
import { TRANSITION_DURATIONS } from '../hooks';

// ============================================
// Types
// ============================================

export interface DataBindingOptions<TElement extends d3.BaseType, TDatum> {
  /** CSS class for the data elements */
  className: string;
  /** Key function for data join */
  key?: (d: TDatum, _i: number) => string;
  /** Enter selection handler */
  onEnter?: (
    enter: d3.Selection<d3.EnterElement, TDatum, TElement, unknown>
  ) => d3.Selection<TElement, TDatum, TElement, unknown>;
  /** Update selection handler */
  onUpdate?: (
    update: d3.Selection<TElement, TDatum, TElement, unknown>
  ) => d3.Selection<TElement, TDatum, TElement, unknown>;
  /** Exit selection handler */
  onExit?: (exit: d3.Selection<TElement, TDatum, TElement, unknown>) => void;
  /** Transition duration for enter */
  enterDuration?: number;
  /** Transition duration for update */
  updateDuration?: number;
  /** Transition duration for exit */
  exitDuration?: number;
}

export interface DataBindingResult<TElement extends d3.BaseType, TDatum> {
  /** Bind data to the container */
  bind: (
    container: d3.Selection<d3.BaseType, unknown, null, undefined>,
    data: TDatum[]
  ) => d3.Selection<TElement, TDatum, d3.BaseType, unknown>;
  /** Get the current selection */
  getSelection: () => d3.Selection<TElement, TDatum, d3.BaseType, unknown> | null;
  /** Clear all bound elements */
  clear: (container: d3.Selection<d3.BaseType, unknown, null, undefined>) => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useD3DataBinding<TElement extends d3.BaseType, TDatum>(
  options: DataBindingOptions<TElement, TDatum>
): DataBindingResult<TElement, TDatum> {
  const {
    className,
    key = (_d, i) => String(i),
    onEnter,
    onUpdate,
    onExit,
    enterDuration = TRANSITION_DURATIONS.slow,
    updateDuration = TRANSITION_DURATIONS.normal,
    exitDuration = TRANSITION_DURATIONS.normal,
  } = options;

  const selectionRef = useRef<d3.Selection<TElement, TDatum, d3.BaseType, unknown> | null>(null);

  const bind = useCallback(
    (
      container: d3.Selection<d3.BaseType, unknown, null, undefined>,
      data: TDatum[]
    ): d3.Selection<TElement, TDatum, d3.BaseType, unknown> => {
      const selection = container
        .selectAll<TElement, TDatum>(`.${className}`)
        .data(data, key as (datum: TDatum, _index: number, groups: ArrayLike<TElement>) => string)
        .join(
          (enter) => {
            const entered = onEnter
              ? onEnter(enter)
              : (enter.append('g').attr('class', className) as d3.Selection<TElement, TDatum, TElement, unknown>);

            // Apply enter transition
            entered.style('opacity', 0).transition().duration(enterDuration).style('opacity', 1);

            return entered;
          },
          (update) => {
            if (onUpdate) {
              return onUpdate(update);
            }
            return update.transition().duration(updateDuration);
          },
          (exit) => {
            if (onExit) {
              onExit(exit);
            } else {
              exit.transition().duration(exitDuration).style('opacity', 0).remove();
            }
            return exit;
          }
        );

      selectionRef.current = selection;
      return selection;
    },
    [className, key, onEnter, onUpdate, onExit, enterDuration, updateDuration, exitDuration]
  );

  const getSelection = useCallback(() => selectionRef.current, []);

  const clear = useCallback(
    (container: d3.Selection<d3.BaseType, unknown, null, undefined>) => {
      container.selectAll(`.${className}`).remove();
      selectionRef.current = null;
    },
    [className]
  );

  return { bind, getSelection, clear };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Standard enter handler for group elements with fade-in.
 */
export function defaultGroupEnter<TDatum>(className: string) {
  return (enter: d3.Selection<d3.EnterElement, TDatum, d3.BaseType, unknown>) =>
    enter.append('g').attr('class', className);
}

/**
 * Standard enter handler for rect elements.
 */
export function defaultRectEnter<TDatum>(className: string) {
  return (enter: d3.Selection<d3.EnterElement, TDatum, d3.BaseType, unknown>) =>
    enter.append('rect').attr('class', className);
}

/**
 * Standard enter handler for circle elements.
 */
export function defaultCircleEnter<TDatum>(className: string) {
  return (enter: d3.Selection<d3.EnterElement, TDatum, d3.BaseType, unknown>) =>
    enter.append('circle').attr('class', className);
}

/**
 * Standard enter handler for text elements.
 */
export function defaultTextEnter<TDatum>(className: string) {
  return (enter: d3.Selection<d3.EnterElement, TDatum, d3.BaseType, unknown>) =>
    enter.append('text').attr('class', className);
}

export default useD3DataBinding;
