import { useEffect, useState, useRef, useCallback } from 'react';
import { SuperGrid } from '../d3/SuperGrid';
import type { DatabaseService } from '../db/DatabaseService';
import { CardDetailModal } from './CardDetailModal';
import { useSQLite } from '../db/SQLiteProvider';
import { usePAFV } from '../hooks/usePAFV';
import type { LATCHFilter } from '../types/filters';
import { SQLiteDebugConsole } from './SQLiteDebugConsole';

interface FilterChipProps {
  filter: LATCHFilter;
  onRemove: () => void;
}

function FilterChip({ filter, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
      {filter.label}: {filter.displayValue}
      <button
        onClick={onRemove}
        className="ml-2 w-4 h-4 text-blue-600 hover:text-blue-800"
        aria-label="Remove filter"
      >
        ×
      </button>
    </span>
  );
}

/**
 * SuperGridDemo - Demonstration component showcasing multi-select capabilities
 *
 * Features:
 * - Multi-select cards with visual feedback
 * - Keyboard navigation (arrow keys, space, enter, esc)
 * - Bulk operations (delete, edit status, move to folder)
 * - Integration with LATCH filtering
 * - Card detail modals
 */
export function SuperGridDemo() {
  // State management
  const [superGrid, setSuperGrid] = useState<SuperGrid | null>(null);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<LATCHFilter[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [dbService, setDbService] = useState<DatabaseService | null>(null);

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);

  // Context hooks
  const { db, execute: sqliteExecute, loading: sqliteLoading, error: sqliteError } = useSQLite();
  const { state: pafvState } = usePAFV();

  // Debug logging
  console.log('SuperGridDemo: SQLite state', { db: !!db, loading: sqliteLoading, error: sqliteError });

  // Create DatabaseService adapter from SQLite context
  useEffect(() => {
    if (!db) {
      setDbService(null);
      return;
    }

    // Create a simple DatabaseService adapter that wraps the sql.js Database
    const adapter = {
      isReady: () => !!db,
      db,
      SQL: null,
      dirty: false,
      saveTimer: null,
      initialize: async () => {},
      query: function(sql: string, params: any[] = []) {
        console.log('🎯 DatabaseService.query(): Called', { sql, params });

        if (!db) {
          console.error('🚨 DatabaseService.query(): Database not ready');
          throw new Error('Database not ready');
        }

        try {
          const stmt = db.prepare(sql);
          const result: any[] = [];

          if (params && params.length > 0) {
            // Convert unknown[] to proper sql.js parameter types
            const validParams = params.map(p => {
              if (p === null || p === undefined) return null;
              if (typeof p === 'string' || typeof p === 'number' || typeof p === 'boolean') return p;
              return String(p);
            });
            console.log('🎯 DatabaseService.query(): Binding params', validParams);
            stmt.bind(validParams as any);
          }

          while (stmt.step()) {
            result.push(stmt.getAsObject());
          }

          stmt.free();
          console.log('✅ DatabaseService.query(): Result count:', result.length);
          console.log('📝 DatabaseService.query(): Sample results:', result.slice(0, 2));
          return result;
        } catch (error) {
          console.error('Database query error:', error);
          throw error;
        }
      },
      run: (sql: string, params: any[] = []) => {
        if (!db) throw new Error('Database not ready');

        try {
          if (params && params.length > 0) {
            // Convert unknown[] to proper sql.js parameter types
            const validParams = params.map(p => {
              if (p === null || p === undefined) return null;
              if (typeof p === 'string' || typeof p === 'number' || typeof p === 'boolean') return p;
              return String(p);
            });
            const stmt = db.prepare(sql);
            stmt.bind(validParams as any);
            stmt.step();
            stmt.free();
          } else {
            db.run(sql);
          }
        } catch (error) {
          console.error('Database exec error:', error);
          throw error;
        }
      },
      export: () => db.export(),
      close: () => db.close(),
      isDirty: () => false,
      getRawDatabase: () => db,
      transaction: (fn: any) => fn(),
      verifyFTS5: () => ({ available: false }),
      verifyJSON1: () => ({ available: false }),
      verifyRecursiveCTE: () => ({ available: false }),
      getCapabilities: () => ({ fts5: { available: false }, json1: { available: false }, recursiveCTE: { available: false }, ready: true, dirty: false }),
      getStats: () => ({ tables: 0, indexes: 0, triggers: 0, size: 0 }),
      markDirty: () => {}, // Add missing method
      // Add missing drag & drop methods
      updateCardPosition: (cardId: string, x: number, y: number) => {
        try {
          const stmt = db.prepare('UPDATE nodes SET grid_x = ?, grid_y = ?, modified_at = datetime("now") WHERE id = ?');
          stmt.bind([x, y, cardId]);
          stmt.step();
          stmt.free();
          return { success: true };
        } catch (error) {
          console.error('updateCardPosition error:', error);
          return { success: false, error };
        }
      },
      updateCardPositions: (positions: Array<{cardId: string, x: number, y: number}>) => {
        try {
          positions.forEach(pos => {
            const stmt = db.prepare('UPDATE nodes SET grid_x = ?, grid_y = ?, modified_at = datetime("now") WHERE id = ?');
            stmt.bind([pos.x, pos.y, pos.cardId]);
            stmt.step();
            stmt.free();
          });
          return { success: true };
        } catch (error) {
          console.error('updateCardPositions error:', error);
          return { success: false, errors: [error] };
        }
      }
    } as unknown as DatabaseService;

    setDbService(adapter);
  }, [db]);

  // Selection handlers
  const handleSelectionChange = useCallback((selectedIds: string[], focusedId: string | null) => {
    console.log('SuperGridDemo: Selection changed', { count: selectedIds.length, focused: focusedId });
    setSelectedCards(selectedIds);
    setShowBulkActions(selectedIds.length > 1);
  }, []);

  // Card interaction handlers
  const handleCardClick = useCallback((card: any) => {
    console.log('SuperGridDemo: Card clicked', card);
    setSelectedCard(card);
    setIsModalOpen(true);
  }, []);

  const handleFilterRemove = useCallback((filterId: string) => {
    // Remove filter from active filters
    setActiveFilters(prev => prev.filter(filter => filter.id !== filterId));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  // Bulk operation handlers
  const handleBulkDelete = useCallback(async (selectedIds: string[]) => {
    if (!sqliteExecute || selectedIds.length === 0) return;

    try {
      setIsModalLoading(true);
      const selectionManager = superGrid?.getSelectionManager();

      // Soft delete - mark as deleted_at
      const placeholders = selectedIds.map(() => '?').join(', ');
      sqliteExecute(`UPDATE nodes SET deleted_at = datetime('now') WHERE id IN (${placeholders})`, selectedIds);

      // Clear selection and refresh grid
      selectionManager?.clearSelection();
      superGrid?.refresh();

      // Update stats
      const stats = superGrid?.getStats();
      console.log('Bulk delete completed:', { deletedCount: selectedIds.length, stats });

    } catch (error) {
      console.error('Bulk delete error:', error);
    } finally {
      setIsModalLoading(false);
    }
  }, [sqliteExecute, superGrid]);

  const handleBulkStatusUpdate = useCallback(async (selectedIds: string[], newStatus: string) => {
    if (!sqliteExecute || selectedIds.length === 0) return;

    try {
      setIsModalLoading(true);
      const selectionManager = superGrid?.getSelectionManager();

      // Update status for selected cards
      const placeholders = selectedIds.map(() => '?').join(', ');
      sqliteExecute(`UPDATE nodes SET status = ? WHERE id IN (${placeholders})`, [newStatus, ...selectedIds]);

      // Clear selection and refresh grid
      selectionManager?.clearSelection();
      superGrid?.refresh();

      // Update stats
      const stats = superGrid?.getStats();
      console.log('Bulk status update completed:', {
        updatedCount: selectedIds.length,
        newStatus,
        stats
      });

    } catch (error) {
      console.error('Bulk status update error:', error);
    } finally {
      setIsModalLoading(false);
    }
  }, [sqliteExecute, superGrid]);

  const handleBulkFolderMove = useCallback(async (selectedIds: string[], newFolder: string) => {
    if (!sqliteExecute || selectedIds.length === 0) return;

    try {
      setIsModalLoading(true);
      const selectionManager = superGrid?.getSelectionManager();

      // Update folder for selected cards
      const placeholders = selectedIds.map(() => '?').join(', ');
      sqliteExecute(`UPDATE nodes SET folder = ? WHERE id IN (${placeholders})`, [newFolder, ...selectedIds]);

      // Clear selection and refresh grid
      selectionManager?.clearSelection();
      superGrid?.refresh();

      // Update stats
      const stats = superGrid?.getStats();
      console.log('Bulk folder move completed:', {
        movedCount: selectedIds.length,
        newFolder,
        stats
      });

    } catch (error) {
      console.error('Bulk folder move error:', error);
    } finally {
      setIsModalLoading(false);
    }
  }, [sqliteExecute, superGrid]);

  const handleBulkOperation = useCallback((operation: string, selectedIds: string[]) => {
    console.log('SuperGridDemo: Bulk operation requested', { operation, count: selectedIds.length });

    switch (operation) {
      case 'delete':
        handleBulkDelete(selectedIds);
        break;
      case 'archive':
        handleBulkFolderMove(selectedIds, 'archive');
        break;
      default:
        console.warn('Unknown bulk operation:', operation);
    }
  }, [handleBulkDelete, handleBulkFolderMove]);

  // Modal handlers
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCard(null);
    setIsModalLoading(false);
  }, []);

  const handleCardSave = useCallback(async (updatedCard: Partial<any>) => {
    if (!sqliteExecute || !updatedCard.id) return;

    try {
      setIsModalLoading(true);

      // Build dynamic SQL update query
      const updates: string[] = [];
      const params: any[] = [];

      if (updatedCard.name !== undefined) {
        updates.push('name = ?');
        params.push(updatedCard.name);
      }
      if (updatedCard.folder !== undefined) {
        updates.push('folder = ?');
        params.push(updatedCard.folder);
      }
      if (updatedCard.status !== undefined) {
        updates.push('status = ?');
        params.push(updatedCard.status);
      }
      if (updatedCard.summary !== undefined) {
        updates.push('summary = ?');
        params.push(updatedCard.summary);
      }
      if (updatedCard.priority !== undefined) {
        updates.push('priority = ?');
        params.push(updatedCard.priority);
      }
      if (updatedCard.importance !== undefined) {
        updates.push('importance = ?');
        params.push(updatedCard.importance);
      }

      if (updates.length > 0) {
        updates.push('modified_at = datetime(\'now\')');
        params.push(updatedCard.id);

        const sql = `UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`;
        sqliteExecute(sql, params);

        // Refresh grid to show changes
        superGrid?.refresh();

        // Update stats
        const stats = superGrid?.getStats();
        console.log('Card updated:', { cardId: updatedCard.id, stats });
      }

      handleModalClose();

    } catch (error) {
      console.error('Card save error:', error);
    } finally {
      setIsModalLoading(false);
    }
  }, [sqliteExecute, superGrid, handleModalClose]);

  const handleCardDelete = useCallback(async (cardId: string) => {
    if (!sqliteExecute) return;

    try {
      setIsModalLoading(true);

      // Soft delete
      sqliteExecute('UPDATE nodes SET deleted_at = datetime(\'now\') WHERE id = ?', [cardId]);

      // Refresh grid
      superGrid?.refresh();

      // Update stats
      const stats = superGrid?.getStats();
      console.log('Card deleted:', { cardId, stats });

      handleModalClose();

    } catch (error) {
      console.error('Card delete error:', error);
    } finally {
      setIsModalLoading(false);
    }
  }, [sqliteExecute, superGrid, handleModalClose]);

  // Initialize SuperGrid when database service is ready
  useEffect(() => {
    if (!svgRef.current || !dbService) return;

    console.log('SuperGridDemo: Initializing SuperGrid');

    const grid = new SuperGrid(
      svgRef.current,
      dbService,
      {
        columnsPerRow: 4,
        enableHeaders: true,
        enableSelection: true,
        enableKeyboardNavigation: true
      },
      {
        onCardClick: handleCardClick,
        onSelectionChange: handleSelectionChange,
        onBulkOperation: handleBulkOperation
      }
    );

    setSuperGrid(grid);

    // Load initial data with no filters (show all cards)
    console.log('SuperGridDemo: Loading initial data');
    grid.query({});

    // Focus for keyboard navigation
    setTimeout(() => grid.focus(), 100);

    return () => {
      grid.destroy();
      setSuperGrid(null);
    };
  }, [dbService, handleCardClick, handleSelectionChange, handleBulkOperation]);

  // Apply LATCH filters to grid
  useEffect(() => {
    if (!superGrid) return;

    const filters: Record<string, any> = {};

    activeFilters.forEach(filter => {
      filters[filter.dimension] = filter.value;
    });

    console.log('SuperGridDemo: Applying filters', filters);
    superGrid.query(filters);
  }, [superGrid, activeFilters]);

  // Handle PAFV state changes
  useEffect(() => {
    if (!superGrid || !pafvState) return;

    console.log('SuperGridDemo: PAFV state changed', pafvState);
    // Future: Apply PAFV axis mappings to grid layout
  }, [superGrid, pafvState]);

  const handleFilterFromHeader = useCallback((headerValue: string, dimension: string) => {
    const newFilter: LATCHFilter = {
      id: `${dimension}-${headerValue}-${Date.now()}`,
      dimension: dimension as any,
      operator: 'equals',
      value: headerValue,
      displayValue: headerValue,
      label: dimension.charAt(0).toUpperCase() + dimension.slice(1),
      category: 'user'
    };

    setActiveFilters(prev => [...prev, newFilter]);
  }, []);

  // Show loading state while SQLite initializes
  if (sqliteLoading) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SQLite database...</p>
        </div>
      </div>
    );
  }

  // Show error state if SQLite failed to initialize
  if (sqliteError) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="font-semibold mb-2">Database Error</p>
          <p className="text-sm">{sqliteError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* SQLite Debug Console */}
      <div className="flex-none p-4 bg-white border-b border-gray-200">
        <SQLiteDebugConsole />
      </div>

      {/* Header with filter controls */}
      <div className="flex-none p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">SuperGrid Multi-Select Demo</h2>
            <p className="text-sm text-gray-600">
              {selectedCards.length > 0
                ? `${selectedCards.length} card${selectedCards.length > 1 ? 's' : ''} selected`
                : 'Click cards to select, Cmd/Ctrl+click for multi-select, Shift+click for range'
              }
            </p>
          </div>

          {/* Bulk action controls */}
          {showBulkActions && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                {selectedCards.length} selected:
              </span>
              <button
                onClick={() => handleBulkStatusUpdate(selectedCards, 'active')}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                disabled={isModalLoading}
              >
                Mark Active
              </button>
              <button
                onClick={() => handleBulkStatusUpdate(selectedCards, 'completed')}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={isModalLoading}
              >
                Mark Complete
              </button>
              <button
                onClick={() => handleBulkFolderMove(selectedCards, 'archive')}
                className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                disabled={isModalLoading}
              >
                Archive
              </button>
              <button
                onClick={() => handleBulkDelete(selectedCards)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                disabled={isModalLoading}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Active filters */}
        {activeFilters.length > 0 && (
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-sm text-gray-500">Active filters:</span>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map(filter => (
                <FilterChip
                  key={filter.id}
                  filter={filter}
                  onRemove={() => handleFilterRemove(filter.id)}
                />
              ))}
            </div>
            {activeFilters.length > 1 && (
              <button
                onClick={handleClearAllFilters}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Quick filter buttons */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Quick filters:</span>
          <button
            onClick={() => handleFilterFromHeader('active', 'status')}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Active Items
          </button>
          <button
            onClick={() => handleFilterFromHeader('work', 'folder')}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Work Items
          </button>
          <button
            onClick={() => handleFilterFromHeader('5', 'priority')}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            High Priority
          </button>
        </div>
      </div>

      {/* Grid container */}
      <div className="flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ backgroundColor: '#fafafa' }}
          tabIndex={0} // Enable keyboard focus
        />
      </div>

      {/* Keyboard shortcuts help */}
      <div className="flex-none p-2 bg-gray-100 text-xs text-gray-600">
        <span className="font-medium">Keyboard shortcuts:</span>
        <span className="mx-2">Arrow keys: Navigate</span>
        <span className="mx-2">Space/Enter: Select</span>
        <span className="mx-2">Escape: Clear selection</span>
        <span className="mx-2">Cmd/Ctrl+A: Select all</span>
        <span className="mx-2">Shift+Arrow: Extend selection</span>
      </div>

      {/* Card detail modal */}
      <CardDetailModal
        card={selectedCard}
        isOpen={isModalOpen}
        isLoading={isModalLoading}
        onClose={handleModalClose}
        onSave={handleCardSave}
        onDelete={handleCardDelete}
      />
    </div>
  );
}