#!/bin/bash

# ============================================================================
# Isometry Project Setup Script (Self-Contained)
# ============================================================================
# This script creates the complete Isometry project with all files embedded.
# No external dependencies - just run this single script.
#
# Usage:
#   ./setup-isometry.sh [project-path]
#
# Default project path: ~/Developer/Projects/Isometry
# ============================================================================

set -e

# Configuration
DEFAULT_PROJECT_PATH="$HOME/Developer/Projects/Isometry"
PROJECT_PATH="${1:-$DEFAULT_PROJECT_PATH}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}  Isometry Project Setup (Self-Contained)${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "Project path: ${GREEN}$PROJECT_PATH${NC}"
echo ""

# Confirm with user
read -p "Proceed with setup? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Creating project structure...${NC}"

# Create all directories
mkdir -p "$PROJECT_PATH"/{src/{components/ui,contexts,hooks,dsl,db,lib},docs,design/isometry-ui-handoff/{components,scripts},specs/dsl,public/assets,tests}

# ============================================================================
# CLAUDE.md - Claude Code Project Context
# ============================================================================
echo -e "${YELLOW}Creating CLAUDE.md...${NC}"
cat > "$PROJECT_PATH/CLAUDE.md" << 'CLAUDE_EOF'
# Isometry - Claude Code Project Guide

## Project Overview

Isometry (formerly CardBoard) is a polymorphic data visualization platform implementing the PAFV framework with LATCH filtering and GRAPH operations.

## Architecture Philosophy: The Boring Stack

**Use proven technologies in elegant combination, not complex frameworks.**

| Layer | Technology | Purpose |
|-------|------------|---------|
| Data | SQLite + sql.js | Persistence, queries, state |
| Visualization | D3.js | All rendering, data bindingd, interaction |
| Control Chrome | React + Tailwind | Panels, forms, dropdowns |
| Drag-Drop | react-dnd | PAFV Navigator wells |
| Maps | MapLibre GL JS | Location FilterNav (v3.1) |

## Core Concepts

### PAFV: Planes → Axes → Facets → Values
- **Planes**: x/y/z coordinate system for visual rendering
- **Axes**: LATCH organizing principles (Location, Alphabet, Time, Category, Hierarchy)
- **Facets**: Concrete attributes within axes (e.g., `created_date`, `due_date` under Time)
- **Values**: Cards (both Nodes and Edges in LPG model)

**Key insight**: Any axis can map to any plane. View transitions are remappings, not rebuilds.

### LATCH vs GRAPH Duality
- **LATCH separates** (SQL WHERE, GROUP BY) → Grid, List, Kanban, Calendar
- **GRAPH joins** (SQL JOIN) → Network, Tree, Sankey

### State Management
Do NOT add Zustand/Jotai. SQLite is the state manager.

| State Type | Location | Example |
|------------|----------|---------|
| Data | SQLite | Cards, edges, facets |
| View | URL params | activeApp, activeView |
| UI | React Context | theme, panelCollapsed |
| Filters | SQLite + URL | LATCH → SQL WHERE |

## Technology Guidelines

### D3.js Patterns
```javascript
// Data binding - the core pattern
svg.selectAll('.card')
  .data(cards, d => d.id)
  .join(
    enter => enter.append('g').attr('class', 'card'),
    update => update,
    exit => exit.transition().style('opacity', 0).remove()
  );

// Scales for LATCH axes
const xScale = d3.scaleBand()
  .domain(categories)
  .range([0, width]);

// Force simulation for GRAPH views
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(edges).id(d => d.id))
  .force('charge', d3.forceManyBody())
  .force('center', d3.forceCenter(width/2, height/2));
```

### React + D3 Hybrid Pattern
```tsx
// React owns the container, D3 owns the contents
const Visualization = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    // D3 bindings here
  }, [data]);
  
  return <svg ref={svgRef} className="w-full h-full" />;
};
```

### SQLite Query Pattern
```tsx
// Custom hook for queries
const { data, loading, error } = useSQLiteQuery<Card[]>(
  'SELECT * FROM cards WHERE status = ?',
  [activeStatus]
);
```

### Theme System
Two themes: NeXTSTEP (retro) and Modern (macOS 26)
```tsx
const { theme } = useTheme();
className={theme === 'NeXTSTEP' 
  ? 'bg-[#c0c0c0] border-2 border-[#808080]' 
  : 'bg-white/80 backdrop-blur-xl rounded-lg'}
```

