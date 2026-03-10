# Project Research Summary

**Project:** Isometry v5.3 Dynamic Schema
**Domain:** Schema introspection, dynamic allowlists, configurable LATCH mappings, user display preferences, bug fixes
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

v5.3 is a consolidation milestone that replaces 15 hardcoded schema reflections scattered across 8 files with a single runtime-introspected source of truth: a SchemaProvider backed by `PRAGMA table_info(cards)`. This is not feature-building -- it is infrastructure maturation. The existing codebase has three synchronized but disconnected schema representations (TypeScript union types in types.ts, frozen Sets in allowlist.ts, and a Record mapping in latch.ts) that must be updated in lockstep whenever the schema evolves. SchemaProvider eliminates this class of maintenance errors entirely by deriving all field metadata from the database itself at startup.

The technology requirements are minimal. Every capability needed already exists in the stack: sql.js supports PRAGMA statements (proven by `PRAGMA foreign_keys = ON` in Database.ts and `PRAGMA table_info` in NotesAdapter.swift), the ui_state table handles user preference persistence (used by 8+ providers/explorers), and CSS resets fix the SVG letter-spacing inheritance bug. Zero new npm dependencies. The estimated scope is 650-1,100 new TypeScript lines plus 200-350 modified lines across 15 existing files. Two bug fixes (SVG letter-spacing CSS and deleted_at null safety) are independently shippable and low-risk.

The primary risk is a bootstrap race condition: SchemaProvider must be populated before StateManager.restore() validates persisted field names, but both depend on Worker initialization. The mitigation is clear -- include PRAGMA results in the Worker's existing `ready` message payload, making schema availability synchronous with the init handshake. A secondary risk is the dual-context problem: Worker and main thread share no module instances, so both need independent dynamic validation sets populated from the same PRAGMA source. All 17 pitfalls have documented prevention strategies with exact file/line references.

## Key Findings

### Recommended Stack

No new dependencies. v5.3 is implemented entirely with the existing TypeScript 5.9 / sql.js 1.14 / D3 v7.9 / Vitest 4.0 stack. The key sql.js capability is `PRAGMA table_info(table_name)`, which returns structured column metadata (name, type, nullability, default, primary key) -- a core SQLite feature fully supported by the custom FTS5 WASM build.

**Core technologies (unchanged):**
- **sql.js 1.14 (FTS5 WASM):** PRAGMA table_info introspection for runtime schema discovery -- already proven in codebase
- **TypeScript 5.9 (strict):** Branded string types + runtime validation for type-safe dynamic fields
- **ui_state table:** Tier 2 persistence for LATCH overrides, axis-enabled sets, display preferences -- established PersistableProvider pattern

**Explicitly rejected:** TypeORM/Drizzle/Kysely (violates D-003), JSON Schema validators (PRAGMA gives everything needed), reactive state libraries (violates D-009), feature flag services (SchemaProvider handles it).

### Expected Features

**Must have (table stakes):**
- SVG letter-spacing bug fix -- CSS `letter-spacing: normal` reset on SVG text elements to prevent WebKit rendering artifacts
- deleted_at optional handling -- null safety audit across 12+ query paths that hardcode `deleted_at IS NULL`
- SchemaProvider with PRAGMA introspection -- runtime column discovery at startup, field classification, typed accessors
- Replace 15 hardcoded field lists with SchemaProvider -- allowlist.ts, types.ts, latch.ts, PropertiesExplorer, LatchExplorers, CalcExplorer, ProjectionExplorer, SuperGridQuery all read from one source
- User-configurable LATCH mappings -- override heuristic family assignments via ui_state persistence

**Should have (differentiators):**
- Automatic LATCH classification heuristic -- no other local-first tool auto-classifies columns into L/A/T/C/H families based on name patterns and type affinities
- Schema-driven CalcExplorer -- aggregate function options auto-adapt to column types (numeric gets SUM/AVG, text gets COUNT only)
- Self-healing allowlists -- schema migrations auto-extend field validation without code changes

