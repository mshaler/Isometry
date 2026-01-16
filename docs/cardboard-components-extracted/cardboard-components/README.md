# @cardboard/components

D3.js component system for CardBoard's polymorphic data visualization platform.

Darwin-UI inspired, built on the reusable chart pattern.

## Installation

```bash
npm install @cardboard/components d3
```

## Quick Start

```typescript
import * as d3 from 'd3';
import { cbCard, cbCanvas, cbButton } from '@cardboard/components';
import '@cardboard/components/styles/index.css';

// Create a card component
const card = cbCard()
  .variant('glass')
  .interactive(true)
  .on('select', (e) => console.log('Selected:', e.data.id));

// Render cards
d3.select('#container')
  .selectAll('.card-wrapper')
  .data(cards, d => d.id)
  .join('div')
  .attr('class', 'card-wrapper')
  .call(card);
```

## Architecture

CardBoard components follow the **PAFV + LATCH + GRAPH** architecture:

| Layer | Purpose | Operations |
|-------|---------|------------|
| **PAFV** | Spatial projection | Map logical organization to screen coordinates |
| **LATCH** | Separation | Filter, sort, group (Location, Alphabet, Time, Category, Hierarchy) |
| **GRAPH** | Connection | Traverse, aggregate, cluster |

### Component Taxonomy

```
PAFV Layer          Component Category       Examples
─────────────────────────────────────────────────────────
Planes              Containers               cb-canvas, cb-window, cb-panel
Axes                Controls                 cb-button, cb-input, cb-select
Facets              Configuration            cb-toggle, cb-slider, cb-badge
Values              Cards                    cb-card, cb-avatar, cb-edge
```

## Components

### Primitives

- **`cbCard`** - Atomic Value unit (renders Nodes and Edges)
- `cbBadge` - Category/status indicator *(coming soon)*
- `cbAvatar` - Person/entity representation *(coming soon)*

### Controls

- **`cbButton`** - Action button with variants
- `cbInput` - Text input *(coming soon)*
- `cbSelect` - Dropdown select *(coming soon)*
- `cbToggle` - On/off toggle *(coming soon)*
- `cbSlider` - Range slider *(coming soon)*

### Containers

- **`cbCanvas`** - Root visualization container with zoom/pan
- `cbWindow` - macOS-style window *(coming soon)*
- `cbPanel` - Sidebar panel *(coming soon)*
- `cbToolbar` - Action toolbar *(coming soon)*

### Views *(coming soon)*

- `cbGrid` - Grid layout (LATCH separation)
- `cbKanban` - Kanban columns (Category axis)
- `cbTimeline` - Timeline (Time axis)
- `cbNetwork` - Force-directed graph (GRAPH connection)

## Component Pattern

All components follow the factory + closure + fluent API pattern:

```typescript
function cbComponent() {
  // 1. Private state (closure)
  const props = { variant: 'default', size: 'md' };
  
  // 2. Render function (called via selection.call())
  function component(selection) {
    selection.each(function(d) {
      // D3 data binding logic
    });
    return selection;
  }
  
  // 3. Fluent API (getter/setter for each prop)
  component.variant = function(_) {
    return arguments.length ? (props.variant = _, component) : props.variant;
  };
  
  return component;
}
```

### Usage

```typescript
// Create component with fluent API
const card = cbCard()
  .variant('glass')
  .size('lg')
  .interactive(true)
  .draggable(true)
  .on('select', handleSelect)
  .on('dragend', handleDragEnd);

// Render with D3 data binding
d3.select('#container')
  .selectAll('.card-wrapper')
  .data(cards, d => d.id)
  .join('div')
  .call(card);
```

## Data Types

### CardValue (LPG Model)

CardBoard uses a Labeled Property Graph model where both Nodes and Edges are "Values":

```typescript
interface NodeValue {
  id: string;
  type: 'node';
  nodeType: 'Task' | 'Note' | 'Person' | 'Project' | 'Event' | 'Resource';
  name: string;
  content?: string;
  latch: LATCHCoordinates;
  properties: Record<string, unknown>;
}

interface EdgeValue {
  id: string;
  type: 'edge';
  edgeType: 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';
  sourceId: string;
  targetId: string;
  label?: string;
  weight?: number;
  latch: LATCHCoordinates;
  properties: Record<string, unknown>;
}

interface LATCHCoordinates {
  location?: string | [number, number];
  alphabet?: string;
  time?: Date | string;
  category?: string | string[];
  hierarchy?: number;
}
```

## Styling

Import the CSS for styling:

```typescript
import '@cardboard/components/styles/index.css';
```

Or import individual style modules:

```css
@import '@cardboard/components/styles/variables.css';
@import '@cardboard/components/styles/primitives.css';
@import '@cardboard/components/styles/controls.css';
@import '@cardboard/components/styles/containers.css';
```

### Theming

CardBoard uses CSS custom properties for theming:

```css
:root {
  --cb-accent: #0a84ff;
  --cb-bg-base: #0a0a0a;
  --cb-fg-primary: #f5f5f5;
  /* ... */
}

/* Light mode */
[data-theme="light"] {
  --cb-bg-base: #f5f5f7;
  --cb-fg-primary: #1d1d1f;
  /* ... */
}
```

## Development

```bash
# Install dependencies
npm install

# Development (watch mode)
npm run dev

# Build
npm run build

# Test
npm test

# Test with coverage
npm run test:coverage

# Type check
npm run typecheck
```

## Project Structure

```
src/
├── components/
│   ├── primitives/     # cb-card, cb-badge, cb-avatar
│   ├── controls/       # cb-button, cb-input, cb-select
│   ├── containers/     # cb-canvas, cb-window, cb-panel
│   ├── overlays/       # cb-modal, cb-tooltip, cb-popover
│   ├── views/          # cb-grid, cb-kanban, cb-network
│   ├── types.ts        # Type definitions
│   ├── factory.ts      # Component utilities
│   └── index.ts        # Exports
├── styles/
│   ├── variables.css   # Design tokens
│   ├── primitives.css  # Primitive styles
│   ├── controls.css    # Control styles
│   ├── containers.css  # Container styles
│   ├── views.css       # View styles
│   └── index.css       # Main entry
├── utils/
│   └── scales.ts       # LATCH scale factories
└── index.ts            # Package entry
```

## License

MIT
