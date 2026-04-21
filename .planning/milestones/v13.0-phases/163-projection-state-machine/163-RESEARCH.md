# Phase 163: Projection State Machine - Research

**Researched:** 2026-04-21
**Domain:** Pure TypeScript state machine — immutable Projection type + five transition functions
**Confidence:** HIGH

## Summary

Phase 163 is a pure TypeScript module (`src/superwidget/projection.ts`) with no DOM coupling, no external library dependencies, and no async concerns. The full design is locked in CONTEXT.md. The primary implementation challenge is correctly upholding the reference equality contract: no-op transitions (invalid input or state that would not change) MUST return the exact same object reference that was passed in, not a structurally equal copy. This is load-bearing for Phase 164's render bail-out logic.

The `Projection` type follows the existing `ViewType` / `PAFVState` string literal union pattern from `src/providers/types.ts`. Tests go in `tests/superwidget/projection.test.ts` with `// @vitest-environment jsdom` omitted (no DOM needed — node environment is fine for pure data tests). The test file covers all seven PROJ requirements with explicit `toBe` (reference equality) assertions for no-op cases.

**Primary recommendation:** Implement `projection.ts` as a pure module exporting the `Projection` type, three literal union types, a `ValidationResult` discriminated union, and five standalone functions. Use early-return guards that return the input reference unchanged when preconditions fail or the transition is a no-op. Never construct a new object unless the state actually changes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `CanvasType`, `CanvasBinding`, and `ZoneRole` are string literal unions (e.g., `type CanvasType = 'Explorer' | 'View' | 'Editor'`). Matches existing `ViewType` union pattern in `views/types.ts`.
- **D-02:** `enabledTabIds` is `ReadonlyArray<string>`. Simpler JSON round-trip than Set (PROJ-01 requires JSON serialization without data loss).
- **D-03:** Closed literal union for `CanvasType` — exactly 3 values. When v13.1+ adds real canvases, widen the union and let TypeScript catch all switch sites.
- **D-04:** Standalone exported functions: `switchTab(proj, tabId)`, `setCanvas(proj, canvasId, type)`, `setBinding(proj, binding)`, `toggleTabEnabled(proj, tabId)`, `validateProjection(proj)`. No class wrapper. Matches the "pure functions in projection.ts" handoff decision.
- **D-05:** `validateProjection` returns first violation only: `{valid: false, reason: string}` or `{valid: true}`. Singular `reason` field per PROJ-06 spec.
- **D-06:** Transition functions guard their own preconditions and return the original reference on invalid input (e.g., `setBinding` with Bound on non-View returns original). This IS the reference equality contract — not a separate concern.

### Claude's Discretion
- Exact field names for `Projection` type (as long as the 6 fields from PROJ-01 are present)
- `ValidationResult` type shape details
- Whether to export a `createProjection` factory or just use object literals in tests
- Internal helper functions for reference equality comparison

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROJ-01 | Projection type defines canvasType, canvasBinding, zoneRole, canvasId, activeTabId, enabledTabIds | Type definition section; ReadonlyArray for enabledTabIds satisfies JSON round-trip |
| PROJ-02 | `switchTab` returns original reference on invalid tabId (reference equality contract) | Early-return guard pattern; toBe assertion in test |
| PROJ-03 | `setCanvas` transitions projection to new canvasId and canvasType | Only PROJ requirement that creates a new object — spread pattern |
| PROJ-04 | `setBinding` rejects Bound on non-View canvas types (returns original reference) | Guard: `if (binding === 'Bound' && proj.canvasType !== 'View') return proj` |
| PROJ-05 | `toggleTabEnabled` returns original reference when state would not change | Guard checks current enabled state before constructing new array |
| PROJ-06 | `validateProjection` returns `{valid, reason?}` and never throws; catches all four invalid states | Discriminated union ValidationResult; first-violation return; no throws |
| PROJ-07 | All transition functions are pure (same input produces same output, no side effects) | Module-level pure functions; no captured mutable state |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 (strict) | Type definitions and function implementations | Project language |
| Vitest | 4.0.18 | Unit tests for all 7 PROJ requirements | Project test runner |

