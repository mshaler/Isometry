# Coding Conventions

**Analysis Date:** 2026-03-17

## Naming Patterns

**Files:**
- PascalCase for classes and components: `FilterProvider.ts`, `PropertiesExplorer.ts`
- camelCase for utilities and helpers: `helpers.ts`, `wasm-compat.ts`
- Lower kebab-case for CSS files: `latch-explorers.css`, `supergrid.css`
- Handler files use suffix pattern: `cards.handler.ts`, `etl-import.handler.ts`
- Test files co-located with source: `SortState.ts` paired with `SortState.test.ts`

**Functions:**
- camelCase for all function names: `createCard()`, `addFilter()`, `handleSuperGridQuery()`
- Private methods with underscore prefix: `_scheduleNotify()`, `_buildColumnInfo()`
- Async functions named with action verbs: `initialize()`, `restore()`, `execute()`

**Variables:**
- camelCase for all local variables and parameters: `db`, `filters`, `container`, `insertedIds`
- Constants in UPPER_SNAKE_CASE: `MAX_HISTORY`, `ALLOWED_AGGREGATION_MODES`, `DEFAULT_VIEW_TYPE`
- Private class fields with underscore prefix: `_filters`, `_searchQuery`, `_subscribers`, `_pendingNotify`
- Callback/handler functions named with action + `Handler` or `Callback`: `createMockBridge()`, `flushCoordinatorCycle()`

**Types:**
- PascalCase for all type names: `Filter`, `FilterState`, `FilterProvider`, `CompiledFilter`
- Interfaces prefixed with capital letter: `interface SubscribableProvider`, `interface FilterState`
- Union types and enums PascalCase: `ViewType`, `FilterOperator`, `AggregationMode`
- Generic types single capital letter: `T`, `K`, `V`

## Code Style

**Formatting:**
- Tool: Biome 2.4.6 (enforced in CI)
- Indent: Tab characters (indentStyle: tab)
- Line width: 120 characters
- Line endings: LF only

**Linting:**
- Tool: Biome with recommended rules enabled
- Key disabled rules (intentional):
  - `noUnusedPrivateClassMembers`: off (D-010 pattern — stubs allowed)
  - `useLiteralKeys`: off (bracket notation for index signatures required)
  - `noUselessSwitchCase`: off (switch stubs in refactoring allowed)
  - `noNonNullAssertion`: off (! assertions used for guard clause recovery)
  - `useTemplate`: off (template literals optional for readability)
  - `noExplicitAny`: off (any used in bridge/worker protocol boundaries)
  - `useIterableCallbackReturn`: off (non-return callbacks in loops allowed)

**Quotes:**
- Single quotes for strings: `'note'`, `'Select * FROM cards'`
- Always use quotes for string literals (no bare identifiers)

**Semicolons:**
- Always required (semicolons: always)

**Arrow parentheses:**
- Always include parentheses: `(x) => x + 1`, even single params

**Trailing commas:**
- All multi-line lists: trailing commas on all lines (trailingCommas: all)

## Import Organization

**Order:**
1. Built-in modules: `import { existsSync } from 'fs'`
2. Node.js protocol imports: `import { fileURLToPath } from 'url'`
3. Third-party packages: `import { marked } from 'marked'`
4. Internal relative imports: `import type { Database } from '../../src/database/Database'`
5. Type imports grouped with corresponding value imports

**Path Aliases:**
- Relative paths used throughout (no @-style aliases configured)
- Parent traversal with `../` explicit: `../../src/providers/FilterProvider`
- Barrel files not used for core modules

**Type imports:**
- Type-only imports use `import type` keyword: `import type { Filter, FilterProvider } from './types'`
- Mixed value + type imports split: values first, then `import type`

**Module exports:**
- Named exports preferred: `export class FilterProvider`, `export function createCard()`
- Default exports avoided
- Barrel files used minimally (only in `/index.ts` utility files)

## Error Handling

**Patterns:**
- Fail-fast validation in constructors and public APIs
- Throw descriptive errors with prefixed context: `throw new Error('[VisualExplorer] Not mounted — call mount() first')`
- Database operation errors propagate (no catch/ignore): `db.run()` failures bubble up
- Bridge send errors wrapped with semantic meaning: `await bridge.send()` can throw
- Optional chaining (`?.`) for safe property access on potentially null objects
- Non-null assertions (`!`) only after guard clauses that prove non-null

**Error messages:**
- Include class/module context in brackets: `[FilterProvider]`, `[Database]`
- Provide actionable guidance when possible: "call mount() first"
- Quote invalid values: `"SQL safety violation: unknown field 'foo'"`

**Try-catch usage:**
- Parser classes catch parsing errors and emit descriptive errors
- Chart rendering wraps D3 operations in try-catch (DOMPurify + mount can fail)
- NativeBridge wraps async bridge operations with error context
- Storage operations catch quota/access errors gracefully
- Never catch errors to log and ignore — always rethrow or handle semantically

## Logging

**Framework:** `console` (built-in, no external logger)

