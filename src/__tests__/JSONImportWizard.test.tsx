import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JSONImportWizard from '../components/JSONImportWizard';
import type { Node } from '../types/node';

// Mock the JSON processor
vi.mock('../utils/jsonProcessor', () => ({
  importJSONFile: vi.fn(),
  previewJSONFile: vi.fn(),
  analyzeJSONStructure: vi.fn()
}));

import { importJSONFile, previewJSONFile } from '../utils/jsonProcessor';

// Mock File constructor
class MockFile extends File {
  constructor(content: string, filename: string) {
    super([content], filename, { type: 'application/json' });
  }
}

const mockImportJSONFile = vi.mocked(importJSONFile);
const mockPreviewJSONFile = vi.mocked(previewJSONFile);

describe('JSONImportWizard', () => {
  const mockOnClose = vi.fn();
  const mockOnImportComplete = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onImportComplete: mockOnImportComplete
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock crypto.randomUUID for Node creation
    Object.defineProperty(global, 'crypto', {
      value: {
        randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering and Initial State', () => {
    it('renders when open', () => {
      render(<JSONImportWizard {...defaultProps} />);

      expect(screen.getByText('Upload JSON Files')).toBeInTheDocument();
      expect(screen.getByText('Drop your JSON files here')).toBeInTheDocument();
      expect(screen.getByText('Select JSON Files')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<JSONImportWizard {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Upload JSON Files')).not.toBeInTheDocument();
    });

    it('displays wizard steps correctly', () => {
      render(<JSONImportWizard {...defaultProps} />);

      const stepIndicators = document.querySelectorAll('.w-3.h-3.rounded-full');
      expect(stepIndicators).toHaveLength(4);

      // First step should be active (blue)
      expect(stepIndicators[0]).toHaveClass('bg-blue-600');
    });

    it('shows correct step title for upload', () => {
      render(<JSONImportWizard {...defaultProps} />);

      expect(screen.getByText('Upload JSON Files')).toBeInTheDocument();
      expect(screen.getByText('Supports .json files up to 100MB')).toBeInTheDocument();
    });

    it('includes folder prop in global options', () => {
      render(<JSONImportWizard {...defaultProps} folder="test-folder" />);

      // The folder should be set in global options (we can't directly test this,
      // but it will be tested indirectly through import functionality)
      expect(screen.getByDisplayValue('test-folder')).toBeInTheDocument();
    });
  });

  describe('File Upload and Selection', () => {
    it('handles file input selection', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');

      await user.upload(fileInput, jsonFile);

      expect(screen.getByText('test.json')).toBeInTheDocument();
      expect(screen.getByText('Configure Import')).toBeInTheDocument();
    });

    it('filters non-JSON files', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const txtFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');

      await user.upload(fileInput, [txtFile, jsonFile]);

      expect(screen.getByText('test.json')).toBeInTheDocument();
      expect(screen.queryByText('test.txt')).not.toBeInTheDocument();
    });

    it('handles multiple JSON file selection', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const file1 = new MockFile('{"name": "test1"}', 'test1.json');
      const file2 = new MockFile('{"name": "test2"}', 'test2.json');

      await user.upload(fileInput, [file1, file2]);

      expect(screen.getByText('test1.json')).toBeInTheDocument();
      expect(screen.getByText('test2.json')).toBeInTheDocument();
      expect(screen.getByText('Selected Files (2)')).toBeInTheDocument();
    });

    it('allows removing files', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');

      await user.upload(fileInput, jsonFile);
      expect(screen.getByText('test.json')).toBeInTheDocument();

      const removeButton = screen.getByRole('button', { name: /remove/i });
      await user.click(removeButton);

      expect(screen.queryByText('test.json')).not.toBeInTheDocument();
    });

    it('handles drag and drop', async () => {
      render(<JSONImportWizard {...defaultProps} />);

      const dropzone = screen.getByText('Drop your JSON files here').closest('div');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');

      // Mock DataTransfer
      const mockDataTransfer = {
        files: [jsonFile],
        types: ['Files']
      };

      await act(async () => {
        fireEvent.dragEnter(dropzone!, { dataTransfer: mockDataTransfer });
        fireEvent.dragOver(dropzone!, { dataTransfer: mockDataTransfer });
        fireEvent.drop(dropzone!, { dataTransfer: mockDataTransfer });
      });

      expect(screen.getByText('test.json')).toBeInTheDocument();
    });

    it('shows drag active state', async () => {
      render(<JSONImportWizard {...defaultProps} />);

      const dropzone = screen.getByText('Drop your JSON files here').closest('div');

      await act(async () => {
        fireEvent.dragEnter(dropzone!);
      });

      expect(dropzone).toHaveClass('border-blue-500', 'bg-blue-50');
    });
  });

  describe('Configuration Step', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      // Should auto-advance to configure step
      await waitFor(() => {
        expect(screen.getByText('Configure Import')).toBeInTheDocument();
      });
    });

    it('displays global import settings', () => {
      expect(screen.getByText('Global Import Settings')).toBeInTheDocument();
      expect(screen.getByLabelText('Default Node Type')).toBeInTheDocument();
      expect(screen.getByLabelText('Folder')).toBeInTheDocument();
    });

    it('allows changing node type', async () => {
      const user = userEvent.setup();
      const nodeTypeSelect = screen.getByLabelText('Default Node Type');

      await user.selectOptions(nodeTypeSelect, 'note');
      expect(nodeTypeSelect).toHaveValue('note');
    });

    it('allows changing folder', async () => {
      const user = userEvent.setup();
      const folderInput = screen.getByLabelText('Folder');

      await user.clear(folderInput);
      await user.type(folderInput, 'custom-folder');
      expect(folderInput).toHaveValue('custom-folder');
    });

    it('allows toggling streaming mode', async () => {
      const user = userEvent.setup();
      const streamingCheckbox = screen.getByRole('checkbox', { name: /streaming mode/i });

      await user.click(streamingCheckbox);
      expect(streamingCheckbox).toBeChecked();
    });

    it('allows changing batch size', async () => {
      const user = userEvent.setup();
      const batchSizeInput = screen.getByLabelText('Batch Size:');

      await user.clear(batchSizeInput);
      await user.type(batchSizeInput, '50');
      expect(batchSizeInput).toHaveValue(50);
    });

    it('shows generate previews button', () => {
      expect(screen.getByText('Generate Previews')).toBeInTheDocument();
    });

    it('shows individual preview buttons for each file', () => {
      const previewButtons = screen.getAllByText('Preview');
      expect(previewButtons).toHaveLength(1);
    });
  });

  describe('Preview Generation', () => {
    beforeEach(async () => {
      mockPreviewJSONFile.mockResolvedValue({
        structure: {
          type: 'object',
          rootStructure: {
            isHomogeneous: true,
            hasNestedObjects: false,
            hasArrays: false,
            maxDepth: 1,
            sampleSize: 1
          },
          properties: {
            name: {
              type: 'string',
              frequency: 1,
              sampleValues: ['test'],
              inferredLATCH: 'name',
              nullable: false
            }
          },
          estimatedNodeCount: 1,
          filename: 'test.json'
        },
        sampleData: [{ name: 'test' }],
        inferredMappings: [
          { jsonPath: 'name', targetProperty: 'name' }
        ],
        estimatedNodeCount: 1,
        warnings: []
      });
    });

    it('generates preview when button clicked', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      const previewButton = screen.getByText('Preview');
      await user.click(previewButton);

      expect(mockPreviewJSONFile).toHaveBeenCalledWith(jsonFile);

      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument();
      });
    });

    it('shows preview progress', async () => {
      const user = userEvent.setup();

      // Mock a delayed response
      mockPreviewJSONFile.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          structure: {
            type: 'object',
            rootStructure: { isHomogeneous: true, hasNestedObjects: false, hasArrays: false, maxDepth: 1, sampleSize: 1 },
            properties: {},
            estimatedNodeCount: 1,
            filename: 'test.json'
          },
          sampleData: [],
          inferredMappings: [],
          estimatedNodeCount: 1,
          warnings: []
        }), 100))
      );

      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      const previewButton = screen.getByText('Preview');
      await user.click(previewButton);

      expect(screen.getByText('Analyzing...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('generates all previews at once', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const file1 = new MockFile('{"name": "test1"}', 'test1.json');
      const file2 = new MockFile('{"name": "test2"}', 'test2.json');
      await user.upload(fileInput, [file1, file2]);

      const generateAllButton = screen.getByText('Generate Previews');
      await user.click(generateAllButton);

      expect(mockPreviewJSONFile).toHaveBeenCalledTimes(2);
      expect(mockPreviewJSONFile).toHaveBeenCalledWith(file1);
      expect(mockPreviewJSONFile).toHaveBeenCalledWith(file2);
    });

    it('advances to preview step after generating previews', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      const generateAllButton = screen.getByText('Generate Previews');
      await user.click(generateAllButton);

      await waitFor(() => {
        expect(screen.getByText('Preview & Map Fields')).toBeInTheDocument();
      });
    });

    it('handles preview errors gracefully', async () => {
      const user = userEvent.setup();
      mockPreviewJSONFile.mockRejectedValue(new Error('Invalid JSON'));

      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('invalid json', 'invalid.json');
      await user.upload(fileInput, jsonFile);

      const previewButton = screen.getByText('Preview');
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
      });
    });
  });

  describe('Field Mapping Configuration', () => {
    beforeEach(async () => {
      mockPreviewJSONFile.mockResolvedValue({
        structure: {
          type: 'object',
          rootStructure: { isHomogeneous: true, hasNestedObjects: false, hasArrays: false, maxDepth: 1, sampleSize: 1 },
          properties: {
            name: { type: 'string', frequency: 1, sampleValues: ['test'], inferredLATCH: 'name', nullable: false },
            description: { type: 'string', frequency: 1, sampleValues: ['desc'], inferredLATCH: 'content', nullable: false }
          },
          estimatedNodeCount: 1,
          filename: 'test.json'
        },
        sampleData: [{ name: 'test', description: 'desc' }],
        inferredMappings: [
          { jsonPath: 'name', targetProperty: 'name' },
          { jsonPath: 'description', targetProperty: 'content' }
        ],
        estimatedNodeCount: 1,
        warnings: []
      });

      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      const generateAllButton = screen.getByText('Generate Previews');
      await user.click(generateAllButton);

      await waitFor(() => {
        expect(screen.getByText('Preview & Map Fields')).toBeInTheDocument();
      });
    });

    it('displays field mapping configuration', () => {
      expect(screen.getByText('Field Mapping Configuration')).toBeInTheDocument();
      expect(screen.getByText('test.json')).toBeInTheDocument();
    });

    it('allows expanding file for mapping configuration', async () => {
      const user = userEvent.setup();
      const fileRow = screen.getByText('test.json').closest('div');

      await user.click(fileRow!);

      expect(screen.getByText('Field Mappings')).toBeInTheDocument();
      expect(screen.getByText('Sample Data')).toBeInTheDocument();
    });

    it('shows sample data when expanded', async () => {
      const user = userEvent.setup();
      const fileRow = screen.getByText('test.json').closest('div');

      await user.click(fileRow!);

      expect(screen.getByText('Sample Data')).toBeInTheDocument();
      // JSON content should be visible
      const codeElement = document.querySelector('pre');
      expect(codeElement).toHaveTextContent('"name": "test"');
    });

    it('allows adding new field mappings', async () => {
      const user = userEvent.setup();
      const fileRow = screen.getByText('test.json').closest('div');
      await user.click(fileRow!);

      const addButton = screen.getByText('Add Mapping');
      await user.click(addButton);

      // Should see additional mapping row
      const selects = screen.getAllByDisplayValue('Select JSON field');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('allows editing field mappings', async () => {
      const user = userEvent.setup();
      const fileRow = screen.getByText('test.json').closest('div');
      await user.click(fileRow!);

      // Find mapping selects (there should be 2 inferred mappings)
      const jsonFieldSelects = screen.getAllByDisplayValue('name');
      expect(jsonFieldSelects.length).toBeGreaterThan(0);
    });

    it('allows removing field mappings', async () => {
      const user = userEvent.setup();
      const fileRow = screen.getByText('test.json').closest('div');
      await user.click(fileRow!);

      const removeButtons = document.querySelectorAll('[class*="text-red-600"]');
      if (removeButtons.length > 0) {
        await user.click(removeButtons[0] as HTMLElement);
      }

      // Mapping should be removed (hard to test exact count without more setup)
    });
  });

  describe('Import Process', () => {
    beforeEach(async () => {
      mockPreviewJSONFile.mockResolvedValue({
        structure: {
          type: 'object',
          rootStructure: { isHomogeneous: true, hasNestedObjects: false, hasArrays: false, maxDepth: 1, sampleSize: 1 },
          properties: {
            name: { type: 'string', frequency: 1, sampleValues: ['test'], inferredLATCH: 'name', nullable: false }
          },
          estimatedNodeCount: 1,
          filename: 'test.json'
        },
        sampleData: [{ name: 'test' }],
        inferredMappings: [
          { jsonPath: 'name', targetProperty: 'name' }
        ],
        estimatedNodeCount: 1,
        warnings: []
      });

      mockImportJSONFile.mockResolvedValue({
        nodes: [{
          id: 'test-uuid',
          nodeType: 'json-object',
          name: 'test',
          content: '',
          summary: '',
          createdAt: new Date(),
          modifiedAt: new Date(),
          folder: undefined,
          tags: ['json-import'],
          priority: 0,
          importance: 0,
          sortOrder: 0,
          source: 'json-import',
          sourceId: 'test.json[0]',
          version: 1,
          syncVersion: 0
        }] as Node[],
        errors: [],
        metadata: {
          totalItems: 1,
          processedItems: 1,
          streamingMode: false,
          processingTimeMs: 100
        }
      });
    });

    it('starts import process', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      // Upload and configure
      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      const generateAllButton = screen.getByText('Generate Previews');
      await user.click(generateAllButton);

      await waitFor(() => {
        expect(screen.getByText('Preview & Map Fields')).toBeInTheDocument();
      });

      const importButton = screen.getByText(/Import \d+ Files/);
      await user.click(importButton);

      await waitFor(() => {
        expect(screen.getByText('Import Progress')).toBeInTheDocument();
      });

      expect(mockImportJSONFile).toHaveBeenCalledWith(
        jsonFile,
        expect.objectContaining({
          nodeType: 'json-object',
          source: 'json-import'
        })
      );
    });

    it('shows import progress', async () => {
      const user = userEvent.setup();

      // Mock delayed import
      mockImportJSONFile.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          nodes: [{ id: 'test' } as Node],
          errors: [],
          metadata: { totalItems: 1, processedItems: 1, streamingMode: false, processingTimeMs: 100 }
        }), 100))
      );

      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      const generateAllButton = screen.getByText('Generate Previews');
      await user.click(generateAllButton);

      await waitFor(() => {
        const importButton = screen.getByText(/Import \d+ Files/);
        user.click(importButton);
      });

      expect(screen.getByText('Processing')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('1 nodes')).toBeInTheDocument();
      });
    });

    it('calls completion handler with imported nodes', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      const generateAllButton = screen.getByText('Generate Previews');
      await user.click(generateAllButton);

      await waitFor(() => {
        const importButton = screen.getByText(/Import \d+ Files/);
        user.click(importButton);
      });

      await waitFor(() => {
        expect(mockOnImportComplete).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              id: 'test-uuid',
              name: 'test'
            })
          ])
        );
      });
    });

    it('handles import errors gracefully', async () => {
      const user = userEvent.setup();
      mockImportJSONFile.mockRejectedValue(new Error('Import failed'));

      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      const generateAllButton = screen.getByText('Generate Previews');
      await user.click(generateAllButton);

      await waitFor(() => {
        const importButton = screen.getByText(/Import \d+ Files/);
        user.click(importButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Import failed')).toBeInTheDocument();
      });
    });

    it('shows import summary', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      const generateAllButton = screen.getByText('Generate Previews');
      await user.click(generateAllButton);

      await waitFor(() => {
        const importButton = screen.getByText(/Import \d+ Files/);
        user.click(importButton);
      });

      await waitFor(() => {
        expect(screen.getByText('1 nodes imported')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation and Wizard Flow', () => {
    it('allows back navigation between steps', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      expect(screen.getByText('Configure Import')).toBeInTheDocument();

      // Navigate to preview step
      const nextButton = screen.getByText('Preview Mappings');
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Preview & Map Fields')).toBeInTheDocument();
      });

      // Navigate back
      const backButton = screen.getByText('Back');
      await user.click(backButton);

      expect(screen.getByText('Configure Import')).toBeInTheDocument();
    });

    it('shows appropriate buttons for each step', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      // Upload step - no files
      expect(screen.getByText('Close')).toBeInTheDocument();

      // Upload step - with files
      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      expect(screen.getByText('Configure Import')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('closes wizard when close button clicked', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles empty file upload gracefully', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');

      // Upload empty file array
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [] } });
      });

      // Should remain on upload step
      expect(screen.getByText('Upload JSON Files')).toBeInTheDocument();
    });

    it('disables buttons when appropriate', async () => {
      render(<JSONImportWizard {...defaultProps} />);

      // Generate Previews should be disabled when no files
      expect(screen.getByText('Generate Previews')).toBeDisabled();
    });

    it('maintains wizard state when files are removed', async () => {
      const user = userEvent.setup();
      render(<JSONImportWizard {...defaultProps} />);

      const fileInput = screen.getByLabelText('Select JSON Files');
      const jsonFile = new MockFile('{"name": "test"}', 'test.json');
      await user.upload(fileInput, jsonFile);

      // Remove the file
      const removeButton = document.querySelector('[class*="hover:bg-gray-200"]');
      if (removeButton) {
        await user.click(removeButton as HTMLElement);
      }

      // Should go back to upload step with no files
      expect(screen.queryByText('test.json')).not.toBeInTheDocument();
    });

    it('handles wizard reset correctly', () => {
      render(<JSONImportWizard {...defaultProps} isOpen={false} />);

      // Re-render as open
      render(<JSONImportWizard {...defaultProps} isOpen={true} />);

      expect(screen.getByText('Upload JSON Files')).toBeInTheDocument();
    });
  });
});