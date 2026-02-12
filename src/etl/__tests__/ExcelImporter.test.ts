/**
 * ExcelImporter Tests
 *
 * TDD tests for Excel/XLS import using SheetJS (xlsx).
 * Uses mocking since actual Excel files would be unwieldy in unit tests.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CanonicalNodeSchema } from '../types/canonical';
import { FileSource } from '../importers/BaseImporter';

// Mock xlsx before importing ExcelImporter
vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_json: vi.fn(),
  },
}));

// Import after mocking
import * as XLSX from 'xlsx';
import { ExcelImporter } from '../importers/ExcelImporter';

describe('ExcelImporter', () => {
  let importer: ExcelImporter;

  beforeEach(() => {
    importer = new ExcelImporter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('single sheet', () => {
    it('should import rows from single sheet', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        { name: 'Task 1', status: 'todo' },
        { name: 'Task 2', status: 'done' },
        { name: 'Task 3', status: 'in-progress' },
      ]);

      const nodes = await importer.import({
        filename: 'tasks.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes).toHaveLength(3);
      expect(nodes[0].name).toBe('Task 1');
      expect(nodes[1].name).toBe('Task 2');
      expect(nodes[2].name).toBe('Task 3');
    });

    it('should use sheet name as folder', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Tasks'],
        Sheets: { Tasks: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        { name: 'Task 1' },
      ]);

      const nodes = await importer.import({
        filename: 'work.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].folder).toBe('Tasks');
    });
  });

  describe('multiple sheets', () => {
    it('should import rows from all sheets', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Tasks', 'Contacts'],
        Sheets: { Tasks: {}, Contacts: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json)
        .mockReturnValueOnce([{ name: 'Task 1' }, { name: 'Task 2' }])
        .mockReturnValueOnce([{ name: 'Contact 1' }]);

      const nodes = await importer.import({
        filename: 'multi.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes).toHaveLength(3);
      expect(nodes[0].folder).toBe('Tasks');
      expect(nodes[1].folder).toBe('Tasks');
      expect(nodes[2].folder).toBe('Contacts');
    });

    it('should handle empty sheets gracefully', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Tasks', 'Empty', 'Contacts'],
        Sheets: { Tasks: {}, Empty: {}, Contacts: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json)
        .mockReturnValueOnce([{ name: 'Task 1' }])
        .mockReturnValueOnce([])  // Empty sheet
        .mockReturnValueOnce([{ name: 'Contact 1' }]);

      const nodes = await importer.import({
        filename: 'mixed.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes).toHaveLength(2);
      expect(nodes[0].folder).toBe('Tasks');
      expect(nodes[1].folder).toBe('Contacts');
    });
  });

  describe('LATCH column mapping', () => {
    it('should detect name from various column headers', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      const testCases = [
        { column: 'name', value: 'From name' },
        { column: 'title', value: 'From title' },
        { column: 'task', value: 'From task' },
        { column: 'subject', value: 'From subject' },
      ];

      for (const { column, value } of testCases) {
        vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([{ [column]: value }]);

        const nodes = await importer.import({
          filename: 'test.xlsx',
          content: 'base64content',
          encoding: 'base64',
        });

        expect(nodes[0].name).toBe(value);
      }
    });

    it('should detect date columns', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        {
          name: 'Task 1',
          created: '2024-01-15T10:00:00Z',
          due_date: '2024-02-01T00:00:00Z',
          modified: '2024-01-20T12:00:00Z',
        },
      ]);

      const nodes = await importer.import({
        filename: 'dates.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].createdAt).toBe('2024-01-15T10:00:00Z');
      expect(nodes[0].dueAt).toBe('2024-02-01T00:00:00Z');
      expect(nodes[0].modifiedAt).toBe('2024-01-20T12:00:00Z');
    });

    it('should detect tags from comma-separated string', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        { name: 'Task 1', tags: 'urgent, important, work' },
      ]);

      const nodes = await importer.import({
        filename: 'tags.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].tags).toEqual(['urgent', 'important', 'work']);
    });

    it('should detect priority from string values', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        { name: 'High Priority', priority: 'high' },
        { name: 'Medium Priority', priority: 'medium' },
        { name: 'Low Priority', priority: 'low' },
      ]);

      const nodes = await importer.import({
        filename: 'priority.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].priority).toBe(5);
      expect(nodes[1].priority).toBe(3);
      expect(nodes[2].priority).toBe(1);
    });

    it('should detect status from status column', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        { name: 'Task 1', status: 'in-progress' },
      ]);

      const nodes = await importer.import({
        filename: 'status.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].status).toBe('in-progress');
    });

    it('should detect location fields', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        {
          name: 'Location Test',
          latitude: '37.7749',
          longitude: '-122.4194',
          location_name: 'San Francisco',
          address: '123 Main St',
        },
      ]);

      const nodes = await importer.import({
        filename: 'location.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].latitude).toBe(37.7749);
      expect(nodes[0].longitude).toBe(-122.4194);
      expect(nodes[0].locationName).toBe('San Francisco');
      expect(nodes[0].locationAddress).toBe('123 Main St');
    });
  });

  describe('edge cases', () => {
    it('should handle empty sheet', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Empty'],
        Sheets: { Empty: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([]);

      const nodes = await importer.import({
        filename: 'empty.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes).toHaveLength(0);
    });

    it('should handle mixed data types', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        {
          name: 'Mixed Types',
          count: 42,
          active: true,
          price: 19.99,
        },
      ]);

      const nodes = await importer.import({
        filename: 'mixed.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].name).toBe('Mixed Types');
      // Original data preserved in content
      expect(nodes[0].content).toContain('"count": 42');
      expect(nodes[0].content).toContain('"active": true');
    });

    it('should fallback to row number when no name column', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        { value: 100, category: 'A' },
      ]);

      const nodes = await importer.import({
        filename: 'noname.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].name).toBe('Sheet1 Row 1');
    });

    it('should handle empty cells gracefully', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        { name: 'Test', status: '', tags: null, priority: undefined },
      ]);

      const nodes = await importer.import({
        filename: 'empty-cells.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].name).toBe('Test');
      expect(nodes[0].status).toBeNull();
      expect(nodes[0].tags).toEqual([]);
      expect(nodes[0].priority).toBe(0);
    });
  });

  describe('deterministic IDs', () => {
    it('should generate unique sourceId per row', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        { name: 'Row 1' },
        { name: 'Row 2' },
      ]);

      const nodes = await importer.import({
        filename: 'unique.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes[0].sourceId).not.toBe(nodes[1].sourceId);
      expect(nodes[0].sourceId).toMatch(/^excel-importer-/);
    });

    it('should generate consistent sourceId on reimport', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        { name: 'Consistent Row' },
      ]);

      const source: FileSource = {
        filename: 'consistent.xlsx',
        content: 'base64content',
        encoding: 'base64',
      };

      const nodes1 = await importer.import(source);
      const nodes2 = await importer.import(source);

      expect(nodes1[0].sourceId).toBe(nodes2[0].sourceId);
    });
  });

  describe('encoding', () => {
    it('should handle base64 encoded content', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([{ name: 'Test' }]);

      await importer.import({
        filename: 'base64.xlsx',
        content: 'SGVsbG8=',
        encoding: 'base64',
      });

      expect(XLSX.read).toHaveBeenCalled();
      const call = vi.mocked(XLSX.read).mock.calls[0];
      expect(call[1]).toEqual({ type: 'buffer' });
    });
  });

  describe('validation', () => {
    it('should produce valid CanonicalNode', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        { name: 'Valid Row', created: '2024-01-15T10:00:00Z' },
      ]);

      const nodes = await importer.import({
        filename: 'valid.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(() => CanonicalNodeSchema.parse(nodes[0])).not.toThrow();
    });

    it('should set required fields with sensible defaults', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        { name: 'Minimal Row' },
      ]);

      const nodes = await importer.import({
        filename: 'minimal.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      // Required fields should be set
      expect(nodes[0].id).toBeDefined();
      expect(nodes[0].createdAt).toBeDefined();
      expect(nodes[0].modifiedAt).toBeDefined();
      expect(nodes[0].source).toBe('excel-importer');
      expect(nodes[0].nodeType).toBe('note');
    });
  });

  describe('error handling', () => {
    it('should throw descriptive error on parse failure', async () => {
      vi.mocked(XLSX.read).mockImplementation(() => {
        throw new Error('Invalid Excel file');
      });

      await expect(
        importer.import({
          filename: 'corrupt.xlsx',
          content: 'badcontent',
          encoding: 'base64',
        })
      ).rejects.toThrow(/corrupt\.xlsx.*Invalid Excel/i);
    });
  });

  describe('integration with ImportCoordinator', () => {
    it('should work with ImportCoordinator', async () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Tasks'],
        Sheets: { Tasks: {} },
      } as XLSX.WorkBook);

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([
        { name: 'Integration Task 1' },
        { name: 'Integration Task 2' },
      ]);

      const { ImportCoordinator } = await import('../coordinator/ImportCoordinator');
      const coordinator = new ImportCoordinator();
      coordinator.registerImporter(['.xlsx', '.xls'], new ExcelImporter());

      const nodes = await coordinator.importFile({
        filename: 'integration.xlsx',
        content: 'base64content',
        encoding: 'base64',
      });

      expect(nodes).toHaveLength(2);
      nodes.forEach(node => {
        expect(() => CanonicalNodeSchema.parse(node)).not.toThrow();
      });
    });
  });
});
