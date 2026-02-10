# Phase 45: TipTap Editor Migration - Research

**Researched:** 2026-02-10
**Domain:** Rich text editing with ProseMirror/TipTap
**Confidence:** HIGH

## Summary

TipTap is a headless, extensible rich text editor built on ProseMirror that provides the foundation needed for migrating from MDEditor to a more powerful editing experience. The phase involves replacing `@uiw/react-md-editor` (currently at ^4.0.11) with TipTap 3.x, implementing slash commands for card operations, adding bidirectional wiki-style linking with `[[page]]` syntax, and optimizing performance for 10,000+ character documents using `shouldRerenderOnTransaction: false`.

**Primary recommendation:** Use TipTap 3.19.0+ with the official @tiptap/react bindings, implement slash commands via @tiptap/suggestion (not experimental extension or third-party packages), build custom bidirectional link extension using ProseMirror marks, and apply performance optimizations from the start (shouldRerenderOnTransaction: false, useEditorState hook for UI updates).

**Key architecture decision:** TipTap stores content internally as ProseMirror JSON, but we need Markdown persistence in sql.js. Use @tiptap/extension-markdown for bidirectional conversion, but be aware it's early-stage (v3) and may have edge cases. Test thoroughly during implementation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tiptap/react | ^3.19.0 | React bindings for TipTap editor | Official React integration with hooks, context, and TypeScript support. Industry standard (GitBook, Linear, Cal.com use it). Latest v3 release (Feb 2026) improves performance and adds declarative `<Tiptap>` component. |
| @tiptap/pm | ^3.19.0 | ProseMirror dependencies wrapper | Required peer dependency. Ensures version compatibility between TipTap core and all extensions. Prevents ProseMirror version conflicts that broke builds in the past. |
| @tiptap/starter-kit | ^3.18.0 | Essential editor extensions bundle | Includes Doc, Paragraph, Text (required nodes), plus Heading, Bold, Italic, BulletList, OrderedList, Code, CodeBlock. Configurable—can disable unwanted extensions. Faster than importing individually. |
| @tiptap/suggestion | ^3.19.0 | Autocomplete/command menu utility | Foundation for slash commands, mentions, and autocomplete. Official utility used by TipTap's own extensions. Provides trigger detection, filtering, keyboard navigation, positioning. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tiptap/extension-markdown | ^3.19.0 | Markdown parsing and serialization | Required for sql.js persistence. Converts Markdown ↔ ProseMirror JSON. Note: Early release (v3), may have edge cases with complex Markdown. Test thoroughly. |
| @tiptap/extension-link | ^3.15.3 | Hyperlink support | Needed as foundation for bidirectional links. Provides mark schema and link validation. Will extend this for `[[wikilink]]` syntax. |
| @tiptap/extension-placeholder | ^3.19.0 | Empty editor placeholder text | UX improvement. Shows "Type / for commands..." when editor empty. Minimal overhead. |
| @tiptap/extension-typography | ^3.19.0 | Smart quotes, dashes, ellipses | Optional. Improves writing experience. Adds ~2KB. Enable if users write prose. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TipTap | ProseMirror directly | **When:** Need absolute control over schema and plugins, minimal abstraction overhead. **Why TipTap wins:** Extension ecosystem saves weeks of dev time. ProseMirror is powerful but low-level—TipTap adds convenience without sacrificing control. |
| TipTap | Slate.js | **When:** Already invested in Slate, need React-centric architecture. **Why TipTap wins:** Larger ecosystem (200+ extensions), ProseMirror foundation is more mature (10+ years), better TypeScript support. |
| TipTap | Lexical (Meta) | **When:** Need React-first design, newer architecture. **Why TipTap wins:** More mature (5+ years vs 2), larger plugin ecosystem, better documentation. Lexical growing but TipTap production-proven. |
| @tiptap/suggestion | @harshtalks/slash-tiptap | **When:** Want ready-made slash command UI. **Why DIY wins:** Full control over command structure, can integrate Isometry-specific commands (/save-card, /send-to-shell), no third-party dependency risk. Build on @tiptap/suggestion directly. |
| Custom bidirectional links | @benrbray/prosemirror-link-plugin | **When:** Want battle-tested implementation. **Why custom wins:** Noteworthy project provides reference implementation, but as custom extension we control autocomplete UX, sql.js integration for backlinks query, and link styling. |