**Defer (v6+):**
- View presets / saved configurations -- named axis+filter+sort snapshots (significant scope)
- EAV table for arbitrary extra fields -- D-008 explicitly defers
- Custom column types / semantic typing -- per-field renderers are massive scope
- ALTER TABLE from UI -- schema is read-only, controlled by ETL imports

### Architecture Approach

SchemaProvider is a singleton initialized once at Worker startup via PRAGMA, broadcasting column metadata to the main thread via the existing WorkerNotification protocol. The transformation is surgical: only the *source* of field metadata changes (from compile-time constants to a runtime singleton), while every downstream consumer (providers, validators, explorers, query builders) continues using the same interfaces. The critical insight is that 15 hardcoded schema reflections across 8 files all derive from the same 25-column cards table -- SchemaProvider consolidates them into one authoritative read.

**Major components:**
1. **SchemaProvider (NEW)** -- Runtime schema introspection, LATCH classification, field eligibility (axis/filter/numeric), display names. Worker-side populates from PRAGMA; main-thread receives via notification.
2. **allowlist.ts (MODIFIED)** -- Validation functions delegate to SchemaProvider with hardcoded fallback during bootstrap. SQL safety boundary (D-003) preserved -- same validate/assert pattern, different backing data.
3. **Worker init (MODIFIED)** -- Reads PRAGMA table_info(cards) during initialize(), includes column metadata in ready message payload. Worker-side validation set populated before any handler processes requests.
4. **UI Explorers (MODIFIED)** -- PropertiesExplorer, LatchExplorers, ProjectionExplorer, CalcExplorer subscribe to SchemaProvider and render dynamic field lists instead of iterating hardcoded constants.

### Critical Pitfalls

1. **Bootstrap race condition (P1)** -- StateManager.restore() calls validateAxisField() before SchemaProvider is populated. Fix: include PRAGMA results in the Worker's `ready` message so schema is available synchronously before any provider restore. Hardcoded defaults serve as fallback floor.

2. **Worker/main-thread dual-context stale validation (P2)** -- Worker and main thread are separate JS contexts sharing no module instances. Main-thread SchemaProvider updates do not propagate to Worker. Fix: Worker populates its own module-level validation Set from PRAGMA at init, before sending `ready`.

3. **SQL injection through dynamic field names (P3)** -- 15+ SQL interpolation sites across 7 files accept field names that will now come from runtime introspection. Fix: SchemaProvider rejects any column name containing characters outside `[a-zA-Z0-9_]` at introspection time, before the name enters any validation pool.

4. **Persisted state references nonexistent fields (P4)** -- ui_state JSON may contain field names from a prior schema version. FilterProvider.setState() throws and resets ALL state; PAFVProvider.setState() defers validation and crashes at render time. Fix: field migration step in StateManager.restore() filters out unknown fields before setState().

5. **TypeScript union desync from runtime allowlist (P5)** -- AxisField/FilterField compile-time unions reject dynamically-discovered fields. Fix: widen AxisMapping.field to `string` (the flow-through type), keep AxisField union for known literals, use `validateAxisField()` as the type-narrowing boundary.

## Implications for Roadmap

Based on combined research, the suggested 5-phase structure follows a strict dependency chain where each phase unlocks the next. Bug fixes are independent. SchemaProvider is the foundation. Dynamic integration is the bulk work. User configuration is the payoff.

### Phase 1: Bug Fixes (SVG letter-spacing + deleted_at)
**Rationale:** Independent of SchemaProvider work, delivers immediate user-visible value, builds confidence before the larger refactor.
**Delivers:** Correct SVG text rendering in all browsers; null-safe deleted_at handling across 12+ query paths.
**Addresses:** Table stakes features #1 and #2 from FEATURES.md.
**Avoids:** P9 (deleted_at IS NULL in 12+ paths), P11 (SVG letter-spacing cross-browser rendering).
**Estimated scope:** 10-20 CSS lines + 20-50 TS lines. Trivial risk.

