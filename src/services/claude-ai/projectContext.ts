import { devLogger } from '@/utils/logging';

export interface CardContext {
  id: string;
  name: string;
  folder?: string;
  tags?: string[];
  content?: string;
  nodeType?: string;
}

export interface ProjectContext {
  activeCard?: CardContext;
  recentCards?: CardContext[];
  currentView?: 'supergrid' | 'network' | 'kanban' | 'timeline';
  filters?: Record<string, string[]>;
}

/**
 * Isometry Architecture Reference for Claude
 */
const ISOMETRY_ARCHITECTURE = `
## Isometry Architecture

You are integrated into Isometry, a polymorphic data projection platform.

### Core Concepts

**PAFV (Planes → Axes → Facets → Values)**
The spatial projection system that maps data dimensions to screen coordinates.
- Planes: x, y, z (screen coordinates)
- Axes: LATCH dimensions mapped to planes
- Facets: Specific attributes within an axis
- Values: Cards (Nodes + Edges in the LPG)

**LATCH (Location, Alphabet, Time, Category, Hierarchy)**
The five filtering/sorting dimensions. LATCH *separates* data into groups.

**GRAPH (Link, Nest, Sequence, Affinity)**
The four edge types connecting nodes. GRAPH *joins* data across groups.

**LPG (Labeled Property Graph)**
Nodes and edges are both first-class entities with properties. Edges are cards.

### Key Features

**SuperGrid**: Nested dimensional headers with orthogonal density controls.
- Grid Continuum: Gallery → List → Kanban → 2D Grid → nD SuperGrid
- Each view is a different PAFV axis allocation

**Three-Canvas Notebook**:
- Capture: TipTap editor for quick notes
- Shell: Claude AI (you), Claude Code terminal, GSD GUI
- Preview: SuperGrid, Network Graph, Data Inspector

### Data Model

Primary tables: nodes, edges, facets, notebook_cards
- nodes: Cards with LATCH columns (location, time, category, hierarchy)
- edges: Relationships (LINK, NEST, SEQUENCE, AFFINITY)
- facets: Available filtering dimensions for PAFV projection
- notebook_cards: Extended notebook functionality linked to nodes

### Technology Stack

- sql.js (SQLite in WASM) for data storage
- D3.js for all visualization
- React for UI chrome only
- TypeScript strict mode
`;

/**
 * Build a context-aware system prompt for Claude
 */
export function buildSystemPrompt(context?: ProjectContext): string {
  const parts: string[] = [
    'You are a helpful AI assistant integrated into Isometry.',
    ISOMETRY_ARCHITECTURE
  ];

  // Add active card context if available
  if (context?.activeCard) {
    const card = context.activeCard;
    parts.push(`
## Current Context

You are viewing a card with the following details:
- **Name**: ${card.name}
- **ID**: ${card.id}
${card.folder ? `- **Folder**: ${card.folder}` : ''}
${card.tags?.length ? `- **Tags**: ${card.tags.join(', ')}` : ''}
${card.nodeType ? `- **Type**: ${card.nodeType}` : ''}
${card.content ? `\n**Content Preview**:\n\`\`\`\n${card.content.slice(0, 500)}${card.content.length > 500 ? '...' : ''}\n\`\`\`` : ''}
`);
  }

  // Add current view context
  if (context?.currentView) {
    parts.push(`\nUser is currently viewing the ${context.currentView} view.`);
  }

  // Add active filters
  if (context?.filters && Object.keys(context.filters).length > 0) {
    const filterStr = Object.entries(context.filters)
      .map(([key, values]) => `${key}: ${values.join(', ')}`)
      .join('; ');
    parts.push(`\nActive filters: ${filterStr}`);
  }

  // Behavioral guidance
  parts.push(`
## Guidelines

1. When discussing data operations, use SQL terminology (nodes, edges, facets)
2. Reference LATCH dimensions for filtering/sorting suggestions
3. Reference GRAPH edge types for relationship queries
4. Explain SuperGrid concepts when relevant
5. Be concise but thorough - users are developers
6. When asked about architecture, reference the PAFV system
`);

  devLogger.debug('Built system prompt', {
    component: 'projectContext',
    hasActiveCard: !!context?.activeCard,
    currentView: context?.currentView
  });

  return parts.join('\n');
}

/**
 * Build a minimal context for quick queries
 */
export function buildMinimalPrompt(): string {
  return `You are a helpful AI assistant integrated into Isometry, a polymorphic data projection platform. Be concise and technical.`;
}
