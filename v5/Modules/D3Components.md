# Isometry v5 D3.js Component Specifications

> **Purpose:** Guide Claude Code in implementing D3.js components from Figma designs.
> **Reference:** See `/Designs/Isometry 5 design.png` for visual reference.

---

## Design System

### Color Palette

```css
:root {
  /* Backgrounds */
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-tertiary: #0f0f1a;
  --bg-card: #1e1e2e;
  
  /* LATCH Accent Colors */
  --color-location: #4ade80;    /* Green */
  --color-alphabet: #f472b6;    /* Pink */
  --color-time: #fb923c;        /* Orange */
  --color-category: #60a5fa;    /* Blue */
  --color-hierarchy: #a78bfa;   /* Purple */
  --color-graph: #f87171;       /* Red */
  
  /* Text */
  --text-primary: #ffffff;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  
  /* Borders */
  --border-default: #27272a;
  --border-hover: #3f3f46;
  --border-active: #52525b;
  
  /* Interactive */
  --hover-bg: rgba(255, 255, 255, 0.05);
  --active-bg: rgba(255, 255, 255, 0.1);
  --selection-bg: rgba(96, 165, 250, 0.2);
}
```

### Typography

```css
:root {
  --font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif;
  --font-mono: 'SF Mono', 'Fira Code', monospace;
  
  --font-xs: 10px;
  --font-sm: 12px;
  --font-md: 14px;
  --font-lg: 16px;
  --font-xl: 20px;
  --font-xxl: 24px;
  
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  
  --line-height: 1.4;
}
```

### Spacing Scale

```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-xxl: 32px;
}
```

### Border Radius

```css
:root {
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
}
```

---

## Component: Command Palette (Top Bar)

### Visual Reference
- Full-width bar at top
- Left: App icon + keyboard shortcut icon (⌘)
- Center: Search input "Command palette..."
- Right: Settings gear icon

### Dimensions
- Height: 40px
- Padding: 0 16px
- Background: var(--bg-secondary)
- Border-bottom: 1px solid var(--border-default)

### D3 Implementation Pattern

```typescript
function renderCommandPalette(container: d3.Selection<HTMLDivElement, unknown, null, undefined>) {
  const bar = container.append('div')
    .attr('class', 'command-palette')
    .style('height', '40px')
    .style('display', 'flex')
    .style('align-items', 'center')
    .style('padding', '0 16px')
    .style('background', 'var(--bg-secondary)')
    .style('border-bottom', '1px solid var(--border-default)');
  
  // Left icons
  bar.append('div')
    .attr('class', 'left-icons')
    .style('display', 'flex')
    .style('gap', '8px');
  
  // Search input
  bar.append('input')
    .attr('type', 'text')
    .attr('placeholder', 'Command palette...')
    .attr('class', 'search-input')
    .style('flex', '1')
    .style('margin', '0 16px')
    .style('background', 'var(--bg-tertiary)')
    .style('border', '1px solid var(--border-default)')
    .style('border-radius', 'var(--radius-md)')
    .style('padding', '6px 12px')
    .style('color', 'var(--text-primary)')
    .style('font-size', 'var(--font-sm)');
  
  // Right settings
  bar.append('div')
    .attr('class', 'settings-icon');
}
```

---

## Component: Collapsible Section

### Visual Reference
- Used for: NOTEBOOK, PROPERTIES EXPLORER, PROJECTION EXPLORER, VISUAL EXPLORER, LATCH FILTERS
- Chevron (▼) + Section title
- Collapsed: chevron rotates to ▶

### Dimensions
- Header height: 28px
- Padding: 4px 12px
- Font: var(--font-sm), var(--font-semibold)
- Color: var(--text-secondary)

### D3 Implementation Pattern

