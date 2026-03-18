# Stack Research

**Domain:** Notebook-as-Card-Editor — card editing, typed property editors, card dimension rendering, start-typing creation
**Researched:** 2026-03-18
**Confidence:** HIGH (all conclusions drawn from direct codebase inspection and locked architectural decisions)

---

## Context: Existing Validated Stack (Do Not Re-Research)

| Technology | Version | Role |
|------------|---------|------|
| TypeScript | 5.9 strict | All source |
| sql.js (FTS5 WASM) | 1.14 | In-memory SQLite, system of record |
| D3.js | v7.9 | Data joins + rendering |
| Vite | 7.3 | Build |
| Vitest | 4.0 | Test runner |
| Biome | 2.4.6 | Lint + format |
| marked | 17.0.4 | Markdown rendering in NotebookExplorer |
| DOMPurify | 3.3.2 | XSS sanitization |
| MutationManager | — | Sole write gate (createCardMutation, updateCardMutation) |
| WorkerBridge | — | Typed async RPC to sql.js Worker |
| ui_state | — | Key-value persistence (notebook:{cardId} pattern) |
| SchemaProvider | — | Runtime PRAGMA introspection |

**This milestone adds Notebook-as-Card-Editor:** the NotebookExplorer gains card editing capability (name, type, status, tags, dates, priority) plus start-typing card creation and multi-size card dimension rendering (1x/2x/5x/10x).

---

## Recommended Stack

### Core Technologies (New for This Milestone)

No new runtime npm packages are needed. All new features compose existing capabilities.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Native `<input type="date">` | HTML built-in | Date property editor (due_at, event_start, event_end, completed_at) | WKWebView on macOS 14+ renders `<input type="date">` with native date picker. No library needed. ISO 8601 value format (YYYY-MM-DD) matches the sql.js column format. Zero bundle cost. |
| Native `<input type="number">` | HTML built-in | Numeric property editor (priority, sort_order, latitude, longitude) | WKWebView renders number inputs with native spinner. step/min/max attributes enforce valid ranges. No library. |
| Native `<select>` | HTML built-in | Enum property editor (card_type, status) | Already used throughout PropertiesExplorer, ProjectionExplorer, CalcExplorer. Consistent with existing patterns. |
| Native `<input type="text">` | HTML built-in | Text property editors (name, folder, url, location_name, mime_type, summary, source_url) | Already used for inline rename in PropertiesExplorer (span-to-input swap pattern). Same pattern applies here. |
| CSS custom properties (existing `--sg-*` token family + design-tokens.css) | — | Card dimension size tokens (1x/2x/5x/10x multipliers) | `design-tokens.css` already defines the `--text-*` scale. Dimension multipliers fit the same token pattern. Avoids JS-driven sizing — CSS `[data-card-size]` attribute drives all dimension variants. |

### Supporting Libraries

No new libraries. The implementation reuses:

| Library | Version | Purpose | Integration Point |
|---------|---------|---------|-------------------|
| `createCardMutation` (existing) | — | Undo-safe card INSERT | `mutations/inverses.ts` — pass `CardInput`, MutationManager executes + notifies |
| `updateCardMutation` (existing) | — | Undo-safe field UPDATE | `mutations/inverses.ts` — requires `before: Card` snapshot + `after: Partial<CardInput>` |
| `bridge.send('card:get', { id })` (existing) | — | Fetch full Card for before-state capture | Worker handler returns `Card` for `updateCardMutation` before-state |
| `bridge.send('datasets:recent-cards')` (existing) | — | Refresh Recent Cards list after new card creation | Phase 90 handler already returns 8 most-recently-created non-deleted cards |
| `SelectionProvider.subscribe()` (existing) | — | Drive card binding in editor | Current pattern in NotebookExplorer drives textarea binding — extend same subscription |
| `SchemaProvider` (existing) | — | Know which fields exist at runtime | Drives property editor field list dynamically |

### Development Tools

No new tools. Existing toolchain covers all needs:

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest 4.0 (existing) | Unit tests for new CardEditorPanel logic | Test property validation, dimension token generation, start-typing state machine |
| Biome 2.4.6 (existing) | Lint + format | No config changes needed |
| TypeScript 5.9 strict (existing) | Type-safe `CardInput` updates | `Partial<Omit<CardInput, 'card_type'>>` is already the update type in protocol.ts |

---

## Installation

```bash
# No new packages required.
# All new features use existing dependencies and built-in browser APIs.
```

---

## Integration Architecture

### Card Editor Panel

The Notebook Card Editor is a new panel class (`CardEditorPanel`) that mounts inside NotebookExplorer alongside (or replacing) the textarea when a card is selected:

