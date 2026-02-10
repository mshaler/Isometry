/**
 * DataInspectorTab Component
 *
 * SQL query interface with sortable results table and CSV/JSON export.
 * Allows users to explore the SQLite schema and data directly.
 */

import { useCallback, KeyboardEvent } from 'react';
import { Play, Download, FileJson, AlertCircle, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useDataInspector } from '@/hooks/visualization/useDataInspector';

interface DataInspectorTabProps {
  className?: string;
}

/**
 * Truncates text to max length with ellipsis
 */
function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function DataInspectorTab({ className = '' }: DataInspectorTabProps) {
  const { theme } = useTheme();
  const {
    sql,
    setSql,
    result,
    error,
    isExecuting,
    sortConfig,
    runQuery,
    sortBy,
    exportCSV,
    exportJSON
  } = useDataInspector();

  // Handle keyboard shortcuts in textarea
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runQuery();
      return;
    }

    // Tab to insert 2 spaces (prevent focus change)
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = sql.slice(0, start) + '  ' + sql.slice(end);
      setSql(newValue);
      // Set cursor position after the inserted spaces
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  }, [sql, setSql, runQuery]);

  // Theme-aware styling
  const isDark = theme === 'NeXTSTEP';
  const bgColor = isDark ? 'bg-[#c0c0c0]' : 'bg-white';
  const borderColor = isDark ? 'border-[#707070]' : 'border-gray-300';
  const inputBg = isDark ? 'bg-white' : 'bg-gray-50';
  const headerBg = isDark ? 'bg-[#d4d4d4]' : 'bg-gray-100';
  const hoverBg = isDark ? 'hover:bg-[#b0b0b0]' : 'hover:bg-gray-200';
  const rowAltBg = isDark ? 'bg-[#e8e8e8]' : 'bg-gray-50';

  return (
    <div className={`flex flex-col h-full ${bgColor} ${className}`}>
      {/* SQL Input Area */}
      <div className={`p-3 border-b ${borderColor}`}>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`w-full h-24 p-2 font-mono text-sm ${inputBg} border ${borderColor} rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500`}
          placeholder="Enter SQL query... (Ctrl+Enter to execute)"
          spellCheck={false}
        />

        {/* Toolbar */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={runQuery}
            disabled={isExecuting || !sql.trim()}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded ${hoverBg} hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
          >
            {isExecuting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Execute
          </button>

          <button
            onClick={exportCSV}
            disabled={!result || result.rowCount === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${headerBg} border ${borderColor} rounded ${hoverBg} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            title="Export to CSV"
          >
            <Download size={14} />
            CSV
          </button>

          <button
            onClick={exportJSON}
            disabled={!result || result.rowCount === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${headerBg} border ${borderColor} rounded ${hoverBg} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            title="Export to JSON"
          >
            <FileJson size={14} />
            JSON
          </button>

          {/* Status info */}
          <div className="flex-1 text-right text-xs text-gray-500">
            {isExecuting && 'Executing...'}
            {result && !isExecuting && (
              <span>
                {result.rowCount} row{result.rowCount !== 1 ? 's' : ''} in {result.duration.toFixed(2)}ms
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Error Display */}
        {error && (
          <div className={`m-3 p-3 bg-red-50 border border-red-300 rounded flex items-start gap-2`}>
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Truncation Warning */}
        {result?.truncated && (
          <div className={`mx-3 mt-3 p-2 bg-amber-50 border border-amber-300 rounded text-sm text-amber-700`}>
            Results limited to 1000 rows. Add explicit LIMIT to override.
          </div>
        )}

        {/* Results Table */}
        {result && result.rowCount > 0 && (
          <div className="flex-1 overflow-auto m-3">
            <table className={`w-full border-collapse text-sm ${borderColor} border`}>
              <thead className={`${headerBg} sticky top-0`}>
                <tr>
                  {result.columns.map((column) => (
                    <th
                      key={column}
                      onClick={() => sortBy(column)}
                      className={`px-3 py-2 text-left font-medium border ${borderColor} cursor-pointer select-none ${hoverBg} transition-colors`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="truncate">{column}</span>
                        {sortConfig?.column === column && (
                          sortConfig.direction === 'asc' ? (
                            <ArrowUp size={12} className="flex-shrink-0" />
                          ) : (
                            <ArrowDown size={12} className="flex-shrink-0" />
                          )
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className={rowIndex % 2 === 1 ? rowAltBg : ''}
                  >
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
        )}

        {/* Empty State */}
        {!error && (!result || result.rowCount === 0) && !isExecuting && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-sm font-medium mb-1">
                {result ? 'No results returned' : 'Run a query to see results'}
              </div>
              <div className="text-xs text-gray-400">
                Press Ctrl+Enter to execute
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
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
