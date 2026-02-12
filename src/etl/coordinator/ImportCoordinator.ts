/**
 * Import Coordinator for Isometry ETL
 *
 * Central router for file imports based on extension detection.
 * Uses Factory pattern to delegate to format-specific importers.
 *
 * @module etl/coordinator/ImportCoordinator
 */

import path from 'path';
import { BaseImporter, FileSource, ImportResult } from '../importers/BaseImporter';
import { CanonicalNode, CanonicalNodeSchema } from '../types/canonical';

/**
 * Supported file extensions.
 * Importers register for one or more of these extensions.
 */
const SUPPORTED_EXTENSIONS = [
  '.md', '.markdown', '.mdx',
  '.xlsx', '.xls',
  '.docx',
  '.json',
  '.html', '.htm',
  '.csv', '.tsv',
] as const;

/**
 * Central coordinator for file import operations.
 *
 * Responsibilities:
 * - Extension-based format detection
 * - Routing files to registered importers
 * - Batch import orchestration
 * - Output validation with CanonicalNodeSchema
 */
export class ImportCoordinator {
  /** Map of file extension -> importer instance */
  private importers: Map<string, BaseImporter>;

  constructor() {
    this.importers = new Map();
  }

  /**
   * Register an importer for one or more file extensions.
   *
   * Extensions are normalized to lowercase for consistent matching.
   *
   * @param extensions - Array of file extensions (e.g., ['.md', '.markdown'])
   * @param importer - Importer instance to handle these extensions
   *
   * @example
   * coordinator.registerImporter(['.md', '.markdown'], new MarkdownImporter());
   */
  registerImporter(extensions: string[], importer: BaseImporter): void {
    for (const ext of extensions) {
      const normalized = ext.toLowerCase();
      this.importers.set(normalized, importer);
    }
  }

  /**
   * Get list of all registered file extensions.
   *
   * @returns Array of lowercase file extensions
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.importers.keys());
  }

  /**
   * Detect file format from filename extension.
   *
   * @param filename - Full filename or path
   * @returns Normalized lowercase extension (e.g., '.md')
   * @throws Error if extension is unsupported or missing
   */
  detectFormat(filename: string): string {
    const ext = path.extname(filename).toLowerCase();

    if (!ext) {
      throw new Error(`File has no extension: ${filename}`);
    }

    if (!SUPPORTED_EXTENSIONS.includes(ext as typeof SUPPORTED_EXTENSIONS[number])) {
      throw new Error(
        `Unsupported file format: ${ext} (supported: ${SUPPORTED_EXTENSIONS.join(', ')})`
      );
    }

    return ext;
  }

  /**
   * Get registered importer for file extension.
   *
   * @param extension - File extension (e.g., '.md')
   * @returns Importer instance
   * @throws Error if no importer registered for extension
   */
  getImporter(extension: string): BaseImporter {
    const normalized = extension.toLowerCase();
    const importer = this.importers.get(normalized);

    if (!importer) {
      throw new Error(
        `No importer registered for extension: ${extension} ` +
        `(registered: ${this.getSupportedExtensions().join(', ')})`
      );
    }

    return importer;
  }

  /**
   * Import a single file.
   *
   * Routes to appropriate importer based on extension,
   * then validates all output nodes with CanonicalNodeSchema.
   *
   * @param source - File source with content and metadata
   * @returns Array of validated canonical nodes
   * @throws Error if no importer registered, parsing fails, or validation fails
   */
  async importFile(source: FileSource): Promise<CanonicalNode[]> {
    // Detect format and get importer
    const extension = this.detectFormat(source.filename);
    const importer = this.getImporter(extension);

    // Import via format-specific importer
    const nodes = await importer.import(source);

    // Validate EVERY node with canonical schema
    const validatedNodes: CanonicalNode[] = [];
    for (let i = 0; i < nodes.length; i++) {
      try {
        const validated = CanonicalNodeSchema.parse(nodes[i]);
        validatedNodes.push(validated);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Node ${i} from ${source.filename} failed validation: ${message}`
        );
      }
    }

    return validatedNodes;
  }

  /**
   * Import multiple files in batch.
   *
   * Collects errors without failing entire batch.
   * Tracks duration and provides detailed result metrics.
   *
   * @param sources - Array of file sources
   * @returns Import result with metrics and all successful nodes
   */
  async importFiles(sources: FileSource[]): Promise<ImportResult> {
    const startTime = performance.now();
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: [],
      duration: 0,
      nodes: [],
    };

    // Process files sequentially (simpler error handling than Promise.allSettled)
    for (const source of sources) {
      try {
        const nodes = await this.importFile(source);
        result.imported++;
        result.nodes.push(...nodes);
      } catch (err) {
        result.skipped++;
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push({
          file: source.filename,
          error: message,
        });
      }
    }

    result.duration = performance.now() - startTime;
    return result;
  }
}
