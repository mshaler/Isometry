import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SuperGrid } from '../../d3/SuperGrid';
import { SuperSearch } from './SuperSearch';
import { SuperAudit, type CellState, type AuditMode } from './SuperAudit';
import { SuperCalc } from './SuperCalc';
import { useDatabaseService, usePAFV } from '@/hooks';
import type { GridConfig } from '../../types/grid';
import type { FilterCompilationResult } from '../../services/LATCHFilterService';
import { superGridLogger } from '@/utils/logging/dev-logger';

interface AdvancedSuperGridDemoProps {
  className?: string;
}

/**
 * AdvancedSuperGridDemo - Complete integration of SuperSearch, SuperAudit, and SuperCalc
 *
 * Demonstrates the enterprise-grade SuperGrid experience with:
 * - Real-time FTS5 search with in-grid highlighting
 * - Visual distinction for computed vs raw data cells
 * - PAFV-aware formula calculations with Excel-compatible syntax
 * - Seamless integration maintaining <100ms performance targets
 *
 * This showcases the full Advanced SuperGrid Features suite working together.
 */
export const AdvancedSuperGridDemo: React.FC<AdvancedSuperGridDemoProps> = ({
  className = ''
}) => {
  // Core state
  const [searchQuery, setSearchQuery] = useState('');
  const [auditMode, setAuditMode] = useState<AuditMode>('off');
  const [highlightedCells, setHighlightedCells] = useState<string[]>([]);
  const [cellStates, setCellStates] = useState<CellState[]>([]);
  const [gridData, setGridData] = useState<any[]>([]);

  // Refs and services
  const containerRef = useRef<SVGSVGElement>(null);
  const superGridRef = useRef<SuperGrid | null>(null);
  const database = useDatabaseService();
  const pafv = usePAFV();

  // Initialize SuperGrid
  useEffect(() => {
    if (!containerRef.current || !database) return;

    const gridConfig: GridConfig = {
      columnsPerRow: 4,
      enableHeaders: true,
      enableColumnResizing: true,
      enableProgressiveDisclosure: true,
      enableCartographicZoom: true
    };

    const callbacks = {
      onCardClick: handleCardClick,
      onSelectionChange: handleSelectionChange,
      onCardUpdate: handleCardUpdate,
      onHeaderClick: handleHeaderClick
    };

    superGridRef.current = new SuperGrid(
      containerRef.current,
      database,
      gridConfig,
      callbacks
    );

    // Initial data load
    loadGridData();

    // Generate initial cell states for audit
    generateCellStates();

    return () => {
      superGridRef.current?.destroy();
    };
  }, [database]);

  // Load grid data
  const loadGridData = useCallback(() => {
    if (!database) return;

    try {
      const cards = database.query(
        'SELECT * FROM nodes WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 50',
        []
      ) || [];

      setGridData(cards);

      // Update SuperGrid
      if (superGridRef.current) {
        superGridRef.current.query();
      }
    } catch (error) {
      console.error('Error loading grid data:', error);
    }
  }, [database]);

  // Generate cell states for SuperAudit demonstration
  const generateCellStates = useCallback(() => {
    if (!gridData.length) return;

    const states: CellState[] = gridData.map((card, index) => {
      // Simulate different cell types for demonstration
      let type: CellState['type'] = 'raw';

      if (index % 5 === 0) {
        type = 'computed';
      } else if (index % 7 === 0) {
        type = 'enriched';
      } else if (index % 11 === 0) {
        type = 'crud_modified';
      }

      return {
        id: card.id,
        type,
        value: card.name,
        formula: type === 'computed' ? `=COUNTOVER(status)` : undefined,
        source: type === 'enriched' ? 'ETL Pipeline' : undefined,
        crudOperation: type === 'crud_modified' ? 'UPDATE' : undefined,
        lastModified: card.modified_at || card.created_at
      };
    });

    setCellStates(states);
  }, [gridData]);

  // Regenerate cell states when grid data changes
  useEffect(() => {
    generateCellStates();
  }, [gridData, generateCellStates]);

  // SuperGrid event handlers
  const handleCardClick = useCallback((card: unknown) => {
    superGridLogger.debug('Card clicked:', { card });
  }, []);

  const handleSelectionChange = useCallback((selectedIds: string[], focusedId: string | null) => {
    superGridLogger.debug('Selection changed:', { selectedIds, focusedId });
  }, []);

  const handleCardUpdate = useCallback((card: unknown) => {
    superGridLogger.debug('Card updated:', { card });

    // Update cell state to reflect CRUD operation
    setCellStates(prev => prev.map(cell =>
      cell.id === card.id
        ? { ...cell, type: 'crud_modified', crudOperation: 'UPDATE', lastModified: new Date().toISOString() }
        : cell
    ));
  }, []);

  const handleHeaderClick = useCallback((axis: string, facet: string, value: unknown) => {
    superGridLogger.debug('Header clicked:', { axis, facet, value });
  }, []);

  // SuperSearch handlers
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (query && superGridRef.current) {
      // Filter grid based on search
      const filterResult: FilterCompilationResult = {
        whereClause: 'name LIKE ? OR summary LIKE ?',
        parameters: [`%${query}%`, `%${query}%`],
        isEmpty: false,
        activeFilters: [
          {
            id: `search-${Date.now()}`,
            axis: 'A', // Alphabet
            facet: 'name',
            operator: 'contains',
            value: query,
            label: `Search: "${query}"`,
            timestamp: Date.now()
          }
        ]
      };

      superGridRef.current.query(filterResult);
    } else if (superGridRef.current) {
      // Clear search, show all data
      superGridRef.current.query();
    }
  }, []);

  const handleSearchHighlight = useCallback((cardIds: string[]) => {
    setHighlightedCells(cardIds);

    // Apply visual highlighting to grid
    if (superGridRef.current && containerRef.current) {
      const container = containerRef.current;

      // Reset all cards
      container.querySelectorAll('.card-group').forEach(card => {
        card.classList.remove('search-highlight');
      });

      // Highlight search results
      cardIds.forEach(id => {
        const cardElement = container.querySelector(`[data-card-id="${id}"]`);
        if (cardElement) {
          cardElement.classList.add('search-highlight');
        }
      });
    }
  }, []);

  // SuperAudit handlers
  const handleAuditModeChange = useCallback((mode: AuditMode) => {
    setAuditMode(mode);
  }, []);

  const handleAuditHighlight = useCallback((cellIds: string[]) => {
    if (superGridRef.current && containerRef.current) {
      const container = containerRef.current;

      // Reset audit highlighting
      container.querySelectorAll('.card-group').forEach(card => {
        card.classList.remove('audit-highlight', 'computed-cell', 'enriched-cell', 'crud-cell');
      });

      // Apply audit highlighting
      cellIds.forEach(cellId => {
        const cellState = cellStates.find(state => state.id === cellId);
        const cardElement = container.querySelector(`[data-card-id="${cellId}"]`);

        if (cardElement && cellState) {
          cardElement.classList.add('audit-highlight');

          switch (cellState.type) {
            case 'computed':
              cardElement.classList.add('computed-cell');
              break;
            case 'enriched':
              cardElement.classList.add('enriched-cell');
              break;
            case 'crud_created':
            case 'crud_modified':
            case 'crud_deleted':
              cardElement.classList.add('crud-cell');
              break;
          }
        }
      });
    }
  }, [cellStates]);

  // SuperCalc handlers
  const handleFormulaExecute = useCallback((formula: string, result: unknown) => {
    superGridLogger.debug('Formula executed:', { formula, result });

    // Add computed cells to audit tracking
    if (result.type === 'table' || result.type === 'pivot') {
      const newCellState: CellState = {
        id: `computed-${Date.now()}`,
        type: 'computed',
        value: result.summary,
        formula: formula,
        lastModified: new Date().toISOString()
      };

      setCellStates(prev => [...prev, newCellState]);
    }
  }, []);

  // Get PAFV state for SuperCalc
  const getAxisMapping = (plane: 'x' | 'y' | 'z') => {
    const mapping = pafv.state.mappings.find(m => m.plane === plane);
    return mapping ? mapping.axis : null;
  };

  const pafvState = {
    xAxis: getAxisMapping('x') || 'status',
    yAxis: getAxisMapping('y') || 'priority',
    zAxis: getAxisMapping('z') || 'folder'
  };

  return (
    <div className={`advanced-supergrid-demo ${className}`}>
      {/* Control Panel */}
      <div className="advanced-supergrid__controls">
        <h2>Advanced SuperGrid Features</h2>
        <p className="advanced-supergrid__description">
          Enterprise-grade data exploration with search, audit, and calculation capabilities
        </p>

        {/* SuperSearch */}
        <div className="advanced-supergrid__feature">
          <h3>SuperSearch</h3>
          <SuperSearch
            onSearch={handleSearch}
            onHighlight={handleSearchHighlight}
            showFacets={true}
            placeholder="Search across all cards with FTS5..."
          />
        </div>

        {/* SuperAudit */}
        <div className="advanced-supergrid__feature">
          <h3>SuperAudit</h3>
          <SuperAudit
            cellStates={cellStates}
            currentMode={auditMode}
            onModeChange={handleAuditModeChange}
            onHighlightComputed={handleAuditHighlight}
          />
        </div>

        {/* SuperCalc */}
        <div className="advanced-supergrid__feature">
          <h3>SuperCalc</h3>
          <SuperCalc
            onFormulaExecute={handleFormulaExecute}
            gridData={gridData}
            pafvState={pafvState}
          />
        </div>
      </div>

      {/* SuperGrid Visualization */}
      <div className="advanced-supergrid__visualization">
        <svg
          ref={containerRef}
          className="advanced-supergrid__canvas"
          width="100%"
          height="600"
        />
      </div>

      {/* Status and Metrics */}
      <div className="advanced-supergrid__status">
        <div className="status-item">
          <span className="status-label">Cards:</span>
          <span className="status-value">{gridData.length}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Search Results:</span>
          <span className="status-value">{highlightedCells.length}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Cell States:</span>
          <span className="status-value">{cellStates.length}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Audit Mode:</span>
          <span className="status-value">{auditMode}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Search Query:</span>
          <span className="status-value">{searchQuery || 'None'}</span>
        </div>
      </div>

      <style>{`
        .advanced-supergrid-demo {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px;
          background: #f8fafc;
          min-height: 100vh;
        }

        .advanced-supergrid__controls {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .advanced-supergrid__controls h2 {
          margin: 0;
          color: #1f2937;
          font-size: 24px;
          font-weight: 700;
        }

        .advanced-supergrid__description {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        .advanced-supergrid__feature {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .advanced-supergrid__feature h3 {
          margin: 0;
          color: #374151;
          font-size: 16px;
          font-weight: 600;
        }

        .advanced-supergrid__visualization {
          flex: 1;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .advanced-supergrid__canvas {
          display: block;
        }

        .advanced-supergrid__status {
          display: flex;
          gap: 20px;
          padding: 16px 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .status-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .status-label {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }

        .status-value {
          font-size: 16px;
          color: #1f2937;
          font-weight: 600;
        }

        /* Grid highlighting styles */
        :global(.card-group.search-highlight .card-background) {
          stroke: #f59e0b !important;
          stroke-width: 2px !important;
          fill: #fef3c7 !important;
        }

        :global(.card-group.audit-highlight.computed-cell .card-background) {
          stroke: #3b82f6 !important;
          stroke-width: 2px !important;
          fill: #dbeafe !important;
        }

        :global(.card-group.audit-highlight.enriched-cell .card-background) {
          stroke: #10b981 !important;
          stroke-width: 2px !important;
          fill: #d1fae5 !important;
        }

        :global(.card-group.audit-highlight.crud-cell .card-background) {
          stroke: #f59e0b !important;
          stroke-width: 2px !important;
          fill: #fef3c7 !important;
        }

        @media (max-width: 768px) {
          .advanced-supergrid__status {
            flex-wrap: wrap;
            gap: 12px;
          }

          .advanced-supergrid__controls {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default AdvancedSuperGridDemo;