/**
 * FilterDropdown - D3-based dropdown UI component for header filtering
 *
 * Renders a positioned dropdown with checkboxes for value selection.
 * The dropdown can be attached to any DOM element and manages its own
 * lifecycle including event handlers.
 *
 * Plan 75-01: SuperFilter - Header Dropdown Filters
 */

import * as d3 from 'd3';

// ============================================================================
// Types
// ============================================================================

/**
 * A value option with selection state for the dropdown.
 */
export interface ValueOption {
  value: string;
  count: number;
  selected: boolean;
}

/**
 * Configuration callbacks for the dropdown.
 */
export interface FilterDropdownConfig {
  /** Called when a value checkbox is toggled */
  onToggleValue: (value: string) => void;
  /** Called when Select All is clicked */
  onSelectAll: () => void;
  /** Called when Clear button is clicked */
  onClearFilter: () => void;
  /** Called when Apply button is clicked */
  onApply: () => void;
  /** Called when dropdown is closed/destroyed */
  onClose: () => void;
}

// ============================================================================
// Styles (inline for D3 rendering)
// ============================================================================

const DROPDOWN_STYLES = {
  container: {
    position: 'fixed' as const,
    backgroundColor: '#ffffff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
    minWidth: '180px',
    maxWidth: '280px',
    maxHeight: '300px',
    zIndex: '1000',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '12px',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '1px solid #eee',
    fontWeight: '600' as const,
    color: '#333',
    backgroundColor: '#f8f8f8',
  },
  list: {
    maxHeight: '180px',
    overflowY: 'auto' as const,
    padding: '4px 0',
  },
  item: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    padding: '4px 12px',
    cursor: 'pointer' as const,
  },
  itemHover: {
    backgroundColor: '#f0f0f0',
  },
  checkbox: {
    marginRight: '8px',
    cursor: 'pointer' as const,
  },
  label: {
    flex: '1' as const,
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
  },
  count: {
    color: '#888',
    marginLeft: '8px',
  },
  selectAll: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    padding: '6px 12px',
    borderBottom: '1px solid #eee',
    cursor: 'pointer' as const,
  },
  actions: {
    display: 'flex' as const,
    justifyContent: 'flex-end' as const,
    gap: '8px',
    padding: '8px 12px',
    borderTop: '1px solid #eee',
    backgroundColor: '#f8f8f8',
  },
  button: {
    padding: '4px 12px',
    borderRadius: '3px',
    border: '1px solid #ccc',
    backgroundColor: '#fff',
    cursor: 'pointer' as const,
    fontSize: '11px',
  },
  applyButton: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
    color: '#fff',
  },
};

// ============================================================================
// FilterDropdown Class
// ============================================================================

/**
 * D3-based filter dropdown component.
 *
 * Usage:
 * ```typescript
 * const dropdown = new FilterDropdown({
 *   onToggleValue: (value) => filterManager.toggleValue(headerId, value),
 *   onSelectAll: () => filterManager.selectAll(headerId),
 *   onClearFilter: () => filterManager.clearFilter(headerId),
 *   onApply: () => filterManager.applyFilter(headerId),
 *   onClose: () => setDropdownOpen(false),
 * });
 *
 * dropdown.render(document.body, { x: 100, y: 50 }, 'Status', values);
 * ```
 */
export class FilterDropdown {
  private config: FilterDropdownConfig;
  private container: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null;
  private values: ValueOption[] = [];

  constructor(config: FilterDropdownConfig) {
    this.config = config;
  }

