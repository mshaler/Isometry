---
gsd_state_version: 1.0
milestone: v4.2
milestone_name: Polish + QoL
status: complete
last_updated: "2026-03-07T21:28:27.252Z"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 15
  completed_plans: 15
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v4.2 Phase 47 -- ETL Validation

## Current Position

Phase: 47 of 47 (ETL Validation) -- sixth of 6 phases in v4.2
Plan: 3 of 3 in Phase 47 (COMPLETE)
Status: Phase 47 plan 03 complete -- all plans in phase complete
Last activity: 2026-03-07 -- Completed 47-03 (Source errors + dedup re-import)

Progress: [##########] 3/3 plans

## Performance Metrics

**Velocity:**
- v4.1 milestone: 12 plans in 1 day (12 plans/day)
- v4.0 milestone: 9 plans in 2 days (4.5 plans/day)
- v3.1 milestone: 12 plans in 2 days (6 plans/day)
- v3.0 milestone: 35 plans in 2 days (17.5 plans/day)

*Updated after each plan completion*

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-010). Full logs in PROJECT.md.

- [42-01] Disabled 8 Biome lint rules conflicting with tsconfig strictness (useLiteralKeys, noNonNullAssertion, noUnusedPrivateClassMembers, noExplicitAny, useTemplate, useNodejsImportProtocol, useIterableCallbackReturn, noUselessSwitchCase)
- [42-01] Biome 2.x uses `includes` key (not `include`) in files config
- [42-02] inputPaths uses $(SRCROOT)/../../package.json because SRCROOT is native/Isometry (2 levels deep from repo root)
- [42-02] Provisioning profile regenerated via Xcode automatic signing (not manual Apple Developer Console)
- [42-03] Lint CI job uses biomejs/setup-biome@v2 (no npm ci) for 8s execution
- [42-03] Branch protection strict mode + enforce_admins disabled for owner direct push

- [43-02] Inline styles for density empty state (consistent with SuperGrid DOM construction pattern)
- [43-02] Distinguished density-caused empty from genuine empty via colAxisValuesRaw.length check

- [45-01] 12px font-size mapped to --text-sm (11px) as closest token value
- [45-01] #fff in audit active state replaced with var(--text-primary) (white on dark = text-primary)
- [45-01] rgba(0,0,0,0.2) in import-toast kept as-is (no exact token match)

- [46-01] Error categories ordered: parse > database > network > import > unknown (first regex match wins)
- [46-01] JSONParser unrecognized structure check uses HEADER_SYNONYMS for card-field detection
- [46-02] Capture mutation description BEFORE undo() pops it from history
- [46-02] Read description AFTER redo() from last history entry (redo pushes back)
- [46-02] ActionToast follows ImportToast pattern with optional container parameter

- [44-01] ShortcutRegistry uses single keydown listener with input field guard — eliminates duplicated guard logic
- [44-01] Cmd modifier maps to metaKey on Mac, ctrlKey on non-Mac for cross-platform consistency
- [44-01] AuditOverlay Shift+A shortcut not migrated — owns its own lifecycle, migration would add coupling
- [Phase 43]: Unfiltered COUNT query distinguishes welcome (0 cards) from filtered-empty (filters hiding cards)
- [Phase 43]: FilterProviderLike narrow interface in ViewManager.ts, not shared types.ts
- [Phase 43]: Import CTAs use CustomEvent dispatch (isometry:import-file, isometry:import-native) decoupling ViewManager from import infrastructure

- [45-03] 9px sort badge and 8px chevron kept as literal px (below --text-xs 10px token scale)
- [45-03] Teal drag-over accent rgba(0,150,136,0.18) kept as-is (intentionally distinct from --selection-bg)
- [45-03] Test assertions check var(--token) strings directly (jsdom limitation: cannot resolve CSS custom properties)

- [45-02] TreeView card type colors mapped to source provenance tokens (note->source-markdown, task->source-csv, event->source-native-calendar, resource->source-native-reminders, person->danger)
- [45-02] Tree label fill uses var(--text-secondary) for readability on dark backgrounds
- [45-02] audit-colors.ts retains hardcoded hex values with documentation mapping to CSS custom properties
- [Phase 44]: ViewSwitchReceiver extracted as ViewModifier to prevent SwiftUI type-checker timeout when adding 9 onReceive handlers to body
- [Phase 44]: onReceive handlers set selectedViewID (not call switchView directly) to keep sidebar in sync via existing onChange
- [Phase 44]: HelpOverlay registers ? through ShortcutRegistry but handles Escape via separate keydown listener (contextual to overlay visibility)

- [47-01] Apple Notes note links use attachment type com.apple.notes.inlinetextattachment.link (not frontmatter links field)
- [47-01] Apple Notes attachment IDs must be strings in YAML (link-1002 not 1002) for extractNoteLinks() att.id.match()
- [47-01] Excel fixtures stored as JSON row definitions with runtime SheetJS generation (avoid binary files)
- [47-01] HTML test passes array directly to ImportOrchestrator.import() via cast

- [47-03] Error assertions use pattern matching (toMatch(/keyword/i)) not exact strings -- prevents brittle tests
- [47-03] HTML dedup requires og:url/canonical for stable source_id -- without it source_id is random UUID
- [47-03] DedupEngine connection dedup: pre-check existing connections because SQLite UNIQUE ignores NULL via_card_id (NULL != NULL)
- [47-03] Dedup re-import asserts inserted===0 + (unchanged+updated===first.inserted) -- parsers with unstable timestamps classify re-imports as updates

- [47-02] 20-card subset per source (not full 110) for rendering matrix to keep 81-combo test suite fast
- [47-02] SuperGrid test is mount+render sanity check only (self-manages data via bridge)
- [47-02] TreeView tested with empty connections (all orphans) since connections load via bridge at runtime
- [Phase 47]: DedupEngine connection dedup: pre-check existing connections because SQLite UNIQUE ignores NULL via_card_id

### Pending Todos

None.

### Blockers/Concerns

- CSS content-visibility: auto requires Safari 18+ (iOS 18+) -- iOS 17 users get JS windowing only

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 47-03-PLAN.md (Source errors + dedup re-import regression -- 37 tests, ETLV-04/05)
Resume: Phase 47 complete (all 3 plans done). v4.2 milestone complete.
