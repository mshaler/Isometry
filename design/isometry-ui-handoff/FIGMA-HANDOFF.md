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

---

## Architectural Decision: React + D3 Hybrid

**Decision**: Keep react-dnd for drag-drop interactions; use D3 for data-bound rendering.

| Layer | Technology | Examples |
|-------|------------|----------|
| **Control Chrome** | React | Sidebars, dropdowns, settings panels |
| **Data Visualization** | D3.js | Canvas content, cards, graphs |

**Do NOT**: Rewrite react-dnd to pure D3 drag — save effort for higher-impact work.

---

## Architectural Decisions

### Map Provider: MapLibre GL JS ✓
Replace OpenStreetMap iframe with MapLibre GL JS for v3.1 Location FilterNav.

### Icon Set: Keep lucide-react ✓
MIT licensed, tree-shakeable, covers 99% of needs.

### State Management: SQLite + URL + Context ✓
Do NOT add Zustand/Jotai. SQLite is already the state manager.

| State Type | Where It Lives | Why |
|------------|----------------|-----|
| **Data state** | SQLite | Cards, edges, facets |
| **View state** | URL params | Active app, view, dataset |
| **UI state** | React Context | Theme, panel collapsed |
| **Filter state** | SQLite + URL | LATCH → SQL WHERE |

---

## Integration Tasks for Claude Code

### Phase 1: Setup & Context
1. Install dependencies: `react-dnd`, `lucide-react`
2. Configure Tailwind with custom NeXTSTEP colors
3. Test theme switching

### Phase 2: Component Migration
1. Copy component files to `src/components/`
2. Fix import paths (`@/contexts/ThemeContext`)
3. Create layout shell composing all components

### Phase 3: State Integration
1. Connect Navigator dropdowns to app state
2. Connect PAFVNavigator wells to PAFV state management
3. Wire Sidebar filter items to FilterNav accordion

### Phase 4: Data Binding
1. Replace hardcoded data in dropdowns with SQLite queries
2. Connect Card to actual node data
3. Wire NavigatorFooter map to SpatiaLite queries

---

## Critical Integration Concerns

### 1. Hardcoded Data Everywhere 🚨
Replace static arrays with SQLite queries:
```tsx
// BEFORE
const apps = ['Demo', 'Inbox', 'Projects'];

// AFTER
const apps = useSQLiteQuery('SELECT name FROM apps WHERE active = 1');
```

### 2. Missing Loading/Error States 🚨
Add Skeleton loaders, EmptyState, ErrorBoundary components.

### 3. Canvas → D3 Handoff 🚨
Replace React Card rendering with D3 data binding.

### 4. Command Bar → DSL Connection 🚨
Wire CommandBar to DSL parser.

---

## Theme System

### NeXTSTEP Theme
- **Background**: `#c0c0c0`
- **Raised elements**: `#d4d4d4` with beveled borders
- **Selection**: Black background, white text

### Modern Theme  
- **Background**: `bg-white/80 backdrop-blur-xl`
- **Selection**: Blue (`blue-500`)
- **Rounded corners**: `rounded-lg`

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar (Menu Bar)                              [NeXT][Mac] │
├─────────────────────────────────────────────────────────────┤
│ Toolbar (Command Buttons)                                   │
├─────────────────────────────────────────────────────────────┤
│ Navigator (Apps/Views/Datasets/Graphs dropdowns)            │
├─────────────────────────────────────────────────────────────┤
│ PAFVNavigator (drag-drop wells: Available | X | Y | Z)      │
├──────────┬────────────────────────────────────┬─────────────┤
│ Sidebar  │         Canvas                     │ RightSidebar│
│ [Filters]│         (D3 visualization)         │ [Formats]   │
│ [Templat]│                                    │ [Settings]  │
├──────────┴────────────────────────────────────┴─────────────┤
│ NavigatorFooter [Location Map | Time Slider]                │
├─────────────────────────────────────────────────────────────┤
│ CommandBar [⌘] [Enter command...]                           │
└─────────────────────────────────────────────────────────────┘
```
