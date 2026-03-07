# Phase 47: ETL Validation - Research

**Researched:** 2026-03-07
**Domain:** ETL pipeline validation, cross-source view rendering, dedup regression testing
**Confidence:** HIGH

## Summary

Phase 47 is a validation and bug-fix phase -- not a feature phase. The codebase already has a complete ETL pipeline (6 file parsers + 3 native adapters), 9 views, DedupEngine, ImportOrchestrator, and error handling infrastructure. The task is to systematically validate every import source produces correct data and that data renders correctly in every view.

The existing test infrastructure provides strong patterns to follow. Parser unit tests live in `tests/etl/parsers/`, integration tests in `tests/integration/`, and view tests in `tests/views/`. All use Vitest with JSDOM for view tests and Node for database/parser tests. The `@vitest-environment jsdom` pragma switches environments per-file.

**Primary recommendation:** Structure tests as three layers: (1) per-source import validation with 100+ card fixtures, (2) cross-source view rendering matrix with JSDOM, (3) per-source error and dedup regression tests. Fix bugs as tests surface them -- TDD validation style.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use BOTH real-world snapshot data (100+ cards per source) AND synthetic edge cases
- Snapshot fixtures saved as JSON/file fixtures in tests/fixtures/ for CI portability
- Native sources (Reminders, Calendar, Notes) use pre-captured CanonicalCard[] arrays as snapshot fixtures
- Optional live tests that hit actual device data -- skipped in CI, available for local runs
- Per-source error fixtures: each source gets a deliberately broken/malformed fixture
- ALL 81 combinations tested: 9 sources x 9 views
- Tests run in Vitest + JSDOM -- D3 data joins execute, DOM elements asserted
- Validation checks: view mounts without error, expected DOM elements match card count, no console errors, no empty containers
- Field-dependent feature validation: Calendar cards on correct dates, Notes links as NetworkView edges, hierarchical data in TreeView nodes, etc.
- Source-specific error messages: each parser provides its own error detail string
- Partial imports: success toast + error count + expandable detail (ImportToast already supports this)
- Native macOS errors pass through NativeBridge -- web layer wraps in source-specific messages
- Tests assert error category + source type mention, NOT exact message text
- TDD-style validation: write tests first, fix underlying bugs when tests fail
- Fix wherever the bug is -- parser, view, database query, StateCoordinator, anywhere
- If fixing changes parser output, update ALL affected unit tests
- Exit criterion: all 81 source x view combos pass + all 5 ETLV requirements green

### Claude's Discretion
- Exact test organization (one file per source, one file per view, or matrix structure)
- JSDOM setup and D3 rendering mocks
- Order of validation (sources first vs views first)
- How to handle views that genuinely can't render certain data shapes (e.g., TreeView with flat CSV data)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ETLV-01 | All 6 file-based sources import successfully with correct card/connection output | Per-source fixture tests through ImportOrchestrator; verify inserted count, card fields, connection count per source type |
| ETLV-02 | All 3 native macOS sources import successfully with correct card output | Pre-captured CanonicalCard[] fixtures processed through DedupEngine + SQLiteWriter (same path as etl-import-native.handler.ts) |
| ETLV-03 | Imported data renders correctly in all 9 views across high-value source/view combinations | JSDOM view mount + render tests with CardDatum arrays derived from imported data; DOM element count assertions |
| ETLV-04 | Import errors surface clear actionable messages for each source type | Per-source malformed fixtures; assert ParseError messages mention source type and specific failure |
| ETLV-05 | Dedup engine correctly handles re-import across all 9 sources | Import-then-reimport tests per source; assert zero inserts, correct unchanged count, correct deletedIds |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Role in Phase |
|---------|---------|---------|---------------|
| Vitest | 4.0 | Test framework | All validation tests |
| JSDOM | (via Vitest) | DOM environment | View rendering tests |
| D3.js | 7.9 | Data join rendering | Views execute D3 joins in JSDOM |
| sql.js | 1.14 | In-memory SQLite | Database assertions in integration tests |
| PapaParse | (project dep) | CSV parsing | CSVParser dependency |
| xlsx/SheetJS | (dynamic import) | Excel parsing | ExcelParser dependency |
| gray-matter | (project dep) | Frontmatter parsing | Markdown/Apple Notes parsers |

