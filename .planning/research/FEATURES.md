# Feature Research

**Domain:** Three-Canvas Notebook for Knowledge Management with Visualization
**Researched:** 2026-02-10
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

#### Capture Pane: Block-Based Editor

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Slash command menu | Notion/Obsidian standard, fast content creation | LOW | TipTap has extension ecosystem, type `/` triggers block menu |
| Block types (heading, paragraph, list, code, quote) | Core markdown equivalents | LOW | TipTap provides 100+ extensions including all standard blocks |
| Keyboard shortcuts (Cmd+B, Cmd+K, etc.) | Expected in all modern editors | LOW | Standard markdown shortcuts, customizable via TipTap |
| Live markdown preview | Users expect WYSIWYG, not raw markdown | MEDIUM | TipTap is headless, needs custom renderer integration |
| Autosave with conflict detection | Users expect "lossless by default" (2026 standard) | MEDIUM | Debounced save to IndexedDB, merge conflicts if concurrent edits |
| Properties panel (LATCH metadata) | Notion Properties, Obsidian frontmatter standard | MEDIUM | Must integrate with existing LATCH filtering system |
| Bidirectional links `[[page]]` | Core knowledge management feature (Roam, Obsidian) | MEDIUM | Autocomplete on `[[`, creates edges in LPG on save |
| Block references/transclusion `![[page#block]]` | Expected for reusing content | HIGH | Requires block-level IDs, live sync when source changes |

#### Shell Pane: Terminal Integration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| ANSI color support | Standard terminal output | LOW | xterm.js provides GPU-accelerated renderer with ANSI support |
| Command history (up/down arrows) | Basic terminal UX | LOW | xterm.js includes built-in readline support |
| Copy/paste from terminal | Users expect clipboard integration | LOW | xterm.js addon provides clipboard support |
| Multi-tab support | Modern developer expectation (Warp, iTerm2) | MEDIUM | React tabs component, multiple xterm.js instances |
| Process output streaming | Real-time feedback for long commands | LOW | xterm.js designed for live streaming |
| Command completion | Expected in modern terminals (2026) | HIGH | Requires shell integration, context-aware suggestions |

#### Preview Pane: Visualization Integration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Live update on data change | Users expect reactivity | LOW | Already built: D3.js data joins with sql.js triggers |
| Multiple visualization tabs | Context switching between views | LOW | React tabs, existing D3 renderers (Grid, Network, Kanban) |
| Synchronized selection | Click in preview → highlight in capture | MEDIUM | Shared selection state via React Context |
| Zoom/pan persistence | Users expect view state to persist | LOW | Store viewport state in IndexedDB per card |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Notebook cards in PAFV grid | Unique: notes ARE data, visualize note relationships spatially | MEDIUM | notebook_cards already in schema, just need PAFV projection mapping |
| D3 visualization blocks in editor | Embed live charts in notes (not static images) | HIGH | Requires custom TipTap extension, D3 renderer in contentEditable, query context |
| Shell output → card capture | `@save-card` annotation to capture command output as nodes | MEDIUM | Parse terminal output, detect annotation, create node with properties |
| Claude Code integration with project context | Shell can read `.planning/` context, execute GSD workflows | HIGH | MCP server integration, file watching, structured output parsing |
| Bidirectional note-visualization sync | Select nodes in viz → scroll to matching blocks in capture | HIGH | Requires block-level LPG mapping, scroll position tracking |
| GSD GUI wrapper | Turn Claude Code terminal output into rich UI (progress bars, tables) | HIGH | Parse Claude Code output format, render structured UI components |
| Formula bar with PAFV functions | Excel-like formulas aware of LATCH dimensions (SUMOVER) | HIGH | Already planned for SuperCalc, integrate with notebook properties |
| Version history per block | Track changes to individual blocks, not whole notes | HIGH | Requires block-level versioning in SQLite, conflict UI |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time collaborative editing | "Like Google Docs" | CRDT complexity, conflicts with local-first, scope explosion | CloudKit sync with conflict resolution UI (manual merge) |
| WYSIWYG table editor | "Like Notion databases" | Reinvents SuperGrid, doesn't leverage existing PAFV system | Use properties panel + SuperGrid preview (notes ARE database) |
| AI autocomplete in editor | "Like Copilot" | Breaks flow, hallucinations in notes dangerous, latency | Explicit `/ai` slash command, deliberate invocation only |
| Infinite canvas for notes | "Like Muse/Miro" | Conflicts with LATCH filtering, hard to navigate at scale | Use PAFV grid in preview pane, spatial via Location axis |
| Full-featured terminal emulator | "Like iTerm2" | Scope explosion, reinvents wheel, native terminals better | xterm.js basics + shell integration, delegate complex features |
| Plugins/extensions marketplace | "Like VS Code" | Maintenance burden, security risk, version conflicts | Curated features only, no third-party plugins (v1) |