```
NotebookExplorer
  ├── [existing] Segmented control (Write | Preview | Edit)   ← add "Edit" tab
  ├── [existing] Formatting toolbar (Write mode only)
  ├── [existing] Textarea (Write mode)
  ├── [existing] Preview div (Preview mode)
  └── [new] CardEditorPanel (Edit mode)
       ├── Name input (text)        → updateCardMutation({ name })
       ├── Type select              → updateCardMutation({ card_type })
       ├── Status input (text)      → updateCardMutation({ status })
       ├── Priority input (number)  → updateCardMutation({ priority })
       ├── Folder input (text)      → updateCardMutation({ folder })
       ├── Tags input (text)        → updateCardMutation({ tags: split(',') })
       ├── Due date input (date)    → updateCardMutation({ due_at })
       ├── URL input (text)         → updateCardMutation({ url })
       └── Summary textarea (text)  → updateCardMutation({ summary })
```

Each field fires `updateCardMutation` on blur (not on every keystroke) to avoid flooding undo history. Debounce is NOT appropriate here — blur-commit is the correct unit of undo.

### Start-Typing Card Creation

When NotebookExplorer has no active card (empty selection) and the user types in the Name field, a new card is created via `createCardMutation`:

1. User clicks "New Card" button OR types in name input while no card is selected
2. `createCardMutation({ name: typedText, card_type: 'note' })` via MutationManager
3. `bridge.send('card:get', { id: newCardId })` to get the created Card for selection
4. SelectionProvider updates to select new card ID
5. CardEditorPanel binds to new card

The `createCardMutation` already generates the UUID client-side before the INSERT — so the card ID is available synchronously for selection after MutationManager.execute() resolves.

### Card Dimension Rendering (1x/2x/5x/10x)

Card dimension scaling is a CSS-only concern. No JS resize logic is needed.

Pattern: `[data-card-size="2x"]` attribute on the view container drives CSS custom property overrides.

```css
/* New in design-tokens.css */
:root {
  --card-scale: 1;
}
[data-card-size="2x"]  { --card-scale: 2; }
[data-card-size="5x"]  { --card-scale: 5; }
[data-card-size="10x"] { --card-scale: 10; }

/* Applied in views.css */
.card-bg {
  width:  calc(var(--card-base-width,  180px) * var(--card-scale, 1));
  height: calc(var(--card-base-height, 120px) * var(--card-scale, 1));
}
```

The existing `CARD_DIMENSIONS` constants in `CardRenderer.ts` become the `1x` base values. The D3 data joins in GridView/GalleryView already read CARD_DIMENSIONS — replace with CSS-var-aware accessors or keep constants and apply CSS transforms instead.

**CSS transform approach (simpler, zero D3 changes):**
```css
[data-card-size="2x"]  .card-group { transform: scale(2); transform-origin: top left; }
[data-card-size="5x"]  .card-group { transform: scale(5); transform-origin: top left; }
[data-card-size="10x"] .card-group { transform: scale(10); transform-origin: top left; }
```
CSS `transform: scale()` is GPU-accelerated and requires zero changes to D3 layout math. This is the recommended approach for v1 of dimension rendering.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Native `<input type="date">` | Flatpickr or similar date picker library | Only if the native WKWebView date picker UX is unacceptable (e.g., broken on a specific iOS version). Current WKWebView (macOS 14+, iOS 17+) renders native date pickers correctly. No library needed. |
| Blur-commit for property updates | Debounced keystroke-commit | Keystroke-commit creates dozens of undo steps per edit session. Blur-commit = one undo step per field edit. This is standard form UX. |
| CSS `transform: scale()` for dimensions | D3 layout recalculation at each scale | D3 layout recalculation would require changing CARD_DIMENSIONS constants, D3 SVG attr values, and GridView layout math. CSS transform achieves the same visual result with zero D3 changes. |
| Extend NotebookExplorer with "Edit" tab | New standalone `CardEditorView` in ViewManager | A separate view would lose the Notebook ↔ Editor relationship (notes live next to properties). The "Edit" tab in NotebookExplorer keeps card notes and properties co-located — correct product UX. |
| `bridge.send('card:get')` for before-state | Cache Card in SelectionProvider | SelectionProvider only holds IDs, not full Card data. `card:get` is a fast in-memory sql.js lookup (~1ms). Caching adds stale-data risk. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Flatpickr, pikaday, or any date picker library | Native `<input type="date">` works in WKWebView (macOS 14+, iOS 17+). Adding a library for this adds ~20-40KB bundle cost and a new dependency maintenance burden. | `<input type="date">` with `value` in YYYY-MM-DD format |
| React / Vue / Lit / any component framework | D3 data join IS the state management (D-001, locked). Adding a component framework conflicts with the data join ownership model and would require a massive architectural refactor. | Vanilla DOM + D3 data joins, matching existing NotebookExplorer and PropertiesExplorer patterns |
| Quill, TipTap, ProseMirror, or rich text editor | NotebookExplorer uses `<textarea>` + marked for Markdown. The card editor property fields are plain form inputs. No rich text is needed for name, status, folder, tags, URL fields. | Native inputs + existing `<textarea>` for summary |
| Zod or any runtime validation library | CardInput is already typed via TypeScript strict mode. SQL constraints in sql.js enforce data integrity at the persistence layer. Runtime validation in TypeScript adds bundle cost without new safety. | TypeScript types + SQL NOT NULL / CHECK constraints |
| A separate `CardSizeProvider` class | Card dimensions are a purely presentational CSS concern. A new provider for this would add unnecessary JS abstraction for what is simply a CSS `data-attribute` toggle. | `[data-card-size]` attribute + CSS custom properties |
| `marked-gfm-heading-id` or other marked plugins | marked 17.0.4 already ships GFM extensions. The card editor uses plain inputs, not Markdown, for property fields. No new marked extensions needed. | Existing `marked.use()` in NotebookExplorer |

