/**
 * Input Sanitization and Validation Utilities
 *
 * Provides comprehensive input validation and sanitization for user inputs,
 * DSL compilation, and data processing to prevent injection attacks and
 * ensure data integrity.
 */

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  sanitizedValue?: string | number | boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Sanitization options
 */
export interface SanitizationOptions {
  maxLength?: number;
  allowedCharacters?: RegExp;
  stripHTML?: boolean;
  escapeSQL?: boolean;
  normalizeWhitespace?: boolean;
  allowedValues?: string[];
}

/**
 * SQL injection patterns to detect and prevent
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT( +INTO)?|MERGE|SELECT|UPDATE|UNION( +ALL)?)\b)/i,
  /(\b(AND|OR)\b.*(=|<|>|!=|<>|<=|>=).*(\b(SELECT|INSERT|UPDATE|DELETE)\b))/i,
  /(;|\-\-|\||\/\*|\*\/)/,
  /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT|ONLOAD|ONERROR)\b)/i,
  /'(\s*|\s*[\w\s]*\s*);?\s*(DROP|DELETE|INSERT|UPDATE|SELECT|UNION)/i
];

/**
 * XSS patterns to detect and prevent
 */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /on\w+\s*=/gi,
  /<img[^>]+src[\\s]*=[\\s]*["\']javascript:/gi
];

/**
 * Validates and sanitizes string input
 */