## Feature Dependencies

```
Block-Based Editor
    └──requires──> Autosave with Conflict Detection
    └──requires──> Properties Panel (LATCH metadata)

Bidirectional Links [[page]]
    └──requires──> Block-Based Editor
    └──requires──> LPG Edge Creation (already exists)
    └──enhances──> Notebook Cards in PAFV Grid

Block References ![[page#block]]
    └──requires──> Bidirectional Links
    └──requires──> Block-level IDs
    └──requires──> Live Sync on Source Change

Shell Integration
    └──requires──> xterm.js Terminal Emulator
    └──requires──> Multi-tab Support

Claude Code Integration
    └──requires──> Shell Integration
    └──requires──> Project Context (`.planning/` watching)
    └──enhances──> GSD GUI Wrapper

GSD GUI Wrapper
    └──requires──> Claude Code Integration
    └──requires──> Output Parser
    └──enhances──> Shell Pane

D3 Visualization Blocks
    └──requires──> Block-Based Editor
    └──requires──> Custom TipTap Extension
    └──requires──> D3 Renderer in contentEditable
    └──conflicts──> Simple Autosave (needs special serialization)

Notebook Cards in PAFV Grid
    └──requires──> Properties Panel (LATCH metadata)
    └──requires──> SuperGrid (already exists)
    └──enhances──> Bidirectional Note-Visualization Sync

Bidirectional Note-Visualization Sync
    └──requires──> Notebook Cards in PAFV Grid
    └──requires──> Block-level LPG Mapping
    └──requires──> Synchronized Selection
```

### Dependency Notes

- **Block-Based Editor requires Autosave:** Without autosave, users lose work. "Lossless by default" is 2026 table stakes.
- **Bidirectional Links require LPG Edges:** Links create graph relationships, stored as edges with type `LINK`.
- **Block References require Live Sync:** If source block changes, all transclusions must update or show conflict.
- **Claude Code requires Shell Integration:** Terminal is the interface to Claude Code API.
- **D3 Visualization Blocks conflict with Simple Autosave:** Embedded D3 needs special serialization (store query + config, not DOM).
- **Notebook Cards in PAFV Grid enhances Bidirectional Sync:** Selecting a card in grid can scroll to matching block in capture.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the capture-shell-preview workflow.

- [x] **Three-pane layout** — Existing: React layout with resizable panes
- [x] **SuperGrid in Preview** — Existing: Full PAFV projection system
- [ ] **Block-based editor in Capture** — Essential: TipTap with slash commands, standard blocks (heading, paragraph, list, code)
- [ ] **Properties panel (LATCH metadata)** — Essential: Integrates notes with existing filtering system
- [ ] **Autosave to IndexedDB** — Essential: Debounced save every 2-5 seconds, conflict detection on load
- [ ] **Bidirectional links `[[page]]`** — Essential: Creates edges in LPG, autocomplete on `[[`
- [ ] **xterm.js terminal in Shell** — Essential: Basic ANSI support, copy/paste, command history
- [ ] **Notebook cards in PAFV grid** — Essential: The differentiator, validates the whole concept
- [ ] **Synchronized selection** — Essential: Click card in grid → highlight in capture

