/**
 * SuperDensity - Janus Density Model Implementation
 *
 * The revolutionary four-quadrant control system that makes SuperGrid truly polymorphic.
 * Pan (extent) and Zoom (value) are orthogonal - all four combinations are valid and useful.
 *
 * Janus Model Quadrants:
 * ┌─────────────────┬─────────────────┐
 * │ Sparse + Leaf   │ Dense + Leaf    │
 * │ (Full Calendar) │ (Packed Days)   │
 * ├─────────────────┼─────────────────┤
 * │ Sparse + Rolled │ Dense + Rolled  │
 * │ (Quarter View)  │ (Year Summary)  │
 * └─────────────────┴─────────────────┘
 *
 * Features:
 * - Cartographic navigation with pinned upper-left anchor
 * - Dynamic axis granularity (Year → Quarter → Month → Day)
 * - Sparse vs Dense population filtering
 * - Smooth zoom transitions with data preservation
 */

import { useMemo, useCallback } from 'react';
import { usePAFV } from '@/hooks/usePAFV';
import type { LATCHAxis } from '@/types/pafv';
import type { Node } from '@/types/node';

export interface DensityState {
  /** Extent density: sparse (show empty) vs dense (populated-only) */
  extentMode: 'sparse' | 'dense';
  /** Value density: leaf (finest) vs rolled (aggregated) */
  valueMode: 'leaf' | 'rolled';
  /** Zoom level for hierarchical axes (0=coarsest, 3=finest) */
  zoomLevel: number;
  /** Pan offset for cartographic navigation */
  panOffset: { x: number; y: number };
}

interface SuperDensityProps {
  /** Current nodes being displayed */
  nodes: Node[];
  /** Current density state */
  density: DensityState;
  /** Callback when density changes */
  onDensityChange: (newDensity: DensityState) => void;
  /** Available LATCH axes for zoom control */
  activeAxes: LATCHAxis[];
  /** Enable debug overlays */
  debug?: boolean;
}

interface HierarchicalLevel {
  level: number;
  label: string;
  granularity: string;
  sampleValues: string[];
}

/**
 * SuperDensity: Janus Model controls for orthogonal Pan × Zoom
 */