```typescript
interface SectionState {
  id: string;
  label: string;
  expanded: boolean;
}

function renderCollapsibleSection(
  container: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  state: SectionState,
  contentRenderer: (container: d3.Selection<HTMLDivElement, unknown, null, undefined>) => void
) {
  const section = container.append('div')
    .attr('class', 'collapsible-section')
    .attr('data-expanded', state.expanded);
  
  // Header
  const header = section.append('div')
    .attr('class', 'section-header')
    .style('display', 'flex')
    .style('align-items', 'center')
    .style('height', '28px')
    .style('padding', '4px 12px')
    .style('cursor', 'pointer')
    .on('click', () => {
      state.expanded = !state.expanded;
      section.attr('data-expanded', state.expanded);
      content.style('display', state.expanded ? 'block' : 'none');
      chevron.style('transform', state.expanded ? 'rotate(0deg)' : 'rotate(-90deg)');
    });
  
  const chevron = header.append('span')
    .attr('class', 'chevron')
    .text('▼')
    .style('margin-right', '8px')
    .style('font-size', '10px')
    .style('transition', 'transform 0.2s');
  
  header.append('span')
    .attr('class', 'section-label')
    .text(state.label)
    .style('font-size', 'var(--font-sm)')
    .style('font-weight', 'var(--font-semibold)')
    .style('color', 'var(--text-secondary)')
    .style('text-transform', 'uppercase')
    .style('letter-spacing', '0.5px');
  
  // Content
  const content = section.append('div')
    .attr('class', 'section-content')
    .style('display', state.expanded ? 'block' : 'none');
  
  contentRenderer(content);
  
  return section;
}
```

---

## Component: Properties Explorer

### Visual Reference
- 6 columns: LOCATION, ALPHANUMERIC, TIME, CATEGORY, HIERARCHY, GRAPH
- Each column has colored icon, label, count badge
- Property rows with checkboxes
- Draggable properties

### Column Layout
- Display: flex (horizontal)
- Column width: flexible, min 150px
- Column separator: 1px solid var(--border-default)

### Column Header
- Height: 36px
- Padding: 8px 12px
- Background: var(--bg-secondary)
- Icon: 14x14, LATCH color
- Label: var(--font-sm), var(--font-medium), var(--text-primary)
- Count: var(--font-xs), var(--text-muted), pill background

### Property Row
- Height: 28px
- Padding: 4px 12px
- Checkbox: 14x14, LATCH color when checked
- Label: var(--font-sm), var(--text-primary)
- Hover: var(--hover-bg)
- Draggable cursor: grab

### D3 Implementation Pattern

```typescript
interface PropertyColumn {
  key: LATCHAxis | 'graph';
  label: string;
  icon: string;
  color: string;
  properties: Property[];
}

interface Property {
  id: string;
  label: string;
  selected: boolean;
  axis: LATCHAxis | 'graph';
}

function renderPropertiesExplorer(
  container: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  columns: PropertyColumn[],
  onPropertyToggle: (prop: Property) => void,
  onPropertyDragStart: (prop: Property, event: DragEvent) => void
) {
  const explorer = container.append('div')
    .attr('class', 'properties-explorer')
    .style('display', 'flex')
    .style('border', '1px solid var(--border-default)')
    .style('border-radius', 'var(--radius-md)');
  
  const columnElements = explorer.selectAll('div.property-column')
    .data(columns, d => d.key)
    .join('div')
    .attr('class', 'property-column')
    .style('flex', '1')
    .style('min-width', '150px')
    .style('border-right', '1px solid var(--border-default)');
  
  // Remove border from last column
  columnElements.filter((d, i) => i === columns.length - 1)
    .style('border-right', 'none');
  
  // Column headers
  columnElements.append('div')
    .attr('class', 'column-header')
    .style('display', 'flex')
    .style('align-items', 'center')
    .style('gap', '8px')
    .style('height', '36px')
    .style('padding', '8px 12px')
    .style('background', 'var(--bg-secondary)')
    .style('border-bottom', '1px solid var(--border-default)')
    .html(d => `
      <span class="icon" style="color: ${d.color}; font-size: 14px;">${d.icon}</span>
      <span class="label" style="font-size: var(--font-sm); font-weight: var(--font-medium);">${d.label}</span>
      <span class="count" style="
        font-size: var(--font-xs);
        color: var(--text-muted);
        background: var(--bg-tertiary);
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: auto;
      ">${d.properties.filter(p => p.selected).length}</span>
    `);
  
  // Property rows
  columnElements.each(function(columnData) {
    const column = d3.select(this);
    const rowContainer = column.append('div')
      .attr('class', 'property-rows')
      .style('max-height', '200px')
      .style('overflow-y', 'auto');
    
    rowContainer.selectAll('div.property-row')
      .data(columnData.properties, d => d.id)
      .join('div')
      .attr('class', 'property-row')
      .attr('draggable', 'true')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('gap', '8px')
      .style('height', '28px')
      .style('padding', '4px 12px')
      .style('cursor', 'grab')
      .on('mouseenter', function() {
        d3.select(this).style('background', 'var(--hover-bg)');
      })
      .on('mouseleave', function() {
        d3.select(this).style('background', 'transparent');
      })
      .on('dragstart', (event, d) => onPropertyDragStart(d, event))
      .html(d => `
        <input type="checkbox" 
               ${d.selected ? 'checked' : ''} 
               style="accent-color: ${columnData.color}; width: 14px; height: 14px;">
        <span style="font-size: var(--font-sm);">${d.label}</span>
      `)
      .select('input')
      .on('change', (event, d) => {
        d.selected = event.target.checked;
        onPropertyToggle(d);
      });
  });
}
```

