/**
 * Apple Notes Source Adapter
 * 
 * Direct SQLite access to NoteStore.sqlite for ETL to Isometry.
 * 
 * Features:
 * - Full sync: Import all notes with folder hierarchy
 * - Incremental sync: Only notes modified since last watermark
 * - Content extraction: Decompress protobuf, convert to markdown
 * - NEST edges: Create folder containment relationships
 * 
 * Usage:
 *   const adapter = new AppleNotesAdapter();
 *   if (await adapter.isAvailable()) {
 *     const result = await adapter.fullSync();
 *     // result.nodes contains CanonicalNode[]
 *     // result.edges contains folder NEST relationships
 *   }
 */

import Database from 'better-sqlite3';
import { existsSync } from 'fs';

import {
  SourceAdapter,
  SyncState,
  SyncResult,
  CanonicalNode,
  CanonicalEdge,
  SourceType,
} from '../../core/types.js';

import {
  getNoteStorePath,
  coreDataTimestampToDate,
  dateToCoreDataTimestamp,
  QUERY_ALL_NOTES,
  QUERY_NOTES_SINCE,
  QUERY_NOTE_CONTENT,
  QUERY_NOTE_COUNT,
  QUERY_DELETED_NOTES,
  RawNoteRow,
  RawContentRow,
  buildFolderHierarchy,
  extractLatchTime,
  extractLatchCategory,
  generateNoteUrl,
} from './schema.js';

import { extractNoteContent } from './content-extractor.js';

// =============================================================================
// Adapter Implementation
// =============================================================================

export class AppleNotesAdapter implements SourceAdapter {
  readonly sourceType: SourceType = 'apple-notes';
  readonly displayName = 'Apple Notes';
  
  private dbPath: string;
  private db: Database.Database | null = null;
  private syncState: SyncState;
  
  constructor(dbPath?: string) {
    this.dbPath = dbPath || getNoteStorePath();
    this.syncState = {
      itemCount: 0,
    };
  }
  
  // ===========================================================================
  // SourceAdapter Interface
  // ===========================================================================
  
  async isAvailable(): Promise<boolean> {
    return existsSync(this.dbPath);
  }
  
  async fullSync(): Promise<SyncResult> {
    this.openDatabase();
    
    try {
      const nodes: CanonicalNode[] = [];
      const edges: CanonicalEdge[] = [];
      const folderNodes = new Map<string, CanonicalNode>();
      
      // Query all notes
      const rows = this.db!.prepare(QUERY_ALL_NOTES).all() as RawNoteRow[];
      
      for (const row of rows) {
        // Create node
        const node = await this.rowToCanonicalNode(row);
        nodes.push(node);
        
        // Create folder nodes and NEST edges
        const folderEdges = this.createFolderStructure(row, node.id, folderNodes);
        edges.push(...folderEdges);
      }
      
      // Add folder nodes to result
      nodes.push(...folderNodes.values());
      
      // Update sync state
      const countResult = this.db!.prepare(QUERY_NOTE_COUNT).get() as { count: number };
      this.syncState = {
        lastSync: new Date(),
        watermark: dateToCoreDataTimestamp(new Date()).toString(),
        itemCount: countResult.count,
      };
      
      return {
        nodes,
        edges,
        deletedIds: [],
        syncState: this.syncState,
      };
      
    } finally {
      this.closeDatabase();
    }
  }
  
  async incrementalSync(state: SyncState): Promise<SyncResult> {
    this.openDatabase();
    
    try {
      const nodes: CanonicalNode[] = [];
      const edges: CanonicalEdge[] = [];
      const folderNodes = new Map<string, CanonicalNode>();
      const deletedIds: string[] = [];
      
      // Parse watermark (Core Data timestamp)
      const watermark = state.watermark ? parseFloat(state.watermark) : 0;
      
      // Query notes modified since watermark
      const rows = this.db!.prepare(QUERY_NOTES_SINCE).all(watermark) as RawNoteRow[];
      
      for (const row of rows) {
        const node = await this.rowToCanonicalNode(row);
        nodes.push(node);
        
        const folderEdges = this.createFolderStructure(row, node.id, folderNodes);
        edges.push(...folderEdges);
      }
      
      // Add folder nodes
      nodes.push(...folderNodes.values());
      
      // Query deleted notes
      const deletedRows = this.db!.prepare(QUERY_DELETED_NOTES).all(watermark) as { id: number }[];
      for (const row of deletedRows) {
        deletedIds.push(`apple-notes:${row.id}`);
      }
      
      // Update sync state
      const countResult = this.db!.prepare(QUERY_NOTE_COUNT).get() as { count: number };
      this.syncState = {
        lastSync: new Date(),
        watermark: dateToCoreDataTimestamp(new Date()).toString(),
        itemCount: countResult.count,
      };
      
      return {
        nodes,
        edges,
        deletedIds,
        syncState: this.syncState,
      };
      
    } finally {
      this.closeDatabase();
    }
  }
  
  async getSyncState(): Promise<SyncState> {
    return this.syncState;
  }
  
  // ===========================================================================
  // Internal Methods
  // ===========================================================================
  
