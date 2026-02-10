import React, { useState } from 'react';
import { useFilters } from '@/state/FilterContext';
import { useFilterPreview } from '@/hooks/ui/useFilterPreview';
import { LATCHFilter } from './LATCHFilter';
import { FilterPresetDropdown } from './FilterPresetDropdown';
import { ChevronUp, Activity, Database, AlertCircle, CheckCircle, Clock, BarChart3 } from 'lucide-react';

/**
 * FilterPanelOverlay - LATCH filter control panel for overlay
 *
 * Displays 5 filter sections (one per LATCH axis) with preview/apply pattern.
 * User adjusts filters, sees real-time preview count, then applies or cancels.
 *
 * Architecture:
 * - Each LATCH axis gets its own control section
 * - Preview filters stored separately from active filters
 * - Real-time preview count shows "N notes match these filters" (debounced 300ms)
 * - Apply button commits preview to active filters
 * - Cancel button discards preview
 * - Clear All button resets all preview filters
 *
 * LATCH Axes:
 * - Location: Bounding box or text input (MVP: text input)
 * - Alphabet: Text search with prefix matching
 * - Time: Date range picker
 * - Category: Multi-select dropdown
 * - Hierarchy: Parent/child selector (MVP: text input)
 */

interface FilterPanelOverlayProps {
  onApply: () => void;
  onCancel: () => void;
}

// Helper function to determine bridge status
function getBridgeStatus(
  isInitialized: boolean,
  isBridgeMode: boolean,
  isBridgeAvailable: boolean,
  bridgeAvailable: boolean
) {
  if (!isInitialized) {
    return { text: 'Initializing...', icon: Clock, color: 'text-yellow-500' };
  }
  if (isBridgeMode && isBridgeAvailable) {
    return { text: 'Native Bridge Connected', icon: CheckCircle, color: 'text-green-600' };
  }
  if (bridgeAvailable && !isBridgeMode) {
    return { text: 'Bridge Available (using SQL.js)', icon: Database, color: 'text-blue-600' };
  }
  if (!bridgeAvailable) {
    return { text: 'SQL.js Backend', icon: Database, color: 'text-gray-600' };
  }
  return { text: 'Unknown Status', icon: AlertCircle, color: 'text-red-500' };
}

