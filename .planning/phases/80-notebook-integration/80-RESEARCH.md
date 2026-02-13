# Phase 80: Notebook Integration - Research

**Researched:** 2026-02-13
**Domain:** React component integration, collapsible panels, state persistence
**Confidence:** HIGH

## Summary

Phase 80 integrates the existing NotebookLayout (three-pane component) into IntegratedLayout as a collapsible panel below the Command Bar. The codebase already has all necessary infrastructure: NotebookLayout with three panes (Capture, Shell, Preview), NotebookContext for state management, a custom Collapsible component, theme system (NeXTSTEP/Modern), and localStorage-based state persistence patterns.

The integration is straightforward: add a collapsible panel container to IntegratedLayout, embed NotebookLayout within it, wire up NotebookProvider in the component tree, and persist collapse state to localStorage. All component pieces exist and follow established patterns.

**Primary recommendation:** Use existing Collapsible component with Tailwind CSS animations, embed NotebookLayout as-is, persist state via localStorage following NotebookContext's `notebook_mode` pattern.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18.2.0 | Component framework | Already in use throughout codebase |
| Tailwind CSS | ^3.3.5 | Styling and animations | Project standard, all layouts use it |
| tailwindcss-animate | ^1.0.7 | Pre-built animations | Already installed, provides transition utilities |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| NotebookContext | (internal) | Notebook state management | Always - provides activeCard, cards, templates |
| FocusProvider | (internal) | Keyboard navigation for notebook panes | Always - wraps NotebookLayout |
| TerminalProvider | (internal) | Terminal state for Shell pane | Always - wraps NotebookLayout |
| ThemeContext | (internal) | NeXTSTEP/Modern theme switching | Always - all UI respects theme |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Collapsible | @radix-ui/react-collapsible | Custom component already exists and works, no need to add dependency |
| CSS transitions | Framer Motion | Tailwind transitions are sufficient, avoid heavy animation library |
| Context API | Zustand/Redux | Codebase uses Context API, don't introduce new state pattern |

**Installation:**
```bash
# No new dependencies needed - everything already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── IntegratedLayout.tsx        # Target file - add notebook panel here
│   ├── CommandBar.tsx              # Sits above notebook panel
│   ├── notebook/
│   │   ├── NotebookLayout.tsx      # Embed this in collapsible panel
│   │   ├── CaptureComponent.tsx    # Already part of NotebookLayout
│   │   ├── ShellComponent.tsx      # Already part of NotebookLayout
│   │   └── PreviewComponent.tsx    # Already part of NotebookLayout
│   └── ui/
│       └── collapsible.tsx         # Existing collapsible component
├── contexts/
│   ├── NotebookContext.tsx         # Already provides all notebook state
│   └── ThemeContext.tsx            # Theme switching (NeXTSTEP/Modern)
└── context/
    ├── FocusContext.tsx            # Keyboard nav for notebook panes
    └── TerminalContext.tsx         # Terminal state for Shell pane
```

### Pattern 1: Collapsible Panel Container
**What:** Wrap NotebookLayout in a collapsible panel below Command Bar
**When to use:** Always for this phase
**Example:**
```typescript
// Source: IntegratedLayout.tsx (existing structure)
// Add below Command Bar (line ~485)

const [isNotebookExpanded, setIsNotebookExpanded] = useState(() => {
  try {
    return localStorage.getItem('notebook_expanded') === 'true';
  } catch {
    return false; // Collapsed by default
  }
});

useEffect(() => {
  try {
    localStorage.setItem('notebook_expanded', isNotebookExpanded.toString());
  } catch (err) {
    console.warn('Failed to persist notebook expanded state', err);
  }
}, [isNotebookExpanded]);

// In render:
<div className={`h-screen flex flex-col ${bgColor} ${textColor}`}>
  {/* Command Bar */}
  <div className={`h-8 ${panelBg} border-b ${borderColor}`}>
    {/* ...existing command bar... */}
  </div>

  {/* Notebook Panel - COLLAPSIBLE */}
  <Collapsible open={isNotebookExpanded} onOpenChange={setIsNotebookExpanded}>
    <CollapsibleTrigger>
      <div className={`h-8 ${panelBg} border-b ${borderColor} flex items-center px-4 gap-2 cursor-pointer hover:bg-opacity-80`}>
        <span>{isNotebookExpanded ? '▼' : '▶'}</span>
        <span className="text-xs font-medium">Notebook</span>
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="h-96 border-b border-gray-200">
        <NotebookLayout />
      </div>
    </CollapsibleContent>
  </Collapsible>

  {/* Rest of IntegratedLayout... */}
</div>
```