### No New Dependencies Needed
This phase uses only existing project dependencies. All test infrastructure is already in place.

## Architecture Patterns

### Recommended Test Organization

```
tests/
  etl-validation/
    fixtures/                        # 100+ card snapshot fixtures
      apple-notes-snapshot.json      # ParsedFile[] (100+ notes with frontmatter)
      markdown-snapshot.json         # ParsedFile[] (100+ md files)
      csv-snapshot.json              # ParsedFile[] (100+ row CSV)
      json-snapshot.json             # JSON string (100+ item array)
      excel-snapshot.xlsx            # Binary ArrayBuffer fixture
      html-snapshot.json             # string[] (100+ HTML pages)
      native-reminders.json          # CanonicalCard[] (100+ reminders)
      native-calendar.json           # CanonicalCard[] (100+ events)
      native-notes.json              # CanonicalCard[] (100+ notes)
      errors/                        # Per-source malformed fixtures
        bad-apple-notes.json
        bad-csv.json
        bad-json.json
        bad-excel.xlsx
        bad-html.json
        bad-markdown.json
    source-import.test.ts            # ETLV-01 + ETLV-02: all 9 sources import
    source-view-matrix.test.ts       # ETLV-03: 81 source x view combos
    source-errors.test.ts            # ETLV-04: per-source error messages
    source-dedup.test.ts             # ETLV-05: re-import dedup regression
```

**Rationale:** Matrix structure is clearest -- one file per requirement, not per source or per view. Each file tests its requirement exhaustively across all sources. This avoids 81 separate test files while keeping each requirement's tests co-located.

### Pattern 1: Source Import Validation (ETLV-01/02)

**What:** Import 100+ card fixtures through the real pipeline and assert field correctness.

**When to use:** Every source type.

```typescript
// @vitest-environment jsdom (needed for some parsers that check DOM)
describe('Source Import Validation', () => {
  let db: Database;
  let orchestrator: ImportOrchestrator;

  beforeEach(async () => {
    db = new Database();
    await db.initialize();
    orchestrator = new ImportOrchestrator(db);
  });

  afterEach(() => db.close());

  describe('Apple Notes', () => {
    it('imports 100+ notes with correct card output', async () => {
      const fixture = await loadFixture('apple-notes-snapshot.json');
      const result = await orchestrator.import('apple_notes', fixture);

      expect(result.inserted).toBeGreaterThanOrEqual(100);
      expect(result.errors).toBe(0);

      // Verify field correctness
      const stmt = db.prepare<{ name: string; source: string; folder: string | null }>(
        'SELECT name, source, folder FROM cards WHERE source = ?'
      );
      const cards = stmt.all('apple_notes');
      stmt.free();

      expect(cards.length).toBeGreaterThanOrEqual(100);
      // Every card has a non-empty name
      cards.forEach(c => expect(c.name.length).toBeGreaterThan(0));
      // Source is correct
      cards.forEach(c => expect(c.source).toBe('apple_notes'));
    });

    it('creates connections from note links', async () => {
      // fixture includes notes with links[] frontmatter
      const fixture = await loadFixture('apple-notes-snapshot.json');
      const result = await orchestrator.import('apple_notes', fixture);
      expect(result.connections_created).toBeGreaterThan(0);
    });
  });

  // Repeat for: markdown, csv, json, excel, html
  // Native sources use DedupEngine + SQLiteWriter directly (not ImportOrchestrator)
});
```

### Pattern 2: View Rendering Matrix (ETLV-03)

**What:** For each source type, convert imported data to CardDatum[] and render in each of 9 views.

**Key insight:** Views receive CardDatum[] -- they don't know or care about the source. The validation is: does data from source X render without errors in view Y? Some combos are "high-value" (Calendar + native_calendar, NetworkView + apple_notes with links), others are "sanity" (ListView + any source).

