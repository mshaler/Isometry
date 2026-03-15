# SuperGrid Spreadsheet UI/UX Recommendations

This document outlines recommendations for improving the SuperGrid's visual design and interaction model to more closely align with traditional spreadsheet applications (e.g., Excel, Google Sheets, Airtable).

## 1. Grid Aesthetics & Layout

To achieve a "professional spreadsheet" look, the grid should prioritize high-density data and clear structural boundaries.

- **Thinner, Solid Grid Lines**: Replace the current 1px gap or thick borders with `1px solid var(--border-subtle)`. This creates a cleaner, more precise look.
- **Zebra Striping**: Implement alternating row colors (e.g., `var(--bg-primary)` for even rows and `var(--cell-alt)` for odd rows). This helps users track data across wide grids.
- **Monospaced Numeric Font**: Use a monospaced font or `font-variant-numeric: tabular-nums` for any count badges or numeric data cells to ensure vertical alignment of digits.
- **Reduced Padding**: Tighten the default cell padding from `4px` to `2px 6px` to increase data density.
- **Consistent Alignment**:
    - **Text/Pills**: Left-aligned.
    - **Numbers/Counts**: Right-aligned.
    - **Headers**: Centered or Left-aligned with a distinct bold style.

## 2. Selection & Focus Model

The selection UX should feel responsive and follow the "active cell" pattern common in spreadsheets.

- **Excel-Style Selection Border**: When a cell or range is selected, apply a `2px solid var(--selection-outline)` border.
- **Fill Handle**: Add a small square affordance (the "fill handle") at the bottom-right corner of the selection border. While it may start as purely cosmetic, it provides a strong visual cue of spreadsheet functionality.
- **Header Highlighting**: When a cell is selected, the corresponding column and row headers should gain a distinct highlight (e.g., `background-color: var(--accent-bg)` and `color: var(--accent)`) to help with orientation.
- **Range Selection Visuals**: For multi-cell ranges, use a light tinted background (`var(--selection-bg)`) for the entire range and a thick border around the perimeter of the group.

## 3. Spreadsheet Mode Rendering

The current "spreadsheet" mode renders card pills. For a more authentic spreadsheet experience, we should prioritize the primary data value.

- **Primary Value Focus**: Instead of showing all card pills by default, show the primary attribute (e.g., card name) as a single line of text.
- **"Value-First" Rendering**:
    - If a cell contains 1 card: Show the card name directly.
    - If a cell contains >1 card: Show the first card name followed by a `+N` count badge (e.g., "Project Alpha (+3)").
- **Inline Search Marks**: Preserve the current `<mark>` tag highlighting for search matches but ensure it doesn't break the single-line layout. Use `text-overflow: ellipsis`.
- **Tooltip Refinement**: Keep the "SuperCard" tooltip for exploring multiple cards but style it to look more like a "detail" popover.

## 4. Header Improvements

Headers provide the primary navigation and structural context.

- **Traditional Header Shading**: Use a slightly darker, gradient-free background for headers (`var(--bg-surface)` or a specific `--header-bg`) with a `1px solid var(--border-muted)` border.
- **Optional "Classic" Headers**: Add an optional mode to show column letters (A, B, C...) and row numbers (1, 2, 3...) as secondary indicators.
- **Corner Cell "Select All"**: The corner cell (where row and column headers meet) should act as a "Select All" button, highlighting the entire grid on click.
- **Column Resize Indicator**: Improve the visual feedback during resize with a vertical line that spans the entire grid height, not just the header.

## 5. Interaction Model

Spreadsheet power users rely heavily on keyboard and double-click interactions.

- **Arrow Key Navigation**: Support using `ArrowUp`, `ArrowDown`, `ArrowLeft`, and `ArrowRight` to move the active cell selection.
- **Tab/Enter Flow**: Use `Tab` to move to the right and `Enter` to move down. `Shift+Tab` and `Shift+Enter` should move in reverse.
- **Double-Click to Edit**: Implement a "Double-click to edit" stub. Even if it just opens a simple input field or popover, it establishes the expected spreadsheet affordance.
- **Right-Click Context Menu**: Expand the current context menu to include "Insert/Delete Axis" or "Copy Cell Value" to reinforce the utility-first nature of the view.

## 6. CSS Variable Extensions

Add the following to `design-tokens.css` or `supergrid.css` for better control:

```css
:root {
  --sg-grid-line: var(--border-subtle);
  --sg-header-bg: var(--bg-surface);
  --sg-selection-border: var(--accent);
  --sg-cell-padding: 2px 6px;
  --sg-number-font: 'JetBrains Mono', 'Courier New', monospace; /* Fallback to mono */
}
```
