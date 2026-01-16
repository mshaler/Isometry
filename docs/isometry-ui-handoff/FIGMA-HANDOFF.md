# Isometry UI Design Handoff

*Figma Make Export → Claude Code Integration Guide*
*January 2026*

---

## Executive Summary

This document provides Claude Code with everything needed to integrate the Figma Make UI components into the Isometry application. The design includes 9 React/TSX components with dual-theme support (NeXTSTEP retro + Modern macOS 26).

---

## Component Inventory

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| `Toolbar.tsx` | App menu bar + toolbar | Nested menus, theme toggle, command buttons |
| `Navigator.tsx` | Top navigation | Apps/Views/Datasets/Graphs dropdowns |
| `PAFVNavigator.tsx` | Axis assignment | Drag-drop chips (Available → X/Y/Z) |
| `Sidebar.tsx` | Left panel | Filters (LATCH) + Templates tabs |
| `RightSidebar.tsx` | Right panel | Formats + Settings tabs |
| `Canvas.tsx` | Main content area | Excel-style sheet tabs |
| `Card.tsx` | Data card | Properties table, notes, metadata |
| `NavigatorFooter.tsx` | Bottom panel | Location map + Time slider |
| `CommandBar.tsx` | Command input | ⌘ button + text input |

---

## Architecture Mapping: Figma → PAFV/LATCH/GRAPH

### PAFV Navigator (PAFVNavigator.tsx)
Maps directly to PAFV specification:
- **Available well** → Inactive facets
- **x Rows well** → X-plane assignment
- **y Columns well** → Y-plane assignment  
- **z Layers well** → Z-plane assignment (with Audit View checkbox)

**Integration point**: Connect to `FilterNavContext` for state management.

### LATCH Filters (Sidebar.tsx)
The "Filters" tab maps to LATCH:
```
Analytics section:
├── Location     → L in LATCH
├── Alphanumeric → A in LATCH  
├── Time         → T in LATCH
├── Category     → C in LATCH
└── Hierarchy    → H in LATCH

Synthetics section (GRAPH):
├── Links        → Edge traversal
├── Paths        → Pathfinding
├── Vectors      → Embeddings
├── Centrality   → PageRank, Degree, Betweenness
├── Similarity   → Jaccard, Cosine
└── Community    → Louvain, Label Propagation
```

### Location + Time (NavigatorFooter.tsx)
- **Location Map tab** → SpatiaLite integration (v3.1)
- **Time Slider tab** → SuperTimeSlider component

---

## Dependencies

### Required Packages
```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dnd": "^16.x",
    "react-dnd-html5-backend": "^16.x",
    "lucide-react": "^0.263.1",
    "tailwindcss": "^3.x"
  }
}
```

### Required Context
```tsx
// contexts/ThemeContext.tsx
interface ThemeContextType {
  theme: 'NeXTSTEP' | 'Modern';
  setTheme: (theme: 'NeXTSTEP' | 'Modern') => void;
}
```

### Asset Reference
```tsx
// Toolbar.tsx line 13 - needs replacement
import appIcon from 'figma:asset/e114b7afa529d3f027cf8b8f18c991be3962ece7.png';
// Replace with: import appIcon from '@/assets/isometry-icon.png';
```

---

## Theme System

### NeXTSTEP Theme
Classic 1990s NeXTSTEP aesthetic:
- **Background**: `#c0c0c0` (classic gray)
- **Raised elements**: `#d4d4d4` with beveled borders
- **Sunken elements**: `#a0a0a0` with inset shadows
- **Selection**: Black background, white text
- **Border pattern**: Light top/left, dark bottom/right (3D effect)

### Modern Theme  
macOS 26 / glassmorphism aesthetic:
- **Background**: `bg-white/80 backdrop-blur-xl`
- **Selection**: Blue (`blue-500`) 
- **Rounded corners**: `rounded-lg`
- **Shadows**: `shadow-lg`, `shadow-2xl`

### Theme Application Pattern
```tsx
className={`base-styles ${
  theme === 'NeXTSTEP'
    ? 'nextstep-specific-styles'
    : 'modern-specific-styles'
}`}
```

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar (Menu Bar)                              [NeXT][Mac] │
├─────────────────────────────────────────────────────────────┤
│ Toolbar (Command Buttons)              [New][Open][Save]... │
├─────────────────────────────────────────────────────────────┤
│ Navigator (Apps/Views/Datasets/Graphs dropdowns)        [▾] │
├─────────────────────────────────────────────────────────────┤
│ PAFVNavigator (drag-drop wells: Available | X | Y | Z)      │
├──────────┬────────────────────────────────────┬─────────────┤
│ Sidebar  │                                    │ RightSidebar│
│ [Filters]│         Canvas                     │ [Formats]   │
│ [Templat]│         (with Card)                │ [Settings]  │
│          │                                    │             │
│ Analytics│                                    │ View        │
│ -Location│                                    │ Cell        │
│ -Alpha.. │                                    │ Text        │
│ -Time    │                                    │ Arrange     │
│ -Category│                                    │ Cond.Format │
│ -Hierarc │                                    │             │
│          │                                    │             │
│ Syntheti │                                    │             │
│ -Links   │                                    │             │
│ -Paths   │                                    │             │
│ ...      │         [Tab1][Tab2][Tab3]         │             │
├──────────┴────────────────────────────────────┴─────────────┤
│ NavigatorFooter [Location Map | Time Slider]            [▾] │
├─────────────────────────────────────────────────────────────┤
│ CommandBar [⌘] [Enter command...]                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Tasks for Claude Code