### Pattern 2: NotebookProvider Wiring
**What:** Ensure NotebookContext is available in the component tree
**When to use:** Always when using NotebookLayout
**Example:**
```typescript
// Source: NotebookContext.tsx (lines 20-410)
// NotebookProvider must wrap IntegratedLayout at App.tsx level

// In App.tsx or main layout wrapper:
import { NotebookProvider } from '@/contexts/NotebookContext';

function App() {
  return (
    <ThemeProvider>
      <NotebookProvider>  {/* Add this */}
        <IntegratedLayout />
      </NotebookProvider>
    </ThemeProvider>
  );
}
```

### Pattern 3: Theme-Aware Styling
**What:** Use theme context to style panel with NeXTSTEP or Modern theme
**When to use:** Always for visual consistency
**Example:**
```typescript
// Source: IntegratedLayout.tsx (lines 227-236)
const { theme } = useTheme();
const isNeXTSTEP = theme === 'NeXTSTEP';
const panelBg = isNeXTSTEP ? 'bg-[#252525]' : 'bg-white';
const borderColor = isNeXTSTEP ? 'border-[#3A3A3A]' : 'border-gray-200';
const textColor = isNeXTSTEP ? 'text-[#E0E0E0]' : 'text-gray-900';

// Apply to collapsible panel:
<div className={`h-8 ${panelBg} border-b ${borderColor}`}>
  {/* Notebook toggle header */}
</div>
```

### Pattern 4: Smooth Collapse Animation
**What:** Use Tailwind transition utilities for smooth expand/collapse
**When to use:** Always for collapsible panels
**Example:**
```typescript
// Source: collapsible.tsx (line 57)
// CollapsibleContent already has transition-all built in

// For custom height animation:
<CollapsibleContent className="transition-all duration-300 ease-in-out">
  <div className="h-96">
    <NotebookLayout />
  </div>
</CollapsibleContent>

// Or with explicit max-height for smoother animation:
<div className={`
  overflow-hidden transition-all duration-300 ease-in-out
  ${isNotebookExpanded ? 'max-h-96' : 'max-h-0'}
`}>
  <NotebookLayout />
</div>
```

### Pattern 5: State Persistence
**What:** Persist collapse state to localStorage following NotebookContext pattern
**When to use:** Always for user preference preservation
**Example:**
```typescript
// Source: NotebookContext.tsx (lines 25-31, 329-342)
const [isNotebookExpanded, setIsNotebookExpanded] = useState(() => {
  try {
    return localStorage.getItem('notebook_expanded') === 'true';
  } catch {
    return false; // Default collapsed
  }
});

// Persist on change:
useEffect(() => {
  try {
    localStorage.setItem('notebook_expanded', isNotebookExpanded.toString());
  } catch (error) {
    console.warn('Failed to save notebook expanded state', error);
  }
}, [isNotebookExpanded]);
```

### Anti-Patterns to Avoid
- **Wrapping NotebookLayout in extra providers:** FocusProvider and TerminalProvider are already inside NotebookLayout, don't duplicate them
- **Hard-coded heights:** Use flexible sizing (h-96, max-h-screen, etc.) to adapt to different screen sizes
- **Skipping localStorage error handling:** Always wrap localStorage calls in try/catch (Safari private mode throws)
- **Re-implementing Collapsible:** Use the existing component, it's already tested and works
- **Mixing theme systems:** Always use ThemeContext, never hard-code NeXTSTEP/Modern styles

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible panel component | Custom expand/collapse logic with useState and CSS classes | Existing `Collapsible` component in `src/components/ui/collapsible.tsx` | Already exists, handles controlled/uncontrolled modes, children cloning for prop injection |
| Animation system | Custom CSS keyframes, animation state management | Tailwind's `transition-all` + `tailwindcss-animate` plugin | Already configured, works with Tailwind classes, no JS needed |
| Theme switching | Props drilling or hard-coded theme values | `useTheme()` hook from ThemeContext | Centralized theme state, used everywhere in codebase |
| State persistence | Custom localStorage wrapper, IndexedDB | Direct localStorage with try/catch pattern from NotebookContext | Simple, synchronous, matches existing patterns |
| Keyboard navigation | Custom focus management | FocusProvider and TerminalProvider already in NotebookLayout | Handles Cmd+1/2/3 shortcuts, screen reader announcements, focus ring management |

