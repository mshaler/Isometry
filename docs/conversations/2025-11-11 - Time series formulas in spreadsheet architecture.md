# Time series formulas in spreadsheet architecture

**Date:** 2025-11-11 08:11

## Summary

**Conversation Overview**

The user engaged in a detailed technical discussion about CardBoard, their data visualization platform that combines SuperGrid (dimensional data model), HyperFormula (spreadsheet calculations), and D3.js visualization capabilities. The conversation focused on architectural challenges for implementing temporal formulas and time series queries that go beyond traditional spreadsheet operations like "how long has it been since it was last this hot?" The user explained CardBoard's "Janus approach" which provides both explicit computation categories (truth) and audit mode with anomaly detection (fact) to address Excel's fundamental weakness where any cell can be a value or computed value without clear indication.

The discussion evolved into exploring a multi-bridge query language architecture that would connect HyperFormula with SQL, geospatial, temporal, AppleScript, and natural language DSL capabilities. The user demonstrated deep understanding of spreadsheet limitations, noting the irony that Excel's greatest strength (implicit computation flexibility) is also its greatest weakness due to silent errors and unclear data lineage. They emphasized how CardBoard's audit mode would make Excel-style "cheating" (copy-paste formulas row-by-row) detectable and visible rather than preventing it entirely.

Claude provided detailed architectural recommendations including a dual-path approach (structural vs temporal formulas), explicit computation categories with visual indicators, and a comprehensive bridge system using intermediate representation (IR) to translate between different query languages. The user showed particular interest in the complexity assessment and phased implementation approach, with Claude estimating 3-5 months for full implementation across six different bridges ranging from low complexity (HyperFormula, SQLite) to high complexity (natural language DSL). The conversation concluded with discussion of incremental compilation strategies and the technical challenges of bidirectional translation, semantic ambiguity, and performance optimization across different execution engines.

---

## Human

Given the multidimensional capabilities of SuperGrid and the formula and function power of HyperFormula, formulas are primarily created as an additional sibling category (“YTD Revenue = Q1 + Q2 + Q3 + Q4”). But users will also want to measure by other approaches such as time series (“how long has it been since it was last this hot?”). What is the best way to create formulas that solve for such needs?

## Assistant

 This is a fascinating architectural challenge that touches on the core tension between CardBoard's polymorphic data model and traditional spreadsheet formula paradigms.

## The Core Problem

HyperFormula excels at **structural relationships** (cell references, ranges, aggregations across defined dimensions), but struggles with **temporal queries** that require:
- Sequential ordering independent of grid structure
- Lookback windows ("last time X happened")
- Gaps and interpolation
- Rate of change calculations

## Architectural Approaches

### 1. **Temporal Dimension as First-Class Citizen**

Treat time as a special dimension in SuperGrid that gets automatic indexing:

```javascript
// In your SQLite schema
CREATE INDEX idx_temporal_sort ON cells(
  temporal_dimension_value, 
  timestamp
);

// D3 binding for temporal queries
const timeSeriesView = d3.group(data, d => d.timestamp)
  .sort((a, b) => a.key - b.key);
```

This allows formulas like:
- `=LAST_OCCURRENCE(temperature > 95, "date")`
- `=DAYS_SINCE(condition)`
- `=MOVING_AVERAGE(revenue, 30, "days")`

### 2. **Hybrid Formula Layer**

Extend HyperFormula with custom functions that bridge to D3's time series capabilities:

```javascript
// Register temporal functions in HyperFormula
hyperformula.addFunction('TIME_SINCE', {
  method: (condition, dimension) => {
    // Escape to D3 for temporal logic
    const sortedData = d3.sort(cellData, d => d[dimension]);
    const lastMatch = sortedData.findLast(d => evaluate(condition, d));
    return dateDiff(now, lastMatch[dimension]);
  }
});
```

This keeps formula syntax familiar while leveraging D3's data manipulation strengths.

### 3. **Computed Dimension Pattern**

Create synthetic dimensions that materialize temporal relationships:

```javascript
// Generate "days_since_last_event" as computed dimension
const enrichedData = data.map(d => ({
  ...d,
  days_since_threshold: computeDaysSince(
    data.filter(x => x.temp > threshold && x.date < d.date),
    d.date
  )
}));
```

Then use standard HyperFormula aggregations: `=MAX(days_since_threshold)`

## Recommendation: Dual-Path Architecture