### Phase 1: Setup & Context
1. Create `ThemeContext.tsx` with NeXTSTEP/Modern toggle
2. Install dependencies: `react-dnd`, `lucide-react`
3. Configure Tailwind with custom NeXTSTEP colors
4. Replace Figma asset import with local icon

### Phase 2: Component Migration
1. Copy all 9 TSX files to `src/components/`
2. Fix import paths (`@/contexts/ThemeContext`)
3. Create `App.tsx` layout shell composing all components
4. Test theme switching

### Phase 3: State Integration
1. Connect `Navigator.tsx` dropdowns to app state (activeApp, activeView, etc.)
2. Connect `PAFVNavigator.tsx` wells to PAFV state management
3. Wire `Sidebar.tsx` filter items to FilterNav accordion (GitHub issues #1-8)
4. Connect `Canvas.tsx` sheet tabs to canvas/view state

### Phase 4: Data Binding
1. Replace hardcoded data in dropdowns with dynamic data from SQLite
2. Connect `Card.tsx` to actual node data
3. Wire `NavigatorFooter.tsx` map to SpatiaLite queries
4. Connect time slider to actual date ranges

---

## File-by-File Notes

### Toolbar.tsx
- **Lines 13**: Replace Figma asset import
- **Lines 33-143**: Menu structure - extend with real actions
- **Lines 46-58**: Theme switching already wired to context

### Navigator.tsx  
- **Lines 14-64**: Hardcoded dropdown options - replace with dynamic data
- **Line 7**: Imports PAFVNavigator - correct composition

### PAFVNavigator.tsx
- **Lines 1-3**: Uses react-dnd - ensure package installed
- **Lines 97-110**: Initial well state - connect to persistent storage
- **Lines 112-119**: moveChip function - add state persistence

### Sidebar.tsx
- **Lines 21-38**: LATCH filter structure - matches spec perfectly
- **Line 48**: `handleItemClick` - wire to FilterNav panel triggers

### RightSidebar.tsx
- **Lines 42-111**: Format sections with full UI - connect to cell formatting
- **Lines 113-123**: Settings sections placeholder - implement

### Canvas.tsx
- **Line 6**: Imports Card - for demo, replace with D3 rendering
- **Lines 12-14**: Sheet tabs - connect to canvas state

### Card.tsx
- **Lines 66-82**: Properties table - bind to node.properties
- **Lines 85-97**: Notes textarea - bind to node.content

### NavigatorFooter.tsx
- **Lines 13-17**: Boulder coordinates hardcoded - make dynamic
- **Line 20**: OpenStreetMap embed - consider MapLibre GL JS upgrade

### CommandBar.tsx
- **Line 14**: `handleCommandSubmit` - wire to DSL parser

---

## Tailwind Configuration

Add NeXTSTEP colors to `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        nextstep: {
          bg: '#c0c0c0',
          raised: '#d4d4d4',
          sunken: '#a0a0a0',
          border: {
            light: '#e8e8e8',
            dark: '#505050',
            mid: '#808080',
          },
          text: {
            primary: '#000000',
            secondary: '#404040',
            muted: '#606060',
          }
        }
      }
    }
  }
}
```

---

## Testing Checklist

- [ ] Theme toggle works globally
- [ ] All dropdowns open/close correctly
- [ ] PAFV drag-drop moves chips between wells
- [ ] Sidebar accordion expands/collapses
- [ ] Right sidebar tabs switch content
- [ ] Canvas sheet tabs work
- [ ] Card close button hides card
- [ ] Card properties table collapses
- [ ] Navigator footer tabs switch map/slider
- [ ] Navigator footer collapse toggle works
- [ ] Command bar accepts input

---

## Related GitHub Issues

These Figma components implement UI for:
- Issue #1: FilterNav Accordion Infrastructure (Sidebar.tsx)
- Issue #6: PAFV Navigator (PAFVNavigator.tsx)
- Issue #4: SuperTimeSlider (NavigatorFooter.tsx time slider)
- Issue #9: Location FilterNav (NavigatorFooter.tsx map)

---

## Questions for Michael

1. **D3 Integration**: Should Canvas.tsx render Cards via React or transition to D3?
2. **Map Provider**: Keep OpenStreetMap iframe or upgrade to MapLibre GL JS?
3. **Icon Set**: Continue with lucide-react or switch to custom icons?
4. **State Management**: Use React Context or add Zustand/Jotai?

---

*Generated from Figma Make export, January 2026*
