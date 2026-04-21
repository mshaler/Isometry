# Phase 165: Canvas Stubs + Registry - Research

**Researched:** 2026-04-21
**Domain:** TypeScript class stubs + module-level registry implementing CanvasComponent interface
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Dedicated `registry.ts` module with a module-level `Map<string, CanvasRegistryEntry>`. Exports `register(canvasId, entry)` for adding entries and `getCanvasFactory(): CanvasFactory` that returns a closure over the Map. SuperWidget never sees the Map — only receives the factory.
- **D-02:** `CanvasRegistryEntry` shape: `{ canvasType: CanvasType, create: (binding?: CanvasBinding) => CanvasComponent, defaultExplorerId?: string }`. Only View entries set `defaultExplorerId`. Minimal shape — extend in v13.1+ as needed.
- **D-03:** Explicit wiring point — a `registerAllStubs()` function (in a stubs barrel or registry.ts) called once during app init. No self-registering side effects on import. Clear, debuggable, easy to swap stubs for real canvases in v13.1+.
- **D-04:** ViewCanvasStub manages its own sidecar DOM. In Bound mode, `mount()` creates a child element with `data-sidecar` attribute. In Unbound mode, no sidecar element is created. Stub manages sidecar lifecycle internally.
- **D-05:** ViewCanvasStub constructor takes `binding: CanvasBinding` parameter. The registry factory closure captures binding from the Projection when creating the stub. On binding change, SuperWidget destroys + recreates (consistent with Phase 164's destroy-then-mount lifecycle).
- **D-06:** Stubs display their canvasType and canvasId as text content (e.g., `[Explorer: canvas-1]`). Data attributes (`data-canvas-type`, `data-render-count`) are the real contract; text is a debugging aid for Phase 166 integration testing.
- **D-07:** All files flat in `src/superwidget/`: `registry.ts`, `ExplorerCanvasStub.ts`, `ViewCanvasStub.ts`, `EditorCanvasStub.ts`. Matches existing flat pattern (projection.ts, SuperWidget.ts). Stub filenames contain "Stub" per CANV-07.
- **D-08:** Each stub file begins with a comment: `// STUB — placeholder for replacement in v13.1+` (per CANV-07).

### Claude's Discretion

- Exact `data-render-count` increment logic in stubs (increment on each mount() call per CANV-01)
- Whether `getCanvasFactory()` is called once at SuperWidget construction or lazily
- Internal structure of registerAllStubs() (loop vs individual calls)
- Whether EditorCanvasStub constructor takes binding param (it only supports Unbound, so could be hardcoded)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CANV-01 | ExplorerCanvasStub renders with `data-canvas-type="Explorer"`, canvasId text, and data-render-count | ExplorerCanvasStub class: mount() sets data-canvas-type, appends text, increments data-render-count. Follows existing data-attribute convention from SuperWidget slots. |
| CANV-02 | ViewCanvasStub renders with `data-canvas-type="View"` and supports Bound mode with `data-sidecar` child element | ViewCanvasStub: constructor takes CanvasBinding, mount() conditionally creates data-sidecar child. D-04/D-05 locked this design. |
| CANV-03 | EditorCanvasStub renders with `data-canvas-type="Editor"`, Unbound only | EditorCanvasStub: simplest stub — no sidecar, no binding parameter needed. |
| CANV-04 | Canvas registry maps canvasId to CanvasRegistryEntry with typed CanvasComponent interface | registry.ts module: Map<string, CanvasRegistryEntry>, register()/getCanvasFactory() exports. D-01/D-02 locked the shape. |
| CANV-05 | View registry entries include `defaultExplorerId` field declaring bound Explorer pairing | CanvasRegistryEntry.defaultExplorerId?: string, set only on View entries in registerAllStubs(). |
| CANV-06 | SuperWidget.ts references only CanvasComponent interface — zero references to concrete stub classes | SuperWidget.ts already only uses CanvasFactory type and CanvasComponent interface. Verified in source: no concrete class imports exist. Registry abstraction maintained by never importing stubs into SuperWidget.ts. |
| CANV-07 | Stubs are labeled in filename and top-of-file comment as stubs for replacement in v13.1+ | D-07: filenames contain "Stub". D-08: each file opens with `// STUB — placeholder for replacement in v13.1+`. |
</phase_requirements>

---

## Summary

Phase 165 is a pure TypeScript implementation task with no external dependencies. The work is: three stub classes implementing `CanvasComponent` (mount/destroy) and one registry module wiring them behind a `CanvasFactory` closure. All architectural decisions are locked via CONTEXT.md (D-01 through D-08). The phase has no runtime ambiguity — the existing codebase already defines `CanvasComponent`, `CanvasFactory`, `CanvasType`, and `CanvasBinding` in two well-understood files.

The critical invariant for CANV-06 is already satisfied by SuperWidget.ts's design: it only holds a `CanvasFactory` reference and calls it by canvasId string. The registry module is the only consumer that needs to know about concrete stub classes; SuperWidget.ts must never gain an import of any stub.

The `data-render-count` attribute on stub elements is distinct from the slot-level `data-render-count` managed by SuperWidget (which tracks slot re-renders). Stub `data-render-count` starts at 0 before mount and increments to 1 on first mount, 2 on second mount, etc. — scoped to the stub's root element, not the canvas slot element.

**Primary recommendation:** Implement all four files (three stubs + registry) flat in `src/superwidget/`. Write all tests under `tests/superwidget/` with `// @vitest-environment jsdom` annotation. Each stub test file is independent; registry tests exercise `register()`, `getCanvasFactory()`, and `registerAllStubs()` together.

---

## Standard Stack

No new dependencies. This phase uses only existing project infrastructure.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Types, classes | Project standard (strict mode) |
| Vitest | 4.0.18 | Test runner | Project standard |
| jsdom | via vitest | DOM in tests | Per-file `@vitest-environment jsdom` annotation |

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure (additions only)
```
src/superwidget/
├── projection.ts          # (exists) CanvasComponent, CanvasType, CanvasBinding
├── SuperWidget.ts         # (exists) CanvasFactory type, constructor injection
├── ExplorerCanvasStub.ts  # NEW — implements CanvasComponent, data-canvas-type="Explorer"
├── ViewCanvasStub.ts      # NEW — implements CanvasComponent, Bound/Unbound sidecar
├── EditorCanvasStub.ts    # NEW — implements CanvasComponent, data-canvas-type="Editor"
└── registry.ts            # NEW — Map<string,CanvasRegistryEntry>, register(), getCanvasFactory()

tests/superwidget/
├── SuperWidget.test.ts        # (exists)
├── projection.test.ts         # (exists)
├── commitProjection.test.ts   # (exists)
├── ExplorerCanvasStub.test.ts # NEW
├── ViewCanvasStub.test.ts     # NEW
├── EditorCanvasStub.test.ts   # NEW
└── registry.test.ts           # NEW
```

### Pattern 1: CanvasComponent Stub Class

Each stub follows the same skeleton. `_renderCount` is a private field incremented on each `mount()` call. The element created by `mount()` is stored as `_el` for `destroy()` to remove.

```typescript
// STUB — placeholder for replacement in v13.1+
// Isometry v13.0 — Phase 165 Canvas Stubs + Registry
// Requirements: CANV-01, CANV-07

import type { CanvasComponent } from './projection';

export class ExplorerCanvasStub implements CanvasComponent {
  private readonly _canvasId: string;
  private _el: HTMLElement | null = null;
  private _renderCount = 0;

  constructor(canvasId: string) {
    this._canvasId = canvasId;
  }

  mount(container: HTMLElement): void {
    this._renderCount += 1;
    const el = document.createElement('div');
    el.dataset['canvasType'] = 'Explorer';
    el.dataset['renderCount'] = String(this._renderCount);
    el.textContent = `[Explorer: ${this._canvasId}]`;
    this._el = el;
    container.appendChild(el);
  }

  destroy(): void {
    this._el?.remove();
    this._el = null;
  }
}
```

Key details:
- `data-canvas-type` is the acceptance-criteria attribute (CANV-01/02/03)
- `data-render-count` on the stub element tracks mount call count (separate from slot render count in SuperWidget)
- `destroy()` removes the element but does NOT reset `_renderCount` — successive mount/destroy/mount cycles should show count=2 on the second mount

### Pattern 2: ViewCanvasStub with Conditional Sidecar (CANV-02, D-04, D-05)

```typescript
// STUB — placeholder for replacement in v13.1+
import type { CanvasBinding, CanvasComponent } from './projection';

export class ViewCanvasStub implements CanvasComponent {
  private readonly _canvasId: string;
  private readonly _binding: CanvasBinding;
  private _el: HTMLElement | null = null;
  private _renderCount = 0;

  constructor(canvasId: string, binding: CanvasBinding) {
    this._canvasId = canvasId;
    this._binding = binding;
  }

  mount(container: HTMLElement): void {
    this._renderCount += 1;
    const el = document.createElement('div');
    el.dataset['canvasType'] = 'View';
    el.dataset['renderCount'] = String(this._renderCount);
    el.textContent = `[View: ${this._canvasId}]`;

    if (this._binding === 'Bound') {
      const sidecar = document.createElement('div');
      sidecar.dataset['sidecar'] = '';
      el.appendChild(sidecar);
    }

    this._el = el;
    container.appendChild(el);
  }

  destroy(): void {
    this._el?.remove();
    this._el = null;
  }
}
```

The sidecar is a child of the stub's root element, not a sibling in the canvas slot — D-04 says ViewCanvasStub manages its own sidecar DOM internally.

### Pattern 3: Registry Module (CANV-04, CANV-05, D-01, D-02, D-03)

```typescript
// Isometry v13.0 — Phase 165 Canvas Stubs + Registry
// Requirements: CANV-04, CANV-05, CANV-06
import type { CanvasBinding, CanvasComponent, CanvasType } from './projection';
import type { CanvasFactory } from './SuperWidget';

export interface CanvasRegistryEntry {
  canvasType: CanvasType;
  create: (binding?: CanvasBinding) => CanvasComponent;
  defaultExplorerId?: string;
}

const _registry = new Map<string, CanvasRegistryEntry>();

export function register(canvasId: string, entry: CanvasRegistryEntry): void {
  _registry.set(canvasId, entry);
}

export function getCanvasFactory(): CanvasFactory {
  return (canvasId: string): CanvasComponent | undefined => {
    const entry = _registry.get(canvasId);
    return entry?.create();
  };
}

export function getRegistryEntry(canvasId: string): CanvasRegistryEntry | undefined {
  return _registry.get(canvasId);
}
```

**Note on `getCanvasFactory` and binding:** The current `CanvasFactory` type in SuperWidget.ts is `(canvasId: string) => CanvasComponent | undefined`. It does not pass `binding` to the factory. This means the registry factory closure cannot directly pass binding to `ViewCanvasStub.create()` unless the registry entry's `create` function captures binding from somewhere else.

The resolution: `registerAllStubs()` (called at app init) registers stubs with a specific binding. If binding changes, SuperWidget destroys+recreates (D-05) — which means a new factory invocation. However, the factory only receives `canvasId`, not `binding`. The registry `create` function for View entries must therefore capture `binding` at registration time, or `registerAllStubs()` is called with the current projection's binding.

**Simpler interpretation consistent with D-03:** `registerAllStubs()` registers stubs with default bindings (e.g., `Unbound`). In Phase 165, the goal is to build the registry shape and stubs — the binding-change-triggers-recreate full wiring happens in Phase 166 integration tests. For Phase 165, `registerAllStubs()` can register View stubs with a fixed binding to satisfy tests.

This is in "Claude's Discretion" per CONTEXT.md.

### Pattern 4: registerAllStubs() wiring point (D-03)

```typescript
// In registry.ts or a separate stubs barrel (e.g., stubs.ts)
import { ExplorerCanvasStub } from './ExplorerCanvasStub';
import { ViewCanvasStub } from './ViewCanvasStub';
import { EditorCanvasStub } from './EditorCanvasStub';
import { register } from './registry';

export function registerAllStubs(): void {
  register('explorer-1', {
    canvasType: 'Explorer',
    create: () => new ExplorerCanvasStub('explorer-1'),
  });
  register('view-1', {
    canvasType: 'View',
    create: (binding = 'Unbound') => new ViewCanvasStub('view-1', binding),
    defaultExplorerId: 'explorer-1',
  });
  register('editor-1', {
    canvasType: 'Editor',
    create: () => new EditorCanvasStub('editor-1'),
  });
}
```

`registerAllStubs()` can live in `registry.ts` or a thin stubs barrel. Placing it in `registry.ts` avoids an extra file. It imports the concrete stubs — this is the ONLY place that imports them (CANV-06: SuperWidget.ts must never import stubs).

### Anti-Patterns to Avoid

- **Self-registering imports:** Do not put `register(...)` calls at module top-level in stub files. Side effects on import are banned (D-03). Always use explicit `registerAllStubs()`.
- **SuperWidget importing stubs:** SuperWidget.ts must never import `ExplorerCanvasStub`, `ViewCanvasStub`, or `EditorCanvasStub`. The registry abstraction only works if SuperWidget is isolated from concrete classes (CANV-06 is a CI-verifiable test assertion).
- **Resetting render count on destroy:** The `_renderCount` should persist across destroy/mount cycles within a single stub instance — it tracks total mount calls, not current-mount count.
- **Sidecar in wrong position:** The `data-sidecar` element must be a child of the stub's root element (managed internally by ViewCanvasStub), not appended as a sibling by SuperWidget.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| DOM element creation | Custom DOM helpers | `document.createElement` directly — stubs are simple enough |
| Type-safe registry | OOP registry class with generics | Module-level Map with typed interface — matches existing flat module pattern |

---

## Common Pitfalls

### Pitfall 1: CanvasFactory signature mismatch
**What goes wrong:** The `CanvasFactory` type is `(canvasId: string) => CanvasComponent | undefined`. If registry's `getCanvasFactory()` returns a function with a different signature (e.g., also takes binding), TypeScript strict mode will catch it but the error message may be confusing.
**Why it happens:** D-05 requires ViewCanvasStub to take binding, but CanvasFactory only passes canvasId.
**How to avoid:** The binding must be captured in the registry entry's `create` closure, not passed through CanvasFactory. The `create: (binding?: CanvasBinding) => CanvasComponent` signature in CanvasRegistryEntry handles this.
**Warning signs:** TypeScript error "Type '(canvasId: string, binding: CanvasBinding) => CanvasComponent' is not assignable to type 'CanvasFactory'"

### Pitfall 2: CANV-06 abstraction leak via transitive imports
**What goes wrong:** A test helper file or barrel exports a stub class and SuperWidget.ts transitively sees it.
**Why it happens:** Test helpers that wire registry + SuperWidget might import stubs and pass them.
**How to avoid:** Tests should call `registerAllStubs()` then `getCanvasFactory()` to build the factory — never pass stub instances directly to SuperWidget constructor in tests that verify CANV-06.
**Warning signs:** A test grep shows "ExplorerCanvasStub" appears as an import in SuperWidget.ts.

### Pitfall 3: data-render-count attribute type
**What goes wrong:** `el.dataset['renderCount']` is always a string; numeric comparisons fail with `===` against numbers.
**Why it happens:** HTMLElement dataset is `DOMStringMap` — all values are strings.
**How to avoid:** Store as `String(this._renderCount)`. Test assertions should use `toBe('1')` not `toBe(1)`. Follows the existing pattern in SuperWidget.ts lines 137, 161, 164.

### Pitfall 4: jsdom environment annotation missing
**What goes wrong:** Tests that create DOM elements fail with "document is not defined" when run in node environment.
**Why it happens:** Default Vitest environment is `node` for WASM compatibility.
**How to avoid:** Add `// @vitest-environment jsdom` as the first line of every stub/registry test file. Matches the pattern in `SuperWidget.test.ts` and `commitProjection.test.ts`.

### Pitfall 5: destroy() called before mount()
**What goes wrong:** `this._el?.remove()` in destroy() is safe (optional chaining), but tests that call destroy before mount should not throw.
**Why it happens:** SuperWidget calls destroy() defensively before mounting a new canvas (RNDR-04 pattern).
**How to avoid:** Initialize `_el = null` in constructor. The optional chain `this._el?.remove()` handles the null case cleanly.

---

## Code Examples

### Verifying CANV-06 in tests (registry abstraction)
```typescript
// Source: tests/superwidget/registry.test.ts (NEW)
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CANV-06: SuperWidget.ts has no concrete stub references', () => {
  it('CANV-06: SuperWidget.ts does not import ExplorerCanvasStub', () => {
    const src = readFileSync(
      resolve(__dirname, '../../src/superwidget/SuperWidget.ts'), 'utf-8'
    );
    expect(src).not.toContain('ExplorerCanvasStub');
    expect(src).not.toContain('ViewCanvasStub');
    expect(src).not.toContain('EditorCanvasStub');
  });
});
```

This is the same `readFileSync` pattern used in `SuperWidget.test.ts` (line 6-7, 17-18) for CSS assertions — well-established in this codebase.

### Verifying data-render-count increment (CANV-01)
```typescript
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { ExplorerCanvasStub } from '../../src/superwidget/ExplorerCanvasStub';

describe('CANV-01: ExplorerCanvasStub', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('CANV-01: data-render-count is "1" after first mount', () => {
    const stub = new ExplorerCanvasStub('canvas-1');
    stub.mount(container);
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset['renderCount']).toBe('1');
  });

  it('CANV-01: data-render-count increments on successive mount calls', () => {
    const stub = new ExplorerCanvasStub('canvas-1');
    stub.mount(container);
    stub.destroy();
    stub.mount(container);
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset['renderCount']).toBe('2');
  });
});
```

### Registry lookup (CANV-04, CANV-05)
```typescript
import { describe, expect, it, beforeEach } from 'vitest';
import { register, getCanvasFactory, getRegistryEntry } from '../../src/superwidget/registry';

describe('CANV-04: registry lookup', () => {
  it('CANV-04: unknown canvasId returns undefined without throwing', () => {
    const factory = getCanvasFactory();
    expect(() => factory('nonexistent')).not.toThrow();
    expect(factory('nonexistent')).toBeUndefined();
  });

  it('CANV-05: View entries expose defaultExplorerId', () => {
    // registerAllStubs() must be called first in a real integration scenario
    const entry = getRegistryEntry('view-1');
    expect(entry?.defaultExplorerId).toBe('explorer-1');
  });
});
```

**Note:** Registry tests need to call `registerAllStubs()` (or manually `register(...)`) in `beforeEach` — the module-level Map persists across tests in the same process. Tests should use isolated canvasId strings or clear the registry between tests if the registry exposes a clear mechanism.

**Registry test isolation concern:** The `_registry` Map is module-level state. If tests in the same file call `register()` with the same canvasId, later tests see stale state. Mitigation: use unique canvasIds per test, or export a `clearRegistry()` function for test use only. The planner should decide whether to export `clearRegistry()`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` |
| Quick run command | `npx vitest run tests/superwidget/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CANV-01 | ExplorerCanvasStub: data-canvas-type="Explorer", canvasId text, data-render-count increments | unit | `npx vitest run tests/superwidget/ExplorerCanvasStub.test.ts` | ❌ Wave 0 |
| CANV-02 | ViewCanvasStub: Bound mode creates data-sidecar child; Unbound mode has no sidecar | unit | `npx vitest run tests/superwidget/ViewCanvasStub.test.ts` | ❌ Wave 0 |
| CANV-03 | EditorCanvasStub: data-canvas-type="Editor", no sidecar | unit | `npx vitest run tests/superwidget/EditorCanvasStub.test.ts` | ❌ Wave 0 |
| CANV-04 | Registry: lookup by canvasId returns entry; unknown returns undefined without throw | unit | `npx vitest run tests/superwidget/registry.test.ts` | ❌ Wave 0 |
| CANV-05 | View entries expose defaultExplorerId | unit | `npx vitest run tests/superwidget/registry.test.ts` | ❌ Wave 0 |
| CANV-06 | SuperWidget.ts has zero concrete stub class references | static (readFileSync) | `npx vitest run tests/superwidget/registry.test.ts` | ❌ Wave 0 |
| CANV-07 | Stub filenames contain "Stub"; files open with stub comment | static (readFileSync) | `npx vitest run tests/superwidget/ExplorerCanvasStub.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/superwidget/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/superwidget/ExplorerCanvasStub.test.ts` — covers CANV-01, CANV-07
- [ ] `tests/superwidget/ViewCanvasStub.test.ts` — covers CANV-02
- [ ] `tests/superwidget/EditorCanvasStub.test.ts` — covers CANV-03, CANV-07
- [ ] `tests/superwidget/registry.test.ts` — covers CANV-04, CANV-05, CANV-06, CANV-07

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure TypeScript, existing Vitest infrastructure).

