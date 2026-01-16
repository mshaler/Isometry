#!/bin/bash

# Isometry Figma Handoff - GitHub Issue Creation Script
# Run from the Isometry project root directory
# Requires: gh auth login

set -e

echo "Creating labels for Figma handoff issues..."

# Create labels (ignore errors if they already exist)
gh label create "figma-handoff" --color "7B68EE" --description "From Figma Make UI export" 2>/dev/null || true
gh label create "d3" --color "F9A03C" --description "D3.js visualization work" 2>/dev/null || true
gh label create "react" --color "61DAFB" --description "React component work" 2>/dev/null || true
gh label create "sqlite" --color "003B57" --description "SQLite integration" 2>/dev/null || true
gh label create "dsl" --color "8B5CF6" --description "DSL parser integration" 2>/dev/null || true
gh label create "ux" --color "EC4899" --description "User experience" 2>/dev/null || true
gh label create "v3.0" --color "22C55E" --description "Version 3.0 milestone" 2>/dev/null || true

echo "Creating Figma handoff issues..."

# Issue 1: Canvas D3 Integration
gh issue create \
  --title "Canvas D3 Integration" \
  --label "figma-handoff,d3,v3.0" \
  --body "## Overview

Replace React Card rendering in \`Canvas.tsx\` with D3 data binding for the main visualization area.

## Current State

\`Canvas.tsx\` renders a static React \`<Card />\` component:
\`\`\`tsx
<div className=\"flex-1 flex items-center justify-center overflow-auto p-8\">
  <Card />
</div>
\`\`\`

## Target State

D3-powered canvas that:
- Renders cards via D3 data binding (not React components)
- Handles thousands of cards with virtualization
- Supports all view types (grid, kanban, timeline, network, etc.)
- Responds to PAFV axis assignments from \`PAFVNavigator.tsx\`

## Implementation Approach

### Phase 1: Basic D3 Rendering
\`\`\`tsx
const Canvas = ({ cards, pafvConfig }) => {
  const svgRef = useRef();
  
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    
    svg.selectAll('.card')
      .data(cards, d => d.id)
      .join(
        enter => enter.append('g').attr('class', 'card'),
        update => update,
        exit => exit.remove()
      )
      .attr('transform', d => {
        const [x, y] = computePosition(d, pafvConfig);
        return \`translate(\${x}, \${y})\`;
      });
  }, [cards, pafvConfig]);
  
  return <svg ref={svgRef} className=\"w-full h-full\" />;
};
\`\`\`

### Phase 2: View Type Switching
- Grid: Fixed cell positions based on X/Y axes
- Kanban: Columns by category, vertical stacking
- Timeline: X-axis = time, Y-axis = category/swimlane
- Network: Force simulation for graph layout

### Phase 3: Virtualization
- Only render cards visible in viewport
- Use \`d3-quadtree\` for spatial indexing
- Implement smooth pan/zoom with \`d3-zoom\`

## Acceptance Criteria

- [ ] Cards render via D3 \`.data().join()\` pattern
- [ ] View type can be switched without data refetch
- [ ] PAFV axis changes trigger re-layout
- [ ] Performance: 1000+ cards at 60fps
- [ ] Sheet tabs still functional

## Dependencies

- PAFV Navigator state (#6)
- SQLite query layer

## References

- \`/design/isometry-ui-handoff/FIGMA-HANDOFF.md\`
- \`/design/isometry-ui-handoff/components/Canvas.tsx\`
- Architecture truth doc: \`cardboard-architecture-truth.md\`
"

# Issue 2: Dynamic Data Binding
gh issue create \
  --title "Dynamic Data Binding - Replace Hardcoded Arrays" \
  --label "figma-handoff,sqlite,react,v3.0" \
  --body "## Overview

Replace all hardcoded arrays in Figma components with dynamic SQLite queries.

## Current State

Components have static arrays:

### Navigator.tsx (lines 14-64)
\`\`\`tsx
const apps = ['Demo', 'Inbox', 'Projects', 'LinkedIn', 'MTGs', 'ReadWatch'];
const views = ['List', 'Gallery', 'Timeline', 'Calendar', 'Tree', 'Kanban', ...];
const datasets = ['ETL', 'CAS', 'Catalog', 'Taxonomy', 'Notes', ...];
const graphs = ['Mermaid', 'Visualization', 'Graph'];
\`\`\`

### Sidebar.tsx (lines 21-38)
\`\`\`tsx
const filterSections = [
  { title: 'Analytics', items: ['Location', 'Alphanumeric', 'Time', ...] },
  { title: 'Synthetics', items: ['Links', 'Paths', 'Vectors', ...] },
  ...
];
\`\`\`

## Target State

\`\`\`tsx
// Custom hook for SQLite queries
const apps = useSQLiteQuery('SELECT id, name, icon FROM apps WHERE active = 1 ORDER BY sort_order');
const views = useSQLiteQuery('SELECT id, name, type FROM views ORDER BY name');
const datasets = useSQLiteQuery('SELECT id, name FROM datasets ORDER BY name');
\`\`\`

## Implementation

### 1. Create useSQLiteQuery Hook
\`\`\`tsx
// hooks/useSQLiteQuery.ts
export function useSQLiteQuery<T>(sql: string, params?: any[]): {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
} {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  
  useEffect(() => {
    db.exec(sql, params)
      .then(data => setState({ data, loading: false, error: null }))
      .catch(error => setState({ data: null, loading: false, error }));
  }, [sql, params]);
  
  return state;
}
\`\`\`

### 2. Update Navigator.tsx
\`\`\`tsx
const { data: apps, loading: appsLoading } = useSQLiteQuery<App>(
  'SELECT id, name FROM apps WHERE active = 1'
);

// In render:
{appsLoading ? <Skeleton /> : apps?.map(app => (
  <button key={app.id} onClick={() => handleAppClick(app)}>
    {app.name}
  </button>
))}
\`\`\`

### 3. Update Sidebar.tsx
Filter sections can remain static (they're UI structure), but filter *values* should be dynamic:
\`\`\`tsx
// When user clicks 'Category' filter
const categories = useSQLiteQuery('SELECT DISTINCT category FROM cards');
\`\`\`

## Files to Update

- [ ] \`Navigator.tsx\` - apps, views, datasets, graphs dropdowns
- [ ] \`Sidebar.tsx\` - filter value lists (when expanded)
- [ ] \`RightSidebar.tsx\` - settings values
- [ ] \`PAFVNavigator.tsx\` - available facets list

## Acceptance Criteria

- [ ] All dropdowns populated from SQLite
- [ ] Loading states shown during queries
- [ ] Empty states when no data
- [ ] Queries are memoized/cached appropriately
- [ ] No hardcoded arrays remain in production code

## References

- \`/design/isometry-ui-handoff/FIGMA-HANDOFF.md\` (Critical Concerns #1)
"

# Issue 3: Command Bar DSL Integration
gh issue create \
  --title "Command Bar DSL Integration" \
  --label "figma-handoff,dsl,v3.0" \
  --body "## Overview

Wire \`CommandBar.tsx\` to the DSL parser for natural language filtering and commands.

## Current State

\`CommandBar.tsx\` has a stub (line 14):
\`\`\`tsx
const handleCommandSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  console.log('Command submitted:', commandText);
  setCommandText('');
};
\`\`\`

## Target State

\`\`\`tsx
import { parseDSL, DSLError } from '@/dsl/parser';
import { compileToSQL } from '@/dsl/compiler';
import { useFilterContext } from '@/contexts/FilterContext';

const handleCommandSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    const ast = parseDSL(commandText);
    const sql = compileToSQL(ast);
    applyFilter(sql);
    setCommandText('');
    setError(null);
  } catch (err) {
    if (err instanceof DSLError) {
      setError(err.message);
      // Highlight error position in input
    }
  }
};
\`\`\`

## DSL Examples

The command bar should accept:
\`\`\`
status:active                    # Simple filter
due:<2024-02-01                  # Date comparison
project:\"Q1 Launch\" AND priority:>3  # Boolean + numeric
created:last week                # Natural language time
tags:urgent OR tags:blocked      # Multi-value
/kanban status                   # View command
/sort due desc                   # Sort command
\`\`\`

## Implementation

### 1. Connect to Existing DSL Parser
\`\`\`tsx
// Reference existing grammar
import { parse } from '@/dsl/grammar/CardBoardDSL.pegjs';
\`\`\`

### 2. Add Autocomplete
\`\`\`tsx
const [suggestions, setSuggestions] = useState<string[]>([]);

useEffect(() => {
  if (commandText.includes(':')) {
    const [field] = commandText.split(':');
    const values = await getFieldValues(field);
    setSuggestions(values);
  }
}, [commandText]);
\`\`\`

### 3. Add Command History
\`\`\`tsx
const [history, setHistory] = useState<string[]>([]);
const [historyIndex, setHistoryIndex] = useState(-1);

// Arrow up/down to navigate history
\`\`\`

### 4. Visual Feedback
- Syntax highlighting in input (codemirror-style)
- Error underlines for invalid syntax
- Loading spinner during query execution

## Acceptance Criteria

- [ ] DSL expressions parse and execute
- [ ] Parse errors shown inline
- [ ] Autocomplete for field names
- [ ] Autocomplete for field values (from SQLite)
- [ ] Command history (up/down arrows)
- [ ] ⌘ button shows command palette/help

## References

- \`specs/dsl/DSL_IMPLEMENTATION_PLAN.md\`
- \`src/dsl/grammar/CardBoardDSL.pegjs\`
- \`/design/isometry-ui-handoff/components/CommandBar.tsx\`
- GitHub Issue #2: Alphanumeric FilterNav (DSL integration)
"

# Issue 4: Loading & Error States
gh issue create \
  --title "Loading & Error States for UI Components" \
  --label "figma-handoff,ux,react,v3.0" \
  --body "## Overview

Add loading skeletons, empty states, and error boundaries to all Figma components.

## Current State

Components assume data exists and render immediately. No handling for:
- Loading (SQLite queries in progress)
- Empty (query returned zero results)
- Error (query failed, network issue)

## Target State

### Loading States (Skeletons)
\`\`\`tsx
// Sidebar filter list
{loading ? (
  <div className=\"space-y-2\">
    <Skeleton className=\"h-7 w-full\" />
    <Skeleton className=\"h-7 w-full\" />
    <Skeleton className=\"h-7 w-3/4\" />
  </div>
) : (
  items.map(item => <FilterItem key={item.id} {...item} />)
)}
\`\`\`

### Empty States
\`\`\`tsx
// Canvas with no cards
{cards.length === 0 && (
  <div className=\"flex flex-col items-center justify-center h-full text-gray-500\">
    <FileX className=\"w-12 h-12 mb-4\" />
    <p className=\"text-lg font-medium\">No cards match your filters</p>
    <p className=\"text-sm\">Try adjusting your filter criteria</p>
    <button onClick={clearFilters} className=\"mt-4 text-blue-500\">
      Clear all filters
    </button>
  </div>
)}
\`\`\`

### Error Boundaries
\`\`\`tsx
// Wrap each major section
<ErrorBoundary fallback={<PanelError onRetry={refetch} />}>
  <Sidebar />
</ErrorBoundary>
\`\`\`

## Components to Update

| Component | Loading | Empty | Error |
|-----------|---------|-------|-------|
| Navigator.tsx | Dropdown skeletons | \"No apps\" | Retry button |
| Sidebar.tsx | Filter list skeletons | \"No filters\" | Panel error |
| RightSidebar.tsx | Form skeletons | N/A | Panel error |
| Canvas.tsx | Card grid skeleton | \"No cards\" | Full error |
| PAFVNavigator.tsx | Chip skeletons | \"No facets\" | Inline error |
| NavigatorFooter.tsx | Map placeholder | \"No location data\" | Map error |

## Implementation

### 1. Create Skeleton Component
\`\`\`tsx
// components/ui/Skeleton.tsx
export function Skeleton({ className }: { className?: string }) {
  const { theme } = useTheme();
  return (
    <div className={\`animate-pulse \${
      theme === 'NeXTSTEP' 
        ? 'bg-[#a0a0a0]' 
        : 'bg-gray-200 rounded'
    } \${className}\`} />
  );
}
\`\`\`

### 2. Create EmptyState Component
\`\`\`tsx
// components/ui/EmptyState.tsx
export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}: EmptyStateProps) {
  // Themed empty state
}
\`\`\`

### 3. Create ErrorBoundary
\`\`\`tsx
// components/ui/ErrorBoundary.tsx
export class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
\`\`\`

## NeXTSTEP Theme Considerations

Skeletons and empty states should respect the theme:
- NeXTSTEP: Beveled placeholder boxes, system font
- Modern: Rounded, subtle animation, SF Pro

## Acceptance Criteria

- [ ] Skeleton component created with theme support
- [ ] EmptyState component created with theme support
- [ ] ErrorBoundary wraps all major panels
- [ ] All async operations show loading state
- [ ] All lists handle zero-length gracefully
- [ ] Errors are recoverable (retry buttons)

## References

- \`/design/isometry-ui-handoff/FIGMA-HANDOFF.md\` (Critical Concerns #2)
"

echo ""
echo "✅ Created 4 Figma handoff issues!"
echo ""
echo "Issues created:"
echo "  1. Canvas D3 Integration"
echo "  2. Dynamic Data Binding - Replace Hardcoded Arrays"
echo "  3. Command Bar DSL Integration"
echo "  4. Loading & Error States for UI Components"
echo ""
echo "View all issues: gh issue list --label figma-handoff"