**Installation:**
```bash
# Core packages
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit

# Extensions
npm install @tiptap/extension-markdown @tiptap/extension-link @tiptap/extension-placeholder

# Optional
npm install @tiptap/extension-typography

# DO NOT INSTALL (see "Don't Hand-Roll" section):
# - Experimental slash commands extension (not published)
# - Third-party slash command packages (add dependencies, may conflict)
# - react-tiptap or tiptap wrappers (use official @tiptap/react)
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── notebook/
│       ├── CaptureComponent.tsx          # Replace MDEditor with TipTap
│       └── editor/
│           ├── TipTapEditor.tsx          # Main editor component
│           ├── SlashCommandMenu.tsx      # Custom slash command UI
│           ├── WikiLinkMenu.tsx          # Bidirectional link autocomplete
│           └── extensions/
│               ├── slash-commands.ts     # Built on @tiptap/suggestion
│               ├── wiki-links.ts         # Custom mark extension
│               └── isometry-commands.ts  # /save-card, /send-to-shell
├── hooks/
│   └── ui/
│       ├── useMarkdownEditor.ts          # Adapt for TipTap (keep auto-save logic)
│       ├── useTipTapEditor.ts            # NEW: TipTap-specific hook
│       └── useSlashCommands.ts           # KEEP: Command registry, adapt for TipTap
└── utils/
    └── editor/
        ├── markdown-parser.ts            # Markdown → ProseMirror conversion
        └── backlinks.ts                  # Query sql.js for bidirectional link graph
```

### Pattern 1: Performance-Optimized Editor Setup
**What:** Configure TipTap to avoid unnecessary re-renders for large documents
**When to use:** Always—performance should be built-in from the start
**Example:**
```typescript
// Source: https://tiptap.dev/docs/guides/performance
import { useEditor, EditorContent } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

function TipTapEditor({ initialContent }: { initialContent: string }) {
  // Configure editor with performance optimizations
  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,

    // CRITICAL: Prevent re-render on every transaction
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
  });

  // Use selector hook for UI updates (toolbar, etc.)
  const editorState = useEditorState({
    editor,
    selector: ({ editor }) => ({
      isBold: editor.isActive('bold'),
      isItalic: editor.isActive('italic'),
      isEmpty: editor.isEmpty,
    }),
  });

  return (
    <div>
      <Toolbar state={editorState} editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
```

### Pattern 2: Slash Commands with @tiptap/suggestion
**What:** Implement Notion-style slash commands for card operations
**When to use:** Required for /save-card, /send-to-shell, and template insertion
**Example:**
```typescript
// Source: https://tiptap.dev/docs/editor/api/utilities/suggestion
import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';

interface SlashCommand {
  id: string;
  label: string;
  description: string;
  action: (editor: Editor) => void;
}

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',

        // Filter commands based on query
        items: ({ query }: { query: string }) => {
          return COMMANDS.filter(cmd =>
            cmd.label.toLowerCase().includes(query.toLowerCase())
          );
        },

        // Render React component for menu
        render: () => {
          let component: ReactRenderer;
          let popup: Instance[];

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandMenu, {
                props,
                editor: props.editor,
              });

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },

            onUpdate(props) {
              component.updateProps(props);
              popup[0].setProps({
                getReferenceClientRect: props.clientRect,
              });
            },

            onExit() {
              popup[0].destroy();
              component.destroy();
            },
          };
        },

        // Execute selected command
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      }),
    ];
  },
});

// Command registry (adapt existing useSlashCommands.ts)
const COMMANDS: SlashCommand[] = [
  {
    id: 'save-card',
    label: 'Save Card',
    description: 'Save current content as new card',
    action: (editor) => {
      const markdown = editor.storage.markdown.getMarkdown();
      // Call existing save logic
      handleSaveCard(markdown);
    },
  },
  {
    id: 'send-to-shell',
    label: 'Send to Shell',
    description: 'Send content or command to shell',
    action: (editor) => {
      const text = editor.state.doc.textContent;
      // Call existing shell logic
      handleSendToShell(text);
    },
  },
  // ... PAFV, LATCH, Graph queries from existing useSlashCommands.ts
];
```

