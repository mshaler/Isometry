// Component-specific theme hooks
// Provides pre-computed Tailwind classes for common UI patterns

import { useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { tw, getTheme, type ThemeName } from '@/styles/themes';

// Generic hook that returns theme classes for a component type
export function useThemeClasses() {
  const { theme } = useTheme();
  return useMemo(() => tw(theme as ThemeName), [theme]);
}

// Get raw theme values (colors, etc.)
export function useThemeValues() {
  const { theme } = useTheme();
  return useMemo(() => getTheme(theme as ThemeName), [theme]);
}

// Button theme hook
export function useButtonTheme() {
  const { theme } = useTheme();

  return useMemo(() => ({
    base: theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
      : 'bg-white hover:bg-gray-50 rounded-lg border border-gray-300',
    active: theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#ffffff] border-r-[#ffffff]'
      : 'bg-blue-500 text-white rounded-lg',
    selected: theme === 'NeXTSTEP'
      ? 'bg-black text-white'
      : 'bg-blue-500 text-white',
    hover: theme === 'NeXTSTEP'
      ? 'hover:bg-[#c8c8c8]'
      : 'hover:bg-gray-100',
    disabled: theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] text-[#909090] cursor-not-allowed'
      : 'bg-gray-100 text-gray-400 cursor-not-allowed',
    icon: theme === 'NeXTSTEP'
      ? 'p-1'
      : 'p-1 rounded hover:bg-gray-200',
  }), [theme]);
}

// Panel/container theme hook
export function usePanelTheme() {
  const { theme } = useTheme();

  return useMemo(() => ({
    container: theme === 'NeXTSTEP'
      ? 'bg-[#c0c0c0] border-r-2 border-[#505050]'
      : 'bg-white/80 backdrop-blur-xl border-r border-gray-200',
    header: theme === 'NeXTSTEP'
      ? 'bg-[#a8a8a8] border-b-2 border-[#707070]'
      : 'bg-gray-100 border-b border-gray-200',
    section: theme === 'NeXTSTEP'
      ? 'bg-[#c0c0c0]'
      : 'bg-gray-50',
    divider: theme === 'NeXTSTEP'
      ? 'border-t border-[#a0a0a0]'
      : 'border-t border-gray-200',
  }), [theme]);
}

// Input/form theme hook
export function useInputTheme() {
  const { theme } = useTheme();

  return useMemo(() => ({
    base: theme === 'NeXTSTEP'
      ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
      : 'bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    select: theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] border-2 border-[#707070]'
      : 'bg-white border border-gray-300 rounded',
    checkbox: theme === 'NeXTSTEP'
      ? 'bg-white border-2 border-[#707070]'
      : 'rounded border-gray-300 text-blue-600 focus:ring-blue-500',
  }), [theme]);
}

// Dropdown theme hook
export function useDropdownTheme() {
  const { theme } = useTheme();

  return useMemo(() => ({
    trigger: theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
      : 'bg-white hover:bg-gray-50 rounded-lg border border-gray-300',
    menu: theme === 'NeXTSTEP'
      ? 'absolute top-full left-0 mt-1 bg-[#d4d4d4] border-2 border-[#707070] shadow-lg z-50'
      : 'absolute top-full left-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-50',
    item: theme === 'NeXTSTEP'
      ? 'w-full px-3 py-1 text-left text-sm hover:bg-black hover:text-white'
      : 'w-full px-3 py-1 text-left text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg',
    itemActive: theme === 'NeXTSTEP'
      ? 'bg-black text-white'
      : 'bg-blue-50 text-blue-700',
    label: theme === 'NeXTSTEP'
      ? 'text-xs text-[#404040]'
      : 'text-xs text-gray-600',
  }), [theme]);
}

// Card theme hook
export function useCardTheme() {
  const { theme } = useTheme();

  return useMemo(() => ({
    container: theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
      : 'bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow',
    header: theme === 'NeXTSTEP'
      ? 'font-medium text-[#404040]'
      : 'font-medium text-gray-900',
    content: theme === 'NeXTSTEP'
      ? 'text-[#404040]'
      : 'text-gray-500',
    footer: theme === 'NeXTSTEP'
      ? 'text-xs text-[#606060]'
      : 'text-xs text-gray-400',
  }), [theme]);
}

// Badge theme hook
export function useBadgeTheme() {
  const { theme } = useTheme();

  return useMemo(() => ({
    default: theme === 'NeXTSTEP'
      ? 'px-2 py-0.5 text-xs bg-[#a0a0a0]'
      : 'px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded',
    primary: theme === 'NeXTSTEP'
      ? 'px-2 py-0.5 text-xs bg-[#808080] text-white'
      : 'px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded',
    success: theme === 'NeXTSTEP'
      ? 'px-2 py-0.5 text-xs bg-[#606060] text-white'
      : 'px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded',
    warning: theme === 'NeXTSTEP'
      ? 'px-2 py-0.5 text-xs bg-[#b0b0b0]'
      : 'px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded',
  }), [theme]);
}

// Table/list theme hook
export function useTableTheme() {
  const { theme } = useTheme();

  return useMemo(() => ({
    header: theme === 'NeXTSTEP'
      ? 'bg-[#b0b0b0] text-[#404040] border-b-2 border-[#808080]'
      : 'bg-gray-50 text-gray-500 border-b border-gray-200',
    row: theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] border-t border-[#a0a0a0] hover:bg-[#c8c8c8]'
      : 'bg-white border-b border-gray-100 hover:bg-gray-50',
    rowAlt: theme === 'NeXTSTEP'
      ? 'bg-[#c8c8c8] border-t border-[#a0a0a0] hover:bg-[#b8b8b8]'
      : 'bg-gray-50 border-b border-gray-100 hover:bg-gray-100',
    cell: theme === 'NeXTSTEP'
      ? 'text-[#404040]'
      : 'text-gray-700',
  }), [theme]);
}

// Canvas/visualization container theme hook
export function useCanvasTheme() {
  const { theme } = useTheme();

  return useMemo(() => ({
    container: theme === 'NeXTSTEP'
      ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
      : 'bg-white rounded-lg shadow-lg border border-gray-200',
    emptyState: theme === 'NeXTSTEP'
      ? 'text-[#707070]'
      : 'text-gray-400',
  }), [theme]);
}

// Text style hook
export function useTextTheme() {
  const { theme } = useTheme();

  return useMemo(() => ({
    primary: theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-700',
    secondary: theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500',
    muted: theme === 'NeXTSTEP' ? 'text-[#909090]' : 'text-gray-400',
    inverse: theme === 'NeXTSTEP' ? 'text-white' : 'text-white',
    label: theme === 'NeXTSTEP' ? 'text-xs text-[#404040]' : 'text-xs text-gray-600',
  }), [theme]);
}
