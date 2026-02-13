/**
 * Import Test Utilities
 *
 * Shared test utilities for ImportWizard and related tests.
 * Extracted to a separate file to avoid Vitest running tests when imported.
 */

import type { Node } from '../../../types/node';
import type { OfficeImportResult } from '../../../utils/officeDocumentProcessor';

/**
 * Property-based test data generators for React components
 */
export class ReactTestDataGenerator {
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
      nodeType: 'note' as const,
      name: `Test Document ${i}`,
      content: `Content for test document ${i}`,
      summary: `Summary ${i}`,
      // LATCH: Location
      latitude: null,
      longitude: null,
      locationName: null,
      locationAddress: null,
      // LATCH: Time
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      modifiedAt: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
      dueAt: null,
      completedAt: null,
      eventStart: null,
      eventEnd: null,
      // LATCH: Category
      folder: i % 2 === 0 ? 'test-folder' : null,
      tags: i % 3 === 0 ? [`tag-${i}`] : [],
      status: null,
      // LATCH: Hierarchy
      priority: 0,
      importance: 0,
      sortOrder: i,
      // Metadata
      source: 'test',
      sourceId: `source-${i}`,
      sourceUrl: null,
      deletedAt: null,
      version: 1,
    }));
  }

  static generateMockImportResult(nodeCount: number = 5, errorCount: number = 0): OfficeImportResult {
    return {
      nodes: this.generateMockNodes(nodeCount),
      errors: Array.from({ length: errorCount }, (_, i) => `Error ${i}: Mock import error`),
      metadata: {}
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
