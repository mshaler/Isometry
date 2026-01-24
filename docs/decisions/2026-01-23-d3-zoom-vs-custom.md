# Use D3's Built-in Zoom Behavior

**Date:** 2026-01-23
**Status:** Accepted
**Deciders:** Michael, Claude Code

## Context

We need pan/zoom controls for the D3 canvas to navigate large PAFV visualizations. Two approaches:

1. Use D3's `d3-zoom` behavior (standard library)
2. Build custom zoom using mouse/touch event listeners

This decision impacts maintainability, browser compatibility, and development time.

## Decision

We will use D3's `d3-zoom` behavior.

## Options Considered

### Option 1: D3's d3-zoom behavior

**Pros:**

- Industry standard, used by thousands of D3 apps
- Handles mouse, touch, trackpad automatically
- Edge cases already solved (momentum, double-tap, pinch-to-zoom)
- Well-tested across browsers and devices
- Integrates naturally with D3 selections
- ~100 lines of code saved vs custom
- Accessible: keyboard support built-in

**Cons:**

- External dependency (but D3 is already a dependency)
- Slightly larger bundle size (~5KB)
- Need to understand D3 zoom API

### Option 2: Custom zoom implementation

**Pros:**

- Full control over behavior
- No additional dependencies
- Potentially smaller bundle if we only need basic zoom

**Cons:**

- ~200+ lines of code to write and maintain
- Need to handle browser differences manually
- Touch gestures are complex (pinch detection, momentum)
- Accessibility would need custom implementation
- Bug-prone (gesture conflicts, edge cases)
- Reinventing the wheel

## Rationale

D3's zoom behavior is the standard for a reason - it handles complexity we don't want to own. The cons of the custom approach (maintenance burden, accessibility gaps, cross-browser issues) far outweigh the minor bundle size increase of using the standard library.

Key factors:
1. **Time to market:** D3 zoom is faster to implement
2. **Maintainability:** Standard library is maintained by D3 team
3. **Reliability:** Already tested on millions of devices
4. **Accessibility:** Built-in keyboard support

## Consequences

### Positive

- Faster implementation (1-2 days vs 1 week for custom)
- Better cross-browser compatibility out of the box
- Keyboard shortcuts work automatically
- Momentum scrolling on trackpads works correctly
- Mobile pinch-to-zoom works reliably

### Negative

- Bundle size increases by ~5KB (negligible given total app size)
- Team needs to learn D3 zoom API (well-documented, not a major concern)
- Slightly less control over exact gesture behavior (can be customized if needed)

## Related

- [[canvas-pan-zoom-controls]] - Feature spec
- [[canvas-pan-zoom-controls-plan]] - Implementation plan