```typescript
// @vitest-environment jsdom
import { ListView } from '../../src/views/ListView';
// ... import all 9 views

const SOURCES = [
  'apple_notes', 'markdown', 'csv', 'json', 'excel', 'html',
  'native_reminders', 'native_calendar', 'native_notes'
] as const;

// Pre-import fixture data and convert to CardDatum[]
// This runs once per source, then CardDatum arrays are reused across views

describe.each(SOURCES)('Source: %s renders in all views', (sourceType) => {
  let cards: CardDatum[];

  beforeAll(async () => {
    // Import fixture into DB, query back as CardDatum[]
    cards = await importAndQuery(sourceType);
  });

  it('ListView renders correct card count', () => {
    const container = document.createElement('div');
    const view = new ListView();
    view.mount(container);
    view.render(cards);
    expect(container.querySelectorAll('g.card').length).toBe(cards.length);
    view.destroy();
  });

  it('GridView renders correct card count', () => {
    // similar pattern
  });

  // ... repeat for all 9 views
});
```

### Pattern 3: Handling Data-Shape Mismatches

**What:** Some sources produce data that doesn't naturally map to certain views. These are NOT failures -- they should render gracefully (empty or flat).

| View | Requires | Sources That Lack It | Expected Behavior |
|------|----------|---------------------|-------------------|
| CalendarView | `due_at` non-null | csv, json, html, markdown (unless frontmatter has date) | No chips rendered, empty calendar grid (valid) |
| TimelineView | date fields | csv, json, html | Empty timeline (valid) |
| NetworkView | connections | csv, json, html, excel | No edges, nodes only (valid) |
| TreeView | connections with 'contains' label | csv, json, html, excel | All cards in orphan list (valid) |
| KanbanView | `status` non-null | Most sources default null | Single "null" column (valid) |

**Test assertion:** View mounts without error, does NOT throw, DOM is non-empty if cards were provided. For views that filter (CalendarView filters null due_at), 0 visible elements is acceptable -- the view itself rendered correctly.

### Pattern 4: Native Source Import (ETLV-02)

**What:** Native sources bypass ImportOrchestrator -- they use DedupEngine + SQLiteWriter directly, matching the etl-import-native.handler.ts code path.

```typescript
describe('Native Source Import', () => {
  it('native_reminders imports 100+ cards', async () => {
    const db = new Database();
    await db.initialize();

    const fixture: CanonicalCard[] = JSON.parse(
      await readFixture('native-reminders.json')
    );

    const dedup = new DedupEngine(db);
    const writer = new SQLiteWriter(db);
    const result = dedup.process(fixture, [], 'native_reminders');

    await writer.writeCards(result.toInsert, false);

    const stmt = db.prepare<{ count: number }>(
      'SELECT COUNT(*) as count FROM cards WHERE source = ?'
    );
    const rows = stmt.all('native_reminders');
    stmt.free();

    expect(rows[0]?.count).toBe(fixture.length);
    db.close();
  });
});
```

### Pattern 5: Error Message Validation (ETLV-04)

**What:** Each source's error messages should mention the source type and specific failure reason.

```typescript
describe('Source Error Messages', () => {
  it('CSV parser surfaces column-specific errors', async () => {
    const badCsv: ParsedFile[] = [{
      path: 'bad.csv',
      content: '' // empty file
    }];
    const result = await orchestrator.import('csv', JSON.stringify(badCsv));
    // No cards from empty file -- but no error either (empty = valid)
    expect(result.inserted).toBe(0);
  });

  it('JSON parser surfaces unrecognized structure warning', async () => {
    const badJson = JSON.stringify({ randomKey: 'randomValue' });
    const result = await orchestrator.import('json', badJson);
    // STAB-03: should surface warning about unrecognized structure
    expect(result.errors_detail.length).toBeGreaterThan(0);
    expect(result.errors_detail[0]?.message).toContain('Unrecognized JSON structure');
  });

  it('invalid JSON surfaces parse category error', async () => {
    const result = await orchestrator.import('json', 'not{valid}json');
    expect(result.errors).toBeGreaterThan(0);
    expect(result.errors_detail[0]?.message).toContain('Invalid JSON');
  });
});
```

