/**
 * Base Importer for Isometry ETL
 *
 * Provides abstract Template Method pattern for file import pipeline:
 * parse → validate → transform
 *
 * All format-specific importers (MD, XLSX, DOCX, etc.) must extend this class.
 *
 * @module etl/importers/BaseImporter
 */

import { CanonicalNode } from '../types/canonical';

/**
 * File source with content and metadata.
 * Content can be UTF-8 text or base64 binary.
 */
export interface FileSource {
  /** Original filename (required for extension detection) */
  filename: string;

  /** File content as UTF-8 text or base64 binary */
  content: string;

  /** Content encoding (defaults to utf8) */
  encoding?: 'utf8' | 'base64';

  /** Optional file metadata */
  metadata?: {
    size?: number;
    mimeType?: string;
    source?: string;
  };
}

/**
 * Result of batch import operation.
 */
export interface ImportResult {
  /** Number of nodes successfully imported */
  imported: number;

  /** Number of files skipped due to errors */
  skipped: number;

  /** Errors encountered during import */
  errors: Array<{ file: string; error: string }>;

  /** Duration in milliseconds */
  duration: number;

  /** All successfully imported nodes */
  nodes: CanonicalNode[];
}

/**
 * Abstract base class for all file importers.
 *
 * Uses Template Method pattern:
 * - public import() orchestrates the pipeline
 * - protected abstract methods define format-specific steps
 *
 * Subclasses must implement:
 * - parse(): Format-specific parsing (e.g., XML, CSV, JSON)
 * - transform(): Convert parsed data to CanonicalNode[]
 * - validate(): Optional format-specific validation
 */
export abstract class BaseImporter {
  /**
   * Import a file and convert to CanonicalNode[].
   *
   * Template Method: orchestrates parse → validate → transform pipeline.
   *
   * @param source - File source with content and metadata
   * @returns Array of canonical nodes
   * @throws Error if parsing, validation, or transformation fails
   */
  async import(source: FileSource): Promise<CanonicalNode[]> {
    // Step 1: Parse format-specific content
    const parsed = await this.parse(source);

    // Step 2: Validate parsed data (format-specific validation)
    const validated = await this.validate(parsed);

    // Step 3: Transform to canonical format
    const nodes = await this.transform(validated);

    return nodes;
  }

  /**
   * Parse file content into intermediate format.
   *
   * Format-specific parsing (e.g., XML to DOM, CSV to rows, JSON to object).
   *
   * @param source - File source
   * @returns Parsed data in format-specific structure
   * @throws Error if parsing fails
   */
  protected abstract parse(source: FileSource): Promise<unknown>;

  /**
   * Validate parsed data (format-specific validation).
   *
   * Default implementation is passthrough.
   * Override to add format-specific validation (e.g., schema checks, required fields).
   *
   * @param data - Parsed data
   * @returns Validated data (can be same object)
   * @throws Error if validation fails
   */
  protected async validate(data: unknown): Promise<unknown> {
    // Default: passthrough
    return data;
  }

  /**
   * Transform validated data to CanonicalNode[].
   *
   * Maps format-specific data to LATCH dimensions and canonical schema.
   *
   * @param data - Validated parsed data
   * @returns Array of canonical nodes
   * @throws Error if transformation fails
   */
  protected abstract transform(data: unknown): Promise<CanonicalNode[]>;
}
