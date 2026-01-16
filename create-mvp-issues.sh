#!/bin/bash

# ============================================================================
# Create Isometry MVP GitHub Issues
# ============================================================================
# Creates issues for all 5 phases of MVP implementation
# Run: gh auth login first, then ./create-mvp-issues.sh
# ============================================================================

set -e

echo "Creating labels..."
gh label create "mvp" --color "FF6B6B" --description "MVP milestone" 2>/dev/null || true
gh label create "phase-1" --color "4ECDC4" --description "Phase 1: Data Pipeline" 2>/dev/null || true
gh label create "phase-2" --color "45B7D1" --description "Phase 2: View Engine" 2>/dev/null || true
gh label create "phase-3" --color "96CEB4" --description "Phase 3: Filter System" 2>/dev/null || true
gh label create "phase-4" --color "FFEAA7" --description "Phase 4: DSL Integration" 2>/dev/null || true
gh label create "phase-5" --color "DDA0DD" --description "Phase 5: Polish" 2>/dev/null || true
gh label create "blocker" --color "B22222" --description "Blocks other work" 2>/dev/null || true
gh label create "sqlite" --color "003B57" --description "SQLite/sql.js work" 2>/dev/null || true
gh label create "d3" --color "F9A03C" --description "D3.js work" 2>/dev/null || true

echo ""
echo "Creating Phase 1 issues (Data Pipeline)..."

gh issue create --title "P1.1: SQLite Schema Design" --label "mvp,phase-1,sqlite,blocker" \
  --body "## Overview
Design and implement the SQLite schema optimized for LATCH filtering.

## Requirements
- [ ] Nodes table (cards)
- [ ] Edges table (relationships)
- [ ] FTS5 virtual table for text search
- [ ] Indexes for each LATCH axis:
  - Location: coordinates
  - Alphabet: name collation
  - Time: created, modified, due dates
  - Category: folder, tags
  - Hierarchy: priority, importance

