// Isometry v5 — Phase 8 ImportOrchestrator
// Wires parser -> dedup -> writer -> catalog into end-to-end pipeline.

import type { Database } from '../database/Database';
import type {
  SourceType,
  ImportResult,
  ParseError,
  CanonicalCard,
  CanonicalConnection,
} from './types';
import { DedupEngine } from './DedupEngine';
import { SQLiteWriter } from './SQLiteWriter';
import { CatalogWriter } from './CatalogWriter';
import { AppleNotesParser, type ParsedFile } from './parsers/AppleNotesParser';

export interface ImportOptions {
  isBulkImport?: boolean;
  filename?: string;
}

/**
 * ImportOrchestrator coordinates the full ETL pipeline:
 * parse -> deduplicate -> write -> catalog
 */
export class ImportOrchestrator {
  private dedup: DedupEngine;
  private writer: SQLiteWriter;
  private catalog: CatalogWriter;

  constructor(private db: Database) {
    this.dedup = new DedupEngine(db);
    this.writer = new SQLiteWriter(db);
    this.catalog = new CatalogWriter(db);
  }

  /**
   * Import data from a source.
   *
   * @param source - Source type identifier
   * @param data - Source data (format depends on source type)
   * @param options - Import options
   * @returns Import result with counts and inserted IDs
   */
  async import(
    source: SourceType,
    data: string,
    options?: ImportOptions
  ): Promise<ImportResult> {
    const startTime = new Date().toISOString();
    const errors: ParseError[] = [];
    let cards: CanonicalCard[] = [];
    let connections: CanonicalConnection[] = [];

    // Step 1: Parse source data
    try {
      const parsed = this.parse(source, data);
      cards = parsed.cards;
      connections = parsed.connections;
      errors.push(...parsed.errors);
    } catch (error) {
      // Fatal parse error
      return this.createErrorResult(error, startTime, options?.filename);
    }

    // Step 2: Deduplicate
    const dedupResult = this.dedup.process(cards, connections, source);

    // Step 3: Determine if bulk import optimization applies
    const totalCards = dedupResult.toInsert.length + dedupResult.toUpdate.length;
    const isBulkImport = options?.isBulkImport ?? (totalCards > 500);

    // Step 4: Write to database
    await this.writer.writeCards(dedupResult.toInsert, isBulkImport);
    await this.writer.updateCards(dedupResult.toUpdate);
    await this.writer.writeConnections(dedupResult.connections);

    // Step 5: Build result
    const result: ImportResult = {
      inserted: dedupResult.toInsert.length,
      updated: dedupResult.toUpdate.length,
      unchanged: dedupResult.toSkip.length,
      skipped: errors.length,
      errors: errors.length,
      connections_created: dedupResult.connections.length,
      insertedIds: dedupResult.toInsert.map(c => c.id),
      errors_detail: errors,
    };

    // Step 6: Record in catalog
    const record: {
      source: SourceType;
      sourceName: string;
      filename?: string;
      started_at: string;
      completed_at: string;
      result: ImportResult;
    } = {
      source,
      sourceName: this.getSourceName(source, options?.filename),
      started_at: startTime,
      completed_at: new Date().toISOString(),
      result,
    };
    if (options?.filename !== undefined) {
      record.filename = options.filename;
    }
    this.catalog.recordImportRun(record);

    return result;
  }

  /**
   * Parse data based on source type.
   */
  private parse(
    source: SourceType,
    data: string
  ): { cards: CanonicalCard[]; connections: CanonicalConnection[]; errors: ParseError[] } {
    switch (source) {
      case 'apple_notes': {
        // Data is JSON array of ParsedFile objects
        const files = JSON.parse(data) as ParsedFile[];
        const parser = new AppleNotesParser();
        return parser.parse(files);
      }

      case 'markdown':
      case 'excel':
      case 'csv':
      case 'json':
      case 'html':
        // These parsers will be implemented in Phase 9
        throw new Error(`Parser not yet implemented: ${source}`);

      default: {
        // Exhaustive check
        const _exhaustive: never = source;
        throw new Error(`Unknown source type: ${_exhaustive}`);
      }
    }
  }

  /**
   * Create error result for fatal parse failures.
   */
  private createErrorResult(
    error: unknown,
    startTime: string,
    filename?: string
  ): ImportResult {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      inserted: 0,
      updated: 0,
      unchanged: 0,
      skipped: 1,
      errors: 1,
      connections_created: 0,
      insertedIds: [],
      errors_detail: [{
        index: -1,
        source_id: filename ?? null,
        message: `Fatal parse error: ${errorMessage}`,
      }],
    };
  }

  /**
   * Generate source name for catalog entry.
   */
  private getSourceName(source: SourceType, filename?: string): string {
    const baseNames: Record<SourceType, string> = {
      apple_notes: 'Apple Notes',
      markdown: 'Markdown Files',
      excel: 'Excel Spreadsheet',
      csv: 'CSV File',
      json: 'JSON Data',
      html: 'HTML Page',
    };

    const baseName = baseNames[source] ?? source;
    return filename ? `${baseName} - ${filename}` : baseName;
  }
}
