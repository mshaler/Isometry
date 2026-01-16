# Isometry DSL Implementation Plan

*Query Language for LATCH*GRAPH Filtering*

---

## Overview

The Isometry DSL provides a human-readable query language for filtering and navigating data. It compiles to SQL WHERE clauses for SQLite execution.

## Syntax Examples

### Basic Filters
```
status:active                    # Category filter
due:<2024-02-01                  # Time filter (before)
due:>2024-01-01                  # Time filter (after)
priority:>=3                     # Hierarchy filter
name:~"quarterly"                # Text search (contains)
```

### Compound Filters
```
status:active AND priority:>3
project:"Q1 Launch" OR project:"Q2 Planning"
NOT status:archived
(status:active OR status:pending) AND priority:5
```

### LATCH Axis Shortcuts
```
@location:"Boulder, CO"          # L - Location
@alpha:A-M                       # A - Alphabetic range
@time:last-week                  # T - Time preset
@category:work                   # C - Category
@hierarchy:top-10                # H - Hierarchy/ranking
```

### Time Presets
```
created:today
created:yesterday
created:last-week
created:last-month
created:this-year
modified:last-7-days
due:next-week
due:overdue
```

### GRAPH Traversals
```
linked-to:card-123               # Direct links
path-to:card-456                 # Any path
neighbors:2                      # Within 2 hops
similar-to:card-789              # Vector similarity
```

---

## Grammar (PEG.js)

See `src/dsl/grammar/IsometryDSL.pegjs` for full grammar.

### Token Types

| Token | Example | Description |
|-------|---------|-------------|
| `FIELD` | `status`, `due`, `priority` | Property name |
| `OPERATOR` | `:`, `:<`, `:>`, `:>=`, `:<=`, `:~` | Comparison |
| `VALUE` | `active`, `"Q1 Launch"`, `5` | Literal value |
| `LOGIC` | `AND`, `OR`, `NOT` | Boolean operators |
| `PAREN` | `(`, `)` | Grouping |
| `AXIS` | `@location`, `@time` | LATCH shortcuts |

---

## Compilation Pipeline

```
DSL String
    ↓
┌─────────────┐
│   Lexer     │  Tokenize input
└─────────────┘
    ↓
┌─────────────┐
│   Parser    │  Build AST (PEG.js)
└─────────────┘
    ↓
┌─────────────┐
│  Analyzer   │  Validate fields, types
└─────────────┘
    ↓
┌─────────────┐
│  Compiler   │  Generate SQL WHERE
└─────────────┘
    ↓
SQL WHERE Clause
```

---

## AST Node Types

```typescript
interface FilterNode {
  type: 'filter';
  field: string;
  operator: '=' | '<' | '>' | '<=' | '>=' | '~';
  value: string | number | boolean;
}

interface LogicalNode {
  type: 'and' | 'or';
  left: ASTNode;
  right: ASTNode;
}

interface NotNode {
  type: 'not';
  operand: ASTNode;
}

interface GroupNode {
  type: 'group';
  expression: ASTNode;
}

type ASTNode = FilterNode | LogicalNode | NotNode | GroupNode;
```

---

## SQL Compilation Examples

| DSL | SQL WHERE |
|-----|-----------|
| `status:active` | `WHERE status = 'active'` |
| `priority:>3` | `WHERE priority > 3` |
| `name:~"report"` | `WHERE name LIKE '%report%'` |
| `status:active AND priority:5` | `WHERE status = 'active' AND priority = 5` |
| `due:<2024-02-01` | `WHERE due < '2024-02-01'` |
| `@time:last-week` | `WHERE created >= date('now', '-7 days')` |

---

## Implementation Phases

### Phase 1: Core Parser (v3.0)
- [ ] Basic field:value syntax
- [ ] Comparison operators (=, <, >, <=, >=)
- [ ] Text search (~)
- [ ] AND, OR, NOT logic
- [ ] Parenthetical grouping
- [ ] Quoted strings

### Phase 2: LATCH Shortcuts (v3.1)
- [ ] @location with geocoding
- [ ] @alpha ranges
- [ ] @time presets
- [ ] @category suggestions
- [ ] @hierarchy rankings

### Phase 3: GRAPH Queries (v3.2)
- [ ] linked-to traversal
- [ ] path-to pathfinding
- [ ] neighbors hop limit
- [ ] similar-to vector search

### Phase 4: Advanced Features (v4.0)
- [ ] Saved filters
- [ ] Filter variables
- [ ] Aggregations (COUNT, SUM, AVG)
- [ ] Subqueries

---

## Error Handling

```typescript
interface ParseError {
  message: string;
  position: number;
  line: number;
  column: number;
  expected: string[];
  found: string;
}
```

### Error Display in CommandBar
- Underline error position in red
- Show tooltip with expected tokens
- Suggest corrections via autocomplete

---

## Autocomplete Strategy

1. **Field names**: Query schema for available properties
2. **Operators**: Based on field type (text vs number vs date)
3. **Values**: Query distinct values from SQLite
4. **Presets**: Offer time presets when field is date type

```typescript
interface AutocompleteItem {
  label: string;
  type: 'field' | 'operator' | 'value' | 'preset';
  insertText: string;
  documentation?: string;
}
```

---

## Testing Strategy

```typescript
// Unit tests for parser
describe('DSL Parser', () => {
  test('parses simple filter', () => {
    const ast = parse('status:active');
    expect(ast).toEqual({
      type: 'filter',
      field: 'status',
      operator: '=',
      value: 'active'
    });
  });
  
  test('parses compound filter', () => {
    const ast = parse('status:active AND priority:>3');
    expect(ast.type).toBe('and');
  });
});

// Integration tests for compiler
describe('DSL Compiler', () => {
  test('compiles to SQL', () => {
    const sql = compile('status:active AND priority:>3');
    expect(sql).toBe("status = 'active' AND priority > 3");
  });
});
```

---

## Files

```
specs/dsl/
└── DSL_IMPLEMENTATION_PLAN.md   # This document

src/dsl/
├── grammar/
│   └── IsometryDSL.pegjs        # PEG.js grammar
├── parser.ts                     # Parse DSL → AST
├── compiler.ts                   # Compile AST → SQL
├── autocomplete.ts               # Suggestion engine
└── types.ts                      # TypeScript interfaces
```