### Phase 2: SchemaProvider Core + Worker Integration
**Rationale:** Foundation for all subsequent phases. Nothing can consume dynamic schema until SchemaProvider exists and the Worker broadcasts column metadata.
**Delivers:** SchemaProvider class with PRAGMA introspection, LATCH classification heuristic, field eligibility accessors. Worker init modification to read PRAGMA and include results in `ready` message. WorkerBridge notification handler.
**Addresses:** Table stakes feature #3 (SchemaProvider with PRAGMA introspection).
**Avoids:** P1 (bootstrap race -- PRAGMA in ready message eliminates timing gap), P2 (Worker-side stale set -- populate at init), P3 (SQL injection -- regex sanitize column names at introspection), P14 (column order assumption -- name-keyed Map).
**Estimated scope:** 200-350 TS lines new + 30-50 TS modified. Medium risk -- bootstrap timing is the key concern.

### Phase 3: Dynamic Schema Integration
**Rationale:** The core deliverable. Replaces all 15 hardcoded patterns with SchemaProvider reads. Must happen atomically per-module to avoid split-brain (some paths dynamic, others hardcoded).
**Delivers:** allowlist.ts delegation, types.ts adjustment, latch.ts dynamic mapping, PropertiesExplorer/ProjectionExplorer/CalcExplorer/LatchExplorers/SuperGridQuery all reading from SchemaProvider.
**Addresses:** Table stakes feature #4 (replace hardcoded field lists), differentiator features (schema-driven CalcExplorer, self-healing allowlists).
**Avoids:** P5 (type desync -- widen AxisMapping.field), P6 (LATCH map returns undefined -- SchemaProvider fallback), P7 (VIEW_DEFAULTS hardcoded -- schema-aware defaults), P10 (NUMERIC/TIME sets stale -- delete per-module sets), P16 (fetchDistinctValuesWithCounts lacks validation), P17 (CalcExplorer display names undefined).
**Estimated scope:** 250-450 TS modified across 15 files. Medium risk -- allowlist.ts is the highest-risk change (9+ importing files, load-bearing security boundary).

### Phase 4: State Persistence Migration
**Rationale:** Must follow dynamic integration because field migration logic needs SchemaProvider to validate which fields still exist.
**Delivers:** StateManager.restore() field migration step, FilterProvider/PAFVProvider graceful degradation for unknown fields, AliasProvider fix for dynamic fields.
**Addresses:** Robustness for schema evolution across sessions.
**Avoids:** P4 (persisted state references nonexistent fields), P15 (user LATCH overrides reference nonexistent fields).
**Estimated scope:** 60-100 TS lines. Low risk -- follows established patterns.

### Phase 5: User-Configurable LATCH Mappings + Preferences
**Rationale:** Requires all prior phases -- LATCH overrides only make sense when the dynamic classification exists, the UI reads from SchemaProvider, and persistence handles field migration.
**Delivers:** LATCH family override persistence in ui_state, axis-enabled set persistence, display preference persistence, PropertiesExplorer toggle state linked to SchemaProvider.
**Addresses:** Table stakes feature #5 (user-configurable LATCH), user display preferences.
**Avoids:** P8 (histogram vs chart allowlist distinction -- two-tier field classification), P12 (unbounded cardinality fields -- threshold check before chip rendering), P13 (subscriber notification storm -- microtask batching).
**Estimated scope:** 100-230 TS + 30 CSS lines. Low risk -- extends existing ui_state patterns.

### Phase Ordering Rationale

