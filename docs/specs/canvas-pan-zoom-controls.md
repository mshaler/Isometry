# Canvas Pan/Zoom Controls

**Status:** Draft
**Created:** 2026-01-23
**Updated:** 2026-01-23
**Owner:** Michael

## Related Documents

- [[2026-01-23-canvas-pan-zoom-idea]] - Original idea from Apple Notes
- [[2026-01-23-d3-zoom-vs-custom]] - Decision: Use D3's zoom behavior
- [[canvas-pan-zoom-controls-plan]] - Implementation plan

---

## 1. Problem Statement

Users need to navigate large PAFV visualizations that don't fit on screen. Currently, there's no way to zoom in/out or pan around the canvas, making dense graphs and timelines difficult to explore.

## 2. Goals

- Enable smooth pan and zoom navigation on D3 canvas
- Match platform conventions (Maps.app feel on iOS/macOS, Google Maps on web)
- Persist zoom state when switching between views
- Non-goals:
  - Animated transitions between zoom levels (v2 feature)
  - Minimap/overview panel (separate feature)

## 3. User Stories

**As a** user exploring a large graph
**I want** to zoom in to see node details and zoom out for overview
**So that** I can navigate between detailed inspection and big-picture understanding

**As a** user working with a timeline spanning years
**I want** to pan left/right to explore different time periods
**So that** I can see events outside the initial viewport

**As a** keyboard user
**I want** keyboard shortcuts for zoom and pan
**So that** I can navigate without a mouse

## 4. Proposed Solution

Use D3's `d3-zoom` behavior with these configurations:

- **Mouse:** Wheel to zoom, drag to pan
- **Trackpad:** Pinch to zoom, two-finger drag to pan
- **Touch:** Pinch to zoom, drag to pan
- **Keyboard:** +/- for zoom, arrow keys for pan

Zoom transform stored in React state (PAFVContext), not SQLite. Each view maintains its own zoom state.

### Architecture Impact

- Add `zoomTransform` to PAFVContext (per-view state)
- D3 canvas applies transform from context on render
- Zoom behavior updates context on user interaction
- Reset button sets transform to `d3.zoomIdentity`

## 5. Open Questions

> **For Claude Code:** These are questions I need answered before implementation.

- [x] Should we use D3's zoom behavior or build custom? → Use D3 (see decision record)
- [x] Per-view or global zoom state? → Per-view
- [ ] Should zoom bounds be configurable per view type? (e.g., graphs allow infinite zoom, grids have limits)
- [ ] How to handle zoom on mobile Safari (gesture conflicts)?
- [ ] Accessibility: Should we add zoom level indicator for screen readers?

## 6. Implementation Constraints

- Must use D3's `d3-zoom` behavior (see [[2026-01-23-d3-zoom-vs-custom]])
- React 18+ (already in use)
- Must work in both React prototype and future React Native WebView
- Zoom state must survive view switches (stored in context, not D3 internal state)

## 7. Acceptance Criteria

- [ ] Mouse wheel zooms canvas in/out around cursor position
- [ ] Click-drag pans canvas
- [ ] Trackpad pinch-to-zoom works smoothly
- [ ] Keyboard shortcuts (+/-, arrows) work
- [ ] Zoom state persists when switching to different view and back
- [ ] Reset button returns to initial zoom/pan state
- [ ] Zoom bounds prevent excessive zoom in/out (configurable min/max scale)
- [ ] Touch gestures work on mobile Safari

## 8. Testing Strategy

Manual testing:
1. Load large graph view (>100 nodes)
2. Zoom in with mouse wheel - nodes should get larger
3. Pan with click-drag - canvas should move smoothly
4. Switch to timeline view, then back to graph - zoom should be preserved
5. Press reset button - should return to initial view
6. Test on mobile: pinch to zoom should work

Unit tests (if time):
- Verify zoom transform updates context correctly
- Verify bounds enforcement (min/max scale)

## 9. Rollback Plan

If zoom causes performance issues:
1. Add feature flag `ENABLE_CANVAS_ZOOM` in config
2. Default to disabled
3. Investigate performance with profiling
4. Fix and re-enable

If gesture conflicts on mobile:
1. Disable zoom on mobile temporarily
2. Desktop zoom still works
3. Fix mobile gesture handling separately

---

## Notes & Discussion

### Claude Q&A Session 1 (2026-01-23)

**Me:** Does D3 have standard zoom behavior we should use?

**Claude:** Yes, D3 has `d3-zoom` which is the standard. It handles mouse, touch, and trackpad events automatically. Strongly recommend using it over custom implementation because:
- Handles edge cases (momentum, double-tap zoom, etc.)
- Well-tested across browsers
- Integrates with D3 selections naturally

**Me:** Should zoom state be per-view or global?

**Claude:** Per-view makes more sense. A user might want to zoom in on a graph but view a timeline at normal scale. Store in PAFVContext keyed by view ID.

**Me:** SQLite or in-memory for zoom state?

**Claude:** In-memory (React context). Zoom/pan is ephemeral UI state, not user data. Persisting it would create confusing UX - users expect a fresh view on app restart.

### Next Steps

- [x] Write decision record for D3 zoom vs custom
- [ ] Get Claude to create implementation plan
- [ ] Review plan
- [ ] Implement