**Path 1: Structural (HyperFormula)**
- Cell references, ranges, cross-tab calculations
- Works with SuperGrid's dimensional model naturally
- Fast, cached, recalculates on dependency changes

**Path 2: Temporal (D3 + Custom Functions)**
- Time series queries, sequence analysis, lookback windows
- Registered as HyperFormula custom functions
- Computed on-demand or with smart invalidation

```javascript
// Formula categories in UI
{
  structural: "=SUM(Q1:Q4)",      // Pure HyperFormula
  temporal: "=DAYS_SINCE(temp > 95)", // D3-backed custom function
  hybrid: "=GROWTH_RATE(revenue, 7, 'days')" // Combines both
}
```

## Implementation Strategy

1. **Define temporal primitives**: `LAST_OCCURRENCE`, `DAYS_SINCE`, `TIME_BETWEEN`, `MOVING_WINDOW`
2. **Build D3 indexing layer** for efficient temporal queries (sorted arrays, binary search)
3. **Register with HyperFormula** as custom functions with proper dependency tracking
4. **Cache temporal computations** using D3's data binding (only recompute when temporal dimension changes)

This leverages HyperFormula's strengths while acknowledging that temporal queries are fundamentally different from structural spreadsheet operations. The D3 backing gives you the flexibility to handle complex time series logic that would be awkward in pure spreadsheet formulas.

Does this align with your vision for how formulas should work across CardBoard's different view modalities?

## Human

It does and the irony is that Excel’s greatest strength is that any cell can be a value, computed value, format, or computed format without any obvious indication which is primary—and is therefore also its greatest weakness, especially given the vast number of errors in traditional spreadsheets. Cardboard users could do simple copy-and-paste formulas to do time-series calculations row-by-row, also known as cheating, kind of. Or at least the same broken approach.

## Assistant

 Exactly! You've identified the fundamental paradox of spreadsheet flexibility: **implicit computation is both magical and catastrophic**.

## The Excel Problem

```
| Date       | Temp | Days Since >95 |
|------------|------|----------------|
| 2024-01-01 | 87   | 45             |  ← Is this a value or formula?
| 2024-01-02 | 96   | 0              |  ← Was this copied wrong?
| 2024-01-03 | 94   | =A3-$A$2       |  ← Oops, someone edited this one
| 2024-01-04 | 98   | 1              |  ← Copy-paste broke here
```

Nobody knows what's authoritative. The "fill down" pattern creates **data masquerading as logic**, making debugging impossible and creating silent errors that propagate through entire organizations.

## CardBoard's Opportunity: Explicit Computation Categories

Since you're building from scratch, you can enforce **clear semantic boundaries**:

### 1. **Value** (immutable data)
- Imported from ETL
- User-entered
- Historical snapshot
- Visual indicator: plain text

### 2. **Structural Formula** (dimensional computation)
- `=SUM(Q1:Q4)` across defined dimensions
- Recalculates when dimensional data changes
- Visual indicator: subtle `fx` icon or color tint

### 3. **Temporal Formula** (sequence-aware)
- `=DAYS_SINCE(temp > 95)` 
- **Cannot be copy-pasted** row-by-row
- Must be defined as a **dimension-wide rule**
- Visual indicator: clock icon, distinct color

### 4. **Derived Dimension** (materialized computation)
- One-time calculation that becomes immutable data
- "Freeze this formula as values"
- Explicit user action required
- Visual indicator: lock icon

## Preventing "Cheating"

```javascript
// In CardBoard's formula system
const formulaTypes = {
  structural: {
    scope: 'cell',
    copyable: true,
    fillDown: true
  },
  temporal: {
    scope: 'dimension',  // NOT cell-level
    copyable: false,     // Cannot create row-by-row copies
    fillDown: false,
    requiresDefinition: true  // Must define the rule once
  }
};
```

When a user tries to create a temporal formula:

**Bad (Excel way):**
- Click cell, type `=A3-A2`, fill down → silent breakage

**Good (CardBoard way):**
- Right-click column header → "Add Temporal Formula"
- Define rule once: `DAYS_SINCE(temperature > threshold, date_dimension)`
- Applies to entire dimension automatically
- Cannot be individually edited per row

## UI/UX Implications

**Visual hierarchy:**
```
[Value]               black text
[Structural Formula]  blue text, fx icon
[Temporal Formula]    orange text, clock icon, dimension-scoped badge
[Derived/Frozen]      gray text, lock icon
```

**Error prevention:**
- Temporal formulas show in a special panel, not inline editing
- Copy-paste of temporal formulas prompts: "This is a temporal rule. Apply to entire dimension?"
- Fill-down is **disabled** for temporal formulas

