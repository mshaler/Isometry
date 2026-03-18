# Phase 90: Notebook Verification + Themes - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Two deliverables: (1) DB Utilities enhancements — card count display and a recent-cards viewer for verifying notebook persistence (that edits in NotebookExplorer actually saved). (2) Three named design themes — Modern (existing dark/light/system palette, renamed), NeXTSTEP (authentic retro), and Material 3 (Dynamic Color) — with a unified theme picker and a fix for mid-session theme switching lag.

</domain>

<decisions>
## Implementation Decisions

### Theme identity
- **Modern** = the existing dark/light/system palette. No new colors — just rename what exists today.
- **NeXTSTEP** = authentic retro. Faithful NeXTSTEP grays (#838383-ish), black title bars, beveled 3D border illusions, dense utilitarian feel. Nostalgic throwback, not a modern reinterpretation.
- **Material 3** = Google's Material You style. Rounded corners, tonal color surfaces, pastel accent families, generous spacing, Roboto/Product Sans feel.
- Each named theme is a single fixed palette — NO dark/light variants for NeXTSTEP or Material 3.
- Modern retains its existing dark/light/system sub-modes as today.
- Total options: Modern Dark, Modern Light, Modern System, NeXTSTEP, Material 3 = 5 choices.

### Theme switching UX
- One unified theme picker replaces the existing light/dark/system toggle.
- Picker lives in the settings dialog.
- Instant switch on click — no hover preview, no confirmation.
- Persist selection via existing ThemeProvider → StateManager → ui_state pipeline.

### Theme lag fix
- Known issue: slow repaint when toggling theme mid-session.
- The current `--theme-transition` CSS property applies 200ms transitions on background-color, color, border-color, fill, stroke — this may be causing layout/paint thrash across hundreds of elements.
- Fix should make theme switching feel instant during mid-session toggles.

### Recent-cards viewer (notebook verification)
- Purpose: verify that notebook edits in NotebookExplorer actually persisted — "did my note save?"
- Display: compact list inside the DB Utilities section of DataExplorerPanel (CollapsibleSection).
- Show 5-10 rows with card title, source, created date.
- Click action: sets SelectionProvider to that card — NotebookExplorer shows its content, SuperGrid highlights it.
- Card count stat already exists in DB Utilities — this adds the recent-cards list below it.

### Claude's Discretion
- Exact NeXTSTEP hex values and border styling technique (CSS box-shadow vs border-image for beveled look)
- Material 3 tonal palette generation approach
- Number of recent cards shown (5-10 range, Claude picks)
- SQL query for recent cards (ORDER BY created_at DESC LIMIT N, or by ui_state notebook keys)
- How to reduce theme transition lag (remove transition properties, use requestAnimationFrame batching, or class-swap approach)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Theme system
- `src/providers/ThemeProvider.ts` — Current 3-way toggle (light/dark/system), data-theme attribute, matchMedia listener, PersistableProvider interface
- `src/styles/design-tokens.css` — All CSS custom properties for dark and light themes, theme-independent tokens (spacing, typography, transitions)
- `src/providers/types.ts` — ThemeMode type definition

### DB Utilities / DataExplorer
- `src/ui/DataExplorerPanel.ts` — Existing DB Utilities section with card_count/connection_count/db_size_bytes stats, CollapsibleSection layout
- `src/styles/data-explorer.css` — DataExplorerPanel styling

### Notebook system
- `src/ui/NotebookExplorer.ts` — Per-card notebook persistence via ui_state table (notebook:{cardId} key convention), SelectionProvider subscription
- `src/styles/notebook-explorer.css` — NotebookExplorer styling

### Architecture patterns
- `CLAUDE-v5.md` — Architecture decisions D-001..D-011

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ThemeProvider**: PersistableProvider with toJSON/setState/resetToDefaults — extend to handle named themes + sub-modes
- **DataExplorerPanel._buildDbUtilitiesSection()**: Existing stats container with card/connection/size rows — extend with recent-cards list below
- **CollapsibleSection**: Reusable collapsible panel component used across all explorer panels
- **design-tokens.css**: Complete CSS custom property system with dark/light blocks — add NeXTSTEP and Material 3 as new `[data-theme="nextstep"]` and `[data-theme="material"]` blocks
- **SelectionProvider**: Already wired to NotebookExplorer — recent-cards click can set selection directly

### Established Patterns
- **data-theme attribute on <html>**: All theming goes through this single attribute + CSS custom properties. New themes follow the same pattern.
- **PersistableProvider interface**: toJSON/setState/resetToDefaults for state persistence via ui_state table
- **CollapsibleSection for explorer sections**: mount/destroy lifecycle, localStorage persistence for collapsed state

### Integration Points
- ThemeProvider.setTheme() is the single entry point for theme changes — extend ThemeMode type union
- DataExplorerPanel.updateStats() is called from main.ts after Worker bridge queries — extend for recent-cards data
- Settings dialog (AppDialog) is where the new unified theme picker will live

</code_context>

<specifics>
## Specific Ideas

- NeXTSTEP should feel like a genuine throwback — the original NeXTSTEP desktop gray, not a modern flat gray. Beveled 3D borders are key to the authentic feel.
- Material 3 should be recognizably Google — the tonal surface system, rounded everything, pastel accents.
- "Modern" is just a label for what already exists — zero visual changes to the current palette.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 90-notebook-verification-themes*
*Context gathered: 2026-03-18*
