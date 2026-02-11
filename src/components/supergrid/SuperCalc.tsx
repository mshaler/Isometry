import React, { useState, useRef, useCallback } from 'react';
import './SuperCalc.css';

/** Local type for grid data items used throughout SuperCalc formula execution */
type GridDataItem = Record<string, unknown>;

/** Structured result from formula execution */
interface ExecutionResult {
  type: 'scalar' | 'table' | 'pivot' | 'error';
  data: unknown;
  summary: string;
}

interface SuperCalcProps {
  onFormulaExecute: (formula: string, result: unknown) => void;
  gridData?: unknown[];
  pafvState?: {
    xAxis: string;
    yAxis: string;
    zAxis?: string;
  };
  className?: string;
}

interface ParsedFormula {
  function: string;
  args: unknown[];
  rawFormula: string;
  isValid: boolean;
  error?: string;
}

/**
 * SuperCalc: Formula Bar with PAFV Functions
 *
 * PAFV-aware spreadsheet-like formulas for SuperGrid:
 * - SUMOVER(axis, filter) - Sum values over axis dimension
 * - COUNTOVER(axis, filter) - Count items over axis dimension
 * - AVGOVER(axis, filter) - Average over axis dimension
 * - MAXOVER(axis, filter) - Maximum over axis dimension
 * - MINOVER(axis, filter) - Minimum over axis dimension
 * - GROUPBY(axis, function) - Group and aggregate by axis
 * - PIVOT(x_axis, y_axis, value_field, aggregation) - Pivot table operations
 * - FILTER(condition) - Filter grid data
 * - SORT(field, direction) - Sort operations
 * - RANGE(start_cell, end_cell) - Cell range operations
 *
 * Part of the Super* feature family for SuperGrid.
 */