## The Middle Ground: Row Context Formulas

Sometimes you DO want row-by-row logic that's safe:

```javascript
// Allowed: Simple row-context calculation
=current_temperature - previous_temperature  // Delta column

// Not allowed: Temporal lookback that seems row-level
=DAYS_SINCE(temp > 95)  // Forces dimension-level definition
```

The difference: **Row context formulas reference current row properties** (structural). **Temporal formulas query the entire sequence** (must be dimension-scoped).

## The Enforcement Layer

In your D3/SQLite architecture:

```javascript
// Store formula metadata
CREATE TABLE formulas (
  id TEXT PRIMARY KEY,
  formula_text TEXT,
  formula_type TEXT CHECK(formula_type IN ('structural', 'temporal', 'derived')),
  scope TEXT CHECK(scope IN ('cell', 'dimension', 'global')),
  target_dimension TEXT,
  created_at TIMESTAMP,
  is_mutable BOOLEAN
);
```

This makes "cheating" impossible because **temporal formulas are stored as dimension-level rules**, not cell-level values. The D3 rendering layer applies them consistently.

---

**Bottom line:** CardBoard can learn from Excel's mistake by making the **computation model explicit in the data model itself**, not just in the UI. The "fill down" pattern only works for structural formulas; temporal queries must be dimension-scoped by design.

Does this kind of enforced semantic clarity feel right for CardBoard's vision, or too restrictive?

## Human

The beauty of our Janus approach is that it gives users the power of truth (explicit computation categories) and fact (Audit mode coupled with anomaly detection) so that at least all the Excel tricks are not just easily detectable but highly visible.

## Assistant

 **Exactly!** This is brilliant architectural judo - you're not fighting Excel's flexibility, you're making its chaos **transparent and auditable**.

## The Janus Advantage

**Truth Side (Left Brain):** Explicit semantic model
- Formulas are categorized and scoped
- Temporal rules are dimension-level
- Data lineage is clear

**Fact Side (Right Brain):** "What actually happened"
- User copied formula down 47 rows
- Cell C23 has different logic than C24
- Someone manually overwrote a computed value

## Audit Mode as First-Class Feature

```javascript
// In your SQLite schema
CREATE TABLE cell_audit_log (
  cell_id TEXT,
  timestamp TIMESTAMP,
  event_type TEXT, -- 'formula_created', 'value_overridden', 'copy_paste', 'fill_down'
  before_state JSON,
  after_state JSON,
  formula_divergence BOOLEAN, -- Did this break consistency?
  user_action TEXT
);
```

## Visual Audit Modes

### 1. **Formula Consistency View**
D3 heatmap overlay showing divergent formulas:
```javascript
const formulaGroups = d3.rollup(cells, 
  v => new Set(v.map(d => d.formula_text)),
  d => d.column_id
);

// Highlight cells where formula differs from column mode
cells.each(function(d) {
  if (d.formula !== columnMode[d.column]) {
    d3.select(this).classed('formula-anomaly', true);
  }
});
```

**Visual**: Cells with non-standard formulas glow orange/red

### 2. **Computation Type View**
Color-code by what's actually driving the value:
- **Green**: Pure imported data
- **Blue**: Consistent structural formula
- **Purple**: Consistent temporal formula  
- **Orange**: Formula with manual override
- **Red**: One-off formula (copy-paste divergence)
- **Gray**: Stale/broken computation

### 3. **Lineage Graph View**
Switch to graph mode showing computation dependencies:
```javascript
// D3 force-directed graph
const dependencies = {
  nodes: cells,
  links: cells.flatMap(c => 
    c.formula_refs.map(ref => ({
      source: ref,
      target: c.id,
      type: c.is_anomalous ? 'broken' : 'normal'
    }))
  )
};
```

Broken references, circular dependencies, and divergent logic become **visually obvious**.

## Anomaly Detection Patterns

**Pattern 1: Copy-Paste Divergence**
```javascript
// Detect when fill-down created subtle formula shifts
const detectDivergence = (column) => {
  const formulas = column.cells.map(c => normalizeFormula(c.formula));
  const uniqueFormulas = new Set(formulas);
  
  if (uniqueFormulas.size > 1) {
    return {
      severity: 'high',
      message: `Column has ${uniqueFormulas.size} different formulas`,
      affectedCells: findDivergentCells(column)
    };
  }
};
```

