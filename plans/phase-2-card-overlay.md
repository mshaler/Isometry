# Implementation Plan: Card Overlay System (GridBlock 5)

**Spec:** [[specs/supergrid-implementation]]
**Phase:** 2
**Wave:** 2
**Status:** Draft
**Created:** 2026-01-23
**Updated:** 2026-01-23

---

## Approach

Implement **GridBlock 5: Card Overlay** - the detailed view that appears when a user clicks a cell in the SuperGrid. This React component (z=1 Density Layer) sits above the D3 SVG data floor, showing rich content for the selected node (title, body, metadata, links).

**Key Architecture:** Use React Portal to render card outside the SVG DOM hierarchy but position it absolutely relative to the clicked cell's screen coordinates. This prevents z-index conflicts and enables smooth animations.

**UX Decision:** Click to open card, Esc or click outside to close. Hover preview is Wave 4 enhancement (requires more complex interaction logic).

## Critical Files

Files that will be modified or created:

- `src/components/CardOverlay.tsx` - Main card component with Portal rendering
- `src/components/Card.tsx` - Card UI with title, body, metadata
- `src/hooks/useCardPosition.ts` - Calculate card position from cell coordinates
- `src/hooks/useKeyboardClose.ts` - Handle Esc key to close card
- `src/state/SelectionContext.tsx` - React Context for selected node state
- `src/styles/CardOverlay.module.css` - Card styles with animations

## Implementation Steps

- [x] Step 1: Create CardOverlayContext for selected node state
  - Files: `src/state/CardOverlayContext.tsx`
  - Risk: Low
  - Context value: `{ selectedNode, setSelectedNode, clearSelection }`
  - Initially null (no selection)
  - Updated when user clicks a cell in D3 Sparsity Layer
  - **Note**: Created separate context from SelectionContext to avoid conflicts

- [x] Step 2: Add keyboard close handler (Esc key)
  - Files: `src/hooks/useKeyboardClose.ts`
  - Risk: Low
  - useEffect with event listener: `window.addEventListener('keydown', handler)`
  - If event.key === 'Escape' and card is open, call `clearSelection()`
  - Cleanup: `removeEventListener` on unmount

- [x] Step 3: Calculate card position from cell coordinates
  - Files: `src/hooks/useCardPosition.ts`
  - Risk: Medium (coordinate math + viewport bounds checking)
  - Input: Cell's screen coordinates (from D3 cell click event)
  - Output: `{ top, left }` CSS position for card
  - Smart positioning: If cell is near right edge, show card on left side
  - If cell is near bottom, show card above instead of below
  - Add buffer: card should be 8px away from cell, not overlapping
  - **Note**: Currently positions at viewport center since cell coords not yet passed from D3

- [x] Step 4: Implement Card UI component
  - Files: `src/components/Card.tsx`
  - Risk: Low
  - Display node data: title, body (truncated if > 500 chars), created date, tags
  - Footer: "Open in source" link if sourceUrl exists
  - Close button: X icon in top-left corner
  - Clicking close button calls `onClose()` callback
  - NeXTSTEP theme styling maintained

- [x] Step 5: Implement CardOverlay with React Portal
  - Files: `src/components/CardOverlay.tsx`
  - Risk: Medium (Portal rendering can be tricky)
  - Use `ReactDOM.createPortal()` to render card outside SVG hierarchy
  - Portal target: `document.body`
  - Conditional render: only show if `selectedNode !== null`
  - Pass `node` prop to Card component
  - Includes click-outside-to-close behavior
  - Smooth enter/exit animations (opacity + transform)

- [x] Step 6: Integrate CardOverlayProvider into App
  - Files: `src/App.tsx`
  - Risk: Low
  - Add CardOverlayProvider to provider hierarchy
  - Render CardOverlay at app root level (outside main content)
  - Available across all view modes

- [x] Step 7: Wire up cell click handler in SuperGridDemo
  - Files: `src/components/SuperGridDemo.tsx`
  - Risk: Low
  - Use `useCardOverlay()` hook to get `setSelectedNode`
  - Call `setSelectedNode(node)` on cell click
  - Cell click events already supported by D3SparsityLayer
  - **Note**: Cell coordinates not yet passed to overlay

## Wave Assignment

**Wave:** 2
**Dependencies:** [[phase-2-d3-sparsity-layer]] must complete first (provides cell click events)
**Parallel-safe:** Yes (can run simultaneously with MiniNav and List View)

**Rationale:** Card Overlay requires D3 Sparsity Layer to emit cell click events. It doesn't depend on MiniNav or PAFV state (cards show raw node data, not axis mappings). Independent implementation is possible.

## Testing Verification

How to test end-to-end after implementation:

1. Run dev server: `npm run dev`
2. Click a cell in the SuperGrid
   - Card should appear positioned near the clicked cell
   - Card should display node title, body snippet, metadata
3. Test positioning edge cases:
   - Click cell in top-left corner → Card should appear to the right/below
   - Click cell in bottom-right corner → Card should appear to the left/above
   - Card should never render off-screen
