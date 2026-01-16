/**
 * cb-button - The Basic Control
 *
 * Action trigger with multiple variants matching darwin-ui aesthetics.
 * Establishes interaction patterns for CardBoard controls.
 *
 * @example
 * ```ts
 * const button = cbButton()
 *   .variant('primary')
 *   .size('md')
 *   .onClick((e) => console.log('Clicked:', e.data.id));
 *
 * d3.select('#toolbar')
 *   .selectAll('.button-wrapper')
 *   .data(buttons)
 *   .join('div')
 *   .call(button);
 * ```
 */

import * as d3 from 'd3';
import {
  createAccessors,
  cx,
  generateInstanceId,
  getIconSvg,
  getSpinnerSvg,
  keyById,
  type IconName,
} from '../factory';
import type { ButtonVariant, D3Selection, EventHandler, Size } from '../types';

// ============================================
// Types
// ============================================

export interface ButtonProps {
  /** Button variant */
  variant: ButtonVariant;
  /** Size preset */
  size: Size;
  /** Full width */
  fullWidth: boolean;
  /** Disabled state */
  disabled: boolean;
  /** Loading state (shows spinner) */
  loading: boolean;
  /** Icon position relative to label */
  iconPosition: 'left' | 'right' | 'only';
  /** Icon size override */
  iconSize: number;
  /** Button type attribute */
  type: 'button' | 'submit' | 'reset';
  /** Custom class names */
  className: string;
}

export interface ButtonData {
  /** Unique identifier */
  id: string;
  /** Button label text */
  label: string;
  /** Icon name (from factory icons) or custom SVG */
  icon?: IconName | string;
  /** Tooltip text */
  title?: string;
}

export interface ButtonEventData {
  id: string;
}

// ============================================
// Default Props
// ============================================

const defaultProps: ButtonProps = {
  variant: 'secondary',
  size: 'md',
  fullWidth: false,
  disabled: false,
  loading: false,
  iconPosition: 'left',
  iconSize: 16,
  type: 'button',
  className: '',
};

// Icon sizes by button size
const iconSizeMap: Record<Size, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

// ============================================
// Component
// ============================================

