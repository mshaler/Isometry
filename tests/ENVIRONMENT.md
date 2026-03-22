# Test Environment Boundary Rules

## The Rule

Never import `realDb()` (or any sql.js WASM code) in a test file annotated with `@vitest-environment jsdom`. WASM and jsdom are incompatible runtimes.

## Rationale

- sql.js WASM requires a real Node.js environment to load the `.wasm` binary
- jsdom patches global `window`, `document`, `navigator` in ways that break WASM instantiation
- Mixing causes silent failures: WASM loads but produces corrupted results, or throws opaque "CompileError" at runtime
- The split is load-bearing — it cannot be worked around with polyfills
- CI enforces this boundary via a grep-based check that fails the build on violations

## When to Use Each Environment

### Node (default, no annotation needed)

- Tests using `realDb()` from `tests/harness/realDb.ts`
- Tests using `makeProviders()` from `tests/harness/makeProviders.ts`
- Any test that touches sql.js Database, Worker handlers, or ETL pipeline
- Import/seam tests under `tests/seams/`
- ETL validation tests under `tests/etl-validation/`
- Native adapter tests under `tests/etl-validation/native/`

### jsdom (`// @vitest-environment jsdom` at top of file)

- Tests that need `document`, `window`, DOM APIs
- UI component tests (CommandBar, NotebookExplorer, ProjectionExplorer, etc.)
- Tests that create/query DOM elements
- Tests under `tests/ui/`
- **Never import `realDb`, `makeProviders`, or `Database` in these files**

## Correct Examples

```typescript
// CORRECT: Node environment (default) with realDb
import { realDb } from '../harness/realDb';
// No @vitest-environment annotation needed

describe('ETL import', () => {
  let db: Database;
  beforeEach(async () => { db = await realDb(); });
  afterEach(() => { db.close(); });

  it('inserts cards', async () => {
    // use db directly
  });
});
```

```typescript
// CORRECT: jsdom environment for UI testing
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

describe('CommandBar', () => {
  it('renders input', () => {
    const el = document.createElement('div');
    expect(el).toBeDefined();
  });
});
```

```typescript
// CORRECT: UI test that needs data — mock it, don't use realDb
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

const mockDb = { run: vi.fn(), exec: vi.fn(), close: vi.fn() };

describe('SomeComponent', () => {
  it('renders with data', () => {
    // Use mockDb, not realDb()
  });
});
```

## Incorrect Examples

```typescript
// WRONG: mixing realDb with jsdom -- WILL FAIL CI
// @vitest-environment jsdom
import { realDb } from '../harness/realDb'; // <-- CI will reject this

describe('BrokenTest', () => {
  it('tries to use WASM in jsdom', async () => {
    const db = await realDb(); // CompileError or silent corruption
  });
});
```

```typescript
// WRONG: importing Database directly in jsdom context
// @vitest-environment jsdom
import { Database } from '../../src/database/Database'; // <-- CI will reject this
```

## How to Fix Violations

**Symptom:** CI fails with "WASM/jsdom boundary violation detected in: tests/foo/bar.test.ts"

**Option A — Remove the jsdom annotation** (preferred if the test doesn't need DOM APIs):
- Delete the `// @vitest-environment jsdom` line
- The test will run in Node.js environment (default)
- `realDb()` will work correctly

**Option B — Split into two test files** (when you need both WASM and DOM):
- `bar.node.test.ts` — Node environment, uses `realDb()`, tests data layer
- `bar.jsdom.test.ts` — jsdom environment, mocks data, tests DOM behavior
- Never cross-import between them

**Option C — Mock the database** (preferred for UI-only tests):
- Replace `realDb()` with `vi.fn()` mocks
- Test the component's reaction to data, not the database itself

## CI Enforcement

A dedicated `environment-boundary` job runs in parallel with all other CI jobs. It scans every file in `tests/` that contains `@vitest-environment jsdom` and checks whether it also imports `realDb` or `Database`. Any match fails the build.

The grep pattern used:

```bash
VIOLATIONS=$(grep -rl '@vitest-environment jsdom' tests/ | \
  xargs grep -l 'realDb\|from.*harness/realDb\|from.*database/Database' 2>/dev/null || true)
```

This check runs on every push. There is no `continue-on-error` — violations are hard failures.

## Troubleshooting

- **"CompileError: WebAssembly.instantiate()"** — Check if the test file has a `// @vitest-environment jsdom` annotation. Remove it to use the Node.js environment where WASM loads correctly.

- **"document is not defined"** — You need `// @vitest-environment jsdom` but cannot use `realDb()` in this file. Either mock the database or split into two test files (see "How to Fix Violations" above).

- **"Cannot find module 'sql-wasm.wasm'"** — The `SQL_WASM_PATH` environment variable is not set. Ensure `tests/setup/wasm-init.ts` is listed as a `globalSetup` in `vitest.config.ts`.

- **"WASM instantiation takes >2s in CI"** — WASM cold-start is expected. Do not set test timeouts below 10 000ms for Node-environment tests that use `realDb()`.

- **"Test passes locally but fails in CI"** — Likely a jsdom/WASM boundary issue that manifests differently on Linux. Check for `// @vitest-environment jsdom` in the failing file.