### Pattern 3: Bidirectional Wiki Links with Custom Mark
**What:** Implement `[[page]]` syntax with autocomplete and backlink tracking
**When to use:** Required for connecting cards in the notebook
**Example:**
```typescript
// Source: https://github.com/benrbray/noteworthy (reference implementation)
// Source: https://tiptap.dev/docs/editor/extensions/marks/link
import { Mark } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const WikiLink = Mark.create({
  name: 'wikiLink',

  addAttributes() {
    return {
      href: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-type="wiki-link"]',
        getAttrs: (dom) => ({
          href: dom.getAttribute('href'),
          title: dom.getAttribute('title'),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', {
      ...HTMLAttributes,
      'data-type': 'wiki-link',
      class: 'wiki-link',
    }, 0];
  },

  addInputRules() {
    return [
      // Convert [[page]] to wiki link as you type
      {
        find: /\[\[([^\]]+)\]\]/,
        handler: ({ state, range, match }) => {
          const [, title] = match;
          const { tr } = state;

          tr.replaceWith(
            range.from,
            range.to,
            state.schema.text(title, [
              state.schema.marks.wikiLink.create({ title, href: `#${title}` })
            ])
          );
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wikiLinkAutocomplete'),

        // Detect [[ trigger and show autocomplete
        view: () => ({
          update: (view) => {
            const { state } = view;
            const { selection } = state;
            const { $from } = selection;

            // Check if typing [[
            const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
            const match = /\[\[([^\]]+)$/.exec(textBefore);

            if (match) {
              const query = match[1];
              // Query sql.js for matching cards
              const suggestions = querySQLiteForCards(query);
              // Show autocomplete menu (similar to slash commands)
              showWikiLinkMenu(suggestions, view);
            }
          },
        }),
      }),
    ];
  },
});

// Query sql.js for card suggestions
function querySQLiteForCards(query: string): Array<{ id: string; title: string }> {
  const results = db.exec(`
    SELECT id, name FROM nodes
    WHERE name LIKE ? AND deleted_at IS NULL
    ORDER BY modified_at DESC
    LIMIT 10
  `, [`%${query}%`]);

  return results[0]?.values.map(([id, name]) => ({ id, title: name })) || [];
}

// Query backlinks for a card (for backlinks panel)
function queryBacklinks(cardId: string): Array<{ id: string; title: string }> {
  const results = db.exec(`
    SELECT DISTINCT n.id, n.name
    FROM nodes n
    JOIN edges e ON e.source_id = n.id
    WHERE e.target_id = ? AND e.edge_type = 'LINK'
    ORDER BY e.created_at DESC
  `, [cardId]);

  return results[0]?.values.map(([id, name]) => ({ id, title: name })) || [];
}
```

### Pattern 4: Markdown Persistence with sql.js
**What:** Store TipTap content as Markdown in sql.js while editing as ProseMirror JSON
**When to use:** Auto-save and manual save operations
**Example:**
```typescript
// Adapt existing useMarkdownEditor.ts for TipTap
import { useEditor } from '@tiptap/react';
import { Markdown } from '@tiptap/extension-markdown';
import { useNotebook } from '@/contexts/NotebookContext';
import { debounce } from '@/utils/debounce';