---

## Stack Patterns by Feature

**Card name editing (start-typing creation):**
- Empty name field in Edit tab → listen for first `input` event → call `createCardMutation({ name: '', card_type: 'note' })`
- Card ID available synchronously from `createCardMutation` return value (UUID generated client-side)
- Select new card in SelectionProvider after MutationManager.execute() resolves
- All subsequent field edits use `updateCardMutation` with before-state from `bridge.send('card:get')`

**Tags property editor:**
- Single `<input type="text">` with comma-separated display (e.g., "work, project, 2026")
- On blur: `value.split(',').map(t => t.trim()).filter(Boolean)` → `updateCardMutation({ tags: [...] })`
- This matches the existing `serializeTags()` function in `mutations/inverses.ts` which handles `string[]` → JSON

**Date property editors (due_at, event_start, event_end, completed_at):**
- `<input type="date">` renders native date picker in WKWebView
- WKWebView value format is always `YYYY-MM-DD` — pad with `T00:00:00.000Z` when writing to sql.js ISO 8601 columns
- On clear (empty value): pass `null` to updateCardMutation

**Dimension rendering scale selector:**
- Add `[data-card-size]` attribute to the view container element
- A `<select>` control in the Workbench toolbar or View tab bar sets `"1x" | "2x" | "5x" | "10x"`
- Persist selection in `ui_state` under key `view:card-size:{viewType}` (same pattern as `notebook:{cardId}`)
- CSS `transform: scale()` applied to card group elements — GPU-accelerated, no D3 layout changes

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `<input type="date">` | WKWebView macOS 14+ / iOS 17+ | Returns `YYYY-MM-DD` string. An empty/cleared date returns `""` (empty string), not `null` — convert explicitly. |
| `createCardMutation` + `updateCardMutation` | MutationManager (existing) | Both already in `mutations/index.ts` public exports. No changes to mutation infrastructure. |
| `bridge.send('card:get', { id })` | WorkerBridge + sql.js handler | Handler returns `Card | null`. Guard against null (card deleted between create and get). |
| CSS `transform: scale()` | WKWebView (all versions) | GPU-composited layer — no reflow cost. Does not affect D3 SVG coordinate system (attributes unchanged). |

---

## Sources

- Direct codebase inspection: `src/mutations/inverses.ts`, `src/mutations/MutationManager.ts`, `src/ui/NotebookExplorer.ts`, `src/ui/PropertiesExplorer.ts`, `src/views/CardRenderer.ts`, `src/worker/protocol.ts`, `src/database/queries/types.ts` — HIGH confidence
- `.planning/TODOS.md` — Captured UAT gap: "NotebookExplorer should support creating new cards" (2026-03-18)
- `package.json` — Confirmed current dependency versions (marked 17.0.4, dompurify 3.3.2, d3 7.9.0, sql.js 1.14.0)
- Project memory (MEMORY.md) — Locked decisions D-001 through D-011, ui_state key conventions, CloudKit sync pipeline
- MDN `<input type="date">` — WKWebView compatibility confirmed via WebKit changelog; native picker available macOS 14+ / iOS 17+

---

*Stack research for: Notebook Card Editor — card editing, typed property editors, start-typing creation, card dimension rendering*
*Researched: 2026-03-18*
