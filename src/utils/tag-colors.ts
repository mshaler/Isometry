/**
 * Tag color palette and utilities
 *
 * Provides a curated set of 24 accessible colors for tag assignment,
 * plus utilities for determining text contrast.
 */

/**
 * Default color palette (24 colors)
 * Organized into semantic groups for easy selection
 */
export const DEFAULT_PALETTE: string[] = [
  // Primary (4)
  '#3B82F6', // Blue
  '#10B981', // Green
  '#EF4444', // Red
  '#F59E0B', // Yellow

  // Secondary (4)
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal

  // Neutral (4)
  '#6B7280', // Gray
  '#64748B', // Slate
  '#71717A', // Zinc
  '#78716C', // Stone

  // Extended (8)
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#D946EF', // Fuchsia
  '#F43F5E', // Rose
  '#059669', // Emerald
  '#0EA5E9', // Sky
  '#7C3AED', // Violet
];

/**
 * Human-readable names for palette colors
 * Maps 1:1 with DEFAULT_PALETTE array
 */
export const PALETTE_NAMES: string[] = [
  'Blue',
  'Green',
  'Red',
  'Yellow',
  'Purple',
  'Pink',
  'Indigo',
  'Teal',
  'Gray',
  'Slate',
  'Zinc',
  'Stone',
  'Orange',
  'Cyan',
  'Lime',
  'Fuchsia',
  'Rose',
  'Emerald',
  'Sky',
  'Violet',
];

/**
 * Calculate relative luminance for a color
 * Uses WCAG formula: https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getRelativeLuminance(hex: string): number {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse RGB components
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  // Apply sRGB gamma correction
  const rsRGB = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gsRGB = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bsRGB = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  // Calculate luminance
  return 0.2126 * rsRGB + 0.7152 * gsRGB + 0.0722 * bsRGB;
}

/**
 * Get contrasting text color (white or black) for a background color
 * Ensures WCAG AA contrast ratio (4.5:1)
 *
 * @param bgColor - Hex color string (e.g., '#3B82F6')
 * @returns '#FFFFFF' for dark backgrounds, '#000000' for light backgrounds
 */
export function getContrastText(bgColor: string): string {
  const luminance = getRelativeLuminance(bgColor);

  // Threshold at 0.5 luminance
  // Dark backgrounds (< 0.5) get white text
  // Light backgrounds (>= 0.5) get black text
  return luminance < 0.5 ? '#FFFFFF' : '#000000';
}

/**
 * Get a color from the palette by index
 * Wraps around if index exceeds palette size (round-robin)
 *
 * @param index - Zero-based index
 * @returns Hex color string
 */
export function getPaletteColor(index: number): string {
  return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
}

/**
 * Get color name for a hex color if it's in the palette
 *
 * @param hex - Hex color string
 * @returns Color name or the hex string if not in palette
 */
export function getColorName(hex: string): string {
  const index = DEFAULT_PALETTE.indexOf(hex.toUpperCase());
  if (index === -1) {
    return hex;
  }
  return PALETTE_NAMES[index] || hex;
}
