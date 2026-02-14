# Phase 95: Data Layer & Backlinks - Research

**Researched:** 2026-02-14
**Domain:** TipTap template system, SQLite graph queries, React sidebar UI patterns
**Confidence:** MEDIUM-HIGH

## Summary

Phase 95 implements two distinct features: (1) a template system allowing users to insert pre-defined markdown content via `/template` slash command, and (2) a backlinks panel showing reverse relationships (cards that link TO the current card). Both features build on existing TipTap editor infrastructure and sql.js database with minimal new dependencies.

**Template System:** Store templates as markdown strings in SQLite (new `templates` table), present via modal picker on `/template` command, insert selected template content into editor. TipTap's existing slash command infrastructure (already implemented in `src/components/notebook/editor/extensions/slash-commands.ts`) provides the foundation.

**Backlinks Panel:** Query existing `edges` table for reverse LINK relationships, display in RightSidebar accordion section using existing TabPanel/AccordionSection primitives. Basic query already exists (`queryBacklinks` in `src/utils/editor/backlinks.ts`), needs UI wiring only.

**Primary recommendation:** Implement templates via modal picker (not inline autocomplete) for better UX with preview capability. Store templates in dedicated SQLite table for query performance. Add backlinks as new tab in existing RightSidebar component for consistency with Formats/Settings pattern.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tiptap/react | ^3.19.0 | Editor framework | Already in use, slash command infrastructure exists |
| @tiptap/suggestion | ^3.19.0 | Autocomplete/command menus | Powers existing slash commands and wiki links |
| sql.js | ^1.13.0 | SQLite in WASM | Current database layer, supports FTS5 and recursive CTEs |
| shadcn/ui | N/A | UI components | TabPanel, AccordionSection already implemented |
| tippy.js | ^6.3.7 | Tooltip positioning | Already used for slash command menus |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DOMPurify | Bundled | HTML sanitization | Already in use for paste safety (94-02), templates may contain pasted HTML |
| React hooks | 18.2.0 | State management | useState for modal, useEffect for backlinks query |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Modal picker | Inline autocomplete | Modal allows preview + better multi-template browsing |
| Dedicated templates table | Store in nodes/notebook_cards | Dedicated table faster for queries, cleaner separation |
| RightSidebar tab | Separate backlinks panel | Reuses existing UI primitives, consistent with sidebar pattern |

**Installation:**
No new dependencies required. All features use existing stack.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/notebook/editor/
│   ├── extensions/
│   │   └── slash-commands.ts        # Add /template command here
│   ├── TemplatePickerModal.tsx      # NEW: Modal for template selection
│   └── TipTapEditor.tsx              # Wire modal open/close
├── components/
│   └── RightSidebar.tsx              # Add backlinks tab
├── utils/editor/
│   ├── backlinks.ts                  # queryBacklinks exists, add createTemplate
│   └── templates.ts                  # NEW: template CRUD operations
├── db/
│   └── schema.sql                    # Add templates table
```

### Pattern 1: Template Storage Schema
**What:** Dedicated `templates` table with FTS5 for searchability
**When to use:** Templates are queried frequently, benefit from search
**Example:**
```sql
-- Source: SQLite design patterns 2026
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,  -- 'meeting', 'project', 'note'
    content TEXT NOT NULL,  -- Markdown content
    variables TEXT,  -- JSON array of variable placeholders
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    usage_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON templates(usage_count DESC);

-- FTS5 for template search
CREATE VIRTUAL TABLE IF NOT EXISTS templates_fts USING fts5(
    name,
    description,
    content='templates',
    content_rowid='rowid'
);
```

### Pattern 2: Modal Template Picker
**What:** React modal with template list, preview, and insert action
**When to use:** Better UX than inline autocomplete when templates have meaningful previews
**Example:**
```typescript
// Source: TipTap slash commands + shadcn/ui modal patterns
interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: Template) => void;
  templates: Template[];
  theme: 'NeXTSTEP' | 'Modern';
}