### Add After Validation (v1.x)

Features to add once core workflow is validated.

- [ ] **Multi-tab shell** — Trigger: Users run multiple concurrent commands
- [ ] **Block references `![[page#block]]`** — Trigger: Users request content reuse across notes
- [ ] **Command palette (Cmd+K)** — Trigger: Users request faster navigation
- [ ] **Claude Code integration** — Trigger: Shell usage patterns show need for AI assistance
- [ ] **Shell output → card capture** — Trigger: Users manually copy terminal output to notes
- [ ] **Live markdown preview improvements** — Trigger: Users request richer formatting (tables, images)

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **D3 visualization blocks in editor** — Why defer: High complexity, unclear if users want inline viz vs preview pane
- [ ] **GSD GUI wrapper** — Why defer: Depends on Claude Code integration patterns, premature optimization
- [ ] **Formula bar with PAFV functions** — Why defer: Already planned for SuperCalc Phase 45, defer until grid maturity
- [ ] **Version history per block** — Why defer: Complex conflict UI, unclear user demand for block-level (vs note-level) history
- [ ] **Bidirectional note-visualization sync** — Why defer: Requires block-level LPG mapping infrastructure, nice-to-have enhancement

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Block-based editor (TipTap) | HIGH | LOW | P1 |
| Properties panel (LATCH) | HIGH | MEDIUM | P1 |
| Autosave to IndexedDB | HIGH | MEDIUM | P1 |
| Bidirectional links `[[page]]` | HIGH | MEDIUM | P1 |
| xterm.js terminal | HIGH | LOW | P1 |
| Notebook cards in PAFV grid | HIGH | MEDIUM | P1 |
| Synchronized selection | MEDIUM | MEDIUM | P1 |
| Multi-tab shell | MEDIUM | LOW | P2 |
| Block references `![[page#block]]` | MEDIUM | HIGH | P2 |
| Command palette | MEDIUM | LOW | P2 |
| Claude Code integration | HIGH | HIGH | P2 |
| Shell output → card capture | MEDIUM | MEDIUM | P2 |
| D3 visualization blocks | LOW | HIGH | P3 |
| GSD GUI wrapper | MEDIUM | HIGH | P3 |
| Formula bar (PAFV functions) | LOW | HIGH | P3 |
| Version history per block | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (validates core workflow)
- P2: Should have, add when possible (enhances workflow)
- P3: Nice to have, future consideration (advanced features)

## Competitor Feature Analysis

| Feature | Notion | Obsidian | Our Approach |
|---------|--------|----------|--------------|
| Block-based editing | Slash commands, rich blocks, inline databases | Markdown-first, properties panel | TipTap with slash commands, properties panel integrated with LATCH |
| Bidirectional links | Page links only, no block refs | `[[page]]` and `[[page#heading]]` support | `[[page]]` creates LPG edges, full graph traversal via GRAPH queries |
| Terminal integration | None | Community plugins (limited) | First-class shell pane with xterm.js, Claude Code integration |
| Visualization | Static embeds, rigid database views | Community plugins (Dataview, Charts) | Live D3.js in preview pane, notes participate in PAFV projections |
| Properties/metadata | Inline properties, database schema per table | YAML frontmatter, properties panel (1.4+) | Properties panel maps to LATCH axes, powers filtering/sorting |
| Autosave | Automatic, no manual save | Configurable interval, vault-level | Debounced IndexedDB save, conflict detection on concurrent edits |
| Multi-pane layout | Flexible panes, tabs | Split panes, hover preview | Fixed three-canvas (Capture-Shell-Preview), optimized for workflow |
| Database integration | Notion databases (rigid schema) | Obsidian Bases (query-based views) | Notebook cards ARE database rows, SuperGrid is the database view |

### Key Differentiators vs Competitors

