# Capture Architecture: Writing Surface Features Integration

**Project:** Isometry v6.2 Capture Writing Surface
**Researched:** 2026-02-13
**Overall Confidence:** HIGH

## Executive Summary

The v6.2 Capture Writing Surface milestone extends an existing TipTap-based architecture with Apple Notes fluency, Notion block types, and Obsidian power features. The current implementation already provides a solid foundation with TipTap editor integration, slash commands, wiki links, auto-save, and property management. New features integrate through TipTap's extension system, React components for UI chrome, and direct sql.js queries for data operations.

**Key architectural insight:** TipTap's extension API combined with the existing slash command pattern and sql.js direct access enables clean feature integration without architectural changes. Most new features are either TipTap extensions (keyboard shortcuts, formatting), React components (backlinks panel, template picker), or enhanced slash commands (block types, embeds).

**Critical finding:** The existing `useTipTapEditor.ts` hook already implements the performance-critical pattern (`shouldRerenderOnTransaction: false`) necessary for large documents. New extensions must respect this constraint and avoid state mutations in hooks.

**Build order recommendation:** Start with keyboard shortcuts (pure TipTap extension), then templates (UI + data), then backlinks (UI + sql.js queries), then block types (extension + UI), and finally Isometry embeds (most complex, depends on all other systems).

## Existing Architecture Deep Dive

### Core Components

| Component | Location | Responsibility | Integration Points |
|-----------|----------|----------------|-------------------|
| **CaptureComponent** | `src/components/notebook/CaptureComponent.tsx` | Main container, header, minimize/maximize, property panel | Renders TipTapEditor, EditorToolbar, PropertyEditor |
| **useTipTapEditor** | `src/hooks/ui/useTipTapEditor.ts` | Editor lifecycle, auto-save, extension configuration | Configures all TipTap extensions, manages content sync |
| **TipTapEditor** | `src/components/notebook/editor/TipTapEditor.tsx` | Renders editor chrome | `EditorContent` from @tiptap/react |
| **EditorToolbar** | `src/components/notebook/editor/EditorToolbar.tsx` | Formatting toolbar UI | Triggers editor.chain() commands |
| **SlashCommands** | `src/components/notebook/editor/extensions/slash-commands.ts` | TipTap extension + command registry | SLASH_COMMANDS array, Tippy popup |
| **WikiLink** | `src/components/notebook/editor/extensions/wiki-links.ts` | TipTap Mark extension | Queries sql.js for card suggestions |
| **PropertyEditor** | `src/components/notebook/PropertyEditor.tsx` | Card metadata editing | NotebookContext.updateCard() |
| **NotebookContext** | `src/contexts/NotebookContext.tsx` | Card CRUD operations | sql.js database via SQLiteProvider |

### Data Flow Patterns

**Content Persistence:**
```
User types → editor.onUpdate → debounced save → updateCard(markdownContent) → sql.js INSERT/UPDATE → db file
```

**Card Loading:**
```
Selection change → loadCard(id) → sql.js SELECT → setActiveCard → editor.setContent()
```

**Wiki Link Creation:**
```
User types [[ → WikiLink suggestion → user selects → insertContent() + createLinkEdge() → sql.js INSERT edge
```

**Slash Command Execution:**
```
User types / → suggestion popup → user selects → command.action() → editor.chain() or CustomEvent dispatch
```

### Critical Performance Pattern

From `useTipTapEditor.ts` lines 102-105:

```typescript
const editor = useEditor({
  // CRITICAL: These two settings are non-negotiable for performance
  immediatelyRender: true,
  shouldRerenderOnTransaction: false,
  // ...
});
```

**Implication:** New extensions MUST NOT trigger re-renders on every transaction. Use ProseMirror state directly, not React state updates in transaction hooks.

### Extension Registration Pattern

Extensions are configured in `useTipTapEditor.ts` via the `extensions` array:

1. **StarterKit** — Bold, italic, headings, lists, blockquote, history
2. **Link** — URL auto-detection and link marks
3. **Placeholder** — "Type / for commands, [[ for links..."
4. **SlashCommands** — Custom extension with Tippy suggestion popup
5. **WikiLink** — Custom Mark extension with card suggestion popup

**Pattern:** Each custom extension uses Tippy.js for popup UI, ReactRenderer for React components, and the TipTap Suggestion API for trigger detection.

## New Features: Integration Architecture

### Feature 1: Apple Notes Keyboard Shortcuts

**What:** CMD+B (bold), CMD+I (italic), CMD+U (underline), CMD+Shift+X (strikethrough), CMD+K (link), etc.

**How:** TipTap extension using `addKeyboardShortcuts()` method

**Integration Points:**
- Add extension to `useTipTapEditor.ts` extensions array
- NO UI components needed (pure extension)
- Commands already exist in StarterKit (toggleBold, toggleItalic, etc.)

**Implementation:**

