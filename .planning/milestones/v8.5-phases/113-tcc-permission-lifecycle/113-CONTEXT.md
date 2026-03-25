# Phase 113: TCC Permission Lifecycle - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Exercise all four TCC permission state transitions (grant, deny, revoke mid-import, state-change notification) via the `__mockPermission` bridge hook. Effects must be observable in the UI. Covers all three native adapters (Notes, Reminders, Calendar). Test-only phase — no production code changes.

</domain>

<decisions>
## Implementation Decisions

### Spec organization
- Single spec file: `e2e/tcc-permissions.spec.ts` with 3 describe blocks:
  1. `describe('grant')` — mock-grant, trigger adapter, assert cards appear
  2. `describe('deny')` — mock-deny, trigger adapter, assert error UI + zero cards
  3. `describe('revoke-mid-import')` — grant then revoke during import, assert graceful partial handling
- Consistent with Phase 110/112 single-spec pattern
- Shared setup: `resetDatabase()` + `mockPermission()` cleanup between tests

### Adapter coverage
- All three native adapters tested: Notes, Reminders, Calendar
- 3 paths x 3 adapters = 9 test cases (within each describe block, one it() per adapter)
- Phase 111 covers adapter-specific logic (schema branching, protobuf, auto-connections)
- Phase 113 focuses on the permission lifecycle being correct across all adapters

### Revoke-mid-import simulation
- Set `mockPermission` to 'granted', start import with large fixture
- Immediately set `mockPermission` to 'revoked' during the import
- Assert ImportToast reflects partial state and no crash
- Timing is best-effort — the key assertion is graceful handling, not exact interruption point
- The `__mock_permission_{adapter}` window key convention (from Phase 109/HarnessShell) is the mechanism

### Deny path UI assertions
- Assert ImportToast shows error state (CSS class or visible text containing 'denied'/'permission')
- Assert `queryAll()` card count is 0 for that adapter's source
- Does NOT lock down exact error message wording — just error visibility + zero data

### Claude's Discretion
- Fixture card count for revoke-mid-import (needs to be large enough for timing window)
- Exact CSS selectors for ImportToast error state detection
- Whether to use `page.waitForSelector()` or `expect(locator).toBeVisible()` pattern
- Cleanup ordering between tests (mockPermission revoke vs resetDatabase)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — TCC-01 through TCC-04 success criteria (v8.5 ETL E2E requirements)

### Phase 109 context (upstream decisions)
- `.planning/phases/109-etl-test-infrastructure/109-CONTEXT.md` — `__mockPermission` bridge hook design, E2E helper architecture

### Mock permission implementation
- `src/views/pivot/harness/HarnessShell.ts` lines 133-163 — `mockPermission(adapter, state)` and `getPermission(adapter)` on `window.__harness`, cleanup in dispose()
- Convention: `window.__mock_permission_{adapter}` key, 'revoked' deletes key

### E2E infrastructure
- `e2e/helpers/etl.ts` — `importNativeCards`, `assertCatalogRow`, `resetDatabase`
- `e2e/helpers/isometry.ts` — `waitForAppReady`, `getCardCount`
- `e2e/helpers/harness.ts` — HarnessShell programmatic API pattern

### Native adapters (permission check points)
- `src/worker/handlers/etl-import-native.handler.ts` — Where permission is checked before adapter read

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `window.__harness.mockPermission(adapter, state)`: Already implemented — set 'granted', 'denied', or 'revoked'
- `window.__harness.getPermission(adapter)`: Query current mock state
- `importNativeCards(page, cards, sourceType)`: Trigger import through bridge
- `resetDatabase(page)`: Test isolation

### Established Patterns
- `window.__mock_permission_{adapter}` key convention (Phase 109 decision)
- 'revoked' state deletes the key (vs 'granted'/'denied' which set it)
- HarnessShell `dispose()` cleans up all `__mock_permission_*` keys
- Sequential E2E execution with shared browser context

### Integration Points
- `e2e/` directory — New `tcc-permissions.spec.ts`
- `window.__harness.mockPermission` — Already wired, no new bridge code needed
- Native adapter permission check in `etl-import-native.handler.ts` — reads `window.__mock_permission_{adapter}`

</code_context>

<specifics>
## Specific Ideas

- The 3 adapter names for mockPermission: 'notes', 'reminders', 'calendar' (matching HarnessShell convention)
- Revoke-mid-import needs a large enough fixture to create a timing window — 100+ cards should suffice
- ImportToast error state should be observable within the existing toast/notification UI pattern

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 113-tcc-permission-lifecycle*
*Context gathered: 2026-03-23*
