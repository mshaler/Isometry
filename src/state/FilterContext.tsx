import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import type { 
  FilterState, 
  LocationFilter, 
  AlphabetFilter, 
  TimeFilter, 
  CategoryFilter, 
  HierarchyFilter 
} from '../types/filter';
import { EMPTY_FILTERS } from '../types/filter';

type FilterAction =
  | { type: 'SET_LOCATION'; payload: LocationFilter | null }
  | { type: 'SET_ALPHABET'; payload: AlphabetFilter | null }
  | { type: 'SET_TIME'; payload: TimeFilter | null }
  | { type: 'SET_CATEGORY'; payload: CategoryFilter | null }
  | { type: 'SET_HIERARCHY'; payload: HierarchyFilter | null }
  | { type: 'SET_DSL'; payload: string | null }
  | { type: 'CLEAR_ALL' };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_LOCATION':
      return { ...state, location: action.payload, dsl: null };
    case 'SET_ALPHABET':
      return { ...state, alphabet: action.payload, dsl: null };
    case 'SET_TIME':
      return { ...state, time: action.payload, dsl: null };
    case 'SET_CATEGORY':
      return { ...state, category: action.payload, dsl: null };
    case 'SET_HIERARCHY':
      return { ...state, hierarchy: action.payload, dsl: null };
    case 'SET_DSL':
      return { ...EMPTY_FILTERS, dsl: action.payload };
    case 'CLEAR_ALL':
      return EMPTY_FILTERS;
    default:
      return state;
  }
}

interface FilterContextValue {
  filters: FilterState;
  setLocation: (filter: LocationFilter | null) => void;
  setAlphabet: (filter: AlphabetFilter | null) => void;
  setTime: (filter: TimeFilter | null) => void;
  setCategory: (filter: CategoryFilter | null) => void;
  setHierarchy: (filter: HierarchyFilter | null) => void;
  setDSL: (dsl: string | null) => void;
  clearAll: () => void;
  activeCount: number;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, dispatch] = useReducer(filterReducer, EMPTY_FILTERS);
  
  const setLocation = useCallback((filter: LocationFilter | null) => {
    dispatch({ type: 'SET_LOCATION', payload: filter });
  }, []);
  
  const setAlphabet = useCallback((filter: AlphabetFilter | null) => {
    dispatch({ type: 'SET_ALPHABET', payload: filter });
  }, []);
  
  const setTime = useCallback((filter: TimeFilter | null) => {
    dispatch({ type: 'SET_TIME', payload: filter });
  }, []);
  
  const setCategory = useCallback((filter: CategoryFilter | null) => {
    dispatch({ type: 'SET_CATEGORY', payload: filter });
  }, []);
  
  const setHierarchy = useCallback((filter: HierarchyFilter | null) => {
    dispatch({ type: 'SET_HIERARCHY', payload: filter });
  }, []);
  
  const setDSL = useCallback((dsl: string | null) => {
    dispatch({ type: 'SET_DSL', payload: dsl });
  }, []);
  
  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);
  
  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.location) count++;
    if (filters.alphabet) count++;
    if (filters.time) count++;
    if (filters.category) count++;
    if (filters.hierarchy) count++;
    if (filters.dsl) count++;
    return count;
  }, [filters]);
  
  return (
    <FilterContext.Provider value={{
      filters,
      setLocation,
      setAlphabet,
      setTime,
      setCategory,
      setHierarchy,
      setDSL,
      clearAll,
      activeCount,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within FilterProvider');
  }
  return context;
}
