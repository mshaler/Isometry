// ============================================================================
// Isometry DSL Types
// ============================================================================

/** Filter comparison operators */
export type FilterOperator = '=' | '<' | '>' | '<=' | '>=' | '~' | '!=' | 'contains';

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