function TemplatePickerModal({ isOpen, onClose, onSelect, templates, theme }: TemplatePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  const handleSelect = () => {
    const template = templates.find(t => t.id === selectedId);
    if (template) {
      onSelect(template);
      onClose();
    }
  };

  // Modal renders template list on left, preview on right
  // Similar pattern to shadcn/ui dialog + command palette
}
```

### Pattern 3: Backlinks Panel Integration
**What:** Add "Backlinks" tab to existing RightSidebar component using TabPanel primitive
**When to use:** Consistent with existing Formats/Settings tab pattern
**Example:**
```typescript
// Source: Existing RightSidebar.tsx pattern
function BacklinksContent({ activeCardId }: { activeCardId: string | undefined }) {
  const { db } = useSQLite();
  const [backlinks, setBacklinks] = useState<BacklinkInfo[]>([]);

  useEffect(() => {
    if (!activeCardId || !db) {
      setBacklinks([]);
      return;
    }

    // Use existing queryBacklinks from utils/editor/backlinks.ts
    const links = queryBacklinks(db, activeCardId);
    setBacklinks(links);
  }, [activeCardId, db]);

  if (!activeCardId) {
    return <p className="text-xs text-center text-gray-500">No card selected</p>;
  }

  if (backlinks.length === 0) {
    return <p className="text-xs text-center text-gray-500">No backlinks</p>;
  }

  return (
    <div className="space-y-2">
      {backlinks.map(link => (
        <button
          key={link.id}
          onClick={() => navigateToCard(link.id)}
          className="w-full text-left p-2 hover:bg-gray-100 rounded"
        >
          <div className="text-sm font-medium">{link.name}</div>
          <div className="text-xs text-gray-500">{formatDate(link.createdAt)}</div>
        </button>
      ))}
    </div>
  );
}

// Add to RightSidebar tabs array
const tabs: Tab[] = [
  // ... existing tabs
  {
    id: 'backlinks',
    label: 'Backlinks',
    icon: <Link className="w-4 h-4" />,
    content: <div className="p-2"><BacklinksContent activeCardId={activeCard?.nodeId} /></div>,
  },
];
```

### Pattern 4: Template Variable Substitution
**What:** Replace `{{variable}}` placeholders in template content with user values
**When to use:** Templates with dynamic content (date, name, project)
**Example:**
```typescript
// Source: Common template pattern across Notion, Obsidian
interface TemplateVariable {
  key: string;
  label: string;
  defaultValue: string;
}

