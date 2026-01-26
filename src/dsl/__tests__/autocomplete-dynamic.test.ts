// ============================================================================
// Dynamic Autocomplete Tests
// ============================================================================
// Tests for autocomplete with dynamic schema loading from SQLite
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initializeAutocomplete,
  getSuggestions,
  getSuggestionsSync,
  clearAutocompleteCache
} from '../autocomplete';
import { clearSchemaCache } from '../../db/schemaLoader';

// Mock database function that returns sample schema
const createMockExecute = () => {
  return vi.fn(async (sql: string, _params: unknown[]) => {
    if (sql.includes('PRAGMA table_info(nodes)')) {
      return [
        { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
        { cid: 1, name: 'name', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
        { cid: 2, name: 'priority', type: 'INTEGER', notnull: 0, dflt_value: '0', pk: 0 },
        { cid: 3, name: 'created_at', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
        { cid: 4, name: 'status', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
        { cid: 5, name: 'tags', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
        { cid: 6, name: 'due_at', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }
      ];
    }

    if (sql.includes('PRAGMA table_info(notebook_cards)')) {
      return [
        { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
        { cid: 1, name: 'content', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 }
      ];
    }

    if (sql.includes('PRAGMA table_info(edges)')) {
      return [];
    }

    if (sql.includes('PRAGMA table_info(attachments)')) {
      return [];
    }

    return [];
  });
};

describe('Dynamic Autocomplete', () => {
  let mockExecute: ReturnType<typeof createMockExecute>;

  beforeEach(() => {
    mockExecute = createMockExecute();
    clearSchemaCache(); // Clear schema cache between tests
    clearAutocompleteCache(); // Clear autocomplete cache between tests
  });

  describe('initializeAutocomplete', () => {
    it('should load schema fields from database', async () => {
      await initializeAutocomplete(mockExecute);

      // Test that fields are available for suggestions
      const suggestions = await getSuggestions('', 0, mockExecute);

      const fieldSuggestions = suggestions.filter(s => s.type === 'field');
      const fieldNames = fieldSuggestions.map(s => s.label);

      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('priority');
      expect(fieldNames).toContain('created_at');
      expect(fieldNames).toContain('status');
      expect(fieldNames).toContain('tags');
      expect(fieldNames).toContain('due_at');
      expect(fieldNames).toContain('content');
      expect(fieldNames).toContain('nodes.id'); // Qualified due to conflict
      expect(fieldNames).toContain('notebook_cards.id'); // Qualified due to conflict
    });
  });

  describe('getSuggestions', () => {
    it('should provide field suggestions with database schema', async () => {
      const suggestions = await getSuggestions('', 0, mockExecute);

      const fieldSuggestions = suggestions.filter(s => s.type === 'field');
      expect(fieldSuggestions.length).toBeGreaterThan(0);

      // Should include both axis shortcuts and dynamic fields
      const axisSuggestions = suggestions.filter(s => s.type === 'axis');
      expect(axisSuggestions.length).toBe(5); // @location, @alpha, @time, @category, @hierarchy
    });

    it('should suggest correct value types for different field types', async () => {
      // Initialize with schema
      await initializeAutocomplete(mockExecute);

      // Test date field suggestions
      const dateSuggestions = await getSuggestions('created_at:', 11, mockExecute);
      const dateLabels = dateSuggestions.map(s => s.label);
      expect(dateLabels).toContain('today');
      expect(dateLabels).toContain('yesterday');
      expect(dateLabels).toContain('last-week');

      // Test select field suggestions
      const statusSuggestions = await getSuggestions('status:', 7, mockExecute);
      const statusLabels = statusSuggestions.map(s => s.label);
      expect(statusLabels).toContain('active');
      expect(statusLabels).toContain('pending');
      expect(statusLabels).toContain('completed');

      // Test number field suggestions (operators)
      const prioritySuggestions = await getSuggestions('priority:', 9, mockExecute);
      const priorityLabels = prioritySuggestions.map(s => s.label);
      expect(priorityLabels).toContain('>');
      expect(priorityLabels).toContain('<');
      expect(priorityLabels).toContain('>=');
      expect(priorityLabels).toContain('<=');
    });

    it('should handle partial field name matching', async () => {
      await initializeAutocomplete(mockExecute);

      const suggestions = await getSuggestions('na', 2, mockExecute);
      const fieldNames = suggestions.map(s => s.label);

      expect(fieldNames).toContain('name');
    });

    it('should work without execute function if cache is populated', async () => {
      // First initialize with execute function
      await initializeAutocomplete(mockExecute);

      // Then call without execute function
      const suggestions = await getSuggestions('', 0);

      const fieldSuggestions = suggestions.filter(s => s.type === 'field');
      expect(fieldSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('getSuggestionsSync', () => {
    it('should work with cached schema data', async () => {
      // Initialize cache first
      await initializeAutocomplete(mockExecute);

      // Use sync version
      const suggestions = getSuggestionsSync('', 0);

      const fieldSuggestions = suggestions.filter(s => s.type === 'field');
      expect(fieldSuggestions.length).toBeGreaterThan(0);

      const fieldNames = fieldSuggestions.map(s => s.label);
      expect(fieldNames).toContain('name');
      expect(fieldNames).toContain('priority');
    });

    it('should return only axis shortcuts if no cache', () => {
      const suggestions = getSuggestionsSync('', 0);

      const axisSuggestions = suggestions.filter(s => s.type === 'axis');
      const fieldSuggestions = suggestions.filter(s => s.type === 'field');

      expect(axisSuggestions.length).toBe(5);
      expect(fieldSuggestions.length).toBe(0);
    });
  });

  describe('field type mapping', () => {
    it('should map SQL types correctly', async () => {
      await initializeAutocomplete(mockExecute);

      // Test field type behavior through suggestions
      const dateSuggestions = await getSuggestions('due_at:', 7, mockExecute);
      expect(dateSuggestions.some(s => s.label === 'today')).toBe(true);

      const numberSuggestions = await getSuggestions('priority:', 9, mockExecute);
      expect(numberSuggestions.some(s => s.label === '>')).toBe(true);
    });
  });
});