import { useFilters, type Filter } from '../contexts/FilterContext';
import { useTheme } from '../contexts/ThemeContext';
import { useState } from 'react';

const FILTER_FIELDS = [
  { id: 'folder', label: 'Folder' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'nodeType', label: 'Type' },
  { id: 'tags', label: 'Tags' },
] as const;

const OPERATORS = [
  { id: '=', label: 'equals' },
  { id: '!=', label: 'not equals' },
  { id: '>', label: 'greater than' },
  { id: '<', label: 'less than' },
  { id: 'contains', label: 'contains' },
] as const;

export function FilterBar() {
  const { filters, addFilter, removeFilter, clearFilters } = useFilters();
  const { theme } = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [newFilter, setNewFilter] = useState<Partial<Filter>>({
    field: 'folder',
    operator: '=',
    value: '',
  });

  const handleAddFilter = () => {
    if (newFilter.field && newFilter.operator && newFilter.value !== undefined) {
      addFilter(newFilter as Filter);
      setNewFilter({ field: 'folder', operator: '=', value: '' });
      setIsAdding(false);
    }
  };

  const chipClass = theme === 'NeXTSTEP'
    ? 'inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-white border border-[#808080]'
    : 'inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full';

  const buttonClass = theme === 'NeXTSTEP'
    ? 'px-2 py-1 text-xs bg-[#c0c0c0] border-t border-l border-[#e8e8e8] border-b border-r border-[#707070] hover:bg-[#d0d0d0]'
    : 'px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300';

  const inputClass = theme === 'NeXTSTEP'
    ? 'px-2 py-1 text-xs bg-white border border-[#808080]'
    : 'px-2 py-1 text-xs bg-white border border-gray-300 rounded focus:ring-2 focus:ring-blue-500';

  if (filters.length === 0 && !isAdding) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 ${
        theme === 'NeXTSTEP'
          ? 'bg-[#d4d4d4] border-b border-[#808080]'
          : 'bg-gray-50 border-b border-gray-200'
      }`}>
        <span className="text-xs text-gray-500">No filters active</span>
        <button
          onClick={() => setIsAdding(true)}
          className={buttonClass}
        >
          + Add Filter
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 px-3 py-2 ${
      theme === 'NeXTSTEP'
        ? 'bg-[#d4d4d4] border-b border-[#808080]'
        : 'bg-gray-50 border-b border-gray-200'
    }`}>
      {/* Active filters */}
      {filters.map((filter, index) => (
        <span key={index} className={chipClass}>
          <span className="font-medium">{filter.field}</span>
          <span className="opacity-70">{filter.operator}</span>
          <span>{String(filter.value)}</span>
          <button
            onClick={() => removeFilter(index)}
            className="ml-1 hover:text-red-600"
          >
            ×
          </button>
        </span>
      ))}

      {/* Add filter form */}
      {isAdding ? (
        <div className="flex items-center gap-1">
          <select
            value={newFilter.field}
            onChange={(e) => setNewFilter(prev => ({ ...prev, field: e.target.value }))}
            className={inputClass}
          >
            {FILTER_FIELDS.map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <select
            value={newFilter.operator}
            onChange={(e) => setNewFilter(prev => ({ ...prev, operator: e.target.value as Filter['operator'] }))}
            className={inputClass}
          >
            {OPERATORS.map(op => (
              <option key={op.id} value={op.id}>{op.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={String(newFilter.value ?? '')}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
            placeholder="Value..."
            className={inputClass}
          />
          <button onClick={handleAddFilter} className={buttonClass}>
            Add
          </button>
          <button onClick={() => setIsAdding(false)} className={buttonClass}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className={buttonClass}
        >
          + Add Filter
        </button>
      )}

      {/* Clear all button */}
      {filters.length > 0 && (
        <button
          onClick={clearFilters}
          className={`ml-auto ${buttonClass}`}
        >
          Clear All
        </button>
      )}
    </div>
  );
}