---

## Open Questions

1. **Registry test isolation: export `clearRegistry()` or not?**
   - What we know: Module-level Map persists across tests in the same Vitest worker process
   - What's unclear: Whether tests should share a pre-populated registry or reset between each test
   - Recommendation: Export `clearRegistry()` from `registry.ts` — test-only cleanup, clearly named, small surface area. Matches the pragmatic pattern used elsewhere in this codebase.

2. **Where does `registerAllStubs()` live?**
   - What we know: D-03 says it can be in "a stubs barrel or registry.ts"
   - What's unclear: Whether a separate `stubs.ts` barrel adds useful separation or unnecessary indirection
   - Recommendation: Put `registerAllStubs()` in `registry.ts` — it reduces files, and registry.ts already owns the Map. A separate `stubs.ts` would be a thin file with a single export, adding a file for no real gain. CANV-06 is what matters: stub class names must not appear in SuperWidget.ts.

3. **EditorCanvasStub constructor binding parameter?**
   - What we know: Editor is Unbound-only (CANV-03). Claude's Discretion on whether it takes a binding param.
   - Recommendation: No binding parameter — hardcode Unbound behavior. The constructor should only take `canvasId`. This simplifies the registry entry's `create` closure and makes the Unbound-only constraint explicit in the type signature.