export const SuperCalc: React.FC<SuperCalcProps> = ({
  onFormulaExecute,
  gridData = [],
  pafvState = { xAxis: '', yAxis: '', zAxis: '' },
  className = ''
}) => {
  const [formula, setFormula] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Built-in PAFV functions
  const PAFV_FUNCTIONS = [
    'SUMOVER', 'COUNTOVER', 'AVGOVER', 'MAXOVER', 'MINOVER',
    'GROUPBY', 'PIVOT', 'FILTER', 'SORT', 'RANGE', 'SUM', 'COUNT', 'AVG'
  ];

  const AXIS_SUGGESTIONS = ['x_axis', 'y_axis', 'z_axis', 'category', 'time', 'hierarchy', 'location', 'alphabet'];

  /** Safely cast an unknown arg to string */
  const asString = (val: unknown, fallback = ''): string =>
    typeof val === 'string' ? val : fallback;

  // Parse formula string into structured format
  const parseFormula = useCallback((formulaStr: string): ParsedFormula => {
    const trimmed = formulaStr.trim();

    if (!trimmed.startsWith('=')) {
      return {
        function: '',
        args: [],
        rawFormula: formulaStr,
        isValid: false,
        error: 'Formula must start with ='
      };
    }

    const withoutEquals = trimmed.slice(1);
    const functionMatch = withoutEquals.match(/^([A-Z]+)\s*\(/);

    if (!functionMatch) {
      return {
        function: '',
        args: [],
        rawFormula: formulaStr,
        isValid: false,
        error: 'Invalid function format'
      };
    }

    const functionName = functionMatch[1];
    const argsString = withoutEquals.slice(functionName.length + 1, -1);

    try {
      // Simple argument parsing (comma-separated, handle quoted strings)
      const args = argsString.split(',').map(arg => {
        const cleaned = arg.trim();
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
          return cleaned.slice(1, -1);
        }
        if (!isNaN(Number(cleaned))) {
          return Number(cleaned);
        }
        return cleaned;
      }).filter(arg => arg !== '');

      return {
        function: functionName,
        args,
        rawFormula: formulaStr,
        isValid: PAFV_FUNCTIONS.includes(functionName),
        error: PAFV_FUNCTIONS.includes(functionName) ? undefined : `Unknown function: ${functionName}`
      };
    } catch (error) {
      return {
        function: functionName,
        args: [],
        rawFormula: formulaStr,
        isValid: false,
        error: 'Failed to parse arguments'
      };
    }
  }, []);

  // Helper functions
  const getAxisField = (axis: string): string => {
    switch (axis.toLowerCase()) {
      case 'x_axis': return getFieldFromAxis(pafvState.xAxis);
      case 'y_axis': return getFieldFromAxis(pafvState.yAxis);
      case 'z_axis': return getFieldFromAxis(pafvState.zAxis || '');
      case 'category': return 'folder';
      case 'time': return 'month';
      case 'hierarchy': return 'priority';
      case 'location': return 'location';
      case 'alphabet': return 'name';
      default: return axis;
    }
  };

  const getFieldFromAxis = (axisId: string): string => {
    if (axisId.includes('folder')) return 'folder';
    if (axisId.includes('status')) return 'status';
    if (axisId.includes('month')) return 'month';
    if (axisId.includes('year')) return 'year';
    if (axisId.includes('priority')) return 'priority';
    if (axisId.includes('name')) return 'name';
    return 'folder'; // default
  };

  const groupByAxis = (data: unknown[], field: string): Record<string, GridDataItem[]> => {
    return data.reduce<Record<string, GridDataItem[]>>((groups, rawItem) => {
      const item = rawItem as GridDataItem;
      const key = String(item[field] ?? 'Unknown');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {});
  };

  const createPivotTable = (
    data: unknown[], xField: string, yField: string, valueField: string, aggregation: string
  ) => {
    const pivot: Record<string, Record<string, number>> = {};

    data.forEach(rawItem => {
      const item = rawItem as GridDataItem;
      const xVal = String(item[xField] ?? 'Unknown');
      const yVal = String(item[yField] ?? 'Unknown');
      const value = Number(item[valueField]) || 0;

      if (!pivot[yVal]) pivot[yVal] = {};
      if (!pivot[yVal][xVal]) pivot[yVal][xVal] = 0;

      switch (aggregation.toUpperCase()) {
        case 'SUM':
          pivot[yVal][xVal] += value;
          break;
        case 'COUNT':
          pivot[yVal][xVal] += 1;
          break;
        case 'AVG':
          pivot[yVal][xVal] = (pivot[yVal][xVal] + value) / 2; // Simplified
          break;
      }
    });

    return pivot;
  };

  const filterData = (data: unknown[], condition: string): unknown[] => {
    // Simple condition parsing: "field=value", "field>value", etc.
    const match = condition.match(/(\w+)\s*([=<>!]+)\s*(.+)/);
    if (!match) return data;

    const [, field, operator, value] = match;
    const cleanValue = value.replace(/"/g, '');

    return data.filter(rawItem => {
      const item = rawItem as GridDataItem;
      const itemValue = item[field];
      switch (operator) {
        case '=': return itemValue === cleanValue;
        case '>': return Number(itemValue) > Number(cleanValue);
        case '<': return Number(itemValue) < Number(cleanValue);
        case '>=': return Number(itemValue) >= Number(cleanValue);
        case '<=': return Number(itemValue) <= Number(cleanValue);
        case '!=': return itemValue !== cleanValue;
        default: return true;
      }
    });
  };

  // Execute PAFV formula
  const executeFormula = useCallback(async (parsedFormula: ParsedFormula): Promise<ExecutionResult> => {
    if (!parsedFormula.isValid) {
      throw new Error(parsedFormula.error || 'Invalid formula');
    }

    const { function: func, args } = parsedFormula;

    switch (func) {
      case 'SUMOVER': {
        const axis = asString(args[0]);
        const field = asString(args[1], 'value');
        const axisField = getAxisField(axis);
        const groups = groupByAxis(gridData, axisField);
        const results = Object.entries(groups).map(([key, items]) => ({
          [axisField]: key,
          sum: items.reduce((s: number, item: GridDataItem) => s + (Number(item[field]) || 0), 0),
          count: items.length
        }));
        return { type: 'table', data: results, summary: `Sum of ${field} over ${axis}` };
      }

      case 'COUNTOVER': {
        const axis = asString(args[0]);
        const axisField = getAxisField(axis);
        const groups = groupByAxis(gridData, axisField);
        const results = Object.entries(groups).map(([key, items]) => ({
          [axisField]: key,
          count: items.length
        }));
        return { type: 'table', data: results, summary: `Count over ${axis}` };
      }

      case 'AVGOVER': {
        const axis = asString(args[0]);
        const field = asString(args[1], 'value');
        const axisField = getAxisField(axis);
        const groups = groupByAxis(gridData, axisField);
        const results = Object.entries(groups).map(([key, items]) => ({
          [axisField]: key,
          average: items.reduce((s: number, item: GridDataItem) => s + (Number(item[field]) || 0), 0)
            / items.length,
          count: items.length
        }));
        return { type: 'table', data: results, summary: `Average of ${field} over ${axis}` };
      }

      case 'MAXOVER': {
        const axis = asString(args[0]);
        const field = asString(args[1], 'value');
        const axisField = getAxisField(axis);
        const groups = groupByAxis(gridData, axisField);
        const results = Object.entries(groups).map(([key, items]) => ({
          [axisField]: key,
          maximum: Math.max(...items.map((item: GridDataItem) => Number(item[field]) || 0)),
          count: items.length
        }));
        return { type: 'table', data: results, summary: `Maximum of ${field} over ${axis}` };
      }

      case 'MINOVER': {
        const axis = asString(args[0]);
        const field = asString(args[1], 'value');
        const axisField = getAxisField(axis);
        const groups = groupByAxis(gridData, axisField);
        const results = Object.entries(groups).map(([key, items]) => ({
          [axisField]: key,
          minimum: Math.min(...items.map((item: GridDataItem) => Number(item[field]) || 0)),
          count: items.length
        }));
        return { type: 'table', data: results, summary: `Minimum of ${field} over ${axis}` };
      }

      case 'GROUPBY': {
        const axis = asString(args[0]);
        const aggregateFunc = asString(args[1], 'COUNT');
        const axisField = getAxisField(axis);
        const groups = groupByAxis(gridData, axisField);
        const results = Object.entries(groups).map(([key, items]) => ({
          group: key,
          [aggregateFunc.toLowerCase()]: aggregateFunc === 'COUNT' ? items.length :
                                        aggregateFunc === 'SUM' ? items.reduce((s: number, i: GridDataItem) => s + (Number(i['value']) || 0), 0) :
                                        items.length
        }));
        return { type: 'table', data: results, summary: `Group by ${axis} with ${aggregateFunc}` };
      }

      case 'PIVOT': {
        const xAxisArg = asString(args[0]);
        const yAxisArg = asString(args[1]);
        const valueField = asString(args[2], 'value');
        const aggregation = asString(args[3], 'SUM');
        const xField = getAxisField(xAxisArg);
        const yField = getAxisField(yAxisArg);

        const pivot = createPivotTable(gridData, xField, yField, valueField, aggregation);
        return { type: 'pivot', data: pivot, summary: `Pivot: ${xAxisArg} x ${yAxisArg} (${aggregation} of ${valueField})` };
      }

      case 'FILTER': {
        const condition = asString(args[0]);
        const filtered = filterData(gridData, condition);
        return { type: 'table', data: filtered, summary: `Filtered: ${condition} (${filtered.length} items)` };
      }

      case 'SORT': {
        const field = asString(args[0]);
        const direction = asString(args[1], 'ASC');
        const sorted = [...gridData].sort((rawA, rawB) => {
          const a = rawA as GridDataItem;
          const b = rawB as GridDataItem;
          const aVal = String(a[field] ?? '');
          const bVal = String(b[field] ?? '');
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return direction.toUpperCase() === 'DESC' ? -comparison : comparison;
        });
        return { type: 'table', data: sorted, summary: `Sorted by ${field} ${direction}` };
      }

      case 'SUM': {
        const field = asString(args[0], 'value');
        const sum = gridData.reduce<number>((total, rawItem) => {
          const item = rawItem as GridDataItem;
          return total + (Number(item[field]) || 0);
        }, 0);
        return { type: 'scalar', data: sum, summary: `Sum of ${field}: ${sum}` };
      }

      case 'COUNT': {
        return { type: 'scalar', data: gridData.length, summary: `Total count: ${gridData.length}` };
      }

      case 'AVG': {
        const field = asString(args[0], 'value');
        const sum = gridData.reduce<number>((total, rawItem) => {
          const item = rawItem as GridDataItem;
          return total + (Number(item[field]) || 0);
        }, 0);
        const avg = sum / gridData.length;
        return { type: 'scalar', data: avg, summary: `Average of ${field}: ${avg.toFixed(2)}` };
      }

      default:
        throw new Error(`Unknown function: ${func}`);
    }
  }, [gridData]);

  // Handle formula execution
  const handleExecute = useCallback(async () => {
    if (!formula.trim()) return;

    setIsExecuting(true);
    try {
      const parsed = parseFormula(formula);
      if (!parsed.isValid) {
        throw new Error(parsed.error);
      }

      const result = await executeFormula(parsed);
      setExecutionResult(result);
      onFormulaExecute(formula, result);

      // Add to history
      setHistory(prev => [formula, ...prev.slice(0, 9)]);
      setHistoryIndex(-1);

    } catch (error) {
      setExecutionResult({
        type: 'error',
        data: null,
        summary: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsExecuting(false);
    }
  }, [formula, parseFormula, executeFormula, onFormulaExecute]);

  // Handle input changes and suggestions
  const handleInputChange = (value: string) => {
    setFormula(value);

    // Generate suggestions
    if (value.includes('(') && !value.endsWith(')')) {
      const funcMatch = value.match(/=([A-Z]+)\(/);
      if (funcMatch) {
        const filteredSuggestions = AXIS_SUGGESTIONS.filter(s =>
          s.toLowerCase().includes(value.split('(')[1].toLowerCase())
        );
        setSuggestions(filteredSuggestions);
        setShowSuggestions(filteredSuggestions.length > 0);
      }
    } else if (value.startsWith('=')) {
      const partial = value.slice(1).toUpperCase();
      const filteredSuggestions = PAFV_FUNCTIONS.filter(f => f.startsWith(partial));
      setSuggestions(filteredSuggestions);
      setShowSuggestions(filteredSuggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  // Keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    } else if (e.key === 'ArrowUp' && history.length > 0) {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, history.length - 1);
      setHistoryIndex(newIndex);
      setFormula(history[newIndex]);
    } else if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      if (newIndex === -1) {
        setFormula('');
      } else {
        setFormula(history[newIndex]);
      }
    }
  };

  const renderResult = () => {
    if (!executionResult) return null;

    switch (executionResult.type) {
      case 'scalar':
        return (
          <div className="supercalc__result supercalc__result--scalar">
            <div className="supercalc__result-value">{String(executionResult.data)}</div>
            <div className="supercalc__result-summary">{executionResult.summary}</div>
          </div>
        );

      case 'table':
        return (
          <div className="supercalc__result supercalc__result--table">
            <div className="supercalc__result-summary">{executionResult.summary}</div>
            <div className="supercalc__table">
              {(executionResult.data as GridDataItem[]).slice(0, 10).map((row: GridDataItem, i: number) => (
                <div key={i} className="supercalc__table-row">
                  {Object.entries(row).map(([key, value]) => (
                    <div key={key} className="supercalc__table-cell">
                      <span className="supercalc__cell-label">{key}:</span>
                      <span className="supercalc__cell-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );

      case 'pivot':
        return (
          <div className="supercalc__result supercalc__result--pivot">
            <div className="supercalc__result-summary">{executionResult.summary}</div>
            <div className="supercalc__pivot-grid">
              {Object.entries(
                executionResult.data as Record<string, Record<string, number>>
              ).slice(0, 5).map(([rowKey, cols]) => (
                <div key={rowKey} className="supercalc__pivot-row">
                  <div className="supercalc__pivot-row-header">{rowKey}</div>
                  {Object.entries(cols).slice(0, 5).map(([colKey, value]) => (
                    <div key={colKey} className="supercalc__pivot-cell">{String(value)}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="supercalc__result supercalc__result--error">
            <div className="supercalc__result-summary">{executionResult.summary}</div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`supercalc ${isExpanded ? 'supercalc--expanded' : ''} ${className}`}>
      <div className="supercalc__bar">
        <div className="supercalc__input-group">
          <button
            className="supercalc__expand-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse formula bar' : 'Expand formula bar'}
          >
            {isExpanded ? '📉' : '📊'}
          </button>

          <div className="supercalc__formula-input">
            <input
              ref={inputRef}
              type="text"
              value={formula}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="=SUMOVER(x_axis) or =COUNT() or =FILTER(status='Active')"
              className="supercalc__input"
            />

            {showSuggestions && suggestions.length > 0 && (
              <div ref={suggestionsRef} className="supercalc__suggestions">
                {suggestions.map((suggestion, i) => (
                  <div
                    key={i}
                    className="supercalc__suggestion"
                    onClick={() => {
                      const currentInput = formula;
                      const lastOpenParen = currentInput.lastIndexOf('(');
                      if (lastOpenParen !== -1) {
                        const newFormula = currentInput.slice(0, lastOpenParen + 1) + suggestion;
                        setFormula(newFormula);
                      } else if (currentInput.startsWith('=')) {
                        setFormula(`=${suggestion}(`);
                      }
                      setShowSuggestions(false);
                      inputRef.current?.focus();
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className="supercalc__execute-button"
            onClick={handleExecute}
            disabled={isExecuting || !formula.trim()}
          >
            {isExecuting ? '⏳' : '▶️'}
          </button>
        </div>

        <div className="supercalc__status">
          <span className="supercalc__status-text">
            {isExecuting ? 'Executing...' :
             executionResult ? `✅ ${executionResult.summary}` :
             'Ready for PAFV formula'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="supercalc__expanded-content">
          <div className="supercalc__functions-help">
            <h4>PAFV Functions</h4>
            <div className="supercalc__function-grid">
              <div className="supercalc__function-category">
                <strong>Aggregation:</strong>
                <code>SUMOVER(axis, field)</code>
                <code>COUNTOVER(axis)</code>
                <code>AVGOVER(axis, field)</code>
                <code>MAXOVER(axis, field)</code>
                <code>MINOVER(axis, field)</code>
              </div>
              <div className="supercalc__function-category">
                <strong>Data Operations:</strong>
                <code>GROUPBY(axis, func)</code>
                <code>PIVOT(x, y, value, agg)</code>
                <code>FILTER(condition)</code>
                <code>SORT(field, direction)</code>
              </div>
            </div>
          </div>

          <div className="supercalc__result-area">
            {renderResult()}
          </div>

          {history.length > 0 && (
            <div className="supercalc__history">
              <h4>Formula History</h4>
              <div className="supercalc__history-list">
                {history.slice(0, 5).map((hist, i) => (
                  <div
                    key={i}
                    className="supercalc__history-item"
                    onClick={() => {
                      setFormula(hist);
                      setHistoryIndex(i);
                    }}
                  >
                    {hist}
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

export default SuperCalc;
