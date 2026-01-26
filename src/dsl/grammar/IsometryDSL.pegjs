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
  = chars:$([a-zA-Z_][a-zA-Z0-9_]*) { return chars; }

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