---

## Sources

### Primary (HIGH confidence)
- `src/superwidget/projection.ts` — CanvasComponent interface (lines 42-45), CanvasType/CanvasBinding types verified directly
- `src/superwidget/SuperWidget.ts` — CanvasFactory type (line 5), constructor injection (line 34), commitProjection canvas lifecycle (lines 143-167)
- `tests/superwidget/SuperWidget.test.ts` — readFileSync pattern for static assertions (lines 6-7, 17-18), stubFactory pattern (lines 12-15)
- `tests/superwidget/commitProjection.test.ts` — mockCanvasComponent pattern, jsdom annotation, vi.fn factory mocking
- `.planning/phases/165-canvas-stubs-registry/165-CONTEXT.md` — All D-01..D-08 locked decisions
- `.planning/REQUIREMENTS.md` — CANV-01..07 acceptance criteria
- `.planning/codebase/CONVENTIONS.md` — PascalCase classes, private underscore prefix, tabs, single quotes, semicolons

### Secondary (MEDIUM confidence)
- `.planning/codebase/TESTING.md` — jsdom annotation pattern, test directory convention

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all existing infrastructure
- Architecture: HIGH — all decisions locked in CONTEXT.md D-01..D-08; patterns verified in existing source
- Pitfalls: HIGH — identified from existing codebase patterns (data-render-count string type, jsdom annotation, registry module-level state)

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable TypeScript, no external churn risk)