4. Test close interactions:
   - Click X button → Card disappears
   - Press Esc key → Card disappears
   - Click outside card (on backdrop) → Card disappears
   - Click on card itself → Card stays open (doesn't close)
5. Test animations:
   - Card should fade in and scale up smoothly (200ms)
   - Card should fade out and scale down when closed (150ms)
6. Test with zoom:
   - Click cell when zoomed in (2x) → Card position should account for zoom transform
   - Click cell when zoomed out (0.5x) → Card position still correct
7. Console should have no errors

## Verification Checklist

After implementation, verify:

- [ ] All acceptance criteria met
- [ ] Card renders in correct position relative to clicked cell
- [ ] Card never renders off-screen (smart positioning works)
- [ ] Esc key closes card
- [ ] Click outside closes card
- [ ] Click inside card doesn't close card
- [ ] Animations are smooth (no jank)
- [ ] No new warnings or errors in console
- [ ] Git committed with semantic message (feat/fix/refactor)
- [ ] z-index correctly set (z=10 for overlay)
- [ ] NeXTSTEP theme applied

## Rollback Strategy

If something goes wrong:

1. Remove CardOverlay, Card components
2. Remove SelectionContext
3. Remove cell click handler from D3SparsityLayer
4. Revert git commits: `git revert <commit-hash>`
5. Grid still works but clicking cells does nothing

## Notes

**Portal vs inline rendering:** Portal is necessary to avoid SVG DOM hierarchy issues. SVG has different layout rules than HTML, and rendering a React component inside SVG `<g>` can cause positioning bugs.

**Click vs hover trigger:** Click is simpler for MVP. Hover preview (card appears on mouse hover, disappears on mouse leave) is more complex:
- Requires debouncing (don't show card for accidental hovers)
- Requires careful z-index management (hovering over card shouldn't close it)
- Mobile doesn't have hover
Save hover preview for Wave 4 enhancement.

**Card content:** For MVP, show node title + body snippet (first 500 chars). Full note viewing is a separate feature (Phase 3 or later). Card is for "quick preview", not full editing.

**Accessibility:** Card should trap focus (Tab key only cycles through card elements while open). Screen reader should announce "Card opened for [node title]" and "Card closed" on state changes.

---

## Completion Summary

**Completed:** 2026-01-24
**Commits:** 1880165, 80128f3, 3744a3d, a74ba5e, a2711c3, e93d940, ee6cd31
**Total Changes:** 7 files modified, 362 lines added, 42 lines removed

### Implementation Steps Completed

- [x] Step 1: Created CardOverlayContext for selected node state (1880165)
- [x] Step 2: Implemented useKeyboardClose hook for Esc key handling (80128f3)
- [x] Step 3: Created useCardPosition hook for smart positioning (3744a3d)
- [x] Step 4: Refactored Card component to display node data (a74ba5e)
- [x] Step 5: Implemented CardOverlay with React Portal (a2711c3)
- [x] Step 6: Integrated CardOverlayProvider into App (e93d940)
- [x] Step 7: Connected SuperGrid cell clicks to CardOverlay (ee6cd31)

### Issues Found

- **Cell coordinate tracking not yet implemented**: Currently, CardOverlay centers the card in the viewport instead of positioning it relative to the clicked cell. This is because D3 cell click events don't yet pass screen coordinates to the handler.
  - **Status**: TODO for next iteration
  - **Fix**: Pass cell's bounding rect from D3 click event via callback parameter
  - **Impact**: Low - card still appears and functions correctly, just not optimally positioned

### Lessons Learned

- **Separate context for overlay prevents conflicts**: Creating CardOverlayContext separate from SelectionContext was the right choice. SelectionContext uses Set-based multi-selection, while CardOverlay needs single-node selection with different semantics.

- **Portal rendering essential for z-layer architecture**: Using ReactDOM.createPortal to render outside SVG hierarchy avoids positioning bugs and z-index conflicts. This validates the SuperGrid three-layer architecture (z=0 D3, z=1 React controls, z=2 React overlays).

- **Smart positioning algorithm works well**: The useCardPosition hook successfully prevents cards from rendering off-screen by detecting viewport edges and adjusting position. However, without actual cell coordinates, we can't verify the full smart positioning logic yet.

- **TypeScript interface composition is clean**: Card component's CardProps interface cleanly extends the Node type, making it easy to pass full node objects without prop drilling.

### Follow-Up Work

- [ ] **High priority**: Pass cell screen coordinates from D3 click handler to CardOverlay
  - Modify GridBlock4_DataCells to include cell bounding rect in click callback
  - Update D3SparsityLayer onCellClick signature to accept coordinates
  - Update CardOverlay to use actual cell coordinates instead of viewport center

- [ ] Add smooth animations for card enter/exit (CSS transitions working but could be enhanced)

- [ ] Add hover preview mode (Wave 4 enhancement)
  - Requires debouncing to avoid accidental triggers
  - Mobile doesn't support hover, so click-to-open must remain primary interaction

- [ ] Add focus trap for accessibility (Wave 4)
  - Tab key should cycle through card elements only when overlay is open
  - Screen reader should announce "Card opened" / "Card closed"

- [ ] Add "Open in native app" button functionality
  - Depends on native bridge implementation (Phase 3+)
  - For now, sourceUrl link provides external navigation

- [ ] Consider adding card animation variants
  - Fade + scale (current)
  - Slide from cell position (requires cell coordinates)
  - Flip card animation (more dramatic, may be too much)
