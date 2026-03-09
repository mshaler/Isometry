# Domain Pitfalls: v5.2 SuperCalc + Workbench Phase B

**Domain:** Adding SQL aggregate calculations, notebook persistence/toolbar/charts, and LATCH histogram/chips to an existing 30K+ LOC TypeScript/D3/sql.js application
**Researched:** 2026-03-09
**Confidence:** HIGH (all pitfalls derived from direct codebase analysis with exact line references + verified ecosystem knowledge)

---

## Critical Pitfalls

Mistakes that cause data loss, security holes, or architectural rewrites.

---

### Pitfall 1: Schema Migration Absent -- Existing Databases Will Not Gain New Columns

**What goes wrong:** The current `Database.ts` has NO schema migration logic. When a hydrated database is loaded via checkpoint (lines 57-60), `applySchema()` is NOT called -- the comment says "The existing database already has the schema -- do NOT re-apply it." If notebook persistence requires a new column (e.g., `notebook_content TEXT` on `cards`) or a new table (e.g., `notebooks`), every existing user database will silently lack the new column/table. Writes will fail with "table has no column named notebook_content" or similar.

**Why it happens:** The checkpoint hydration path (`dbData` branch) skips schema application entirely. There is no `PRAGMA user_version` check, no migration runner, and no mechanism to detect schema drift between the code and the persisted database.

**Consequences:**
- Every existing user's database will crash on first notebook save after upgrade
- CloudKit sync will fail for devices that have upgraded vs devices that haven't (schema mismatch)
- The `buildCardMergeSQL()` in NativeBridge.ts hard-codes all 26 column names -- adding a column requires updating this function AND the CloudKit CKRecord field mapping

**Prevention:**
1. Add `PRAGMA user_version` tracking: set version 0 for all existing databases, version 1 for the v5.2 schema
2. Add a `migrateIfNeeded()` method to `Database.ts` that runs AFTER hydration but BEFORE `PRAGMA foreign_keys = ON`
3. Use `ALTER TABLE cards ADD COLUMN notebook_content TEXT` (nullable, no default required) for the migration
4. Update `buildCardMergeSQL()` in NativeBridge.ts to include the new column
5. Test migration path: create a v5.1-era database, hydrate it, verify migration runs

**Detection:** Any existing user updating the app who has previously saved data. Test with a checkpoint file that predates the schema change.

**Phase assignment:** Must be the FIRST phase of v5.2. Every other feature that touches the database depends on this.

---

### Pitfall 2: CloudKit Sync INSERT OR REPLACE Silently Wipes New Columns

**What goes wrong:** The `buildCardMergeSQL()` function in NativeBridge.ts (line 430-440) hard-codes all 26 column names in the `INSERT OR REPLACE INTO cards` statement. `INSERT OR REPLACE` is semantically DELETE + INSERT -- it deletes the existing row entirely, then inserts a new one. If a `notebook_content` column is added to the schema but NOT to `buildCardMergeSQL()`:
1. Device A writes notebook content to a card
2. Device B syncs that card via CloudKit -- `INSERT OR REPLACE` without notebook_content in the column list
3. The entire row is deleted and re-inserted WITHOUT notebook_content -- it becomes NULL
4. Device B syncs the now-NULL card back to Device A
5. Notebook content is permanently lost on both devices

**Why it happens:** There is no schema negotiation in the CloudKit sync protocol. The `SyncMerger` assumes a fixed set of fields. `INSERT OR REPLACE` is inherently destructive -- it cannot preserve columns it doesn't know about.

**Consequences:**
- Silent data loss with no error, no warning, and no recovery path
- Even on same-version devices, a race condition could lose content
- Cross-version sync (old code <-> new code) guarantees data loss