**vs Notion:**
- Notion lacks graph visualization and terminal integration
- Notion databases are rigid (pre-defined schema), ours are dynamic (LATCH properties)
- Notion is cloud-first, ours is local-first with SQLite

**vs Obsidian:**
- Obsidian lacks first-class shell integration and AI tooling
- Obsidian plugins are fragmented, we integrate terminal + viz natively
- Obsidian canvas is free-form, ours is structured via PAFV projections

**vs JupyterLab:**
- Jupyter is code-first (notebooks are code + output), ours is notes-first (notes can contain code)
- Jupyter lacks knowledge graph features (bidirectional links, LATCH filtering)
- Jupyter terminal is basic, ours integrates Claude Code for agentic workflows

## Sources

### Block-Based Editors
- [Notion slash commands guide](https://www.notion.com/help/guides/using-slash-commands)
- [Notion blocks explained](https://lilys.ai/en/notes/notion-for-beginners-20251022/notion-blocks-explained-beginners-guide)
- [TipTap documentation](https://tiptap.dev/docs/editor/getting-started/overview)
- [Shadcn TipTap editors for modern web apps](https://shadcnstudio.com/blog/shadcn-tiptap-editors)

### Properties & Metadata
- [Obsidian Properties documentation](https://help.obsidian.md/Editing+and+formatting/Properties)
- [Obsidian Properties brings Notion-like metadata](https://medium.com/obsidian-observer/obsidians-new-properties-feature-brings-a-notion-like-experience-to-metadata-1436e57de373)
- [Obsidian Bases vs Notion databases](https://www.xda-developers.com/notion-databases-great-but-obsidian-bases-better/)

### Terminal Integration
- [xterm.js GitHub repository](https://github.com/xtermjs/xterm.js)
- [JupyterLab terminal integration](https://www.programming-helper.com/tech/jupyter-2026-interactive-notebooks-data-science-python)
- [Warp terminal notebooks and AI integration](https://medium.com/devops-ai-decoded/15-advanced-terminal-tricks-to-boost-developer-productivity-in-2026-e42eb2037925)

### Claude Code Integration
- [Claude Code API documentation](https://platform.claude.com/docs/en/home)
- [How Claude Code is transforming AI coding in 2026](https://apidog.com/blog/claude-code-coding/)
- [Claude Code with Anthropic API compatibility](https://ollama.com/blog/claude)

### Workflow Patterns
- [NotebookLM 2026 update: knowledge database](https://www.lbsocial.net/post/notebooklm-2026-update-knowledge-database)
- [Mastering NotebookLM workflows](https://dennismfrancis.medium.com/mastering-notebooklm-workflows-from-chatting-to-architecting-systems-7c675695b539)
- [Developer tool requirements for 2026](https://evilmartians.com/chronicles/six-things-developer-tools-must-have-to-earn-trust-and-adoption)

### Autosave Patterns
- [Behind the feature: autosave at Figma](https://www.figma.com/blog/behind-the-feature-autosave/)
- [Autosave patterns in modern web applications](https://medium.com/@brooklyndippo/to-save-or-to-autosave-autosaving-patterns-in-modern-web-applications-39c26061aa6b)

### Bidirectional Links & Transclusion
- [Obsidian block references](https://help.obsidian.md/How+to/Link+to+blocks)
- [Roam vs Obsidian block references](https://www.zsolt.blog/2021/05/Addicted-to-block-references.html)
- [Connecting and transcluding notes in Obsidian](https://thesweetsetup.com/connecting-and-transcluding-notes-in-obsidian/)

### Command Palette UX
- [Command palette UX patterns](https://medium.com/design-bootcamp/command-palette-ux-patterns-1-d6b6e68f30c1)
- [VS Code command palette guidelines](https://code.visualstudio.com/api/ux-guidelines/command-palette)
- [Command palette design variants](https://mobbin.com/glossary/command-palette)

---
*Feature research for: Three-Canvas Notebook (Capture-Shell-Preview)*
*Researched: 2026-02-10*
*Confidence: HIGH (verified with official documentation and 2026 current practices)*
