# Feature Landscape: Notebook Card Editor

**Domain:** Card editor with typed properties, multi-density card rendering, and inline creation for a local-first data projection app
**Researched:** 2026-03-18
**Confidence:** HIGH — based on direct codebase inspection (NotebookExplorer.ts, cards.ts, CardRenderer.ts, MutationManager.ts, SelectionProvider.ts), existing UI patterns across 90 phases, and established industry patterns from Notion/Linear/Coda

**Existing infrastructure this milestone builds on:**
- `NotebookExplorer`: Write/Preview tabs, DOMPurify+marked pipeline, formatting toolbar (Cmd+B/I/K), per-card persistence via `ui_state` (`notebook:{cardId}` key), 500ms debounced auto-save, SelectionProvider subscription-driven card binding
- `MutationManager`: sole write gate with undo/redo history (100 steps), rAF-batched notifications, `setToast()` feedback wiring
- `SelectionProvider`: ephemeral (Tier 3), `select()` / `toggle()` / `range()`, microtask-batched notifications
- `Card` schema: 26 columns — `id`, `card_type` (note/task/event/resource/person), `name`, `content`, `summary`, `folder`, `tags`, `status`, `priority`, `url`, `latitude`, `longitude`, `location_name`, `due_at`, `completed_at`, `event_start`, `event_end`, `source`, `source_id`, `source_url`, `mime_type`, `is_collective`, `sort_order`, `created_at`, `modified_at`, `deleted_at`
- `updateCard()`: dynamic partial update, `card_type` immutable by contract, FTS re-index trigger fires automatically
- `CardRenderer.ts`: `renderSvgCard()` / `renderHtmlCard()` shared renderers, `CARD_DIMENSIONS` (width:280, height:48, gridWidth:180, gridHeight:120)
- `CARD_TYPE_ICONS`: single-char badges N/T/E/R/P
- Existing design token system: `--text-xs` through `--text-xl`, `--space-xs` through `--space-xl`, `--bg-card`, `--accent`, `--cell-hover`
- Worker bridge for all SQL off main thread, `ui:set` / `ui:get` for ui_state persistence

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Dependencies on Existing | Notes |
|---------|--------------|------------|--------------------------|-------|
| **Title inline edit** — click title in card to edit name in place | Every card editor (Notion, Things, Linear) allows direct title editing. A read-only title is a dead end. | LOW | `updateCard()`, `MutationManager.execute()`, `SelectionProvider.getSelectedIds()` | Single `<input type="text">` replacing a `<h1>` display element. Focus-blur commits. Undo via MutationManager. Blur without change = no mutation. |
| **Card type selector** — dropdown or segmented control for note/contact/event/resource | Users expect to classify cards. Existing 5-type taxonomy is already in the schema. | LOW | `CardType` union (`note\|task\|event\|resource\|person`). NOTE: `card_type` is immutable in `updateCard()` — need a dedicated type-change path or create-new card. | Figma maps: note→note, contact→person, event→event, resource→resource. "task" not in Figma spec — decide whether to expose or hide. See Anti-Features. |
| **Content markdown editor** — Write/Preview tabs with textarea | Already built in NotebookExplorer. Reusing it directly is the path. | TRIVIAL | `NotebookExplorer` mounts/destroys in Workbench panel — extract or embed its textarea+preview markup into the CardEditor panel | The NotebookExplorer's full lifecycle (mount/destroy, debounced save, card-switch flush) already solves this correctly. |
| **Properties panel** — typed key-value pairs (text, date, url, number, email, phone) | Notion, Coda, and Craft all show structured properties below the title. Users expect this for contact/event cards. | MEDIUM | `updateCard()` for mapped fields (`url`, `due_at`, `event_start`, `event_end`, `location_name`, `status`, `priority`). Custom/extra properties need a storage decision (see Notes). | 6 Figma property types map to HTML input types: text→`<input type="text">`, date→`<input type="date">` or datetime-local, url→`<input type="url">`, number→`<input type="number">`, email→`<input type="email">`, phone→`<input type="tel">`. Browser-native input types give keyboard affordances for free on mobile/macOS. |
| **Add / remove properties** — plus button to add, × to remove | Standard UI for extensible property sets in Notion/Coda. Users expect customization. | MEDIUM | If mapped to existing `Card` columns: trivial. If custom (arbitrary key-value): need `ui_state` storage as `card_props:{cardId}` JSON blob, or extend schema. | Decision gate: constrain to the 26 existing columns, or allow freeform custom properties? Constraining to existing columns is LOW complexity and zero schema change. Freeform requires a storage decision — see Anti-Features. |
| **Save feedback** — visible indicator that edits are persisted | Without feedback, users re-type or close and reopen to verify. 500ms debounce is invisible. | LOW | Existing `ActionToast` / `MutationManager.setToast()` pattern | A subtle "Saved" flash (existing ActionToast) on flush is sufficient. No spinner needed — sql.js is synchronous. |
| **Card delete** — delete the current card from the editor | Users expect to destroy what they're looking at. Without this, creation+edit is a dead-end with no cleanup. | LOW | `MutationManager.execute()` wrapping `deleteCard()`, undo returns the card | Soft delete (existing pattern). MutationManager undo restores via `undeleteCard()`. Confirmation dialog optional for single card; skip for speed. |
| **Keyboard dismiss** — Escape to close editor, commit pending edits | Universal UX expectation. | LOW | `ShortcutRegistry` or local `keydown` listener on the editor root | Escape should blur active field and close the editor panel. Flush debounced save synchronously on close (same pattern as NotebookExplorer's `destroy()`). |

---

### Multi-Density Card Rendering (the 4-size system)

The Figma spec defines four density levels. These render the same card data at different fidelities in list/grid views.

| Density Level | Dimensions | Content | Complexity | Notes |
|---------------|-----------|---------|------------|-------|
| **1x** — compact row | ~30px height | Name only, type badge, truncated | LOW | Matches existing `CARD_DIMENSIONS.height: 48`. Minor resize. SVG `renderSvgCard()` already does this. |
| **2x** — icon + preview | ~60px height | Type icon (large), name, 1-line content preview | LOW | Extend `renderSvgCard()` or new `renderSvgCard2x()`. Pull `content.slice(0,80)` as subtitle. |
| **5x** — card tile | ~200×300px | Header (name+type), content preview (markdown stripped), properties strip (status, folder, tags) | MEDIUM | New tile renderer. Strip markdown for plain-text preview (50–100 chars). Show 2–3 property values. CSS Grid or absolute layout inside a `<div>` for HTML views. |
| **10x** — hero / full-page | Fills panel | Full CardEditor: title, type selector, full markdown content, all properties | HIGH | This IS the CardEditor component. Not a "card size" — it's the editor itself opened in a full panel zone. |

**Note:** The existing `SuperDensityProvider` controls density levels 1–4 for the SuperGrid. These card dimension levels are separate — they apply in list/gallery/kanban views. Avoid conflating the two systems.

---

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Start-typing card creation** — focused empty title field creates card on first keystroke | Notion, Things, Linear all use this: an always-visible "New card…" input at the top of a list that creates on first keystroke. Eliminates the "click plus button, then type" two-step. | MEDIUM | `MutationManager.execute()` wrapping `createCard()`. Must wire new card into `SelectionProvider.select()` immediately so NotebookExplorer binds to it. | Trigger: any printable character typed when the ghost input is focused. First character becomes the `name` seed; continue typing extends name. Enter commits. Escape discards (delete the new card if undo is unavailable within the same "session"). |
| **Card type-contextual property presets** — properties panel auto-populates relevant fields per card type | Contacts auto-show email/phone. Events auto-show start/end dates. Resources auto-show URL. Notes have no presets. Reduces decision fatigue. | LOW | `CardType` union already has 5 values. Map each to a preset list of property keys from the existing 26 columns. | Example: contact preset = [email via `url`+convention, phone via `location_name`+convention, or a dedicated mapping]. Event preset = [`event_start`, `event_end`, `location_name`]. Resource preset = [`url`, `mime_type`]. |
| **Undo-safe title editing** — title edit lands in MutationManager history, not just DOM state | Notion does NOT have granular title undo. Linear does. Isometry can differentiate by making every title edit undoable via Cmd+Z in the global stack, not just browser's local input history. | LOW | `MutationManager.execute()` with debounce-on-blur (commit on blur, not on each keystroke). Single undo step per "edit session". | Pattern: blur on title input = `execute({ forward: updateCard, inverse: updateCard(old name) })`. Keystroke-level undo stays in native input history; blur-level undo in MutationManager. |
| **Tag chip editor** — comma-separated tags editable as inline chips with add/remove | Tags are a first-class field (`tags: string[]` JSON array). Exposing them as visual chips in the editor surfaces searchability without requiring the user to know JSON syntax. | MEDIUM | `updateCard({ tags })` through MutationManager. D3 chip join pattern already in `LatchExplorers.ts` (category chips with GROUP BY). | Chip entry: type tag name + Enter or comma to add. Click × on chip to remove. On blur: flush to `updateCard`. |
| **Content-first creation flow** — 5x card tile shows content preview so users can triage without opening editor | Triage-first UX. Users scanning a list of notes want to see first 50–100 chars without opening each card. Reduces round-trips. | LOW | `content` field already in `Card`. Strip markdown on display (remove `#`, `*`, `_`, etc.). | Plain-text extraction can be a pure function: `stripMarkdown(content).slice(0, 100)`. No Worker query needed — data already in D3 datum. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **card_type mutation after creation** | Users want to reclassify cards (note becomes event) | `updateCard()` explicitly forbids `card_type` changes by design (architectural decision, not accident). Allowing it breaks FTS index assumptions and source provenance tracking. Reclassifying also silently drops type-specific properties (e.g., event dates on a note have no meaning). | "Duplicate as new type" — create a new card with the new type, copy name/content, let user migrate properties manually. Keeps audit trail clean. |
| **Freeform custom property schema** (arbitrary key-value columns not in the 26-column schema) | Notion-style custom fields are expected by power users | Requires either schema migration (ALTER TABLE — sql.js supports this but migrations must be versioned), or a JSON blob column approach (breaks filtering, FTS, and SuperGrid axis assignment). Either path is a data model change requiring v-migration with StateManager._migrateState(). | Map the 6 Figma property types to the 26 existing columns first. Only add schema extension if a real gap is found. `ui_state` can carry `card_props:{id}` JSON as a stopgap for non-filterable extras. |
| **Real-time multiplayer card editing** | "Would be great to co-edit" | CloudKit sync is last-writer-wins with server-wins conflict resolution (v4.1 design decision D-locked). Real-time editing adds CRDTs or OT, which are multi-month complexity. The existing sync architecture explicitly does not support this. | CloudKit sync already covers multi-device. Frame it as "sync across your devices" not "collaborate with others." |
| **Nested / hierarchical cards in the editor** | Notion blocks, Roam outliner | Requires a recursive data model. The current schema has `connections` (graph edges) and `is_collective` (grouping flag) but no parent/child column. Implementing nesting in the editor without schema changes means shimming it into `folder` or connections — both are wrong tools. | Use the existing `connections` graph to represent relationships. `is_collective` marks aggregate cards. These are projection-layer concepts, not editor concepts. |
| **Rich text beyond Markdown** (tables, embeds, mention links) | Notion/Craft-style block editor | Full rich-text editor (Tiptap, ProseMirror, Lexical) brings 200–400KB of dependency, a new mental model, and breaks the existing `marked` + DOMPurify pipeline. The existing Markdown editor already handles bold/italic/links/code/lists/headings/blockquote/tables via GFM. | Markdown covers 95% of note-taking needs. GFM tables work in the existing pipeline. The ````chart` extension already shows that the pipeline is extensible without a new editor runtime. |
| **Auto-save on every keystroke for title** | "I don't want to lose my title" | Keystroke-level `updateCard()` calls through MutationManager would flood the undo history (100-step limit fills in seconds of typing). It would also generate a Worker SQL update per keystroke at ~10 WPM = 1 Worker message per 600ms, which is within budget but wasteful. | Debounce on blur (commit when user leaves the title field). Native input `Ctrl+Z` handles within-field undo; MutationManager handles cross-field undo. Same pattern as NotebookExplorer's 500ms debounced save. |
| **Drag-and-drop card reordering inside editor** | Notion block drag | `sort_order` column exists but no view currently exposes manual reorder. Building DnD inside the editor conflates card content editing with list ordering — different concerns. | Manual sort_order editing is a list-view feature. The editor focuses on content. Sort belongs to the view layer (SuperGrid already has sort). |

---

## Feature Dependencies

```
[Title inline edit]
    └──requires──> [MutationManager.execute()]
                       └──requires──> [updateCard()]
                       └──requires──> [SelectionProvider binding (card loaded in editor)]

[Start-typing card creation]
    └──requires──> [createCard() via MutationManager]
    └──requires──> [SelectionProvider.select(newCardId)]
                       └──triggers──> [NotebookExplorer onSelectionChange → loads content]

[Properties panel - typed fields]
    └──requires──> [updateCard() for each mapped field]
    └──requires──> [card type preset mapping (CardType → default property list)]
    └──enhances──> [Card type selector (preset list depends on type)]

[Card type-contextual property presets]
    └──requires──> [Card type selector (current type drives which presets appear)]
    └──enhances──> [Properties panel - typed fields]

[Multi-density card rendering (1x/2x/5x)]
    └──requires──> [Card data in D3 datum (already present)]
    └──enhances──> [SuperDensityProvider (separate system — do NOT couple)]

[10x hero card / CardEditor panel]
    └──requires──> [Title inline edit]
    └──requires──> [Content markdown editor (NotebookExplorer reuse)]
    └──requires──> [Properties panel - typed fields]
    └──requires──> [Card type selector]

[Tag chip editor]
    └──requires──> [updateCard({ tags }) via MutationManager]
    └──conflicts──> [Auto-save on every keystroke (see Anti-Features)]
```

### Dependency Notes

- **Title inline edit requires SelectionProvider binding:** The editor panel must know which card is active. The existing NotebookExplorer already subscribes to SelectionProvider; the CardEditor component should use the same subscription pattern.
- **Start-typing creation requires immediate SelectionProvider.select():** After `createCard()` returns the new Card object, call `selection.select(newCard.id)` synchronously. This makes NotebookExplorer bind to the new card automatically.
- **card_type is immutable:** `updateCard()` explicitly excludes `card_type` from allowed updates. The card type selector is display-only for existing cards. For a "change type" flow, the implementation must call `createCard()` with the new type and `deleteCard()` the old one — this is a copy+delete, not an update.
- **Multi-density rendering does not depend on SuperDensityProvider:** The 4 card sizes (1x/2x/5x/10x) are presentation sizes for list/gallery views. The existing SuperDensityProvider controls SuperGrid density (1–4 density levels). Keep these namespaces separate to avoid coupling.
- **Properties panel conflicts with freeform custom properties:** If the property system is constrained to the existing 26 schema columns, complexity stays LOW. The moment "add property" means a new schema column, complexity jumps to HIGH and a migration path is required.

---

## MVP Definition

### Launch With (v1 — this milestone)

- [x] **Title inline edit** — foundational. Without this, the editor is read-only.
- [x] **Card type display + preset property list** — show type, show relevant fields for that type. No mutation of card_type.
- [x] **Content markdown editor** — reuse NotebookExplorer's existing textarea+preview. Zero new code for the core editor.
- [x] **Properties panel (mapped to existing columns)** — expose `url`, `due_at`, `event_start`, `event_end`, `location_name`, `status`, `priority`, `folder`, `tags` via typed inputs. No new schema.
- [x] **Add/remove properties** — constrained to the existing 26 columns. A "visible properties" list persisted to `ui_state` as `card_editor_props:{cardId}` or globally as `card_editor_visible_props:{cardType}`.
- [x] **Card delete from editor** — soft delete via MutationManager. Undo restores.
- [x] **1x and 2x card dimensions** — compact row and icon+preview sizes for list/gallery views.
- [x] **Save feedback** — ActionToast "Saved" flash on flush. Trivial.

### Add After Validation (v1.x)

- [ ] **Start-typing card creation** — once core editor works, the creation flow can be wired. Requires testing the new-card → select → bind sequence end-to-end.
- [ ] **5x card tile** — medium-density card with content preview. Can ship after core editor is stable.
- [ ] **Tag chip editor** — chips are polish. Plain comma-separated text input for tags works for MVP.
- [ ] **Card type-contextual presets** — initial property list can be hardcoded per type. Presets are UX polish.

### Future Consideration (v2+)

- [ ] **10x hero / full-page editor** — full-panel editing mode requires layout changes in WorkbenchShell (panel zone allocation). Defer until WorkbenchShell zone system is understood.
- [ ] **Undo-safe title editing at MutationManager granularity** — differentiator but adds complexity to the commit model. Defer until title edit is stable with native input undo.
- [ ] **Content-first creation flow with search-before-create** — prevents duplicates. Requires FTS5 query on-the-fly as user types, which is a Worker round-trip per keystroke. Significant complexity.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Title inline edit | HIGH | LOW | P1 |
| Content markdown editor (reuse NotebookExplorer) | HIGH | LOW (reuse) | P1 |
| Properties panel (existing columns) | HIGH | MEDIUM | P1 |
| Card type display | MEDIUM | LOW | P1 |
| Card delete | HIGH | LOW | P1 |
| 1x card dimension | MEDIUM | LOW | P1 |
| 2x card dimension | MEDIUM | LOW | P1 |
| Save feedback | MEDIUM | LOW | P1 |
| Add/remove properties | MEDIUM | MEDIUM | P2 |
| Start-typing card creation | HIGH | MEDIUM | P2 |
| 5x card tile | MEDIUM | MEDIUM | P2 |
| Tag chip editor | MEDIUM | MEDIUM | P2 |
| Card type-contextual presets | MEDIUM | LOW | P2 |
| 10x hero editor panel | HIGH | HIGH | P3 |
| Undo-safe title at MutationManager granularity | LOW | LOW | P3 |
| Freeform custom properties (schema extension) | HIGH | HIGH | DEFER |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration
- DEFER: Out of scope for this milestone

---

## Competitor Feature Analysis

| Feature | Notion | Things 3 | Linear | Isometry approach |
|---------|--------|----------|--------|------------------|
| Title inline edit | Click anywhere on title | Tap title in list | Click title in issue | Click title in CardEditor panel; blur-commits via MutationManager |
| Start-typing creation | `/` command or click `+` in list | Type in "New to-do" placeholder at bottom | `C` hotkey opens modal | Ghost input at top of list view; first keystroke creates card |
| Property types | 15+ types including relation/rollup | Fixed: title/notes/deadline/tags | Fixed: status/priority/estimate/assignee | 6 typed input types (text/date/url/number/email/phone) mapped to existing 26 schema columns |
| Card dimensions | Page (10x) only; no list density control | Row (1x) only | Row (1x) only | 4 density levels: 1x/2x/5x/10x — genuine differentiator |
| Undo | Browser undo per field (no global history) | None | None | MutationManager 100-step global undo across all editor fields |
| Card type | "Page type" (doc/database/board) — structural not semantic | "Type" = project/area/task | "Issue type" (feature/bug/improvement) | Semantic types: note/task/event/resource/person with property presets |

---

## Sources

- Codebase: `src/ui/NotebookExplorer.ts`, `src/mutations/MutationManager.ts`, `src/providers/SelectionProvider.ts`, `src/database/queries/cards.ts`, `src/database/queries/types.ts`, `src/views/CardRenderer.ts`
- Project planning: `.planning/PROJECT.md`, `.planning/milestones/v7.0-ROADMAP.md`, `90-UI-SPEC.md`
- Industry pattern: [Inline Edit Design Pattern — Medium/NextUX](https://medium.com/nextux/the-inline-edit-design-pattern-e6d46c933804) (MEDIUM confidence — design pattern article, not official source)
- Industry pattern: [Cloudscape Inline Edit](https://cloudscape.design/patterns/resource-management/edit/inline-edit/) (MEDIUM confidence — AWS design system, authoritative for the pattern)
- Industry pattern: [Date Input UX — Nielsen Norman Group](https://www.nngroup.com/articles/date-input/) (HIGH confidence — authoritative UX research)
- Industry pattern: [HTML Input Types — MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input) (HIGH confidence — official spec)
- Industry pattern: [InPlace Editor pattern — ui-patterns.com](https://ui-patterns.com/patterns/InplaceEditor) (MEDIUM confidence — community pattern library)

---
*Feature research for: Notebook Card Editor milestone in Isometry v5*
*Researched: 2026-03-18*
