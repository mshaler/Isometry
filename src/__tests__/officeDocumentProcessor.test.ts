import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfficeDocumentProcessor, importOfficeFile } from '../utils/officeDocumentProcessor';

// Mock File.arrayBuffer for test environment
Object.defineProperty(File.prototype, 'arrayBuffer', {
  value: function() {
    return Promise.resolve(new ArrayBuffer(0));
  }
});

// Mock the external libraries
vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    decode_range: vi.fn(),
    encode_cell: vi.fn(),
    aoa_to_sheet: vi.fn(),
    book_new: vi.fn(),
    book_append_sheet: vi.fn()
  },
  write: vi.fn()
}));

vi.mock('mammoth', () => ({
  default: {
    convertToHtml: vi.fn(),
    extractRawText: vi.fn(),
    images: {
      imgElement: vi.fn()
    }
  }
}));

describe('OfficeDocumentProcessor', () => {
  let processor: OfficeDocumentProcessor;

  beforeEach(() => {
    processor = new OfficeDocumentProcessor();
    vi.clearAllMocks();
  });

  describe('Excel Import', () => {
    it('should create a processor instance', () => {
      expect(processor).toBeInstanceOf(OfficeDocumentProcessor);
    });

    it('should handle empty file gracefully', async () => {
      const mockFile = new File([''], 'empty.xlsx', { type: 'application/vnd.ms-excel' });

      // Mock XLSX.read to return empty workbook
      const XLSX = await import('xlsx');
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: [],
        Sheets: {}
      });

      const result = await processor.importExcel(mockFile);

      expect(result.nodes).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.totalSheets).toBe(0);
    });

    it('should process single sheet Excel file', async () => {
      const mockFile = new File(['mock excel data'], 'test.xlsx', { type: 'application/vnd.ms-excel' });

      // Mock XLSX.read to return workbook with one sheet
      const XLSX = await import('xlsx');
      const mockWorksheet = {
        '!ref': 'A1:C3',
        'A1': { t: 's', v: 'Name' },
        'B1': { t: 's', v: 'Age' },
        'C1': { t: 's', v: 'City' },
        'A2': { t: 's', v: 'John' },
        'B2': { t: 'n', v: 30 },
        'C2': { t: 's', v: 'New York' }
      };

      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: mockWorksheet }
      });

      vi.mocked(XLSX.utils.decode_range).mockReturnValue({
        s: { r: 0, c: 0 },
        e: { r: 2, c: 2 }
      });

      vi.mocked(XLSX.utils.encode_cell).mockImplementation(({ r, c }) => {
        const cols = ['A', 'B', 'C'];
        return `${cols[c]}${r + 1}`;
      });

      const result = await processor.importExcel(mockFile);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].name).toBe('test.xlsx - Sheet1');
      expect(result.nodes[0].nodeType).toBe('spreadsheet');
      expect(result.nodes[0].content).toContain('| Name | Age | City |');
      expect(result.metadata.totalSheets).toBe(1);
      expect(result.metadata.processedSheets).toEqual(['Sheet1']);
    });

    it('should handle specific sheet selection', async () => {
      const mockFile = new File(['mock excel data'], 'test.xlsx', { type: 'application/vnd.ms-excel' });

      const XLSX = await import('xlsx');
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1', 'Sheet2', 'Sheet3'],
        Sheets: {
          Sheet1: { '!ref': 'A1:A1' },
          Sheet2: { '!ref': 'A1:A1' },
          Sheet3: { '!ref': 'A1:A1' }
        }
      });

      const result = await processor.importExcel(mockFile, {
        sheetNames: ['Sheet2']
      });

      expect(result.metadata.processedSheets).toEqual(['Sheet2']);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].name).toContain('Sheet2');
    });

    it('should generate summary for sheet data', async () => {
      const mockFile = new File(['mock excel data'], 'report.xlsx', { type: 'application/vnd.ms-excel' });

      const XLSX = await import('xlsx');
      const mockWorksheet = {
        '!ref': 'A1:B5',
        'A1': { t: 's', v: 'Quarter' },
        'B1': { t: 's', v: 'Revenue' },
        'A2': { t: 's', v: 'Q1' },
        'B2': { t: 'n', v: 100000 }
      };

      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Revenue'],
        Sheets: { Revenue: mockWorksheet }
      });

      vi.mocked(XLSX.utils.decode_range).mockReturnValue({
        s: { r: 0, c: 0 },
        e: { r: 4, c: 1 }
      });

      const result = await processor.importExcel(mockFile);

      expect(result.nodes[0].summary).toContain('Revenue');
      expect(result.nodes[0].summary).toContain('rows');
      expect(result.nodes[0].summary).toContain('columns');
    });
  });

  describe('Word Import', () => {
    it('should process DOCX file', async () => {
      const mockFile = new File(['mock word data'], 'document.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      const { default: mammoth } = await import('mammoth');
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<h1>Test Document</h1><p>This is a test paragraph.</p>',
        messages: []
      });

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: 'Test Document\nThis is a test paragraph.',
        messages: []
      });

      const result = await processor.importWord(mockFile);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].name).toBe('document');
      expect(result.nodes[0].nodeType).toBe('document');
      expect(result.nodes[0].content).toContain('# Test Document');
      expect(result.nodes[0].content).toContain('This is a test paragraph');
      expect(result.metadata.wordCount).toBeGreaterThan(0);
    });

    it('should preserve formatting when requested', async () => {
      const mockFile = new File(['mock word data'], 'formatted.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      const { default: mammoth } = await import('mammoth');
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<h1>Title</h1><p>Normal text with <strong>bold</strong> and <em>italic</em>.</p>',
        messages: []
      });

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: 'Title\nNormal text with bold and italic.',
        messages: []
      });

      const result = await processor.importWord(mockFile, {
        preserveFormatting: true
      });

      expect(result.nodes[0].content).toContain('**bold**');
      expect(result.nodes[0].content).toContain('*italic*');
    });

    it('should handle Word document with tables', async () => {
      const mockFile = new File(['mock word data'], 'tables.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      const { default: mammoth } = await import('mammoth');
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({
        value: '<h1>Document with Table</h1><table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>',
        messages: []
      });

      vi.mocked(mammoth.extractRawText).mockResolvedValue({
        value: 'Document with Table\nCell 1 Cell 2',
        messages: []
      });

      const result = await processor.importWord(mockFile);

      expect(result.metadata.tableCount).toBe(1);
    });
  });

  describe('Export Functions', () => {
    it('should export nodes to Excel format', async () => {
      const mockNodes: Node[] = [
        {
          id: '1',
          nodeType: 'resource',
          name: 'Test Sheet',
          content: '| Name | Value |\n| --- | --- |\n| Test | 123 |',
          summary: 'Test summary',
          createdAt: '2024-01-01T00:00:00Z',
          modifiedAt: '2024-01-01T00:00:00Z',
          folder: null,
          tags: [],
          source: 'test',
          sourceId: 'test-1',
          sourceUrl: null,
          // Required Node fields
          latitude: null,
          longitude: null,
          locationName: null,
          locationAddress: null,
          dueAt: null,
          completedAt: null,
          eventStart: null,
          eventEnd: null,
          status: null,
          priority: 0,
          importance: 0,
          sortOrder: 0,
          deletedAt: null,
          version: 1
        }
      ];

      const XLSX = await import('xlsx');
      const mockWorkbook = { SheetNames: [], Sheets: {} };
      vi.mocked(XLSX.utils.book_new).mockReturnValue(mockWorkbook);
      vi.mocked(XLSX.utils.aoa_to_sheet).mockReturnValue({});
      vi.mocked(XLSX.write).mockReturnValue(new Uint8Array([1, 2, 3]));

      const result = await processor.exportToExcel(mockNodes);

      expect(result).toBeInstanceOf(Blob);
      expect(XLSX.utils.book_new).toHaveBeenCalled();
      expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalled();
    });

    it('should export node to Word format', async () => {
      const mockNode: Node = {
        id: '1',
        nodeType: 'note',
        name: 'Test Document',
        content: '# Title\n\nThis is test content with **bold** text.',
        summary: 'Test summary',
        createdAt: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-01-01T00:00:00Z',
        folder: null,
        tags: [],
        source: 'test',
        sourceId: 'test-1',
        sourceUrl: null,
        // Required Node fields
        latitude: null,
        longitude: null,
        locationName: null,
        locationAddress: null,
        dueAt: null,
        completedAt: null,
        eventStart: null,
        eventEnd: null,
        status: null,
        priority: 0,
        importance: 0,
        sortOrder: 0,
        deletedAt: null,
        version: 1
      };

      const result = await processor.exportToWord(mockNode);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });
  });

  describe('Utility Functions', () => {
    it('should import supported office file types', async () => {
      const excelFile = new File([''], 'test.xlsx', { type: 'application/vnd.ms-excel' });
      const wordFile = new File([''], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      // Mock the processor methods to return empty results
      const XLSX = await import('xlsx');
      vi.mocked(XLSX.read).mockReturnValue({ SheetNames: [], Sheets: {} });

      const { default: mammoth } = await import('mammoth');
      vi.mocked(mammoth.convertToHtml).mockResolvedValue({ value: '', messages: [] });
      vi.mocked(mammoth.extractRawText).mockResolvedValue({ value: '', messages: [] });

      // Test Excel import
      const excelResult = await importOfficeFile(excelFile);
      expect(excelResult.nodes).toBeDefined();

      // Test Word import
      const wordResult = await importOfficeFile(wordFile);
      expect(wordResult.nodes).toBeDefined();
    });

    it('should reject unsupported file types', async () => {
      const unsupportedFile = new File([''], 'test.pdf', { type: 'application/pdf' });

      await expect(importOfficeFile(unsupportedFile)).rejects.toThrow('Unsupported file type');
    });

    it('should apply import options correctly', async () => {
      const mockFile = new File([''], 'test.xlsx', { type: 'application/vnd.ms-excel' });

      const XLSX = await import('xlsx');
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Data'],
        Sheets: { Data: { '!ref': 'A1:A1', 'A1': { t: 's', v: 'Test' } } }
      });

      vi.mocked(XLSX.utils.decode_range).mockReturnValue({
        s: { r: 0, c: 0 },
        e: { r: 0, c: 0 }
      });

      const options = {
        nodeType: 'reference',
        folder: 'imports',
        source: 'manual-import'
      };

      const result = await importOfficeFile(mockFile, options);

      expect(result.nodes[0].nodeType).toBe('reference');
      expect(result.nodes[0].folder).toBe('imports');
      expect(result.nodes[0].source).toBe('manual-import');
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted Excel files', async () => {
      const corruptFile = new File(['invalid excel data'], 'corrupt.xlsx', { type: 'application/vnd.ms-excel' });

      const XLSX = await import('xlsx');
      vi.mocked(XLSX.read).mockImplementation(() => {
        throw new Error('Invalid file format');
      });

      await expect(processor.importExcel(corruptFile)).rejects.toThrow('Failed to import Excel file');
    });

    it('should handle corrupted Word files', async () => {
      const corruptFile = new File(['invalid docx data'], 'corrupt.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      const mammoth = await import('mammoth');
      vi.mocked(mammoth.default.convertToHtml).mockRejectedValue(new Error('Invalid DOCX format'));

      await expect(processor.importWord(corruptFile)).rejects.toThrow('Failed to import Word document');
    });

    it('should collect partial results when some files fail', async () => {
      const goodFile = new File(['good data'], 'good.xlsx', { type: 'application/vnd.ms-excel' });
      const badFile = new File(['bad data'], 'bad.xlsx', { type: 'application/vnd.ms-excel' });

      const XLSX = await import('xlsx');
      vi.mocked(XLSX.read)
        .mockReturnValueOnce({
          SheetNames: ['Sheet1'],
          Sheets: { Sheet1: { '!ref': 'A1:A1', 'A1': { t: 's', v: 'Test' } } }
        })
        .mockImplementationOnce(() => {
          throw new Error('Corrupted file');
        });

      vi.mocked(XLSX.utils.decode_range).mockReturnValue({
        s: { r: 0, c: 0 },
        e: { r: 0, c: 0 }
      });

      // Test that good files are processed even when others fail
      const goodResult = await processor.importExcel(goodFile);
      expect(goodResult.nodes).toHaveLength(1);

      await expect(processor.importExcel(badFile)).rejects.toThrow();
    });
  });
});