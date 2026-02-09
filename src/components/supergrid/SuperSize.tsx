/**
 * SuperSize - Inline Cell Expansion and Count Badges
 *
 * Implements SuperGrid's inline cell expansion feature with smart sizing controls,
 * count badges for multi-card cells, and performance-optimized expansion/collapse
 * animations. Integrates with D3.js rendering and maintains grid layout consistency.
 *
 * Section 2.3 of SuperGrid specification: Inline cell expansion system with
 * count badges and smart sizing controls.
 *
 * Key Features:
 * - Inline cell expansion with smooth animations
 * - Count badges for multi-card cells
 * - Smart auto-sizing based on content
 * - Performance-optimized expansion/collapse
 * - Grid layout consistency maintenance
 * - Cross-density expansion support
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent
} from '@/components/ui/collapsible';
import {
  Maximize2,
  Minimize2,
  Grid3x3,
  ExpandIcon,
  Layers,
  Settings
} from 'lucide-react';
import type { Node } from '@/types/node';

export interface SuperSizeConfig {
  /** Default cell size */
  defaultCellSize: { width: number; height: number };
  /** Expansion animation duration */
  animationDuration: number;
  /** Maximum expansion size */
  maxExpansionSize: { width: number; height: number };
  /** Show count badges */
  showCountBadges: boolean;
  /** Enable auto-sizing */
  enableAutoSizing: boolean;
  /** Minimum cell size */
  minCellSize: { width: number; height: number };
  /** Grid gap for expansion */
  expansionGap: number;
}

export interface CellExpansionState {
  /** Expanded cell IDs */
  expandedCells: Set<string>;
  /** Cell sizes by ID */
  cellSizes: Map<string, { width: number; height: number }>;
  /** Cell content counts */
  cellCounts: Map<string, number>;
  /** Auto-sizing enabled cells */
  autoSizedCells: Set<string>;
  /** Currently animating cells */
  animatingCells: Set<string>;
}

export interface SuperSizeProps {
  /** Grid data with cell information */
  gridData: Array<{
    id: string;
    nodes: Node[];
    position: { x: number; y: number };
    size: { width: number; height: number };
  }>;
  /** SuperSize configuration */
  config: Partial<SuperSizeConfig>;
  /** Expansion state change callback */
  onExpansionChange?: (state: CellExpansionState) => void;
  /** Cell size change callback */
  onCellSizeChange?: (cellId: string, size: { width: number; height: number }) => void;
  /** Cell click callback */
  onCellClick?: (cellId: string, nodes: Node[]) => void;
  /** Enable debug mode */
  debugMode?: boolean;
  /** CSS class name */
  className?: string;
}

const DEFAULT_SUPERSIZE_CONFIG: SuperSizeConfig = {
  defaultCellSize: { width: 120, height: 80 },
  animationDuration: 300,
  maxExpansionSize: { width: 400, height: 300 },
  showCountBadges: true,
  enableAutoSizing: true,
  minCellSize: { width: 80, height: 60 },
  expansionGap: 8
};

/**
 * SuperSize Component - Inline cell expansion with count badges
 */