**Pattern 2: Manual Override Detection**
```javascript
// Cell has formula but value was manually typed
const detectOverride = (cell) => {
  if (cell.formula && cell.last_edit_type === 'manual_value') {
    return {
      severity: 'medium',
      message: 'Computed value manually overridden',
      original: cell.formula_result,
      current: cell.value
    };
  }
};
```

**Pattern 3: Stale Computation**
```javascript
// Formula references cells that changed, but this cell didn't recalc
const detectStale = (cell) => {
  const lastRecalc = cell.last_recalc_timestamp;
  const depTimestamps = cell.dependencies.map(d => d.last_modified);
  
  if (Math.max(...depTimestamps) > lastRecalc) {
    return {
      severity: 'critical',
      message: 'Formula not recalculated after dependency change'
    };
  }
};
```

## The Audit Panel

**Right sidebar in Audit Mode:**
```
┌─ AUDIT INSIGHTS ────────────────┐
│ ⚠️  23 formula inconsistencies   │
│ 🔴 5 manual overrides           │
│ 🟡 12 cells with unique logic   │
│ 🔵 2 circular dependencies      │
│                                 │
│ [View All] [Fix Batch]          │
└─────────────────────────────────┘

COLUMN: "Days Since Hot"
├─ Expected: DAYS_SINCE(temp>95)
├─ Consistent: 45 cells ✓
├─ Divergent: 3 cells ⚠️
│  ├─ Row 23: =A23-A$12 (manual formula)
│  ├─ Row 47: 15 (manual value)
│  └─ Row 89: =DATEDIF(...) (different logic)
└─ [Standardize Column]
```

## The Reconciliation Workflow

When anomalies are detected:

1. **Show, don't judge**: "Row 47 has manual value `15`, formula would compute `12`"
2. **Offer corrections**: 
   - "Apply formula to all divergent cells"
   - "Convert column to pure values (freeze)"
   - "Keep exceptions, mark as intentional overrides"
3. **Track decisions**: Log whether user accepted anomaly or fixed it

## Kanban Integration

In Kanban view, anomalies become **workflow signals**:
- Cards with stale computations move to "Needs Refresh" swim lane
- Cards with manual overrides get "Review Required" tag
- Temporal formula failures trigger notifications

## The Power Move: Audit History Replay

```javascript
// Time-travel debugging for formulas
const replayFormula = (cell, timestamp) => {
  const historicalState = getStateAt(timestamp);
  const historicalDeps = getDependenciesAt(cell, timestamp);
  return recomputeWith(cell.formula, historicalState, historicalDeps);
};
```

"Why did this cell show $5,000 last Tuesday?" → Replay shows exactly which inputs changed.

---

## The Janus Philosophy Applied

**Truth**: "This is what the system should compute"
**Fact**: "This is what's actually in the cells"
**Synthesis**: Audit mode shows the delta, user decides how to resolve

You're not preventing Excel-style chaos - you're making it **visible, traceable, and fixable**. The D3 visualization layer makes anomalies impossible to miss, and the SQLite audit log makes every change traceable.

This is how you get Excel's flexibility without Excel's silent corruption. The users can still "cheat" if they want - but they can't cheat **invisibly**.

Does this capture the Janus audit philosophy you're envisioning?

## Human

Which also highlights the likely need for different calculation and query language bridges between HyperFormula and SQL and geospatial and temporal and AppleScript and/or user-defined spoken/automated DSL tuned for CardBoard. How hard/complex would that be?

## Assistant

 
```
This block is not supported on your current device yet.
```

**Not as hard as it sounds, but definitely non-trivial.** The key is treating it as a **translation layer architecture** rather than building one unified mega-language.

## Architectural Pattern: Domain Bridges

Each domain gets a **lightweight translator** that converts between its native query language and a common intermediate representation (IR):

```javascript
// Common IR: Abstract Syntax Tree
const IR = {
  type: 'query',
  operation: 'filter',
  source: 'cells',
  conditions: [
    { field: 'temperature', operator: '>', value: 95 },
    { field: 'date', operator: 'between', value: ['2024-01-01', '2024-12-31'] }
  ],
  aggregation: { function: 'count', groupBy: 'month' }
};
```

## The Bridge Zoo

### 1. **HyperFormula Bridge** (Already exists, extend it)
**Complexity: LOW**

```javascript
// HyperFormula → IR
class HyperFormulaBridge {
  parse(formula) {
    // "=COUNTIFS(temp, ">95", date, ">=2024-01-01")"
    const ast = HyperFormula.parse(formula);
    return this.astToIR(ast);
  }
  
  compile(ir) {
    // IR → HyperFormula string
    return this.irToFormula(ir);
  }
}
```