export function cbButton() {
  // Private state
  const instanceId = generateInstanceId('button');
  const props: ButtonProps = { ...defaultProps };

  let onClick: EventHandler<ButtonEventData> | null = null;
  let onFocus: EventHandler<ButtonEventData> | null = null;
  let onBlur: EventHandler<ButtonEventData> | null = null;

  // Render function
  function button(
    selection: D3Selection<HTMLElement, ButtonData, HTMLElement, unknown>,
  ): D3Selection<HTMLElement, ButtonData, HTMLElement, unknown> {
    selection.each(function (d) {
      const container = d3.select(this);

      // Data join
      const buttonEl = container
        .selectAll<HTMLButtonElement, ButtonData>('.cb-button')
        .data([d], keyById)
        .join(
          // ENTER
          (enter) =>
            enter
              .append('button')
              .attr('data-button-id', (d) => d.id)
              .call(createButtonStructure),
          // UPDATE
          (update) => update,
          // EXIT
          (exit) => exit.remove(),
        );

      // Update classes
      const className = cx(
        'cb-button',
        {
          [props.variant]: true,
          [props.size]: true,
          'full-width': props.fullWidth,
          loading: props.loading,
          'icon-only': props.iconPosition === 'only',
        },
        props.className ? [props.className] : [],
      );
      buttonEl.attr('class', className);

      // Update attributes
      buttonEl
        .attr('type', props.type)
        .attr('disabled', props.disabled || props.loading ? '' : null)
        .attr('aria-busy', props.loading ? 'true' : null)
        .attr('aria-disabled', props.disabled ? 'true' : null)
        .attr('title', d.title || null);

      // Update content
      updateButtonContent(buttonEl, d, props);

      // Bind events
      bindButtonEvents(buttonEl, d);
    });

    return selection;
  }

  // ============================================
  // Internal Functions
  // ============================================

  /**
   * Create button DOM structure
   */
  function createButtonStructure(
    sel: D3Selection<HTMLButtonElement, ButtonData, HTMLElement, unknown>,
  ): D3Selection<HTMLButtonElement, ButtonData, HTMLElement, unknown> {
    // Left icon slot
    sel.append('span').attr('class', 'cb-button__icon cb-button__icon--left');

    // Label slot
    sel.append('span').attr('class', 'cb-button__label');

    // Right icon slot
    sel.append('span').attr('class', 'cb-button__icon cb-button__icon--right');

    // Spinner slot (for loading state)
    sel.append('span').attr('class', 'cb-button__spinner');

    return sel;
  }

  /**
   * Update button content
   */
  function updateButtonContent(
    buttonEl: D3Selection<HTMLButtonElement, ButtonData, HTMLElement, unknown>,
    d: ButtonData,
    props: ButtonProps,
  ): void {
    const iconSize = props.iconSize || iconSizeMap[props.size];

    // Label
    const labelEl = buttonEl.select('.cb-button__label');
    if (props.iconPosition === 'only') {
      // Screen reader only for icon-only buttons
      labelEl.attr('class', 'cb-button__label cb-sr-only').text(d.label);
    } else {
      labelEl.attr('class', 'cb-button__label').text(d.label);
    }

    // Icons
    const leftIcon = buttonEl.select('.cb-button__icon--left');
    const rightIcon = buttonEl.select('.cb-button__icon--right');

    // Clear both first
    leftIcon.html('').style('display', 'none');
    rightIcon.html('').style('display', 'none');

    if (d.icon) {
      const iconHtml = resolveIcon(d.icon, iconSize);

      if (props.iconPosition === 'left' || props.iconPosition === 'only') {
        leftIcon.html(iconHtml).style('display', null);
      } else if (props.iconPosition === 'right') {
        rightIcon.html(iconHtml).style('display', null);
      }
    }

    // Spinner (only visible when loading)
    const spinnerEl = buttonEl.select('.cb-button__spinner');
    spinnerEl.html(props.loading ? getSpinnerSvg(iconSize) : '');
  }

  /**
   * Resolve icon name to SVG markup
   */
  function resolveIcon(icon: string, size: number): string {
    // If it starts with '<', assume it's raw SVG
    if (icon.startsWith('<')) {
      return icon;
    }
    // Otherwise, look up in icon map
    return getIconSvg(icon as IconName, size);
  }

  /**
   * Bind event handlers
   */
  function bindButtonEvents(
    buttonEl: D3Selection<HTMLButtonElement, ButtonData, HTMLElement, unknown>,
    d: ButtonData,
  ): void {
    buttonEl.on('click', function (event: MouseEvent) {
      if (props.disabled || props.loading) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      onClick?.({
        type: 'click',
        target: d as any,
        data: { id: d.id },
        originalEvent: event,
      });
    });

    buttonEl.on('focus', function (event: FocusEvent) {
      onFocus?.({
        type: 'focus',
        target: d as any,
        data: { id: d.id },
        originalEvent: event,
      });
    });

    buttonEl.on('blur', function (event: FocusEvent) {
      onBlur?.({
        type: 'blur',
        target: d as any,
        data: { id: d.id },
        originalEvent: event,
      });
    });

    // Prevent default on disabled state
    buttonEl.on('keydown', function (event: KeyboardEvent) {
      if (props.disabled || props.loading) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
        }
      }
    });
  }

  // ============================================
  // Fluent API
  // ============================================

  const accessors = createAccessors(button, props);
  Object.assign(button, accessors);

  // Event handlers
  button.onClick = function (
    handler: EventHandler<ButtonEventData> | null,
  ): typeof button {
    onClick = handler;
    return button;
  };

  button.onFocus = function (
    handler: EventHandler<ButtonEventData> | null,
  ): typeof button {
    onFocus = handler;
    return button;
  };

  button.onBlur = function (
    handler: EventHandler<ButtonEventData> | null,
  ): typeof button {
    onBlur = handler;
    return button;
  };

  // Instance ID getter
  button.instanceId = function (): string {
    return instanceId;
  };

  return button;
}

export type CbButton = ReturnType<typeof cbButton>;
