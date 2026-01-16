#!/bin/bash

# ============================================================================
# Add DSL Specification Files to Isometry Project
# ============================================================================
# Creates the DSL (Domain Specific Language) specification and implementation
# files for CardBoard/Isometry's query language.
#
# Usage:
#   ./add-dsl-specs.sh [project-path]
#
# Default: ~/Developer/Projects/Isometry
# ============================================================================

set -e

DEFAULT_PROJECT_PATH="$HOME/Developer/Projects/Isometry"
PROJECT_PATH="${1:-$DEFAULT_PROJECT_PATH}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Adding DSL specifications to Isometry...${NC}"
echo ""

mkdir -p "$PROJECT_PATH/specs/dsl"
mkdir -p "$PROJECT_PATH/src/dsl/grammar"

# ============================================================================
# DSL Implementation Plan
# ============================================================================
echo -e "${YELLOW}Creating DSL_IMPLEMENTATION_PLAN.md...${NC}"
cat > "$PROJECT_PATH/specs/dsl/DSL_IMPLEMENTATION_PLAN.md" << 'DSL_PLAN_EOF'
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
DSL_PLAN_EOF

# ============================================================================
# PEG.js Grammar
# ============================================================================
echo -e "${YELLOW}Creating IsometryDSL.pegjs...${NC}"
cat > "$PROJECT_PATH/src/dsl/grammar/IsometryDSL.pegjs" << 'PEGJS_EOF'
// ============================================================================
// Isometry DSL Grammar (PEG.js)
// ============================================================================
// Parses filter expressions into AST for SQL compilation
//
// Examples:
//   status:active
//   priority:>3
//   status:active AND priority:>3
//   (status:active OR status:pending) AND NOT archived:true
// ============================================================================

{
  // Helper to build binary expression nodes
  function buildBinaryExpression(head, tail) {
    return tail.reduce((left, [, op, , right]) => ({
      type: op.toLowerCase(),
      left,
      right
    }), head);
  }
}

// Entry point
Query
  = _ expr:OrExpression _ { return expr; }
  / _ { return null; }

// Logical OR (lowest precedence)
OrExpression
  = head:AndExpression tail:(_ "OR"i _ AndExpression)* {
      return buildBinaryExpression(head, tail);
    }

// Logical AND
AndExpression
  = head:NotExpression tail:(_ "AND"i _ NotExpression)* {
      return buildBinaryExpression(head, tail);
    }

// Logical NOT
NotExpression
  = "NOT"i _ operand:NotExpression {
      return { type: 'not', operand };
    }
  / PrimaryExpression

// Primary expressions (highest precedence)
PrimaryExpression
  = "(" _ expr:OrExpression _ ")" { return { type: 'group', expression: expr }; }
  / AxisFilter
  / Filter

// LATCH axis shortcuts (@location, @time, etc.)
AxisFilter
  = "@" axis:AxisName ":" value:Value {
      return { type: 'axis', axis, value };
    }

AxisName
  = "location"i { return 'location'; }
  / "alpha"i { return 'alphabet'; }
  / "time"i { return 'time'; }
  / "category"i { return 'category'; }
  / "hierarchy"i { return 'hierarchy'; }

// Basic filter: field:value or field:>value
Filter
  = field:Field op:Operator value:Value {
      return { type: 'filter', field, operator: op, value };
    }

// Field names (alphanumeric + underscore)
Field
  = chars:$[a-zA-Z_][a-zA-Z0-9_]* { return chars; }

// Operators
Operator
  = ":>=" { return '>='; }
  / ":<=" { return '<='; }
  / ":>" { return '>'; }
  / ":<" { return '<'; }
  / ":~" { return '~'; }  // Contains/LIKE
  / ":" { return '='; }

// Values
Value
  = QuotedString
  / Number
  / TimePreset
  / Identifier