  private openDatabase(): void {
    if (this.db) return;
    
    // Open in read-only mode to avoid conflicts with Notes.app
    this.db = new Database(this.dbPath, { 
      readonly: true,
      fileMustExist: true,
    });
  }
  
  private closeDatabase(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
  
  /**
   * Convert a raw SQLite row to a CanonicalNode
   */
  private async rowToCanonicalNode(row: RawNoteRow): Promise<CanonicalNode> {
    // Get content
    let content = '';
    let summary = row.snippet || '';
    
    try {
      const contentRow = this.db!.prepare(QUERY_NOTE_CONTENT).get(row.id) as RawContentRow | undefined;
      
      if (contentRow?.content_data) {
        const parsed = extractNoteContent(contentRow.content_data);
        content = parsed.markdown;
        
        // Use snippet if available, otherwise extract from content
        if (!summary && parsed.plainText) {
          summary = parsed.plainText.slice(0, 200);
        }
      }
    } catch (error) {
      console.warn(`Failed to extract content for note ${row.id}:`, error);
    }
    
    // Extract LATCH properties
    const time = extractLatchTime(row);
    const category = extractLatchCategory(row);
    
    // TODO: Query tags table and add to category
    // This requires knowing the exact join table name (Z_?TAGS)
    
    return {
      id: `apple-notes:${row.id}`,
      source: 'apple-notes',
      sourceId: row.id.toString(),
      sourceUrl: generateNoteUrl(row.id),
      nodeType: 'note',
      name: row.title,
      content,
      summary,
      time,
      category,
      hierarchy: {
        priority: 0,
        importance: 0,
        sortOrder: 0,
      },
      sourceMeta: {
        accountId: row.account_id,
        folderId: row.folder_id,
      },
    };
  }
  
  /**
   * Create folder nodes and NEST edges for a note's folder hierarchy
   */
  private createFolderStructure(
    row: RawNoteRow,
    noteId: string,
    folderNodes: Map<string, CanonicalNode>
  ): CanonicalEdge[] {
    const edges: CanonicalEdge[] = [];
    const hierarchy = buildFolderHierarchy(row);
    
    if (hierarchy.length === 0) return edges;
    
    // Create folder nodes if they don't exist
    let parentFolderId: string | null = null;
    
    for (let i = 0; i < hierarchy.length; i++) {
      const folderName = hierarchy[i];
      const folderPath = hierarchy.slice(0, i + 1).join('/');
      const folderId = `apple-notes:folder:${folderPath}`;
      
      if (!folderNodes.has(folderId)) {
        folderNodes.set(folderId, {
          id: folderId,
          source: 'apple-notes',
          sourceId: folderPath,
          nodeType: 'project', // Folders are projects in Isometry
          name: folderName,
          time: {
            created: new Date(),
            modified: new Date(),
          },
          category: {
            hierarchy: hierarchy.slice(0, i),
            tags: [],
            status: 'active',
          },
          hierarchy: {
            priority: 0,
            importance: 0,
            sortOrder: 0,
          },
        });
      }
      
      // Create NEST edge from parent folder to this folder
      if (parentFolderId) {
        edges.push({
          id: `nest:${parentFolderId}:${folderId}`,
          edgeType: 'NEST',
          sourceId: parentFolderId,
          targetId: folderId,
          weight: 1.0,
          directed: true,
        });
      }
      
      parentFolderId = folderId;
    }
    
    // Create NEST edge from immediate folder to note
    if (parentFolderId) {
      edges.push({
        id: `nest:${parentFolderId}:${noteId}`,
        edgeType: 'NEST',
        sourceId: parentFolderId,
        targetId: noteId,
        weight: 1.0,
        directed: true,
      });
    }
    
    return edges;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an Apple Notes adapter with default settings
 */
export function createAppleNotesAdapter(): AppleNotesAdapter {
  return new AppleNotesAdapter();
}

// =============================================================================
// CLI Usage (for testing)
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const adapter = createAppleNotesAdapter();
  
  (async () => {
    console.log('Apple Notes ETL Adapter');
    console.log('=======================\n');
    
    const available = await adapter.isAvailable();
    console.log(`Database available: ${available}`);
    
    if (!available) {
      console.log('NoteStore.sqlite not found. Are you on macOS?');
      process.exit(1);
    }
    
    console.log('\nRunning full sync...\n');
    
    const result = await adapter.fullSync();
    
    console.log(`Nodes extracted: ${result.nodes.length}`);
    console.log(`Edges created: ${result.edges.length}`);
    console.log(`Sync state: ${JSON.stringify(result.syncState, null, 2)}`);
    
    // Show sample
    if (result.nodes.length > 0) {
      console.log('\nSample note:');
      const sampleNote = result.nodes.find(n => n.nodeType === 'note');
      if (sampleNote) {
        console.log(`  Title: ${sampleNote.name}`);
        console.log(`  Folder: ${sampleNote.category.hierarchy.join('/')}`);
        console.log(`  Content preview: ${sampleNote.content?.slice(0, 100)}...`);
      }
    }
  })();
}
