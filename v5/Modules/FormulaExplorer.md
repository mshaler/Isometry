# FormulaExplorer

> DSL and SQL formula builder for computed fields and filters

## Purpose

FormulaExplorer provides a formula language for creating computed fields, complex filters, and aggregations. It bridges user-friendly DSL syntax with raw SQL power.

## Architecture

```
┌─────────────────────────────────────────────┐
│              FormulaExplorer                 │
├─────────────────────────────────────────────┤
│  Mode: [DSL ▼] [SQL] [Builder]              │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │  Formula Editor                      │    │
│  │  ┌─────────────────────────────────┐ │    │
│  │  │ DAYS_SINCE(created_at) > 30     │ │    │
│  │  │ AND tags CONTAINS "urgent"      │ │    │
│  │  └─────────────────────────────────┘ │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │  Preview: 142 cards match           │    │
│  │  [Apply Filter] [Save as Field]     │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## DSL Syntax

User-friendly formula language that compiles to SQL:

### Field References
```
title                    → c.title
$.author                 → json_extract(c.raw_import, '$.author')
connections.count        → (SELECT COUNT(*) FROM connections WHERE from_card_id = c.id)
```

### Functions
```
DAYS_SINCE(created_at)   → julianday('now') - julianday(c.created_at)
WORD_COUNT(content)      → LENGTH(content) - LENGTH(REPLACE(content, ' ', '')) + 1
EXTRACT_YEAR(date)       → strftime('%Y', date)
FIRST($.items)           → json_extract(raw_import, '$.items[0]')
```

### Comparisons
```
age > 30                 → age > 30
title CONTAINS "api"     → title LIKE '%api%'
tags HAS "urgent"        → json_each.value = 'urgent'
status IN ("done","wip") → status IN ('done', 'wip')
```

### Aggregations
```
COUNT(*)                 → Aggregate functions
SUM($.amount)            → work in GROUP BY context
AVG(rating)
MAX(created_at)
```

## DSL → SQL Compiler

```javascript
function compileDSL(formula) {
  const ast = parseDSL(formula);
  return generateSQL(ast);
}

// Example compilation
const dsl = 'DAYS_SINCE(created_at) > 30 AND tags HAS "urgent"';
const sql = compileDSL(dsl);
// →  julianday('now') - julianday(c.created_at) > 30
//    AND EXISTS (SELECT 1 FROM json_each(c.tags) WHERE value = 'urgent')
```

## Raw SQL Mode

Power users can write SQL directly:

```sql
-- Complex filter with subquery
SELECT c.* FROM cards c
WHERE c.id IN (
  SELECT DISTINCT from_card_id
  FROM connections
  WHERE edge_type = 'link'
  GROUP BY from_card_id
  HAVING COUNT(*) > 5
)
```

## Visual Builder Mode

Drag-and-drop formula construction:

```
┌─────────────────────────────────────────┐
│  IF                                      │
│  ├── Condition: [status = "done"]       │
│  ├── Then: [1]                          │
│  └── Else: [0]                          │
└─────────────────────────────────────────┘
```

## Computed Fields

Create virtual columns from formulas:

```javascript
const computedFields = [
  {
    name: 'age_days',
    formula: 'DAYS_SINCE(created_at)',
    type: 'number'
  },
  {
    name: 'priority_score',
    formula: 'CASE WHEN tags HAS "urgent" THEN 10 ELSE 1 END * $.importance',
    type: 'number'
  },
  {
    name: 'full_name',
    formula: '$.first_name || " " || $.last_name',
    type: 'string'
  }
];
```

## Formula Library

Saved formulas for reuse:

| Name | Formula | Use |
|------|---------|-----|
| `is_recent` | `DAYS_SINCE(created_at) < 7` | Filter |
| `connection_count` | `COUNT(connections)` | Sizing |
| `reading_time` | `WORD_COUNT(content) / 200` | Display |
| `is_orphan` | `connections.count = 0` | Filter |

## Validation

Real-time formula validation:

```javascript
function validateFormula(formula) {
  try {
    const ast = parseDSL(formula);
    const sql = generateSQL(ast);
    // Test execution with LIMIT 0
    db.exec(`SELECT ${sql} FROM cards LIMIT 0`);
    return { valid: true, sql };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}
```

## Integration

### As Filter
```javascript
filterChain.add({
  type: 'formula',
  expression: 'DAYS_SINCE(created_at) < 30'
});
```

### As Sort
```javascript
projection.sortAxis = {
  formula: '$.importance * connection_count',
  direction: 'desc'
};
```

### As Color Scale
```javascript
projection.colorAxis = {
  formula: 'priority_score',
  scale: d3.scaleSequential(d3.interpolateRdYlGn)
};
```

## Autocomplete

Context-aware suggestions:

```javascript
function getCompletions(partialFormula, cursorPosition) {
  const context = analyzeContext(partialFormula, cursorPosition);

  if (context.expectsField) {
    return [...schemaFields, ...computedFields, ...jsonPaths];
  }
  if (context.expectsFunction) {
    return ['DAYS_SINCE', 'WORD_COUNT', 'EXTRACT_YEAR', ...];
  }
  if (context.expectsOperator) {
    return ['AND', 'OR', 'NOT', '>', '<', '=', 'CONTAINS', 'HAS'];
  }
}
```

## Performance

Formulas are compiled once, executed per-card:

```javascript
// Compile phase (once)
const compiled = compileFormula(userFormula);

// Execution phase (in SQL query)
const results = db.exec(`
  SELECT *, (${compiled.sql}) as computed_value
  FROM cards
  WHERE ${filterSQL}
`);
```

## State

| State | Stored In |
|-------|-----------|
| Current formula | Local editor state |
| Saved formulas | SQLite `formulas` table |
| Computed fields | View configuration |
| Validation result | Local derived state |

## Not Building

- Excel-compatible formula syntax
- Formula debugging/step-through
- Formula versioning/history
- External data lookups in formulas
