/**
 * DataInspectorTab Component
 *
 * SQL query interface with sortable results table and CSV/JSON export.
 * Allows users to explore the SQLite schema and data directly.
 */

import { useCallback, KeyboardEvent, useMemo } from 'react';
import { Play, Download, FileJson, AlertCircle, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataInspector, SortConfig } from '@/hooks/visualization/useDataInspector';
import type { QueryResult } from '@/services/query-executor';

interface DataInspectorTabProps {
  className?: string;
}

/** Truncates text to max length with ellipsis */
function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/** Theme-aware styling configuration */
interface ThemeStyles {
  bgColor: string;
  borderColor: string;
  inputBg: string;
  headerBg: string;
  hoverBg: string;
  rowAltBg: string;
}

function useThemeStyles(theme: string): ThemeStyles {
  return useMemo(() => {
    const isDark = theme === 'NeXTSTEP';
    return {
      bgColor: isDark ? 'bg-[#c0c0c0]' : 'bg-white',
      borderColor: isDark ? 'border-[#707070]' : 'border-gray-300',
      inputBg: isDark ? 'bg-white' : 'bg-gray-50',
      headerBg: isDark ? 'bg-[#d4d4d4]' : 'bg-gray-100',
      hoverBg: isDark ? 'hover:bg-[#b0b0b0]' : 'hover:bg-gray-200',
      rowAltBg: isDark ? 'bg-[#e8e8e8]' : 'bg-gray-50',
    };
  }, [theme]);
}

// ============================================================================
// Sub-components
// ============================================================================

interface ResultsTableProps {
  result: QueryResult;
  sortConfig: SortConfig | null;
  styles: ThemeStyles;
  onSort: (column: string) => void;
}

function ResultsTable({ result, sortConfig, styles, onSort }: ResultsTableProps) {
  const { borderColor, headerBg, hoverBg, rowAltBg } = styles;

  return (
    <div className="flex-1 overflow-auto m-3">
      <table className={`w-full border-collapse text-sm ${borderColor} border`}>
        <thead className={`${headerBg} sticky top-0`}>
          <tr>
            {result.columns.map((column) => (
              <th
                key={column}
                onClick={() => onSort(column)}
                className={`px-3 py-2 text-left font-medium border ${borderColor} cursor-pointer select-none ${hoverBg} transition-colors`}
              >
                <div className="flex items-center gap-1">
                  <span className="truncate">{column}</span>
                  {sortConfig?.column === column && (
                    sortConfig.direction === 'asc'
                      ? <ArrowUp size={12} className="flex-shrink-0" />
                      : <ArrowDown size={12} className="flex-shrink-0" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 1 ? rowAltBg : ''}>
              {result.columns.map((column) => {
                const value = row[column];
                const displayValue = value === null ? 'NULL' : String(value);
                const isNull = value === null;
                const isTruncated = displayValue.length > 100;

                return (
                  <td
                    key={column}
                    className={`px-3 py-1.5 border ${borderColor} font-mono text-xs ${isNull ? 'text-gray-400 italic' : ''}`}
                    title={isTruncated ? displayValue : undefined}
                  >
                    {truncateText(displayValue)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ToolbarProps {
  isExecuting: boolean;
  hasQuery: boolean;
  hasResults: boolean;
  result: QueryResult | null;
  styles: ThemeStyles;
  onExecute: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
}

function Toolbar({
  isExecuting, hasQuery, hasResults, result, styles, onExecute, onExportCSV, onExportJSON
}: ToolbarProps) {
  const { headerBg, borderColor, hoverBg } = styles;

  return (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={onExecute}
        disabled={isExecuting || !hasQuery}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
      >
        {isExecuting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        Execute
      </button>

      <button
        onClick={onExportCSV}
        disabled={!hasResults}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${headerBg} border ${borderColor} rounded ${hoverBg} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
        title="Export to CSV"
      >
        <Download size={14} />
        CSV
      </button>

      <button
        onClick={onExportJSON}
        disabled={!hasResults}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${headerBg} border ${borderColor} rounded ${hoverBg} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
        title="Export to JSON"
      >
        <FileJson size={14} />
        JSON
      </button>

      <div className="flex-1 text-right text-xs text-gray-500">
        {isExecuting && 'Executing...'}
        {result && !isExecuting && (
          <span>
            {result.rowCount} row{result.rowCount !== 1 ? 's' : ''} in {result.duration.toFixed(2)}ms
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DataInspectorTab({ className = '' }: DataInspectorTabProps) {
  const { theme } = useTheme();
  const styles = useThemeStyles(theme);
  const {
    sql, setSql, result, error, isExecuting,
    sortConfig, runQuery, sortBy, exportCSV, exportJSON
  } = useDataInspector();

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      setSql(sql.slice(0, start) + '  ' + sql.slice(end));
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  }, [sql, setSql, runQuery]);

  const hasResults = Boolean(result && result.rowCount > 0);
  const showEmpty = !error && (!result || result.rowCount === 0) && !isExecuting;

  return (
    <div className={`flex flex-col h-full ${styles.bgColor} ${className}`}>
      {/* SQL Input Area */}
      <div className={`p-3 border-b ${styles.borderColor}`}>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`w-full h-24 p-2 font-mono text-sm ${styles.inputBg} border ${styles.borderColor} rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500`}
          placeholder="Enter SQL query... (Ctrl+Enter to execute)"
          spellCheck={false}
        />
        <Toolbar
          isExecuting={isExecuting}
          hasQuery={Boolean(sql.trim())}
          hasResults={hasResults}
          result={result}
          styles={styles}
          onExecute={runQuery}
          onExportCSV={exportCSV}
          onExportJSON={exportJSON}
        />
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {error && (
          <div className="m-3 p-3 bg-red-50 border border-red-300 rounded flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {result?.truncated && (
          <div className="mx-3 mt-3 p-2 bg-amber-50 border border-amber-300 rounded text-sm text-amber-700">
            Results limited to 1000 rows. Add explicit LIMIT to override.
          </div>
        )}

        {hasResults && (
          <ResultsTable result={result!} sortConfig={sortConfig} styles={styles} onSort={sortBy} />
        )}

        {showEmpty && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-sm font-medium mb-1">
                {result ? 'No results returned' : 'Run a query to see results'}
              </div>
              <div className="text-xs text-gray-400">Press Ctrl+Enter to execute</div>
            </div>
          </div>
        )}

        {isExecuting && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
              <span>Executing query...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