```typescript
// New file: src/components/notebook/editor/extensions/keyboard-shortcuts.ts
import { Extension } from '@tiptap/core';

export const AppleNotesKeyboardShortcuts = Extension.create({
  name: 'appleNotesKeyboardShortcuts',

  addKeyboardShortcuts() {
    return {
      'Mod-b': () => this.editor.commands.toggleBold(),
      'Mod-i': () => this.editor.commands.toggleItalic(),
      'Mod-u': () => this.editor.commands.toggleUnderline(),
      'Mod-Shift-x': () => this.editor.commands.toggleStrike(),
      'Mod-k': () => this.editor.commands.toggleLink({ href: '' }),
      'Mod-e': () => this.editor.commands.toggleCode(),
      'Mod-Shift-t': () => this.editor.commands.toggleTaskList(),
      // ... more shortcuts
    };
  },
});
```

**Files Modified:**
- `src/hooks/ui/useTipTapEditor.ts` — Add to extensions array
- `src/components/notebook/editor/extensions/keyboard-shortcuts.ts` — NEW
- `src/components/notebook/editor/extensions/index.ts` — Export new extension

**Confidence:** HIGH (official TipTap pattern, StarterKit commands already available)

**Sources:**
- [TipTap Keyboard Shortcuts Documentation](https://tiptap.dev/docs/editor/core-concepts/keyboard-shortcuts)
- [Apple Notes Keyboard Shortcuts](https://support.apple.com/guide/notes/keyboard-shortcuts-and-gestures-apd46c25187e/mac)

### Feature 2: Smart Formatting (Auto-lists, Auto-checkboxes)

**What:** Typing "- " starts bullet list, "1. " starts numbered list, "- [ ]" creates checkbox

**How:** TipTap InputRules (pattern matching on input)

**Integration Points:**
- Extend StarterKit configuration OR add custom InputRule extension
- NO UI components needed

**Implementation:**

```typescript
// Modify useTipTapEditor.ts StarterKit configuration
StarterKit.configure({
  bulletList: {
    keepMarks: true,
    keepAttributes: false,
  },
  orderedList: {
    keepMarks: true,
    keepAttributes: false,
  },
  taskList: {
    HTMLAttributes: {
      class: 'task-list',
    },
  },
  taskItem: {
    nested: true,
  },
})
```

**Files Modified:**
- `src/hooks/ui/useTipTapEditor.ts` — Enhance StarterKit configuration

**Confidence:** HIGH (StarterKit already includes these, just need configuration)

**Sources:**
- [TipTap Input Rules Documentation](https://tiptap.dev/docs/editor/api/input-rules)

### Feature 3: Template Library

**What:** Template picker UI, template insertion, built-in templates + custom templates

**How:** React component for picker UI + sql.js storage + slash command integration

**Integration Points:**
- React component: `TemplatePicker.tsx` (modal/dropdown)
- Data storage: sql.js `templates` table
- Slash command: `/template` in SLASH_COMMANDS registry
- NotebookContext: `applyTemplate(templateId)` method

**Implementation:**

**New Components:**
```
src/components/notebook/templates/
  TemplatePicker.tsx        — UI for browsing/selecting templates
  TemplatePreview.tsx       — Preview card for template
  TemplateEditor.tsx        — Create/edit custom templates
  TemplateContext.tsx       — Template CRUD operations
  templates.ts              — Template utilities
```

**Database Schema:**
```sql
-- Already exists in types/notebook.ts as NotebookTemplate interface
-- Need migration to create table if it doesn't exist
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'custom',
  card_type TEXT DEFAULT 'capture',
  markdown_content TEXT NOT NULL,
  properties TEXT, -- JSON
  preview_image TEXT,
  tags TEXT, -- JSON array
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0
);
```

**Slash Command Integration:**
```typescript
// Add to SLASH_COMMANDS in slash-commands.ts
{
  id: 'insert-template',
  label: 'Insert Template',
  description: 'Insert a template',
  category: 'template',
  shortcut: 'template',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run();
    // Dispatch event for TemplatePicker to open
    window.dispatchEvent(new CustomEvent('isometry:open-template-picker'));
  },
}
```

**Files Modified:**
- `src/components/notebook/editor/extensions/slash-commands.ts` — Add /template command
- `src/contexts/NotebookContext.tsx` — Add applyTemplate() method
- `src/components/notebook/CaptureComponent.tsx` — Listen for template events
- `src/db/schema.sql` — Add templates table if missing

**Files Created:**
- `src/components/notebook/templates/TemplatePicker.tsx`
- `src/components/notebook/templates/TemplatePreview.tsx`
- `src/components/notebook/templates/TemplateEditor.tsx`
- `src/components/notebook/templates/TemplateContext.tsx`
- `src/components/notebook/templates/index.ts`
- `src/utils/templates.ts` — Template utilities

**Confidence:** MEDIUM (UI design needs thought, but data layer is straightforward)

**Note:** Built-in templates already exist in `src/types/notebook.ts` as `BUILT_IN_TEMPLATES` array. Need to seed sql.js on first run.

### Feature 4: Backlinks Panel

**What:** Panel showing all cards that link TO the current card

**How:** React component + sql.js query + collapsible panel in CaptureComponent

**Integration Points:**
- React component: `BacklinksPanel.tsx`
- Data query: Already exists as `queryBacklinks()` in `src/utils/editor/backlinks.ts`
- UI placement: Below PropertyEditor in CaptureComponent
- Selection: Clicking backlink loads that card (via NotebookContext.loadCard())

**Implementation:**

**New Component:**
```typescript
// src/components/notebook/BacklinksPanel.tsx
interface BacklinksPanelProps {
  cardId: string;
  theme: string;
  onBacklinkClick: (cardId: string) => void;
}

export function BacklinksPanel({ cardId, theme, onBacklinkClick }: BacklinksPanelProps) {
  const { db } = useSQLite();
  const [backlinks, setBacklinks] = useState<BacklinkInfo[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Use existing queryBacklinks() from utils/editor/backlinks.ts
    const results = queryBacklinks(db, cardId);
    setBacklinks(results);
  }, [db, cardId]);

  // Render collapsible panel similar to PropertyEditor
  // ...
}
```

**Files Modified:**
- `src/components/notebook/CaptureComponent.tsx` — Add BacklinksPanel below PropertyEditor

**Files Created:**
- `src/components/notebook/BacklinksPanel.tsx`

**Confidence:** HIGH (query already exists, UI pattern matches PropertyEditor)

**Note:** The backlinks query is already implemented in `src/utils/editor/backlinks.ts` lines 86-113. Just needs UI.

### Feature 5: Notion Block Types

**What:** /heading1, /heading2, /callout, /divider, /quote, /code, /table

**How:** Extend SLASH_COMMANDS registry with block insertion actions

**Integration Points:**
- Slash commands registry: `src/components/notebook/editor/extensions/slash-commands.ts`
- TipTap commands: editor.chain().setHeading(), toggleBlockquote(), etc.
- Custom blocks (callout, divider): New TipTap Node extensions

**Implementation:**

**Extend SLASH_COMMANDS:**
```typescript
// Add to slash-commands.ts
{
  id: 'heading-1',
  label: 'Heading 1',
  description: 'Large section heading',
  category: 'format',
  shortcut: 'h1',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
  },
},
{
  id: 'callout',
  label: 'Callout',
  description: 'Highlighted info box',
  category: 'format',
  shortcut: 'callout',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).insertContent(
      '<div class="callout callout-info"><p></p></div>'
    ).run();
  },
},
// ... more block types
```

**Custom Node Extensions (if needed):**
```typescript
// src/components/notebook/editor/extensions/callout.ts
import { Node } from '@tiptap/core';

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: { default: 'info' }, // info, warning, success, error
    };
  },

  parseHTML() {
    return [{ tag: 'div.callout' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { class: 'callout callout-' + HTMLAttributes.type }, 0];
  },
});
```

**Files Modified:**
- `src/components/notebook/editor/extensions/slash-commands.ts` — Add block type commands

**Files Created (if custom nodes needed):**
- `src/components/notebook/editor/extensions/callout.ts`
- `src/components/notebook/editor/extensions/divider.ts`

**Confidence:** HIGH (slash command pattern already proven, most blocks use StarterKit commands)

**Sources:**
- [TipTap Notion-like Template](https://tiptap.dev/docs/ui-components/templates/notion-like-editor)
- [BlockNote (Notion-style editor on TipTap)](https://github.com/TypeCellOS/BlockNote)

### Feature 6: Inline Properties

**What:** Notion-style inline property chips (e.g., `@status: in-progress`, `#tag`)

**How:** TipTap Mark extensions + custom rendering

**Integration Points:**
- New Mark extensions: InlineProperty, HashTag
- PropertyEditor: Sync inline properties with property panel
- Rendering: Custom CSS for chip styling

**Implementation:**

**Mark Extension:**
```typescript
// src/components/notebook/editor/extensions/inline-property.ts
import { Mark } from '@tiptap/core';

export const InlineProperty = Mark.create({
  name: 'inlineProperty',

  addAttributes() {
    return {
      key: { default: null },
      value: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-property]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        'data-property': HTMLAttributes.key,
        class: 'inline-property',
      },
      `@${HTMLAttributes.key}: ${HTMLAttributes.value}`,
    ];
  },
});
```

**Input Rule for Auto-conversion:**
```typescript
// Typing @status: value → converts to inline property mark
addInputRules() {
  return [
    markInputRule({
      find: /@(\w+):\s*(\w+)/,
      type: this.type,
      getAttributes: (match) => ({
        key: match[1],
        value: match[2],
      }),
    }),
  ];
}
```

**Files Modified:**
- `src/hooks/ui/useTipTapEditor.ts` — Add InlineProperty extension
- `src/components/notebook/PropertyEditor.tsx` — Sync with inline properties

**Files Created:**
- `src/components/notebook/editor/extensions/inline-property.ts`
- `src/components/notebook/editor/extensions/hashtag.ts`

**Confidence:** MEDIUM (requires careful state sync between editor and PropertyEditor)

**Note:** This is the most complex feature because it requires bi-directional sync: typing inline property should update PropertyEditor, and editing in PropertyEditor should update inline marks.

### Feature 7: Isometry-Native Embeds

**What:** /supergrid, /network, /timeline — live D3.js view embeds in the editor

**How:** TipTap NodeView extensions + D3.js renderers + LATCH filter context

**Integration Points:**
- NodeView extensions: EmbedSuperGrid, EmbedNetwork, EmbedTimeline
- D3.js renderers: Reuse existing SuperGridRenderer, NetworkRenderer, TimelineRenderer
- Filter context: Pass current card's LATCH filters to embedded views
- Data queries: sql.js queries for filtered data

**Implementation:**

**NodeView Extension Pattern:**
```typescript
// src/components/notebook/editor/extensions/embed-supergrid.ts
import { Node, ReactNodeViewRenderer } from '@tiptap/react';
import { EmbedSuperGridView } from './EmbedSuperGridView';

export const EmbedSuperGrid = Node.create({
  name: 'embedSuperGrid',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      filters: { default: {} }, // LATCH filters
      width: { default: '100%' },
      height: { default: '400px' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-embed="supergrid"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-embed': 'supergrid', ...HTMLAttributes }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedSuperGridView);
  },
});
```

**React NodeView Component:**
```typescript
// src/components/notebook/editor/extensions/EmbedSuperGridView.tsx
import { NodeViewWrapper } from '@tiptap/react';
import { SuperGridRenderer } from '@/d3/grid-rendering/SuperGridRenderer';

export function EmbedSuperGridView({ node }: { node: any }) {
  const { db } = useSQLite();
  const svgRef = useRef<SVGSVGElement>(null);
  const filters = node.attrs.filters;

  useEffect(() => {
    if (!svgRef.current || !db) return;

    // Query data with filters
    const data = queryFilteredData(db, filters);

    // Render with D3.js
    const renderer = new SuperGridRenderer(svgRef.current);
    renderer.render(data);

    return () => renderer.destroy();
  }, [db, filters]);

  return (
    <NodeViewWrapper className="embed-supergrid">
      <svg ref={svgRef} width={node.attrs.width} height={node.attrs.height} />
    </NodeViewWrapper>
  );
}
```

**Slash Command:**
```typescript
// Add to SLASH_COMMANDS
{
  id: 'embed-supergrid',
  label: 'SuperGrid Embed',
  description: 'Insert live SuperGrid view',
  category: 'isometry',
  shortcut: 'supergrid',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).insertContent({
      type: 'embedSuperGrid',
      attrs: { filters: {}, width: '100%', height: '400px' },
    }).run();
  },
}
```

**Files Modified:**
- `src/components/notebook/editor/extensions/slash-commands.ts` — Add embed commands
- `src/hooks/ui/useTipTapEditor.ts` — Add embed extensions

**Files Created:**
- `src/components/notebook/editor/extensions/embed-supergrid.ts`
- `src/components/notebook/editor/extensions/EmbedSuperGridView.tsx`
- `src/components/notebook/editor/extensions/embed-network.ts`
- `src/components/notebook/editor/extensions/EmbedNetworkView.tsx`
- `src/components/notebook/editor/extensions/embed-timeline.ts`
- `src/components/notebook/editor/extensions/EmbedTimelineView.tsx`
- `src/utils/embed-filters.ts` — Filter parsing utilities

**Confidence:** MEDIUM-LOW (most complex feature, requires D3.js renderer integration within TipTap)

**Challenge:** TipTap NodeViews render inside the editor DOM. D3.js renderers expect to control an SVG element. Need careful lifecycle management to avoid conflicts.

**Recommendation:** Start with read-only embeds (no interactions), then add interactions in Phase 2.

**Sources:**
- [TipTap Node Views Documentation](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension)
- [TipTap React Node View Renderer](https://tiptap.dev/docs/editor/getting-started/install/react)

## System Architecture Diagrams

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ CaptureComponent                                            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Header (minimize, save, card ID)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ EditorToolbar (formatting buttons)                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ TipTapEditor (useTipTapEditor hook)                  │  │
│  │                                                       │  │
│  │  Extensions:                                         │  │
│  │  • StarterKit (bold, italic, lists, etc.)           │  │
│  │  • Link (auto-detect URLs)                          │  │
│  │  • Placeholder                                       │  │
│  │  • SlashCommands ──→ Tippy popup                    │  │
│  │  • WikiLink ──→ Tippy popup                         │  │
│  │                                                       │  │
│  │  Auto-save: debounced → updateCard()                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PropertyEditor (collapsible)                         │  │
│  │  • Built-in properties: tags, priority, status...   │  │
│  │  • Custom properties: user-defined                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↓                           ↓
   NotebookContext          useSQLite / SQLiteProvider
         ↓                           ↓
   loadCard(), updateCard()     db.exec(), db.run()
         ↓                           ↓
         └───────────→ sql.js ←──────┘
```

### Enhanced Architecture (v6.2)

```
┌─────────────────────────────────────────────────────────────┐
│ CaptureComponent                                            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Header + TemplatePicker button                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ EditorToolbar (enhanced with block type dropdowns)   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ TipTapEditor (useTipTapEditor hook)                  │  │
│  │                                                       │  │
│  │  NEW Extensions:                                     │  │
│  │  • AppleNotesKeyboardShortcuts                       │  │
│  │  • Callout (custom block)                           │  │
│  │  • Divider (custom block)                           │  │
│  │  • InlineProperty (inline @status)                  │  │
│  │  • HashTag (#tag marks)                             │  │
│  │  • EmbedSuperGrid (NodeView)  ─┐                    │  │
│  │  • EmbedNetwork (NodeView)     ├─→ D3.js renderers  │  │
│  │  • EmbedTimeline (NodeView)   ─┘                    │  │
│  │                                                       │  │
│  │  Enhanced SlashCommands:                             │  │
│  │  • /h1, /h2, /h3                                     │  │
│  │  • /callout, /divider, /quote                       │  │
│  │  • /template                                         │  │
│  │  • /supergrid, /network, /timeline                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ BacklinksPanel (NEW - collapsible)                   │  │
│  │  • Query: queryBacklinks(cardId)                    │  │
│  │  • Click → loadCard(backlinkId)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PropertyEditor (enhanced with inline sync)           │  │
│  │  • Sync with InlineProperty marks                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↓                           ↓
   NotebookContext          useSQLite / SQLiteProvider
   + TemplateContext               ↓
         ↓                    db.exec(), db.run()
   loadCard(), updateCard()        ↓
   applyTemplate()            queryBacklinks()
         ↓                    queryFilteredData()
         └───────────→ sql.js ←──────┘
                         ↓
                   templates table (NEW)
```

### Component Hierarchy

```
CaptureComponent
├── Header
│   ├── Title bar
│   ├── Save button
│   └── TemplatePicker trigger (NEW)
├── EditorToolbar
│   ├── Formatting buttons
│   └── Block type dropdown (NEW)
├── TipTapEditor
│   ├── EditorContent (from @tiptap/react)
│   └── Extensions
│       ├── Existing
│       │   ├── StarterKit
│       │   ├── Link
│       │   ├── Placeholder
│       │   ├── SlashCommands
│       │   └── WikiLink
│       └── NEW
│           ├── AppleNotesKeyboardShortcuts
│           ├── Callout
│           ├── Divider
│           ├── InlineProperty
│           ├── HashTag
│           ├── EmbedSuperGrid
│           ├── EmbedNetwork
│           └── EmbedTimeline
├── BacklinksPanel (NEW)
│   ├── Collapse/expand header
│   ├── Backlink list
│   └── Click handlers → loadCard()
└── PropertyEditor
    ├── Built-in properties
    ├── Custom properties
    └── Inline property sync (NEW)

Modals/Overlays (rendered at root):
├── TemplatePicker (NEW)
│   ├── Template grid
│   ├── Preview pane
│   └── Apply button
└── TemplateEditor (NEW)
    ├── Template metadata
    ├── Content editor
    └── Save/delete buttons
```

## Folder Structure (Recommended)

Following React best practices for feature-based organization:

```
src/
├── components/
│   └── notebook/
│       ├── CaptureComponent.tsx                    (MODIFY)
│       ├── PropertyEditor.tsx                      (MODIFY)
│       ├── BacklinksPanel.tsx                      (NEW)
│       ├── editor/
│       │   ├── TipTapEditor.tsx
│       │   ├── EditorToolbar.tsx                   (MODIFY)
│       │   ├── SlashCommandMenu.tsx
│       │   ├── WikiLinkMenu.tsx
│       │   ├── extensions/
│       │   │   ├── index.ts                        (MODIFY)
│       │   │   ├── slash-commands.ts               (MODIFY - add block types)
│       │   │   ├── wiki-links.ts
│       │   │   ├── keyboard-shortcuts.ts           (NEW)
│       │   │   ├── callout.ts                      (NEW)
│       │   │   ├── divider.ts                      (NEW)
│       │   │   ├── inline-property.ts              (NEW)
│       │   │   ├── hashtag.ts                      (NEW)
│       │   │   ├── embed-supergrid.ts              (NEW)
│       │   │   ├── embed-network.ts                (NEW)
│       │   │   ├── embed-timeline.ts               (NEW)
│       │   │   ├── EmbedSuperGridView.tsx          (NEW)
│       │   │   ├── EmbedNetworkView.tsx            (NEW)
│       │   │   └── EmbedTimelineView.tsx           (NEW)
│       │   └── index.ts
│       └── templates/
│           ├── TemplatePicker.tsx                  (NEW)
│           ├── TemplatePreview.tsx                 (NEW)
│           ├── TemplateEditor.tsx                  (NEW)
│           ├── TemplateContext.tsx                 (NEW)
│           └── index.ts                            (NEW)
├── hooks/
│   └── ui/
│       └── useTipTapEditor.ts                      (MODIFY - add new extensions)
├── contexts/
│   └── NotebookContext.tsx                         (MODIFY - add applyTemplate)
├── utils/
│   ├── editor/
│   │   ├── backlinks.ts                            (EXISTS - no changes needed)
│   │   └── index.ts
│   ├── templates.ts                                (NEW)
│   └── embed-filters.ts                            (NEW)
├── types/
│   └── notebook.ts                                 (EXISTS - has NotebookTemplate)
└── db/
    └── schema.sql                                  (MODIFY - add templates table)
```

**Principles:**
- Feature-based: templates/ subfolder groups all template-related components
- Extension co-location: All TipTap extensions in editor/extensions/
- Separation: React components (UI) separate from utilities (logic)
- Flat-ish: Avoid deep nesting (max 3-4 levels)

**Sources:**
- [React Folder Structure Best Practices 2025](https://www.robinwieruch.de/react-folder-structure/)
- [Feature-based Architecture](https://profy.dev/article/react-folder-structure)

## Build Order & Dependencies

### Phase 1: Foundation (No Dependencies)
**Duration:** 1-2 days

1. **Keyboard Shortcuts Extension**
   - Pure TipTap extension
   - No UI, no data layer
   - Uses existing StarterKit commands
   - **Files:** `keyboard-shortcuts.ts` + modify `useTipTapEditor.ts`

2. **Smart Formatting**
   - StarterKit configuration enhancement
   - No new files
   - **Files:** Modify `useTipTapEditor.ts` only

**Deliverable:** Apple Notes keyboard fluency

### Phase 2: Data Layer (Minimal UI Dependencies)
**Duration:** 2-3 days

3. **Template System**
   - Database schema: templates table
   - Template CRUD utilities
   - **Files:** `templates.ts`, `schema.sql`, `TemplateContext.tsx`
   - **Dependency:** Database migration

4. **Backlinks Panel**
   - React component using existing query
   - **Files:** `BacklinksPanel.tsx`, modify `CaptureComponent.tsx`
   - **Dependency:** None (query already exists)

**Deliverable:** Template library + backlinks navigation

### Phase 3: UI Components (Depends on Phase 2 data)
**Duration:** 3-4 days

5. **Template Picker UI**
   - Modal/dropdown component
   - Template preview cards
   - **Files:** `TemplatePicker.tsx`, `TemplatePreview.tsx`, `TemplateEditor.tsx`
   - **Dependency:** Template data layer (Phase 2)

6. **Enhanced Slash Commands**
   - Block type commands (/h1, /callout, etc.)
   - Template insertion command
   - **Files:** Modify `slash-commands.ts`
   - **Dependency:** Template system (Phase 2)

**Deliverable:** Full template workflow + Notion-style blocks

### Phase 4: Advanced Extensions (Depends on All Previous)
**Duration:** 4-5 days

7. **Custom Block Nodes**
   - Callout, Divider custom nodes
   - **Files:** `callout.ts`, `divider.ts`
   - **Dependency:** Enhanced slash commands (Phase 3)

8. **Inline Properties**
   - InlineProperty and HashTag marks
   - Sync with PropertyEditor
   - **Files:** `inline-property.ts`, `hashtag.ts`, modify `PropertyEditor.tsx`
   - **Dependency:** PropertyEditor refactoring (complex state sync)

**Deliverable:** Obsidian-style inline properties

### Phase 5: Embeds (Most Complex, Depends on Everything)
**Duration:** 5-7 days

9. **Embed Infrastructure**
   - Filter parsing utilities
   - NodeView base components
   - **Files:** `embed-filters.ts`, base NodeView patterns

10. **SuperGrid Embed**
    - EmbedSuperGrid extension + view
    - Integration with existing SuperGridRenderer
    - **Files:** `embed-supergrid.ts`, `EmbedSuperGridView.tsx`
    - **Dependency:** Embed infrastructure

11. **Network & Timeline Embeds**
    - EmbedNetwork and EmbedTimeline
    - **Files:** `embed-network.ts`, `EmbedNetworkView.tsx`, etc.
    - **Dependency:** SuperGrid embed pattern

**Deliverable:** Live Isometry view embeds

### Dependency Graph

```
Phase 1 (Foundation)
  ├─→ Phase 2 (Data Layer)
  │     ├─→ Phase 3 (UI Components)
  │     │     ├─→ Phase 4 (Advanced Extensions)
  │     │     │     └─→ Phase 5 (Embeds)
  │     │     │
  │     │     └─→ Phase 5 (Embeds - can start in parallel)
  │     │
  │     └─→ Phase 4 (can start after data layer)
  │
  └─→ Phase 3 (some UI can start in parallel with Phase 2)
```

**Critical Path:** 1 → 2 → 3 → 4 → 5 (serial dependencies)

**Parallelization Opportunities:**
- Backlinks Panel (Phase 2) can be built in parallel with Template System
- Some slash commands (Phase 3) can be built while Template UI is in progress
- Custom blocks (Phase 4) don't depend on inline properties, can be parallel

**Recommended Approach:** Complete in phase order for predictable progress, OR interleave Phase 2/3 features for faster user-visible results.

## Integration Point Summary

### Files to Modify (Existing)

| File | Changes | Complexity |
|------|---------|-----------|
| `src/hooks/ui/useTipTapEditor.ts` | Add 8+ new extensions to extensions array | LOW |
| `src/components/notebook/CaptureComponent.tsx` | Add BacklinksPanel, TemplatePicker trigger | MEDIUM |
| `src/components/notebook/editor/extensions/slash-commands.ts` | Add 15+ new commands | LOW |
| `src/components/notebook/PropertyEditor.tsx` | Sync with inline properties | HIGH |
| `src/components/notebook/editor/EditorToolbar.tsx` | Add block type dropdown | LOW |
| `src/contexts/NotebookContext.tsx` | Add applyTemplate() method | LOW |
| `src/db/schema.sql` | Add templates table | LOW |

### Files to Create (New)

**Extensions (11 files):**
- `keyboard-shortcuts.ts`
- `callout.ts`
- `divider.ts`
- `inline-property.ts`
- `hashtag.ts`
- `embed-supergrid.ts` + `EmbedSuperGridView.tsx`
- `embed-network.ts` + `EmbedNetworkView.tsx`
- `embed-timeline.ts` + `EmbedTimelineView.tsx`

**Templates (5 files):**
- `TemplatePicker.tsx`
- `TemplatePreview.tsx`
- `TemplateEditor.tsx`
- `TemplateContext.tsx`
- `index.ts`

**Other Components (1 file):**
- `BacklinksPanel.tsx`

**Utilities (2 files):**
- `templates.ts`
- `embed-filters.ts`

**Total:** 19 new files, 7 modified files

## Testing Strategy

### Unit Tests

**Pattern:** Co-locate tests with extensions

```
src/components/notebook/editor/extensions/
  keyboard-shortcuts.ts
  __tests__/
    keyboard-shortcuts.test.ts
```

**Test Coverage:**
- Each extension: render, attributes, commands
- Slash commands: filtering, insertion, action execution
- Templates: CRUD operations, validation
- Backlinks: query results, click handlers
- Embeds: NodeView lifecycle, D3.js rendering

### Integration Tests

**Scenarios:**
1. Type keyboard shortcut → text formatted
2. Type slash command → popup appears → select → content inserted
3. Apply template → content + properties inserted
4. Create wiki link → backlink appears in target card
5. Insert embed → D3.js view renders → data updates → view re-renders

**Tools:**
- Vitest for runner
- @testing-library/react for component tests
- TipTap test utilities for editor tests

### E2E Tests (Deferred to Phase 6)

**Scenarios:**
- Full capture workflow: create card → format → add properties → link to other card → check backlinks
- Template workflow: create custom template → apply to card → verify
- Embed workflow: insert SuperGrid → apply filters → verify data

## Performance Considerations

### Critical Constraints

**From existing architecture:**
- `shouldRerenderOnTransaction: false` — MUST maintain for 10K+ char documents
- Debounced auto-save (2s delay) — DO NOT trigger on every extension action
- Key functions in D3.js data binding — Embeds MUST use `d => d.id` pattern

**New concerns:**

1. **Backlinks Query Performance**
   - Query runs on every card load
   - Index needed: `CREATE INDEX idx_edges_target ON edges(target_id, edge_type)`
   - Limit results: Default to 50, paginate if more

2. **Template Rendering**
   - BUILT_IN_TEMPLATES array (6 templates) is fine for in-memory
   - Custom templates from sql.js: Cache in TemplateContext
   - Preview generation: Debounce markdown → HTML conversion

3. **Embed Rendering**
   - D3.js renderers are expensive (especially SuperGrid)
   - Intersection Observer: Only render embeds when visible
   - Lazy load: Don't render embeds on initial page load
   - Memoization: Cache filtered data queries

4. **Inline Property Sync**
   - Parsing editor content for @property marks can be slow
   - Debounce sync: Only sync on editor blur, not every keystroke
   - One-way sync for MVP: Editor → PropertyEditor (not reverse)

**Performance Budget:**
- Keyboard shortcuts: <10ms latency
- Slash command popup: <100ms to appear
- Template insertion: <200ms
- Backlinks query: <50ms for 100 backlinks
- Embed initial render: <500ms
- Embed re-render: <200ms

## Edge Cases & Pitfalls

### TipTap Extension Conflicts

**Problem:** Multiple extensions handling the same keyboard shortcut
**Solution:** Extension order matters. AppleNotesKeyboardShortcuts should come AFTER StarterKit to override defaults

**Problem:** Custom NodeViews not cleaning up D3.js renderers
**Solution:** Implement cleanup in NodeView destroy() lifecycle

### State Sync Issues

**Problem:** PropertyEditor and InlineProperty out of sync
**Solution:** Single source of truth = editor content. PropertyEditor is read-only mirror for inline properties.

**Problem:** Template insertion overwrites user content
**Solution:** Always confirm before applying template if editor has content

### Database Migration

**Problem:** templates table doesn't exist on upgrade
**Solution:** Migration script with IF NOT EXISTS

```sql
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  -- ... full schema
);

-- Seed built-in templates
INSERT OR IGNORE INTO templates (id, name, ...)
VALUES ('meeting-notes', 'Meeting Notes', ...);
```

### Embed Lifecycle

**Problem:** Embed renders before sql.js is ready
**Solution:** Guard in NodeView: `if (!db) return <LoadingSpinner />`

**Problem:** Embed doesn't update when filters change
**Solution:** Watch filters in useEffect dependency array

**Problem:** Multiple embeds thrashing sql.js with queries
**Solution:** Query batching or caching layer

## Security & Validation

### SQL Injection

**Risk:** LOW — sql.js uses parameterized queries
**Check:** All queries use `?` placeholders, never string concatenation

### XSS in Markdown

**Risk:** MEDIUM — User content rendered as HTML
**Mitigation:** TipTap sanitizes by default, but verify custom nodes don't bypass

### Template Injection

**Risk:** LOW — Templates are stored markdown, not executable code
**Check:** Template content doesn't execute JavaScript

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Keyboard Shortcuts | HIGH | Official TipTap pattern, simple implementation |
| Smart Formatting | HIGH | StarterKit configuration, well-documented |
| Template System | MEDIUM | UI design needs iteration, data layer straightforward |
| Backlinks Panel | HIGH | Query exists, UI pattern proven in PropertyEditor |
| Block Types | HIGH | Slash command pattern proven, most use StarterKit |
| Inline Properties | MEDIUM | State sync complexity, needs careful design |
| Embeds | MEDIUM-LOW | Most complex, D3.js + TipTap integration unproven |

## Open Questions

1. **Template Picker UX:** Modal vs dropdown vs sidebar panel?
   - **Recommendation:** Start with modal (simpler), iterate to sidebar if needed

2. **Backlinks Panel Placement:** Above or below PropertyEditor?
   - **Recommendation:** Below PropertyEditor (backlinks less frequently used)

3. **Embed Interactivity:** Should embedded SuperGrid allow PAFV changes?
   - **Recommendation:** Phase 1 = read-only, Phase 2 = interactive

4. **Inline Property Sync Direction:** Bidirectional or one-way?
   - **Recommendation:** One-way (editor → PropertyEditor) for MVP

5. **Custom Block Styling:** NeXTSTEP theme vs Modern theme?
   - **Recommendation:** Both, using existing theme context

## Roadmap Implications

### Phase Structure Recommendation

**Phase 94: Keyboard & Formatting** (1-2 days)
- Keyboard shortcuts extension
- Smart formatting configuration
- **Rationale:** Quick wins, no UI complexity

**Phase 95: Templates & Backlinks** (3-4 days)
- Template data layer + CRUD
- Backlinks panel
- Template picker UI
- **Rationale:** Core data features, enables Phases 96-97

**Phase 96: Block Types** (2-3 days)
- Enhanced slash commands (headings, blocks)
- Custom nodes (callout, divider)
- **Rationale:** Notion-style editing experience

**Phase 97: Inline Properties** (3-4 days)
- InlineProperty and HashTag marks
- PropertyEditor sync
- **Rationale:** Obsidian power features, complex state sync

**Phase 98: Embeds** (5-7 days)
- Embed infrastructure
- SuperGrid embed
- Network & Timeline embeds
- **Rationale:** Most complex, Isometry differentiation

**Phase 99: Polish & Testing** (2-3 days)
- Integration testing
- Performance optimization
- Edge case handling
- **Rationale:** Production readiness

**Total Estimated Duration:** 16-23 days (3-4.5 weeks)

### Research Flags for Phases

| Phase | Research Flag | Why |
|-------|--------------|-----|
| 94 | None | Straightforward TipTap extension |
| 95 | Template picker UX | Need design iteration |
| 96 | None | Proven slash command pattern |
| 97 | State sync architecture | Complex bidirectional sync |
| 98 | D3.js + NodeView integration | Unproven pattern, needs spike |
| 99 | None | Standard testing |

**Deep research needed:** Phase 98 (Embeds) — Consider 1-day spike to prove D3.js rendering inside TipTap NodeView works as expected.

## Sources

### TipTap Official Documentation
- [Extensions API](https://tiptap.dev/docs/editor/core-concepts/extensions)
- [Keyboard Shortcuts](https://tiptap.dev/docs/editor/core-concepts/keyboard-shortcuts)
- [Node Views](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension)
- [Notion-like Template](https://tiptap.dev/docs/ui-components/templates/notion-like-editor)
- [UI Components](https://tiptap.dev/docs/ui-components/getting-started/overview)
- [React Integration](https://tiptap.dev/docs/editor/getting-started/install/react)
- [Markdown Support](https://tiptap.dev/docs/editor/markdown)

### Apple Notes
- [Keyboard Shortcuts and Gestures](https://support.apple.com/guide/notes/keyboard-shortcuts-and-gestures-apd46c25187e/mac)

### Third-Party Resources
- [BlockNote - Notion-style Editor on TipTap](https://github.com/TypeCellOS/BlockNote)
- [React Folder Structure Best Practices 2025](https://www.robinwieruch.de/react-folder-structure/)
- [Feature-based Architecture](https://profy.dev/article/react-folder-structure)
- [Obsidian Backlinks Documentation](https://help.obsidian.md/plugins/backlinks)

### Existing Codebase
- `src/hooks/ui/useTipTapEditor.ts` — Editor configuration patterns
- `src/components/notebook/editor/extensions/slash-commands.ts` — Command registry pattern
- `src/components/notebook/editor/extensions/wiki-links.ts` — Mark extension pattern
- `src/utils/editor/backlinks.ts` — Backlinks query implementation
- `src/types/notebook.ts` — Template types and built-in templates

---

*Research complete. Ready for Phase 94 planning.*
