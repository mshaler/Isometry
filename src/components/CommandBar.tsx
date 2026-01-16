import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useFilters } from '@/contexts/FilterContext';
import { parse } from '@/dsl/parser';
import type { FilterNode } from '@/dsl/types';

export function CommandBar() {
  const [commandText, setCommandText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const { addFilter, clearFilters } = useFilters();

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = commandText.trim();
    if (!trimmed) return;

    // Handle special commands
    if (trimmed === 'clear' || trimmed === 'reset') {
      clearFilters();
      setCommandText('');
      return;
    }

    try {
      // Parse the DSL input
      const ast = parse(trimmed);

      if (ast && ast.type === 'filter') {
        const filterNode = ast as FilterNode;
        addFilter({
          field: filterNode.field,
          operator: filterNode.operator,
          value: filterNode.value as string | number | boolean,
        });
        setCommandText('');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid command');
    }
  };

  return (
    <div className={`h-10 flex items-center px-3 gap-3 ${
      theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-t-2 border-[#e8e8e8]'
        : 'bg-white/50 backdrop-blur-xl border-t border-gray-200'
    }`}>
      <button
        onClick={clearFilters}
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
        title="Clear filters"
      >
        <span className="text-lg leading-none">⌘</span>
      </button>

      <form onSubmit={handleCommandSubmit} className="flex-1 relative">
        <input
          type="text"
          value={commandText}
          onChange={(e) => { setCommandText(e.target.value); setError(null); }}
          placeholder="Enter filter (e.g. status:active, category:extract)..."
          className={`w-full h-7 px-3 focus:outline-none ${
            error
              ? 'border-red-500 bg-red-50'
              : theme === 'NeXTSTEP'
                ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
                : 'bg-white/80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500'
          }`}
        />
        {error && (
          <div className="absolute top-full left-0 mt-1 text-xs text-red-500">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}
