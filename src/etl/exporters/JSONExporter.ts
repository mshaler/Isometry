// Isometry v5 — JSONExporter
// Phase 09-04 ETL-15: Export cards to JSON with pretty printing
//
// Purpose: Machine-readable backup format with all card data
// Format: Pretty-printed JSON with 2-space indentation

import type { Card, Connection } from '../../database/queries/types';

/**
 * JSON export data structure.
 * Includes cards, connections, and metadata.
 */
export interface JSONExportData {
  cards: Array<Card & { tags: string[] }>;
  connections: Connection[];
  exportedAt: string;
  version: string;
}

/**
 * Exports cards to JSON format with pretty printing.
 *
 * Features:
 * - Pretty-printed with 2-space indentation
 * - Tags as arrays (already arrays in Card type)
 * - All card columns included
 * - Connections in separate array
 * - Export metadata (timestamp, version)
 *
 * Requirements: ETL-15 (JSON export)
 */
export class JSONExporter {
  /**
   * Export cards to JSON format.
   *
   * @param cards Cards to export
   * @param connections Optional connections to include
   * @returns Pretty-printed JSON string
   */
  export(cards: Card[], connections: Connection[] = []): string {
    const exportData: JSONExportData = {
      cards: cards.map((card) => ({
        ...card,
        tags: card.tags || [], // Ensure tags is always array
      })),
      connections,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    return JSON.stringify(exportData, null, 2);
  }
}