Most structural formulas already work. Just need custom functions for temporal/spatial.

### 2. **SQLite Bridge**
**Complexity: LOW-MEDIUM**

```javascript
class SQLBridge {
  compile(ir) {
    // IR → SQLite query
    const { source, conditions, aggregation } = ir;
    
    return `
      SELECT ${aggregation.function}(*) as result
      FROM ${source}
      WHERE ${conditions.map(c => `${c.field} ${c.operator} ${c.value}`).join(' AND ')}
      GROUP BY ${aggregation.groupBy}
    `;
  }
  
  parse(sql) {
    // Use sql-parser library to convert SQL → IR
    return sqlParser.parse(sql).toIR();
  }
}
```

Libraries like `node-sql-parser` do 80% of the work. The hard part is **bidirectional** translation.

### 3. **Temporal Bridge** (D3 + date-fns)
**Complexity: MEDIUM**

```javascript
class TemporalBridge {
  // Custom DSL for temporal queries
  parse(temporalQuery) {
    // "DAYS_SINCE(temp > 95) as of 2024-06-01"
    return {
      type: 'temporal',
      operation: 'days_since',
      condition: { field: 'temp', operator: '>', value: 95 },
      reference_date: '2024-06-01',
      dimension: 'date'
    };
  }
  
  execute(ir, data) {
    // Use D3 for temporal operations
    const sorted = d3.sort(data, d => d[ir.dimension]);
    const referenceDate = new Date(ir.reference_date);
    
    const lastMatch = sorted
      .filter(d => new Date(d[ir.dimension]) <= referenceDate)
      .findLast(d => this.evaluateCondition(d, ir.condition));
    
    return dateFns.differenceInDays(referenceDate, new Date(lastMatch[ir.dimension]));
  }
}
```

This is where you define CardBoard-specific temporal primitives.

### 4. **Geospatial Bridge** (Turf.js)
**Complexity: MEDIUM**

```javascript
class GeospatialBridge {
  parse(geoQuery) {
    // "DISTANCE_FROM(location, [37.7749, -122.4194]) < 5 miles"
    return {
      type: 'geospatial',
      operation: 'distance',
      from_field: 'location',
      to_point: { lat: 37.7749, lon: -122.4194 },
      unit: 'miles',
      threshold: 5
    };
  }
  
  execute(ir, data) {
    // Use Turf.js for geospatial operations
    const targetPoint = turf.point([ir.to_point.lon, ir.to_point.lat]);
    
    return data.filter(d => {
      const cellPoint = turf.point([d[ir.from_field].lon, d[ir.from_field].lat]);
      const distance = turf.distance(cellPoint, targetPoint, { units: ir.unit });
      return distance < ir.threshold;
    });
  }
}
```

Turf.js has 100+ geospatial operations. You just expose the useful ones.

### 5. **AppleScript Bridge** (JXA wrapper)
**Complexity: MEDIUM-HIGH**

```javascript
class AppleScriptBridge {
  async execute(ir) {
    // IR → AppleScript/JXA
    const script = this.compileToJXA(ir);
    
    // Execute via Node.js child_process
    const { execSync } = require('child_process');
    const result = execSync(`osascript -l JavaScript -e '${script}'`);
    
    return JSON.parse(result);
  }
  
  compileToJXA(ir) {
    // Example: Query calendar events
    if (ir.type === 'calendar_query') {
      return `
        const Calendar = Application('Calendar');
        const events = Calendar.calendars.byName('${ir.calendar}')
          .events.whose({ startDate: { _greaterThan: new Date('${ir.start_date}') } });
        JSON.stringify(events.map(e => ({ title: e.summary(), date: e.startDate() })));
      `;
    }
  }
}
```

The complexity here is **error handling** and **permissions**. macOS sandbox makes this tricky.

### 6. **Natural Language DSL** (User-friendly CardBoard syntax)
**Complexity: HIGH**

```javascript
class CardBoardDSL {
  parse(naturalQuery) {
    // "Show me tasks created last week that are still open"
    
    // Use simple pattern matching or lightweight NLP
    const patterns = {
      'created last week': { field: 'created_at', operator: 'between', value: getLastWeek() },
      'still open': { field: 'status', operator: '=', value: 'open' }
    };
    
    return {
      type: 'query',
      source: 'tasks',
      conditions: this.matchPatterns(naturalQuery, patterns)
    };
  }
}
```

