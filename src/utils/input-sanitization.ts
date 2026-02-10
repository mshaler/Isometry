/**
 * Input Sanitization Utilities
 * Bridge eliminated - basic security validation for DSL compilation
 */

export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';

  // Remove potential SQL injection patterns
  return input
    .replace(/[;-]/g, '') // Remove semicolons and hyphens
    .replace(/\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE)\b/gi, '') // Remove dangerous SQL keywords
    .replace(/[<>]/g, '') // Remove HTML brackets
    .trim()
    .substring(0, 1000); // Limit length
}

export function sanitizeFieldName(fieldName: string): string {
  if (typeof fieldName !== 'string') return '';

  // Only allow alphanumeric, underscore, and dot
  return fieldName
    .replace(/[^a-zA-Z0-9_.]/g, '')
    .substring(0, 100);
}

export function sanitizeOperator(operator: string): string {
  const allowedOperators = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'NOT IN', 'IS', 'IS NOT'];

  if (!allowedOperators.includes(operator.toUpperCase())) {
    return '='; // Default to equals
  }

  return operator;
}

export function sanitizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = String(value);

  // Escape single quotes for SQL safety
  return str.replace(/'/g, "''");
}

export function isSecurityRisk(input: string): boolean {
  if (typeof input !== 'string') return true;

  const dangerousPatterns = [
    /\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE)\b/gi,
    /[;-]/,
    /<script/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ];

  return dangerousPatterns.some(pattern => pattern.test(input));
}

export function validateSQLClause(clause: string): boolean {
  if (typeof clause !== 'string') return false;

  // Check for basic SQL injection patterns
  if (isSecurityRisk(clause)) return false;

  // Must be a reasonable length
  if (clause.length > 2000) return false;

  return true;
}