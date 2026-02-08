import { useMemo } from 'react';

export interface ComponentTheme {
  background: string;
  foreground: string;
  border: string;
  accent: string;
  muted: string;
  hover: string;
  active: string;
}

export interface PanelTheme extends ComponentTheme {
  shadow: string;
  radius: string;
  padding: string;
}

export interface InputTheme extends ComponentTheme {
  placeholder: string;
  focus: string;
  disabled: string;
}

export interface TextTheme {
  primary: string;
  secondary: string;
  muted: string;
  accent: string;
  error: string;
  warning: string;
  success: string;
}

/**
 * Hook for component-specific theming
 * Bridge eliminated - simplified theme management
 */
export function useComponentTheme(): ComponentTheme {
  return useMemo(() => ({
    background: 'var(--background)',
    foreground: 'var(--foreground)',
    border: 'var(--border)',
    accent: 'var(--accent)',
    muted: 'var(--muted)',
    hover: 'var(--hover)',
    active: 'var(--active)'
  }), []);
}

export function usePanelTheme(): PanelTheme {
  return useMemo(() => ({
    background: 'var(--card)',
    foreground: 'var(--card-foreground)',
    border: 'var(--border)',
    accent: 'var(--accent)',
    muted: 'var(--muted)',
    hover: 'var(--hover)',
    active: 'var(--active)',
    shadow: 'var(--shadow)',
    radius: 'var(--radius)',
    padding: '1rem'
  }), []);
}

export function useInputTheme(): InputTheme {
  return useMemo(() => ({
    background: 'var(--input)',
    foreground: 'var(--foreground)',
    border: 'var(--border)',
    accent: 'var(--accent)',
    muted: 'var(--muted)',
    hover: 'var(--hover)',
    active: 'var(--active)',
    placeholder: 'var(--muted-foreground)',
    focus: 'var(--ring)',
    disabled: 'var(--muted)'
  }), []);
}

export function useTextTheme(): TextTheme {
  return useMemo(() => ({
    primary: 'var(--foreground)',
    secondary: 'var(--muted-foreground)',
    muted: 'var(--muted-foreground)',
    accent: 'var(--accent-foreground)',
    error: 'var(--destructive)',
    warning: 'var(--warning)',
    success: 'var(--success)'
  }), []);
}

// Alias for compatibility
export const useCanvasTheme = useComponentTheme;