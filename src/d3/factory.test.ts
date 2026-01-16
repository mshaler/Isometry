/**
 * Factory Utilities Tests
 *
 * TDD tests for D3 component factory utilities adapted from CardBoard.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAccessor,
  createAccessors,
  generateInstanceId,
  resetInstanceCounter,
  transitions,
  cx,
  mergeClasses,
  keyById,
  keyByProps,
  debounce,
  throttle,
  icons,
  getIconSvg,
} from './factory';

describe('createAccessor', () => {
  it('returns current value when called without arguments', () => {
    const props = { width: 100 };
    const component = {};
    const accessor = createAccessor(component, props, 'width');

    expect(accessor()).toBe(100);
  });

  it('sets value and returns component for chaining when called with argument', () => {
    const props = { width: 100 };
    const component = { name: 'test' };
    const accessor = createAccessor(component, props, 'width');

    const result = accessor(200);

    expect(result).toBe(component);
    expect(props.width).toBe(200);
    expect(accessor()).toBe(200);
  });

  it('supports chaining multiple accessors', () => {
    const props = { width: 100, height: 50 };
    const component: Record<string, unknown> = {};
    component.width = createAccessor(component, props, 'width');
    component.height = createAccessor(component, props, 'height');

    const widthFn = component.width as (val?: number) => typeof component | number;
    const heightFn = component.height as (val?: number) => typeof component | number;

    const result = widthFn(200);
    expect(result).toBe(component);

    heightFn(100);
    expect(widthFn()).toBe(200);
    expect(heightFn()).toBe(100);
  });
});

describe('createAccessors', () => {
  it('creates accessors for all props', () => {
    const props = { width: 100, height: 50, enabled: true };
    const component: Record<string, unknown> = {};
    const accessors = createAccessors(component, props);

    expect(typeof accessors.width).toBe('function');
    expect(typeof accessors.height).toBe('function');
    expect(typeof accessors.enabled).toBe('function');
  });

  it('accessors work correctly', () => {
    const props = { width: 100, height: 50 };
    const component: Record<string, unknown> = {};
    const accessors = createAccessors(component, props);

    expect(accessors.width()).toBe(100);
    accessors.width(200);
    expect(accessors.width()).toBe(200);
  });
});

describe('generateInstanceId', () => {
  beforeEach(() => {
    resetInstanceCounter();
  });

  it('generates unique IDs with default prefix', () => {
    const id1 = generateInstanceId();
    const id2 = generateInstanceId();

    expect(id1).toMatch(/^cb-\d+-[a-z0-9]+$/);
    expect(id2).toMatch(/^cb-\d+-[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it('uses custom prefix when provided', () => {
    const id = generateInstanceId('card');

    expect(id).toMatch(/^card-\d+-[a-z0-9]+$/);
  });

  it('increments counter for each call', () => {
    const id1 = generateInstanceId();
    const id2 = generateInstanceId();

    // Extract counter from IDs (format: prefix-counter-timestamp)
    const counter1 = parseInt(id1.split('-')[1]);
    const counter2 = parseInt(id2.split('-')[1]);

    expect(counter2).toBe(counter1 + 1);
  });
});

describe('transitions', () => {
  it('has fast transition preset', () => {
    expect(transitions.fast).toEqual({
      duration: 150,
      ease: expect.any(Function),
    });
  });

  it('has normal transition preset', () => {
    expect(transitions.normal).toEqual({
      duration: 300,
      ease: expect.any(Function),
    });
  });

  it('has slow transition preset', () => {
    expect(transitions.slow).toEqual({
      duration: 500,
      ease: expect.any(Function),
    });
  });

  it('has spring transition preset', () => {
    expect(transitions.spring).toEqual({
      duration: 400,
      ease: expect.any(Function),
    });
  });

  it('has none transition preset', () => {
    expect(transitions.none).toEqual({
      duration: 0,
      ease: expect.any(Function),
    });
  });
});

describe('cx (class name builder)', () => {
  it('returns base class alone', () => {
    expect(cx('cb-card')).toBe('cb-card');
  });

  it('adds modifier classes when true', () => {
    expect(cx('cb-card', { glass: true })).toBe('cb-card cb-card--glass');
  });

  it('ignores modifier classes when false', () => {
    expect(cx('cb-card', { glass: false, selected: true })).toBe(
      'cb-card cb-card--selected'
    );
  });

  it('ignores undefined modifiers', () => {
    expect(cx('cb-card', { glass: undefined, selected: true })).toBe(
      'cb-card cb-card--selected'
    );
  });

  it('adds extra classes', () => {
    expect(cx('cb-card', {}, ['custom-class', 'another'])).toBe(
      'cb-card custom-class another'
    );
  });

  it('combines modifiers and extras', () => {
    expect(cx('cb-card', { glass: true }, ['custom'])).toBe(
      'cb-card cb-card--glass custom'
    );
  });

  it('filters empty strings from extras', () => {
    expect(cx('cb-card', {}, ['custom', '', 'another'])).toBe(
      'cb-card custom another'
    );
  });
});

describe('mergeClasses', () => {
  it('merges string classes', () => {
    expect(mergeClasses('foo bar', 'baz')).toBe('foo bar baz');
  });

  it('merges array classes', () => {
    expect(mergeClasses(['foo', 'bar'], ['baz'])).toBe('foo bar baz');
  });

  it('handles mixed inputs', () => {
    expect(mergeClasses('foo', ['bar', 'baz'], 'qux')).toBe('foo bar baz qux');
  });

  it('deduplicates classes', () => {
    expect(mergeClasses('foo bar', 'bar baz')).toBe('foo bar baz');
  });

  it('handles undefined inputs', () => {
    expect(mergeClasses('foo', undefined, 'bar')).toBe('foo bar');
  });
});

describe('keyById', () => {
  it('returns id property', () => {
    expect(keyById({ id: 'test-123', name: 'Test' })).toBe('test-123');
  });
});

describe('keyByProps', () => {
  it('combines multiple properties', () => {
    const keyFn = keyByProps<{ id: string; type: string }>('id', 'type');
    expect(keyFn({ id: '123', type: 'node' })).toBe('123-node');
  });

  it('works with single property', () => {
    const keyFn = keyByProps<{ name: string }>('name');
    expect(keyFn({ name: 'test' })).toBe('test');
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('delays function execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets delay on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to the function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('executes immediately on first call', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignores calls within limit period', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows call after limit period', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    vi.advanceTimersByTime(100);
    throttled();

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('icons', () => {
  it('contains standard icon paths', () => {
    expect(icons.plus).toBeDefined();
    expect(icons.minus).toBeDefined();
    expect(icons.check).toBeDefined();
    expect(icons.x).toBeDefined();
    expect(icons.chevronDown).toBeDefined();
    expect(icons.chevronRight).toBeDefined();
  });

  it('icon paths are valid SVG path strings', () => {
    expect(icons.plus).toContain('<path');
    expect(icons.check).toContain('stroke=');
  });
});

describe('getIconSvg', () => {
  it('returns SVG markup with default size', () => {
    const svg = getIconSvg('plus');

    expect(svg).toContain('<svg');
    expect(svg).toContain('width="16"');
    expect(svg).toContain('height="16"');
    expect(svg).toContain(icons.plus);
  });

  it('uses custom size', () => {
    const svg = getIconSvg('check', 24);

    expect(svg).toContain('width="24"');
    expect(svg).toContain('height="24"');
  });

  it('returns empty string for unknown icon', () => {
    // @ts-expect-error - testing invalid input
    expect(getIconSvg('nonexistent')).toBe('');
  });
});
