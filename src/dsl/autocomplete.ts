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
