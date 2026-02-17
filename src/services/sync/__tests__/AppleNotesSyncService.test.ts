/**
 * AppleNotesSyncService Tests
 *
 * Tests for full and incremental sync orchestration.
 * AppleNotesAdapter is mocked to avoid requiring Node.js runtime.
 *
 * Phase 117-02
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Database } from 'sql.js-fts5';

import { createTestDB, cleanupTestDB, execTestQuery } from '../../../test/db-utils';
import { AppleNotesSyncService, SyncProgress } from '../AppleNotesSyncService';

import type { SourceAdapter, SyncState, SyncResult, CanonicalNode, CanonicalEdge } from '../../../etl/apple-notes-direct/types';

// =============================================================================
// Mock Adapter Factory
// =============================================================================

function makeCanonicalNode(overrides: Partial<CanonicalNode> = {}): CanonicalNode {
  return {
    id: 'apple-notes:1001',
    source: 'apple-notes',
    sourceId: '1001',
    sourceUrl: 'x-coredata://apple-notes/1001',
    nodeType: 'note',
    name: 'Test Note',
    content: '# Test Note\n\nContent here.',
    summary: 'Content here.',
    time: {
      created: new Date('2024-01-15T10:00:00Z'),
      modified: new Date('2024-01-16T11:00:00Z'),
    },
    category: {
      hierarchy: ['Family', 'Stacey'],
      tags: ['tag1'],
      status: 'active',
    },
    hierarchy: {
      priority: 0,
      importance: 0,
      sortOrder: 0,
    },
    ...overrides,
  };
}

function makeCanonicalEdge(overrides: Partial<CanonicalEdge> = {}): CanonicalEdge {
  return {
    id: 'nest:apple-notes:folder:Family/Stacey:apple-notes:1001',
    edgeType: 'NEST',
    sourceId: 'apple-notes:folder:Family/Stacey',
    targetId: 'apple-notes:1001',
    weight: 1.0,
    directed: true,
    ...overrides,
  };
}

function makeDefaultSyncState(): SyncState {
  return {
    lastSync: new Date('2024-01-16T12:00:00Z'),
    watermark: '759686400',
    itemCount: 1,
  };
}

function makeMockAdapter(syncResultOverrides: Partial<SyncResult> = {}): SourceAdapter {
  const defaultSyncResult: SyncResult = {
    nodes: [makeCanonicalNode()],
    edges: [makeCanonicalEdge()],
    deletedIds: [],
    syncState: makeDefaultSyncState(),
    ...syncResultOverrides,
  };

  return {
    sourceType: 'apple-notes',
    displayName: 'Apple Notes',
    isAvailable: vi.fn().mockResolvedValue(true),
    fullSync: vi.fn().mockResolvedValue(defaultSyncResult),
    incrementalSync: vi.fn().mockResolvedValue(defaultSyncResult),
    getSyncState: vi.fn().mockResolvedValue(makeDefaultSyncState()),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('AppleNotesSyncService', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDB({ loadSampleData: false });
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  // ---------------------------------------------------------------------------
  // fullSync
  // ---------------------------------------------------------------------------

  describe('fullSync', () => {
    it('persists nodes and edges to the database', async () => {
      const adapter = makeMockAdapter({
        nodes: [
          makeCanonicalNode({ id: 'apple-notes:1001', sourceId: '1001', name: 'Note 1' }),
          makeCanonicalNode({ id: 'apple-notes:1002', sourceId: '1002', name: 'Note 2' }),
        ],
        edges: [],
        deletedIds: [],
        syncState: makeDefaultSyncState(),
      });

      const service = new AppleNotesSyncService(db, adapter);
      const result = await service.fullSync();

      expect(result.success).toBe(true);
      expect(result.nodesWritten).toBe(2);
      expect(result.edgesWritten).toBe(0);
      expect(result.error).toBeUndefined();

      // Verify nodes are in the DB
      const rows = execTestQuery(db, 'SELECT id, name FROM nodes WHERE source = ?', ['apple-notes']);
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it('persists NEST edges after nodes', async () => {
      const folderNode = makeCanonicalNode({
        id: 'apple-notes:folder:Family/Stacey',
        sourceId: 'Family/Stacey',
        nodeType: 'project',
        name: 'Stacey',
        category: { hierarchy: ['Family'], tags: [], status: 'active' },
      });
      const noteNode = makeCanonicalNode();
      const edge = makeCanonicalEdge();

      const adapter = makeMockAdapter({
        nodes: [folderNode, noteNode],
        edges: [edge],
        deletedIds: [],
        syncState: makeDefaultSyncState(),
      });

      const service = new AppleNotesSyncService(db, adapter);
      const result = await service.fullSync();

      expect(result.success).toBe(true);
      expect(result.nodesWritten).toBe(2);
      expect(result.edgesWritten).toBe(1);

      const edgeRows = execTestQuery(db, 'SELECT edge_type FROM edges WHERE id = ?', [edge.id]);
      expect(edgeRows).toHaveLength(1);
      expect((edgeRows[0] as Record<string, unknown>)['edge_type']).toBe('NEST');
    });

    it('saves sync state to settings table', async () => {
      const syncState = makeDefaultSyncState();
      const adapter = makeMockAdapter({ syncState });
      const service = new AppleNotesSyncService(db, adapter);

      await service.fullSync();

      const storedState = service.getSyncState();
      expect(storedState).not.toBeNull();
      expect(storedState?.itemCount).toBe(syncState.itemCount);
      expect(storedState?.watermark).toBe(syncState.watermark);
    });

    it('fires progress callback with all phases', async () => {
      const adapter = makeMockAdapter();
      const service = new AppleNotesSyncService(db, adapter);
      const phases: string[] = [];

      await service.fullSync({
        onProgress: (progress: SyncProgress) => {
          phases.push(progress.phase);
        },
      });

      expect(phases).toContain('extracting');
      expect(phases).toContain('writing');
      expect(phases).toContain('cleanup');
      expect(phases).toContain('complete');
    });

    it('returns success=false and error message when adapter fails', async () => {
      const adapter = makeMockAdapter();
      vi.mocked(adapter.fullSync).mockRejectedValue(new Error('NoteStore.sqlite not found'));

      const service = new AppleNotesSyncService(db, adapter);
      const result = await service.fullSync();

      expect(result.success).toBe(false);
      expect(result.error).toContain('NoteStore.sqlite not found');
    });

    it('respects batchSize option', async () => {
      const nodes = Array.from({ length: 5 }, (_, i) =>
        makeCanonicalNode({ id: `apple-notes:${1000 + i}`, sourceId: `${1000 + i}`, name: `Note ${i}` })
      );
      const adapter = makeMockAdapter({ nodes, edges: [] });
      const service = new AppleNotesSyncService(db, adapter);

      const progressEvents: SyncProgress[] = [];
      await service.fullSync({
        batchSize: 2,
        onProgress: (p) => progressEvents.push(p),
      });

      // With 5 nodes and batchSize=2, we should get 3 writing progress events
      const writingEvents = progressEvents.filter(e => e.phase === 'writing');
      expect(writingEvents.length).toBeGreaterThan(1);
    });
  });

  // ---------------------------------------------------------------------------
  // incrementalSync
  // ---------------------------------------------------------------------------

  describe('incrementalSync', () => {
    it('uses stored watermark from previous sync', async () => {
      const adapter = makeMockAdapter();
      const service = new AppleNotesSyncService(db, adapter);

      // First, do a full sync to store state
      await service.fullSync();

      // Now do incremental sync
      await service.incrementalSync();

      expect(adapter.incrementalSync).toHaveBeenCalledOnce();
      const callArg = vi.mocked(adapter.incrementalSync).mock.calls[0][0];
      expect(callArg.watermark).toBe(makeDefaultSyncState().watermark);
    });

    it('passes empty state when no previous sync exists', async () => {
      const adapter = makeMockAdapter();
      const service = new AppleNotesSyncService(db, adapter);

      // No full sync first — incremental with no stored state
      await service.incrementalSync();

      expect(adapter.incrementalSync).toHaveBeenCalledOnce();
      const callArg = vi.mocked(adapter.incrementalSync).mock.calls[0][0];
      // Should pass an empty/default state (no watermark)
      expect(callArg.itemCount).toBe(0);
    });

    it('soft-deletes nodes that were removed in source', async () => {
      // First insert two nodes
      const node1 = makeCanonicalNode({ id: 'apple-notes:2001', sourceId: '2001', name: 'Keep' });
      const node2 = makeCanonicalNode({ id: 'apple-notes:2002', sourceId: '2002', name: 'Delete Me' });

      const fullAdapter = makeMockAdapter({ nodes: [node1, node2], edges: [] });
      const service = new AppleNotesSyncService(db, fullAdapter);
      await service.fullSync();

      // Incremental sync reports node 2 as deleted
      const incrAdapter = makeMockAdapter({
        nodes: [],
        edges: [],
        deletedIds: ['apple-notes:2002'],
        syncState: makeDefaultSyncState(),
      });
      const incrService = new AppleNotesSyncService(db, incrAdapter);
      await incrService.incrementalSync();

      // node2 should be soft-deleted
      const rows = execTestQuery(
        db,
        'SELECT deleted_at FROM nodes WHERE id = ?',
        ['apple-notes:2002']
      );
      expect((rows[0] as Record<string, unknown>)['deleted_at']).not.toBeNull();

      // node1 should still be active
      const keepRows = execTestQuery(
        db,
        'SELECT deleted_at FROM nodes WHERE id = ?',
        ['apple-notes:2001']
      );
      expect((keepRows[0] as Record<string, unknown>)['deleted_at']).toBeNull();
    });

    it('fires progress callback with all phases', async () => {
      const adapter = makeMockAdapter();
      const service = new AppleNotesSyncService(db, adapter);
      const phases: string[] = [];

      await service.incrementalSync({
        onProgress: (p) => phases.push(p.phase),
      });

      expect(phases).toContain('extracting');
      expect(phases).toContain('writing');
      expect(phases).toContain('cleanup');
      expect(phases).toContain('complete');
    });

    it('updates sync state after incremental sync', async () => {
      const newSyncState: SyncState = {
        lastSync: new Date('2024-01-20T12:00:00Z'),
        watermark: '760000000',
        itemCount: 50,
      };
      const adapter = makeMockAdapter({ syncState: newSyncState });
      const service = new AppleNotesSyncService(db, adapter);

      await service.incrementalSync();

      const storedState = service.getSyncState();
      expect(storedState?.watermark).toBe('760000000');
      expect(storedState?.itemCount).toBe(50);
    });
  });

  // ---------------------------------------------------------------------------
  // getSyncState
  // ---------------------------------------------------------------------------

  describe('getSyncState', () => {
    it('returns null before any sync', () => {
      const adapter = makeMockAdapter();
      const service = new AppleNotesSyncService(db, adapter);

      expect(service.getSyncState()).toBeNull();
    });

    it('returns stored state after fullSync', async () => {
      const syncState = makeDefaultSyncState();
      const adapter = makeMockAdapter({ syncState });
      const service = new AppleNotesSyncService(db, adapter);

      await service.fullSync();

      const stored = service.getSyncState();
      expect(stored).not.toBeNull();
      expect(stored?.itemCount).toBe(syncState.itemCount);
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: fullSync → incrementalSync flow
  // ---------------------------------------------------------------------------

  describe('end-to-end flow', () => {
    it('fullSync extracts, writes, and saves state; incrementalSync uses watermark', async () => {
      /**
       * Integration flow:
       * 1. fullSync extracts from Apple Notes adapter
       * 2. NodeWriter persists to sql.js nodes/edges tables
       * 3. Sync state saves to settings under 'apple_notes_sync_state'
       * 4. incrementalSync uses watermark from previous sync
       */

      const initialState = makeDefaultSyncState();
      const adapter = makeMockAdapter({
        nodes: [makeCanonicalNode()],
        edges: [],
        syncState: initialState,
      });
      const service = new AppleNotesSyncService(db, adapter);

      // Step 1: Full sync
      const fullResult = await service.fullSync();
      expect(fullResult.success).toBe(true);
      expect(fullResult.nodesWritten).toBe(1);

      // Step 2: Verify state is saved
      const state = service.getSyncState();
      expect(state?.watermark).toBe(initialState.watermark);

      // Step 3: Incremental sync uses watermark
      const newState: SyncState = { ...initialState, watermark: '760000001', itemCount: 2 };
      vi.mocked(adapter.incrementalSync).mockResolvedValue({
        nodes: [makeCanonicalNode({ id: 'apple-notes:1002', sourceId: '1002', name: 'New Note' })],
        edges: [],
        deletedIds: [],
        syncState: newState,
      });

      const incrResult = await service.incrementalSync();
      expect(incrResult.success).toBe(true);
      expect(incrResult.nodesWritten).toBe(1);

      // Step 4: State updated with new watermark
      const updatedState = service.getSyncState();
      expect(updatedState?.watermark).toBe('760000001');
    });
  });
});