## File Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI components
│   ├── Toolbar.tsx      # Menu bar + toolbar
│   ├── Navigator.tsx    # App/View/Dataset selectors
│   ├── PAFVNavigator.tsx # Drag-drop axis assignment
│   ├── Sidebar.tsx      # LATCH filters
│   ├── RightSidebar.tsx # Formats + Settings
│   ├── Canvas.tsx       # Main D3 visualization
│   ├── Card.tsx         # Card rendering
│   ├── CommandBar.tsx   # DSL input
│   └── NavigatorFooter.tsx # Map + Time slider
├── contexts/
│   └── ThemeContext.tsx
├── hooks/
│   └── useSQLiteQuery.ts
├── dsl/
│   ├── parser.ts
│   └── compiler.ts
└── db/
    └── schema.sql
```

## Key References

- Architecture: `/docs/cardboard-architecture-truth.md`
- Figma Handoff: `/design/isometry-ui-handoff/FIGMA-HANDOFF.md`
- D3 Patterns: `/docs/D3JS-SKILL.md`

## Do's and Don'ts

### Do
- Use D3's `.data().join()` pattern for all data-bound rendering
- Keep React for forms, panels, dropdowns (control chrome)
- Store filter state in URL params for shareability
- Use SQLite as the source of truth
- Support both themes in all components

### Don't
- Add state management libraries (Zustand, Jotai, Redux)
- Render data cards as React components (use D3)
- Use graph databases (SQLite + D3 covers it)
- Hardcode data in components (query SQLite)
- Forget loading/error states

## Common Tasks

### Add a new LATCH filter
1. Add filter type to `Sidebar.tsx` items
2. Create filter panel component
3. Implement DSL syntax in parser
4. Add SQL compilation in compiler
5. Connect to FilterNavContext

### Add a new view type
1. Add to views list in Navigator
2. Create D3 layout function in Canvas
3. Map PAFV axes to visual properties
4. Handle view transition animations
CLAUDE_EOF

# ============================================================================
# Architecture Truth Document
# ============================================================================
echo -e "${YELLOW}Creating architecture docs...${NC}"
cat > "$PROJECT_PATH/docs/cardboard-architecture-truth.md" << 'ARCH_EOF'
# CardBoard Architecture Truth: PAFV + LATCH + GRAPH

*December 2024*

## The Three Layers

| Layer | Purpose | Operations |
|-------|---------|------------|
| **PAFV** | Spatial projection | Map logical organization to screen coordinates |
| **LATCH** | Separation | Filter, sort, group (nodes AND edges) |
| **GRAPH** | Connection | Traverse, aggregate, cluster |

All three operate on **Values** (Cards), which include both Nodes and Edges.

## PAFV: Planes → Axes → Facets → Values

### Planes (Spatial Projection)
- **x-plane**: Horizontal organization (columns)
- **y-plane**: Vertical organization (rows)
- **z-plane**: Depth/layering organization (sheets/cards)

### Axes (Logical Organization - LATCH)
- **L**ocation: Spatial position (coordinates, geography)
- **A**lphabet: Lexical naming (A→Z, titles, labels)
- **T**ime: Temporal position (created, due, modified)
- **C**ategory: Taxonomic membership (project, status, tags)
- **H**ierarchy: Ordinal ranking (priority 1-5, importance)

### Key Insight
**Any axis can map to any plane.** View transitions are simply remapping axes to planes.

## LATCH vs GRAPH: The Fundamental Duality

| | LATCH | GRAPH |
|---|---|---|
| **Operation** | Separation | Connection |
| **SQL analog** | `WHERE`, `GROUP BY`, `ORDER BY` | `JOIN` |
| **Question** | "How do I organize these?" | "How are these related?" |

### LATCH Views (Separation)
- **Grid**: Separate by two axes mapped to x/y planes
- **Kanban**: Separate by category axis (status)
- **Calendar**: Separate by time axis

### GRAPH Views (Connection)
- **Network**: Connect by explicit links
- **Tree**: Connect by containment hierarchy

## Architecture Decision: No Graph Database

SQLite + D3.js covers all use cases:

| Capability | Implementation |
|------------|----------------|
| Store nodes + edges | SQLite tables with foreign keys |
| LATCH filtering | Standard SQL WHERE, GROUP BY |
| Path finding | SQLite recursive CTE |
| PageRank, clustering | D3.js on filtered subset |

**The boring stack wins.**
ARCH_EOF

# ============================================================================
# D3.js Skill Document
# ============================================================================
cat > "$PROJECT_PATH/docs/D3JS-SKILL.md" << 'D3_EOF'
# D3.js for Isometry

## Core Philosophy

Isometry uses D3.js as foundational architecture for polymorphic data representations. D3's data binding **replaces** complex state management.

**Key insight**: D3's enter/update/exit pattern IS your state management.

## Quick Start

```javascript
// Basic data binding
const cards = fetchFromSQLite();

