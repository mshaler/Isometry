#!/bin/bash

# ============================================================================
# Add Figma Components to Isometry Project
# ============================================================================
# Run this AFTER setup-isometry.sh to add all Figma TSX components
# ============================================================================

set -e

DEFAULT_PROJECT_PATH="$HOME/Developer/Projects/Isometry"
PROJECT_PATH="${1:-$DEFAULT_PROJECT_PATH}"
DESIGN_DIR="$PROJECT_PATH/design/isometry-ui-handoff"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Adding Figma components to Isometry...${NC}"
echo ""

mkdir -p "$DESIGN_DIR/components"
mkdir -p "$DESIGN_DIR/scripts"

# ============================================================================
# FIGMA-HANDOFF.md
# ============================================================================
echo -e "${YELLOW}Creating FIGMA-HANDOFF.md...${NC}"
cat > "$DESIGN_DIR/FIGMA-HANDOFF.md" << 'HANDOFF_EOF'
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
HANDOFF_EOF

# ============================================================================
# Toolbar.tsx
# ============================================================================
echo -e "${YELLOW}Creating Toolbar.tsx...${NC}"
cat > "$DESIGN_DIR/components/Toolbar.tsx" << 'TOOLBAR_EOF'
import { useState } from 'react';
import { FileText, Save, FolderOpen, Download, Grid3x3, Layers, BarChart3 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface MenuItem {
  label: string;
  action?: () => void;
  separator?: boolean;
  submenu?: MenuItem[];
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

export function Toolbar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  const menuSections: MenuSection[] = [
    {
      label: 'Isometry',
      items: [
        { label: 'About Isometry', action: () => console.log('About') },
        { separator: true },
        { 
          label: 'Settings',
          submenu: [
            { 
              label: 'Theme', 
              submenu: [
                { label: 'NeXTSTEP', action: () => setTheme('NeXTSTEP') },
                { label: 'Modern', action: () => setTheme('Modern') },
              ]
            },
          ]
        },
        { separator: true },
        { label: 'Quit Isometry', action: () => console.log('Quit') },
      ]
    },
    {
      label: 'File',
      items: [
        { label: 'New…', action: () => console.log('New') },
        { label: 'Open…', action: () => console.log('Open') },
        { separator: true },
        { label: 'Save As…', action: () => console.log('Save As') },
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', action: () => console.log('Undo') },
        { label: 'Redo', action: () => console.log('Redo') },
        { separator: true },
        { label: 'Cut', action: () => console.log('Cut') },
        { label: 'Copy', action: () => console.log('Copy') },
        { label: 'Paste', action: () => console.log('Paste') },
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Workbench', action: () => console.log('Workbench') },
        { label: 'Apps', action: () => console.log('Apps') },
        { label: 'Datasets', action: () => console.log('Datasets') },
      ]
    },
  ];

  const commandButtons = [
    { icon: FileText, label: 'New', action: () => console.log('New') },
    { icon: FolderOpen, label: 'Open', action: () => console.log('Open') },
    { icon: Save, label: 'Save', action: () => console.log('Save') },
    { icon: Download, label: 'Export', action: () => console.log('Export') },
  ];

  const appLauncherButtons = [
    { icon: Grid3x3, label: 'Grid View', action: () => console.log('Grid View') },
    { icon: Layers, label: 'Dimensions', action: () => console.log('Dimensions') },
    { icon: BarChart3, label: 'Charts', action: () => console.log('Charts') },
  ];

  return (
    <div className="relative">
      {/* Menu Bar */}
      <div className={`h-7 flex items-center px-1 ${
        theme === 'NeXTSTEP' 
          ? 'bg-[#c0c0c0] border-b-2 border-[#505050]'
          : 'bg-white/80 backdrop-blur-xl border-b border-gray-200'
      }`}>
        {/* Menu Items */}
        <div className="flex items-center">
          {menuSections.map((section) => (
            <div key={section.label} className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === section.label ? null : section.label)}
                className={`px-3 py-0.5 text-sm ${
                  theme === 'NeXTSTEP'
                    ? openMenu === section.label ? 'bg-black text-white' : 'hover:bg-[#a0a0a0]'
                    : openMenu === section.label ? 'bg-blue-500 text-white rounded' : 'hover:bg-gray-100 rounded'
                }`}
              >
                {section.label}
              </button>
              {openMenu === section.label && (
                <div className={`absolute top-full left-0 mt-0 min-w-[160px] z-50 ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#d4d4d4] border-2 border-black shadow-lg'
                    : 'bg-white/95 backdrop-blur-xl rounded-lg border border-gray-200 shadow-2xl'
                }`}>
                  {section.items.map((item, index) => (
                    item.separator ? (
                      <div key={index} className={`my-1 ${theme === 'NeXTSTEP' ? 'border-t border-gray-500' : 'border-t border-gray-200'}`} />
                    ) : (
                      <button
                        key={index}
                        onClick={() => { item.action?.(); setOpenMenu(null); }}
                        className={`w-full px-4 py-1.5 text-left text-sm ${
                          theme === 'NeXTSTEP'
                            ? 'hover:bg-black hover:text-white'
                            : 'hover:bg-blue-500 hover:text-white rounded-md mx-1'
                        }`}
                      >
                        {item.label}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex-1" />

        {/* Theme Toggle */}
        <div className="flex items-center gap-1 mr-1">
          <button
            onClick={() => setTheme('NeXTSTEP')}
            className={`px-3 py-0.5 text-xs ${
              theme === 'NeXTSTEP' ? 'bg-black text-white' : 'bg-gray-100 hover:bg-gray-200 rounded'
            }`}
          >NeXTSTEP</button>
          <button
            onClick={() => setTheme('Modern')}
            className={`px-3 py-0.5 text-xs ${
              theme === 'Modern' ? 'bg-blue-500 text-white rounded' : 'bg-gray-100 hover:bg-gray-200 rounded'
            }`}
          >Modern</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={`h-12 flex items-center px-2 gap-1 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#c0c0c0] border-b-2 border-[#505050]'
          : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
      }`}>
        {commandButtons.map((button, index) => (
          <button
            key={index}
            onClick={button.action}
            className={`w-10 h-10 flex items-center justify-center ${
              theme === 'NeXTSTEP'
                ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] hover:bg-[#d8d8d8]'
                : 'rounded-lg hover:bg-gray-100'
            }`}
            title={button.label}
          >
            <button.icon className="w-5 h-5" />
          </button>
        ))}

        <div className={theme === 'NeXTSTEP' ? 'w-[3px] h-8 bg-[#808080] mx-1' : 'w-px h-8 bg-gray-300 mx-2'} />

        {appLauncherButtons.map((button, index) => (
          <button
            key={index}
            onClick={button.action}
            className={`w-10 h-10 flex items-center justify-center ${
              theme === 'NeXTSTEP'
                ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] hover:bg-[#d8d8d8]'
                : 'rounded-lg hover:bg-gray-100'
            }`}
            title={button.label}
          >
            <button.icon className="w-5 h-5" />
          </button>
        ))}

        <div className="flex-1" />
      </div>
    </div>
  );
}
TOOLBAR_EOF

# ============================================================================
# Navigator.tsx
# ============================================================================
echo -e "${YELLOW}Creating Navigator.tsx...${NC}"
cat > "$DESIGN_DIR/components/Navigator.tsx" << 'NAV_EOF'
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PAFVNavigator } from './PAFVNavigator';
import { useTheme } from '@/contexts/ThemeContext';

export function Navigator() {
  const [activeApp, setActiveApp] = useState('Demo');
  const [activeView, setActiveView] = useState('List');
  const [activeDataset, setActiveDataset] = useState('ETL');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme } = useTheme();

  // TODO: Replace with SQLite queries
  const apps = ['Demo', 'Inbox', 'Projects', 'LinkedIn', 'MTGs', 'ReadWatch'];
  const views = ['List', 'Gallery', 'Timeline', 'Calendar', 'Tree', 'Kanban', 'Grid', 'Charts', 'Graphs'];
  const datasets = ['ETL', 'CAS', 'Catalog', 'Taxonomy', 'Notes', 'Projects', 'Contacts', 'Messages'];

  const Dropdown = ({ label, value, options, onSelect, dropdownKey }: any) => (
    <div className="relative">
      <div className="flex items-center gap-1">
        <span className={`text-xs whitespace-nowrap ${theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'}`}>
          {label}:
        </span>
        <button
          onClick={() => setOpenDropdown(openDropdown === dropdownKey ? null : dropdownKey)}
          className={`h-7 px-3 flex items-center gap-2 text-sm min-w-[120px] justify-between ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
              : 'bg-white hover:bg-gray-50 rounded-lg border border-gray-300'
          }`}
        >
          <span>{value}</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
      {openDropdown === dropdownKey && (
        <div className={`absolute top-full left-[40px] mt-1 w-[140px] z-50 ${
          theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border-2 border-black shadow-lg'
            : 'bg-white/95 backdrop-blur-xl rounded-lg border border-gray-200 shadow-2xl'
        }`}>
          {options.map((opt: string) => (
            <button
              key={opt}
              onClick={() => { onSelect(opt); setOpenDropdown(null); }}
              className={`w-full h-7 px-3 text-left text-sm ${
                theme === 'NeXTSTEP'
                  ? `hover:bg-black hover:text-white ${value === opt ? 'bg-black text-white' : ''}`
                  : `hover:bg-blue-500 hover:text-white ${value === opt ? 'bg-blue-500 text-white' : ''}`
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className={`h-12 flex items-center px-3 gap-4 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#b8b8b8] border-b-2 border-[#505050]'
          : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
      }`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`h-7 w-7 flex items-center justify-center ${
            theme === 'NeXTSTEP'
              ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
              : 'bg-gray-100 hover:bg-gray-200 rounded-lg'
          }`}
        >
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <Dropdown label="Apps" value={activeApp} options={apps} onSelect={setActiveApp} dropdownKey="apps" />
        <Dropdown label="Views" value={activeView} options={views} onSelect={setActiveView} dropdownKey="views" />
        <Dropdown label="Datasets" value={activeDataset} options={datasets} onSelect={setActiveDataset} dropdownKey="datasets" />
      </div>
      
      {isExpanded && <PAFVNavigator />}
    </>
  );
}
NAV_EOF

# ============================================================================
# PAFVNavigator.tsx
# ============================================================================
echo -e "${YELLOW}Creating PAFVNavigator.tsx...${NC}"
cat > "$DESIGN_DIR/components/PAFVNavigator.tsx" << 'PAFV_EOF'
import { useState } from 'react';
import { useDrag, useDrop, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTheme } from '@/contexts/ThemeContext';

interface Chip {
  id: string;
  label: string;
  hasCheckbox?: boolean;
  checked?: boolean;
}

const ItemType = 'CHIP';

function DraggableChip({ chip, well, index, moveChip, toggleCheckbox, theme }: any) {
  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: { well, index, chip },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [, drop] = useDrop({
    accept: ItemType,
    hover: (item: any) => {
      if (item.well !== well || item.index !== index) {
        moveChip(item.well, item.index, well, index);
        item.well = well;
        item.index = index;
      }
    },
  });

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`flex items-center gap-1.5 h-7 px-2.5 cursor-move text-xs w-full ${
        isDragging ? 'opacity-50' : 'opacity-100'
      } ${
        theme === 'NeXTSTEP'
          ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
          : 'bg-white hover:bg-gray-50 rounded-md border border-gray-300'
      }`}
    >
      {chip.hasCheckbox && (
        <input
          type="checkbox"
          checked={chip.checked || false}
          onChange={() => toggleCheckbox(well, chip.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-3 h-3 cursor-pointer"
        />
      )}
      <span>{chip.label}</span>
    </div>
  );
}

function DropWell({ title, well, chips, moveChip, toggleCheckbox, theme }: any) {
  const [, drop] = useDrop({
    accept: ItemType,
    drop: (item: any) => {
      if (item.well !== well) {
        moveChip(item.well, item.index, well, chips.length);
      }
    },
  });

  return (
    <div className="flex-1 min-w-0">
      <div className={`text-[10px] mb-1 px-1 ${theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'}`}>
        {title}
      </div>
      <div
        ref={drop}
        className={`min-h-[140px] p-2 flex flex-col gap-1.5 ${
          theme === 'NeXTSTEP'
            ? 'bg-[#a0a0a0] border-t-2 border-l-2 border-[#606060] border-b-2 border-r-2 border-r-[#d0d0d0] border-b-[#d0d0d0]'
            : 'bg-gray-50 border border-gray-300 rounded-lg'
        }`}
      >
        {chips.map((chip: Chip, index: number) => (
          <DraggableChip key={chip.id} chip={chip} well={well} index={index} moveChip={moveChip} toggleCheckbox={toggleCheckbox} theme={theme} />
        ))}
      </div>
    </div>
  );
}

function PAFVNavigatorContent() {
  const { theme } = useTheme();
  const [wells, setWells] = useState<Record<string, Chip[]>>({
    available: [],
    xRows: [
      { id: 'folder', label: 'Folder' },
      { id: 'subfolder', label: 'Sub-folder' },
      { id: 'tags', label: 'Tags' },
    ],
    yColumns: [
      { id: 'year', label: 'Year' },
      { id: 'month', label: 'Month' },
    ],
    zLayers: [
      { id: 'auditview', label: 'Audit View', hasCheckbox: true, checked: false },
    ],
  });

  const moveChip = (fromWell: string, fromIndex: number, toWell: string, toIndex: number) => {
    setWells((prev) => {
      const newWells = { ...prev };
      const [movedChip] = newWells[fromWell].splice(fromIndex, 1);
      newWells[toWell].splice(toIndex, 0, movedChip);
      return newWells;
    });
  };

  const toggleCheckbox = (well: string, chipId: string) => {
    setWells((prev) => ({
      ...prev,
      [well]: prev[well].map((chip) =>
        chip.id === chipId ? { ...chip, checked: !chip.checked } : chip
      ),
    }));
  };

  return (
    <div className={`p-3 ${
      theme === 'NeXTSTEP'
        ? 'bg-[#b8b8b8] border-b-2 border-[#505050]'
        : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
    }`}>
      <div className="flex gap-3">
        <DropWell title="Available" well="available" chips={wells.available} moveChip={moveChip} toggleCheckbox={toggleCheckbox} theme={theme} />
        <DropWell title="x Rows" well="xRows" chips={wells.xRows} moveChip={moveChip} toggleCheckbox={toggleCheckbox} theme={theme} />
        <DropWell title="y Columns" well="yColumns" chips={wells.yColumns} moveChip={moveChip} toggleCheckbox={toggleCheckbox} theme={theme} />
        <DropWell title="z Layers" well="zLayers" chips={wells.zLayers} moveChip={moveChip} toggleCheckbox={toggleCheckbox} theme={theme} />
      </div>
    </div>
  );
}

export function PAFVNavigator() {
  return (
    <DndProvider backend={HTML5Backend}>
      <PAFVNavigatorContent />
    </DndProvider>
  );
}
PAFV_EOF

# ============================================================================
# Sidebar.tsx
# ============================================================================
echo -e "${YELLOW}Creating Sidebar.tsx...${NC}"
cat > "$DESIGN_DIR/components/Sidebar.tsx" << 'SIDEBAR_EOF'
import { useState } from 'react';
import { ChevronDown, ChevronRight, Filter, FileText } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

type TabType = 'filters' | 'templates';

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('filters');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Analytics', 'Synthetics']));
  const { theme } = useTheme();

  const filterSections = [
    { title: 'Analytics', items: ['Location', 'Alphanumeric', 'Time', 'Category', 'Hierarchy'] },
    { title: 'Synthetics', items: ['Links', 'Paths', 'Vectors', 'Centrality', 'Similarity', 'Community'] },
    { title: 'Formulas', items: ['Active Filters', 'Formulas', 'Algorithms', 'Audit View', 'Versions'] }
  ];

  const templateBuilders = ['Apps Builder', 'Views Builder', 'Buttons Builder', 'Charts Builder'];

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) newExpanded.delete(title);
    else newExpanded.add(title);
    setExpandedSections(newExpanded);
  };

  return (
    <div className={`w-64 h-full flex flex-col ${
      theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-r-2 border-[#505050]'
        : 'bg-white/80 backdrop-blur-xl border-r border-gray-200'
    }`}>
      {/* Tabs */}
      <div className={theme === 'NeXTSTEP' ? 'flex border-b-2 border-[#808080]' : 'flex border-b border-gray-200'}>
        <button
          onClick={() => setActiveTab('filters')}
          className={`flex-1 h-9 flex items-center justify-center gap-2 ${
            theme === 'NeXTSTEP'
              ? activeTab === 'filters' ? 'bg-[#d4d4d4]' : 'bg-[#b0b0b0]'
              : activeTab === 'filters' ? 'bg-white text-blue-500 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm">Filters</span>
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 h-9 flex items-center justify-center gap-2 ${
            theme === 'NeXTSTEP'
              ? activeTab === 'templates' ? 'bg-[#d4d4d4]' : 'bg-[#b0b0b0]'
              : activeTab === 'templates' ? 'bg-white text-blue-500 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="text-sm">Templates</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'filters' && filterSections.map((section) => (
          <div key={section.title} className="mb-1">
            <button
              onClick={() => toggleSection(section.title)}
              className={`w-full h-8 px-2 flex items-center gap-2 ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#a8a8a8] border-t-2 border-l-2 border-[#c8c8c8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050]'
                  : 'bg-gray-100 hover:bg-gray-200 rounded-lg'
              }`}
            >
              {expandedSections.has(section.title) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-medium text-sm">{section.title}</span>
            </button>
            {expandedSections.has(section.title) && (
              <div className="mt-1 ml-2 space-y-0.5">
                {section.items.map((item) => (
                  <button
                    key={item}
                    onClick={() => console.log('Selected:', item)}
                    className={`w-full h-7 px-3 text-left text-sm ${
                      theme === 'NeXTSTEP'
                        ? 'bg-[#d4d4d4] border border-[#a0a0a0] hover:bg-black hover:text-white'
                        : 'bg-white hover:bg-blue-500 hover:text-white rounded-md border border-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {activeTab === 'templates' && templateBuilders.map((builder) => (
          <button
            key={builder}
            className={`w-full h-8 px-2 mb-2 flex items-center text-sm ${
              theme === 'NeXTSTEP'
                ? 'bg-[#a8a8a8] border-t-2 border-l-2 border-[#c8c8c8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050]'
                : 'bg-gray-100 hover:bg-gray-200 rounded-lg'
            }`}
          >
            {builder}
          </button>
        ))}
      </div>
    </div>
  );
}
SIDEBAR_EOF

# ============================================================================
# RightSidebar.tsx
# ============================================================================
echo -e "${YELLOW}Creating RightSidebar.tsx...${NC}"
cat > "$DESIGN_DIR/components/RightSidebar.tsx" << 'RSIDEBAR_EOF'
import { useState } from 'react';
import { ChevronDown, ChevronRight, Palette, Settings as SettingsIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

type TabType = 'formats' | 'settings';

export function RightSidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('formats');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['View', 'Cell', 'Text']));
  const { theme } = useTheme();

  const formatSections = ['View', 'Cell', 'Text', 'Arrange', 'Conditional Formatting…'];
  const settingsSections = ['General', 'ETL Datasets', 'Toolbars', 'Formats', 'Views', 'Security'];

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) newExpanded.delete(title);
    else newExpanded.add(title);
    setExpandedSections(newExpanded);
  };

  const inputClass = theme === 'NeXTSTEP'
    ? 'w-full h-7 px-2 bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8] text-sm'
    : 'w-full h-7 px-2 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className={`w-64 h-full flex flex-col ${
      theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-l-2 border-[#e8e8e8]'
        : 'bg-white/80 backdrop-blur-xl border-l border-gray-200'
    }`}>
      {/* Tabs */}
      <div className={theme === 'NeXTSTEP' ? 'flex border-b-2 border-[#808080]' : 'flex border-b border-gray-200'}>
        <button
          onClick={() => setActiveTab('formats')}
          className={`flex-1 h-9 flex items-center justify-center gap-2 ${
            theme === 'NeXTSTEP'
              ? activeTab === 'formats' ? 'bg-[#d4d4d4]' : 'bg-[#b0b0b0]'
              : activeTab === 'formats' ? 'bg-white text-blue-500 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span className="text-sm">Formats</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 h-9 flex items-center justify-center gap-2 ${
            theme === 'NeXTSTEP'
              ? activeTab === 'settings' ? 'bg-[#d4d4d4]' : 'bg-[#b0b0b0]'
              : activeTab === 'settings' ? 'bg-white text-blue-500 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span className="text-sm">Settings</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {(activeTab === 'formats' ? formatSections : settingsSections).map((section) => (
          <div key={section} className="mb-2">
            <button
              onClick={() => toggleSection(section)}
              className={`w-full h-8 px-2 flex items-center gap-2 ${
                theme === 'NeXTSTEP'
                  ? 'bg-[#a8a8a8] border-t-2 border-l-2 border-[#c8c8c8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050]'
                  : 'bg-gray-100 hover:bg-gray-200 rounded-lg'
              }`}
            >
              {expandedSections.has(section) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-medium text-sm">{section}</span>
            </button>
            {expandedSections.has(section) && (
              <div className={`mt-2 px-2 py-3 ${
                theme === 'NeXTSTEP' ? 'bg-[#d4d4d4] border border-[#a0a0a0]' : 'bg-white border border-gray-200 rounded-lg'
              }`}>
                {activeTab === 'formats' && section === 'Text' && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs block mb-1">Font Family</label>
                      <select className={inputClass}>
                        <option>Helvetica</option>
                        <option>Times</option>
                        <option>Courier</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs block mb-1">Size</label>
                        <input type="number" defaultValue="12" className={inputClass} />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs block mb-1">Color</label>
                        <input type="color" defaultValue="#000000" className={inputClass} />
                      </div>
                    </div>
                  </div>
                )}
                {(activeTab === 'settings' || (activeTab === 'formats' && section !== 'Text')) && (
                  <p className="text-xs text-center text-gray-500">Coming soon...</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
RSIDEBAR_EOF

# ============================================================================
# Canvas.tsx
# ============================================================================
echo -e "${YELLOW}Creating Canvas.tsx...${NC}"
cat > "$DESIGN_DIR/components/Canvas.tsx" << 'CANVAS_EOF'
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Card } from './Card';

export function Canvas() {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = ['Tab 1', 'Tab 2', 'Tab 3'];
  const { theme } = useTheme();

  return (
    <div className={`flex-1 flex flex-col m-3 overflow-hidden ${
      theme === 'NeXTSTEP'
        ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
        : 'bg-white rounded-lg shadow-lg border border-gray-200'
    }`}>
      {/* Main Canvas Area - TODO: Replace with D3 rendering */}
      <div className="flex-1 flex items-center justify-center overflow-auto p-8">
        <Card />
      </div>

      {/* Sheet Tabs */}
      <div className={theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-t-2 border-[#808080] flex items-end gap-0.5 px-2 pb-1 pt-2'
        : 'bg-gray-50 border-t border-gray-200 flex items-end gap-1 px-2 pb-1 pt-2'
      }>
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={theme === 'NeXTSTEP'
              ? `px-4 py-1.5 text-sm rounded-t ${
                  activeTab === index
                    ? 'bg-white border-t-2 border-l-2 border-r-2 border-[#808080]'
                    : 'bg-[#b0b0b0] border-t-2 border-l-2 border-r-2 border-[#707070] hover:bg-[#b8b8b8]'
                }`
              : `px-4 py-1.5 text-sm rounded-t-lg ${
                  activeTab === index
                    ? 'bg-white text-gray-900 border-t border-l border-r border-gray-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`
            }
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
CANVAS_EOF

# ============================================================================
# Card.tsx
# ============================================================================
echo -e "${YELLOW}Creating Card.tsx...${NC}"
cat > "$DESIGN_DIR/components/Card.tsx" << 'CARD_EOF'
import { useTheme } from '@/contexts/ThemeContext';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export function Card() {
  const { theme } = useTheme();
  const [isTableExpanded, setIsTableExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  // TODO: Replace with actual node data
  const properties = [
    { label: 'Property 1', value: 'Value 1' },
    { label: 'Property 2', value: 'Value 2' },
    { label: 'Property 3', value: 'Value 3' },
  ];

  return (
    <div className={`w-[400px] relative ${
      theme === 'NeXTSTEP'
        ? 'bg-white border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)]'
        : 'bg-white border-2 border-gray-900 rounded-lg shadow-2xl'
    }`}>
      {/* Close Button */}
      <button
        onClick={() => setIsVisible(false)}
        className={`absolute -top-3 -left-3 w-8 h-8 flex items-center justify-center ${
          theme === 'NeXTSTEP'
            ? 'bg-black text-white hover:bg-gray-800 border-2 border-white'
            : 'bg-red-500 text-white hover:bg-red-600 rounded-full shadow-lg'
        }`}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Header */}
      <div className={`border-b-4 border-black p-4 ${theme === 'Modern' ? 'rounded-t-md' : ''}`}>
        <h1 className="text-2xl font-black uppercase tracking-tight mb-1">Card Title</h1>
        <p className="text-sm text-gray-600">Subtitle or description goes here</p>
      </div>

      {/* Properties Table */}
      <div className="border-b-4 border-black">
        <button
          onClick={() => setIsTableExpanded(!isTableExpanded)}
          className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border-b-2 border-black"
        >
          {isTableExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span className="font-bold text-xs uppercase tracking-wide">Properties</span>
        </button>
        {isTableExpanded && (
          <div>
            {properties.map((prop, index) => (
              <div key={index} className={`flex border-b-2 border-black ${index === properties.length - 1 ? 'border-b-0' : ''}`}>
                <div className="flex-1 px-4 py-2 border-r-2 border-black bg-gray-50">
                  <span className="font-bold text-sm uppercase tracking-wide">{prop.label}</span>
                </div>
                <div className="flex-1 px-4 py-2 bg-white">
                  <span className="text-sm font-medium">{prop.value}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="p-4 min-h-[200px]">
        <div className="text-xs font-bold uppercase tracking-wide mb-2 border-b-2 border-black pb-1">Notes</div>
        <textarea
          className={`w-full h-[160px] p-2 text-sm resize-none focus:outline-none ${
            theme === 'NeXTSTEP' ? 'bg-white border-2 border-gray-300' : 'bg-gray-50 border border-gray-300 rounded'
          }`}
          placeholder="Enter notes here..."
        />
      </div>

      {/* Footer */}
      <div className={`border-t-4 border-black px-4 py-2 bg-gray-50 text-xs text-gray-500 ${theme === 'Modern' ? 'rounded-b-md' : ''}`}>
        <div className="flex justify-between">
          <span>Created: Jan 16, 2026</span>
          <span>ID: #001</span>
        </div>
      </div>
    </div>
  );
}
CARD_EOF

# ============================================================================
# NavigatorFooter.tsx
# ============================================================================
echo -e "${YELLOW}Creating NavigatorFooter.tsx...${NC}"
cat > "$DESIGN_DIR/components/NavigatorFooter.tsx" << 'NAVFOOT_EOF'
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function NavigatorFooter() {
  const [activeTab, setActiveTab] = useState<'map' | 'slider'>('map');
  const [isExpanded, setIsExpanded] = useState(true);
  const { theme } = useTheme();

  // TODO: Replace with dynamic coordinates from SpatiaLite
  const boulderLat = 40.0150;
  const boulderLon = -105.2705;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${boulderLon - 0.05},${boulderLat - 0.05},${boulderLon + 0.05},${boulderLat + 0.05}&layer=mapnik&marker=${boulderLat},${boulderLon}`;

  return (
    <div className={theme === 'NeXTSTEP'
      ? 'bg-[#b8b8b8] border-t-2 border-[#808080]'
      : 'bg-white/80 backdrop-blur-xl border-t border-gray-200'
    }>
      {/* Tab Headers */}
      <div className={theme === 'NeXTSTEP' ? 'flex border-b-2 border-[#808080]' : 'flex border-b border-gray-200'}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-8 h-8 flex items-center justify-center ${
            theme === 'NeXTSTEP' ? 'bg-[#d4d4d4] border-r border-[#808080]' : 'bg-gray-100 border-r border-gray-200 rounded-tl-lg'
          }`}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-4 h-8 text-sm ${
            theme === 'NeXTSTEP'
              ? activeTab === 'map' ? 'bg-[#b8b8b8]' : 'bg-[#a0a0a0] hover:bg-[#b0b0b0]'
              : activeTab === 'map' ? 'bg-white text-blue-500 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >Location Map</button>
        <button
          onClick={() => setActiveTab('slider')}
          className={`px-4 h-8 text-sm ${
            theme === 'NeXTSTEP'
              ? activeTab === 'slider' ? 'bg-[#b8b8b8]' : 'bg-[#a0a0a0] hover:bg-[#b0b0b0]'
              : activeTab === 'slider' ? 'bg-white text-blue-500 border-b-2 border-blue-500' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >Time Slider</button>
      </div>

      {/* Tab Content */}
      {isExpanded && (
        <div className="p-4">
          {activeTab === 'map' && (
            <div className={`h-48 overflow-hidden ${
              theme === 'NeXTSTEP' ? 'border-2 border-[#606060]' : 'border border-gray-300 rounded-lg'
            }`}>
              {/* TODO: Replace with MapLibre GL JS */}
              <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={mapUrl} title="Location Map" />
            </div>
          )}
          {activeTab === 'slider' && (
            <div className={`h-48 p-4 flex flex-col justify-center gap-4 ${
              theme === 'NeXTSTEP' ? 'bg-[#a0a0a0] border-2 border-[#606060]' : 'bg-gray-50 border border-gray-300 rounded-lg'
            }`}>
              <div className="text-sm text-center text-gray-600">Time series data controls</div>
              <input type="range" className="w-full" min="0" max="100" defaultValue="50" />
              <div className="flex justify-between text-xs text-gray-600">
                <span>Start Date</span>
                <span>End Date</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
NAVFOOT_EOF

# ============================================================================
# CommandBar.tsx
# ============================================================================
echo -e "${YELLOW}Creating CommandBar.tsx...${NC}"
cat > "$DESIGN_DIR/components/CommandBar.tsx" << 'CMD_EOF'
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export function CommandBar() {
  const [commandText, setCommandText] = useState('');
  const { theme } = useTheme();

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Connect to DSL parser
    console.log('Command submitted:', commandText);
    setCommandText('');
  };

  return (
    <div className={`h-10 flex items-center px-3 gap-3 ${
      theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-t-2 border-[#e8e8e8]'
        : 'bg-white/50 backdrop-blur-xl border-t border-gray-200'
    }`}>
      <button
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
        title="Command"
      >
        <span className="text-lg leading-none">⌘</span>
      </button>

      <form onSubmit={handleCommandSubmit} className="flex-1">
        <input
          type="text"
          value={commandText}
          onChange={(e) => setCommandText(e.target.value)}
          placeholder="Enter command..."
          className={`w-full h-7 px-3 focus:outline-none ${
            theme === 'NeXTSTEP'
              ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
              : 'bg-white/80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
          }`}
        />
      </form>
    </div>
  );
}
CMD_EOF

# ============================================================================
# GitHub Issues Script
# ============================================================================
echo -e "${YELLOW}Creating GitHub issues script...${NC}"
cat > "$DESIGN_DIR/scripts/create-figma-issues.sh" << 'ISSUES_EOF'
#!/bin/bash
# Create GitHub issues for Figma handoff integration
# Run: gh auth login first

set -e

echo "Creating labels..."
gh label create "figma-handoff" --color "7B68EE" --description "From Figma UI export" 2>/dev/null || true
gh label create "d3" --color "F9A03C" --description "D3.js work" 2>/dev/null || true
gh label create "v3.0" --color "22C55E" --description "v3.0 milestone" 2>/dev/null || true

echo "Creating issues..."

gh issue create --title "Canvas D3 Integration" --label "figma-handoff,d3,v3.0" \
  --body "Replace React Card rendering in Canvas.tsx with D3 data binding.

## Tasks
- [ ] Render cards via D3 \`.data().join()\` pattern
- [ ] Support view type switching (grid, kanban, timeline)
- [ ] Handle 1000+ cards at 60fps
- [ ] Respond to PAFV axis assignments"

gh issue create --title "Dynamic Data Binding" --label "figma-handoff,v3.0" \
  --body "Replace hardcoded arrays with SQLite queries.

## Files
- Navigator.tsx - apps, views, datasets dropdowns
- Sidebar.tsx - filter value lists
- PAFVNavigator.tsx - available facets"

gh issue create --title "Command Bar DSL Integration" --label "figma-handoff,v3.0" \
  --body "Wire CommandBar.tsx to DSL parser.

## Features
- [ ] Parse DSL expressions
- [ ] Autocomplete for field names/values
- [ ] Command history (up/down arrows)
- [ ] Error display"

gh issue create --title "Loading & Error States" --label "figma-handoff,v3.0" \
  --body "Add UX polish to all components.

## Components needed
- [ ] Skeleton loader
- [ ] EmptyState
- [ ] ErrorBoundary

Apply to all panels and async operations."

echo "✅ Created 4 issues!"
echo "View: gh issue list --label figma-handoff"
ISSUES_EOF

chmod +x "$DESIGN_DIR/scripts/create-figma-issues.sh"

# ============================================================================
# Done!
# ============================================================================
echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}  Figma Components Added!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "Components added to: ${BLUE}$DESIGN_DIR${NC}"
echo ""
echo "Files created:"
echo "  ├── FIGMA-HANDOFF.md"
echo "  ├── components/"
echo "  │   ├── Toolbar.tsx"
echo "  │   ├── Navigator.tsx"
echo "  │   ├── PAFVNavigator.tsx"
echo "  │   ├── Sidebar.tsx"
echo "  │   ├── RightSidebar.tsx"
echo "  │   ├── Canvas.tsx"
echo "  │   ├── Card.tsx"
echo "  │   ├── NavigatorFooter.tsx"
echo "  │   └── CommandBar.tsx"
echo "  └── scripts/"
echo "      └── create-figma-issues.sh"
echo ""
echo -e "${YELLOW}Next: Start Claude Code and run:${NC}"
echo -e "${BLUE}\"Read design/isometry-ui-handoff/FIGMA-HANDOFF.md and start Phase 1\"${NC}"
echo ""