**Prevention:**
1. Update `buildCardMergeSQL()` to include the new column in the INSERT OR REPLACE statement
2. Consider migrating from `INSERT OR REPLACE` to `INSERT ... ON CONFLICT(id) DO UPDATE SET` (UPSERT) which only updates columns explicitly listed, leaving unmentioned columns untouched
3. UPSERT is safer for forward compatibility -- future schema additions won't silently wipe data from old-code devices
4. Add the new column to the CKRecord field mapping on the Swift side (CKSyncEngine record serialization)
5. Test: sync a card with notebook content from new-version device to old-version device and back

**Detection:** Write notebook content on Device A, trigger CloudKit sync, verify content survives round-trip on Device B and back.

**Phase assignment:** Schema migration phase AND notebook persistence phase. The migration phase adds the column; notebook persistence must coordinate with the sync merge path.

---

### Pitfall 3: D3 Chart Blocks in Markdown Create XSS Bypass Around DOMPurify

**What goes wrong:** The current `NotebookExplorer._renderPreview()` pipeline is: `marked.parse(content)` -> `DOMPurify.sanitize(html, SANITIZE_CONFIG)` -> `innerHTML`. The SANITIZE_CONFIG (lines 23-60) has `ALLOW_DATA_ATTR: false`, forbids `<script>`, `<style>`, `<iframe>`, and SVG tags are NOT in ALLOWED_TAGS. If D3 chart blocks inject SVG into the preview after sanitization, or if SVG tags are added to the allowlist to support inline charts, the security boundary is bypassed.

**Why it happens:** D3 chart rendering happens AFTER the sanitization pipeline. SVG supports `<script>`, `onload` event handlers, `<foreignObject>` (embeds arbitrary HTML), and `<use href="javascript:...">`. Any of these could execute arbitrary JavaScript in the WKWebView context.

**Consequences:**
- XSS in WKWebView -- full access to the JavaScript runtime, WorkerBridge, and potentially the native bridge (native:action messages)
- Malicious card names containing script payloads could be rendered in chart labels
- Imported Markdown from untrusted sources could contain crafted chart block syntax

**Prevention:**
1. Use a two-pass rendering approach:
   - Pass 1: `marked.parse()` -> `DOMPurify.sanitize()` -> set innerHTML (existing pipeline, unchanged)
   - Pass 2: Query rendered DOM for chart placeholder elements (`querySelectorAll('.notebook-chart')`) and mount D3-rendered SVG into those containers AFTER sanitization
2. SVG never passes through innerHTML -- D3 creates it programmatically
3. Use D3's `.text()` exclusively for user-derived content (card names, field values) -- never `.html()`
4. Chart data must come from the Worker query pipeline (already parameterized), not from raw Markdown content
5. Do NOT add SVG tags to `SANITIZE_CONFIG.ALLOWED_TAGS`

**Detection:** Create a card with name `<img src=x onerror=alert(1)>`, include it in a chart block, verify XSS does not execute.

**Phase assignment:** D3 chart blocks phase -- security review is mandatory.

---

### Pitfall 4: Textarea Formatting Toolbar Destroys Browser Undo Stack

**What goes wrong:** The existing `NotebookExplorer._wrapSelection()` (line 238-258) modifies `textarea.value` directly via string concatenation: `textarea.value = text.substring(0, start) + before + selected + after + text.substring(end)`. This destroys the browser's native undo stack. After any toolbar action (Bold, Italic, Link, Heading, List), Cmd+Z no longer works.

**Why it happens:** Setting `textarea.value` programmatically is a "silent" DOM property mutation that does not create an entry in the browser's native undo history. The undo stack only tracks user-initiated input events. This is a well-documented browser behavior confirmed in [Mozilla Bug 1523270](https://bugzilla.mozilla.org/show_bug.cgi?id=1523270).

**Consequences:**
- Users lose ALL undo history after any single toolbar action
- This is a fundamental UX regression that makes the toolbar feel broken
- The more toolbar buttons added, the more opportunities to break undo