**Key insight:** Every piece of infrastructure needed for this phase already exists in the codebase. The task is wiring, not building. Resist the urge to "improve" or "enhance" existing components - just use them as-is.

## Common Pitfalls

### Pitfall 1: NotebookProvider Placement
**What goes wrong:** NotebookLayout renders but `useNotebook()` throws "must be used within NotebookProvider"
**Why it happens:** NotebookProvider is not an ancestor of IntegratedLayout in the component tree
**How to avoid:** Add NotebookProvider in App.tsx or root layout, wrapping the entire app (or at least IntegratedLayout)
**Warning signs:** Console error "useNotebook must be used within a NotebookProvider", notebook panes don't render

### Pitfall 2: localStorage QuotaExceededError in Private Mode
**What goes wrong:** App crashes with QuotaExceededError when toggling notebook panel
**Why it happens:** Safari private mode throws on localStorage.setItem, not on getItem
**How to avoid:** Always wrap localStorage.setItem in try/catch, log warning but don't throw
**Warning signs:** Works in normal mode, crashes in private browsing

### Pitfall 3: Z-Index Conflicts with SuperGrid
**What goes wrong:** Expanded notebook panel overlaps SuperGrid or gets hidden behind it
**Why it happens:** CSS stacking context issues, incorrect layer ordering
**How to avoid:** Use flex column layout with explicit order, not absolute positioning
**Warning signs:** Panel doesn't expand visually, content gets clipped, SVG overlays panel

### Pitfall 4: Animation Jank on Large Notebook Content
**What goes wrong:** Collapse animation stutters or freezes when notebook has many cards
**Why it happens:** Browser re-layout during height transition with complex DOM
**How to avoid:** Use `max-h-96` (fixed max height) instead of `h-auto`, hide overflow during animation
**Warning signs:** Smooth when empty, janky when notebook has >50 cards, slow on low-end devices

### Pitfall 5: Forgetting Collapsed State as Default
**What goes wrong:** Notebook starts expanded on first load, obscuring SuperGrid
**Why it happens:** useState default is `true` or missing, localStorage returns null on first load
**How to avoid:** Default to `false` (collapsed), only expand if localStorage explicitly says 'true'
**Warning signs:** User feedback: "Why is this big panel blocking my grid?", empty localStorage shows expanded state

### Pitfall 6: Not Respecting NotebookLayout's Self-Contained Context
**What goes wrong:** Trying to pass FocusProvider or TerminalProvider into NotebookLayout from outside
**Why it happens:** Misunderstanding that NotebookLayout component wraps children with these providers internally
**How to avoid:** Review NotebookLayout.tsx (lines 270-277) - it exports a component that wraps NotebookLayoutInner with both providers
**Warning signs:** Duplicate provider warnings, keyboard shortcuts don't work, terminal state conflicts

## Code Examples

Verified patterns from codebase:

### Embedding NotebookLayout in Collapsible Panel
```typescript
// Source: Synthesized from IntegratedLayout.tsx + NotebookLayout.tsx patterns
import { useState, useEffect } from 'react';
import { NotebookLayout } from './notebook/NotebookLayout';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useTheme } from '@/contexts/ThemeContext';

function IntegratedLayout() {
  const { theme } = useTheme();
  const [isNotebookExpanded, setIsNotebookExpanded] = useState(() => {
    try {
      return localStorage.getItem('notebook_expanded') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('notebook_expanded', isNotebookExpanded.toString());
    } catch (err) {
      console.warn('Failed to persist notebook state', err);
    }
  }, [isNotebookExpanded]);

  const isNeXTSTEP = theme === 'NeXTSTEP';
  const panelBg = isNeXTSTEP ? 'bg-[#252525]' : 'bg-white';
  const borderColor = isNeXTSTEP ? 'border-[#3A3A3A]' : 'border-gray-200';

  return (
    <div className="h-screen flex flex-col">
      {/* Command Bar */}
      <div className={`h-8 ${panelBg} border-b ${borderColor}`}>
        {/* ...existing command bar... */}
      </div>

      {/* Notebook Panel */}
      <Collapsible open={isNotebookExpanded} onOpenChange={setIsNotebookExpanded}>
        <CollapsibleTrigger>
          <div className={`
            h-8 ${panelBg} border-b ${borderColor}
            flex items-center px-4 gap-2
            cursor-pointer hover:bg-opacity-80
          `}>
            <span className="text-xs">{isNotebookExpanded ? '▼' : '▶'}</span>
            <span className="text-xs font-medium">Notebook</span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={`h-96 border-b ${borderColor}`}>
            <NotebookLayout />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Rest of layout (Dataset Switcher, LatchNavigator, PafvNavigator, SuperGrid) */}
      {/* ...existing components... */}
    </div>
  );
}
```