d3.select("#container")
  .selectAll(".card")
  .data(cards, d => d.id)  // Key function crucial!
  .join("div")
    .attr("class", "card")
    .text(d => d.title);
```

## Polymorphic Views

Same data, multiple visualizations:

```javascript
// Grid, Kanban, Graph - all use same data
d3.select("#grid").selectAll(".cell").data(cards, d => d.id).join("div");
d3.select("#kanban").selectAll(".card").data(cards, d => d.id).join("div");
d3.select("#graph").selectAll(".node").data(cards, d => d.id).join("circle");
```

## Best Practices

1. Always use key functions: `.data(cards, d => d.id)`
2. Prefer `.join()` over manual enter/update/exit
3. Measure before optimizing
4. Single data source: SQLite → Memory → D3 Views

The "boring stack" wins.
D3_EOF

# ============================================================================
# ThemeContext
# ============================================================================
echo -e "${YELLOW}Creating source files...${NC}"
cat > "$PROJECT_PATH/src/contexts/ThemeContext.tsx" << 'THEME_EOF'
import { createContext, useContext, useState, ReactNode } from 'react';

type Theme = 'NeXTSTEP' | 'Modern';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('NeXTSTEP');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
THEME_EOF

# ============================================================================
# useSQLiteQuery Hook
# ============================================================================
cat > "$PROJECT_PATH/src/hooks/useSQLiteQuery.ts" << 'SQLITE_EOF'
import { useState, useEffect } from 'react';

interface QueryState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
}

export function useSQLiteQuery<T>(
  sql: string,
  params: any[] = []
): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function executeQuery() {
      setState(prev => ({ ...prev, loading: true }));
      
      try {
        // TODO: Replace with actual SQLite execution
        console.log('SQLite Query:', sql, params);
        const result: T[] = [];
        
        if (!cancelled) {
          setState({ data: result, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ data: null, loading: false, error: error as Error });
        }
      }
    }

    executeQuery();
    return () => { cancelled = true; };
  }, [sql, JSON.stringify(params)]);

  return state;
}
SQLITE_EOF

# ============================================================================
# UI Components
# ============================================================================
cat > "$PROJECT_PATH/src/components/ui/Skeleton.tsx" << 'SKEL_EOF'
import { useTheme } from '../../contexts/ThemeContext';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  const { theme } = useTheme();
  
  return (
    <div
      className={`animate-pulse ${
        theme === 'NeXTSTEP' ? 'bg-[#a0a0a0]' : 'bg-gray-200 rounded'
      } ${className}`}
    />
  );
}
SKEL_EOF

cat > "$PROJECT_PATH/src/components/ui/EmptyState.tsx" << 'EMPTY_EOF'
import { useTheme } from '../../contexts/ThemeContext';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const { theme } = useTheme();
  
  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <Icon className={`w-12 h-12 mb-4 ${
        theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400'
      }`} />
      <p className={`text-lg font-medium mb-1 ${
        theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600'
      }`}>{title}</p>
      {description && (
        <p className={`text-sm mb-4 ${
          theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'
        }`}>{description}</p>
      )}
      {action && (
        <button onClick={action.onClick} className={`px-4 py-2 text-sm ${
          theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
            : 'bg-blue-500 text-white rounded-lg hover:bg-blue-600'
        }`}>{action.label}</button>
      )}
    </div>
  );
}
EMPTY_EOF

cat > "$PROJECT_PATH/src/components/ui/ErrorBoundary.tsx" << 'ERROR_EOF'
import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 text-center">
          <p className="text-red-500 font-medium">Something went wrong</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          >Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
ERROR_EOF

# ============================================================================
# Package Configuration Files
# ============================================================================
echo -e "${YELLOW}Creating configuration files...${NC}"

cat > "$PROJECT_PATH/package.json" << 'PKG_EOF'
{
  "name": "isometry",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "react-dnd": "^16.0.1",
    "react-dnd-html5-backend": "^16.0.1",
    "d3": "^7.8.5",
    "sql.js": "^1.9.0",
    "lucide-react": "^0.263.1"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "typescript": "^5.2.2",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "eslint": "^8.54.0"
  }
}
PKG_EOF

cat > "$PROJECT_PATH/tsconfig.json" << 'TS_EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
TS_EOF

cat > "$PROJECT_PATH/tsconfig.node.json" << 'TSNODE_EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
TSNODE_EOF

cat > "$PROJECT_PATH/vite.config.ts" << 'VITE_EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  optimizeDeps: { exclude: ['sql.js'] },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
VITE_EOF

cat > "$PROJECT_PATH/tailwind.config.js" << 'TW_EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        nextstep: {
          bg: '#c0c0c0',
          raised: '#d4d4d4',
          sunken: '#a0a0a0',
          border: { light: '#e8e8e8', dark: '#505050', mid: '#808080' },
          text: { primary: '#000000', secondary: '#404040', muted: '#606060' }
        }
      }
    }
  },
  plugins: [],
}
TW_EOF

cat > "$PROJECT_PATH/postcss.config.js" << 'POST_EOF'
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
POST_EOF

# ============================================================================
# Entry Point Files
# ============================================================================
cat > "$PROJECT_PATH/index.html" << 'HTML_EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Isometry</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
HTML_EOF

cat > "$PROJECT_PATH/src/main.tsx" << 'MAIN_EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
MAIN_EOF

cat > "$PROJECT_PATH/src/index.css" << 'CSS_EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  transition-property: background-color, border-color, color;
  transition-duration: 150ms;
}
CSS_EOF

cat > "$PROJECT_PATH/src/App.tsx" << 'APP_EOF'
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Isometry</h1>
          <p className="text-gray-600 mb-2">Project setup complete!</p>
          <p className="text-sm text-gray-500">
            See design/isometry-ui-handoff/FIGMA-HANDOFF.md for next steps
          </p>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
APP_EOF

# ============================================================================
# .gitignore and README
# ============================================================================
cat > "$PROJECT_PATH/.gitignore" << 'GIT_EOF'
node_modules/
dist/
*.local
.DS_Store
coverage/
.env
*.log
GIT_EOF

cat > "$PROJECT_PATH/README.md" << 'README_EOF'
# Isometry

A polymorphic data visualization platform implementing PAFV + LATCH + GRAPH.

## Quick Start

```bash
npm install
npm run dev
```

## Documentation

- `CLAUDE.md` - Claude Code project context
- `docs/cardboard-architecture-truth.md` - Architecture
- `design/isometry-ui-handoff/FIGMA-HANDOFF.md` - UI integration guide

## Tech Stack

- **Data**: SQLite + sql.js
- **Visualization**: D3.js
- **UI**: React + Tailwind
- **Drag-Drop**: react-dnd

*The boring stack wins.*
README_EOF

# ============================================================================
# Figma Handoff Placeholder
# ============================================================================
cat > "$PROJECT_PATH/design/isometry-ui-handoff/README.md" << 'FIGMA_README_EOF'
# Isometry UI Handoff

This folder contains the Figma Make UI components and integration guide.

## Files to Add

Download the following from Claude.ai and place here:

1. `FIGMA-HANDOFF.md` - Main integration guide
2. `components/` folder - All 9 TSX component files:
   - Toolbar.tsx
   - Navigator.tsx
   - PAFVNavigator.tsx
   - Sidebar.tsx
   - RightSidebar.tsx
   - Canvas.tsx
   - Card.tsx
   - NavigatorFooter.tsx
   - CommandBar.tsx

## Quick Start

After adding the files, tell Claude Code:

> "Read design/isometry-ui-handoff/FIGMA-HANDOFF.md and start Phase 1"
FIGMA_README_EOF

# ============================================================================
# Done!
# ============================================================================
echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "Project created at: ${BLUE}$PROJECT_PATH${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "  1. Navigate to project:"
echo -e "     ${BLUE}cd $PROJECT_PATH${NC}"
echo ""
echo "  2. Install dependencies:"
echo -e "     ${BLUE}npm install${NC}"
echo ""
echo "  3. Download Figma components from Claude.ai and place in:"
echo -e "     ${BLUE}$PROJECT_PATH/design/isometry-ui-handoff/${NC}"
echo ""
echo "  4. Start dev server:"
echo -e "     ${BLUE}npm run dev${NC}"
echo ""
echo "  5. Start Claude Code:"
echo -e "     ${BLUE}claude${NC}"
echo ""
echo -e "${YELLOW}Project structure:${NC}"
echo ""
echo "  $PROJECT_PATH/"
echo "  ├── CLAUDE.md              # Claude Code reads this automatically"
echo "  ├── README.md"
echo "  ├── package.json"
echo "  ├── src/"
echo "  │   ├── App.tsx"
echo "  │   ├── components/ui/     # Skeleton, EmptyState, ErrorBoundary"
echo "  │   ├── contexts/          # ThemeContext"
echo "  │   └── hooks/             # useSQLiteQuery"
echo "  ├── docs/"
echo "  │   ├── cardboard-architecture-truth.md"
echo "  │   └── D3JS-SKILL.md"
echo "  └── design/isometry-ui-handoff/"
echo "      └── (add Figma components here)"
echo ""
