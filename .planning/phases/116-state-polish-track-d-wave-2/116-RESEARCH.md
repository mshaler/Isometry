# Phase 116: State & Polish (Track D Wave 2) - Research

**Researched:** 2026-02-17
**Domain:** React state persistence, view state management, ResizeObserver coordination
**Confidence:** HIGH

## Summary

Phase 116 builds on the Three-Canvas Notebook foundation (Phase 115) to add ViewStateManager for preserving scroll/zoom/selection per view, and PaneLayoutContext for coordinating resize events across panes. The codebase already has strong patterns to follow: `usePreviewSettings` demonstrates sessionStorage persistence for per-tab state, `SelectionContext` shows how to persist selection state, and `useResizeObserver` provides debounced resize handling.

The implementation should follow existing patterns rather than introducing new libraries. The `usePreviewSettings` hook already handles per-tab zoom level — ViewStateManager extends this pattern to include scroll position. PaneLayoutContext is a thin wrapper around ResizeObserver that debounces events and broadcasts dimensions to children via React context.

**Primary recommendation:** Extend existing `usePreviewSettings` hook to become the full ViewStateManager, adding scroll position tracking. Create `PaneLayoutContext.tsx` using the existing `useResizeObserver` pattern with 500ms debounce as specified.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^18.2.0 | Context providers and hooks | Already in use |
| sessionStorage | native | View state persistence | Already used in `usePreviewSettings`, `SelectionContext` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-resizable-panels | ^4.6.4 | Panel layout | Already provides `onLayoutChanged` callback (used in NotebookLayout) |
| ResizeObserver | native | Dimension tracking | Browser native API, used throughout codebase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sessionStorage | localStorage | sessionStorage is correct for session-scoped state (selection, scroll position clears on tab close) |
| Custom ResizeObserver | use-resize-observer npm | External dependency; existing `useResizeObserver` in `hooks/visualization/useD3.ts` already provides debouncing |
| New ViewStateManager class | Extend usePreviewSettings | Existing hook already handles 80% of requirements — extend rather than duplicate |

**Installation:**
```bash
# No new dependencies required — all functionality available via existing stack
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── state/                    # Existing context directory
│   ├── SelectionContext.tsx  # Pattern to follow for persistence
│   └── ViewStateContext.tsx  # NEW: ViewStateManager context (or extend usePreviewSettings)
├── context/                  # Alternative context location (already has FocusContext)
│   └── PaneLayoutContext.tsx # NEW: ResizeObserver coordination
├── hooks/
│   └── ui/
│       └── usePreviewSettings.ts  # EXTEND: Add scroll position tracking
└── components/
    └── notebook/
        └── NotebookLayout.tsx     # Wire PaneLayoutContext here
```

### Pattern 1: SessionStorage State Persistence (existing)

**What:** Hook manages state with automatic sessionStorage sync
**When to use:** Any per-session state that should survive page refreshes
**Example:**
```typescript
// Source: src/hooks/ui/usePreviewSettings.ts (existing pattern)
const STORAGE_KEY = 'preview-settings';

function loadFromStorage(): PreviewSettings {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSettings();
    const parsed = JSON.parse(raw);
    // Validate and merge with defaults
    return { ...defaults, ...parsed };
  } catch {
    return createDefaultSettings();
  }
}

function saveToStorage(settings: PreviewSettings): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors silently
  }
}

export function usePreviewSettings() {
  const [settings, setSettings] = useState<PreviewSettings>(loadFromStorage);

  useEffect(() => {
    saveToStorage(settings);
  }, [settings]);

  // Return setters that update state (which triggers effect to persist)
  return { ...settings, setActiveTab, setTabZoom, setTabFilterState, getTabConfig };
}
```

### Pattern 2: Debounced ResizeObserver (existing)