export function useTipTapEditor(options: { autoSaveDelay?: number } = {}) {
  const { autoSaveDelay = 2000 } = options;
  const { activeCard, updateCard } = useNotebook();
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      SlashCommands,
      WikiLink,
    ],
    content: activeCard?.markdownContent || '',

    // Performance optimizations
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,

    onUpdate: ({ editor }) => {
      setIsDirty(true);
      debouncedSave(editor);
    },
  });

  // Auto-save to sql.js as Markdown
  const debouncedSave = useCallback(
    debounce(async (editor: Editor) => {
      if (!activeCard?.id) return;

      setIsSaving(true);
      try {
        // Convert ProseMirror → Markdown
        const markdown = editor.storage.markdown.getMarkdown();

        // Save to sql.js
        await updateCard(activeCard.id, {
          markdownContent: markdown,
          renderedContent: null,
        });

        setIsDirty(false);
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }, autoSaveDelay),
    [activeCard?.id, autoSaveDelay, updateCard]
  );

  // Manual save (Ctrl+S)
  const saveNow = useCallback(async () => {
    if (!editor || !activeCard?.id || !isDirty) return;

    setIsSaving(true);
    try {
      const markdown = editor.storage.markdown.getMarkdown();
      await updateCard(activeCard.id, {
        markdownContent: markdown,
        renderedContent: null,
      });
      setIsDirty(false);
    } catch (error) {
      console.error('Manual save failed:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [editor, activeCard?.id, isDirty, updateCard]);

  // Load Markdown from sql.js when active card changes
  useEffect(() => {
    if (activeCard?.markdownContent !== undefined && editor) {
      editor.commands.setContent(activeCard.markdownContent);
      setIsDirty(false);
    }
  }, [activeCard?.id, activeCard?.markdownContent, editor]);

  return {
    editor,
    isDirty,
    isSaving,
    saveNow,
    activeCard,
  };
}
```

### Anti-Patterns to Avoid
- **Don't use experimental slash commands extension:** It's not published and lacks support. Build on @tiptap/suggestion directly.
- **Don't re-render editor on every transaction:** Always set `shouldRerenderOnTransaction: false` for documents >1000 characters.
- **Don't access editor.state in render:** Use `useEditorState` hook with selectors instead.
- **Don't install third-party TipTap wrappers:** Use official `@tiptap/react` package. Wrappers add maintenance burden and version lag.
- **Don't store ProseMirror JSON in sql.js:** Store Markdown for portability and debugging. TipTap JSON is implementation detail.
- **Don't sync editor state to React state:** TipTap manages its own state. Only extract data on save, not on every keystroke.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slash command infrastructure | Custom / detection and autocomplete | @tiptap/suggestion utility | Handles trigger detection, query filtering, keyboard navigation, positioning, edge cases (backspace, escape, etc.). Building this correctly takes weeks. |
| Markdown ↔ JSON conversion | Custom parser/serializer | @tiptap/extension-markdown | Markdown parsing is full of edge cases (nested lists, code blocks, escaping). ProseMirror schema mapping is non-trivial. Extension handles both directions. |
| Link validation | Regex patterns for URLs | @tiptap/extension-link | Handles URL validation, auto-linking, paste detection, protocol normalization. Extend for wiki links, don't replace. |
| Undo/redo | Custom history tracking | ProseMirror history (in StarterKit) | Transaction-based undo/redo is complex. ProseMirror's implementation handles collaboration, cursor position restoration, grouped transactions. |
| Placeholder text | CSS ::before hacks | @tiptap/extension-placeholder | Handles empty state detection, multi-node documents, dynamic content. CSS-only breaks with TipTap's architecture. |
| Collaborative editing (future) | Custom CRDT implementation | @tiptap/collaboration (when needed) | CRDTs are difficult. Yjs integration is battle-tested. Don't build this—wait until multi-user is required, then add extension. |

**Key insight:** TipTap's extension ecosystem exists because rich text editing has thousands of edge cases. Custom implementations miss edge cases that TipTap extensions handle. Use extensions for infrastructure (autocomplete, parsing, history), build custom for domain logic (Isometry commands, PAFV templates, sql.js queries).

## Common Pitfalls

### Pitfall 1: Re-rendering on Every Keystroke
**What goes wrong:** Editor becomes sluggish on documents >5000 characters. React re-renders entire component tree on every transaction (every keystroke, selection change, cursor move).
**Why it happens:** Default TipTap behavior is `shouldRerenderOnTransaction: true` for backward compatibility. This was acceptable in v2, but v3 changed the recommendation.
**How to avoid:**
- Set `shouldRerenderOnTransaction: false` in `useEditor()` config
- Set `immediatelyRender: true` to render initial state immediately
- Use `useEditorState` hook with selectors for UI that depends on editor state (toolbar, status indicators)
**Warning signs:**
- Noticeable delay between typing and character appearing
- Console shows React DevTools warning about excessive renders
- CPU usage spikes when typing

### Pitfall 2: Missing ProseMirror Dependencies (@tiptap/pm)
**What goes wrong:** Build errors like `Cannot find module 'prosemirror-state'` or version conflicts between TipTap and direct ProseMirror imports.
**Why it happens:** TipTap v3 changed from bundling ProseMirror to marking it as peer dependency. Extensions may try to import ProseMirror packages directly, causing version mismatches.
**How to avoid:**
- Always install `@tiptap/pm` alongside `@tiptap/react`
- Import ProseMirror types from `@tiptap/pm` not from `prosemirror-*` packages
- Example: `import { EditorState } from '@tiptap/pm/state'` not `from 'prosemirror-state'`
**Warning signs:**
- TypeScript errors about incompatible ProseMirror types
- Runtime errors about missing ProseMirror modules
- npm warnings about unmet peer dependencies

### Pitfall 3: Storing ProseMirror JSON in Database
**What goes wrong:** Can't read stored content in other tools. Migration becomes difficult. Debugging requires understanding ProseMirror schema. Content is coupled to TipTap version.
**Why it happens:** TipTap's internal representation is ProseMirror JSON, which seems easier to store than converting to Markdown.
**How to avoid:**
- Always store Markdown in sql.js (`notebook_cards.markdown_content`)
- Use `editor.storage.markdown.getMarkdown()` on save
- Use `editor.commands.setContent(markdown)` on load
- Keep ProseMirror JSON as ephemeral state only
**Warning signs:**
- Database contains JSON like `{"type":"doc","content":[{"type":"paragraph"...`
- Content export breaks when upgrading TipTap
- Can't view card content outside the editor

### Pitfall 4: SSR/Hydration Issues (Not Applicable But Document for Future)
**What goes wrong:** In Next.js/SSR environments, editor fails to initialize or hydration mismatches occur.
**Why it happens:** TipTap relies on browser APIs (DOM, window). Server-side rendering tries to execute browser code.
**How to avoid (for future SSR work):**
- Set `immediatelyRender: false` in SSR environments
- Use dynamic imports: `const Editor = dynamic(() => import('./TipTapEditor'), { ssr: false })`
- Check `typeof window !== 'undefined'` before accessing editor
**Warning signs:**
- "window is not defined" errors in server logs
- Editor renders blank on initial page load
- React hydration warnings about mismatched content
**Note:** Not applicable for current Isometry (Tauri desktop app), but document for if we add web version.

### Pitfall 5: Markdown Extension Edge Cases
**What goes wrong:** Complex Markdown (nested blockquotes, tables, code blocks) doesn't round-trip correctly. Load Markdown → edit → save → load shows different content.
**Why it happens:** @tiptap/extension-markdown is early release (v3). Not all Markdown syntax has ProseMirror equivalents. Parser may silently drop unsupported elements.
**How to avoid:**
- Test round-trip conversion: Markdown → TipTap → Markdown for all user content
- Add custom extensions for Markdown features we need (tables, task lists, etc.)
- Consider fallback: if round-trip fails, store both Markdown and HTML in sql.js
**Warning signs:**
- Users report "missing content" after saving
- Tables or code blocks render incorrectly
- Nested lists lose indentation after edit

### Pitfall 6: Drag-and-Drop Conflicts with Existing react-dnd
**What goes wrong:** TipTap's built-in drag handles conflict with SuperGrid's @dnd-kit drag-and-drop. Both try to capture drag events.
**Why it happens:** TipTap registers global drag listeners. @dnd-kit (used in SuperGrid) also registers global listeners. Event handling conflicts.
**How to avoid:**
- Disable TipTap drag handles if editor is inside draggable SuperGrid cells: `editable: true, draggable: false` in editor config
- Or: scope drag handlers—TipTap handles only within `.editor` class, @dnd-kit only outside
- Test: drag text within editor vs drag entire card in SuperGrid
**Warning signs:**
- Can't drag text to reorder within editor
- Dragging text triggers SuperGrid cell drag
- Console errors about preventDefault on passive listeners

## Code Examples

Verified patterns from official sources:

### Basic TipTap Setup with Performance Optimizations
```typescript
// Source: https://tiptap.dev/docs/editor/getting-started/install/react
// Source: https://tiptap.dev/docs/guides/performance
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

export function TipTapEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Type / for commands...',
      }),
    ],
    content: '<p>Hello World!</p>',

    // CRITICAL: Performance optimizations
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,

    // Enable spellcheck (but be aware: may impact performance on large docs)
    editorProps: {
      attributes: {
        spellcheck: 'true',
      },
    },
  });

  return <EditorContent editor={editor} />;
}
```

### Using useEditorState for Toolbar Updates
```typescript
// Source: https://tiptap.dev/docs/guides/performance
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';

export function TipTapEditorWithToolbar() {
  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
  });

  // Only re-render when these specific values change
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      isBold: editor.isActive('bold'),
      isItalic: editor.isActive('italic'),
      isHeading: editor.isActive('heading'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  if (!editor) return null;

  return (
    <div>
      <div className="toolbar">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={state.isBold ? 'active' : ''}
        >
          Bold
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={state.isItalic ? 'active' : ''}
        >
          Italic
        </button>
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!state.canUndo}
        >
          Undo
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
```

### Slash Commands Implementation
```typescript
// Source: https://tiptap.dev/docs/editor/api/utilities/suggestion
// Source: https://tiptap.dev/docs/examples/experiments/slash-commands (reference only—not published)
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',

        items: ({ query }) => {
          return [
            {
              title: 'Save Card',
              description: 'Save current content as new card',
              command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).run();
                // Execute save logic
                handleSaveCard(editor.storage.markdown.getMarkdown());
              },
            },
            {
              title: 'Send to Shell',
              description: 'Send content to shell pane',
              command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).run();
                handleSendToShell(editor.state.doc.textContent);
              },
            },
            {
              title: 'PAFV Query',
              description: 'Insert PAFV projection template',
              command: ({ editor, range }) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent('```sql\n-- PAFV Query\nSELECT * FROM nodes\nWHERE plane = "?" AND axis = "?"\nORDER BY facet;\n```')
                  .run();
              },
            },
          ].filter(item =>
            item.title.toLowerCase().includes(query.toLowerCase())
          );
        },
      }),
    ];
  },
});
```

### Markdown Persistence
```typescript
// Source: https://tiptap.dev/docs/editor/markdown
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/extension-markdown';