// Quoted string: "hello world"
QuotedString
  = '"' chars:$[^"]* '"' { return chars; }
  / "'" chars:$[^']* "'" { return chars; }

// Numbers (integer or decimal)
Number
  = chars:$("-"? [0-9]+ ("." [0-9]+)?) { return parseFloat(chars); }

// Time presets
TimePreset
  = "today"i { return { preset: 'today' }; }
  / "yesterday"i { return { preset: 'yesterday' }; }
  / "last-week"i { return { preset: 'last-week' }; }
  / "last-month"i { return { preset: 'last-month' }; }
  / "this-year"i { return { preset: 'this-year' }; }
  / "last-7-days"i { return { preset: 'last-7-days' }; }
  / "last-30-days"i { return { preset: 'last-30-days' }; }
  / "next-week"i { return { preset: 'next-week' }; }
  / "overdue"i { return { preset: 'overdue' }; }

// Unquoted identifier
Identifier
  = chars:$[a-zA-Z0-9_-]+ { return chars; }

// Whitespace
_ "whitespace"
  = [ \t\n\r]*
PEGJS_EOF

# ============================================================================
# TypeScript Types
# ============================================================================
echo -e "${YELLOW}Creating types.ts...${NC}"
cat > "$PROJECT_PATH/src/dsl/types.ts" << 'TYPES_EOF'
// ============================================================================
// Isometry DSL Types
// ============================================================================

/** Filter comparison operators */
export type FilterOperator = '=' | '<' | '>' | '<=' | '>=' | '~';

/** LATCH axis names */
export type LATCHAxis = 'location' | 'alphabet' | 'time' | 'category' | 'hierarchy';

/** Time preset values */
export type TimePreset = 
  | 'today' 
  | 'yesterday' 
  | 'last-week' 
  | 'last-month' 
  | 'this-year'
  | 'last-7-days'
  | 'last-30-days'
  | 'next-week'
  | 'overdue';

/** Value types that can appear in filters */
export type FilterValue = string | number | boolean | { preset: TimePreset };

/** Basic filter node: field:value */
export interface FilterNode {
  type: 'filter';
  field: string;
  operator: FilterOperator;
  value: FilterValue;
}

/** LATCH axis shortcut: @time:last-week */
export interface AxisNode {
  type: 'axis';
  axis: LATCHAxis;
  value: FilterValue;
}

/** Logical AND node */
export interface AndNode {
  type: 'and';
  left: ASTNode;
  right: ASTNode;
}

/** Logical OR node */
export interface OrNode {
  type: 'or';
  left: ASTNode;
  right: ASTNode;
}

/** Logical NOT node */
export interface NotNode {
  type: 'not';
  operand: ASTNode;
}

/** Parenthetical grouping */
export interface GroupNode {
  type: 'group';
  expression: ASTNode;
}

/** Union of all AST node types */
export type ASTNode = 
  | FilterNode 
  | AxisNode 
  | AndNode 
  | OrNode 
  | NotNode 
  | GroupNode;

/** Parse error with position info */
export interface ParseError {
  message: string;
  position: number;
  line: number;
  column: number;
  expected: string[];
  found: string;
}

/** Autocomplete suggestion */
export interface AutocompleteItem {
  label: string;
  type: 'field' | 'operator' | 'value' | 'preset' | 'axis';
  insertText: string;
  documentation?: string;
}

/** Compiled query result */
export interface CompiledQuery {
  sql: string;
  params: (string | number | boolean)[];
}
TYPES_EOF

# ============================================================================
# Parser Stub
# ============================================================================
echo -e "${YELLOW}Creating parser.ts...${NC}"
cat > "$PROJECT_PATH/src/dsl/parser.ts" << 'PARSER_EOF'
// ============================================================================
// Isometry DSL Parser
// ============================================================================
// Parses DSL strings into AST using PEG.js generated parser
//
// Usage:
//   import { parse } from '@/dsl/parser';
//   const ast = parse('status:active AND priority:>3');
// ============================================================================

import type { ASTNode, ParseError } from './types';

// TODO: Generate parser from PEG.js grammar
// npx pegjs src/dsl/grammar/IsometryDSL.pegjs -o src/dsl/grammar/parser.js

/**
 * Parse a DSL string into an AST
 * @param input DSL query string
 * @returns Parsed AST or null for empty input
 * @throws ParseError if input is invalid
 */
export function parse(input: string): ASTNode | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // TODO: Replace with PEG.js generated parser
  // import { parse as pegParse } from './grammar/parser';
  // return pegParse(trimmed);
  
  // Temporary stub - parse simple field:value
  const match = trimmed.match(/^(\w+):(.+)$/);
  if (match) {
    return {
      type: 'filter',
      field: match[1],
      operator: '=',
      value: match[2]
    };
  }
  
  throw {
    message: 'Parse error',
    position: 0,
    line: 1,
    column: 1,
    expected: ['field:value'],
    found: trimmed
  } as ParseError;
}

/**
 * Validate that all fields in AST exist in schema
 * @param ast Parsed AST
 * @param schema Available field names
 * @returns Array of validation errors
 */
export function validate(ast: ASTNode, schema: string[]): string[] {
  const errors: string[] = [];
  
  function walk(node: ASTNode) {
    switch (node.type) {
      case 'filter':
        if (!schema.includes(node.field)) {
          errors.push(`Unknown field: ${node.field}`);
        }
        break;
      case 'and':
      case 'or':
        walk(node.left);
        walk(node.right);
        break;
      case 'not':
        walk(node.operand);
        break;
      case 'group':
        walk(node.expression);
        break;
    }
  }
  
  if (ast) walk(ast);
  return errors;
}
PARSER_EOF

# ============================================================================
# Compiler Stub
# ============================================================================
echo -e "${YELLOW}Creating compiler.ts...${NC}"
cat > "$PROJECT_PATH/src/dsl/compiler.ts" << 'COMPILER_EOF'
// ============================================================================
// Isometry DSL Compiler
// ============================================================================
// Compiles AST to SQL WHERE clause
//
// Usage:
//   import { compile } from '@/dsl/compiler';
//   const { sql, params } = compile(ast);
// ============================================================================

import type { ASTNode, CompiledQuery, FilterOperator, TimePreset } from './types';

/**
 * Compile AST to SQL WHERE clause with parameterized values
 * @param ast Parsed AST
 * @returns SQL string and parameter values
 */
export function compile(ast: ASTNode | null): CompiledQuery {
  if (!ast) {
    return { sql: '1=1', params: [] };
  }
  
  const params: (string | number | boolean)[] = [];
  
  function compileNode(node: ASTNode): string {
    switch (node.type) {
      case 'filter':
        return compileFilter(node.field, node.operator, node.value);
      
      case 'axis':
        return compileAxisFilter(node.axis, node.value);
      
      case 'and':
        return `(${compileNode(node.left)} AND ${compileNode(node.right)})`;
      
      case 'or':
        return `(${compileNode(node.left)} OR ${compileNode(node.right)})`;
      
      case 'not':
        return `NOT (${compileNode(node.operand)})`;
      
      case 'group':
        return `(${compileNode(node.expression)})`;
      
      default:
        return '1=1';
    }
  }
  
  function compileFilter(field: string, operator: FilterOperator, value: any): string {
    // Handle time presets
    if (typeof value === 'object' && 'preset' in value) {
      return compileTimePreset(field, value.preset);
    }
    
    // Handle LIKE operator
    if (operator === '~') {
      params.push(`%${value}%`);
      return `${field} LIKE ?`;
    }
    
    // Handle standard operators
    const sqlOp = operator === '=' ? '=' : operator;
    params.push(value);
    return `${field} ${sqlOp} ?`;
  }
  
  function compileAxisFilter(axis: string, value: any): string {
    // Map LATCH axes to SQL
    switch (axis) {
      case 'time':
        if (typeof value === 'object' && 'preset' in value) {
          return compileTimePreset('created', value.preset);
        }
        params.push(value);
        return `created = ?`;
      
      case 'category':
        params.push(value);
        return `category = ?`;
      
      case 'hierarchy':
        params.push(value);
        return `priority <= ?`;
      
      case 'alphabet':
        // Handle ranges like A-M
        if (typeof value === 'string' && value.includes('-')) {
          const [start, end] = value.split('-');
          return `SUBSTR(name, 1, 1) BETWEEN '${start}' AND '${end}'`;
        }
        params.push(`${value}%`);
        return `name LIKE ?`;
      
      case 'location':
        params.push(value);
        return `location = ?`;
      
      default:
        return '1=1';
    }
  }
  
  function compileTimePreset(field: string, preset: TimePreset): string {
    switch (preset) {
      case 'today':
        return `date(${field}) = date('now')`;
      case 'yesterday':
        return `date(${field}) = date('now', '-1 day')`;
      case 'last-week':
      case 'last-7-days':
        return `${field} >= date('now', '-7 days')`;
      case 'last-month':
      case 'last-30-days':
        return `${field} >= date('now', '-30 days')`;
      case 'this-year':
        return `${field} >= date('now', 'start of year')`;
      case 'next-week':
        return `${field} <= date('now', '+7 days')`;
      case 'overdue':
        return `${field} < date('now')`;
      default:
        return '1=1';
    }
  }
  
  return {
    sql: compileNode(ast),
    params
  };
}

/**
 * Convenience function: parse + compile in one step
 */
export function compileString(dsl: string): CompiledQuery {
  // Import dynamically to avoid circular dependency
  const { parse } = require('./parser');
  const ast = parse(dsl);
  return compile(ast);
}
COMPILER_EOF

# ============================================================================
# Autocomplete Stub
# ============================================================================
echo -e "${YELLOW}Creating autocomplete.ts...${NC}"
cat > "$PROJECT_PATH/src/dsl/autocomplete.ts" << 'AUTOCOMPLETE_EOF'
// ============================================================================
// Isometry DSL Autocomplete
// ============================================================================
// Provides suggestions for DSL input in CommandBar
// ============================================================================

import type { AutocompleteItem } from './types';

/** Available schema fields - TODO: Load from SQLite */
const SCHEMA_FIELDS = [
  { name: 'status', type: 'select', values: ['active', 'pending', 'archived', 'completed'] },
  { name: 'priority', type: 'number' },
  { name: 'due', type: 'date' },
  { name: 'created', type: 'date' },
  { name: 'modified', type: 'date' },
  { name: 'name', type: 'text' },
  { name: 'project', type: 'text' },
  { name: 'tags', type: 'array' },
  { name: 'category', type: 'select', values: ['work', 'personal', 'health', 'finance'] },
  { name: 'location', type: 'text' },
];

/** LATCH axis shortcuts */
const AXIS_SHORTCUTS: AutocompleteItem[] = [
  { label: '@location', type: 'axis', insertText: '@location:', documentation: 'Filter by location' },
  { label: '@alpha', type: 'axis', insertText: '@alpha:', documentation: 'Filter by alphabetic range' },
  { label: '@time', type: 'axis', insertText: '@time:', documentation: 'Filter by time preset' },
  { label: '@category', type: 'axis', insertText: '@category:', documentation: 'Filter by category' },
  { label: '@hierarchy', type: 'axis', insertText: '@hierarchy:', documentation: 'Filter by hierarchy/ranking' },
];

/** Time preset values */
const TIME_PRESETS: AutocompleteItem[] = [
  { label: 'today', type: 'preset', insertText: 'today', documentation: 'Today' },
  { label: 'yesterday', type: 'preset', insertText: 'yesterday', documentation: 'Yesterday' },
  { label: 'last-week', type: 'preset', insertText: 'last-week', documentation: 'Last 7 days' },
  { label: 'last-month', type: 'preset', insertText: 'last-month', documentation: 'Last 30 days' },
  { label: 'this-year', type: 'preset', insertText: 'this-year', documentation: 'Since Jan 1' },
  { label: 'overdue', type: 'preset', insertText: 'overdue', documentation: 'Past due date' },
];

/**
 * Get autocomplete suggestions based on current input
 * @param input Current text in CommandBar
 * @param cursorPosition Cursor position in input
 * @returns Array of suggestions
 */
export function getSuggestions(input: string, cursorPosition: number): AutocompleteItem[] {
  const textBeforeCursor = input.substring(0, cursorPosition);
  
  // Empty input - suggest fields and axes
  if (!textBeforeCursor.trim()) {
    return [
      ...AXIS_SHORTCUTS,
      ...SCHEMA_FIELDS.map(f => ({
        label: f.name,
        type: 'field' as const,
        insertText: `${f.name}:`,
        documentation: `Filter by ${f.name}`
      }))
    ];
  }
  
  // After @ - suggest axis shortcuts
  if (textBeforeCursor.endsWith('@')) {
    return AXIS_SHORTCUTS.map(a => ({
      ...a,
      insertText: a.insertText.substring(1) // Remove leading @
    }));
  }
  
  // After @time: - suggest time presets
  if (textBeforeCursor.match(/@time:$/i)) {
    return TIME_PRESETS;
  }
  
  // After field: - suggest values
  const fieldMatch = textBeforeCursor.match(/(\w+):$/);
  if (fieldMatch) {
    const fieldName = fieldMatch[1];
    const field = SCHEMA_FIELDS.find(f => f.name === fieldName);
    
    if (field?.type === 'date') {
      return TIME_PRESETS;
    }
    
    if (field?.type === 'select' && field.values) {
      return field.values.map(v => ({
        label: v,
        type: 'value' as const,
        insertText: v,
        documentation: `${fieldName} = ${v}`
      }));
    }
    
    // Suggest operators for number fields
    if (field?.type === 'number') {
      return [
        { label: '>', type: 'operator', insertText: '>', documentation: 'Greater than' },
        { label: '<', type: 'operator', insertText: '<', documentation: 'Less than' },
        { label: '>=', type: 'operator', insertText: '>=', documentation: 'Greater or equal' },
        { label: '<=', type: 'operator', insertText: '<=', documentation: 'Less or equal' },
      ];
    }
  }
  
  // After space - suggest AND/OR or new field
  if (textBeforeCursor.endsWith(' ')) {
    return [
      { label: 'AND', type: 'operator', insertText: 'AND ', documentation: 'Logical AND' },
      { label: 'OR', type: 'operator', insertText: 'OR ', documentation: 'Logical OR' },
      { label: 'NOT', type: 'operator', insertText: 'NOT ', documentation: 'Logical NOT' },
      ...SCHEMA_FIELDS.map(f => ({
        label: f.name,
        type: 'field' as const,
        insertText: `${f.name}:`,
        documentation: `Filter by ${f.name}`
      }))
    ];
  }
  
  // Partial field name - filter matching fields
  const partialMatch = textBeforeCursor.match(/(\w+)$/);
  if (partialMatch) {
    const partial = partialMatch[1].toLowerCase();
    return SCHEMA_FIELDS
      .filter(f => f.name.toLowerCase().startsWith(partial))
      .map(f => ({
        label: f.name,
        type: 'field' as const,
        insertText: `${f.name}:`,
        documentation: `Filter by ${f.name}`
      }));
  }
  
  return [];
}
AUTOCOMPLETE_EOF

# ============================================================================
# Index file
# ============================================================================
echo -e "${YELLOW}Creating index.ts...${NC}"
cat > "$PROJECT_PATH/src/dsl/index.ts" << 'INDEX_EOF'
// ============================================================================
// Isometry DSL - Public API
// ============================================================================

export { parse, validate } from './parser';
export { compile, compileString } from './compiler';
export { getSuggestions } from './autocomplete';
export type {
  ASTNode,
  FilterNode,
  AxisNode,
  AndNode,
  OrNode,
  NotNode,
  GroupNode,
  ParseError,
  CompiledQuery,
  AutocompleteItem,
  FilterOperator,
  LATCHAxis,
  TimePreset,
  FilterValue,
} from './types';
INDEX_EOF

# ============================================================================
# Done!
# ============================================================================
echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}  DSL Specifications Added!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo "Files created:"
echo ""
echo "  specs/dsl/"
echo "  └── DSL_IMPLEMENTATION_PLAN.md    # Full specification"
echo ""
echo "  src/dsl/"
echo "  ├── grammar/"
echo "  │   └── IsometryDSL.pegjs         # PEG.js grammar"
echo "  ├── types.ts                       # TypeScript interfaces"
echo "  ├── parser.ts                      # Parse DSL → AST"
echo "  ├── compiler.ts                    # Compile AST → SQL"
echo "  ├── autocomplete.ts                # Suggestion engine"
echo "  └── index.ts                       # Public API"
echo ""
echo -e "${YELLOW}To generate parser from grammar:${NC}"
echo -e "${BLUE}npm install pegjs${NC}"
echo -e "${BLUE}npx pegjs src/dsl/grammar/IsometryDSL.pegjs -o src/dsl/grammar/parser.js${NC}"
echo ""
