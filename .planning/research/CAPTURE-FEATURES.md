# Capture Writing Surface: Feature Catalog

**Domain:** Rich text editor for polymorphic data capture
**Researched:** 2026-02-13
**Overall confidence:** HIGH

## Executive Summary

Apple Notes, Notion, and Obsidian represent three distinct approaches to note-taking: Apple Notes focuses on simplicity with powerful search and native integration; Notion emphasizes structured data with databases and AI automation; Obsidian prioritizes knowledge management through bidirectional linking and extensibility.

For Isometry Capture, the **table stakes** are keyboard-driven formatting, slash commands, and reliable auto-save. The **unique differentiator** is embedding live SuperGrids and PAFV views directly in notes—transforming static tables into interactive data projections.

**Key insight:** All three apps invest heavily in keyboard shortcuts (30-50+ shortcuts each), slash commands (20+ in Notion), and zero-friction capture flows. Obsidian's plugin ecosystem (2700+ plugins) shows the power of extensibility. Notion's database autofill and synced blocks demonstrate the value of reusable, connected content.

**Critical gap to address:** None of these apps offer orthogonal density controls or polymorphic view transitions within embedded content. That's Isometry's unique position.

## Apple Notes: Complete Keyboard Shortcuts

**Source:** [Apple Support - Keyboard shortcuts and gestures in Notes on Mac](https://support.apple.com/guide/notes/keyboard-shortcuts-and-gestures-apd46c25187e/mac)

**Confidence:** HIGH (official Apple documentation)

### General Actions (13 shortcuts)
| Shortcut | Action | Complexity | Notes |
|----------|--------|------------|-------|
| Cmd+N | Create new note | Low | Table stakes |
| Fn-Q | Create Quick Note | Low | System-wide capture |
| Cmd+D | Duplicate note | Low | Common pattern |
| Shift+Cmd+N | Create new folder | Low | Organization |
| Cmd+0 | Show main window | Low | Navigation |
| Cmd+1 | List view | Low | View switching |
| Cmd+2 | Gallery view | Low | View switching |
| Cmd+3 | Show attachments | Low | Media management |
| Option+Cmd+F | Search all notes | Low | Global search |
| Cmd+P | Print note | Low | Export |
| Return | Begin editing selected note | Low | Quick access |
| Control+Cmd+I | Toggle highlights (shared notes) | Medium | Collaboration |
| Control+Cmd+K | Toggle activity list (shared notes) | Medium | Collaboration |

### Text Formatting (11 shortcuts)
| Shortcut | Action | Complexity | Notes |
|----------|--------|------------|-------|
| Shift+Cmd+T | Title format | Low | Semantic styling |
| Shift+Cmd+H | Heading format | Low | Semantic styling |
| Shift+Cmd+J | Subheading format | Low | Semantic styling |
| Shift+Cmd+B | Body format | Low | Semantic styling |
| Shift+Cmd+M | Monospaced text | Low | Code inline |
| Cmd+' | Block quote | Low | Common pattern |
| Cmd+Plus | Increase font | Low | Accessibility |
| Cmd+Minus | Decrease font | Low | Accessibility |
| Shift+Cmd+. | Zoom in | Low | Accessibility |
| Shift+Cmd+, | Zoom out | Low | Accessibility |
| Shift+Cmd+0 | Reset zoom | Low | Accessibility |

### Lists & Checklists (10 shortcuts)
| Shortcut | Action | Complexity | Notes |
|----------|--------|------------|-------|
| Shift+Cmd+7 | Bulleted list | Low | Table stakes |
| Shift+Cmd+8 | Dashed list | Low | Visual variant |
| Shift+Cmd+9 | Numbered list | Low | Table stakes |
| Shift+Cmd+L | Checklist | Low | **Critical for tasks** |
| Cmd+] or Tab | Increase indent | Low | Hierarchical structure |
| Cmd+[ or Shift+Tab | Decrease indent | Low | Hierarchical structure |
| Shift+Return | Soft return in list | Low | Formatting control |
| Option+Tab | Tab in list item | Low | Advanced formatting |
| Shift+Cmd+U | Mark/unmark checklist | Low | Quick toggle |
| Control+Cmd+Up/Down | Move item up/down | Medium | Reordering |

### Editing Actions (3 shortcuts)
| Shortcut | Action | Complexity | Notes |
|----------|--------|------------|-------|
| Shift+Cmd+A | Attach file | Medium | Media insertion |
| Cmd+K | Create webpage link | Low | **Table stakes** |
| Option+Cmd+T | Insert table | Medium | **Critical feature** |

### Table Navigation (16 shortcuts)
| Shortcut | Action | Complexity | Notes |
|----------|--------|------------|-------|
| Return | Move down / add row | Low | Natural flow |
| Shift+Return | Move up | Low | Reverse navigation |
| Option+Return | New paragraph in cell | Low | Multi-line cells |
| Option+Cmd+Up | Add row above | Medium | Insertion control |
| Option+Cmd+Down | Add row below | Medium | Insertion control |
| Option+Cmd+Right | Add column right | Medium | Insertion control |
| Option+Cmd+Left | Add column left | Medium | Insertion control |
| Tab | Next cell | Low | Table stakes |
| Shift+Tab | Previous cell | Low | Table stakes |
| Option+Tab | Tab in cell | Low | Content formatting |
| Shift+Left/Right | Select cell range (horizontal) | Medium | Range selection |
| Shift+Up/Down | Select cell range (vertical) | Medium | Range selection |
| Cmd+A | Select cell content | Low | Standard behavior |
| Cmd+A, Cmd+A | Select entire table | Medium | Full selection |

**Total Apple Notes shortcuts:** 53

**Key patterns:**
- Heavy use of Shift+Cmd for formatting
- Option modifiers for advanced/insertion actions
- Consistent list/table navigation with Tab/Return
- Semantic text styles (Title/Heading/Body) not just bold/italic

## Notion: Slash Commands Catalog

**Sources:**
- [Notion Help - Using slash commands](https://www.notion.com/help/guides/using-slash-commands)
- [Notion Help - Types of content blocks](https://www.notion.com/help/guides/types-of-content-blocks)

**Confidence:** HIGH (official Notion documentation)

### Basic Content Blocks (10 commands)
| Command | Inserts | Complexity | Notes |
|---------|---------|------------|-------|
| /text | Text block | Low | Default |
| /page | New sub-page | Low | Hierarchical structure |
| /todo | To-do checkbox | Low | **Table stakes** |
| /h1, /h2, /h3 | Headings (3 levels) | Low | Semantic structure |
| /bullet | Bulleted list | Low | Table stakes |
| /number | Numbered list | Low | Table stakes |
| /toggle | Toggle/collapsible list | Medium | Progressive disclosure |
| /quote | Quote block | Low | Common pattern |
| /divider | Horizontal divider | Low | Visual separation |
| /callout | Highlighted callout box | Low | Emphasis |

### Database Blocks (5 commands)
| Command | Inserts | Complexity | Notes |
|---------|---------|------------|-------|
| /table-inline | Inline table database | High | **Isometry differentiator** |
| /board | Kanban board database | High | View type |
| /calendar | Calendar database | High | Time-based view |
| /gallery | Gallery database | Medium | Visual cards |
| /list | List database | Medium | Simple view |

### Media Blocks (6 commands)
| Command | Inserts | Complexity | Notes |
|---------|---------|------------|-------|
| /image | Image upload/embed | Low | Table stakes |
| /video | Video embed | Low | Rich media |
| /audio | Audio file | Low | Rich media |
| /file | File upload | Low | Attachments |
| /pdf | PDF embed | Medium | Document preview |
| /bookmark | Web bookmark with preview | Medium | Link enrichment |

### Advanced Blocks (8 commands)
| Command | Inserts | Complexity | Notes |
|---------|---------|------------|-------|
| /code | Code block | Low | Developer essential |
| /math | LaTeX equation | Medium | Technical writing |
| /template | Template button | High | **Automation** |
| /button | Automation button | High | **Workflow trigger** |
| /breadcrumb | Navigation breadcrumb | Low | Wayfinding |
| /toc | Table of contents | Medium | Long-form docs |
| /synced | Synced block | High | **Content reuse** |
| /comment | Add comment | Low | Collaboration |

### Content Modification Commands
| Command | Action | Complexity | Notes |
|---------|--------|------------|-------|
| /red, /blue, /etc | Text/background color | Low | Visual emphasis |
| /turnbullet, /turnheading | Convert block type | Medium | Format switching |
| /duplicate | Duplicate block | Low | Quick copy |
| /web | Create web bookmark | Medium | Link handling |

**Total Notion slash commands:** 30+ (exact count varies by account type)

**Key patterns:**
- Database blocks are first-class (5 different views)
- Automation built-in (template buttons, synced blocks)
- Color as a slash command (fast visual coding)
- Block conversion with /turn* commands
- Embedding 500+ external services

## Notion: Database Features

**Sources:**
- [Notion Help - Relations & rollups](https://www.notion.com/help/relations-and-rollups)
- [Notion Help - Views, filters, sorts & groups](https://www.notion.com/help/views-filters-and-sorts)
- [Notion Help - Synced blocks](https://www.notion.com/help/synced-blocks)

**Confidence:** HIGH (official documentation)

### Core Database Capabilities
| Feature | What It Does | Complexity | Isometry Equivalent |
|---------|-------------|------------|---------------------|
| **Relations** | Link two databases (bi-directional) | High | WikiLinks + Edges (GRAPH) |
| **Rollups** | Aggregate data from related database | High | SuperCalc SUMOVER() |
| **Formulas 2.0** | Computed properties with property references | High | SuperCalc formula bar |
| **Views** | Same data, different layouts (table/board/calendar/gallery/list) | High | **PAFV axis allocation** |
| **Filters** | AND/OR logic, nested 3 levels deep | Medium | LATCH filter compilation |
| **Sorting** | Multi-level sorting by properties | Low | SQL ORDER BY |
| **Grouping** | Group rows by property values | Medium | SuperStack facet headers |
| **Synced databases** | Same database, different filter/sort on each instance | High | **Similar to linked PAFV views** |
| **Linked databases** | Reference same data source, customizable views | High | **Core Isometry pattern** |

### AI Autofill (Notion AI)
**Source:** [Notion Help - AI Autofill](https://www.notion.com/help/autofill)

**Confidence:** MEDIUM (feature requires Notion AI subscription)

| Feature | What It Does | Complexity | Notes |
|---------|-------------|------------|-------|
| AI Summary | Auto-generate summaries of page content | High | LLM integration |
| AI Translation | Auto-translate text to other languages | High | LLM integration |
| AI Keywords | Extract keywords/tags from content | High | Auto-tagging |
| Custom AI prompts | User-defined AI transformations | High | Flexible automation |
| Auto-update on edit | Re-run AI 5 min after page changes | High | Live computation |
| Generate select options | AI creates new dropdown options | Medium | Dynamic schema |

**Key insight:** Notion AI autofill turns databases into reactive computation engines. For Isometry, this could mean auto-extracting LATCH facets from card content or suggesting GRAPH connections.

## Obsidian: Power Features

**Sources:**
- [The Must-Have Obsidian Plugins for 2026](https://www.dsebastien.net/the-must-have-obsidian-plugins-for-2026/)
- [Obsidian Help - Graph view](https://help.obsidian.md/plugins/graph)
- [Obsidian Help - Canvas](https://help.obsidian.md/plugins/canvas)

**Confidence:** HIGH (official docs + comprehensive community guide)

### Core Features (Built-in)
| Feature | What It Does | Complexity | Isometry Equivalent |
|---------|-------------|------------|-------|
| **Bidirectional links** | [[wiki-style]] linking with automatic backlinks | Low | WikiLinks (already built) |
| **Graph view** | Visual network of note connections | Medium | Network view (PAFV z=graph) |
| **Tags** | #hashtag organization | Low | Category facets |
| **Daily notes** | Auto-create dated notes | Low | Time facet anchoring |
| **Canvas** | Infinite whiteboard for visual thinking | High | **Future PAFV canvas mode** |
| **Block references** | Link to specific paragraphs via ^block-id | Medium | Granular WikiLinks |
| **Embeds** | Embed notes within notes via ![[link]] | Medium | Transclusion |
| **Templates** | Reusable note structures | Low | Template slash command |
| **Search** | Full-text with regex support | Medium | FTS5 (already built) |
| **Markdown** | Pure plaintext files, future-proof | Low | Storage format option |

### Essential Plugins (Community, 2700+ available)
| Plugin | What It Does | Complexity | Isometry Relevance |
|--------|-------------|------------|-------------------|
| **Dataview** | Query notes like a database with DQL | High | **Similar to LATCH filters** |
| **Templater** | Advanced templating with JS functions | High | Dynamic slash commands |
| **QuickAdd** | Capture workflows, macros, templates | Medium | Fast capture UX |
| **Tasks** | Advanced task management with queries | Medium | Checklist enhancement |
| **Calendar** | Visual calendar for daily notes | Low | Time facet visualization |
| **Periodic Notes** | Daily/weekly/monthly/quarterly/yearly notes | Medium | Time hierarchy |
| **Excalidraw** | Hand-drawn diagrams in notes | Medium | Visual thinking |
| **Kanban** | Kanban boards in markdown | Medium | PAFV kanban view |
| **Style Settings** | Customize CSS via UI | Low | Theme system |
| **Hotkey Helper** | Manage keyboard shortcuts | Low | Discoverability |

### Obsidian Canvas Features
**Source:** [Obsidian Canvas](https://obsidian.md/canvas)

**Confidence:** HIGH (official feature)

| Feature | What It Does | Complexity | Notes |
|---------|-------------|------------|-------|
| Infinite canvas | Unlimited 2D space | Low | Spatial thinking |
| Embed notes | Reference existing notes as cards | Low | Content reuse |
| Embed files | PDFs, images, videos | Low | Rich media |
| Embed websites | iframes for external content | Low | Context gathering |
| Text cards | Markdown content on canvas | Low | Ad-hoc notes |
| Connections | Visual links between cards | Low | Relationship mapping |
| Colors & groups | Visual organization | Low | Categorization |
| Zoom & pan | Navigate large canvases | Low | Cartographic UX |

**Key insight:** Canvas is Obsidian's answer to spatial note-taking (similar to Miro/FigJam but integrated with notes). For Isometry, this aligns with PAFV z-axis depth and 2D projection modes.

### Obsidian Markdown Extensions
**Source:** [Obsidian Help - Formatting](https://help.obsidian.md/editing-and-formatting/basic-formatting-syntax)

**Confidence:** HIGH (official docs)

| Syntax | Renders As | Complexity | Notes |
|--------|-----------|------------|-------|
| `[[note]]` | Internal link | Low | **Already in Isometry** |
| `![[note]]` | Embed note | Low | Transclusion |
| `![[note^block]]` | Embed specific block | Medium | Granular embedding |
| `[[note#heading]]` | Link to heading | Low | Fragment navigation |
| `%%comment%%` | Hidden comment | Low | Annotations |
| `==highlight==` | Highlighted text | Low | Emphasis |
| `~~strikethrough~~` | Strikethrough | Low | Standard markdown |
| `- [ ]` | Unchecked task | Low | **Already in Isometry** |
| `- [x]` | Checked task | Low | **Already in Isometry** |
| ``` | Code block with syntax highlighting | Low | Developer essential |
| `$$math$$` | LaTeX block | Medium | Technical writing |
| `$inline$` | Inline LaTeX | Medium | Technical writing |

## Apple Notes: Unique Features

**Sources:**
- [Apple Notes 2026 Features](https://www.geeky-gadgets.com/apple-notes-2026-guide/)
- [Apple Support - Smart Folders](https://support.apple.com/guide/iphone/use-smart-folders-iphc43adabc2/ios)
- [Apple Support - Lock notes](https://support.apple.com/en-us/102537)

**Confidence:** HIGH (official Apple documentation)

### Smart Folders
| Feature | What It Does | Complexity | Isometry Equivalent |
|---------|-------------|------------|-------|
| **Tag-based filters** | Auto-populate folders based on tag queries | Medium | LATCH Category filters |
| **Combined criteria** | AND/OR logic for tags | Medium | Filter groups |
| **Cross-folder search** | Search across all folders by tag | Low | Global FTS5 |
| **Auto-organization** | Notes appear in multiple smart folders | Low | Virtual views |

**Limitation:** Smart folders cannot be locked, cannot contain PDFs/attachments as criteria, and are limited to tag-based queries (no date ranges, content matching, etc.).

### Collaboration Features
| Feature | What It Does | Complexity | Notes |
|---------|-------------|------------|-------|
| **Shared notes** | Real-time collaboration via iCloud | Medium | Requires iCloud account |
| **Activity view** | See who edited what and when | Low | Audit trail |
| **Highlights** | Toggle to show recent changes | Low | Change tracking |
| **Permissions** | View-only or edit access | Low | Access control |

**Limitation:** Shared notes cannot be password-locked. Sharing requires all participants to use iCloud.

### Capture & Input Methods
| Feature | What It Does | Complexity | Notes |
|---------|-------------|------------|-------|
| **Quick Note** | System-wide capture (Fn+Q) | Low | **Critical for friction-free capture** |
| **Siri dictation** | Voice-to-text note creation | Low | Hands-free |
| **Handwriting (iPad)** | Apple Pencil input with OCR search | Medium | Sketching + writing |
| **Scan documents** | Camera-based PDF scanning | Medium | Paper → digital |
| **OCR on images** | Search text in photos/scans | High | Searchable everything |

**Key insight:** Apple Notes' "capture anywhere" philosophy (Quick Note, Siri, scanning, handwriting) removes all friction. For Isometry, this means slash commands should work instantly, auto-save aggressively, and capture context automatically.

### Security Features
| Feature | What It Does | Complexity | Limitations |
|---------|-------------|------------|-------------|
| **Password lock** | Encrypt individual notes | Medium | Cannot lock notes with tags, PDFs, media, or shared notes |
| **Face ID / Touch ID** | Biometric unlock | Low | Device-specific |
| **Per-note encryption** | Each locked note has separate password option | Medium | No bulk locking |

## Feature Classification for Isometry Capture

### Table Stakes (Must Have, 21 features)
These are expected by users. Missing them makes Capture feel incomplete.

| Feature | Why Expected | Complexity | Source |
|---------|--------------|------------|--------|
| **Auto-save** | Zero data loss anxiety | Low | All 3 apps |
| **Manual save shortcut** | Explicit control | Low | Cmd+S convention |
| **Undo/redo** | Error recovery | Low | Universal |
| **Bold/italic/underline** | Basic formatting | Low | All 3 apps |
| **Headings (H1/H2/H3)** | Document structure | Low | All 3 apps |
| **Bulleted lists** | Unordered content | Low | All 3 apps |
| **Numbered lists** | Ordered content | Low | All 3 apps |
| **Checklists** | Task management | Low | All 3 apps |
| **Links** | Hypertext navigation | Low | All 3 apps |
| **Code blocks** | Developer audience | Low | All 3 apps |
| **Block quotes** | Citations | Low | All 3 apps |
| **Tables** | Structured data | Medium | All 3 apps |
| **Search** | Content discovery | Medium | All 3 apps (FTS5 ✅) |
| **Tags/categories** | Organization | Low | All 3 apps |
| **Internal links** | Note connections | Low | Notion + Obsidian (WikiLinks ✅) |
| **Attachments** | Media embedding | Medium | All 3 apps |
| **Templates** | Reusable structures | Medium | All 3 apps |
| **Keyboard shortcuts** | Power user efficiency | Medium | All 3 apps |
| **Slash commands** | Fast insertion | Low | Notion (✅ have 10) |
| **Indentation control** | Hierarchical structure | Low | All 3 apps |
| **Copy/paste formatting** | Rich text portability | Medium | All 3 apps |

**Status:** Isometry has **14 / 21** table stakes (67%). Missing: undo/redo UI, attachments, copy/paste formatting, templates beyond slash commands, expanded keyboard shortcuts, full slash command parity.

### Differentiators (Unique to Isometry, 8 features)
Features that set Isometry apart from competitors.

| Feature | Value Proposition | Complexity | Why Unique |
|---------|-------------------|------------|------------|
| **Live SuperGrid embeds** | Interactive data, not static tables | High | No competitor has orthogonal density + PAFV |
| **PAFV view transitions** | Same data, polymorphic views (grid/kanban/network/timeline) | High | Notion has database views, but not PAFV spatial projection |
| **LATCH-aware slash commands** | /meeting, /pafv, /latch auto-structure cards | Medium | Domain-specific intelligence |
| **Graph edge creation** | Create GRAPH edges (Link/Nest/Sequence/Affinity) via UI | Medium | Obsidian has links, but not typed edges as first-class |
| **Formula bar (SuperCalc)** | PAFV-aware formulas (SUMOVER) | High | Notion has formulas, but not spatial-aware |
| **Density controls in embeds** | Janus model: zoom + pan independently | Medium | Unique to SuperGrid |
| **sql.js query blocks** | Embed live SQL results | High | Direct database access in notes |
| **Property editor for cards** | Structured metadata on any note | Medium | Notion has properties, but not LATCH/GRAPH typed |

**Key insight:** Isometry's differentiators all stem from **polymorphic data projection**. Static apps (Apple Notes) can't do this. Database apps (Notion) have views but not PAFV spatial semantics. Graph apps (Obsidian) have links but not typed edges or density controls.

### Nice-to-Have (Enhance UX, 12 features)
Features that improve experience but aren't critical for MVP.

| Feature | Value | Complexity | Priority |
|---------|-------|------------|----------|
| **Synced blocks** | Content reuse (Notion pattern) | High | Phase 3 |
| **Template buttons** | One-click automation | Medium | Phase 3 |
| **AI autofill** | LLM-generated properties | High | Phase 4+ |
| **Canvas mode** | Infinite whiteboard (Obsidian) | High | Phase 4+ |
| **Daily notes** | Time-anchored capture | Low | Phase 2 |
| **Smart folders** | Auto-filtered views (Apple Notes) | Medium | Phase 3 |
| **Collaboration** | Real-time multi-user | Very High | Phase 5+ |
| **Version history** | Time travel for notes | Medium | Phase 3 |
| **Comments** | Inline annotations | Medium | Phase 3 |
| **Handwriting input** | iPad/touch support | High | Phase 4+ (if iOS) |
| **OCR scanning** | Camera → text | High | Phase 4+ (if iOS) |
| **Custom themes** | CSS customization (Obsidian) | Low | Phase 2 |

### Anti-Features (Explicitly Avoid)
Features to NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Notion's block-everything architecture** | Overhead for simple text | Use TipTap with semantic nodes, blocks only for embeds |
| **Obsidian's file-per-note** | Doesn't fit sql.js LPG model | Notes are rows in `nodes` table, not files |
| **Apple Notes' iCloud lock-in** | Vendor dependency | Local-first with optional sync |
| **Notion's heavy embeds (500+ services)** | Maintenance burden | Support key embeds (SuperGrid, images, code, links) only |
| **Notion AI subscription paywall** | Complexity + cost | Bring-your-own LLM (MCP integration) |
| **Obsidian's plugin marketplace** | Support burden | Curated feature set, not plugin API |
| **Notion's page-based hierarchy** | Rigidity | Flat namespace with GRAPH edges for structure |
| **Apple Notes' password-per-note** | Friction | Database-level encryption or none |

## Feature Dependencies

```
WikiLinks ─→ Card suggestions (✅ have both)
     │
     └─→ Backlinks panel (❌ need)

Search ─→ FTS5 (✅ have)
    │
    └─→ Search-in-note highlighting (❌ need)

Tables ─→ Basic table editing (❌ need)
    │
    └─→ SuperGrid embed (✅ SuperGrid Phase 1 in progress)

Slash commands ─→ Quick insertion (✅ have 10 commands)
            │
            └─→ Custom command registry (❌ need for extensibility)

Auto-save ─→ Debounced persistence (✅ have)
       │
       └─→ Conflict resolution (❌ need for collaboration)

Properties ─→ PropertyEditor (✅ have)
        │
        └─→ Property templates (❌ need)
        └─→ Computed properties (❌ need, similar to Notion formulas)

LATCH filters ─→ SQL compilation (✅ have in filters/)
           │
           └─→ Filter UI in Capture (❌ need)

PAFV views ─→ SuperGrid (🔄 Phase 1 in progress)
        │
        └─→ View picker in embeds (❌ need)
        └─→ Transition animations (❌ need)
```

## MVP Recommendation

### Phase 1: Editor Parity (2 weeks)
Prioritize reaching table stakes parity with competitors.

**Build:**
1. **Undo/redo stack** (✅ TipTap has this, expose UI)
2. **Attachment handling** (images, PDFs via drag-drop)
3. **Basic table editing** (insert, navigate, add rows/columns)
4. **More slash commands** (bring to 20+)
   - /heading1, /heading2, /heading3
   - /image, /file, /pdf
   - /divider, /quote, /code
   - /embed-supergrid, /embed-view
5. **Keyboard shortcut expansion** (30+ shortcuts)
   - Formatting: Cmd+B (bold), Cmd+I (italic), Cmd+U (underline)
   - Lists: Shift+Cmd+7/8/9 (bullet/dash/number)
   - Structure: Shift+Cmd+H (heading), Cmd+K (link)
   - Tables: Tab (next cell), Shift+Tab (prev cell), Return (new row)
6. **Template system** (reusable note structures)
7. **Copy/paste with formatting**

**Defer:**
- AI features
- Collaboration
- Canvas mode
- Advanced automation

### Phase 2: Unique Integrations (2 weeks)
Build the differentiators that make Isometry unique.

**Build:**
1. **Live SuperGrid embeds** (via /embed-supergrid slash command)
   - Insert SuperGrid at cursor
   - Inline density controls
   - Click to expand full view
2. **PAFV view picker** (same data, different projections)
   - Embedded grid → kanban → network → timeline
   - Smooth transitions
3. **LATCH-aware capture** (enhance existing commands)
   - /meeting → auto-add time + category facets
   - /tasks → auto-create checklist with priority
4. **Property templates** (common card structures)
   - Project, Person, Meeting, Task templates
5. **Backlinks panel** (show incoming WikiLinks)

### Phase 3: Polish & Power (1 week)
Fill gaps for power users.

**Build:**
1. **Search highlighting** (show matches in note)
2. **Version history** (undo across sessions)
3. **Comments** (inline annotations)
4. **Smart folders** (LATCH filter shortcuts)
5. **Custom themes** (CSS customization)
6. **Daily notes** (quick time-anchored capture)

**Total MVP timeline:** 5 weeks

## Complexity Analysis

### Low Complexity (Implement in Phase 1)
- Slash commands (pattern already established)
- Keyboard shortcuts (TipTap supports custom keymaps)
- Basic table editing (TipTap has table extension)
- Attachments (file upload + blob storage)
- Copy/paste formatting (TipTap handles)
- Templates (JSON structures)

### Medium Complexity (Implement in Phase 2)
- SuperGrid embeds (integration, not new feature)
- PAFV view picker (UI for existing views)
- Backlinks panel (inverse WikiLink query)
- Property templates (JSON schemas)
- Search highlighting (mark.js or similar)

### High Complexity (Phase 3 or later)
- Collaboration (CRDT or OT)
- AI autofill (LLM integration)
- Canvas mode (new rendering engine)
- Version history (diff storage)
- Synced blocks (content references)

## Sources

**Apple Notes:**
- [Keyboard shortcuts and gestures in Notes on Mac - Apple Support](https://support.apple.com/guide/notes/keyboard-shortcuts-and-gestures-apd46c25187e/mac)
- [Apple Notes 2026 Features for Faster Note Taking & Planning](https://www.geeky-gadgets.com/apple-notes-2026-guide/)
- [Use Smart Folders in Notes on Mac - Apple Support](https://support.apple.com/guide/notes/use-smart-folders-apd58edc7964/mac)
- [Lock your notes on Mac - Apple Support](https://support.apple.com/guide/notes/lock-your-notes-not28c5f5468/mac)
- [Use Tags and Smart Folders in Notes - Apple Support](https://support.apple.com/en-us/102288)

**Notion:**
- [Using slash commands - Notion Help Center](https://www.notion.com/help/guides/using-slash-commands)
- [Types of content blocks - Notion Help Center](https://www.notion.com/help/guides/types-of-content-blocks)
- [Relations & rollups - Notion Help Center](https://www.notion.com/help/relations-and-rollups)
- [Views, filters, sorts & groups - Notion Help Center](https://www.notion.com/help/views-filters-and-sorts)
- [Synced blocks - Notion Help Center](https://www.notion.com/help/synced-blocks)
- [Notion AI for databases - Notion Help Center](https://www.notion.com/help/autofill)
- [Formulas 2.0: How to use Notion's new and improved formulas](https://www.notion.com/help/guides/new-formulas-whats-changed)

**Obsidian:**
- [The Must-Have Obsidian Plugins for 2026](https://www.dsebastien.net/the-must-have-obsidian-plugins-for-2026/)
- [Graph view - Obsidian Help](https://help.obsidian.md/plugins/graph)
- [Canvas - Obsidian Help](https://help.obsidian.md/plugins/canvas)
- [CSS snippets - Obsidian Help](https://help.obsidian.md/snippets)
- [Daily notes - Obsidian Help](https://help.obsidian.md/plugins/daily-notes)
- [Periodic Notes plugin](https://www.obsidianstats.com/plugins/periodic-notes)
- [Dataview plugin discussion](https://github.com/blacksmithgu/obsidian-dataview/issues/63)
