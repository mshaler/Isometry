import React, { useEffect, useMemo, useCallback } from 'react';
import { Eye, EyeOff, Code, BarChart3 } from 'lucide-react';
import './SuperAudit.css';

export interface CellState {
  id: string;
  type: 'raw' | 'computed' | 'enriched' | 'crud_created' | 'crud_modified' | 'crud_deleted';
  value: any;
  formula?: string;
  source?: string;
  crudOperation?: 'CREATE' | 'UPDATE' | 'DELETE';
  lastModified: string;
}

export type AuditMode = 'off' | 'highlight' | 'formulas';

export interface SuperAuditProps {
  cellStates: CellState[];
  currentMode: AuditMode;
  onModeChange: (mode: AuditMode) => void;
  onHighlightComputed: (cellIds: string[]) => void;
  className?: string;
}

const AUDIT_MODE_CONFIG = {
  off: {
    icon: EyeOff,
    label: 'Off',
    description: 'Show all cells normally'
  },
  highlight: {
    icon: Eye,
    label: 'Highlight',
    description: 'Highlight computed and enriched cells'
  },
  formulas: {
    icon: Code,
    label: 'Formulas',
    description: 'Show formulas and computation details'
  }
} as const;

const CELL_TYPE_STYLES = {
  raw: {
    color: '#374151',
    backgroundColor: 'transparent',
    borderColor: '#e5e7eb',
    label: 'Raw Data'
  },
  computed: {
    color: '#1d4ed8',
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
    label: 'Computed'
  },
  enriched: {
    color: '#059669',
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
    label: 'Enriched'
  },
  crud_created: {
    color: '#7c3aed',
    backgroundColor: '#ede9fe',
    borderColor: '#8b5cf6',
    label: 'Created'
  },
  crud_modified: {
    color: '#f59e0b',
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    label: 'Modified'
  },
  crud_deleted: {
    color: '#dc2626',
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    label: 'Deleted'
  }
} as const;

/**
 * SuperAudit - Visual distinction for computed values and CRUD operations
 *
 * Features:
 * - Raw data cells: standard appearance
 * - Computed cells (formulas, aggregations): distinct highlight
 * - Enriched cells (ETL-derived data): different indicator
 * - Recent CRUD operations: brief flash/highlight on change
 * - Toggle mode to show/hide computation indicators
 * - Performance optimized for real-time updates
 *
 * Part of the Super* feature family for SuperGrid.
 */