No additional libraries needed. This phase is pure TypeScript with zero external dependencies.

**Environment Availability:** Step 2.6 SKIPPED — this is a pure code/config change with no external tool dependencies.

## Architecture Patterns

### Recommended Project Structure

New files this phase:
```
src/superwidget/
├── SuperWidget.ts          # Existing (Phase 162)
├── projection.ts           # NEW: Projection type + 5 transition functions

tests/superwidget/
├── SuperWidget.test.ts     # Existing (Phase 162)
├── projection.test.ts      # NEW: all 7 PROJ requirement tests
```

### Pattern 1: String Literal Union (follows ViewType precedent)

**What:** Closed union of known string values using `type` keyword
**When to use:** All three type dimensions — CanvasType, CanvasBinding, ZoneRole
**Example (from `src/providers/types.ts`):**
```typescript
export type ViewType =
  | 'list'
  | 'grid'
  | 'kanban'
  | 'calendar'
  | 'timeline'
  | 'gallery'
  | 'network'
  | 'tree'
  | 'supergrid';
```

Apply the same pattern for the three new union types:
```typescript
export type CanvasType = 'Explorer' | 'View' | 'Editor';
export type CanvasBinding = 'Bound' | 'Unbound';
export type ZoneRole = 'primary' | 'secondary' | 'tertiary';  // Claude's discretion on values
```

### Pattern 2: Immutable Projection Type with ReadonlyArray

**What:** Interface with all readonly fields; enabledTabIds as ReadonlyArray for JSON safety
**When to use:** The core Projection type definition
```typescript
export interface Projection {
  readonly canvasType: CanvasType;
  readonly canvasBinding: CanvasBinding;
  readonly zoneRole: ZoneRole;
  readonly canvasId: string;
  readonly activeTabId: string;
  readonly enabledTabIds: ReadonlyArray<string>;
}
```

### Pattern 3: Reference Equality Guard (THE critical pattern)

**What:** Return the exact input reference when the transition is invalid or a no-op
**When to use:** All four guarded transition functions
```typescript
export function switchTab(proj: Projection, tabId: string): Projection {
  // Guard: invalid tab → original reference
  if (!proj.enabledTabIds.includes(tabId)) return proj;
  // Guard: already active → original reference (no-op)
  if (proj.activeTabId === tabId) return proj;
  // Only here do we create a new object
  return { ...proj, activeTabId: tabId };
}
```

The key discipline: `return proj` (exact reference) not `return { ...proj }` (new object with same values). Tests MUST use `toBe` not `toEqual` for no-op cases.

### Pattern 4: Discriminated Union for ValidationResult

**What:** Two-variant type with `valid` discriminant field
**When to use:** validateProjection return type
```typescript
export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };
```

### Pattern 5: First-Violation Validation Order

**What:** validateProjection checks conditions in a fixed order and returns on first failure
**When to use:** The four invalid states from PROJ-06 spec
```typescript
export function validateProjection(proj: Projection): ValidationResult {
  if (!proj.enabledTabIds.includes(proj.activeTabId))
    return { valid: false, reason: '...' };
  if (proj.canvasBinding === 'Bound' && proj.canvasType !== 'View')
    return { valid: false, reason: '...' };
  if (proj.canvasId === '')
    return { valid: false, reason: '...' };
  if (proj.enabledTabIds.length === 0)
    return { valid: false, reason: '...' };
  return { valid: true };
}
```

### Anti-Patterns to Avoid

