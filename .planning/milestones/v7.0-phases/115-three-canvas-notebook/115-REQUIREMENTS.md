# Phase 115: Three-Canvas Notebook — Requirements

**Phase:** 115
**Track:** D (final track of v6.9)
**Depends On:** Track C complete (Phase 114)
**Goal:** Complete the Three-Canvas notebook integration with resize handles and cross-canvas data flow

## Context

The Three-Canvas notebook architecture consists of:
- **Capture** (left): TipTap editor for note-taking with slash commands
- **Shell** (center): Claude AI chat, Terminal, and GSD GUI tabs
- **Preview** (right): SuperGrid, Network, Timeline, and Data Inspector tabs

Current state (NotebookLayout.tsx):
- Three canvases render side-by-side using CSS Grid `grid-cols-3`
- Focus management with Cmd+1/2/3 keyboard shortcuts
- Responsive layouts for mobile/tablet/desktop
- Each canvas wrapped in ErrorBoundary

## Requirements

### REQ-115-01: Resizable Canvas Panels (P0)
**User Story:** As a user, I want to resize the three canvas panels by dragging dividers, so I can allocate screen space based on my current task.

**Acceptance Criteria:**
- [ ] Draggable dividers between Capture/Shell and Shell/Preview
- [ ] Dividers maintain position on window resize
- [ ] Double-click divider resets to equal thirds
- [ ] Minimum panel width of 200px prevents collapse
- [ ] Panel proportions persist in sessionStorage

**Implementation Notes:**
- Consider react-resizable-panels library (lightweight, accessible)
- Or custom implementation with CSS resize + mouse events
- Must work with existing focus management

### REQ-115-02: Cross-Canvas Selection Sync (P0)
**User Story:** As a user, when I select a card in Preview, I want Capture to show that card's content, so I can seamlessly edit selected items.

**Acceptance Criteria:**
- [ ] Selecting card in SuperGrid/Network/Timeline shows card in Capture
- [ ] Selecting card in Capture highlights it in Preview visualizations
- [ ] Multi-select in Preview shows count in Capture status bar
- [ ] Selection clears consistently across all canvases
- [ ] SelectionContext fully integrated in all three components

**Implementation Notes:**
- SelectionContext already exists in /src/state/SelectionContext.tsx
- CaptureComponent uses useSelection (verify complete)
- PreviewComponent tabs use useSelection (verified in Phase 114)

### REQ-115-03: Capture → Shell Data Flow (P1)
**User Story:** As a user, I want to send content from Capture to Shell using slash commands, so I can process notes with AI.

**Acceptance Criteria:**
- [ ] `/send-to-shell` command in Capture sends selected text to Claude AI tab
- [ ] `/send-to-terminal` command sends selected text to Terminal tab
- [ ] Shell receives content with clear attribution (from Capture)
- [ ] Feedback shown in Capture after successful send

**Implementation Notes:**
- Check existing SlashCommandMenu.tsx for /send-to-shell
- Need cross-canvas communication via shared context or events

### REQ-115-04: Shell → Preview Data Flow (P1)
**User Story:** As a user, I want Shell commands to update Preview visualizations, so I can see results of my queries.

**Acceptance Criteria:**
- [ ] Claude AI responses with card references highlight cards in Preview
- [ ] Terminal SQL queries update Preview data views
- [ ] GSD task status syncs with Preview card display

**Implementation Notes:**
- May need event-based communication
- Consider zustand or context for cross-component state

### REQ-115-05: Capture Slash Commands (P1)
**User Story:** As a user, I want complete slash command functionality in Capture.

**Acceptance Criteria:**
- [ ] `/save-card` persists current note as card in SQLite
- [ ] `/template` shows template picker modal
- [ ] `/link` shows wiki-link picker for card references
- [ ] Commands show in-editor completion menu

**Implementation Notes:**
- SlashCommandMenu.tsx exists
- Verify all commands functional with sql.js

### REQ-115-06: Preview Tab Completeness (P2)
**User Story:** As a user, I want all Preview tabs fully functional.

**Acceptance Criteria:**
- [ ] SuperGrid tab shows CSS Grid visualization (Phase 106 work)
- [ ] Network tab shows D3 force graph (Phase 113 work)
- [ ] Timeline tab shows temporal view (Phase 114 work)
- [ ] Data Inspector tab shows raw SQL results
- [ ] Web Preview tab embeds external URLs

**Implementation Notes:**
- Most tabs already implemented in Phase 113-114
- Verify integration and data flow

## Non-Goals (Out of Scope)

- Collaborative editing (single-user focus)
- Floating/detachable panels (desktop-first)
- Custom themes per canvas (global theme only)

## Success Criteria

1. **Observable:** Dragging divider resizes panels smoothly at 60fps
2. **Observable:** Clicking card in Preview shows it in Capture within 100ms
3. **Observable:** `/send-to-shell` delivers content to Claude AI tab
4. **Observable:** All Preview tabs render without console errors

## Dependencies

- SelectionContext (exists)
- NotebookLayout (exists, needs enhancement)
- CaptureComponent (exists)
- ShellComponent (exists)
- PreviewComponent (exists, enhanced in Phase 114)

---
*Created: 2026-02-17 — Track D planning*