export function SuperDensity({
  nodes,
  density,
  onDensityChange,
  activeAxes,
  debug = false
}: SuperDensityProps) {
  const { state: _pafvState } = usePAFV();

  // Calculate hierarchical levels for active axes
  const hierarchicalLevels = useMemo(() => {
    const levels: Record<LATCHAxis, HierarchicalLevel[]> = {
      location: [
        { level: 0, label: 'Continent', granularity: 'continent', sampleValues: ['North America', 'Europe', 'Asia'] },
        { level: 1, label: 'Country', granularity: 'country', sampleValues: ['USA', 'UK', 'Japan'] },
        { level: 2, label: 'State/Region', granularity: 'state', sampleValues: ['California', 'London', 'Tokyo'] },
        { level: 3, label: 'City', granularity: 'city', sampleValues: ['San Francisco', 'Westminster', 'Shibuya'] }
      ],
      alphabet: [
        { level: 0, label: 'Letter Group', granularity: 'group', sampleValues: ['A-F', 'G-M', 'N-S', 'T-Z'] },
        { level: 1, label: 'Letter Pair', granularity: 'pair', sampleValues: ['A-B', 'C-D', 'E-F'] },
        { level: 2, label: 'Single Letter', granularity: 'letter', sampleValues: ['A', 'B', 'C'] },
        { level: 3, label: 'Word Start', granularity: 'prefix', sampleValues: ['Ab...', 'Ac...', 'Ad...'] }
      ],
      time: [
        { level: 0, label: 'Decade', granularity: 'decade', sampleValues: ['2020s', '2010s', '2000s'] },
        { level: 1, label: 'Year', granularity: 'year', sampleValues: ['2024', '2023', '2022'] },
        { level: 2, label: 'Quarter', granularity: 'quarter', sampleValues: ['Q1 2024', 'Q2 2024', 'Q3 2024'] },
        { level: 3, label: 'Month', granularity: 'month', sampleValues: ['Jan 2024', 'Feb 2024', 'Mar 2024'] }
      ],
      category: [
        { level: 0, label: 'Domain', granularity: 'domain', sampleValues: ['Work', 'Personal', 'Projects'] },
        { level: 1, label: 'Category', granularity: 'category', sampleValues: ['Development', 'Design', 'Research'] },
        { level: 2, label: 'Subcategory', granularity: 'subcategory', sampleValues: ['Frontend', 'Backend', 'Mobile'] },
        { level: 3, label: 'Tag', granularity: 'tag', sampleValues: ['React', 'TypeScript', 'D3.js'] }
      ],
      hierarchy: [
        { level: 0, label: 'Priority Tier', granularity: 'tier', sampleValues: ['Critical', 'Standard', 'Optional'] },
        { level: 1, label: 'Priority Level', granularity: 'priority', sampleValues: ['High', 'Medium', 'Low'] },
        { level: 2, label: 'Importance', granularity: 'importance', sampleValues: ['Important', 'Normal', 'Minor'] },
        { level: 3, label: 'Urgency', granularity: 'urgency', sampleValues: ['Urgent', 'Soon', 'Later'] }
      ]
    };

    return levels;
  }, []);

  // Calculate current density statistics
  const densityStats = useMemo(() => {
    if (!nodes.length) return null;

    const totalPossibleCells = calculateTotalPossibleCells(activeAxes, density.zoomLevel, hierarchicalLevels);
    const populatedCells = calculatePopulatedCells(nodes, activeAxes, density.zoomLevel);
    const sparsityRatio = populatedCells / totalPossibleCells;

    return {
      totalPossibleCells,
      populatedCells,
      emptyCells: totalPossibleCells - populatedCells,
      sparsityRatio,
      compressionRatio: density.valueMode === 'rolled' ? calculateCompressionRatio(nodes, density.zoomLevel) : 1
    };
  }, [nodes, activeAxes, density.zoomLevel, hierarchicalLevels]);

  // Handle extent mode toggle (sparse ↔ dense)
  const handleExtentToggle = useCallback(() => {
    onDensityChange({
      ...density,
      extentMode: density.extentMode === 'sparse' ? 'dense' : 'sparse'
    });
  }, [density, onDensityChange]);

  // Handle value mode toggle (leaf ↔ rolled)
  const handleValueToggle = useCallback(() => {
    onDensityChange({
      ...density,
      valueMode: density.valueMode === 'leaf' ? 'rolled' : 'leaf'
    });
  }, [density, onDensityChange]);

  // Handle zoom level change
  const handleZoomChange = useCallback((newZoom: number) => {
    onDensityChange({
      ...density,
      zoomLevel: Math.max(0, Math.min(3, newZoom))
    });
  }, [density, onDensityChange]);

  // Handle pan change (cartographic navigation)
  const handlePanChange = useCallback((deltaX: number, deltaY: number) => {
    onDensityChange({
      ...density,
      panOffset: {
        x: density.panOffset.x + deltaX,
        y: density.panOffset.y + deltaY
      }
    });
  }, [density, onDensityChange]);

  // Get current quadrant description
  const currentQuadrant = useMemo(() => {
    const extent = density.extentMode === 'sparse' ? 'Sparse' : 'Dense';
    const value = density.valueMode === 'leaf' ? 'Leaf' : 'Rolled';

    const descriptions = {
      'Sparse + Leaf': 'Full Cartesian view with finest detail',
      'Dense + Leaf': 'Populated-only view with finest detail',
      'Sparse + Rolled': 'Full Cartesian view with aggregated data',
      'Dense + Rolled': 'Populated-only view with aggregated data'
    };

    return descriptions[`${extent} + ${value}` as keyof typeof descriptions];
  }, [density.extentMode, density.valueMode]);

  return (
    <div className="superdensity">
      {/* Janus Control Panel */}
      <div className="superdensity__controls">
        <div className="superdensity__section">
          <h3 className="superdensity__title">🎯 Janus Density Control</h3>
          <div className="superdensity__quadrant">{currentQuadrant}</div>
        </div>

        {/* Extent Control (Pan) */}
        <div className="superdensity__section">
          <label className="superdensity__label">
            <span>📍 Extent (Pan)</span>
            <button
              className={`superdensity__toggle superdensity__toggle--${density.extentMode}`}
              onClick={handleExtentToggle}
            >
              <span className="superdensity__toggle-option superdensity__toggle-option--sparse">
                Sparse
              </span>
              <span className="superdensity__toggle-option superdensity__toggle-option--dense">
                Dense
              </span>
            </button>
          </label>
          <div className="superdensity__description">
            {density.extentMode === 'sparse'
              ? 'Show all possible cells (including empty)'
              : 'Show only populated cells'
            }
          </div>
        </div>

        {/* Value Control (Zoom) */}
        <div className="superdensity__section">
          <label className="superdensity__label">
            <span>🔍 Value (Zoom)</span>
            <button
              className={`superdensity__toggle superdensity__toggle--${density.valueMode}`}
              onClick={handleValueToggle}
            >
              <span className="superdensity__toggle-option superdensity__toggle-option--leaf">
                Leaf
              </span>
              <span className="superdensity__toggle-option superdensity__toggle-option--rolled">
                Rolled
              </span>
            </button>
          </label>
          <div className="superdensity__description">
            {density.valueMode === 'leaf'
              ? 'Finest granularity (individual values)'
              : 'Aggregated granularity (grouped values)'
            }
          </div>
        </div>

        {/* Zoom Level Control */}
        <div className="superdensity__section">
          <label className="superdensity__label">
            <span>📏 Zoom Level</span>
            <input
              type="range"
              min="0"
              max="3"
              value={density.zoomLevel}
              onChange={(e) => handleZoomChange(parseInt(e.target.value))}
              className="superdensity__slider"
            />
            <span className="superdensity__zoom-value">
              {density.zoomLevel}/3
            </span>
          </label>

          {/* Show available levels for active axes */}
          <div className="superdensity__zoom-labels">
            {activeAxes.map(axis => {
              const levels = hierarchicalLevels[axis];
              const currentLevel = levels[density.zoomLevel];
              return (
                <div key={axis} className="superdensity__zoom-axis">
                  <span className="superdensity__axis-name">{axis}:</span>
                  <span className="superdensity__level-name">{currentLevel?.label}</span>
                  <code className="superdensity__level-samples">
                    {currentLevel?.sampleValues.slice(0, 2).join(', ')}...
                  </code>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pan Controls (Cartographic Navigation) */}
        <div className="superdensity__section">
          <label className="superdensity__label">🗺️ Pan Offset</label>
          <div className="superdensity__pan-controls">
            <button onClick={() => handlePanChange(0, -10)}>⬆️</button>
            <div className="superdensity__pan-row">
              <button onClick={() => handlePanChange(-10, 0)}>⬅️</button>
              <button onClick={() => onDensityChange({ ...density, panOffset: { x: 0, y: 0 } })}>
                🎯
              </button>
              <button onClick={() => handlePanChange(10, 0)}>➡️</button>
            </div>
            <button onClick={() => handlePanChange(0, 10)}>⬇️</button>
          </div>
          <div className="superdensity__pan-position">
            ({density.panOffset.x}, {density.panOffset.y})
          </div>
        </div>
      </div>

      {/* Density Statistics */}
      {densityStats && (
        <div className="superdensity__stats">
          <div className="superdensity__stat">
            <span className="superdensity__stat-label">Total Cells:</span>
            <span className="superdensity__stat-value">{densityStats.totalPossibleCells.toLocaleString()}</span>
          </div>
          <div className="superdensity__stat">
            <span className="superdensity__stat-label">Populated:</span>
            <span className="superdensity__stat-value">{densityStats.populatedCells.toLocaleString()}</span>
          </div>
          <div className="superdensity__stat">
            <span className="superdensity__stat-label">Sparsity:</span>
            <span className="superdensity__stat-value">
              {(densityStats.sparsityRatio * 100).toFixed(1)}%
            </span>
          </div>
          <div className="superdensity__stat">
            <span className="superdensity__stat-label">Compression:</span>
            <span className="superdensity__stat-value">
              {densityStats.compressionRatio.toFixed(2)}x
            </span>
          </div>
        </div>
      )}

      {/* Debug Information */}
      {debug && (
        <div className="superdensity__debug">
          <details>
            <summary>Janus Debug</summary>
            <pre>{JSON.stringify({
              density,
              densityStats,
              activeAxes,
              nodeCount: nodes.length
            }, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

/**
 * Calculate total possible cells for given axes and zoom level
 */
function calculateTotalPossibleCells(
  axes: LATCHAxis[],
  zoomLevel: number,
  hierarchicalLevels: Record<LATCHAxis, HierarchicalLevel[]>
): number {
  if (!axes.length) return 1;

  return axes.reduce((total, axis) => {
    const levels = hierarchicalLevels[axis];
    const currentLevel = levels[zoomLevel];

    // Estimate based on typical granularity
    const cellCounts = {
      decade: 5, year: 10, quarter: 4, month: 12,
      continent: 7, country: 50, state: 50, city: 1000,
      group: 4, pair: 13, letter: 26, prefix: 100,
      domain: 5, category: 20, subcategory: 50, tag: 200,
      tier: 3, priority: 4, importance: 4, urgency: 3
    };

    const estimatedCount = cellCounts[currentLevel?.granularity as keyof typeof cellCounts] || 10;
    return total * estimatedCount;
  }, 1);
}

/**
 * Calculate actual populated cells from current nodes
 */
function calculatePopulatedCells(nodes: Node[], axes: LATCHAxis[], zoomLevel: number): number {
  if (!nodes.length || !axes.length) return 1;

  const cellKeys = new Set<string>();

  nodes.forEach(node => {
    const cellKey = axes.map(axis => extractCellKey(node, axis, zoomLevel)).join(':');
    cellKeys.add(cellKey);
  });

  return cellKeys.size;
}

/**
 * Calculate compression ratio for rolled vs leaf values
 */
function calculateCompressionRatio(_nodes: Node[], zoomLevel: number): number {
  // Simulate compression based on zoom level
  const compressionFactors = [10, 5, 2, 1]; // Decade->Year->Quarter->Month
  return compressionFactors[zoomLevel] || 1;
}

/**
 * Extract cell key for node at given axis and zoom level
 */
function extractCellKey(node: Node, axis: LATCHAxis, zoomLevel: number): string {
  // Simplified version - in real implementation, this would use
  // the same logic as SuperStack.extractNodeValue but with hierarchical levels
  switch (axis) {
    case 'time':
      const date = new Date(node.createdAt);
      switch (zoomLevel) {
        case 0: return `${Math.floor(date.getFullYear() / 10) * 10}s`;
        case 1: return date.getFullYear().toString();
        case 2: return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
        case 3: return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        default: return date.getFullYear().toString();
      }
    case 'category':
      switch (zoomLevel) {
        case 0: return node.folder ? 'Categorized' : 'Uncategorized';
        case 1: return node.folder || 'Uncategorized';
        case 2: return `${node.folder || 'Uncategorized'}-${node.status || 'None'}`;
        case 3: return `${node.folder || 'Uncategorized'}-${node.status || 'None'}-${node.priority || 0}`;
        default: return node.folder || 'Uncategorized';
      }
    default:
      return 'default';
  }
}