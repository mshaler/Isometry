# Canvas Pan/Zoom Controls

**Date:** 2026-01-23
**Source:** Apple Notes
**Status:** Raw

---

## Quick Capture

Need to add pan and zoom to D3 canvas for PAFV views
- Should feel like Maps.app (smooth, pinch-to-zoom)
- Mouse wheel for zoom, click-drag for pan on desktop
- Maintain zoom level when switching between views
- Reset button to go back to default view

Questions:
- Does D3 have built-in zoom behavior or do we build custom?
- How to persist zoom state when user switches views?
- Should zoom be per-view or global?
- What about accessibility - keyboard controls?

## Questions for Claude

- Does D3.js have a standard zoom behavior we should use?
- How do other D3 apps handle zoom state persistence?
- Should we store zoom transform in SQLite or just in-memory state?

## Next Steps

- [ ] Research D3 zoom behavior
- [ ] Write spec with Claude
- [ ] Get Claude's recommendation on implementation approach

## Related

- [[cardboard-v4-specification]]