## Schema Draft
\`\`\`sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT,
  folder TEXT,
  tags TEXT,  -- JSON array
  priority INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  latitude REAL,
  longitude REAL
);

CREATE INDEX idx_nodes_folder ON nodes(folder);
CREATE INDEX idx_nodes_created ON nodes(created_at);
CREATE INDEX idx_nodes_modified ON nodes(modified_at);
CREATE INDEX idx_nodes_priority ON nodes(priority);

CREATE VIRTUAL TABLE nodes_fts USING fts5(
  name, content, tags,
  content='nodes',
  content_rowid='rowid'
);
\`\`\`

## Deliverable
- \`src/db/schema.sql\` with complete DDL
- Documentation of each table/index purpose

## References
- Architecture: docs/cardboard-architecture-truth.md"

gh issue create --title "P1.2: sql.js Initialization" --label "mvp,phase-1,sqlite,blocker" \
  --body "## Overview
Initialize sql.js (SQLite compiled to WebAssembly) in the browser.

## Requirements
- [ ] Load sql.js from CDN
- [ ] Initialize database instance
- [ ] Execute schema DDL
- [ ] Provide database context to app
- [ ] Handle WASM loading states

## Implementation
\`\`\`typescript
// src/db/init.ts
import initSqlJs, { Database } from 'sql.js';

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;
  
  const SQL = await initSqlJs({
    locateFile: file => \\\`https://sql.js.org/dist/\\\${file}\\\`
  });
  
  db = new SQL.Database();
  
  // Execute schema
  db.run(SCHEMA_SQL);
  
  return db;
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}
\`\`\`

## Deliverable
- \`src/db/init.ts\` - Database initialization
- \`src/db/DatabaseContext.tsx\` - React context provider
- Loading state handling in App.tsx"

gh issue create --title "P1.3: Sample Data Generation" --label "mvp,phase-1,sqlite" \
  --body "## Overview
Create realistic sample data for development and testing.

## Requirements
- [ ] 100+ sample notes with varied content
- [ ] Multiple folders (Work, Personal, Projects, etc.)
- [ ] Realistic date distribution (last 90 days)
- [ ] Some notes with tags
- [ ] Some notes with coordinates (for future Location filter)
- [ ] Priority distribution

## Data Generator
\`\`\`typescript
// src/db/sample-data.ts
export const SAMPLE_NOTES = [
  {
    id: 'note-001',
    type: 'note',
    name: 'Q1 Planning Meeting Notes',
    content: 'Discussed roadmap priorities...',
    folder: 'Work',
    tags: ['meetings', 'planning'],
    priority: 5,
    created_at: '2026-01-10T14:30:00Z',
    modified_at: '2026-01-10T15:45:00Z',
  },
  // ... 99 more
];
\`\`\`

## Deliverable
- \`src/db/sample-data.ts\` with 100+ records
- Seed function to populate database"

gh issue create --title "P1.4: useSQLiteQuery Hook" --label "mvp,phase-1,sqlite,blocker" \
  --body "## Overview
Implement the core data fetching hook that queries SQLite and provides React state.

## Requirements
- [ ] Accept SQL query string and params
- [ ] Return { data, loading, error } state
- [ ] Re-fetch when query/params change
- [ ] Memoize results
- [ ] Handle cancellation on unmount

## API Design
\`\`\`typescript
interface QueryState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useSQLiteQuery<T>(
  sql: string,
  params?: any[],
  options?: { enabled?: boolean }
): QueryState<T>;

// Usage
const { data: notes, loading } = useSQLiteQuery<Note>(
  'SELECT * FROM nodes WHERE folder = ? ORDER BY modified_at DESC',
  [selectedFolder]
);
\`\`\`

## Deliverable
- Complete \`src/hooks/useSQLiteQuery.ts\`
- Unit tests for the hook"

gh issue create --title "P1.5: D3 Canvas Proof of Concept" --label "mvp,phase-1,d3,blocker" \
  --body "## Overview
Render cards on Canvas using D3 data binding, proving the SQLite → D3 pipeline works.

## Requirements
- [ ] Create useD3 hook for canvas management
- [ ] Fetch data with useSQLiteQuery
- [ ] Bind data with D3's .data().join() pattern
- [ ] Render cards as simple rectangles with titles
- [ ] Handle window resize

## Implementation
\`\`\`typescript
// src/hooks/useD3.ts
function useD3<T extends SVGElement>(
  renderFn: (svg: d3.Selection<T, unknown, null, undefined>) => void,
  deps: any[]
) {
  const ref = useRef<T>(null);
  
  useEffect(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    renderFn(svg);
  }, deps);
  
  return ref;
}

// src/components/Canvas.tsx
function Canvas() {
  const { data: cards } = useSQLiteQuery<Card>('SELECT * FROM nodes');
  
  const svgRef = useD3<SVGSVGElement>((svg) => {
    svg.selectAll('.card')
      .data(cards ?? [], d => d.id)
      .join('rect')
        .attr('class', 'card')
        .attr('x', (d, i) => (i % 10) * 120)
        .attr('y', (d, i) => Math.floor(i / 10) * 80)
        .attr('width', 100)
        .attr('height', 60)
        .attr('fill', '#fff')
        .attr('stroke', '#000');
  }, [cards]);
  
  return <svg ref={svgRef} className=\"w-full h-full\" />;
}
\`\`\`

## Deliverable
- \`src/hooks/useD3.ts\`
- Updated \`src/components/Canvas.tsx\`
- Cards render from SQLite data"

echo ""
echo "Creating Phase 2 issues (View Engine)..."

gh issue create --title "P2.1: ViewRenderer Interface" --label "mvp,phase-2,d3" \
  --body "## Overview
Define the interface that all view types must implement.

## Requirements
- [ ] Define ViewRenderer interface
- [ ] Support PAFV axis configuration
- [ ] Handle card data input
- [ ] Support transitions between views
- [ ] Define common utilities (scales, positioning)

## Interface Design
\`\`\`typescript
interface ViewRenderer {
  name: string;
  
  // Configure axes
  setXAxis(facet: Facet | null): void;
  setYAxis(facet: Facet | null): void;
  
  // Render
  render(
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: Card[],
    dimensions: { width: number; height: number }
  ): void;
  
  // Transitions
  transitionFrom(previousView: ViewRenderer): void;
  
  // Interaction
  onCardClick?(card: Card): void;
  onCardHover?(card: Card | null): void;
}
\`\`\`

## Deliverable
- \`src/views/types.ts\` with interfaces
- \`src/views/BaseView.ts\` with shared utilities"

gh issue create --title "P2.2: Grid View Implementation" --label "mvp,phase-2,d3" \
  --body "## Overview
Implement the Grid view - cards arranged in a 2D grid based on X and Y axes.

## Requirements
- [ ] X axis determines columns
- [ ] Y axis determines rows
- [ ] Cards positioned at intersections
- [ ] Support variable cell sizes
- [ ] Handle sparse grids (not every cell filled)
- [ ] Smooth transitions when axes change

## Layout Algorithm
\`\`\`typescript
class GridView implements ViewRenderer {
  render(container, data, { width, height }) {
    // Group data by X and Y axis values
    const xValues = [...new Set(data.map(d => d[this.xFacet]))];
    const yValues = [...new Set(data.map(d => d[this.yFacet]))];
    
    // Create scales
    const xScale = d3.scaleBand()
      .domain(xValues)
      .range([0, width])
      .padding(0.1);
      
    const yScale = d3.scaleBand()
      .domain(yValues)
      .range([0, height])
      .padding(0.1);
    
    // Position cards
    container.selectAll('.card')
      .data(data, d => d.id)
      .join('g')
        .attr('class', 'card')
        .attr('transform', d => 
          \\\`translate(\\\${xScale(d[this.xFacet])}, \\\${yScale(d[this.yFacet])})\\\`
        );
  }
}
\`\`\`

## Deliverable
- \`src/views/GridView.ts\`
- Grid renders with configurable axes"

gh issue create --title "P2.3: List View Implementation" --label "mvp,phase-2,d3" \
  --body "## Overview
Implement the List view - cards in a single vertical column.

## Requirements
- [ ] Single column layout
- [ ] Sort by Y axis (or any selected facet)
- [ ] Fixed card height
- [ ] Smooth scroll
- [ ] Selection highlight

## Deliverable
- \`src/views/ListView.ts\`
- Sortable vertical list"

gh issue create --title "P2.4: PAFV State Management" --label "mvp,phase-2" \
  --body "## Overview
Connect PAFVNavigator drag-drop to actual view state changes.

## Requirements
- [ ] Create PAFVContext
- [ ] Track axis assignments (x, y, z, available)
- [ ] Trigger view re-render on changes
- [ ] Sync to URL params
- [ ] Restore from URL on load

## State Shape
\`\`\`typescript
interface PAFVState {
  xAxis: string | null;  // Facet name
  yAxis: string | null;
  zAxis: string | null;
  available: string[];   // Unassigned facets
}
\`\`\`

## Deliverable
- \`src/state/PAFVContext.tsx\`
- PAFVNavigator updates context on drop
- View re-renders on context change"

gh issue create --title "P2.5: Card Template System" --label "mvp,phase-2,d3" \
  --body "## Overview
Design how card content renders within view cells.

## Requirements
- [ ] Title (always shown)
- [ ] Preview text (truncated)
- [ ] Metadata row (date, folder)
- [ ] Visual indicators (priority, tags)
- [ ] Compact vs expanded modes
- [ ] Theme-aware styling

## Deliverable
- Card template renders inside Grid/List cells
- Responsive to cell size"

echo ""
echo "Creating Phase 3 issues (Filter System)..."

gh issue create --title "P3.1: Filter State Management" --label "mvp,phase-3" \
  --body "## Overview
Create the filter state system that tracks active filters and triggers queries.

## Requirements
- [ ] FilterContext with all LATCH filters
- [ ] Compose filters with AND logic
- [ ] Sync active filters to URL
- [ ] Clear individual or all filters
- [ ] Filter change triggers useSQLiteQuery re-fetch

## State Shape
\`\`\`typescript
interface FilterState {
  category: string[] | null;  // Selected folders
  time: TimePreset | DateRange | null;
  hierarchy: { min?: number; max?: number } | null;
  dsl: string | null;  // Raw DSL override
}
\`\`\`

## Deliverable
- \`src/state/FilterContext.tsx\`
- Filters affect query results"

gh issue create --title "P3.2: Category Filter (Folders)" --label "mvp,phase-3" \
  --body "## Overview
Implement the folder/category filter in the Sidebar.

## Requirements
- [ ] Query distinct folders from SQLite
- [ ] Render as checkbox list
- [ ] Multi-select support
- [ ] Update FilterContext on change
- [ ] Show count per folder

## SQL
\`\`\`sql
-- Get folders with counts
SELECT folder, COUNT(*) as count 
FROM nodes 
GROUP BY folder 
ORDER BY folder;

-- Filter query
SELECT * FROM nodes WHERE folder IN (?, ?, ?);
\`\`\`

## Deliverable
- \`src/filters/CategoryFilter.tsx\`
- Folder selection filters cards"

gh issue create --title "P3.3: Time Filter" --label "mvp,phase-3" \
  --body "## Overview
Implement time-based filtering with presets and custom ranges.

## Requirements
- [ ] Presets: Today, Yesterday, Last Week, Last Month, This Year
- [ ] Custom date range picker
- [ ] Filter by created_at or modified_at
- [ ] Visual indicator of active time filter

## SQL
\`\`\`sql
-- Last week
SELECT * FROM nodes 
WHERE modified_at >= date('now', '-7 days');

-- Custom range
SELECT * FROM nodes 
WHERE modified_at BETWEEN ? AND ?;
\`\`\`

## Deliverable
- \`src/filters/TimeFilter.tsx\`
- Time presets and custom range work"

gh issue create --title "P3.4: Filter → SQL Compiler" --label "mvp,phase-3,sqlite" \
  --body "## Overview
Compile FilterState into SQL WHERE clause.

## Requirements
- [ ] Handle each filter type
- [ ] Combine with AND
- [ ] Parameterize values (prevent SQL injection)
- [ ] Handle empty/null filters

## Implementation
\`\`\`typescript
function compileFilters(filters: FilterState): CompiledQuery {
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (filters.category?.length) {
    const placeholders = filters.category.map(() => '?').join(',');
    conditions.push(\\\`folder IN (\\\${placeholders})\\\`);
    params.push(...filters.category);
  }
  
  if (filters.time) {
    const timeSQL = compileTimeFilter(filters.time);
    conditions.push(timeSQL.sql);
    params.push(...timeSQL.params);
  }
  
  return {
    sql: conditions.length 
      ? conditions.join(' AND ')
      : '1=1',
    params
  };
}
\`\`\`

## Deliverable
- \`src/filters/compiler.ts\`
- All MVP filters compile to valid SQL"

echo ""
echo "Creating Phase 4 issues (DSL Integration)..."

gh issue create --title "P4.1: Complete DSL Parser" --label "mvp,phase-4,dsl" \
  --body "## Overview
Generate and integrate the PEG.js parser for full DSL support.

## Requirements
- [ ] Generate parser from IsometryDSL.pegjs
- [ ] Handle all MVP syntax
- [ ] Good error messages with positions
- [ ] Bundle efficiently (lazy load?)

## Commands
\`\`\`bash
npm install pegjs
npx pegjs src/dsl/grammar/IsometryDSL.pegjs -o src/dsl/grammar/parser.js
\`\`\`

## Deliverable
- Working parser that handles:
  - \`field:value\`
  - \`field:>value\`, \`field:<value\`
  - \`field:~\"text\"\`
  - \`AND\`, \`OR\`, \`NOT\`
  - Parentheses
  - Time presets"

gh issue create --title "P4.2: CommandBar Integration" --label "mvp,phase-4,dsl" \
  --body "## Overview
Wire CommandBar to parse and execute DSL queries.

## Requirements
- [ ] Parse on Enter key
- [ ] Show errors inline (red underline)
- [ ] On success, update FilterContext
- [ ] Command history (up/down arrows)
- [ ] Debounced live preview?

## Deliverable
- Type query → See filtered results
- Errors shown clearly"

gh issue create --title "P4.3: DSL Autocomplete" --label "mvp,phase-4,dsl" \
  --body "## Overview
Provide autocomplete suggestions in CommandBar.

## Requirements
- [ ] Suggest field names
- [ ] Suggest operators for field type
- [ ] Suggest values from data
- [ ] Suggest time presets
- [ ] Keyboard navigation

## Deliverable
- \`src/dsl/autocomplete.ts\` (expand existing stub)
- Dropdown appears while typing"

echo ""
echo "Creating Phase 5 issues (Polish)..."

gh issue create --title "P5.1: Loading States" --label "mvp,phase-5,ux" \
  --body "## Overview
Add loading indicators throughout the app.

## Requirements
- [ ] Initial database load
- [ ] Query execution
- [ ] View transitions
- [ ] Skeleton components per theme

## Deliverable
- Skeleton loaders during all async operations"

gh issue create --title "P5.2: Empty & Error States" --label "mvp,phase-5,ux" \
  --body "## Overview
Handle empty results and errors gracefully.

## Requirements
- [ ] \"No notes match your filters\" message
- [ ] \"Import notes to get started\" for empty DB
- [ ] Error boundary with retry
- [ ] Clear filters action

## Deliverable
- No dead ends in the UI"

gh issue create --title "P5.3: Data Persistence" --label "mvp,phase-5,sqlite" \
  --body "## Overview
Save database to browser storage and support file export.

## Requirements
- [ ] Save to IndexedDB on changes (debounced)
- [ ] Load from IndexedDB on startup
- [ ] Export database as .sqlite file
- [ ] Import database file
- [ ] Clear data option

## Deliverable
- Data survives page refresh
- Can backup/restore data"

gh issue create --title "P5.4: Performance Optimization" --label "mvp,phase-5,d3" \
  --body "## Overview
Ensure smooth performance with large datasets.

## Requirements
- [ ] Test with 1000+ cards
- [ ] Virtualize off-screen cards
- [ ] Debounce rapid filter changes
- [ ] Optimize D3 transitions
- [ ] Memory profiling

## Deliverable
- 60fps with 1000 cards"

gh issue create --title "P5.5: Keyboard Shortcuts" --label "mvp,phase-5,ux" \
  --body "## Overview
Add keyboard shortcuts for power users.

## Shortcuts
- [ ] \`⌘K\` - Focus CommandBar
- [ ] \`⌘1-4\` - Switch views
- [ ] \`⌘F\` - Focus filter search
- [ ] \`Escape\` - Clear selection / close panels
- [ ] \`⌘Z\` - Undo (stretch goal)

## Deliverable
- Hotkeys documented and working"

echo ""
echo "============================================================================"
echo "  Created MVP Issues!"
echo "============================================================================"
echo ""
echo "Phase 1 (Data Pipeline):     5 issues"
echo "Phase 2 (View Engine):       5 issues"
echo "Phase 3 (Filter System):     4 issues"
echo "Phase 4 (DSL Integration):   3 issues"
echo "Phase 5 (Polish):            5 issues"
echo "                            ──────────"
echo "Total:                       22 issues"
echo ""
echo "View all: gh issue list --label mvp"
echo "View by phase: gh issue list --label phase-1"
echo ""
