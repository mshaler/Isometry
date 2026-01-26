import { createContext, useContext, ReactNode, useState, useCallback, useMemo } from 'react';
import { compile } from '../dsl/compiler';
import type { FilterOperator, CompiledQuery, ASTNode, AndNode, FilterNode } from '../dsl/types';

export interface Filter {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean;
}

interface FilterContextType {
  filters: Filter[];
  addFilter: (filter: Filter) => void;
  removeFilter: (index: number) => void;
  clearFilters: () => void;
  compiledQuery: CompiledQuery;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

/**
 * Convert filters array to AST for compilation
 */
function filtersToAST(filters: Filter[]): ASTNode | null {
  if (filters.length === 0) return null;

  // Convert each filter to a FilterNode
  const nodes: FilterNode[] = filters.map(f => ({
    type: 'filter' as const,
    field: f.field,
    operator: f.operator,
    value: f.value,
  }));

  // Combine with AND nodes
  if (nodes.length === 1) {
    return nodes[0];
  }

  // Build a left-associative AND tree
  let result: ASTNode = nodes[0];
  for (let i = 1; i < nodes.length; i++) {
    result = {
      type: 'and',
      left: result,
      right: nodes[i],
    } as AndNode;
  }

  return result;
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filter[]>([]);

  const addFilter = useCallback((filter: Filter) => {
    setFilters(prev => [...prev, filter]);
  }, []);

  const removeFilter = useCallback((index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters([]);
  }, []);

  const compiledQuery = useMemo(() => {
    const ast = filtersToAST(filters);
    return compile(ast);
  }, [filters]);

  return (
    <FilterContext.Provider value={{
      filters,
      addFilter,
      removeFilter,
      clearFilters,
      compiledQuery,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
