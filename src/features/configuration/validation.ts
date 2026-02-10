/**
 * Configuration Validation Utilities
 *
 * Validation logic for configuration values and rules
 */

import type {
  ValidationRule,
  ValidationResult,
  ConfigurationType,
  ConfigurationItem
} from './types';

/**
 * Validates a configuration value against its rules
 */
export function validateConfigurationValue(
  value: string,
  type: ConfigurationType,
  rules: ValidationRule[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let validatedValue: string | undefined = value;

  // Type validation
  const typeValidation = validateType(value, type);
  if (!typeValidation.isValid) {
    errors.push(...typeValidation.errors);
  } else {
    validatedValue = typeValidation.validatedValue;
  }

  // Rule validation
  for (const rule of rules) {
    const ruleValidation = validateRule(value, rule);
    if (!ruleValidation.isValid) {
      errors.push(...ruleValidation.errors);
    }
    warnings.push(...ruleValidation.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validatedValue: errors.length === 0 ? validatedValue : undefined
  };
}

/**
 * Validates all configurations
 */
export function validateAllConfigurations(
  configurations: ConfigurationItem[]
): Record<string, ValidationResult> {
  const results: Record<string, ValidationResult> = {};

  for (const config of configurations) {
    results[config.key] = validateConfigurationValue(
      config.value,
      config.type,
      config.validationRules
    );
  }

  return results;
}

/**
 * Validates a value against its type
 */
function validateType(value: string, type: ConfigurationType): ValidationResult {
  const errors: string[] = [];
  let validatedValue: string = value;

  switch (type) {
    case 'boolean':
      if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
        errors.push('Value must be a valid boolean (true/false)');
      } else {
        validatedValue = ['true', '1'].includes(value.toLowerCase()) ? 'true' : 'false';
      }
      break;

    case 'integer':
      if (!/^-?\d+$/.test(value)) {
        errors.push('Value must be a valid integer');
      }
      break;

    case 'double':
      if (!/^-?\d+(\.\d+)?$/.test(value)) {
        errors.push('Value must be a valid number');
      }
      break;

    case 'json':
      try {
        JSON.parse(value);
      } catch {
        errors.push('Value must be valid JSON');
      }
      break;

    case 'url':
      try {
        new URL(value);
      } catch {
        errors.push('Value must be a valid URL');
      }
      break;

    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.push('Value must be a valid email address');
      }
      break;
    }

    case 'array':
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          errors.push('Value must be a valid JSON array');
        }
      } catch {
        errors.push('Value must be a valid JSON array');
      }
      break;

    case 'string':
    default:
      // No specific validation for string type
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
    validatedValue: errors.length === 0 ? validatedValue : undefined
  };
}

/**
 * Validates a value against a specific rule
 */
function validateRule(value: string, rule: ValidationRule): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (rule.type) {
    case 'required':
      if (!value || value.trim().length === 0) {
        errors.push(rule.message || 'This field is required');
      }
      break;

    case 'minLength': {
      const minLength = parseInt(rule.parameter || '0');
      if (value.length < minLength) {
        errors.push(rule.message || `Value must be at least ${minLength} characters`);
      }
      break;
    }

    case 'maxLength': {
      const maxLength = parseInt(rule.parameter || '255');
      if (value.length > maxLength) {
        errors.push(rule.message || `Value must be no more than ${maxLength} characters`);
      }
      break;
    }

    case 'pattern':
      if (rule.parameter) {
        const regex = new RegExp(rule.parameter);
        if (!regex.test(value)) {
          errors.push(rule.message || 'Value does not match required pattern');
        }
      }
      break;

    case 'range':
      if (rule.parameter) {
        const [min, max] = rule.parameter.split(',').map(Number);
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < min || numValue > max) {
          errors.push(rule.message || `Value must be between ${min} and ${max}`);
        }
      }
      break;

    case 'url':
      try {
        new URL(value);
      } catch {
        errors.push(rule.message || 'Value must be a valid URL');
      }
      break;

    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.push(rule.message || 'Value must be a valid email address');
      }
      break;
    }

    case 'json':
      try {
        JSON.parse(value);
      } catch {
        errors.push(rule.message || 'Value must be valid JSON');
      }
      break;

    default:
      warnings.push(`Unknown validation rule type: ${rule.type}`);
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Creates default validation rules for a configuration type
 */
export function getDefaultValidationRules(type: ConfigurationType): ValidationRule[] {
  switch (type) {
    case 'email':
      return [
        { type: 'required', message: 'Email is required' },
        { type: 'email', message: 'Must be a valid email address' }
      ];

    case 'url':
      return [
        { type: 'required', message: 'URL is required' },
        { type: 'url', message: 'Must be a valid URL' }
      ];

    case 'json':
      return [
        { type: 'required', message: 'JSON is required' },
        { type: 'json', message: 'Must be valid JSON' }
      ];

    case 'boolean':
      return [
        { type: 'required', message: 'Boolean value is required' }
      ];

    case 'integer':
    case 'double':
      return [
        { type: 'required', message: 'Numeric value is required' }
      ];

    default:
      return [
        { type: 'required', message: 'This field is required' }
      ];
  }
}