**What:** Hook wraps ResizeObserver with configurable debounce
**When to use:** Any component needing responsive dimension tracking
**Example:**
```typescript
// Source: src/hooks/visualization/useD3.ts (existing pattern)
export function useResizeObserver(
  ref: React.RefObject<Element>,
  callback: (entry: ResizeObserverEntry) => void,
  options: { debounceMs?: number } = {}
): void {
  const { debounceMs = 100 } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback((entry: ResizeObserverEntry) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(entry);
    }, debounceMs);
  }, [callback, debounceMs]);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        debouncedCallback(entries[0]);
      }
    });
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [ref, debouncedCallback]);
}
```

### Pattern 3: React Context for Shared State

**What:** Provider broadcasts state to consumers via useContext
**When to use:** State shared across component tree (like pane dimensions)
**Example:**
```typescript
// Pattern from SelectionContext.tsx
interface PaneLayoutContextValue {
  dimensions: { width: number; height: number };
  isResizing: boolean;
}

const PaneLayoutContext = createContext<PaneLayoutContextValue | null>(null);

export function PaneLayoutProvider({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isResizing, setIsResizing] = useState(false);

  // Use existing useResizeObserver with 500ms debounce (per spec)
  useResizeObserver(containerRef, (entry) => {
    setDimensions({
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    });
    setIsResizing(false);
  }, { debounceMs: 500 });

  // Set isResizing=true immediately on resize start
  // (separate ResizeObserver with 0 debounce)

  return (
    <PaneLayoutContext.Provider value={{ dimensions, isResizing }}>
      <div ref={containerRef}>{children}</div>
    </PaneLayoutContext.Provider>
  );
}

export function usePaneLayout() {
  const context = useContext(PaneLayoutContext);
  if (!context) {
    throw new Error('usePaneLayout must be used within PaneLayoutProvider');
  }
  return context;
}
```

### Anti-Patterns to Avoid

- **Creating a ViewStateManager class:** React contexts/hooks are the pattern; don't build a standalone class that duplicates React lifecycle management
- **localStorage for scroll position:** Use sessionStorage — scroll positions shouldn't persist across browser sessions (user expectation is fresh start)
- **Inline ResizeObservers without cleanup:** Always use `useResizeObserver` hook or manually disconnect in useEffect cleanup
- **Triggering layout during resize:** Debounce with 500ms per spec; avoid recalculating grid layout during drag
- **Storing pixel values without normalization:** Use Math.round() on resize dimensions to avoid subpixel re-renders

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State persistence | Custom sessionStorage wrapper | Existing `usePreviewSettings` pattern | Pattern handles try/catch, defaults, migration (legacy key handling) |
| Resize observation | Manual ResizeObserver | Existing `useResizeObserver` hook | Already has debounce, cleanup, ref handling |
| Scroll position capture | onScroll event listener | `element.scrollTop/scrollLeft` on view switch | Event listeners cause layout thrashing; capture on unmount is cleaner |
| Zoom level storage | Separate zoom hook | `usePreviewSettings.setTabZoom()` | Already implemented and working |

**Key insight:** Phase 115 already built most of the infrastructure. ViewStateManager is a thin extension of `usePreviewSettings`, and PaneLayoutContext is a standard context wrapping the existing `useResizeObserver` hook.

## Common Pitfalls

### Pitfall 1: Restoring Scroll Before Content Loads

**What goes wrong:** Scroll position is restored to saved value, but content hasn't rendered yet, so scroll fails or jumps
**Why it happens:** `useEffect` restoring scroll runs before async data/DOM updates complete
**How to avoid:** Restore scroll after data is loaded; use a flag like `isDataReady` or wait for first meaningful paint
**Warning signs:** Scroll position is 0 after restoration, or position jumps immediately after setting

### Pitfall 2: ResizeObserver Loop Errors

**What goes wrong:** "ResizeObserver loop completed with undelivered notifications" console error
**Why it happens:** Resize callback triggers DOM changes that cause another resize, creating infinite loop
**How to avoid:** Never change DOM layout inside resize callback; only update state. Use Math.round() on dimensions
**Warning signs:** Console errors, high CPU usage, janky resizing