function substituteVariables(
  content: string,
  variables: TemplateVariable[],
  values: Record<string, string>
): string {
  let result = content;

  // Replace {{date}} with current date
  result = result.replace(/\{\{date\}\}/g, new Date().toLocaleDateString());

  // Replace {{time}} with current time
  result = result.replace(/\{\{time\}\}/g, new Date().toLocaleTimeString());

  // Replace custom variables
  variables.forEach(variable => {
    const value = values[variable.key] ?? variable.defaultValue;
    const regex = new RegExp(`\\{\\{${variable.key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  });

  return result;
}
```

### Anti-Patterns to Avoid
- **Don't store templates in notebook_cards**: Pollutes card namespace, harder to query
- **Don't use file system for templates**: Defeats sql.js architecture, adds I/O complexity
- **Don't inline template picker in slash menu**: Poor UX for templates with previews
- **Don't query backlinks on every render**: Use useEffect with dependency array to avoid thrashing

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal component | Custom overlay logic | shadcn/ui Dialog or existing modal pattern | Accessibility (focus trap, ESC key, ARIA) already handled |
| Template search | Manual string filtering | SQLite FTS5 on templates_fts | Handles stemming, ranking, Unicode correctly |
| Date formatting | Custom date parser | Intl.DateTimeFormat or existing formatDate util | Locale-aware, handles timezones |
| Backlinks query | Manual JOIN logic | Existing queryBacklinks function | Already tested, handles edge cases |

**Key insight:** TipTap and SQLite handle the complex parts (editor state, query optimization). Phase 95 is primarily UI wiring and data modeling.

## Common Pitfalls

### Pitfall 1: Template Insertion Cursor Position
**What goes wrong:** Template inserts but cursor ends up at wrong position (start of template instead of end, or wrong variable placeholder)
**Why it happens:** TipTap's `insertContent` doesn't automatically move cursor to end of inserted content
**How to avoid:** Use `editor.chain().focus().insertContent(content).run()` and manually set cursor position
**Warning signs:** User has to manually click to continue typing after template insert
**Prevention:**
```typescript
// Insert template and move cursor to end
editor.chain()
  .focus()
  .deleteRange(range)  // Delete slash command trigger
  .insertContent(templateContent)
  .focus('end')  // Move cursor to end of inserted content
  .run();
```

### Pitfall 2: Backlinks Query Performance
**What goes wrong:** Backlinks panel becomes sluggish when card has hundreds of incoming links
**Why it happens:** Querying edges table on every card change without memoization or pagination
**How to avoid:** Debounce query, limit to 50 most recent, use indexed columns
**Warning signs:** UI lag when switching between cards in navigator
**Prevention:**
```sql
-- Use LIMIT and ORDER BY created_at DESC (indexed)
SELECT DISTINCT n.id, n.name, e.created_at
FROM nodes n
JOIN edges e ON e.source_id = n.id
WHERE e.target_id = ? AND e.edge_type = 'LINK' AND n.deleted_at IS NULL
ORDER BY e.created_at DESC
LIMIT 50  -- Prevent runaway queries
```

### Pitfall 3: Template Modal vs Editor Focus
**What goes wrong:** Modal opens but editor loses focus, keyboard shortcuts stop working
**Why it happens:** Modal steals focus and doesn't return it to editor on close
**How to avoid:** Save editor reference before modal opens, restore focus on close
**Warning signs:** User has to click in editor after closing modal to continue typing
**Prevention:**
```typescript
const editorRef = useRef<Editor | null>(null);

const handleTemplateSelect = (template: Template) => {
  const editor = editorRef.current;
  if (!editor) return;

  // Insert template
  editor.chain().focus().insertContent(template.content).run();

  // Modal close will trigger, focus returns to editor
  setModalOpen(false);

  // Ensure focus after React update cycle
  setTimeout(() => editor.commands.focus(), 0);
};
```

### Pitfall 4: Edge Case - Self-Referencing Backlinks
**What goes wrong:** Card appears in its own backlinks panel (card links to itself)
**Why it happens:** queryBacklinks doesn't filter out source_id === target_id
**How to avoid:** Add WHERE clause to exclude self-references
**Warning signs:** Clicking backlink navigates to same card (no-op that confuses user)
**Prevention:**
```sql
-- Exclude self-references in backlinks query
SELECT DISTINCT n.id, n.name, e.created_at
FROM nodes n
JOIN edges e ON e.source_id = n.id
WHERE e.target_id = ?
  AND e.source_id != ?  -- Exclude self-references
  AND e.edge_type = 'LINK'
  AND n.deleted_at IS NULL
ORDER BY e.created_at DESC
```

## Code Examples

Verified patterns from official sources and existing codebase:

### Template Slash Command Registration
```typescript
// Source: Existing slash-commands.ts pattern
{
  id: 'template',
  label: 'Insert Template',
  description: 'Choose from saved templates',
  category: 'template',
  shortcut: 'template',
  action: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run();

    // Open modal picker
    window.dispatchEvent(new CustomEvent('isometry:open-template-picker', {
      detail: { editor, insertPosition: editor.state.selection.from }
    }));
  },
}
```

### Template CRUD Operations
```typescript
// Source: Adapted from existing backlinks.ts pattern
export interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  content: string;
  variables?: TemplateVariable[];
  createdAt: string;
  modifiedAt: string;
  usageCount: number;
}

export function queryTemplates(
  db: Database | null,
  category?: string
): Template[] {
  if (!db) return [];

  try {
    const sql = category
      ? `SELECT * FROM templates WHERE category = ? ORDER BY usage_count DESC, name ASC`
      : `SELECT * FROM templates ORDER BY usage_count DESC, name ASC`;

    const params = category ? [category] : [];
    const results = db.exec(sql, params);

    if (!results[0]?.values) return [];

    return results[0].values.map(row => ({
      id: String(row[0]),
      name: String(row[1]),
      description: row[2] ? String(row[2]) : undefined,
      category: row[3] ? String(row[3]) : undefined,
      content: String(row[4]),
      variables: row[5] ? JSON.parse(String(row[5])) : undefined,
      createdAt: String(row[6]),
      modifiedAt: String(row[7]),
      usageCount: Number(row[8]),
    }));
  } catch (error) {
    console.error('Failed to query templates:', error);
    return [];
  }
}

export function createTemplate(
  db: Database | null,
  template: Omit<Template, 'id' | 'createdAt' | 'modifiedAt' | 'usageCount'>
): boolean {
  if (!db) return false;

  try {
    const id = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO templates (id, name, description, category, content, variables, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        template.name,
        template.description ?? null,
        template.category ?? null,
        template.content,
        template.variables ? JSON.stringify(template.variables) : null,
        now,
        now,
      ]
    );

    return true;
  } catch (error) {
    console.error('Failed to create template:', error);
    return false;
  }
}

export function incrementTemplateUsage(
  db: Database | null,
  templateId: string
): void {
  if (!db) return;

  try {
    db.run(
      `UPDATE templates
       SET usage_count = usage_count + 1,
           modified_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ?`,
      [templateId]
    );
  } catch (error) {
    console.error('Failed to increment template usage:', error);
  }
}
```

### Backlinks Panel Navigation
```typescript
// Source: Pattern from existing NotebookContext
import { useNotebook } from '../../contexts/NotebookContext';

function BacklinkItem({ backlink }: { backlink: BacklinkInfo }) {
  const { setActiveCard } = useNotebook();
  const { db } = useSQLite();

  const handleClick = () => {
    if (!db) return;

    // Query full card data
    const results = db.exec(
      `SELECT n.*, nc.markdown_content, nc.properties
       FROM nodes n
       LEFT JOIN notebook_cards nc ON nc.node_id = n.id
       WHERE n.id = ?`,
      [backlink.id]
    );

    if (results[0]?.values[0]) {
      const row = results[0].values[0];
      // Map to NotebookCard format
      const card = mapRowToNotebookCard(row);
      setActiveCard(card);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left p-2 hover:bg-gray-100 rounded transition-colors"
    >
      <div className="text-sm font-medium truncate">{backlink.name}</div>
      <div className="text-xs text-gray-500">
        {new Date(backlink.createdAt).toLocaleDateString()}
      </div>
    </button>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| File-based templates | Database templates | 2026 | Faster queries, FTS5 search, consistency with card storage |
| Inline autocomplete for all commands | Modal picker for rich content | TipTap v3 | Better UX for templates with preview/variables |
| Manual backlinks tracking | SQL JOIN on edges table | LPG design | Automatic, no separate tracking needed |
| Custom modal components | shadcn/ui primitives | Isometry v4 | Accessibility, theming, consistency |

**Deprecated/outdated:**
- File system template storage: sql.js architecture eliminates file I/O
- Separate backlinks table: `edges` table with LINK type handles this natively
- TipTap v2 slash commands: v3 has improved suggestion API with better TypeScript support

## Open Questions

1. **Template Variable Input UX**
   - What we know: Templates can have `{{variable}}` placeholders
   - What's unclear: Should user fill variables in modal before insert, or after insert in editor?
   - Recommendation: Start without variable input (use defaults like `{{date}}`), add modal input form in Phase 96 if needed

2. **Backlinks Panel Position**
   - What we know: RightSidebar has Formats/Settings tabs
   - What's unclear: Should backlinks be third tab, or new panel below editor?
   - Recommendation: Third tab for consistency, matches Obsidian's sidebar pattern

3. **Template Categories**
   - What we know: Category field exists in schema
   - What's unclear: Predefined categories vs user-defined?
   - Recommendation: Start with predefined ('meeting', 'project', 'note'), allow custom in Phase 96

4. **Performance Threshold for Backlinks**
   - What we know: LIMIT 50 prevents runaway queries
   - What's unclear: At what point should we add "Load more" pagination?
   - Recommendation: Start with 50, add pagination only if user feedback indicates need

## Sources

### Primary (HIGH confidence)
- Isometry codebase:
  - `src/components/notebook/editor/extensions/slash-commands.ts` - Existing slash command patterns
  - `src/utils/editor/backlinks.ts` - queryBacklinks function already exists
  - `src/components/RightSidebar.tsx` - TabPanel pattern for new tab
  - `src/db/schema.sql` - Database structure and FTS5 usage
  - `package.json` - TipTap v3.19.0, sql.js v1.13.0 confirmed
- STATE.md decisions:
  - CAPTURE-03: Templates in database, not files
  - CAPTURE-04: One-way property sync (editor → panel)
  - MD-01: @tiptap/markdown for serialization
  - SEC-01: DOMPurify for paste sanitization

### Secondary (MEDIUM confidence)
- [Slash Commands Extension | Tiptap Docs](https://tiptap.dev/docs/examples/experiments/slash-commands) - Official slash command patterns
- [Slash Dropdown Menu | Tiptap UI Components](https://tiptap.dev/docs/ui-components/components/slash-dropdown-menu) - UI component patterns
- [React node views | Tiptap Docs](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react) - Custom node integration
- [Mastering Recursive Queries and Graph Traversal in SQL](https://softwarepatternslexicon.com/patterns-sql/12/1/) - SQL recursive CTE patterns
- [SQLite for Modern Apps: A Practical First Look (2026)](https://thelinuxcode.com/sqlite-for-modern-apps-a-practical-first-look-2026/) - Modern SQLite patterns (batched transactions, prepared statements)
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar) - Sidebar state management patterns

### Tertiary (LOW confidence - needs verification)
- [Obsidian backlink-cache plugin](https://github.com/mnaoumov/obsidian-backlink-cache) - Reference implementation (different stack)
- TipTap roadmap 2026 mentions document-as-data model - aligns with sql.js storage approach

## Metadata

**Confidence breakdown:**
- Template storage schema: HIGH - Follows existing SQLite patterns in codebase, FTS5 already in use
- Slash command integration: HIGH - Pattern exists in slash-commands.ts, well-documented
- Backlinks query: HIGH - Function already exists in backlinks.ts, just needs UI wiring
- Modal UX patterns: MEDIUM - shadcn/ui patterns documented but not yet used in this codebase
- Variable substitution: MEDIUM - Common pattern but details need user testing
- Performance thresholds: LOW - Need real-world usage data to tune LIMIT values

**Research date:** 2026-02-14
**Valid until:** 30 days (stable domain - TipTap v3, SQLite patterns well-established)
