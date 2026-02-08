/**
 * JanusDensityControls - 4-Level Control Interface
 *
 * React component providing unified control interface for the Janus density model.
 * Implements the 4-level density hierarchy with real-time visual feedback and
 * performance monitoring. Integrates with SuperDensityService and SuperDensityRenderer.
 *
 * Section 2.5 of SuperGrid specification: User interface for SuperDensitySparsity
 * unified aggregation control system.
 *
 * Key Features:
 * - 4-level density controls: Value, Extent, View, Region
 * - Pan × Zoom orthogonal controls with visual quadrant indicators
 * - Real-time aggregation preview with performance feedback
 * - Lossless aggregation confidence indicators
 * - Cross-density accuracy validation
 * - Region mixing controls for sparse + dense columns
 */

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { ChevronDown, Info, Zap, Grid, Layers, Target, Eye } from 'lucide-react';
import type {
  JanusDensityState,
  DensityLevel,
  ExtentDensityMode,
  ValueDensityMode,
  RegionDensityConfig,
  DensityPerformanceMetrics
} from '@/types/supergrid';
import { DEFAULT_JANUS_DENSITY } from '@/types/supergrid';

export interface JanusDensityControlsProps {
  /** Current density state */
  densityState: JanusDensityState;
  /** Callback for density changes */
  onDensityChange: (level: DensityLevel, value: any) => Promise<void>;
  /** Performance metrics */
  performanceMetrics?: DensityPerformanceMetrics[];
  /** Available LATCH axes for granularity control */
  availableAxes: string[];
  /** Data statistics for context */
  dataStats?: {
    totalRows: number;
    populatedCells: number;
    compressionRatio: number;
  };
  /** Enable debug mode */
  debugMode?: boolean;
  /** Enable advanced controls */
  showAdvancedControls?: boolean;
}

/**
 * Janus Density Controls Component
 */