**Patterns:**
- Debug info via `console.log()` (compiled out in production via tree-shaking if wrapped in `if (__DEBUG__)`)
- Warnings via `console.warn()`: history overflow, state migration issues
- Errors via `console.error()`: critical failures
- Performance traces via `console.time()` / `console.timeEnd()` (removed in optimization phases)

**When to log:**
- Migration edge cases: `console.warn('[StateManager] Unknown field in persisted state')`
- Recovery actions: `console.warn('[MutationManager] History depth exceeded')`
- Never log sensitive data (no card content, no full state dumps)

## Comments

**When to comment:**
- File-level JSDoc header: module purpose, design decisions, requirements
- Complex algorithms or non-obvious business logic
- Workarounds and rationale: "Phase XX — reason for approach"
- SQL fragments explaining optimization strategy
- Data transformation steps

**Avoid commenting:**
- Self-documenting code (function names explain intent)
- Obvious loops: `for (const card of cards)` needs no comment
- Types (TypeScript is type documentation)

**JSDoc/TSDoc:**
- Used for public API methods and exported functions
- Parameter descriptions with type and purpose: `@param db - Database instance`
- Return description: `@returns Card object or null if not found`
- Throws clause for documented error cases: `@throws {Error} "SQL safety violation: ..."`

**Example JSDoc pattern:**
```typescript
/**
 * Insert a new card with a generated UUID. Returns the full Card object.
 *
 * All optional CardInput fields default to SQL defaults when not provided.
 * Tags are serialized to a JSON string for the TEXT column.
 *
 * @throws {Error} Database constraint violations
 */
export function createCard(db: Database, input: CardInput): Card
```

## Function Design

**Size:**
- Generally keep functions under 50 lines (especially in providers)
- Large functions (100+ lines) broken into named helper functions
- Complex SQL building delegated to dedicated handlers: `handleSuperGridQuery()`

**Parameters:**
- Prefer objects over 3+ positional parameters
- Config objects use explicit typing: `interface FilterConfig { bridge, selection, filter, alias }`
- Database always passed as first parameter: `createCard(db, input)`
- Callbacks/providers passed as explicit parameters (no closure reliance on module state)

**Return values:**
- Explicit null for "not found": `getCard() | null`, not `getCard() | undefined`
- Tuples used for multiple related returns: `[id, error]` pattern not common (use objects instead)
- Never return partial/incomplete objects; throw instead if precondition fails
- Generic promise returns: `Promise<{ changes: number }>` for bridge responses

**Naming for clarity:**
- Verb-noun naming: `addFilter()`, `removeFilter()`, `createCard()`
- Getter functions: `getFilters()`, `compile()` (returns computed value)
- Mutating methods don't use `set` prefix if state change is primary: `addFilter()` not `setFilter()`
- Boolean getters: `hasActiveFilters()`, `isSubscribable()`, `isCollective`

## Module Design

**Exports:**
- Named exports only: `export class`, `export function`, `export type`
- Types and values separated when possible but imported together
- Private helper functions NOT exported (PascalCase classes are public, camelCase functions often private within module)

**Barrel files:**
- Used minimally: `/src/index.ts` for main exports only
- Prefer direct imports from source files over barrel re-exports
- Avoid deep barrel chains (e.g., `src/providers/index.ts` not used, import from `FilterProvider.ts` directly)

**Class pattern:**
- Private fields with underscore: `_filters`, `_subscribers`
- Getters only for computed/derived state, not for field access
- Setters for late-binding injection: `setSchemaProvider()`, `setToast()`
- Methods organized: constructor → public mutations → public queries → private helpers
- Subscription methods return unsubscribe functions: `subscribe(fn)` returns `() => void`

**Provider pattern:**
- All providers implement `PersistableProvider` interface: `getState()`, `restoreState()`
- Subscription via `subscribe(callback) => unsubscribe`
- Notifications batched via `queueMicrotask()` or `requestAnimationFrame()`
- State mutations trigger notification: `_scheduleNotify()` pattern

## TypeScript Configuration

**Compiler options:**
- `strict: true` — all strict flags enabled
- `noUncheckedIndexedAccess: true` — array/record access requires index guards
- `exactOptionalPropertyTypes: true` — optional fields cannot be assigned `undefined`
- `noPropertyAccessFromIndexSignature: true` — must use bracket notation for computed keys
- `noImplicitReturns: true` — all code paths must return
- `noFallthroughCasesInSwitch: true` — switches require breaks or error throws
- `skipLibCheck: false` — full type checking (node_modules validated)
- `isolatedModules: true` — modules can be transpiled independently
- `verbatimModuleSyntax: true` — imports/exports exactly as written

## Performance-Critical Areas

**Hot paths (avoid in render/query loops):**
- Object creation in cell rendering loops (D3 .data() join reuse)
- String concatenation in SQL building (use parameter arrays instead)
- Closure creation per item (use event delegation on parent)

**Optimization patterns:**
- Indexed lookups for O(1) access: Map/Set instead of Array.find()
- Batch operations with BEGIN/COMMIT for SQLite
- Worker-resident computation for force simulation, ETL processing
- D3 data join with stable key function (never anonymous)

---

*Convention analysis: 2026-03-17*