**OR** use LLM-in-the-loop:

```javascript
class LLMBridge {
  async parse(naturalQuery) {
    // Send to Claude API
    const prompt = `
      Convert this natural language query to CardBoard IR format:
      "${naturalQuery}"
      
      Available fields: ${JSON.stringify(schema)}
    `;
    
    const response = await callClaudeAPI(prompt);
    return JSON.parse(response);
  }
}
```

This is the most powerful but requires API calls.

## The Unified Query Interface

```javascript
class CardBoardQueryEngine {
  constructor() {
    this.bridges = {
      formula: new HyperFormulaBridge(),
      sql: new SQLBridge(),
      temporal: new TemporalBridge(),
      geo: new GeospatialBridge(),
      applescript: new AppleScriptBridge(),
      natural: new CardBoardDSL(),
      llm: new LLMBridge()
    };
  }
  
  async execute(query, context = {}) {
    // Auto-detect query type
    const bridge = this.detectBridge(query);
    
    // Parse to IR
    const ir = await bridge.parse(query);
    
    // Optimize IR (combine operations, push down filters)
    const optimized = this.optimize(ir);
    
    // Execute via appropriate backend
    if (this.canExecuteInSQL(optimized)) {
      return this.executeInSQLite(optimized);
    } else if (this.requiresD3(optimized)) {
      return this.executeInD3(optimized, context.data);
    } else {
      return bridge.execute(optimized, context);
    }
  }
  
  detectBridge(query) {
    if (query.startsWith('=')) return this.bridges.formula;
    if (query.toUpperCase().startsWith('SELECT')) return this.bridges.sql;
    if (query.includes('DAYS_SINCE') || query.includes('TIME_')) return this.bridges.temporal;
    if (query.includes('DISTANCE') || query.includes('WITHIN')) return this.bridges.geo;
    if (query.includes('tell application')) return this.bridges.applescript;
    return this.bridges.natural; // Default to natural language
  }
}
```

## Complexity Assessment

| Bridge | Complexity | Effort | Key Libraries |
|--------|-----------|--------|---------------|
| HyperFormula | LOW | 1-2 weeks | HyperFormula (already using) |
| SQLite | LOW | 1 week | node-sql-parser, better-sqlite3 |
| Temporal | MEDIUM | 2-3 weeks | D3, date-fns, custom DSL |
| Geospatial | MEDIUM | 2-3 weeks | Turf.js, proj4 |
| AppleScript | MEDIUM-HIGH | 3-4 weeks | Node child_process, JXA |
| Natural DSL | HIGH | 4-6 weeks | Pattern matching + fallback to LLM |

**Total estimate: 3-5 months for full implementation**

But you can **phase it**:

### Phase 1 (MVP): 4 weeks
- HyperFormula bridge (extend existing)
- SQLite bridge (basic SELECT/WHERE/GROUP BY)
- Temporal bridge (5-10 core functions)

### Phase 2: 6 weeks
- Geospatial bridge
- AppleScript bridge (read-only first)
- Natural DSL (pattern matching only)

### Phase 3: 8 weeks
- LLM-powered natural language
- Advanced temporal operations
- Full AppleScript read/write

## The Hardest Parts

1. **Bidirectional translation**: Easy to go IR → SQL, harder to go SQL → IR
2. **Semantic ambiguity**: "Last week" means different things in different contexts
3. **Performance**: Some IR patterns are fast in SQL, slow in D3 (and vice versa)
4. **Error messages**: When a query fails, which bridge reports the error?
5. **AppleScript sandbox**: macOS security makes automating apps painful

## The Secret Weapon: Incremental Compilation

Don't try to support every query pattern day one. Start with **explicit DSL syntax**:

```javascript
// CardBoard explicit syntax (easy to parse)
TEMPORAL.days_since(temperature > 95)
GEO.within_radius(location, [37.7, -122.4], 5, 'miles')
SQL.query("SELECT * FROM cells WHERE status = 'open'")
APPLE.calendar.events(calendar: 'Work', start: '2024-01-01')
```

Then **gradually** add natural language sugar as you learn common patterns.

---

**Bottom line**: This is **architecturally clean** but **requires sustained effort**. The good news: each bridge is relatively independent, so you can build/test/ship them incrementally. The D3 + SQLite foundation you already have makes this much easier than if you were starting from scratch.

Want me to sketch out the IR schema in more detail, or dive deeper into one specific bridge?
