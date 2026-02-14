# SuperGrid Diagnostic & Fix — Claude Code Handoff

**Type:** Diagnostic GSD  
**Scope:** Identify and fix "garbled text" and rendering issues in SuperGrid  
**Priority:** P0 — Blocks MVP progress  
**Estimated Time:** 1-2 hours diagnostic, varies for fixes

---

## Context

User reports CC is "struggling with garbled text and other challenges with SuperGrid." This handoff provides a systematic diagnostic approach to identify the root cause and fix it.

**Key Files for SuperGrid:**
```
src/d3/SuperGridEngine/
├── index.ts              # Main API entry point
├── Renderer.ts           # D3 SVG rendering (headers + cells)
├── HeaderManager.ts      # Multi-level header hierarchy building
├── DataManager.ts        # SQL queries and cell generation
├── ClickZoneManager.ts   # Hit-testing for click zones
├── types.ts              # TypeScript type definitions
└── __tests__/            # Unit tests

src/components/supergrid/
├── SuperGrid.tsx         # React wrapper component
├── SuperStack.tsx        # Nested header component
├── DensityControls.tsx   # Janus density UI controls
├── SuperGrid.css         # Grid styling
└── SuperStack.css        # Header styling
```

---

## Phase 1: Diagnostic (Run This First)

### Step 1: Verify Tests Pass

```bash
cd /Users/mshaler/Developer/Projects/Isometry
npm run test -- --run src/d3/SuperGridEngine/__tests__/
npm run test -- --run src/test/examples/supergrid-
```

**Expected:** All tests should pass. If tests fail, that indicates where the issue is.

**Record:** 
- [ ] HeaderManager tests: PASS / FAIL (count: ___)
- [ ] Renderer tests: PASS / FAIL (count: ___)
- [ ] Other SuperGridEngine tests: PASS / FAIL (count: ___)
- [ ] Example tests (supergrid-*): PASS / FAIL (count: ___)

### Step 2: Check TypeScript Compilation

```bash
npm run typecheck 2>&1 | grep -E "(SuperGrid|Renderer|HeaderManager|error)"
```

**Record:**
- [ ] TypeScript errors in SuperGrid files: YES / NO
- [ ] If YES, list file:line for each error

### Step 3: Run the App and Inspect Visually

```bash
npm run dev
```

Open http://localhost:5173 and navigate to a SuperGrid view.

**Observe and record:**
- [ ] Does the grid render at all?
- [ ] Are headers visible?
- [ ] Is text appearing garbled (wrong characters, encoding issues)?
- [ ] Is text overlapping or positioned incorrectly?
- [ ] Are cells positioned correctly?
- [ ] Does clicking work?

**Open browser DevTools (F12) → Console tab:**
- [ ] Any JavaScript errors? Copy exact error messages.
- [ ] Any warnings about fonts or encoding?

**Open browser DevTools → Elements tab:**
- [ ] Inspect a header `<text>` element. What is the text content?
- [ ] Inspect a cell `<text>` element. What is the text content?
- [ ] Are there encoding issues (like `â€"` instead of `—`)?

### Step 4: Check Data Flow

Add temporary logging to identify where garbled text originates.

**In `src/d3/SuperGridEngine/HeaderManager.ts`, find `generateHeaderTree()` and add:**

```typescript
// TEMPORARY DEBUG - remove after diagnosis
console.log('[HeaderManager] Column headers:', headerTree.columns.map(h => ({ id: h.id, value: h.value })));
console.log('[HeaderManager] Row headers:', headerTree.rows.map(h => ({ id: h.id, value: h.value })));
```

**In `src/d3/SuperGridEngine/Renderer.ts`, find `renderHeaders()` and add:**

```typescript
// TEMPORARY DEBUG - remove after diagnosis
console.log('[Renderer] Rendering column headers:', headerTree.columns.length);
headerTree.columns.forEach(h => console.log(`  Column: "${h.value}" at (${h.position.x}, ${h.position.y})`));
```

**Reload the app and check console output:**
- [ ] Are header values correct in HeaderManager?
- [ ] Are header values correct in Renderer?
- [ ] Where does garbling first appear?

---

## ⚠️ LIKELY ROOT CAUSE IDENTIFIED

**The CSS file `SuperStack.css` contains comments indicating a KNOWN issue:**

```css
/* CRITICAL: Explicitly set horizontal text to override any cached vertical styles.
   writing-mode: vertical-lr was previously used but caused Thai-like garbled characters
   due to font rendering issues. Must be explicit to bust browser cache. */
```

**Problem:** `writing-mode: vertical-lr` was previously used and caused garbled text that looks like Thai characters. The CSS was "fixed" with `!important` overrides, but:

1. Browser may have cached the old CSS
2. The `!important` rules may not be applying consistently
3. There may be inline styles or other CSS overriding these

### Immediate Fix: Clear Cache and Hard Reload

1. **In Chrome:** Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Or:** Open DevTools → Right-click Reload button → "Empty Cache and Hard Reload"
3. **Or:** DevTools → Application tab → Clear site data

### If Cache Clear Doesn't Work

Check if there are any OTHER places setting `writing-mode`:

```bash
grep -r "writing-mode" src/
grep -r "vertical-lr" src/
grep -r "vertical-rl" src/
```

Remove any `writing-mode: vertical-*` declarations that aren't immediately followed by `!important` overrides.

---

## Phase 2: Common Issues and Fixes

Based on diagnostic results, apply the relevant fix:

### Issue A: UTF-8 Encoding Problems

**Symptoms:** Characters like `–`, `'`, `"` appear as `â€"`, `â€™`, `â€œ`

**Root Cause:** Data was saved/loaded with wrong encoding, or HTML entity escaping is double-applied.

