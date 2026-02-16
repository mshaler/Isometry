/**
 * @isometry/primitives — CSS Reader Utility
 *
 * TypeScript helpers to read CSS custom properties at render time.
 * Enables D3.js renderers to consume Tier 2 layout primitives.
 *
 * @example
 * const gridPrimitives = getGridPrimitives();
 * const cellWidth = gridPrimitives.cellMinWidth; // number in pixels
 *
 * @version 0.2.0
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface GridPrimitives {
  /** Depth-0 row header width */
  rowHdr0Width: number;
  /** Depth-1 row header width */
  rowHdr1Width: number;
  /** Corner cell width (sum of row headers) */
  cornerWidth: number;
  /** Height per column header level */
  colHdrHeight: number;
  /** Number of column header levels */
  colHdrLevels: number;
  /** Corner cell height */
  cornerHeight: number;
  /** Minimum data cell width */
  cellMinWidth: number;
  /** Minimum data cell height */
  cellMinHeight: number;
  /** Cell content padding */
  cellPadding: number;
  /** Gap between cells */
  cellGap: number;
  /** Gutter width */
  gutter: number;
  /** Sticky headers enabled */
  stickyHeaders: boolean;
}

export interface KanbanPrimitives {
  /** Minimum column width */
  colMinWidth: number;
  /** Maximum column width */
  colMaxWidth: number;
  /** Gap between columns */
  colGap: number;
  /** Column padding */
  colPadding: number;
  /** Column header height */
  colHeaderHeight: number;
  /** Gap between cards */
  cardGap: number;
  /** Card padding */
  cardPadding: number;
  /** Card border radius */
  cardRadius: number;
  /** Show card count in header */
  showCount: boolean;
}

export interface TimelinePrimitives {
  /** Row height */
  rowHeight: number;
  /** Label column width */
  labelWidth: number;
  /** Header height */
  headerHeight: number;
  /** Day width */
  dayWidth: number;
  /** Week width */
  weekWidth: number;
  /** Month width (collapsed) */
  monthWidth: number;
  /** Bar height */
  barHeight: number;
  /** Gap between bars */
  barGap: number;
  /** Bar border radius */
  barRadius: number;
  /** Show grid lines */
  showGrid: boolean;
  /** Show today marker */
  showToday: boolean;
}

