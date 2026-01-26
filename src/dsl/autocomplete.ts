// ============================================================================
// Isometry DSL Autocomplete
// ============================================================================
// Provides suggestions for DSL input in CommandBar
// ============================================================================

import type { AutocompleteItem } from './types';
import type { SchemaField } from '../db/schemaLoader';
import { getSchemaFields } from '../db/schemaLoader';
import type { DatabaseFunction } from '../db/DatabaseContext';

/** Schema fields loaded from database */
let cachedSchemaFields: SchemaField[] = [];

/** Clear autocomplete cache (for testing) */
export function clearAutocompleteCache(): void {
  cachedSchemaFields = [];
}

/** Load schema fields from database */
async function loadSchemaFields(execute: DatabaseFunction): Promise<void> {
  try {
    cachedSchemaFields = await getSchemaFields(execute);
  } catch (error) {
    console.error('Failed to load schema fields for autocomplete:', error);
    // Keep existing cached fields on error
  }
}

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
 * Initialize autocomplete with database connection
 * @param execute Database execute function
 */
export async function initializeAutocomplete(execute: DatabaseFunction): Promise<void> {
  await loadSchemaFields(execute);
}

/**
 * Get autocomplete suggestions based on current input
 * @param input Current text in CommandBar
 * @param cursorPosition Cursor position in input
 * @param execute Optional database execute function for real-time schema loading
 * @returns Array of suggestions
 */
export async function getSuggestions(
  input: string,
  cursorPosition: number,
  execute?: DatabaseFunction
): Promise<AutocompleteItem[]> {
  // Load schema if execute function provided and no cached fields
  if (execute && cachedSchemaFields.length === 0) {
    await loadSchemaFields(execute);
  }
  const textBeforeCursor = input.substring(0, cursorPosition);
  
  // Empty input - suggest fields and axes
  if (!textBeforeCursor.trim()) {
    return [
      ...AXIS_SHORTCUTS,
      ...cachedSchemaFields.map(f => ({
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
    const field = cachedSchemaFields.find(f => f.name === fieldName);

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
      ...cachedSchemaFields.map(f => ({
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
    return cachedSchemaFields
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

/**
 * Synchronous version for backward compatibility
 * Uses cached schema fields only
 */
export function getSuggestionsSync(input: string, cursorPosition: number): AutocompleteItem[] {
  const textBeforeCursor = input.substring(0, cursorPosition);

  // Empty input - suggest fields and axes
  if (!textBeforeCursor.trim()) {
    return [
      ...AXIS_SHORTCUTS,
      ...cachedSchemaFields.map(f => ({
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
    const field = cachedSchemaFields.find(f => f.name === fieldName);

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
      ...cachedSchemaFields.map(f => ({
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
    return cachedSchemaFields
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