### Pitfall 3: Persisting Invalid State

**What goes wrong:** Saved zoom level or scroll position is invalid for new data (e.g., scroll 5000px but list is now 100px)
**Why it happens:** State was saved for different data; restored blindly
**How to avoid:** Clamp restored values to valid ranges; validate against current content bounds
**Warning signs:** Scroll position shows blank area, zoom is too extreme

### Pitfall 4: State Leaking Between Views

**What goes wrong:** Switching from Network to SuperGrid, Network zoom level applies to SuperGrid
**Why it happens:** Using a shared zoom state instead of per-view state
**How to avoid:** Key all state by view type (PreviewTab); current `usePreviewSettings.tabConfigs` pattern does this correctly
**Warning signs:** Settings from one tab affecting another

## Code Examples

Verified patterns from existing codebase.

### Per-Tab State Management (usePreviewSettings extension)

```typescript
// Source: src/hooks/ui/usePreviewSettings.ts (to be extended)
// Current TabConfig:
export interface TabConfig {
  lastAccessed: number;
  zoomLevel?: number;
  filterState?: Record<string, unknown>;
}

// Extended TabConfig for ViewStateManager:
export interface TabConfig {
  lastAccessed: number;
  zoomLevel?: number;
  filterState?: Record<string, unknown>;
  scrollPosition?: { x: number; y: number };  // NEW
  selectedNodeId?: string;  // Already tracked via SelectionContext, but can cache here
}

// Hook usage remains the same, just add:
const setTabScrollPosition = useCallback((tab: PreviewTab, scrollPosition: { x: number; y: number }) => {
  setSettings(prev => ({
    ...prev,
    tabConfigs: {
      ...prev.tabConfigs,
      [tab]: {
        ...prev.tabConfigs[tab],
        scrollPosition,
      },
    },
  }));
}, []);
```

### Scroll Position Capture on View Switch

```typescript
// In PreviewComponent.tsx handleTabSwitch (existing pattern extended)
const handleTabSwitch = useCallback((tab: PreviewTab) => {
  // Save current scroll before switching
  if (containerRef.current) {
    setTabScrollPosition(activeTab, {
      x: containerRef.current.scrollLeft,
      y: containerRef.current.scrollTop,
    });
  }

  // Save current zoom before switching (existing)
  if (activeTab !== 'web-preview') {
    setTabZoom(activeTab, zoom);
  }

  setActiveTab(tab);

  // Restore zoom for new tab (existing)
  const savedZoom = getTabConfig(tab).zoomLevel;
  if (typeof savedZoom === 'number') {
    setZoom(savedZoom);
  }

  // Restore scroll for new tab
  requestAnimationFrame(() => {
    const savedScroll = getTabConfig(tab).scrollPosition;
    if (savedScroll && containerRef.current) {
      containerRef.current.scrollTo(savedScroll.x, savedScroll.y);
    }
  });
}, [activeTab, zoom, setTabZoom, setActiveTab, getTabConfig, setZoom, setTabScrollPosition]);
```

### PaneLayoutContext Implementation