export function sanitizeString(
  input: string,
  options: SanitizationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let sanitized = input;

  // Basic null/undefined check
  if (input == null) {
    return {
      isValid: false,
      errors: ['Input cannot be null or undefined'],
      warnings: []
    };
  }

  // Convert to string if not already
  if (typeof input !== 'string') {
    sanitized = String(input);
    warnings.push('Input converted to string');
  }

  // Length validation
  if (options.maxLength && sanitized.length > options.maxLength) {
    errors.push(`Input exceeds maximum length of ${options.maxLength}`);
    sanitized = sanitized.substring(0, options.maxLength);
    warnings.push(`Input truncated to ${options.maxLength} characters`);
  }

  // Character validation
  if (options.allowedCharacters && !options.allowedCharacters.test(sanitized)) {
    errors.push('Input contains invalid characters');
  }

  // SQL injection detection
  if (options.escapeSQL !== false) {
    const hasSQL = SQL_INJECTION_PATTERNS.some(pattern => pattern.test(sanitized));
    if (hasSQL) {
      errors.push('Input contains potential SQL injection patterns');
    }

    // Escape SQL characters
    sanitized = sanitized
      .replace(/'/g, "''")
      .replace(/;/g, '\\;')
      .replace(/--/g, '\\-\\-');
  }

  // XSS detection
  const hasXSS = XSS_PATTERNS.some(pattern => pattern.test(sanitized));
  if (hasXSS) {
    errors.push('Input contains potential XSS patterns');
  }

  // HTML stripping
  if (options.stripHTML) {
    const originalLength = sanitized.length;
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    if (sanitized.length < originalLength) {
      warnings.push('HTML tags removed from input');
    }
  }

  // Whitespace normalization
  if (options.normalizeWhitespace) {
    const original = sanitized;
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    if (original !== sanitized) {
      warnings.push('Whitespace normalized');
    }
  }

  // Allowed values check
  if (options.allowedValues && !options.allowedValues.includes(sanitized)) {
    errors.push(`Value must be one of: ${options.allowedValues.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    sanitizedValue: sanitized,
    errors,
    warnings
  };
}

/**
 * Validates and sanitizes numeric input
 */
export function sanitizeNumber(
  input: unknown,
  options: { min?: number; max?: number; integer?: boolean } = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (input == null) {
    return {
      isValid: false,
      errors: ['Input cannot be null or undefined'],
      warnings: []
    };
  }

  let num: number;

  if (typeof input === 'string') {
    // Check for injection patterns in string numbers
    const hasInjection = SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
    if (hasInjection) {
      return {
        isValid: false,
        errors: ['Numeric input contains invalid characters'],
        warnings: []
      };
    }

    num = Number(input);
    warnings.push('String input converted to number');
  } else if (typeof input === 'number') {
    num = input;
  } else {
    return {
      isValid: false,
      errors: ['Input must be a number or numeric string'],
      warnings: []
    };
  }

  // NaN check
  if (isNaN(num)) {
    errors.push('Input is not a valid number');
  }

  // Infinity check
  if (!isFinite(num)) {
    errors.push('Input cannot be infinite');
  }

  // Integer validation
  if (options.integer && !Number.isInteger(num)) {
    errors.push('Input must be an integer');
    num = Math.round(num);
    warnings.push('Non-integer value rounded');
  }

  // Range validation
  if (options.min !== undefined && num < options.min) {
    errors.push(`Input must be at least ${options.min}`);
  }

  if (options.max !== undefined && num > options.max) {
    errors.push(`Input cannot exceed ${options.max}`);
  }

  return {
    isValid: errors.length === 0,
    sanitizedValue: num,
    errors,
    warnings
  };
}

/**
 * Sanitizes DSL filter values specifically
 */
export function sanitizeDSLValue(value: unknown): ValidationResult {
  if (value == null) {
    return {
      isValid: true,
      sanitizedValue: null,
      errors: [],
      warnings: []
    };
  }

  // Handle different value types
  if (typeof value === 'string') {
    return sanitizeString(value, {
      maxLength: 1000,
      stripHTML: true,
      escapeSQL: true,
      normalizeWhitespace: true,
      allowedCharacters: /^[a-zA-Z0-9\s\-_.:@\/]+$/
    });
  }

  if (typeof value === 'number') {
    return sanitizeNumber(value, {
      min: -1e10,
      max: 1e10
    });
  }

  if (typeof value === 'boolean') {
    return {
      isValid: true,
      sanitizedValue: value,
      errors: [],
      warnings: []
    };
  }

  // Handle objects (time presets, etc.)
  if (typeof value === 'object') {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate object structure
    if (Array.isArray(value)) {
      errors.push('Arrays not supported in DSL values');
    } else if ('preset' in value && typeof value.preset === 'string') {
      // Validate time preset
      const presetValidation = sanitizeString(value.preset, {
        maxLength: 50,
        allowedValues: [
          'today', 'yesterday', 'last-week', 'last-7-days',
          'last-month', 'last-30-days', 'this-year', 'next-week', 'overdue'
        ]
      });

      if (!presetValidation.isValid) {
        errors.push(...presetValidation.errors);
      }

      return {
        isValid: errors.length === 0,
        sanitizedValue: { preset: presetValidation.sanitizedValue },
        errors,
        warnings: [...warnings, ...presetValidation.warnings]
      };
    } else {
      errors.push('Invalid object structure in DSL value');
    }

    return {
      isValid: false,
      errors,
      warnings
    };
  }

  return {
    isValid: false,
    errors: ['Unsupported value type'],
    warnings: []
  };
}

/**
 * Sanitizes field names in DSL queries
 */
export function sanitizeFieldName(fieldName: string): ValidationResult {
  return sanitizeString(fieldName, {
    maxLength: 100,
    allowedCharacters: /^[a-zA-Z][a-zA-Z0-9_]*$/,
    stripHTML: true,
    normalizeWhitespace: true
  });
}

/**
 * Sanitizes operator strings in DSL queries
 */
export function sanitizeOperator(operator: string): ValidationResult {
  const allowedOperators = ['=', '!=', '<', '>', '<=', '>=', '~'];

  return sanitizeString(operator, {
    maxLength: 5,
    allowedValues: allowedOperators,
    stripHTML: true,
    normalizeWhitespace: true
  });
}

/**
 * Comprehensive validation for complete user inputs
 */
export function validateUserInput(input: {
  type: 'search' | 'filter' | 'note' | 'command';
  value: unknown;
  context?: string;
}): ValidationResult {
  const { type, value, context } = input;
  const warnings: string[] = [];

  if (context) {
    warnings.push(`Validating ${type} input in context: ${context}`);
  }

  switch (type) {
    case 'search':
      return sanitizeString(String(value), {
        maxLength: 500,
        stripHTML: true,
        normalizeWhitespace: true,
        allowedCharacters: /^[a-zA-Z0-9\s\-_.:@\/\(\)\[\]"']+$/
      });

    case 'filter':
      return sanitizeDSLValue(value);

    case 'note':
      return sanitizeString(String(value), {
        maxLength: 50000, // Allow large notes
        stripHTML: false, // Preserve formatting
        normalizeWhitespace: false
      });

    case 'command':
      return sanitizeString(String(value), {
        maxLength: 1000,
        stripHTML: true,
        normalizeWhitespace: true,
        escapeSQL: true
      });

    default:
      return {
        isValid: false,
        errors: ['Unknown input type'],
        warnings
      };
  }
}

/**
 * Batch validation for multiple inputs
 */
export function validateBatch(
  inputs: Array<{ id: string; type: 'search' | 'filter' | 'note' | 'command'; value: unknown }>
): { [id: string]: ValidationResult } {
  const results: { [id: string]: ValidationResult } = {};

  for (const input of inputs) {
    results[input.id] = validateUserInput(input);
  }

  return results;
}

/**
 * Utility to check if a validation result indicates a security risk
 */
export function isSecurityRisk(result: ValidationResult): boolean {
  return result.errors.some(error =>
    error.includes('SQL injection') ||
    error.includes('XSS') ||
    error.includes('invalid characters') ||
    error.includes('security')
  );
}

/**
 * Create validation middleware for common use cases
 */
export function createValidator(defaultOptions: SanitizationOptions) {
  return (input: string) => sanitizeString(input, defaultOptions);
}

// Pre-configured validators for common use cases
export const validateSearchQuery = createValidator({
  maxLength: 500,
  stripHTML: true,
  normalizeWhitespace: true,
  allowedCharacters: /^[a-zA-Z0-9\s\-_.:@\/\(\)\[\]"']+$/
});

export const validateFileName = createValidator({
  maxLength: 255,
  stripHTML: true,
  normalizeWhitespace: true,
  allowedCharacters: /^[a-zA-Z0-9\s\-_.]+$/
});

export const validateMarkdownContent = createValidator({
  maxLength: 100000,
  stripHTML: false,
  normalizeWhitespace: false,
  escapeSQL: true
});