### Anti-Patterns to Avoid
- **Testing exact error message strings:** Assert error category + source type mention, NOT exact text. Messages may change; the contract is "clear, actionable, source-specific."
- **Creating 81 separate test files:** One file per requirement keeps tests organized and fast to navigate.
- **Testing views via ViewManager integration:** Test views directly (mount/render/destroy) -- ViewManager adds async bridge calls that complicate JSDOM tests.
- **Generating 100+ card fixtures programmatically at test time:** Pre-generate fixtures as JSON files for reproducibility. Programmatic generation hides data shape bugs.
- **Skipping data-shape mismatch combos:** Test ALL 81 combos. A view receiving data without its preferred field should degrade gracefully, not throw.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing for fixtures | Custom parser | PapaParse (already in project) | BOM, encoding, delimiter edge cases |
| View rendering test harness | Custom JSDOM setup | `@vitest-environment jsdom` pragma | Per-file environment switching built into Vitest |
| Snapshot assertion | Custom diffing | Vitest `expect().toMatchSnapshot()` | Built-in; but use sparingly -- assert specific fields, not full objects |
| Fixture file loading | Custom fs wrapper | Vite `?raw` import or fs.readFileSync | Both work in Vitest test context |

## Common Pitfalls

### Pitfall 1: JSDOM Missing APIs
**What goes wrong:** D3 selections work in JSDOM, but SVG measurement APIs (getBBox, getComputedTextLength) return 0/undefined. Views that depend on measured text widths for layout may produce different DOM structures.
**Why it happens:** JSDOM does not implement SVG geometry APIs.
**How to avoid:** Assert DOM element presence and count, not positions or sizes. Use `querySelectorAll` for element counting. For views like SuperGrid that use HTML (not SVG), this is less of an issue.
**Warning signs:** Tests pass but assertions on `transform`, `width`, or `height` attributes fail.

### Pitfall 2: ExcelParser Dynamic Import in Tests
**What goes wrong:** ExcelParser uses `await import('xlsx')` -- dynamic import may behave differently in Vitest's Node environment.
**Why it happens:** Vitest may need to resolve the xlsx module differently than Vite does at build time.
**How to avoid:** Use the existing ExcelParser test pattern from `tests/etl/parsers/ExcelParser.test.ts`. The xlsx library loads fine in Vitest's Node environment. For fixture loading, use `fs.readFileSync` to get the ArrayBuffer.
**Warning signs:** "Cannot find module 'xlsx'" errors at test time.

### Pitfall 3: NetworkView Requires WorkerBridge Mock
**What goes wrong:** NetworkView calls `bridge.send('graph:simulate', ...)` during render. Without a mock, render() hangs or throws.
**Why it happens:** Force simulation runs in Worker -- JSDOM doesn't have a Worker.
**How to avoid:** Inject a mock bridge that returns pre-computed positions (see existing NetworkView.test.ts pattern). TreeView also needs a bridge mock for connection queries.
**Warning signs:** Test timeout on `view.render()`.

### Pitfall 4: CalendarView Requires DensityProvider
**What goes wrong:** CalendarView constructor requires a `DensityProvider` instance. Without it, mount() throws.
**Why it happens:** CalendarView's granularity (month/week/day) comes from DensityProvider.
**How to avoid:** Create a minimal DensityProvider mock (see CalendarView.test.ts pattern). Set granularity to 'month' for standard tests.
**Warning signs:** "Cannot read property 'getGranularity' of undefined" in CalendarView constructor.

### Pitfall 5: KanbanView Requires MutationManager
**What goes wrong:** KanbanView constructor requires a MutationManager for drag-drop mutations.
**Why it happens:** Drop handler calls `mutationManager.execute()`.
**How to avoid:** Use `makeMockMutationManager()` pattern from existing KanbanView.test.ts.
**Warning signs:** Constructor throws on missing mutationManager.