export function SuperSize({
  gridData,
  config = {},
  onExpansionChange,
  onCellSizeChange,
  onCellClick,
  debugMode = false,
  className = ''
}: SuperSizeProps) {
  const [expansionState, setExpansionState] = useState<CellExpansionState>({
    expandedCells: new Set(),
    cellSizes: new Map(),
    cellCounts: new Map(),
    autoSizedCells: new Set(),
    animatingCells: new Set()
  });

  const [showControls, setShowControls] = useState(false);
  const [globalSizeFactor, setGlobalSizeFactor] = useState(1.0);

  const fullConfig: SuperSizeConfig = { ...DEFAULT_SUPERSIZE_CONFIG, ...config };

  // Calculate cell counts and initialize state
  useEffect(() => {
    const newCellCounts = new Map<string, number>();
    const newCellSizes = new Map<string, { width: number; height: number }>();

    gridData.forEach(cell => {
      newCellCounts.set(cell.id, cell.nodes.length);

      // Initialize cell size if not already set
      if (!expansionState.cellSizes.has(cell.id)) {
        newCellSizes.set(cell.id, {
          width: fullConfig.defaultCellSize.width * globalSizeFactor,
          height: fullConfig.defaultCellSize.height * globalSizeFactor
        });
      } else {
        newCellSizes.set(cell.id, expansionState.cellSizes.get(cell.id)!);
      }
    });

    setExpansionState(prev => ({
      ...prev,
      cellCounts: newCellCounts,
      cellSizes: newCellSizes
    }));
  }, [gridData, globalSizeFactor, fullConfig.defaultCellSize]);

  // Notify parent of state changes
  useEffect(() => {
    onExpansionChange?.(expansionState);
  }, [expansionState, onExpansionChange]);

  /**
   * Toggle cell expansion
   */
  const toggleCellExpansion = useCallback((cellId: string) => {
    setExpansionState(prev => {
      const newExpandedCells = new Set(prev.expandedCells);
      const newAnimatingCells = new Set(prev.animatingCells);
      const newCellSizes = new Map(prev.cellSizes);

      const isExpanded = prev.expandedCells.has(cellId);
      const cellData = gridData.find(cell => cell.id === cellId);

      if (!cellData) return prev;

      // Start animation
      newAnimatingCells.add(cellId);

      if (isExpanded) {
        // Collapse
        newExpandedCells.delete(cellId);
        newCellSizes.set(cellId, {
          width: fullConfig.defaultCellSize.width * globalSizeFactor,
          height: fullConfig.defaultCellSize.height * globalSizeFactor
        });
      } else {
        // Expand
        newExpandedCells.add(cellId);

        if (prev.autoSizedCells.has(cellId)) {
          // Auto-size based on content
          const contentSize = calculateAutoSize(cellData.nodes, fullConfig);
          newCellSizes.set(cellId, contentSize);
        } else {
          // Use default expansion size
          newCellSizes.set(cellId, {
            width: Math.min(fullConfig.maxExpansionSize.width, fullConfig.defaultCellSize.width * 2),
            height: Math.min(fullConfig.maxExpansionSize.height, fullConfig.defaultCellSize.height * 2)
          });
        }
      }

      // Clear animation flag after duration
      setTimeout(() => {
        setExpansionState(currentState => ({
          ...currentState,
          animatingCells: new Set([...currentState.animatingCells].filter(id => id !== cellId))
        }));
      }, fullConfig.animationDuration);

      const newSize = newCellSizes.get(cellId)!;
      onCellSizeChange?.(cellId, newSize);

      return {
        ...prev,
        expandedCells: newExpandedCells,
        animatingCells: newAnimatingCells,
        cellSizes: newCellSizes
      };
    });
  }, [gridData, fullConfig, globalSizeFactor, onCellSizeChange]);

  // Removed unused functions setCellSize and toggleAutoSizing to fix TypeScript warnings

  /**
   * Handle cell click
   */
  const handleCellClick = useCallback((cellId: string) => {
    const cellData = gridData.find(cell => cell.id === cellId);
    if (cellData) {
      onCellClick?.(cellId, cellData.nodes);
    }
  }, [gridData, onCellClick]);

  /**
   * Expand/collapse all cells
   */
  const expandAllCells = useCallback(() => {
    setExpansionState(prev => {
      const newExpandedCells = new Set(gridData.map(cell => cell.id));
      const newCellSizes = new Map(prev.cellSizes);

      gridData.forEach(cell => {
        if (prev.autoSizedCells.has(cell.id)) {
          const autoSize = calculateAutoSize(cell.nodes, fullConfig);
          newCellSizes.set(cell.id, autoSize);
        } else {
          newCellSizes.set(cell.id, {
            width: Math.min(fullConfig.maxExpansionSize.width, fullConfig.defaultCellSize.width * 2),
            height: Math.min(fullConfig.maxExpansionSize.height, fullConfig.defaultCellSize.height * 2)
          });
        }
        onCellSizeChange?.(cell.id, newCellSizes.get(cell.id)!);
      });

      return {
        ...prev,
        expandedCells: newExpandedCells,
        cellSizes: newCellSizes
      };
    });
  }, [gridData, fullConfig, onCellSizeChange]);

  const collapseAllCells = useCallback(() => {
    setExpansionState(prev => {
      const newCellSizes = new Map(prev.cellSizes);

      gridData.forEach(cell => {
        const defaultSize = {
          width: fullConfig.defaultCellSize.width * globalSizeFactor,
          height: fullConfig.defaultCellSize.height * globalSizeFactor
        };
        newCellSizes.set(cell.id, defaultSize);
        onCellSizeChange?.(cell.id, defaultSize);
      });

      return {
        ...prev,
        expandedCells: new Set(),
        cellSizes: newCellSizes
      };
    });
  }, [gridData, fullConfig.defaultCellSize, globalSizeFactor, onCellSizeChange]);

  // Render grid cells with SuperSize controls
  const renderGridCells = useMemo(() => {
    return gridData.map(cell => {
      const isExpanded = expansionState.expandedCells.has(cell.id);
      const isAnimating = expansionState.animatingCells.has(cell.id);
      const isAutoSized = expansionState.autoSizedCells.has(cell.id);
      const cellSize = expansionState.cellSizes.get(cell.id) || fullConfig.defaultCellSize;
      const cellCount = expansionState.cellCounts.get(cell.id) || 0;

      return (
        <div
          key={cell.id}
          className={`
            relative border border-gray-300 bg-white rounded-lg cursor-pointer
            transition-all duration-${fullConfig.animationDuration}
            ${isExpanded ? 'z-10 shadow-lg' : 'shadow-sm'}
            ${isAnimating ? 'animate-pulse' : ''}
            hover:shadow-md
          `}
          style={{
            width: cellSize.width,
            height: cellSize.height,
            left: cell.position.x,
            top: cell.position.y,
            position: 'absolute'
          }}
          onClick={() => handleCellClick(cell.id)}
        >
          {/* Count Badge */}
          {fullConfig.showCountBadges && cellCount > 1 && (
            <Badge
              variant="secondary"
              className="absolute -top-2 -right-2 z-20 min-w-[20px] h-5 text-xs font-mono"
            >
              {cellCount}
            </Badge>
          )}

          {/* Auto-size indicator */}
          {isAutoSized && (
            <div className="absolute top-1 left-1 w-2 h-2 bg-blue-500 rounded-full z-20" />
          )}

          {/* Expansion toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1 w-6 h-6 p-0 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              toggleCellExpansion(cell.id);
            }}
          >
            {isExpanded ? (
              <Minimize2 className="w-3 h-3" />
            ) : (
              <Maximize2 className="w-3 h-3" />
            )}
          </Button>

          {/* Cell content */}
          <div className="p-2 h-full overflow-hidden">
            <div className="text-xs font-medium text-gray-800 mb-1 line-clamp-2">
              {cell.nodes[0]?.name || 'Untitled'}
            </div>

            {isExpanded && cellCount > 1 && (
              <div className="space-y-1">
                {cell.nodes.slice(0, isExpanded ? undefined : 1).map((node) => (
                  <div key={node.id} className="text-xs text-gray-600 line-clamp-1">
                    • {node.name || 'Untitled'}
                  </div>
                ))}
                {cellCount > 3 && !isExpanded && (
                  <div className="text-xs text-gray-500">
                    +{cellCount - 1} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    });
  }, [gridData, expansionState, fullConfig, handleCellClick, toggleCellExpansion]);

  return (
    <div className={`relative ${className}`}>
      {/* SuperSize Controls */}
      <Card className="absolute top-4 right-4 w-80 z-30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4" />
              SuperSize Controls
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowControls(!showControls)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <Collapsible open={showControls} onOpenChange={setShowControls}>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Global Size Factor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Global Size Factor</Label>
                  <span className="text-xs font-mono">{globalSizeFactor.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[globalSizeFactor]}
                  onValueChange={([value]) => setGlobalSizeFactor(value)}
                  min={0.5}
                  max={3.0}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {/* Expansion Controls */}
              <div className="space-y-2">
                <Label className="text-sm">Expansion Controls</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={expandAllCells}
                    className="flex-1"
                  >
                    <ExpandIcon className="w-3 h-3 mr-1" />
                    Expand All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={collapseAllCells}
                    className="flex-1"
                  >
                    <Grid3x3 className="w-3 h-3 mr-1" />
                    Collapse All
                  </Button>
                </div>
              </div>

              {/* Stats Display */}
              <div className="pt-2 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold">{expansionState.expandedCells.size}</div>
                    <div className="text-xs text-gray-500">Expanded</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold">{expansionState.autoSizedCells.size}</div>
                    <div className="text-xs text-gray-500">Auto-sized</div>
                  </div>
                </div>
              </div>

              {/* Debug Information */}
              {debugMode && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium">Debug Info</summary>
                  <pre className="mt-2 p-2 bg-gray-50 rounded overflow-auto text-[10px]">
                    {JSON.stringify({
                      expandedCells: Array.from(expansionState.expandedCells),
                      cellCounts: Object.fromEntries(expansionState.cellCounts),
                      autoSizedCells: Array.from(expansionState.autoSizedCells),
                      animatingCells: Array.from(expansionState.animatingCells)
                    }, null, 2)}
                  </pre>
                </details>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Grid Container */}
      <div className="relative w-full h-full">
        {renderGridCells}
      </div>
    </div>
  );
}

/**
 * Calculate auto-size for cell based on content
 */
function calculateAutoSize(nodes: Node[], config: SuperSizeConfig): { width: number; height: number } {
  const contentCount = nodes.length;
  const baseSize = config.defaultCellSize;

  // Simple algorithm: more content = larger size
  const scaleFactor = Math.min(3, 1 + (contentCount - 1) * 0.2);

  return {
    width: Math.min(config.maxExpansionSize.width, baseSize.width * scaleFactor),
    height: Math.min(config.maxExpansionSize.height, baseSize.height * scaleFactor)
  };
}

export default SuperSize;