export function JanusDensityControls({
  densityState,
  onDensityChange,
  performanceMetrics = [],
  availableAxes,
  dataStats,
  debugMode = false,
  showAdvancedControls = true
}: JanusDensityControlsProps) {
  const [isChanging, setIsChanging] = useState(false);
  const [showRegionEditor, setShowRegionEditor] = useState(false);
  const [showPerformanceDetails, setShowPerformanceDetails] = useState(false);

  // Performance monitoring
  const averagePerformance = React.useMemo(() => {
    if (performanceMetrics.length === 0) return null;
    const sum = performanceMetrics.reduce((acc, metric) => acc + metric.totalTime, 0);
    return sum / performanceMetrics.length;
  }, [performanceMetrics]);

  const performanceGrade = React.useMemo(() => {
    if (!averagePerformance) return 'A';
    if (averagePerformance < 50) return 'A';
    if (averagePerformance < 100) return 'B';
    if (averagePerformance < 200) return 'C';
    return 'D';
  }, [averagePerformance]);

  /**
   * Handle density level change with performance tracking
   */
  const handleDensityChange = useCallback(async (level: DensityLevel, value: any) => {
    setIsChanging(true);
    try {
      await onDensityChange(level, value);
    } catch (error) {
      console.error('[JanusDensityControls] Density change error:', error);
    } finally {
      setIsChanging(false);
    }
  }, [onDensityChange]);

  /**
   * Get current Janus quadrant description
   */
  const currentQuadrant = React.useMemo(() => {
    const { valueDensity, extentDensity } = densityState;

    const quadrants = {
      'leaf-sparse': {
        name: 'Sparse + Leaf',
        description: 'Full Cartesian view with finest detail',
        example: 'Jan, Feb, Mar with all empty cells',
        color: '#e8f5e8',
        icon: Grid
      },
      'leaf-populated-only': {
        name: 'Dense + Leaf',
        description: 'Populated-only view with finest detail',
        example: 'Jan, Feb, Mar without empty rows',
        color: '#fce4ec',
        icon: Target
      },
      'collapsed-sparse': {
        name: 'Sparse + Rolled',
        description: 'Full Cartesian view with aggregated data',
        example: 'Q1 with empty cells shown',
        color: '#fff3e0',
        icon: Layers
      },
      'collapsed-populated-only': {
        name: 'Dense + Rolled',
        description: 'Populated-only view with aggregated data',
        example: 'Q1 with only populated data',
        color: '#e3f2fd',
        icon: Grid
      }
    };

    return quadrants[`${valueDensity}-${extentDensity}` as keyof typeof quadrants];
  }, [densityState.valueDensity, densityState.extentDensity]);

  /**
   * Get axis granularity display
   */
  const getAxisGranularityDisplay = (axis: string, level: number) => {
    const levelNames = {
      'T': ['Decade', 'Year', 'Quarter', 'Month'],
      'C': ['Domain', 'Category', 'Subcategory', 'Tag'],
      'H': ['Tier', 'Priority', 'Importance', 'Urgency'],
      'L': ['Continent', 'Country', 'State', 'City'],
      'A': ['Groups', 'Pairs', 'Letters', 'Prefixes']
    };

    return levelNames[axis as keyof typeof levelNames]?.[level] || 'Level ' + level;
  };

  return (
    <div className="space-y-6">
      {/* Janus Quadrant Indicator */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <currentQuadrant.icon className="w-5 h-5" />
              Janus Density Control
            </CardTitle>
            <Badge
              variant="outline"
              style={{ backgroundColor: currentQuadrant.color }}
              className="font-mono"
            >
              {currentQuadrant.name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Quadrant Description */}
            <div className="p-3 rounded-lg border bg-muted/50">
              <p className="text-sm font-medium">{currentQuadrant.description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Example: {currentQuadrant.example}
              </p>
            </div>

            {/* Level 1: Value Density Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Level 1: Value Density (Zoom)
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Control per-facet granularity: leaf values vs collapsed aggregates</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={densityState.valueDensity === 'leaf' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDensityChange('value', 'leaf' as ValueDensityMode)}
                  disabled={isChanging}
                >
                  Leaf Values
                </Button>
                <Button
                  variant={densityState.valueDensity === 'collapsed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDensityChange('value', 'collapsed' as ValueDensityMode)}
                  disabled={isChanging}
                >
                  Collapsed
                </Button>
              </div>
            </div>

            {/* Level 2: Extent Density Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Level 2: Extent Density (Pan)
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Control extent visibility: show empty cells vs populated only</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={densityState.extentDensity === 'sparse' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDensityChange('extent', 'sparse' as ExtentDensityMode)}
                  disabled={isChanging}
                >
                  Sparse (Show Empty)
                </Button>
                <Button
                  variant={densityState.extentDensity === 'populated-only' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDensityChange('extent', 'populated-only' as ExtentDensityMode)}
                  disabled={isChanging}
                >
                  Dense (Populated Only)
                </Button>
              </div>
            </div>

            {/* Level 3: View Density Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Grid className="w-4 h-4" />
                  Level 3: View Density
                </Label>
              </div>
              <div className="flex gap-2">
                {['spreadsheet', 'matrix', 'hybrid'].map(mode => (
                  <Button
                    key={mode}
                    variant={densityState.viewDensity === mode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleDensityChange('view', mode)}
                    disabled={isChanging}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Axis Granularity Controls */}
            {availableAxes.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Axis Granularity</Label>
                {availableAxes.map(axis => (
                  <div key={axis} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{axis} Axis</span>
                      <Badge variant="secondary" className="text-xs">
                        {getAxisGranularityDisplay(axis, densityState.axisGranularity[axis] || 0)}
                      </Badge>
                    </div>
                    <Slider
                      value={[densityState.axisGranularity[axis] || 0]}
                      onValueChange={([value]) => handleDensityChange('value', { ...densityState.axisGranularity, [axis]: value })}
                      max={3}
                      step={1}
                      className="w-full"
                      disabled={isChanging}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Monitor */}
      {performanceMetrics.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Performance Monitor</CardTitle>
              <Badge
                variant={performanceGrade === 'A' ? 'default' : performanceGrade === 'B' ? 'secondary' : 'destructive'}
              >
                Grade {performanceGrade}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Average Performance */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Average Response Time</span>
                  <span className="font-mono">{averagePerformance?.toFixed(1)}ms</span>
                </div>
                <Progress
                  value={Math.min(100, (averagePerformance || 0) / 2)}
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0ms</span>
                  <span>Target: &lt;100ms</span>
                  <span>200ms+</span>
                </div>
              </div>

              {/* Performance Details */}
              <Collapsible open={showPerformanceDetails} onOpenChange={setShowPerformanceDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    Performance Details
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {performanceMetrics.slice(-3).map((metric, index) => (
                    <div key={index} className="flex justify-between text-xs p-2 rounded border">
                      <div className="space-y-1">
                        <div>Aggregation: {metric.aggregationTime.toFixed(1)}ms</div>
                        <div>Render: {metric.renderTime.toFixed(1)}ms</div>
                      </div>
                      <div className="space-y-1 text-right">
                        <div>Total: {metric.totalTime.toFixed(1)}ms</div>
                        <div>Cells: {metric.cellsAffected}</div>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Statistics */}
      {dataStats && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Data Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{dataStats.totalRows.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Rows</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{dataStats.populatedCells.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Populated Cells</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{(dataStats.compressionRatio * 100).toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Compression</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Level 4: Region Configuration */}
      {showAdvancedControls && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Level 4: Region Configuration
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRegionEditor(!showRegionEditor)}
              >
                {showRegionEditor ? 'Hide' : 'Show'} Regions
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Collapsible open={showRegionEditor} onOpenChange={setShowRegionEditor}>
              <CollapsibleContent className="space-y-4">
                {densityState.regionConfig.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No region configurations defined</p>
                    <p className="text-xs mt-1">Regions allow mixing sparse + dense columns</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {densityState.regionConfig.map((region, index) => (
                      <RegionConfigCard
                        key={region.regionId}
                        region={region}
                        onUpdate={(updatedRegion) => {
                          const newRegions = [...densityState.regionConfig];
                          newRegions[index] = updatedRegion;
                          handleDensityChange('region', newRegions);
                        }}
                        onRemove={() => {
                          const newRegions = densityState.regionConfig.filter(r => r.regionId !== region.regionId);
                          handleDensityChange('region', newRegions);
                        }}
                      />
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const newRegion: RegionDensityConfig = {
                      regionId: `region-${Date.now()}`,
                      axis: 'C',
                      facet: 'folder',
                      mode: 'sparse',
                      aggregationLevel: 1,
                      visualWeight: 'normal'
                    };
                    handleDensityChange('region', [...densityState.regionConfig, newRegion]);
                  }}
                >
                  Add Region
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* Debug Information */}
      {debugMode && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <details className="text-xs">
                <summary className="cursor-pointer font-medium">Current Density State</summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-auto">
                  {JSON.stringify(densityState, null, 2)}
                </pre>
              </details>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset Button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => {
          Object.entries(DEFAULT_JANUS_DENSITY).forEach(([key, value]) => {
            if (key !== 'regionConfig' && key !== 'axisGranularity' && key !== 'aggregationPreferences') {
              handleDensityChange(key as DensityLevel, value);
            }
          });
        }}
        disabled={isChanging}
      >
        Reset to Defaults
      </Button>
    </div>
  );
}

/**
 * Region Configuration Card Component
 */
interface RegionConfigCardProps {
  region: RegionDensityConfig;
  onUpdate: (region: RegionDensityConfig) => void;
  onRemove: () => void;
}

function RegionConfigCard({ region, onUpdate, onRemove }: RegionConfigCardProps) {
  return (
    <div className="p-3 border rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{region.regionId}</div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <Label className="text-xs">Axis</Label>
          <select
            value={region.axis}
            onChange={(e) => onUpdate({ ...region, axis: e.target.value as any })}
            className="w-full mt-1 px-2 py-1 border rounded"
          >
            <option value="L">Location (L)</option>
            <option value="A">Alphabet (A)</option>
            <option value="T">Time (T)</option>
            <option value="C">Category (C)</option>
            <option value="H">Hierarchy (H)</option>
          </select>
        </div>

        <div>
          <Label className="text-xs">Facet</Label>
          <input
            type="text"
            value={region.facet}
            onChange={(e) => onUpdate({ ...region, facet: e.target.value })}
            className="w-full mt-1 px-2 py-1 border rounded"
            placeholder="folder, status, etc."
          />
        </div>

        <div>
          <Label className="text-xs">Mode</Label>
          <select
            value={region.mode}
            onChange={(e) => onUpdate({ ...region, mode: e.target.value as ExtentDensityMode })}
            className="w-full mt-1 px-2 py-1 border rounded"
          >
            <option value="sparse">Sparse</option>
            <option value="populated-only">Populated Only</option>
          </select>
        </div>

        <div>
          <Label className="text-xs">Weight</Label>
          <select
            value={region.visualWeight}
            onChange={(e) => onUpdate({ ...region, visualWeight: e.target.value as any })}
            className="w-full mt-1 px-2 py-1 border rounded"
          >
            <option value="light">Light</option>
            <option value="normal">Normal</option>
            <option value="heavy">Heavy</option>
          </select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Aggregation Level: {region.aggregationLevel}</Label>
        <Slider
          value={[region.aggregationLevel]}
          onValueChange={([value]) => onUpdate({ ...region, aggregationLevel: value })}
          max={3}
          step={1}
          className="w-full mt-2"
        />
      </div>
    </div>
  );
}