**Fix Location:** `src/d3/SuperGridEngine/DataManager.ts` or data loading

**Fix Pattern:**
```typescript
// If the issue is in SQL query results, ensure proper UTF-8 handling
// sql.js returns strings as UTF-8, but if data was inserted wrong...

// Add sanitization in DataManager.executeGridQuery():
function sanitizeText(text: string): string {
  if (!text) return '';
  // Fix common UTF-8 decoding errors
  return text
    .replace(/â€"/g, '–')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"');
}
```

### Issue B: SVG Text Rendering Incorrectly

**Symptoms:** Text appears but is positioned wrong, overlapping, or cut off

**Root Cause:** D3 `<text>` element positioning or viewBox issues

**Fix Location:** `src/d3/SuperGridEngine/Renderer.ts`

**Check these properties in `renderHeaders()`:**
```typescript
// Ensure text is properly centered in header
g.select('text')
  .attr('x', d.position.width / 2)        // Center horizontally
  .attr('y', d.position.height / 2)       // Center vertically
  .attr('text-anchor', 'middle')          // Horizontal alignment
  .attr('dominant-baseline', 'middle')    // Vertical alignment
  .style('font-size', '11px')             // Readable size
  .text(d => d.value);                    // The actual text
```

### Issue C: Multi-Level Header Values Are Wrong

**Symptoms:** Headers show wrong values, or pipe characters `|` appear in display

**Root Cause:** `parseMultiLevelValue()` in HeaderManager not being called, or values not being extracted correctly

**Fix Location:** `src/d3/SuperGridEngine/HeaderManager.ts`

**Verify this function exists and is called:**
```typescript
function parseMultiLevelValue(value: string): string[] {
  if (!value || !value.includes('|')) {
    return [value || 'Unassigned'];
  }
  return value.split('|').map(v => v.trim());
}
```

**In `generateHeaderTree()`, verify multi-level parsing:**
```typescript
// Step 3: Parse multi-level values
const xAxisValues = sortedXEntries.map(([, value]) => parseMultiLevelValue(value));
```

### Issue D: Headers Not Rendering At All

**Symptoms:** Grid cells appear but headers are missing

**Root Cause:** Empty header arrays, z-index issues, or SVG group structure problems

**Fix Location:** `src/d3/SuperGridEngine/Renderer.ts`

**Check SVG structure:**
```typescript
// In setupSVG(), verify groups are created:
const mainGroup = this.svg.append('g').attr('class', 'supergrid-main');
mainGroup.append('g').attr('class', 'headers');  // Must exist!
mainGroup.append('g').attr('class', 'cells');

// In renderHeaders(), verify selection is correct:
const headersGroup = this.svg.select('.headers');
if (headersGroup.empty()) {
  console.error('[Renderer] Headers group not found!');
}
```

### Issue E: Data Not Loading from SQLite

**Symptoms:** Grid is empty, "No Data" message appears

**Root Cause:** sql.js query failing or returning empty results

**Fix Location:** `src/d3/SuperGridEngine/DataManager.ts` or `src/hooks/useSQLiteQuery.ts`

**Add diagnostic logging:**
```typescript
// In DataManager or wherever SQL is executed
const sql = "SELECT * FROM nodes WHERE deleted_at IS NULL LIMIT 100";
console.log('[DataManager] Executing query:', sql);
const results = db.exec(sql);
console.log('[DataManager] Query returned:', results.length, 'result sets');
if (results.length > 0) {
  console.log('[DataManager] First result has', results[0].values.length, 'rows');
}
```

---

## Phase 3: After Fixing

### 1. Remove Debug Logging

Search for and remove all `console.log('[HeaderManager]'`, `console.log('[Renderer]'`, etc.

### 2. Run Tests

```bash
npm run test -- --run
```

All tests must pass.

### 3. Run Type Check

```bash
npm run typecheck
```

Zero errors required.

### 4. Run Lint

```bash
npm run lint
```

### 5. Commit

```bash
git add -A
git commit -m "fix(supergrid): resolve [specific issue description]

- [What was wrong]
- [How it was fixed]
- [Tests added/verified]"
```

---

## Escalation Paths

### If tests themselves are garbled:
Check file encoding. All source files should be UTF-8.
```bash
file -I src/d3/SuperGridEngine/*.ts
```
Should show `text/x-typescript; charset=utf-8`

### If sql.js is not loading:
```bash
npm run test -- --run src/db/tests/
```
Check that FTS5 and basic queries work.

### If D3 is not rendering SVG:
Check that D3 is imported correctly and the container element exists.
```typescript
// In Renderer.ts setupSVG()
console.log('Container element:', container);
console.log('Container dimensions:', container.clientWidth, container.clientHeight);
```

---

## Reference: Expected Data Flow

```
1. SQLite (sql.js)
   │
   └─▶ DataManager.executeGridQuery()
       Returns: CellDescriptor[] with xValue, yValue, nodeIds
       │
       └─▶ HeaderManager.generateHeaderTree()
           Parses xValue/yValue into HeaderDescriptor[]
           │
           └─▶ Renderer.render()
               Binds data to SVG elements with D3.js
               │
               ├─▶ renderHeaders() → <g class="headers">
               │   └─▶ <text> elements with header.value
               │
               └─▶ renderCells() → <g class="cells">
                   └─▶ <text> elements with cell content
```

At each stage, log the values to find where corruption occurs.

---

## Success Criteria

- [ ] Grid renders with correct text (no garbled characters)
- [ ] Headers display proper hierarchy values
- [ ] Cells show correct content
- [ ] All SuperGrid tests pass
- [ ] TypeScript compiles without errors
- [ ] Debug logging removed before commit