  /**
   * Render the dropdown at the specified position.
   *
   * @param parent - Parent element to append dropdown to
   * @param position - Screen position for the dropdown
   * @param facetName - Name of the facet being filtered (shown in header)
   * @param values - Array of value options with selection state
   */
  render(
    parent: Element,
    position: { x: number; y: number },
    facetName: string,
    values: ValueOption[]
  ): void {
    this.values = values;

    // Create container
    this.container = d3.select(parent)
      .append('div')
      .attr('class', 'supergrid-filter-dropdown')
      .style('position', DROPDOWN_STYLES.container.position)
      .style('left', `${position.x}px`)
      .style('top', `${position.y}px`)
      .style('background-color', DROPDOWN_STYLES.container.backgroundColor)
      .style('border', DROPDOWN_STYLES.container.border)
      .style('border-radius', DROPDOWN_STYLES.container.borderRadius)
      .style('box-shadow', DROPDOWN_STYLES.container.boxShadow)
      .style('min-width', DROPDOWN_STYLES.container.minWidth)
      .style('max-width', DROPDOWN_STYLES.container.maxWidth)
      .style('max-height', DROPDOWN_STYLES.container.maxHeight)
      .style('z-index', DROPDOWN_STYLES.container.zIndex)
      .style('font-family', DROPDOWN_STYLES.container.fontFamily)
      .style('font-size', DROPDOWN_STYLES.container.fontSize);

    // Render header
    this.renderHeader(facetName);

    // Render Select All
    this.renderSelectAll();

    // Render value list
    this.renderValueList();

    // Render action buttons
    this.renderActions();
  }

  /**
   * Render the dropdown header.
   */
  private renderHeader(facetName: string): void {
    if (!this.container) return;

    this.container
      .append('div')
      .attr('class', 'filter-dropdown-header')
      .style('padding', DROPDOWN_STYLES.header.padding)
      .style('border-bottom', DROPDOWN_STYLES.header.borderBottom)
      .style('font-weight', DROPDOWN_STYLES.header.fontWeight)
      .style('color', DROPDOWN_STYLES.header.color)
      .style('background-color', DROPDOWN_STYLES.header.backgroundColor)
      .text(`Filter by ${facetName}`);
  }

  /**
   * Render the Select All checkbox.
   */
  private renderSelectAll(): void {
    if (!this.container) return;

    const allSelected = this.values.every(v => v.selected);

    const selectAllDiv = this.container
      .append('div')
      .attr('class', 'filter-select-all')
      .style('display', DROPDOWN_STYLES.selectAll.display)
      .style('align-items', DROPDOWN_STYLES.selectAll.alignItems)
      .style('padding', DROPDOWN_STYLES.selectAll.padding)
      .style('border-bottom', DROPDOWN_STYLES.selectAll.borderBottom)
      .style('cursor', DROPDOWN_STYLES.selectAll.cursor)
      .on('click', () => {
        this.config.onSelectAll();
      });

    selectAllDiv
      .append('input')
      .attr('type', 'checkbox')
      .attr('class', 'filter-checkbox')
      .property('checked', allSelected)
      .style('margin-right', DROPDOWN_STYLES.checkbox.marginRight)
      .style('cursor', DROPDOWN_STYLES.checkbox.cursor);

    selectAllDiv
      .append('span')
      .text('Select All');
  }

