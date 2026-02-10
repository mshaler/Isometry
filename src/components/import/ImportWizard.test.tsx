import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImportWizard } from '../ImportWizard';
import type { Node } from '../../types/node';
import type { OfficeImportResult } from '../../utils/officeDocumentProcessor';

// Mock the office document processor
vi.mock('../../utils/officeDocumentProcessor', () => ({
  importOfficeFile: vi.fn(),
}));

// Property-based test data generators for React components
class ReactTestDataGenerator {
  static generateMockFiles(count: number = 3): File[] {
    return Array.from({ length: count }, (_, i) => {
      const extensions = ['xlsx', 'xls', 'docx', 'doc'];
      const ext = extensions[i % extensions.length];
      const content = `Mock ${ext.toUpperCase()} content for file ${i}`;
      const blob = new Blob([content], { type: `application/${ext}` });
      return new File([blob], `test-file-${i}.${ext}`, {
        type: `application/${ext}`,
        lastModified: Date.now() - i * 1000
      });
    });
  }

  static generateMockNodes(count: number = 5): Node[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `test-node-${i}`,
      nodeType: 'document',
      name: `Test Document ${i}`,
      content: `Content for test document ${i}`,
      summary: `Summary ${i}`,
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // i days ago
      modifiedAt: new Date(Date.now() - i * 60 * 60 * 1000), // i hours ago
      version: 1,
      folder: i % 2 === 0 ? 'test-folder' : undefined,
      tags: i % 3 === 0 ? [`tag-${i}`] : [],
      source: 'test',
      sourceId: `source-${i}`,
      latitude: undefined,
      longitude: undefined,
      sortOrder: i
    }));
  }

  static generateMockImportResult(nodeCount: number = 5, errorCount: number = 0): OfficeImportResult {
    return {
      nodes: this.generateMockNodes(nodeCount),
      errors: Array.from({ length: errorCount }, (_, i) => `Error ${i}: Mock import error`),
      warnings: []
    };
  }

  static generateInvalidFiles(): File[] {
    return [
      new File([new Blob(['invalid content'])], 'invalid.txt', { type: 'text/plain' }),
      new File([new Blob([''])], 'empty.pdf', { type: 'application/pdf' }),
      new File([new Blob(['corrupt data'])], 'corrupt.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    ];
  }
}

// Enhanced testing utilities
class ImportWizardTestHarness {
  private mockImportOfficeFile: unknown;
  private mockProps: unknown;

  async initialize() {
    const { importOfficeFile } = await import('../../utils/officeDocumentProcessor');
    this.mockImportOfficeFile = vi.mocked(importOfficeFile);
    this.mockProps = {
      isOpen: true,
      onClose: vi.fn(),
      onImportComplete: vi.fn(),
      folder: 'test-folder'
    };
  }

  renderComponent(props = {}) {
    return render(<ImportWizard {...this.mockProps} {...props} />);
  }

  async simulateFileUpload(files: File[]) {
    // Create a file input change event
    const fileInput = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;

    // Mock the files property
    Object.defineProperty(fileInput, 'files', {
      value: files,
      configurable: true
    });

    // Trigger the change event
    fireEvent.change(fileInput, { target: { files } });
  }

  async simulateDragAndDrop(files: File[]) {
    const dropZone = screen.getByText('Drop your Office documents here').parentElement;

    if (!dropZone) throw new Error('Drop zone not found');

    // Simulate drag events
    fireEvent.dragEnter(dropZone);
    expect(dropZone).toHaveClass('border-blue-500');

    // Create DataTransfer mock
    const dataTransfer = {
      files,
      items: files.map(file => ({ getAsFile: () => file })),
      types: ['Files']
    };

    // Simulate drop
    fireEvent.drop(dropZone, { dataTransfer });
  }

  setupMockImport(result: OfficeImportResult | Error) {
    if (result instanceof Error) {
      this.mockImportOfficeFile.mockRejectedValue(result);
    } else {
      this.mockImportOfficeFile.mockResolvedValue(result);
    }
  }

  async processAllFiles() {
    const importButton = screen.getByRole('button', { name: /Import \d+ Files/ });
    fireEvent.click(importButton);

    // Wait for processing to complete
    await waitFor(() => {
      expect(screen.queryByText(/Processing/)).not.toBeInTheDocument();
    }, { timeout: 10000 });
  }

  getMockCalls() {
    return {
      onClose: this.mockProps.onClose.mock.calls,
      onImportComplete: this.mockProps.onImportComplete.mock.calls,
      importOfficeFile: this.mockImportOfficeFile.mock.calls
    };
  }

  resetMocks() {
    vi.clearAllMocks();
  }
}

describe('ImportWizard Component', () => {
  let harness: ImportWizardTestHarness;

  beforeEach(async () => {
    harness = new ImportWizardTestHarness();
    await harness.initialize();
    vi.clearAllMocks();
  });

  describe('Rendering and Basic Interaction', () => {
    it('renders wizard when open', () => {
      harness.renderComponent();

      expect(screen.getByText('Import Office Documents')).toBeInTheDocument();
      expect(screen.getByText('Drop your Office documents here')).toBeInTheDocument();
      expect(screen.getByText('Supports XLSX, XLS, DOCX, DOC files')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      harness.renderComponent({ isOpen: false });

      expect(screen.queryByText('Import Office Documents')).not.toBeInTheDocument();
    });

    it('closes wizard when X button clicked', () => {
      harness.renderComponent();

      const closeButton = screen.getByRole('button', { name: '' }); // X button
      fireEvent.click(closeButton);

      expect(harness.getMockCalls().onClose).toHaveLength(1);
    });

    it('closes wizard when Close button clicked', () => {
      harness.renderComponent();

      const closeButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeButton);

      expect(harness.getMockCalls().onClose).toHaveLength(1);
    });
  });

  describe('Import Options Configuration', () => {
    it('sets default import options correctly', () => {
      harness.renderComponent({ folder: 'custom-folder' });

      const nodeTypeSelect = screen.getByDisplayValue('document');
      expect(nodeTypeSelect).toBeInTheDocument();

      const folderInput = screen.getByDisplayValue('custom-folder');
      expect(folderInput).toBeInTheDocument();

      const preserveFormattingCheckbox = screen.getByRole('checkbox', { name: 'Preserve Formatting' });
      expect(preserveFormattingCheckbox).toBeChecked();

      const extractTablesCheckbox = screen.getByRole('checkbox', { name: 'Extract Tables' });
      expect(extractTablesCheckbox).toBeChecked();
    });

    it('updates node type option', () => {
      harness.renderComponent();

      const nodeTypeSelect = screen.getByDisplayValue('document');
      fireEvent.change(nodeTypeSelect, { target: { value: 'spreadsheet' } });

      expect(screen.getByDisplayValue('spreadsheet')).toBeInTheDocument();
    });

    it('updates folder option', () => {
      harness.renderComponent();

      const folderInput = screen.getByPlaceholderText('Optional folder name');
      fireEvent.change(folderInput, { target: { value: 'new-folder' } });

      expect(screen.getByDisplayValue('new-folder')).toBeInTheDocument();
    });

    it('toggles formatting options', () => {
      harness.renderComponent();

      const preserveFormattingCheckbox = screen.getByRole('checkbox', { name: 'Preserve Formatting' });
      const extractTablesCheckbox = screen.getByRole('checkbox', { name: 'Extract Tables' });

      fireEvent.click(preserveFormattingCheckbox);
      expect(preserveFormattingCheckbox).not.toBeChecked();

      fireEvent.click(extractTablesCheckbox);
      expect(extractTablesCheckbox).not.toBeChecked();
    });
  });

  describe('File Selection and Validation', () => {
    it('accepts valid office files via file input', async () => {
      harness.renderComponent();

      const validFiles = ReactTestDataGenerator.generateMockFiles(2);
      await harness.simulateFileUpload(validFiles);

      // Check that files appear in the list
      expect(screen.getByText('test-file-0.xlsx')).toBeInTheDocument();
      expect(screen.getByText('test-file-1.xls')).toBeInTheDocument();
      expect(screen.getByText('Files (2)')).toBeInTheDocument();
    });

    it('accepts files via drag and drop', async () => {
      harness.renderComponent();

      const validFiles = ReactTestDataGenerator.generateMockFiles(3);
      await harness.simulateDragAndDrop(validFiles);

      // Check that files appear in the list
      expect(screen.getByText('Files (3)')).toBeInTheDocument();
      expect(screen.getByText('test-file-0.xlsx')).toBeInTheDocument();
      expect(screen.getByText('test-file-2.docx')).toBeInTheDocument();
    });

    it('filters out invalid file types', async () => {
      harness.renderComponent();

      const invalidFiles = ReactTestDataGenerator.generateInvalidFiles();
      await harness.simulateFileUpload(invalidFiles);

      // No files should be added
      expect(screen.queryByText('Files (')).not.toBeInTheDocument();
    });

    it('displays file sizes correctly', async () => {
      harness.renderComponent();

      const files = ReactTestDataGenerator.generateMockFiles(1);
      await harness.simulateFileUpload(files);

      // Should show file size in MB
      expect(screen.getByText(/MB/)).toBeInTheDocument();
    });

    it('allows removing individual files', async () => {
      harness.renderComponent();

      const files = ReactTestDataGenerator.generateMockFiles(2);
      await harness.simulateFileUpload(files);

      expect(screen.getByText('Files (2)')).toBeInTheDocument();

      // Remove first file
      const removeButtons = screen.getAllByRole('button', { name: '' }); // X buttons
      const fileRemoveButton = removeButtons.find(button =>
        button.closest('.bg-gray-50')?.querySelector('[data-testid="file-name"]')
      );

      if (fileRemoveButton) {
        fireEvent.click(fileRemoveButton);
        expect(screen.getByText('Files (1)')).toBeInTheDocument();
      }
    });

    it('clears all files when Clear All clicked', async () => {
      harness.renderComponent();

      const files = ReactTestDataGenerator.generateMockFiles(3);
      await harness.simulateFileUpload(files);

      expect(screen.getByText('Files (3)')).toBeInTheDocument();

      const clearButton = screen.getByRole('button', { name: 'Clear All' });
      fireEvent.click(clearButton);

      expect(screen.queryByText('Files (')).not.toBeInTheDocument();
    });
  });

  describe('Import Processing', () => {
    it('processes files successfully', async () => {
      harness.renderComponent();

      const files = ReactTestDataGenerator.generateMockFiles(2);
      const mockResult = ReactTestDataGenerator.generateMockImportResult(5, 0);

      harness.setupMockImport(mockResult);
      await harness.simulateFileUpload(files);

      await act(async () => {
        await harness.processAllFiles();
      });

      // Check success indicators
      expect(screen.getByText(/5 nodes imported/)).toBeInTheDocument();
      expect(screen.getAllByText(/\d+ nodes/)).toHaveLength(2); // One for each file

      // Check completion handler was called
      const calls = harness.getMockCalls();
      expect(calls.onImportComplete).toHaveLength(1);
      expect(calls.onImportComplete[0][0]).toHaveLength(10); // 5 nodes per file * 2 files
    });

    it('handles import errors gracefully', async () => {
      harness.renderComponent();

      const files = ReactTestDataGenerator.generateMockFiles(1);
      const mockError = new Error('Import failed: Corrupted file');

      harness.setupMockImport(mockError);
      await harness.simulateFileUpload(files);

      await act(async () => {
        await harness.processAllFiles();
      });

      // Check error display
      expect(screen.getByText(/Import failed: Corrupted file/)).toBeInTheDocument();

      // Check completion handler was not called
      expect(harness.getMockCalls().onImportComplete).toHaveLength(0);
    });

    it('shows processing status during import', async () => {
      harness.renderComponent();

      const files = ReactTestDataGenerator.generateMockFiles(1);

      // Setup slow mock import
      harness.setupMockImport(new Promise(resolve => {
        setTimeout(() => resolve(ReactTestDataGenerator.generateMockImportResult(1)), 1000);
      }));

      await harness.simulateFileUpload(files);

      const importButton = screen.getByRole('button', { name: /Import 1 Files/ });
      fireEvent.click(importButton);

      // Check processing status appears
      await waitFor(() => {
        expect(screen.getByText('Processing')).toBeInTheDocument();
      });

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByText('Processing')).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('disables import button during processing', async () => {
      harness.renderComponent();

      const files = ReactTestDataGenerator.generateMockFiles(1);
      harness.setupMockImport(new Promise(resolve =>
        setTimeout(() => resolve(ReactTestDataGenerator.generateMockImportResult(1)), 500)
      ));

      await harness.simulateFileUpload(files);

      const importButton = screen.getByRole('button', { name: /Import 1 Files/ });
      fireEvent.click(importButton);

      // Button should be disabled during processing
      await waitFor(() => {
        expect(importButton).toBeDisabled();
      });
    });

    it('passes correct options to import function', async () => {
      harness.renderComponent();

      // Set custom options
      const nodeTypeSelect = screen.getByDisplayValue('document');
      fireEvent.change(nodeTypeSelect, { target: { value: 'spreadsheet' } });

      const folderInput = screen.getByPlaceholderText('Optional folder name');
      fireEvent.change(folderInput, { target: { value: 'custom-folder' } });

      const preserveFormattingCheckbox = screen.getByRole('checkbox', { name: 'Preserve Formatting' });
      fireEvent.click(preserveFormattingCheckbox);

      // Setup import and process
      const files = ReactTestDataGenerator.generateMockFiles(1);
      harness.setupMockImport(ReactTestDataGenerator.generateMockImportResult(1));
      await harness.simulateFileUpload(files);

      await act(async () => {
        await harness.processAllFiles();
      });

      // Check import was called with correct options
      const calls = harness.getMockCalls();
      expect(calls.importOfficeFile).toHaveLength(1);
      expect(calls.importOfficeFile[0][1]).toMatchObject({
        nodeType: 'spreadsheet',
        folder: 'custom-folder',
        preserveFormatting: false,
        extractTables: true
      });
    });
  });

  describe('Property-Based Testing', () => {
    it('handles various file counts correctly', async () => {
      harness.renderComponent();

      // Test with different file counts
      for (const count of [1, 5, 10, 20]) {
        harness.resetMocks();

        const files = ReactTestDataGenerator.generateMockFiles(count);
        const mockResult = ReactTestDataGenerator.generateMockImportResult(3);

        harness.setupMockImport(mockResult);
        await harness.simulateFileUpload(files);

        expect(screen.getByText(`Files (${count})`)).toBeInTheDocument();
        expect(screen.getByText(`Import ${count} Files`)).toBeInTheDocument();

        // Clear for next iteration
        const clearButton = screen.getByRole('button', { name: 'Clear All' });
        fireEvent.click(clearButton);
      }
    });

    it('handles various import result sizes', async () => {
      harness.renderComponent();

      // Test with different result sizes
      for (const nodeCount of [0, 1, 10, 100]) {
        harness.resetMocks();

        const files = ReactTestDataGenerator.generateMockFiles(1);
        const mockResult = ReactTestDataGenerator.generateMockImportResult(nodeCount);

        harness.setupMockImport(mockResult);
        await harness.simulateFileUpload(files);

        await act(async () => {
          await harness.processAllFiles();
        });

        if (nodeCount > 0) {
          expect(screen.getByText(`${nodeCount} nodes imported`)).toBeInTheDocument();
          expect(harness.getMockCalls().onImportComplete).toHaveLength(1);
        } else {
          expect(harness.getMockCalls().onImportComplete).toHaveLength(0);
        }

        // Reset for next iteration
        harness.renderComponent({ key: nodeCount }); // Force re-render
      }
    });

    it('maintains state consistency across interactions', async () => {
      harness.renderComponent();

      // Complex interaction sequence
      const files1 = ReactTestDataGenerator.generateMockFiles(2);
      const files2 = ReactTestDataGenerator.generateMockFiles(3);

      // Add first batch
      await harness.simulateFileUpload(files1);
      expect(screen.getByText('Files (2)')).toBeInTheDocument();

      // Add second batch
      await harness.simulateFileUpload(files2);
      expect(screen.getByText('Files (5)')).toBeInTheDocument();

      // Remove files and verify count updates
      const clearButton = screen.getByRole('button', { name: 'Clear All' });
      fireEvent.click(clearButton);
      expect(screen.queryByText('Files (')).not.toBeInTheDocument();

      // Add files again and process
      harness.setupMockImport(ReactTestDataGenerator.generateMockImportResult(2));
      await harness.simulateFileUpload(files1);

      await act(async () => {
        await harness.processAllFiles();
      });

      expect(screen.getByText('4 nodes imported')).toBeInTheDocument();
    });
  });

  describe('Error Boundary and Edge Cases', () => {
    it('handles malformed import results', async () => {
      harness.renderComponent();

      const files = ReactTestDataGenerator.generateMockFiles(1);
      // Setup malformed result
      harness.setupMockImport({} as OfficeImportResult);

      await harness.simulateFileUpload(files);

      await act(async () => {
        await harness.processAllFiles();
      });

      // Should handle gracefully without crashing
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('handles concurrent file uploads', async () => {
      harness.renderComponent();

      const files1 = ReactTestDataGenerator.generateMockFiles(2);
      const files2 = ReactTestDataGenerator.generateMockFiles(3);

      // Simulate rapid consecutive uploads
      await Promise.all([
        harness.simulateFileUpload(files1),
        harness.simulateFileUpload(files2)
      ]);

      // Should handle both batches
      expect(screen.getByText('Files (5)')).toBeInTheDocument();
    });

    it('handles very large file lists', async () => {
      harness.renderComponent();

      // Test with many files (stress test)
      const manyFiles = ReactTestDataGenerator.generateMockFiles(50);
      await harness.simulateFileUpload(manyFiles);

      expect(screen.getByText('Files (50)')).toBeInTheDocument();

      // Should remain responsive
      const clearButton = screen.getByRole('button', { name: 'Clear All' });
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('Accessibility and UX', () => {
    it('has proper ARIA labels and roles', () => {
      harness.renderComponent();

      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Preserve Formatting' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Extract Tables' })).toBeInTheDocument();
    });

    it('shows appropriate loading states', async () => {
      harness.renderComponent();

      const files = ReactTestDataGenerator.generateMockFiles(1);
      harness.setupMockImport(new Promise(resolve =>
        setTimeout(() => resolve(ReactTestDataGenerator.generateMockImportResult(1)), 100)
      ));

      await harness.simulateFileUpload(files);

      const importButton = screen.getByRole('button', { name: /Import 1 Files/ });
      fireEvent.click(importButton);

      // Check spinner appears
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).toBeInTheDocument();
      });
    });

    it('provides clear error feedback', async () => {
      harness.renderComponent();

      const files = ReactTestDataGenerator.generateMockFiles(1);
      harness.setupMockImport(new Error('Network timeout'));

      await harness.simulateFileUpload(files);

      await act(async () => {
        await harness.processAllFiles();
      });

      expect(screen.getByText(/Network timeout/)).toBeInTheDocument();
    });
  });
});

// Export for potential reuse in other test files
export { ReactTestDataGenerator, ImportWizardTestHarness };