export const SuperAudit: React.FC<SuperAuditProps> = ({
  cellStates,
  currentMode,
  onModeChange,
  onHighlightComputed,
  className = ''
}) => {
  // Calculate cell statistics
  const cellStats = useMemo(() => {
    const stats = {
      total: cellStates.length,
      raw: 0,
      computed: 0,
      enriched: 0,
      crud_created: 0,
      crud_modified: 0,
      crud_deleted: 0
    };

    cellStates.forEach(cell => {
      stats[cell.type]++;
    });

    return stats;
  }, [cellStates]);

  // Get computed cell IDs for highlighting
  const computedCellIds = useMemo(() => {
    return cellStates
      .filter(cell => cell.type !== 'raw')
      .map(cell => cell.id);
  }, [cellStates]);

  // Handle mode cycling
  const handleModeToggle = useCallback(() => {
    const modes: AuditMode[] = ['off', 'highlight', 'formulas'];
    const currentIndex = modes.indexOf(currentMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    onModeChange(nextMode);
  }, [currentMode, onModeChange]);

  // Notify parent of cells to highlight when mode changes
  useEffect(() => {
    if (currentMode === 'highlight' || currentMode === 'formulas') {
      onHighlightComputed(computedCellIds);
    } else {
      onHighlightComputed([]);
    }
  }, [currentMode, computedCellIds, onHighlightComputed]);

  // Get computed cells for formula display
  const computedCells = useMemo(() => {
    return cellStates.filter(cell => cell.type === 'computed' && cell.formula);
  }, [cellStates]);

  // Get enriched cells for source display
  const enrichedCells = useMemo(() => {
    return cellStates.filter(cell => cell.type === 'enriched');
  }, [cellStates]);

  // Get recent CRUD operations
  const crudCells = useMemo(() => {
    return cellStates.filter(cell =>
      cell.type.startsWith('crud_') && cell.crudOperation
    );
  }, [cellStates]);

  const CurrentModeIcon = AUDIT_MODE_CONFIG[currentMode].icon;

  return (
    <div className={`super-audit ${className}`}>
      {/* Audit Control Bar */}
      <div className="super-audit__control-bar">
        <button
          onClick={handleModeToggle}
          className="super-audit__toggle"
          aria-label="Toggle audit mode"
          title={`Current: ${AUDIT_MODE_CONFIG[currentMode].description}`}
        >
          <CurrentModeIcon size={16} />
          <span>Audit Mode: {AUDIT_MODE_CONFIG[currentMode].label}</span>
        </button>

        {currentMode !== 'off' && (
          <div className="super-audit__status">
            <span className="super-audit__stats">
              {cellStats.total} cells tracked
            </span>
          </div>
        )}
      </div>

      {/* Audit Details (shown in highlight and formulas mode) */}
      {currentMode === 'highlight' && (
        <div className="super-audit__highlight-legend">
          <h4>Cell Types</h4>
          <div className="super-audit__legend-grid">
            {Object.entries(CELL_TYPE_STYLES).map(([type, style]) => {
              const count = cellStats[type as keyof typeof cellStats];
              if (count === 0) return null;

              return (
                <div key={type} className="super-audit__legend-item">
                  <div
                    className="super-audit__legend-indicator"
                    style={{
                      backgroundColor: style.backgroundColor,
                      borderColor: style.borderColor,
                      color: style.color
                    }}
                  />
                  <span className="super-audit__legend-label">
                    {count} {style.label.toLowerCase()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {currentMode === 'formulas' && (
        <div className="super-audit__formula-details">
          <h4>Cell Analysis</h4>

          {/* Summary Statistics */}
          <div className="super-audit__breakdown">
            <div className="super-audit__stat-grid">
              <div className="super-audit__stat-item">
                <span className="super-audit__stat-value">{cellStats.raw}</span>
                <span className="super-audit__stat-label">Raw Data</span>
              </div>
              <div className="super-audit__stat-item">
                <span className="super-audit__stat-value">{cellStats.computed}</span>
                <span className="super-audit__stat-label">Computed</span>
              </div>
              <div className="super-audit__stat-item">
                <span className="super-audit__stat-value">{cellStats.enriched}</span>
                <span className="super-audit__stat-label">Enriched</span>
              </div>
              <div className="super-audit__stat-item">
                <span className="super-audit__stat-value">
                  {cellStats.crud_created + cellStats.crud_modified + cellStats.crud_deleted}
                </span>
                <span className="super-audit__stat-label">Modified</span>
              </div>
            </div>
          </div>

          {/* Computed Cells Details */}
          {computedCells.length > 0 && (
            <div className="super-audit__computed-section">
              <h5>Computed Cells</h5>
              <div className="super-audit__formula-list">
                {computedCells.slice(0, 10).map(cell => (
                  <div key={cell.id} className="super-audit__formula-item">
                    <code className="super-audit__formula">{cell.formula}</code>
                    <span className="super-audit__formula-result">→ {cell.value}</span>
                  </div>
                ))}
                {computedCells.length > 10 && (
                  <div className="super-audit__formula-more">
                    +{computedCells.length - 10} more formulas
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enriched Cells Details */}
          {enrichedCells.length > 0 && (
            <div className="super-audit__enriched-section">
              <h5>Enriched Data Sources</h5>
              <div className="super-audit__source-list">
                {[...new Set(enrichedCells.map(cell => cell.source))].map(source => {
                  const count = enrichedCells.filter(cell => cell.source === source).length;
                  return (
                    <div key={source} className="super-audit__source-item">
                      <span className="super-audit__source-name">{source}</span>
                      <span className="super-audit__source-count">({count} cells)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent CRUD Operations */}
          {crudCells.length > 0 && (
            <div className="super-audit__crud-section">
              <h5>Recent Operations</h5>
              <div className="super-audit__crud-list">
                {crudCells.slice(0, 5).map(cell => (
                  <div key={cell.id} className="super-audit__crud-item">
                    <span className={`super-audit__crud-operation super-audit__crud-operation--${cell.crudOperation?.toLowerCase()}`}>
                      {cell.crudOperation}
                    </span>
                    <span className="super-audit__crud-value">{cell.value}</span>
                    <span className="super-audit__crud-time">
                      {new Date(cell.lastModified).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SuperAudit;