  /**
   * Render the value checkbox list.
   */
  private renderValueList(): void {
    if (!this.container) return;

    const listDiv = this.container
      .append('div')
      .attr('class', 'filter-dropdown-list')
      .style('max-height', DROPDOWN_STYLES.list.maxHeight)
      .style('overflow-y', DROPDOWN_STYLES.list.overflowY)
      .style('padding', DROPDOWN_STYLES.list.padding);

    const items = listDiv
      .selectAll('.filter-dropdown-item')
      .data(this.values)
      .enter()
      .append('div')
      .attr('class', 'filter-dropdown-item')
      .style('display', DROPDOWN_STYLES.item.display)
      .style('align-items', DROPDOWN_STYLES.item.alignItems)
      .style('padding', DROPDOWN_STYLES.item.padding)
      .style('cursor', DROPDOWN_STYLES.item.cursor)
      .on('mouseenter', function() {
        d3.select(this).style('background-color', DROPDOWN_STYLES.itemHover.backgroundColor);
      })
      .on('mouseleave', function() {
        d3.select(this).style('background-color', 'transparent');
      });

    // Checkbox
    items
      .append('input')
      .attr('type', 'checkbox')
      .attr('class', 'filter-checkbox')
      .property('checked', d => d.selected)
      .style('margin-right', DROPDOWN_STYLES.checkbox.marginRight)
      .style('cursor', DROPDOWN_STYLES.checkbox.cursor)
      .on('click', (event, d) => {
        event.stopPropagation();
        this.config.onToggleValue(d.value);
      });

    // Label with value and count
    const label = items
      .append('div')
      .attr('class', 'filter-item-label')
      .style('flex', DROPDOWN_STYLES.label.flex)
      .style('display', DROPDOWN_STYLES.label.display)
      .style('justify-content', DROPDOWN_STYLES.label.justifyContent)
      .on('click', (_event, d) => {
        this.config.onToggleValue(d.value);
      });

    label
      .append('span')
      .attr('class', 'filter-item-value')
      .text(d => d.value);

    label
      .append('span')
      .attr('class', 'filter-item-count')
      .style('color', DROPDOWN_STYLES.count.color)
      .style('margin-left', DROPDOWN_STYLES.count.marginLeft)
      .text(d => `(${d.count})`);
  }

  /**
   * Render action buttons (Clear, Apply).
   */
  private renderActions(): void {
    if (!this.container) return;

    const actionsDiv = this.container
      .append('div')
      .attr('class', 'filter-dropdown-actions')
      .style('display', DROPDOWN_STYLES.actions.display)
      .style('justify-content', DROPDOWN_STYLES.actions.justifyContent)
      .style('gap', DROPDOWN_STYLES.actions.gap)
      .style('padding', DROPDOWN_STYLES.actions.padding)
      .style('border-top', DROPDOWN_STYLES.actions.borderTop)
      .style('background-color', DROPDOWN_STYLES.actions.backgroundColor);

    // Clear button
    actionsDiv
      .append('button')
      .attr('class', 'filter-clear-btn')
      .style('padding', DROPDOWN_STYLES.button.padding)
      .style('border-radius', DROPDOWN_STYLES.button.borderRadius)
      .style('border', DROPDOWN_STYLES.button.border)
      .style('background-color', DROPDOWN_STYLES.button.backgroundColor)
      .style('cursor', DROPDOWN_STYLES.button.cursor)
      .style('font-size', DROPDOWN_STYLES.button.fontSize)
      .text('Clear')
      .on('click', () => {
        this.config.onClearFilter();
      });

    // Apply button
    actionsDiv
      .append('button')
      .attr('class', 'filter-apply-btn')
      .style('padding', DROPDOWN_STYLES.button.padding)
      .style('border-radius', DROPDOWN_STYLES.button.borderRadius)
      .style('border', `1px solid ${DROPDOWN_STYLES.applyButton.borderColor}`)
      .style('background-color', DROPDOWN_STYLES.applyButton.backgroundColor)
      .style('color', DROPDOWN_STYLES.applyButton.color)
      .style('cursor', DROPDOWN_STYLES.button.cursor)
      .style('font-size', DROPDOWN_STYLES.button.fontSize)
      .text('Apply')
      .on('click', () => {
        this.config.onApply();
      });
  }

  /**
   * Update checkbox states without re-rendering the dropdown.
   *
   * @param values - Updated value options
   */
  updateValues(values: ValueOption[]): void {
    if (!this.container) return;

    this.values = values;

    // Update Select All checkbox
    const allSelected = values.every(v => v.selected);
    this.container
      .select('.filter-select-all input')
      .property('checked', allSelected);

    // Update value checkboxes
    this.container
      .selectAll<HTMLInputElement, ValueOption>('.filter-dropdown-item .filter-checkbox')
      .data(values)
      .property('checked', d => d.selected);
  }

  /**
   * Destroy the dropdown and clean up.
   */
  destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.config.onClose();
  }

  /**
   * Check if the dropdown is currently rendered.
   */
  isRendered(): boolean {
    return this.container !== null;
  }
}