---

## Component: Projection Explorer

### Visual Reference
- Left: Available Properties (vertical list)
- Center-left: X-PLANE ROWS (drop zone)
- Center-right: Y-PLANE COLUMNS (drop zone)
- Right: Z-PLANE LAYERS (drop zone) + Display/Audit/Cards/Aggregation dropdowns

### Drop Zone
- Border: 2px dashed var(--border-default)
- Border-radius: var(--radius-md)
- Min-height: 120px
- Padding: 8px
- When dragging over: border-color: var(--color-category), background: var(--selection-bg)

### Property Pill (in drop zone)
- Background: var(--bg-card)
- Border: 1px solid [LATCH color]
- Border-radius: var(--radius-sm)
- Padding: 4px 8px
- Font: var(--font-sm)
- Icon: LATCH icon + color
- Remove button: × on hover

### D3 Implementation Pattern

```typescript
interface ProjectionState {
  availableProperties: Property[];
  xPlane: Property[];
  yPlane: Property[];
  zPlane: Property[];
  display: string;
  auditView: boolean;
  cardSize: string;
  aggregation: string;
}

function renderProjectionExplorer(
  container: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  state: ProjectionState,
  onDrop: (property: Property, target: 'x' | 'y' | 'z') => void,
  onRemove: (property: Property, from: 'x' | 'y' | 'z') => void
) {
  const explorer = container.append('div')
    .attr('class', 'projection-explorer')
    .style('display', 'grid')
    .style('grid-template-columns', '200px 1fr 1fr 250px')
    .style('gap', '16px');
  
  // Available Properties
  const available = explorer.append('div')
    .attr('class', 'available-properties');
  
  available.append('div')
    .attr('class', 'zone-label')
    .text('AVAILABLE PROPERTIES')
    .style('font-size', 'var(--font-xs)')
    .style('color', 'var(--text-muted)')
    .style('margin-bottom', '8px');
  
  available.selectAll('div.property-pill')
    .data(state.availableProperties)
    .join('div')
    .attr('class', 'property-pill')
    .attr('draggable', 'true')
    .call(renderPropertyPill);
  
  // Drop zones
  ['x', 'y', 'z'].forEach((axis, i) => {
    const labels = ['X-PLANE ROWS', 'Y-PLANE COLUMNS', 'Z-PLANE LAYERS'];
    const data = [state.xPlane, state.yPlane, state.zPlane][i];
    
    const zone = explorer.append('div')
      .attr('class', `drop-zone drop-zone-${axis}`)
      .attr('data-axis', axis);
    
    zone.append('div')
      .attr('class', 'zone-label')
      .text(labels[i])
      .style('font-size', 'var(--font-xs)')
      .style('color', 'var(--text-muted)')
      .style('margin-bottom', '8px');
    
    const dropArea = zone.append('div')
      .attr('class', 'drop-area')
      .style('min-height', '120px')
      .style('border', '2px dashed var(--border-default)')
      .style('border-radius', 'var(--radius-md)')
      .style('padding', '8px')
      .on('dragover', (event) => {
        event.preventDefault();
        d3.select(event.currentTarget)
          .style('border-color', 'var(--color-category)')
          .style('background', 'var(--selection-bg)');
      })
      .on('dragleave', (event) => {
        d3.select(event.currentTarget)
          .style('border-color', 'var(--border-default)')
          .style('background', 'transparent');
      })
      .on('drop', (event) => {
        event.preventDefault();
        const propId = event.dataTransfer.getData('property-id');
        // Handle drop
        d3.select(event.currentTarget)
          .style('border-color', 'var(--border-default)')
          .style('background', 'transparent');
      });
    
    dropArea.selectAll('div.dropped-pill')
      .data(data)
      .join('div')
      .attr('class', 'dropped-pill')
      .call(renderPropertyPill)
      .append('button')
      .attr('class', 'remove-btn')
      .text('×')
      .on('click', (event, d) => onRemove(d, axis as 'x' | 'y' | 'z'));
  });
}

function renderPropertyPill(selection: d3.Selection<HTMLDivElement, Property, any, any>) {
  selection
    .style('display', 'inline-flex')
    .style('align-items', 'center')
    .style('gap', '6px')
    .style('padding', '4px 8px')
    .style('margin', '4px')
    .style('background', 'var(--bg-card)')
    .style('border', d => `1px solid var(--color-${d.axis})`)
    .style('border-radius', 'var(--radius-sm)')
    .style('font-size', 'var(--font-sm)')
    .style('cursor', 'grab')
    .html(d => `
      <span class="icon" style="color: var(--color-${d.axis});">${getAxisIcon(d.axis)}</span>
      <span>${d.label}</span>
    `);
}
```