### Pitfall 6: Source Field on CardDatum
**What goes wrong:** CardDatum has a `source` field that some views might use for rendering (e.g., TreeView color mapping, provenance display). If fixture data lacks source, views may render incorrectly.
**Why it happens:** CardDatum.source is nullable -- `toCardDatum()` maps it from the row's `source` column.
**How to avoid:** Ensure all fixture data flows through the real import pipeline (ImportOrchestrator or DedupEngine + SQLiteWriter), then query back via `SELECT ... FROM cards`. This guarantees the `source` column is populated correctly for each source type.
**Warning signs:** Cards appear with `source: null` in CardDatum despite being imported from a specific source.

### Pitfall 7: Fixture Size vs Test Speed
**What goes wrong:** 100+ card fixtures x 9 sources x 9 views = 8,100+ DOM renders. Vitest may slow down significantly.
**Why it happens:** JSDOM DOM operations are slower than real browser. D3 data join with 100+ elements is non-trivial.
**How to avoid:** For the view rendering matrix (ETLV-03), use a smaller representative subset (~10-20 cards per source) that exercises field diversity. Reserve 100+ card fixtures for import validation (ETLV-01/02) and dedup regression (ETLV-05) where scale matters.
**Warning signs:** Test suite exceeds 60 seconds; individual describe blocks take 10+ seconds.

### Pitfall 8: console.error Leaking from Views
**What goes wrong:** Views may log console.error during rendering (e.g., D3 selection on missing container, invalid date parsing). These aren't test failures but indicate real problems.
**Why it happens:** Views catch and log some errors internally.
**How to avoid:** Spy on `console.error` in each view render test and assert it was not called.
**Warning signs:** Green tests but console output littered with errors.

## Code Examples

### View Constructor Dependencies Map

Each view has different constructor requirements. Use this map when building the matrix test:

```typescript
// Views with NO constructor dependencies (just `new View()`)
const SIMPLE_VIEWS = ['ListView', 'GridView', 'GalleryView', 'TimelineView'];

// Views requiring bridge mock
const BRIDGE_VIEWS = {
  NetworkView: { bridge: makeBridgeMock() },  // needs graph:simulate response
  TreeView: { bridge: makeBridgeMock([]) },    // needs connection query response
};

// Views requiring provider mocks
const PROVIDER_VIEWS = {
  CalendarView: { densityProvider: makeDensityProvider() },
  KanbanView: { mutationManager: makeMockMutationManager() },
  // SuperGrid requires multiple providers -- see existing SuperGrid.test.ts
};
```

### Fixture Generation Approach

Fixtures should be pre-generated, not programmatic. Each source's fixture should exercise field diversity:

```typescript
// apple-notes-snapshot.json schema:
// Array of ParsedFile objects matching alto-index format
[
  {
    "path": "Folder/Note-001.md",
    "content": "---\ntitle: Note 001\nid: 1001\ncreated: 2026-01-01T10:00:00Z\nmodified: 2026-01-15T12:00:00Z\nfolder: Work\nattachments:\n  - id: att-1\n    type: com.apple.notes.inlinetextattachment.hashtag\n    content: '<a class=\"tag link\" href=\"/tags/project\">#project</a>'\nlinks:\n  - '1002'\nsource: notes://showNote?identifier=1001\n---\n\n# Note 001\n\nContent with @mention and a link."
  }
  // ... 99+ more with varying folders, tags, links, dates
]

// native-reminders.json schema:
// Array of CanonicalCard objects
[
  {
    "id": "uuid-rem-001",
    "card_type": "task",
    "name": "Buy groceries",
    "content": "Milk, eggs, bread",
    "source": "native_reminders",
    "source_id": "rem-001",
    "due_at": "2026-03-15T10:00:00Z",
    "status": "incomplete",
    "tags": ["shopping"],
    "priority": 3,
    // ... all CanonicalCard fields
  }
  // ... 99+ more with varying due_at, status, priority, tags
]
```

