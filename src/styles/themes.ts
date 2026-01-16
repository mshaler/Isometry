// Centralized theme constants for Isometry
// Eliminates inline ternaries throughout the codebase

export type ThemeName = 'NeXTSTEP' | 'Modern';

// NeXTSTEP theme - retro grayscale with beveled edges
export const NEXTSTEP = {
  // Backgrounds
  bg: {
    primary: '#c0c0c0',      // Main panel background
    secondary: '#d4d4d4',    // Button/input background
    tertiary: '#b8b8b8',     // Hover state
    dark: '#a0a0a0',         // Headers, darker areas
    light: '#e0e0e0',        // Disabled, muted areas
    raised: '#d4d4d4',       // Raised elements (buttons)
    sunken: '#b0b0b0',       // Sunken areas
  },
  // Borders - beveled effect
  border: {
    dark: '#505050',         // Bottom/right of raised, top/left of sunken
    medium: '#707070',       // General borders
    light: '#ffffff',        // Top/left of raised, bottom/right of sunken
    outline: '#808080',      // Outline borders
    separator: '#a0a0a0',    // Dividers
  },
  // Text
  text: {
    primary: '#404040',      // Main text
    secondary: '#606060',    // Muted text
    disabled: '#909090',     // Disabled state
    inverse: '#ffffff',      // Text on dark backgrounds
  },
  // D3 visualization colors
  chart: {
    palette: ['#808080', '#606060', '#a0a0a0', '#707070', '#909090', '#b0b0b0'],
    axis: '#808080',
    axisText: '#404040',
    grid: '#a0a0a0',
    stroke: '#404040',
  },
  // Border radius
  radius: '0',
} as const;

// Modern theme - macOS 26 style with translucency
export const MODERN = {
  // Backgrounds
  bg: {
    primary: 'white',
    secondary: 'rgb(249, 250, 251)',  // gray-50
    tertiary: 'rgb(243, 244, 246)',   // gray-100
    dark: 'rgb(229, 231, 235)',       // gray-200
    light: 'rgb(255, 255, 255)',
    raised: 'white',
    sunken: 'rgb(249, 250, 251)',
    blur: 'rgba(255, 255, 255, 0.8)', // For backdrop-blur
  },
  // Borders
  border: {
    dark: 'rgb(209, 213, 219)',       // gray-300
    medium: 'rgb(229, 231, 235)',     // gray-200
    light: 'rgb(243, 244, 246)',      // gray-100
    outline: 'rgb(209, 213, 219)',
    separator: 'rgb(229, 231, 235)',
  },
  // Text
  text: {
    primary: 'rgb(55, 65, 81)',       // gray-700
    secondary: 'rgb(107, 114, 128)',  // gray-500
    disabled: 'rgb(156, 163, 175)',   // gray-400
    inverse: 'white',
  },
  // D3 visualization colors (Tableau10)
  chart: {
    palette: null, // Use d3.schemeTableau10
    axis: '#d1d5db',
    axisText: '#6b7280',
    grid: '#e5e7eb',
    stroke: '#6b7280',
  },
  // Border radius
  radius: '0.5rem',
} as const;

// Theme lookup
export const THEMES = {
  NeXTSTEP: NEXTSTEP,
  Modern: MODERN,
} as const;

// Utility to get theme
export function getTheme(themeName: ThemeName) {
  return THEMES[themeName];
}

// Common Tailwind class patterns for each theme
export const TAILWIND_CLASSES = {
  NeXTSTEP: {
    // Panels and containers
    panel: 'bg-[#c0c0c0]',
    panelBorder: 'border-2 border-[#505050]',
    panelWithBorder: 'bg-[#c0c0c0] border-2 border-[#505050]',

    // Raised elements (buttons, cards)
    raised: 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]',
    raisedActive: 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#ffffff] border-r-[#ffffff]',

    // Sunken elements (inputs, wells)
    sunken: 'bg-[#b0b0b0] border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#ffffff] border-r-[#ffffff]',

    // Text
    textPrimary: 'text-[#404040]',
    textSecondary: 'text-[#606060]',
    textDisabled: 'text-[#909090]',

    // Interactive states
    hover: 'hover:bg-[#b8b8b8]',
    active: 'active:bg-[#a0a0a0]',

    // Headers
    header: 'bg-[#a8a8a8] border-b-2 border-[#707070]',

    // Badges
    badge: 'bg-[#a0a0a0]',
    badgeAlt: 'bg-[#b0b0b0]',
  },
  Modern: {
    // Panels and containers
    panel: 'bg-white/80 backdrop-blur-xl',
    panelBorder: 'border border-gray-200',
    panelWithBorder: 'bg-white/80 backdrop-blur-xl border border-gray-200',

    // Raised elements (buttons, cards)
    raised: 'bg-white rounded-lg shadow-sm border border-gray-200',
    raisedActive: 'bg-blue-500 text-white rounded-lg',

    // Sunken elements (inputs, wells)
    sunken: 'bg-gray-50 rounded-lg border border-gray-200',

    // Text
    textPrimary: 'text-gray-700',
    textSecondary: 'text-gray-500',
    textDisabled: 'text-gray-400',

    // Interactive states
    hover: 'hover:bg-gray-50',
    active: 'active:bg-gray-100',

    // Headers
    header: 'bg-gray-100 border-b border-gray-200 rounded-t-lg',

    // Badges
    badge: 'bg-blue-100 text-blue-700 rounded',
    badgeAlt: 'bg-gray-100 text-gray-600 rounded',
  },
} as const;

// Helper to get Tailwind classes for a theme
export function tw(themeName: ThemeName) {
  return TAILWIND_CLASSES[themeName];
}
