/**
 * SuperGrid Context
 *
 * Provides theme and callbacks to all SuperGrid cell components.
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type {
  SuperGridTheme,
  SuperGridThemeName,
  SuperGridContextValue,
  DataCell,
  RowPath,
  ColPath,
} from './types';

// ============================================================================
// Theme Definitions
// ============================================================================

export const themes: Record<SuperGridThemeName, SuperGridTheme> = {
  reference: {
    name: 'Reference Image',
    corner: '#00CED1',
    rowHeader: '#90EE90',
    colHeaderL0: '#FFD700',
    colHeaderL1: '#FFA500',
    data: '#FFA500',
    border: '#333333',
    text: '#000000',
  },
  nextstep: {
    name: 'NeXTSTEP',
    corner: '#AAAAAA',
    rowHeader: '#CCCCCC',
    colHeaderL0: '#BBBBBB',
    colHeaderL1: '#DDDDDD',
    data: '#FFFFFF',
    border: '#000000',
    text: '#000000',
  },
  modern: {
    name: 'Modern',
    corner: '#F1F5F9',
    rowHeader: '#F8FAFC',
    colHeaderL0: '#E2E8F0',
    colHeaderL1: '#F1F5F9',
    data: '#FFFFFF',
    border: '#E2E8F0',
    text: '#1E293B',
  },
  dark: {
    name: 'Dark',
    corner: '#1E293B',
    rowHeader: '#334155',
    colHeaderL0: '#1E293B',
    colHeaderL1: '#475569',
    data: '#0F172A',
    border: '#475569',
    text: '#F8FAFC',
  },
};

/**
 * Get theme object from name or custom theme.
 */
export function getTheme(theme: SuperGridThemeName | SuperGridTheme): SuperGridTheme {
  if (typeof theme === 'string') {
    return themes[theme] || themes.modern;
  }
  return theme;
}

// ============================================================================
// Context
// ============================================================================

const SuperGridContext = createContext<SuperGridContextValue | null>(null);

/**
 * Hook to access SuperGrid context.
 * Must be used within a SuperGridProvider.
 */
export function useSuperGridContext(): SuperGridContextValue {
  const context = useContext(SuperGridContext);
  if (!context) {
    throw new Error('useSuperGridContext must be used within a SuperGridProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface SuperGridProviderProps {
  /** Theme name or custom theme object */
  theme: SuperGridThemeName | SuperGridTheme;

  /** Cell click handler */
  onCellClick?: (
    cell: DataCell | undefined,
    rowPath: RowPath,
    colPath: ColPath
  ) => void;

  /** Selection change handler */
  onSelectionChange?: (selected: { rowPath: RowPath; colPath: ColPath } | null) => void;

  children: React.ReactNode;
}

/**
 * SuperGrid context provider.
 * Provides theme and cell click handlers to all child components.
 */
export const SuperGridProvider: React.FC<SuperGridProviderProps> = ({
  theme: themeProp,
  onCellClick,
  onSelectionChange,
  children,
}) => {
  const theme = getTheme(themeProp);

  const [selectedCell, setSelectedCellState] = useState<{
    rowPath: RowPath;
    colPath: ColPath;
  } | null>(null);

  const setSelectedCell = useCallback(
    (cell: { rowPath: RowPath; colPath: ColPath } | null) => {
      setSelectedCellState(cell);
      onSelectionChange?.(cell);
    },
    [onSelectionChange]
  );

  const contextValue = useMemo<SuperGridContextValue>(
    () => ({
      theme,
      onCellClick,
      selectedCell,
      setSelectedCell,
    }),
    [theme, onCellClick, selectedCell, setSelectedCell]
  );

  return (
    <SuperGridContext.Provider value={contextValue}>
      {children}
    </SuperGridContext.Provider>
  );
};