// Performance Panel Component
function PerformancePanel({
  executionTime,
  currentBackend,
  isBridgeMode,
  bridgeResults,
  count,
  bridgeSequenceId,
  onClose
}: {
  executionTime: number | null;
  currentBackend: string;
  isBridgeMode: boolean;
  bridgeResults: any[];
  count: number | null;
  bridgeSequenceId: string | undefined;
  onClose: () => void;
}) {
  return (
    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-700">Performance Metrics</span>
        <button
          onClick={onClose}
          className="ml-auto p-0.5 text-gray-400 hover:text-gray-600 rounded"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-gray-500">Backend:</span>
          <span className="ml-1 font-medium">{currentBackend}</span>
        </div>
        <div>
          <span className="text-gray-500">Query Time:</span>
          <span className="ml-1 font-medium">
            {executionTime ? `${executionTime}ms` : '-'}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Results:</span>
          <span className="ml-1 font-medium">
            {isBridgeMode ? bridgeResults.length : count || 0}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Sequence:</span>
          <span className="ml-1 font-medium text-gray-400">
            {bridgeSequenceId ? `#${bridgeSequenceId.slice(-6)}` : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}

// Filter Header Component
function FilterHeader({
  bridgeStatus,
  bridgeError,
  showPerformancePanel,
  onTogglePerformance
}: {
  bridgeStatus: ReturnType<typeof getBridgeStatus>;
  bridgeError: string | null;
  showPerformancePanel: boolean;
  onTogglePerformance: () => void;
}) {
  const StatusIcon = bridgeStatus.icon;

  return (
    <div className="px-6 py-4 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Filter Controls</h2>
          <p className="text-sm text-gray-500 mt-1">
            Adjust LATCH filters to narrow down your notes
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <StatusIcon className={`w-4 h-4 ${bridgeStatus.color}`} />
          <span className={`font-medium ${bridgeStatus.color}`}>
            {bridgeStatus.text}
          </span>
          <button
            onClick={onTogglePerformance}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="Toggle performance panel"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {bridgeError && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 font-medium">Filter Error</p>
          </div>
          <p className="text-sm text-red-600 mt-1">{bridgeError}</p>
        </div>
      )}
    </div>
  );
}

// Preview Count Component
function PreviewCount({
  isLoading,
  isBridgeMode,
  bridgeIsLoading,
  executionTime,
  count,
  bridgeResults
}: {
  isLoading: boolean;
  isBridgeMode: boolean;
  bridgeIsLoading: boolean;
  executionTime: number | null;
  count: number | null;
  bridgeResults: any[];
}) {
  if (isLoading || bridgeIsLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin h-3 w-3 border border-gray-300 border-t-green-600 rounded-full"></div>
        <span className="text-gray-400">
          {isBridgeMode ? 'Executing native bridge query...' : 'Calculating with SQL.js...'}
        </span>
        {executionTime && (
          <span className="text-gray-500">({executionTime}ms)</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        {count !== null || (isBridgeMode && bridgeResults.length > 0) ? (
          <>
            <span className="font-medium">
              {(isBridgeMode ? bridgeResults.length : count || 0).toLocaleString()}
            </span>{' '}
            {(isBridgeMode ? bridgeResults.length : count || 0) === 1 ? 'note matches' : 'notes match'} these filters
            {isBridgeMode && (
              <span className="ml-2 text-xs text-green-600 font-medium">via Native Bridge</span>
            )}
          </>
        ) : (
          <span className="text-gray-400">Adjust filters to see preview</span>
        )}
      </div>
      {executionTime && executionTime < 100 && (
        <div className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle className="w-3 h-3" />
          <span>Fast ({executionTime}ms)</span>
        </div>
      )}
    </div>
  );
}

export function FilterPanelOverlay({
  onApply,
  onCancel,
}: FilterPanelOverlayProps) {
  const {
    previewFilters,
    clearPreviewFilters,
    isBridgeMode,
    isBridgeAvailable,
    bridgeResults,
    bridgeIsLoading,
    bridgeError,
    bridgeSequenceId
  } = useFilters();

  const { count, isLoading } = useFilterPreview(previewFilters);
  const bridgeAvailable = false; // Bridge eliminated in sql.js architecture
  const isInitialized = true;
  const currentBackend = 'sql.js';

  const [showPerformancePanel, setShowPerformancePanel] = useState(false);
  const [filterStartTime, setFilterStartTime] = useState<number | null>(null);

  React.useEffect(() => {
    if (isLoading || bridgeIsLoading) {
      setFilterStartTime(Date.now());
    } else {
      setFilterStartTime(null);
    }
  }, [isLoading, bridgeIsLoading]);

  if (!previewFilters) return null;

  const executionTime = filterStartTime ? Date.now() - filterStartTime : null;
  const bridgeStatus = getBridgeStatus(isInitialized, isBridgeMode, isBridgeAvailable, bridgeAvailable);

  return (
    <div
      className="bg-white rounded-lg shadow-2xl border border-gray-300"
      style={{
        width: '650px',
        maxHeight: '85vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <FilterHeader
        bridgeStatus={bridgeStatus}
        bridgeError={bridgeError}
        showPerformancePanel={showPerformancePanel}
        onTogglePerformance={() => setShowPerformancePanel(!showPerformancePanel)}
      />

      {showPerformancePanel && (
        <PerformancePanel
          executionTime={executionTime}
          currentBackend={currentBackend}
          isBridgeMode={isBridgeMode}
          bridgeResults={bridgeResults}
          count={count}
          bridgeSequenceId={bridgeSequenceId}
          onClose={() => setShowPerformancePanel(false)}
        />
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div className="pb-4 border-b border-gray-200">
          <FilterPresetDropdown onPresetLoad={onApply} />
        </div>
        <LATCHFilter
          axis="location"
          label="Location"
          description="Filter by geographic location or city name"
        />
        <LATCHFilter
          axis="alphabet"
          label="Alphabet"
          description="Search by title or content"
        />
        <LATCHFilter
          axis="time"
          label="Time"
          description="Filter by date range"
        />
        <LATCHFilter
          axis="category"
          label="Category"
          description="Filter by tags, folders, or status"
        />
        <LATCHFilter
          axis="hierarchy"
          label="Hierarchy"
          description="Filter by parent/child relationships"
        />
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-600 mb-3">
          <PreviewCount
            isLoading={isLoading}
            isBridgeMode={isBridgeMode}
            bridgeIsLoading={bridgeIsLoading}
            executionTime={executionTime}
            count={count}
            bridgeResults={bridgeResults}
          />
        </div>

        {bridgeSequenceId && !bridgeIsLoading && (
          <div className="text-xs text-gray-400 mb-2">
            Query #{bridgeSequenceId.slice(-8)} completed
            {executionTime && ` in ${executionTime}ms`}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={clearPreviewFilters}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || bridgeIsLoading}
          >
            Clear All
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || bridgeIsLoading}
            >
              Cancel
            </button>
            <button
              onClick={onApply}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={isLoading || bridgeIsLoading || !!bridgeError}
            >
              {(isLoading || bridgeIsLoading) && (
                <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full"></div>
              )}
              Apply Filters
            </button>
          </div>
        </div>

        <div className="sr-only" role="status" aria-live="polite">
          {isLoading || bridgeIsLoading ? (
            `Executing filter query using ${isBridgeMode ? 'native bridge' : 'SQL.js backend'}`
          ) : bridgeError ? (
            `Filter error: ${bridgeError}`
          ) : (
            `Found ${isBridgeMode ? bridgeResults.length : count || 0} matching notes`
          )}
        </div>
      </div>
    </div>
  );
}