### NotebookProvider Wiring in App Root
```typescript
// Source: NotebookContext.tsx usage pattern
import { NotebookProvider } from '@/contexts/NotebookContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { IntegratedLayout } from '@/components/IntegratedLayout';

function App() {
  return (
    <ThemeProvider>
      <NotebookProvider>
        <IntegratedLayout />
      </NotebookProvider>
    </ThemeProvider>
  );
}
```

### Toggle Button with Theme Support
```typescript
// Source: IntegratedLayout.tsx button patterns (lines 489-504)
const toggleButton = (
  <button
    onClick={() => setIsNotebookExpanded(!isNotebookExpanded)}
    className={`
      h-8 ${panelBg} border-b ${borderColor}
      flex items-center px-4 gap-2 w-full
      cursor-pointer transition-colors
      ${isNeXTSTEP ? 'hover:bg-[#2D2D2D]' : 'hover:bg-gray-100'}
    `}
  >
    <span className="text-xs">{isNotebookExpanded ? '▼' : '▶'}</span>
    <span className="text-xs font-medium">Notebook</span>
    <span className="ml-auto text-[10px] text-gray-500">
      {isNotebookExpanded ? 'Collapse' : 'Expand'}
    </span>
  </button>
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate notebook view mode | Integrated collapsible panel | This phase | Notebook accessible from SuperGrid without view switching |
| Hard-coded panel heights | Flexible Tailwind sizing (h-96, max-h-screen) | Existing practice | Responsive to different screen sizes |
| Inline CSS animations | Tailwind transition utilities + tailwindcss-animate | Already in use | Declarative, no JS animation logic |
| Props drilling for theme | useTheme() hook | Already in use | Centralized theme state |

**Deprecated/outdated:**
- ViewMode switching between 'notebook' and 'supergrid' (see MVPDemo.tsx) - Phase 80 makes notebook always accessible, not mutually exclusive with SuperGrid

## Open Questions

1. **Fixed height vs. resizable notebook panel**
   - What we know: Collapsible panel needs a height when expanded
   - What's unclear: Should users be able to drag-resize the panel height, or is fixed h-96 sufficient?
   - Recommendation: Start with fixed h-96 (384px), add resize handle in Phase 81 if user feedback demands it

2. **Keyboard shortcut for toggle**
   - What we know: NotebookLayout uses Cmd+1/2/3 for pane focus
   - What's unclear: Should there be a global shortcut (e.g., Cmd+N) to toggle notebook panel?
   - Recommendation: No shortcut for MVP, rely on mouse click. Add in polish phase if requested.

3. **Notebook state when collapsed**
   - What we know: NotebookLayout is self-contained with its own state
   - What's unclear: Should NotebookLayout unmount when collapsed (save memory) or stay mounted (preserve scroll position)?
   - Recommendation: Keep mounted - CollapsibleContent uses `display: none`, not unmounting. Preserves state, minimal memory cost.

## Sources

### Primary (HIGH confidence)
- `src/components/notebook/NotebookLayout.tsx` - Complete three-pane notebook implementation with FocusProvider and TerminalProvider wrappers
- `src/contexts/NotebookContext.tsx` - NotebookProvider, state management, localStorage persistence pattern
- `src/components/IntegratedLayout.tsx` - Target integration location, theme usage patterns, component structure
- `src/components/ui/collapsible.tsx` - Existing collapsible component implementation
- `src/contexts/ThemeContext.tsx` - Theme system (NeXTSTEP/Modern)
- `src/context/FocusContext.tsx` - Keyboard navigation for notebook panes
- `package.json` - Installed dependencies (React, Tailwind, tailwindcss-animate)
- `tailwind.config.js` - Tailwind configuration with tailwindcss-animate plugin

### Secondary (MEDIUM confidence)
- `src/MVPDemo.tsx` - Shows isNotebookMode pattern and view mode switching (being deprecated by this phase)
- `src/components/supergrid/SuperSize.tsx` - Example of Collapsible component usage in production code

### Tertiary (LOW confidence)
- None - all findings verified from primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture: HIGH - All components exist, patterns well-established in codebase
- Pitfalls: HIGH - Based on localStorage patterns in NotebookContext, Collapsible component implementation, and React strict mode considerations

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days - stable established patterns, no fast-moving dependencies)