export function useTipTapMarkdown() {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
    ],
    content: '', // Will be loaded from sql.js
  });

  // Load Markdown from sql.js
  const loadCard = (cardId: string) => {
    const result = db.exec(
      'SELECT markdown_content FROM notebook_cards WHERE node_id = ?',
      [cardId]
    );

    if (result[0]?.values[0]) {
      const markdown = result[0].values[0][0];
      editor?.commands.setContent(markdown);
    }
  };

  // Save Markdown to sql.js
  const saveCard = (cardId: string) => {
    if (!editor) return;

    const markdown = editor.storage.markdown.getMarkdown();

    db.run(
      `UPDATE notebook_cards
       SET markdown_content = ?, modified_at = ?
       WHERE node_id = ?`,
      [markdown, new Date().toISOString(), cardId]
    );
  };

  return { editor, loadCard, saveCard };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@uiw/react-md-editor` | TipTap 3.x with @tiptap/react | Feb 2026 | Structured editor with extensions vs simple textarea. Enables slash commands, custom nodes (D3 viz), bidirectional links. |
| Bundle ProseMirror in TipTap | @tiptap/pm peer dependency | TipTap v2.5 (2024) | Prevents version conflicts. Users must install @tiptap/pm explicitly. Better tree-shaking. |
| Re-render on every transaction | `shouldRerenderOnTransaction: false` | TipTap v3.0 (late 2025) | Massive performance improvement for React. V2 default was re-render, v3 changed to opt-in. Use useEditorState hook instead. |
| Manual slash command detection | @tiptap/suggestion utility | Always existed, but highlighted v3 | Official utility provides keyboard nav, positioning, filtering. Don't build from scratch. |
| Experimental slash commands extension | Build on @tiptap/suggestion | Never published | Official extension was never released. Community builds on suggestion utility directly. This is the correct pattern. |
| Draft.js for rich text | TipTap or Lexical | 2021 (Draft.js deprecated) | Facebook stopped maintaining Draft.js. TipTap became standard for ProseMirror users. |

**Deprecated/outdated:**
- **@uiw/react-md-editor:** Not deprecated, but limited. No extensibility for custom nodes, slash commands, or structured editing. Replace with TipTap for Capture pane.
- **TipTap v2 default re-render:** Performance issue. V3 changed defaults. Always use `shouldRerenderOnTransaction: false` in new code.
- **Direct ProseMirror imports:** Use `@tiptap/pm` to avoid version conflicts. Import from `@tiptap/pm/state` not `prosemirror-state`.
- **Third-party slash command packages:** Ecosystem fragmented. Build on @tiptap/suggestion directly for maximum control and minimal dependencies.

## Open Questions

1. **Markdown round-trip fidelity with @tiptap/extension-markdown**
   - What we know: Extension is early release (v3). Official docs warn of potential edge cases.
   - What's unclear: Which Markdown constructs fail to round-trip? Tables? Nested blockquotes? Definition lists?
   - Recommendation: During implementation, create test suite of Markdown examples (from existing cards in sql.js). Test: load → edit → save → load. Document failures. May need custom extensions for unsupported Markdown or fallback to storing both Markdown and HTML.

2. **Bidirectional link backlink query performance**
   - What we know: sql.js can query edges table for backlinks. `SELECT ... FROM edges WHERE target_id = ? AND edge_type = 'LINK'`
   - What's unclear: Performance with 10,000+ cards and thousands of links. Does FTS5 index help? Should we denormalize backlink counts?
   - Recommendation: Implement basic backlink query first. Profile with realistic data (1000 cards, 5000 links). If slow (>100ms), add index on `edges(target_id, edge_type)` or denormalize backlink count into nodes table.

3. **Autocomplete for wiki links: trigger on `[[` or after space?**
   - What we know: Mention-style autocomplete (like @username) typically triggers on char after space. Wiki links `[[page]]` might trigger immediately on `[[`.
   - What's unclear: UX expectation for Isometry users. Should `[[` immediately show all cards? Or wait for query like `[[pro` → shows "Project X"?
   - Recommendation: Implement trigger on `[[` with all cards shown (limited to 10 recent). Filter as user types. Test with users. May adjust to require 2+ chars for performance if card count grows large.

4. **Conflict between TipTap drag-and-drop and SuperGrid @dnd-kit**
   - What we know: TipTap has built-in drag handles for nodes. SuperGrid uses @dnd-kit for card drag-and-drop.
   - What's unclear: Will they conflict? Can we scope event handlers to prevent interference?
   - Recommendation: Disable TipTap drag handles in initial implementation (`draggable: false` in editor config). Focus on editing, not drag-to-reorder within editor. Add drag handles later if users request, with scoped event handling.

5. **Large document performance threshold: 10,000 characters or 10,000 nodes?**
   - What we know: Success criteria states "10,000+ character documents." TipTap performance depends on node count (paragraphs, headings) more than character count.
   - What's unclear: Is 10,000 characters typical for our users? How many ProseMirror nodes is that (500? 1000?)?
   - Recommendation: Test with realistic Isometry content. A 10,000 character document with 50 paragraphs performs differently than 1000 one-line bullet points. Profile both. Optimize for node count, not character count.

## Sources

### Primary (HIGH confidence)
- [TipTap React Installation](https://tiptap.dev/docs/editor/getting-started/install/react) — Official docs, updated Feb 6, 2026
- [TipTap Performance Guide](https://tiptap.dev/docs/guides/performance) — Official performance best practices
- [TipTap React Performance Demo](https://tiptap.dev/docs/examples/advanced/react-performance) — shouldRerenderOnTransaction example
- [TipTap Suggestion Utility](https://tiptap.dev/docs/editor/api/utilities/suggestion) — Official autocomplete/slash command foundation
- [TipTap Slash Commands Example](https://tiptap.dev/docs/examples/experiments/slash-commands) — Experimental (not published), reference implementation
- [TipTap Mention Extension](https://tiptap.dev/docs/editor/extensions/nodes/mention) — Official mention extension using suggestion
- [TipTap Markdown Extension](https://tiptap.dev/docs/editor/markdown) — Official Markdown support
- [TipTap Link Extension](https://tiptap.dev/docs/editor/extensions/marks/link) — Official link mark
- [TipTap StarterKit](https://tiptap.dev/docs/editor/extensions/functionality/starterkit) — Official extension bundle
- [@tiptap/pm npm](https://www.npmjs.com/package/@tiptap/pm) — ProseMirror wrapper package
- [ProseMirror Guide](https://prosemirror.net/docs/guide/) — Official ProseMirror documentation

### Secondary (MEDIUM confidence)
- [Liveblocks TipTap Best Practices](https://liveblocks.io/docs/guides/tiptap-best-practices-and-tips) — SSR issues, performance tips
- [Noteworthy GitHub](https://github.com/benrbray/noteworthy) — Reference implementation for bidirectional links with ProseMirror
- [TipTap v3.0 Release](https://tiptap.dev/tiptap-editor-v3) — New features, performance improvements
- [TipTap v2.5 Release Notes](https://tiptap.dev/blog/release-notes/say-hello-to-tiptap-2-5-our-most-performant-editor-yet) — shouldRerenderOnTransaction introduction
- [Medium: TipTap 3.0+ Changed How I Think](https://medium.com/@oshadigodage3/tiptap-3-0-changed-how-i-think-about-rich-text-editors-cf16aeefa1b6) — Performance improvements, React patterns

### Tertiary (LOW confidence)
- [@harshtalks/slash-tiptap](https://www.npmjs.com/package/@harshtalks/slash-tiptap) — Community package, not recommended (build on @tiptap/suggestion directly)
- [@bmin-mit/tiptap-slash-commands](https://www.npmjs.com/package/@bmin-mit/tiptap-slash-commands) — Community package, not recommended
- [TipTap GitHub Issue #4491](https://github.com/ueberdosis/tiptap/issues/4491) — Large document performance complaints (May 2023), addressed in v3
- [Hacker News: Anthropic Claude TipTap Performance](https://news.ycombinator.com/item?id=41036078) — Anecdotal performance improvements

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Official packages, well-documented, production-proven
- Architecture: HIGH — Official examples, reference implementations (Noteworthy), documented patterns
- Pitfalls: MEDIUM-HIGH — Combination of official docs and community experience. SSR pitfall marked for future but not tested in Isometry context.

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days — TipTap is stable, but v3 ecosystem still maturing. Recheck for extension updates.)

**Alignment with existing stack:**
- React 18.2.0: Compatible (TipTap requires React 18+) ✓
- sql.js: Compatible (Markdown storage in notebook_cards table) ✓
- TypeScript 5.2.2: Compatible (TipTap has excellent TypeScript support) ✓
- Tailwind CSS: Compatible (TipTap is headless, styles via Tailwind) ✓
- D3.js v7: Compatible (can render D3 in custom TipTap nodes via ReactNodeViewRenderer) ✓

**Migration path from @uiw/react-md-editor:**
1. Install TipTap packages (see "Standard Stack" section)
2. Keep existing `useMarkdownEditor` hook logic (auto-save, debouncing)
3. Adapt hook to use TipTap editor instance instead of MDEditor
4. Implement slash commands using @tiptap/suggestion
5. Implement wiki links as custom mark extension
6. Replace `<MDEditor>` component with `<EditorContent editor={editor} />`
7. Test round-trip: load Markdown from sql.js → edit → save → verify no data loss
8. Remove @uiw/react-md-editor dependency once migration complete

**Success criteria mapping:**
- ✓ "User edits content via TipTap editor with smooth performance on 10,000+ character documents" → shouldRerenderOnTransaction: false + performance patterns
- ✓ "User can invoke slash commands for card operations (/save-card, /send-to-shell, /insert-viz)" → @tiptap/suggestion with custom command registry
- ✓ "User can create bidirectional links with [[page]] syntax and see autocomplete suggestions" → Custom WikiLink mark extension + suggestion utility
- ✓ "User experiences no lag during typing with shouldRerenderOnTransaction optimization applied" → Documented in performance patterns section