- **Spread on no-op:** `return { ...proj }` when input is invalid — creates a new object, breaks reference equality contract and Phase 164 bail-out rendering
- **Class wrapper:** Don't wrap transition functions in a class — D-04 mandates standalone functions
- **Set for enabledTabIds:** D-02 mandates ReadonlyArray for JSON round-trip safety (Set does not serialize to JSON)
- **Throwing on invalid input:** Transition functions return original reference; validateProjection returns `{valid: false}` — neither throws

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep equality comparison | Custom recursive equals | Direct field comparison or `===` on primitives | This phase only needs reference equality (===) or specific field checks — no deep equality needed |
| Immutability enforcement | Proxy-based freeze | `readonly` TypeScript fields + `ReadonlyArray<>` | TypeScript strict mode catches mutation attempts at compile time; runtime freeze adds overhead for no test coverage benefit |

## Common Pitfalls

### Pitfall 1: Structural Equality Trap
**What goes wrong:** `return { ...proj }` on invalid input passes `toEqual` tests but fails `toBe` tests. Phase 164 render bail-out will call `commitProjection` on every DOM event instead of bailing out.
**Why it happens:** Spread syntax always allocates a new object, even when no fields changed.
**How to avoid:** Every guard clause `return proj` (the input variable directly). Never spread in a guard path.
**Warning signs:** Test uses `toEqual` instead of `toBe` for no-op case — that test cannot catch this bug.

### Pitfall 2: enabledTabIds mutation
**What goes wrong:** `toggleTabEnabled` uses `Array.prototype.push` or `splice` on `proj.enabledTabIds` in the mutating branch.
**Why it happens:** TypeScript's `ReadonlyArray<string>` prevents compile-time mutation, but the underlying array is still mutable if cast via `as`.
**How to avoid:** Always construct a new array for the mutating case: `[...proj.enabledTabIds, tabId]` or `proj.enabledTabIds.filter(id => id !== tabId)`.
**Warning signs:** Existing array reference appears in both old and new Projection values.

### Pitfall 3: switchTab allows disabled tabs
**What goes wrong:** `switchTab` checks `enabledTabIds.includes(tabId)` but forgets that the current `activeTabId` might not be in `enabledTabIds` (invalid state). Or it allows switching to a tab not in `enabledTabIds`.
**Why it happens:** The guard only checks `enabledTabIds` membership — which is correct per PROJ-02. A disabled tabId switch returns original reference.
**How to avoid:** Guard is `!proj.enabledTabIds.includes(tabId)` → return proj. This is the complete guard.

### Pitfall 4: validateProjection check order matters for PROJ-06
**What goes wrong:** The four checks from PROJ-06 are tested independently by the acceptance criteria. The first-violation return means whichever check runs first will mask later violations.
**Why it happens:** Implementation chose arbitrary ordering.
**How to avoid:** Document the fixed check order in a comment. Tests that check specific reasons must provide inputs where only ONE condition is violated; otherwise results depend on ordering.

## Code Examples

### Full module skeleton
```typescript
// src/superwidget/projection.ts
// Isometry v13.0 — Phase 163 Projection State Machine
// Pure transition functions over the Projection type.
// Reference equality contract: no-op transitions return the EXACT input reference.
//
// Requirements: PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06, PROJ-07

export type CanvasType = 'Explorer' | 'View' | 'Editor';
export type CanvasBinding = 'Bound' | 'Unbound';
export type ZoneRole = /* Claude's discretion */;

export interface Projection {
  readonly canvasType: CanvasType;
  readonly canvasBinding: CanvasBinding;
  readonly zoneRole: ZoneRole;
  readonly canvasId: string;
  readonly activeTabId: string;
  readonly enabledTabIds: ReadonlyArray<string>;
}

export type ValidationResult = { valid: true } | { valid: false; reason: string };

export function switchTab(proj: Projection, tabId: string): Projection { ... }
export function setCanvas(proj: Projection, canvasId: string, type: CanvasType): Projection { ... }
export function setBinding(proj: Projection, binding: CanvasBinding): Projection { ... }
export function toggleTabEnabled(proj: Projection, tabId: string): Projection { ... }
export function validateProjection(proj: Projection): ValidationResult { ... }
```