### Dedup Re-Import Test Pattern

```typescript
describe('Dedup Regression', () => {
  it.each(FILE_SOURCES)('%s: re-import produces zero new cards', async (source) => {
    const fixture = await loadFixture(source);
    const first = await orchestrator.import(source, fixture);
    expect(first.inserted).toBeGreaterThan(0);

    const second = await orchestrator.import(source, fixture);
    expect(second.inserted).toBe(0);
    expect(second.unchanged).toBe(first.inserted);

    // Total card count unchanged
    const stmt = db.prepare<{ count: number }>(
      'SELECT COUNT(*) as count FROM cards WHERE source = ?'
    );
    const rows = stmt.all(source);
    stmt.free();
    expect(rows[0]?.count).toBe(first.inserted);
  });
});
```

## State of the Art

| Component | Current State | Phase 47 Relevance |
|-----------|---------------|-------------------|
| ImportOrchestrator | Handles all 6 file sources; throws for native types | ETLV-01 tests go through this |
| etl-import-native.handler.ts | Handles 3 native sources with DedupEngine + SQLiteWriter directly | ETLV-02 tests replicate this path |
| DedupEngine | source_id + modified_at comparison; soft-delete aware | ETLV-05 tests exercise classification + deletedIds |
| ErrorBanner | 5 categories: parse, database, network, import, unknown | ETLV-04 validates source-specific messages get through |
| ImportToast | Shows success + error count + expandable detail | ETLV-04 validates error detail propagation |
| Views | All 9 implement IView (mount/render/destroy) | ETLV-03 tests all render paths |

## Open Questions

1. **SuperGrid Constructor Complexity**
   - What we know: SuperGrid requires 6+ provider mocks (bridge, pafv, filter, position, selection, density)
   - What's unclear: Whether a minimal mock set is sufficient for basic render-without-error validation
   - Recommendation: Use existing SuperGrid.test.ts patterns; for matrix validation, only assert mount + basic cell rendering

2. **Excel Fixture Format**
   - What we know: ExcelParser expects ArrayBuffer. Saving a binary .xlsx in fixtures/ is simplest.
   - What's unclear: Whether Vitest's fixture loading handles binary files well with `?raw` imports
   - Recommendation: Use `fs.readFileSync(path).buffer` to load binary fixture; avoid Vite `?raw` for binary

3. **GalleryView Pure HTML Pattern**
   - What we know: GalleryView is noted as "pure HTML (no D3 data join)" in project memory
   - What's unclear: Whether GalleryView.render() follows standard IView pattern for DOM assertions
   - Recommendation: Test GalleryView by counting `.gallery-card` or equivalent child elements after render

## Sources

### Primary (HIGH confidence)
- Project source code: `src/etl/`, `src/views/`, `src/ui/` -- direct inspection of all parsers, views, and error handling
- Existing test patterns: `tests/etl/`, `tests/views/`, `tests/integration/` -- established patterns for Database, parser, and view testing
- `vitest.config.ts` -- confirmed Node default environment with per-file JSDOM override via pragma
- `src/etl/types.ts` -- CanonicalCard and CanonicalConnection type definitions (integration seam)
- `src/views/types.ts` -- CardDatum interface and IView contract
- `src/database/schema.sql` -- full database schema including cards, connections, FTS5, import catalog

### Secondary (MEDIUM confidence)
- Project memory (MEMORY.md) -- GalleryView is pure HTML (no D3), TreeView uses _children stash, view constructor patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all dependencies already in project, no new libraries needed
- Architecture: HIGH - existing test patterns provide clear templates for every test type
- Pitfalls: HIGH - directly verified via source code inspection (view constructors, JSDOM limitations, bridge dependencies)
- Fixture strategy: MEDIUM - 100+ card fixture generation approach is sound but actual fixture creation needs careful field diversity

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable -- no external dependency changes expected)