---

## Component: SuperGrid (Visual Explorer)

### Visual Reference
- Row headers: Folder names (Personal, Work)
- Column headers: Time periods (Apr 2024, Aug 2024, ...)
- Cells: Card previews with title + folder label
- "+1 more" indicator for overflow

### Row/Column Headers
- Background: var(--bg-secondary)
- Font: var(--font-sm), var(--font-medium)
- Padding: 8px 12px
- Sticky positioning

### Grid Cell
- Min-width: 150px
- Min-height: 80px
- Border: 1px solid var(--border-default)
- Padding: 8px

### Card Preview (in cell)
- Background: var(--bg-card)
- Border-radius: var(--radius-sm)
- Padding: 8px
- Title: var(--font-sm), var(--font-medium), var(--text-primary)
- Subtitle: var(--font-xs), var(--text-muted)

### D3 Implementation Pattern

```typescript
interface SuperGridState {
  rowHeaders: string[];
  colHeaders: string[];
  cells: Map<string, Card[]>;  // "row,col" → cards
}

function renderSuperGrid(
  container: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  state: SuperGridState,
  onCellClick: (row: string, col: string) => void,
  onCardClick: (card: Card) => void
) {
  const grid = container.append('div')
    .attr('class', 'supergrid')
    .style('display', 'grid')
    .style('grid-template-columns', `150px repeat(${state.colHeaders.length}, minmax(150px, 1fr))`)
    .style('overflow', 'auto');
  
  // Corner cell
  grid.append('div')
    .attr('class', 'corner-cell')
    .style('background', 'var(--bg-secondary)')
    .style('border', '1px solid var(--border-default)')
    .style('position', 'sticky')
    .style('left', '0')
    .style('top', '0')
    .style('z-index', '2');
  
  // Column headers
  state.colHeaders.forEach(col => {
    grid.append('div')
      .attr('class', 'col-header')
      .style('background', 'var(--bg-secondary)')
      .style('border', '1px solid var(--border-default)')
      .style('padding', '8px 12px')
      .style('font-size', 'var(--font-sm)')
      .style('font-weight', 'var(--font-medium)')
      .style('position', 'sticky')
      .style('top', '0')
      .style('z-index', '1')
      .text(col);
  });
  
  // Rows
  state.rowHeaders.forEach(row => {
    // Row header
    grid.append('div')
      .attr('class', 'row-header')
      .style('background', 'var(--bg-secondary)')
      .style('border', '1px solid var(--border-default)')
      .style('padding', '8px 12px')
      .style('font-size', 'var(--font-sm)')
      .style('font-weight', 'var(--font-medium)')
      .style('position', 'sticky')
      .style('left', '0')
      .style('z-index', '1')
      .text(row);
    
    // Data cells
    state.colHeaders.forEach(col => {
      const cellKey = `${row},${col}`;
      const cards = state.cells.get(cellKey) || [];
      
      const cell = grid.append('div')
        .attr('class', 'grid-cell')
        .style('border', '1px solid var(--border-default)')
        .style('padding', '8px')
        .style('min-height', '80px')
        .on('click', () => onCellClick(row, col));
      
      // Render up to 2 cards
      const visibleCards = cards.slice(0, 2);
      const overflow = cards.length - 2;
      
      cell.selectAll('div.card-preview')
        .data(visibleCards)
        .join('div')
        .attr('class', 'card-preview')
        .style('background', 'var(--bg-card)')
        .style('border-radius', 'var(--radius-sm)')
        .style('padding', '8px')
        .style('margin-bottom', '4px')
        .style('cursor', 'pointer')
        .on('click', (event, d) => {
          event.stopPropagation();
          onCardClick(d);
        })
        .html(d => `
          <div style="font-size: var(--font-sm); font-weight: var(--font-medium);">${d.name}</div>
          <div style="font-size: var(--font-xs); color: var(--text-muted);">${d.folder}</div>
        `);
      
      if (overflow > 0) {
        cell.append('div')
          .attr('class', 'overflow-indicator')
          .style('font-size', 'var(--font-xs)')
          .style('color', 'var(--color-time)')
          .text(`+${overflow} more`);
      }
    });
  });
}
```