### Test pattern for reference equality (PROJ-02)
```typescript
// tests/superwidget/projection.test.ts
it('PROJ-02: switchTab with invalid tabId returns original reference', () => {
  const proj: Projection = {
    canvasType: 'View',
    canvasBinding: 'Unbound',
    zoneRole: 'primary',
    canvasId: 'canvas-1',
    activeTabId: 'tab-1',
    enabledTabIds: ['tab-1', 'tab-2'],
  };
  const result = switchTab(proj, 'tab-99'); // not in enabledTabIds
  expect(result).toBe(proj);               // reference equality, not toEqual
});
```

### Test pattern for JSON round-trip (PROJ-01)
```typescript
it('PROJ-01: Projection round-trips through JSON serialization without data loss', () => {
  const proj: Projection = {
    canvasType: 'View',
    canvasBinding: 'Bound',
    zoneRole: 'primary',
    canvasId: 'canvas-1',
    activeTabId: 'tab-1',
    enabledTabIds: ['tab-1', 'tab-2'],
  };
  const restored = JSON.parse(JSON.stringify(proj)) as Projection;
  expect(restored).toEqual(proj);
  expect(Array.isArray(restored.enabledTabIds)).toBe(true);
});
```

## Runtime State Inventory

SKIPPED — greenfield phase. No rename, refactor, or migration involved. No runtime state to inventory.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` |
| Quick run command | `npm test -- tests/superwidget/projection.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROJ-01 | Projection has 6 fields, JSON round-trip lossless | unit | `npm test -- tests/superwidget/projection.test.ts` | Wave 0 |
| PROJ-02 | switchTab invalid tabId returns original `===` reference | unit | same | Wave 0 |
| PROJ-03 | setCanvas transitions canvasId and canvasType | unit | same | Wave 0 |
| PROJ-04 | setBinding Bound on non-View returns original `===` reference | unit | same | Wave 0 |
| PROJ-05 | toggleTabEnabled no-change returns original `===` reference | unit | same | Wave 0 |
| PROJ-06 | validateProjection catches 4 invalid states, never throws | unit | same | Wave 0 |
| PROJ-07 | All functions produce same output for same input | unit (repeated calls) | same | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- tests/superwidget/projection.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/superwidget/projection.test.ts` — covers PROJ-01 through PROJ-07. File does not exist yet.

## Sources

### Primary (HIGH confidence)

- Direct code read: `src/superwidget/SuperWidget.ts` — Phase 162 substrate, slot structure
- Direct code read: `src/providers/types.ts` — ViewType union pattern to follow
- Direct code read: `src/providers/PAFVProvider.ts` — immutable state + pure function pattern
- Direct code read: `tests/superwidget/SuperWidget.test.ts` — test structure and conventions
- Direct code read: `.planning/codebase/CONVENTIONS.md` — naming, formatting, TypeScript config
- Direct code read: `.planning/codebase/TESTING.md` — test framework, environment annotations
- Direct code read: `.planning/phases/163-projection-state-machine/163-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)

None required — all research resolved from project source files.

### Tertiary (LOW confidence)

None.

## Project Constraints (from CLAUDE.md)

- **Think before coding:** State assumptions explicitly; push back if simpler approach exists
- **Simplicity first:** Minimum code that solves the problem; no speculative features
- **Surgical changes:** Touch only what the phase requires; don't improve adjacent code
- **TDD:** red-green-refactor; write failing tests before implementation
- **TypeScript strict:** All strict flags including `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **Biome formatting:** tabs, 120 char line width, single quotes, always semicolons
- **Named exports only:** No default exports
- **Test location:** `tests/superwidget/` (locked by v13.0 handoff — no colocated tests in src/)
- **Reference equality contract is load-bearing:** Treat as a safety-critical constraint, not a nice-to-have

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure TypeScript, no new libraries
- Architecture: HIGH — fully locked in CONTEXT.md with direct code references
- Pitfalls: HIGH — reference equality pitfall explicitly documented in STATE.md

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable — pure TypeScript, no external API dependencies)