```typescript
// Source: New file at src/context/PaneLayoutContext.tsx
import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from 'react';

interface PaneDimensions {
  capture: { width: number; height: number };
  shell: { width: number; height: number };
  preview: { width: number; height: number };
}

interface PaneLayoutContextValue {
  dimensions: PaneDimensions;
  isResizing: boolean;
  containerWidth: number;
  containerHeight: number;
}

const PaneLayoutContext = createContext<PaneLayoutContextValue | null>(null);

export function PaneLayoutProvider({ children }: { children: ReactNode }) {
  const [isResizing, setIsResizing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const [containerHeight, setContainerHeight] = useState(window.innerHeight);

  // Panel dimensions derived from percentages × container size
  // Percentages come from react-resizable-panels Layout stored in localStorage
  const [dimensions, setDimensions] = useState<PaneDimensions>({
    capture: { width: containerWidth / 3, height: containerHeight },
    shell: { width: containerWidth / 3, height: containerHeight },
    preview: { width: containerWidth / 3, height: containerHeight },
  });

  // Debounced resize handler (500ms per spec)
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsResizing(true);

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        setContainerWidth(window.innerWidth);
        setContainerHeight(window.innerHeight);
        setIsResizing(false);
        // Recalculate pane dimensions based on stored percentages
      }, 500);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <PaneLayoutContext.Provider value={{ dimensions, isResizing, containerWidth, containerHeight }}>
      {children}
    </PaneLayoutContext.Provider>
  );
}

export function usePaneLayout() {
  const context = useContext(PaneLayoutContext);
  if (!context) {
    throw new Error('usePaneLayout must be used within PaneLayoutProvider');
  }
  return context;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redux for all state | React Context + local state | 2023+ | Simpler, less boilerplate for local-first apps |
| useLayoutEffect for scroll restoration | requestAnimationFrame after state update | 2024+ | Avoids layout thrashing, better timing |
| Manual ResizeObserver | useResizeObserver hooks | 2024+ | Cleaner cleanup, consistent debouncing |
| localStorage for everything | sessionStorage for session-scoped state | Best practice | Scroll position should clear on new session |

**Deprecated/outdated:**
- `componentWillMount` for state restoration: Use `useState(initializer)` or `useEffect` instead
- `element.offsetWidth/offsetHeight` for dimensions: Use ResizeObserver for reactive updates

## Open Questions

1. **Should scroll position be per-tab or per-view-mode?**
   - What we know: `usePreviewSettings` keys by `PreviewTab` (supergrid, network, timeline, etc.)
   - What's unclear: If user switches from SuperGrid list mode to SuperGrid gallery mode, should scroll reset?
   - Recommendation: Key by `PreviewTab` only (current approach); view mode changes are different state

2. **How to handle invalid scroll restoration?**
   - What we know: Saved scroll might exceed current content bounds
   - What's unclear: Should we clamp to max, or reset to 0?
   - Recommendation: Clamp to max valid scroll position (less jarring than jump to 0)

3. **PaneLayoutContext placement — context/ or state/?**
   - What we know: `SelectionContext` is in `state/`, `FocusContext` is in `context/`
   - What's unclear: Naming convention isn't consistent
   - Recommendation: Use `context/` to match `FocusContext` — both are layout-related

## Sources

### Primary (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/src/hooks/ui/usePreviewSettings.ts` — existing pattern for per-tab state persistence
- `/Users/mshaler/Developer/Projects/Isometry/src/state/SelectionContext.tsx` — sessionStorage persistence pattern
- `/Users/mshaler/Developer/Projects/Isometry/src/hooks/visualization/useD3.ts` — useResizeObserver implementation
- `/Users/mshaler/Developer/Projects/Isometry/src/components/notebook/NotebookLayout.tsx` — react-resizable-panels integration

### Secondary (MEDIUM confidence)
- [Persist and Remember Page Scroll Position with React Hooks](https://chrisfrew.in/blog/persist-and-remember-page-scroll-position-with-react-hooks/) — useEffect return for unmount-time capture
- [Best Practices for Resize Observer React Implementation](https://www.dhiwise.com/post/mastering-resize-observer-react-best-practices) — debounce, cleanup, memoization
- [React State Management in 2025](https://www.developerway.com/posts/react-state-management-2025) — modern state management guidance

### Tertiary (LOW confidence)
- Web search results for "ResizeObserver debounce best practices" — general consensus on 100-500ms debounce, Math.round() for subpixels

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all technologies already in use in codebase
- Architecture: HIGH — patterns directly from existing code (usePreviewSettings, SelectionContext, useResizeObserver)
- Pitfalls: HIGH — derived from React documentation and codebase patterns

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days — stable patterns, no fast-moving dependencies)