- Bug fixes first because they are independent, trivial risk, and ship immediate value while SchemaProvider work is underway
- SchemaProvider second because every subsequent phase depends on runtime introspection being available
- Dynamic integration third because the query/validation layer must consume dynamic schema before the UI can configure it -- this is the bulk of the work and the core deliverable
- State persistence fourth because field migration logic needs SchemaProvider to know which fields are valid
- LATCH configuration last because it is the user-facing payoff that depends on the entire plumbing stack being dynamic

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (SchemaProvider):** Bootstrap timing sequence needs verification. Exact interaction between Worker `ready` message, StateManager.restore(), and provider subscription must be traced through the init code path. The ARCHITECTURE.md inventory provides the map, but the execution order needs runtime validation.
- **Phase 3 (Dynamic Integration):** The allowlist.ts refactor touches a load-bearing security boundary (D-003). The `classifyError()` function in worker.ts matches on "SQL safety violation:" error message text -- this string is load-bearing. Each of the 15 migration points should be tested individually.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Bug Fixes):** CSS reset and null guard audit. Well-documented patterns, no unknowns.
- **Phase 4 (State Persistence):** Follows established StateManager/PersistableProvider patterns from v0.5+.
- **Phase 5 (LATCH Config):** Follows ui_state persistence pattern used by 8+ existing providers/explorers.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; every capability verified in existing codebase with exact line references |
| Features | HIGH | All features are refactoring of existing patterns, not greenfield; 15 hardcoded locations inventoried with exact file/line in ARCHITECTURE.md |
| Architecture | HIGH | All integration points identified by direct source code reading; data flow diagrams reflect actual module boundaries |
| Pitfalls | HIGH | 17 pitfalls identified with exact file/line references and concrete prevention strategies; critical pitfalls have detection test descriptions |

**Overall confidence:** HIGH

### Gaps to Address

- **TypeScript union strategy:** Whether to keep FilterField/AxisField as literal unions with string overloads at boundaries, or replace with branded string types. Recommendation: keep literals + widen flow-through types (AxisMapping.field). Decision should be finalized at Phase 3 planning.
- **connections table introspection:** ARCHITECTURE.md focuses on `cards` table only. Whether SchemaProvider should also introspect `connections` is deferred. Recommendation: cards only for v5.3 since connections schema is simpler and more stable.
- **LATCH override scope:** Whether LATCH mapping overrides are global or per-view. Recommendation: global for v5.3 -- per-view adds complexity for marginal value.
- **Worker-side validation architecture:** Whether to use `allowlist.ts` `setDynamicFields()` function or a Worker-local SchemaProvider instance. Recommendation: module-level Set populated from PRAGMA (simpler, no class needed in Worker context).
- **Bootstrap timing verification:** The exact sequence of Worker `ready` -> StateManager.restore() -> provider subscription needs runtime tracing to confirm PRAGMA results arrive before first validation call.

## Sources

### Primary (HIGH confidence)
- [SQLite PRAGMA table_info documentation](https://sqlite.org/pragma.html) -- column introspection API, stable across all SQLite versions
- [sql.js GitHub repository](https://github.com/sql-js/sql.js/) -- WASM SQLite wrapper, PRAGMA fully supported
- Direct codebase analysis: 15+ source files read with exact line references (see ARCHITECTURE.md, PITFALLS.md for full inventory)
- Existing codebase: Database.ts line 66 (`PRAGMA foreign_keys = ON` confirms PRAGMA execution), NotesAdapter.swift line 168 (`PRAGMA table_info` in production)

### Secondary (MEDIUM confidence)
- [Metabase Semantic Types](https://www.metabase.com/docs/latest/data-modeling/semantic-types) -- auto-detection + user override pattern for LATCH classification design
- [Airtable Field Type Overview](https://support.airtable.com/docs/field-type-overview) -- user-configurable field types pattern
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) -- allowlist validation best practices
- [MDN SVG letter-spacing](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/letter-spacing) -- SVG text CSS inheritance behavior

### Tertiary (LOW confidence)
- [Cross-browser SVG letter-spacing alternatives](https://codepen.io/aamarks/pen/JdxGxW) -- documents the inheritance issue and fix patterns (CodePen, single source)

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