**Prevention:**
1. Since the app runs exclusively in WKWebView (Safari/WebKit engine), use `document.execCommand('insertText', false, wrappedText)` which is supported on textarea elements in WebKit and preserves the native undo stack
2. Alternatively, use `textarea.setRangeText(replacement, start, end, 'select')` which is the modern standards-based approach
3. Both require first setting `selectionStart`/`selectionEnd` to define the replacement range, then performing the insertion
4. The existing Cmd+B/I/K keyboard shortcuts work correctly -- the fix is to change HOW text is inserted, not WHAT is inserted
5. Reference implementation: [GitHub markdown-toolbar-element](https://github.com/github/markdown-toolbar-element) uses `insertText` for undo-safe modifications

**Detection:** Type "hello" in notebook textarea, press Cmd+B, then press Cmd+Z. If undo works, the fix is correct. If undo clears everything or does nothing, the bug is present.

**Phase assignment:** Notebook toolbar phase -- the existing `_wrapSelection()` must be refactored BEFORE adding toolbar buttons.

---

### Pitfall 5: Notebook Content Lost on Rapid Navigation (Debounce Window)

**What goes wrong:** If notebook persistence uses debounced writes (e.g., 1-second delay after typing stops), there's always a window where content exists only in the textarea but hasn't been saved to the database. User types, switches views immediately, and content is lost because the debounce timer hadn't fired.

**Why it happens:** The NotebookExplorer `destroy()` method (lines 165-182) tears down DOM and nulls references without any persistence flush. There is currently no persistence at all (session-only), but when adding persistence, this pattern must be addressed.

**Consequences:** User loses recent typing -- perceived as data loss bug. Especially bad when switching between cards if per-card notebooks are implemented.

**Prevention:**
1. Call `_persistContent()` synchronously in `destroy()` to flush pending content before teardown
2. Use fire-and-forget pattern since `destroy()` cannot await: `this._bridge.send('db:exec', ...)` (the Promise resolves but we don't wait)
3. Keep debounced save for normal typing (reduces Worker round-trips), but always flush on destroy
4. Also flush on `beforeunload` / `pagehide` events as a safety net

**Detection:** Mount notebook, type content, immediately call destroy(), mount again, verify content persisted.

**Phase assignment:** Notebook persistence phase.

---

## Moderate Pitfalls

Mistakes that cause significant bugs or refactoring but are recoverable.

---

### Pitfall 6: Footer Rows Break Virtual Scrolling -- Spacer Height and Row Index Mismatch

**What goes wrong:** SuperGrid's `SuperGridVirtualizer` computes `{ startRow, endRow }` from `_totalRows` (leaf row count) with uniform row height. Footer aggregate rows are synthetic rows injected after data that occupy grid space but are NOT in the CellDatum array from the Worker. If footer rows are counted in `_totalRows`, the virtualizer over-counts. If excluded, the sentinel spacer height (line 2227-2242) is wrong and the scrollbar misrepresents content length.

**Why it happens:** The virtualizer is a pure computation module that assumes all rows are uniform data rows. Footer rows break this assumption.

**Prevention:**
1. Render footer rows with `position: sticky; bottom: 0` (pinned to group bottom) and EXCLUDE them from virtualizer row count
2. Spacer height must account for footer height separately: `spacerHeight = colHeaderHeight + dataHeight + (footerCount * footerRowHeight)`
3. Row index gutter (Phase 60's `_showRowIndex`) must skip footer rows -- do not assign sequential numbers to aggregate footers
4. Active cell crosshair (Phase 61) must skip footer cells -- use distinct CSS class `sg-footer-cell`

**Detection:** Enable virtual scrolling (>100 rows) with footer rows active. Scroll to group boundaries. Footer should remain visible.

**Phase assignment:** SuperCalc phase.

---

### Pitfall 7: Aggregate Query Performance -- Separate Worker Round-Trip

**What goes wrong:** The existing `buildSuperGridQuery()` returns `COUNT(*)` and `GROUP_CONCAT(id)` per cell intersection. Adding per-column aggregates (SUM, AVG per column group) requires a DIFFERENT GROUP BY granularity. Running a separate query doubles Worker round-trips; extending the main query makes it significantly more complex.

**Why it happens:** Cell-level GROUP BY (by row AND column axes) and column-level GROUP BY (by column axes only) are structurally different queries that can't share a single GROUP BY clause.

**Prevention:**
1. Prefer client-side computation from cached `_lastCells` data for simple aggregates (SUM of counts) -- no extra Worker round-trip needed
2. If SQL-level aggregation is required (e.g., SUM of a numeric field across cards in a column group), add a `supergrid:aggregate` message type with its own rAF coalescing state (separate from `_pendingSuperGridConfig`)
3. Use `Promise.all([cellQuery, aggQuery])` and render atomically to prevent race conditions
4. Cache aggregate results alongside `_lastCells` to avoid re-querying on collapse/expand

**Detection:** Profile with 1000+ rows and 5+ column groups. Measure render latency with vs without aggregate query.

**Phase assignment:** SuperCalc phase -- Worker protocol design decision.

---

### Pitfall 8: FilterProvider Range Filters Compound Instead of Replacing

**What goes wrong:** Histogram scrubbers add `gte`/`lte` range filters. The existing LATCH time presets also add `gte`/`lte` on the same fields (created_at, modified_at, due_at). `FilterProvider.addFilter()` (line 65) APPENDS to the array -- there's no concept of "filter source identity." Two systems adding `gte` on `created_at` produce two competing `AND created_at >= ?` clauses.

**Why it happens:** The existing `LatchExplorers._handleTimePresetClick()` (lines 422-448) works around this by manually removing existing gte/lte filters for the field before adding new ones. This is a fragile pattern that requires cross-component coordination.

**Prevention:**
1. Add a `setRangeFilter(field, min, max)` method to FilterProvider that atomically replaces (not appends) range filters for a given field
2. Both histograms and time presets should use this new method instead of raw addFilter/removeFilter
3. If both LATCH time presets AND histogram scrubbers can filter the same field, they must share state -- toggling a preset updates the histogram, scrubbing the histogram clears the preset
4. The `_onFilterChange` subscription callback (line 499) must synchronize both UIs

**Detection:** Set "This Month" on created_at, then scrub histogram to a different range. Verify only ONE range filter is active.

**Phase assignment:** LATCH histogram phase.

---

### Pitfall 9: Collapse Aggregate Mode Collides with Footer Aggregate Rows

**What goes wrong:** SuperGrid has "aggregate mode" for collapsed headers (Phase 30, `_collapseModeMap`). Collapsed headers show count badges (lines 1556-1564). SuperCalc footer rows add a second aggregation layer. If both active:
- Collapsed header badge: "47 cards"
- Footer SUM cell: "47" for the same group
- User sees redundant information

**Why it happens:** The existing aggregate injection (lines 1860-1954) creates `isSummary: true` CellPlacement entries with `summary:` key prefix (line 1974). SuperCalc footers need their own key prefix or they'll collide in the D3 join.

**Prevention:**
1. Use distinct key prefixes: existing `summary:` for collapse aggregates, new `footer:` for SuperCalc rows
2. Footer rows should NOT appear for collapsed groups in aggregate mode (the collapse badge already summarizes)
3. Consult `_collapsedSet` and `_collapseModeMap` when deciding whether to render a footer for each group

**Detection:** Collapse a group in aggregate mode, verify footer row hides or shows coherent (non-duplicate) summary.

**Phase assignment:** SuperCalc phase.

---

### Pitfall 10: Notebook Persistence Scope Ambiguity -- Per-Card vs. Global

**What goes wrong:** The current `NotebookExplorer` has a single `_content` field (line 81). The v5.2 scope says "notebook persistence to IsometryDatabase" but doesn't specify whether the notebook is per-card or global. This cascades into schema design, CloudKit sync, UI card-switching behavior, and FTS5 indexing.

**Why it happens:** The v5.0 spec created the notebook as a session-only scratch pad. Persisting it requires answering: per-card (new column on cards) vs. global (row in ui_state) vs. standalone entity (new table).

**Prevention:**
1. Decide scope BEFORE implementation -- this is a blocking architecture decision
2. Per-card (recommended): `ALTER TABLE cards ADD COLUMN notebook_content TEXT`, add `setCardId(id)` to NotebookExplorer, update CloudKit sync
3. Global: use `ui_state` key `notebook_content` -- simplest but least useful
4. Standalone: new table + new CKRecord type -- most flexible but highest complexity

**Detection:** Open notebook for Card A, type content, switch to Card B, switch back to Card A. Content should persist.

**Phase assignment:** Architecture decision required BEFORE notebook persistence phase.

---

### Pitfall 11: marked.parse() Custom Renderer for Charts Breaks Standard Code Blocks

**What goes wrong:** Adding a custom renderer for ` ```chart:bar ` code blocks accidentally intercepts ALL fenced code blocks. Regular code blocks (` ```typescript `, ` ```sql `) stop rendering because the custom renderer doesn't fall through to the default.

**Why it happens:** The marked `code()` renderer hook receives ALL code blocks. If the custom handler doesn't check the language tag and return `false` for non-chart blocks, it swallows everything.

**Prevention:**
1. In the custom renderer, check `language.startsWith('chart')` and return `false` for all other languages
2. `false` return signals marked to use its default renderer -- this is the documented API behavior
3. Test with mixed content: a ` ```chart:bar ` block AND a ` ```typescript ` block in the same notebook

**Detection:** Write a notebook with both chart blocks and code blocks. Verify code blocks render with syntax formatting.

**Phase assignment:** D3 chart blocks phase.

---

### Pitfall 12: Category Chips Duplicate Existing LatchExplorers Checkbox UI

**What goes wrong:** LatchExplorers already provides multi-select filtering for Category fields (folder, status, card_type) via D3 checkbox lists (lines 310-384). Adding "category chips" creates a second UI path to the same FilterProvider state. If not synchronized, one shows stale state.

**Prevention:**
1. Category chips should REPLACE checkboxes in the Category section, not coexist
2. OR: chips are a compact read-only summary of active filters (dismissible), with checkboxes as the interaction surface
3. Both must subscribe to `FilterProvider.subscribe()` using the existing `_onFilterChange()` pattern
4. If chips are outside LatchExplorers, they need their own subscription wiring

**Detection:** Check a checkbox, verify chip appears. Dismiss chip, verify checkbox unchecks.

**Phase assignment:** LATCH Phase B.

---

## Minor Pitfalls

Mistakes that cause small bugs or minor friction.

---

### Pitfall 13: FTS5 Triggers Won't Index Notebook Content

**What goes wrong:** If `notebook_content` is added to `cards`, the FTS5 triggers (schema.sql lines 116-133) only index `name`, `content`, `folder`, `tags`. Notebook content won't be searchable via Cmd+K or SuperSearch.

**Prevention:**
1. Either add `notebook_content` to the FTS5 virtual table and update all 3 triggers (INSERT, DELETE, UPDATE OF column list)
2. Or explicitly decide notebook content is NOT searchable and document this
3. If adding to FTS5: the UPDATE trigger `AFTER UPDATE OF` clause (line 128) must include `notebook_content`

**Phase assignment:** Schema migration phase.

---

### Pitfall 14: SUM/AVG on TEXT Columns Returns 0 Silently

**What goes wrong:** SQLite's `SUM()` on TEXT returns 0 (no error). User configures SuperCalc to SUM `folder` column -- footer shows "0" with no indication the operation is meaningless.

**Prevention:**
1. Only offer SUM/AVG for known numeric fields (priority, sort_order, latitude, longitude)
2. The `SuperGridQueryConfig.displayField` (SuperGridQuery.ts line 105-109) already validates fields -- extend validation to check type compatibility
3. For TEXT fields: only offer COUNT, MIN (alphabetical first), MAX (alphabetical last)

**Phase assignment:** SuperCalc Workbench panel.

---

### Pitfall 15: Histogram Bins on ISO Date Strings

**What goes wrong:** Date fields are stored as ISO 8601 TEXT (e.g., `2026-03-09T12:00:00Z`). `d3.bin()` on strings produces lexicographic bins, not temporal bins. Dates spanning midnight boundaries will be mis-binned.

**Prevention:**
1. Convert ISO strings to epoch milliseconds: `new Date(isoString).getTime()`
2. Use `d3.scaleTime()` for date-based histogram axes
3. Exclude NULL values from bins; show separate "No date" indicator

**Phase assignment:** LATCH histogram phase.

---

### Pitfall 16: Footer Row gutterOffset Misalignment

**What goes wrong:** In spreadsheet viewMode, the gutter column shifts all gridColumn values by 1. Footer cells that don't apply `gutterOffset` render one column left of their data columns.

**Prevention:** Pass `gutterOffset` to the footer rendering function, same as data cells (line 2000: `colStart + rowHeaderDepth + gutterOffset`).

**Phase assignment:** SuperCalc phase.

---

### Pitfall 17: Toolbar Buttons Active During Preview Mode

**What goes wrong:** Toolbar buttons visible in Preview tab have no target textarea. Clicking Bold in Preview does nothing with no feedback.

**Prevention:** Disable toolbar buttons (add `disabled` attribute) when `_activeTab === 'preview'`. Re-enable on Write tab switch.

**Phase assignment:** Notebook toolbar phase.

---

### Pitfall 18: Chart Data Re-fetched on Every Preview Toggle

**What goes wrong:** Each Write-to-Preview switch triggers `_renderPreview()` which would fire `db:query` for every chart block. Rapid tab switching creates unnecessary Worker load.

**Prevention:** Cache chart data in the NotebookExplorer instance. Set a `_chartDataDirty` flag via StateCoordinator subscription. Only re-fetch when dirty.

**Phase assignment:** D3 chart blocks phase.

---

### Pitfall 19: d3.brushX Clear Leaves Ghost Filter

**What goes wrong:** User drags histogram brush to set range, then clicks outside to visually clear brush. The brush disappears but FilterProvider still has the gte/lte filters.

**Prevention:** In `brush.on('end')`, check `event.selection === null` (brush cleared) and explicitly remove the corresponding range filters.

**Phase assignment:** LATCH histogram phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Schema Migration | **P1**: No migration runner; hydrated DBs skip schema | Add PRAGMA user_version + migrateIfNeeded() FIRST |
| Schema Migration | **P2**: CloudKit INSERT OR REPLACE wipes new columns | Switch to UPSERT or update buildCardMergeSQL() |
| Schema Migration | **P13**: FTS5 triggers won't index new columns | Update virtual table + all 3 triggers |
| SuperCalc | **P6**: Footer rows break virtualizer row count | Sticky-pin footers; exclude from totalRows |
| SuperCalc | **P7**: Separate aggregate query doubles Worker trips | Client-side computation or combined query |
| SuperCalc | **P9**: Collapse aggregate collides with footer aggregate | Distinct D3 key prefixes; hide footer for collapsed |
| SuperCalc | **P14**: SUM/AVG on TEXT returns 0 silently | Validate column type in UI config panel |
| SuperCalc | **P16**: gutterOffset misalignment on footer cells | Apply same offset as data cells |
| Notebook Toolbar | **P4**: textarea.value kills undo stack | Use execCommand('insertText') or setRangeText() |
| Notebook Toolbar | **P17**: Buttons active in Preview mode | Disable buttons on tab switch |
| Notebook Persistence | **P5**: Content lost on destroy during debounce | Synchronous flush in destroy() |
| Notebook Persistence | **P10**: Per-card vs global scope ambiguity | Architecture decision BEFORE implementation |
| D3 Chart Blocks | **P3**: SVG injection bypasses DOMPurify | Two-pass render; D3 mounts AFTER sanitization |
| D3 Chart Blocks | **P11**: Custom renderer breaks standard code blocks | Return false for non-chart languages |
| D3 Chart Blocks | **P18**: Chart data re-fetched every preview toggle | Cache + dirty flag pattern |
| LATCH Histogram | **P8**: Range filters compound instead of replacing | Add setRangeFilter() to FilterProvider |
| LATCH Histogram | **P15**: ISO dates break d3.bin() | Convert to epoch ms; use d3.scaleTime() |
| LATCH Histogram | **P19**: Brush clear leaves ghost filter | Handle null selection in brush end |
| Category Chips | **P12**: Chips duplicate checkbox UI | Chips replace OR summarize checkboxes |

---

## Recommended Phase Ordering Based on Pitfall Dependencies

1. **Schema Migration** (P1, P2, P13) -- Every feature that touches the database depends on migration infrastructure existing. Must be first.
2. **SuperCalc** (P6, P7, P9, P14, P16) -- Most complex integration with existing SuperGrid (4,342 lines). Footer row rendering interacts with virtualizer, gutter, collapse, and D3 join.
3. **Notebook Persistence** (P5, P10) -- Requires schema migration. Architecture decision (per-card vs global) blocks toolbar and chart work.
4. **Notebook Toolbar** (P4, P17) -- Requires fixing the undo-breaking `_wrapSelection` pattern before adding toolbar buttons.
5. **D3 Chart Blocks** (P3, P11, P18) -- Most isolated; requires security review but doesn't block others.
6. **LATCH Histogram + Chips** (P8, P12, P15, P19) -- Can proceed in parallel with notebook work. Filter pipeline integration follows established LatchExplorers patterns.

---

## Sources

- **Codebase analysis** (with line references): SuperGrid.ts, NotebookExplorer.ts, FilterProvider.ts, Database.ts, NativeBridge.ts, SuperGridQuery.ts, SuperGridVirtualizer.ts, allowlist.ts, schema.sql, LatchExplorers.ts, types.ts, WorkerBridge.ts
- [SQLite ALTER TABLE](https://www.sqlite.org/lang_altertable.html) -- ADD COLUMN constraint limitations
- [SQLite PRAGMA user_version](https://levlaz.org/sqlite-db-migrations-with-pragma-user_version/) -- migration version tracking
- [Mozilla Bug 1523270](https://bugzilla.mozilla.org/show_bug.cgi?id=1523270) -- textarea undo history lost on programmatic value assignment
- [text-field-edit library](https://github.com/fregante/text-field-edit) -- undo-safe textarea modification via insertText
- [GitHub markdown-toolbar-element](https://github.com/github/markdown-toolbar-element) -- reference implementation for Markdown formatting buttons
- [ag-grid #1791](https://github.com/ag-grid/ag-grid/issues/1791) -- total footer row with pivot grid difficulties
- [ag-grid #3822](https://github.com/ag-grid/ag-grid/issues/3822) -- chart + grouped rows + footer totals bug
- [Markdown XSS wiki](https://github.com/showdownjs/showdown/wiki/Markdown's-XSS-Vulnerability-(and-how-to-mitigate-it)) -- sanitization bypass patterns
- [ArcGIS HistogramRangeSlider](https://developers.arcgis.com/javascript/latest/api-reference/esri-widgets-HistogramRangeSlider.html) -- range filter integration
- [CSS Grid sticky footers](https://css-tricks.com/how-to-use-css-grid-for-sticky-headers-and-footers/) -- pinned footer positioning