---

## Component: LATCH Filters

### Visual Reference
- Accordion-style filter sections
- Each LATCH axis has its own visualization:
  - **Location**: Mini map + distance slider
  - **Alphabet**: Search input + letter histogram
  - **Time**: Range slider + quick buttons (Today, This Week, etc.)
  - **Category**: Tag pills (Work, Personal, Meeting, etc.)
  - **Hierarchy**: Priority gradient bar (Critical → None)

### Filter Section Header
- Icon (LATCH color) + Label
- Collapsed: single line
- Expanded: full visualization

### D3 Implementation Patterns

See separate spec files for each filter type:
- `LocationFilter.md`
- `AlphabetFilter.md`
- `TimeFilter.md`
- `CategoryFilter.md`
- `HierarchyFilter.md`

---

## Implementation Priority

1. **Phase 1: Layout Shell**
   - Command Palette
   - Collapsible Sections
   - Basic grid layout

2. **Phase 2: Explorers**
   - Properties Explorer (static)
   - Projection Explorer (drag-drop)

3. **Phase 3: SuperGrid**
   - Headers (row + column)
   - Cells with cards
   - Scroll + sticky headers

4. **Phase 4: Filters**
   - Category pills
   - Time slider
   - Search input

5. **Phase 5: Interactions**
   - Drag properties → projection wells
   - Click cards → selection
   - Keyboard navigation

---

## File Structure

```
/src
  /styles
    design-tokens.css       ← CSS variables from above
    components.css          ← Component-specific styles
  /components
    /shell
      CommandPalette.ts
      CollapsibleSection.ts
      Layout.ts
    /explorers
      PropertiesExplorer.ts
      ProjectionExplorer.ts
    /grid
      SuperGrid.ts
      GridCell.ts
      CardPreview.ts
    /filters
      LATCHFilters.ts
      LocationFilter.ts
      TimeFilter.ts
      CategoryFilter.ts
    /common
      PropertyPill.ts
      DropZone.ts
```

---

## Key Differences: React vs D3 Approach

| Aspect | React (Figma Make) | D3.js (Isometry) |
|--------|-------------------|------------------|
| State | useState/useReducer | Providers → sql.js |
| Rendering | Virtual DOM diff | Direct DOM manipulation |
| Lists | .map() + key | .selectAll().data().join() |
| Events | onClick props | .on('click', handler) |
| Styles | CSS-in-JS / Tailwind | CSS variables + inline |
| Drag/Drop | react-dnd library | Native HTML5 + D3 events |

---

*Document Version: 1.0*
*Created: February 2026*