export interface GalleryPrimitives {
  /** Card width */
  cardWidth: number;
  /** Card height */
  cardHeight: number;
  /** Card padding */
  cardPadding: number;
  /** Card border radius */
  cardRadius: number;
  /** Gap between cards */
  gap: number;
  /** Container padding */
  padding: number;
  /** Number of columns (0 = auto-fit) */
  columns: number;
  /** Thumbnail height */
  thumbHeight: number;
  /** Show tags */
  showTags: boolean;
  /** Show priority indicator */
  showPriority: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOW-LEVEL READERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Read a CSS custom property value as a string.
 *
 * @param name - Property name (with or without -- prefix)
 * @param element - Element to read from (defaults to document.documentElement)
 */
export function getCSSProperty(name: string, element?: Element): string {
  const el = element ?? document.documentElement;
  const propName = name.startsWith('--') ? name : `--${name}`;
  return getComputedStyle(el).getPropertyValue(propName).trim();
}

/**
 * Read a CSS custom property value as a number (strips 'px' suffix).
 *
 * @param name - Property name (with or without -- prefix)
 * @param element - Element to read from (defaults to document.documentElement)
 * @param fallback - Fallback value if property is empty or invalid
 */
export function getCSSPropertyNumber(
  name: string,
  element?: Element,
  fallback = 0
): number {
  const value = getCSSProperty(name, element);
  if (!value) return fallback;

  const parsed = parseFloat(value.replace('px', ''));
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Read a CSS custom property value as a boolean (1 = true, 0 = false).
 *
 * @param name - Property name (with or without -- prefix)
 * @param element - Element to read from (defaults to document.documentElement)
 */
export function getCSSPropertyBoolean(name: string, element?: Element): boolean {
  const value = getCSSPropertyNumber(name, element);
  return value === 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// HIGH-LEVEL PRIMITIVE READERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Read all SuperGrid layout primitives.
 *
 * @param element - Element to read from (defaults to document.documentElement)
 */
export function getGridPrimitives(element?: Element): GridPrimitives {
  const get = (name: string, fallback = 0) =>
    getCSSPropertyNumber(`--iso-grid-${name}`, element, fallback);
  const getBool = (name: string) =>
    getCSSPropertyBoolean(`--iso-grid-${name}`, element);

  return {
    rowHdr0Width: get('row-hdr0-w', 100),
    rowHdr1Width: get('row-hdr1-w', 100),
    cornerWidth: get('corner-w', 200),
    colHdrHeight: get('col-hdr-h', 30),
    colHdrLevels: get('col-hdr-levels', 2),
    cornerHeight: get('corner-h', 60),
    cellMinWidth: get('cell-min-w', 120),
    cellMinHeight: get('cell-min-h', 72),
    cellPadding: get('cell-pad', 6),
    cellGap: get('cell-gap', 1),
    gutter: get('gutter', 1),
    stickyHeaders: getBool('sticky'),
  };
}

/**
 * Read all Kanban layout primitives.
 *
 * @param element - Element to read from (defaults to document.documentElement)
 */
export function getKanbanPrimitives(element?: Element): KanbanPrimitives {
  const get = (name: string, fallback = 0) =>
    getCSSPropertyNumber(`--iso-kanban-${name}`, element, fallback);
  const getBool = (name: string) =>
    getCSSPropertyBoolean(`--iso-kanban-${name}`, element);

  return {
    colMinWidth: get('col-min-w', 260),
    colMaxWidth: get('col-max-w', 320),
    colGap: get('col-gap', 12),
    colPadding: get('col-pad', 8),
    colHeaderHeight: get('col-hdr-h', 42),
    cardGap: get('card-gap', 6),
    cardPadding: get('card-pad', 12),
    cardRadius: get('card-radius', 6),
    showCount: getBool('show-count'),
  };
}

/**
 * Read all Timeline layout primitives.
 *
 * @param element - Element to read from (defaults to document.documentElement)
 */
export function getTimelinePrimitives(element?: Element): TimelinePrimitives {
  const get = (name: string, fallback = 0) =>
    getCSSPropertyNumber(`--iso-timeline-${name}`, element, fallback);
  const getBool = (name: string) =>
    getCSSPropertyBoolean(`--iso-timeline-${name}`, element);

  return {
    rowHeight: get('row-h', 56),
    labelWidth: get('label-w', 160),
    headerHeight: get('hdr-h', 48),
    dayWidth: get('day-w', 32),
    weekWidth: get('week-w', 224),
    monthWidth: get('month-w', 140),
    barHeight: get('bar-h', 24),
    barGap: get('bar-gap', 4),
    barRadius: get('bar-radius', 4),
    showGrid: getBool('show-grid'),
    showToday: getBool('show-today'),
  };
}

/**
 * Read all Gallery layout primitives.
 *
 * @param element - Element to read from (defaults to document.documentElement)
 */
export function getGalleryPrimitives(element?: Element): GalleryPrimitives {
  const get = (name: string, fallback = 0) =>
    getCSSPropertyNumber(`--iso-gallery-${name}`, element, fallback);
  const getBool = (name: string) =>
    getCSSPropertyBoolean(`--iso-gallery-${name}`, element);

  return {
    cardWidth: get('card-w', 220),
    cardHeight: get('card-h', 160),
    cardPadding: get('card-pad', 16),
    cardRadius: get('card-radius', 8),
    gap: get('gap', 12),
    padding: get('pad', 24),
    columns: get('cols', 0),
    thumbHeight: get('thumb-h', 80),
    showTags: getBool('show-tags'),
    showPriority: getBool('show-priority'),
  };
}
