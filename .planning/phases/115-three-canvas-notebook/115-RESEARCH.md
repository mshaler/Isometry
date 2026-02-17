# Phase 115: Three-Canvas Notebook — Research

**Phase:** 115
**Track:** D
**Date:** 2026-02-17

## Current State Assessment

### NotebookLayout.tsx
**Location:** `src/components/notebook/NotebookLayout.tsx`

**Current implementation:**
- Uses CSS Grid `grid-cols-3` for desktop layout
- Responsive: mobile (stacked), tablet (capture top, shell+preview side-by-side), desktop (3-column)
- Focus management with `FocusProvider` and `useFocusableComponent`
- Keyboard shortcuts: Cmd+1 (Capture), Cmd+2 (Shell), Cmd+3 (Preview)
- Each canvas wrapped in `ErrorBoundary`

**Gap: No resize handles.** Uses fixed equal thirds.

### SelectionContext
**Location:** `src/state/SelectionContext.tsx`

**Usage found:**
- `src/components/notebook/CaptureComponent.tsx` - Uses useSelection
- `src/components/notebook/preview-tabs/TimelineTab.tsx` - Uses useSelection
- `src/components/notebook/preview-tabs/NetworkGraphTab.tsx` - Uses useSelection
- `src/components/IntegratedLayout.tsx` - Uses useSelection

**Analysis:** SelectionContext is well-integrated. Need to verify:
1. CaptureComponent responds to selection changes from Preview
2. Selection sync is bidirectional

### CaptureComponent
**Location:** `src/components/notebook/CaptureComponent.tsx`

**Features:**
- TipTap editor with extensions
- SlashCommandMenu for commands
- PropertyEditor sidebar
- BacklinksPanel for references

**Gap investigation needed:**
- Does `/send-to-shell` exist?
- Does `/save-card` work with current sql.js?

### ShellComponent
**Location:** `src/components/notebook/ShellComponent.tsx`

**Features:**
- Tab system (Terminal, Claude AI, GSD GUI)
- TerminalProvider context integration

**Gap investigation needed:**
- Does it receive content from Capture?
- Is there an event/context for cross-canvas messaging?

### PreviewComponent
**Location:** `src/components/notebook/PreviewComponent.tsx`

**Features (verified in Phase 114):**
- Tab system with persistence (usePreviewSettings)
- SuperGrid, Network, Timeline, Data Inspector tabs
- Web Preview tab for URLs
- PAFV info display in address bar
- Zoom controls

**Status:** Largely complete from Track C work.

## Gap Analysis

### Gap 1: Resize Handles (HIGH PRIORITY)
**What's missing:** No way to resize panels.
**Solution options:**
1. `react-resizable-panels` - Popular, accessible, 9KB gzipped
2. Custom CSS resize + drag events
3. `allotment` library - Similar to VS Code panels

**Recommendation:** `react-resizable-panels` for rapid implementation

### Gap 2: Cross-Canvas Messaging (MEDIUM PRIORITY)
**What's missing:** No clear mechanism for Capture → Shell content passing
**Solution options:**
1. Extend NotebookContext with message queue
2. Use custom event system (EventEmitter)
3. Add zustand store for cross-component state

**Recommendation:** Extend existing context pattern (consistent with codebase)

### Gap 3: Slash Command Verification (LOW PRIORITY)
**What's unknown:** Functionality of /send-to-shell, /save-card
**Action:** Read SlashCommandMenu.tsx and test manually

## Proposed Phase Plan

### Plan 115-01: Resizable Panels
- Install react-resizable-panels
- Replace CSS Grid with PanelGroup/Panel/PanelResizeHandle
- Add persistence to sessionStorage
- Maintain responsive breakpoints

### Plan 115-02: Selection Sync Verification
- Add tests for bidirectional selection
- Ensure CaptureComponent loads selected card content
- Add selection indicator in Capture when card selected elsewhere

### Plan 115-03: Cross-Canvas Messaging
- Add NotebookContext message system
- Implement /send-to-shell command flow
- Add Shell receive handler for Capture content

### Plan 115-04: Integration Testing & Polish
- E2E test for selection flow
- E2E test for slash commands
- Performance verification (60fps resize)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/notebook/NotebookLayout.tsx` | Replace grid-cols-3 with resizable panels |
| `src/components/notebook/CaptureComponent.tsx` | Add selection sync loading |
| `src/components/notebook/ShellComponent.tsx` | Add message receive handler |
| `src/context/NotebookContext.tsx` | Add cross-canvas messaging (if needed) |
| `package.json` | Add react-resizable-panels dependency |

## Library Research

### react-resizable-panels
- **Repo:** https://github.com/bvaughn/react-resizable-panels
- **Size:** ~9KB gzipped
- **Features:** Keyboard accessible, persistence API, nested panels
- **Compatibility:** React 16.8+ (hooks)

**Example usage:**
```tsx
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

<PanelGroup direction="horizontal">
  <Panel defaultSize={33} minSize={15}>
    <CaptureComponent />
  </Panel>
  <PanelResizeHandle />
  <Panel defaultSize={34} minSize={15}>
    <ShellComponent />
  </Panel>
  <PanelResizeHandle />
  <Panel defaultSize={33} minSize={15}>
    <PreviewComponent />
  </Panel>
</PanelGroup>
```

---
*Research completed: 2026-02-17*
