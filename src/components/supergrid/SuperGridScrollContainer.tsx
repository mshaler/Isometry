/**
 * SuperGridScrollContainer - CSS Grid layout with sticky headers
 *
 * Part of Phase 92 - Data Cell Integration (SCROLL-01 through SCROLL-05)
 * Implements spreadsheet-like scroll behavior with:
 * - Sticky column headers (top)
 * - Sticky row headers (left)
 * - Fixed corner cell (top-left)
 * - Single scroll container
 */

import { type RefObject, type ReactNode } from 'react';

export interface SuperGridScrollContainerProps {
  /** Ref for column header SVG */
  columnHeaderRef: RefObject<SVGSVGElement>;
  /** Ref for row header SVG */
  rowHeaderRef: RefObject<SVGSVGElement>;
  /** Ref for data grid SVG */
  dataGridRef: RefObject<SVGSVGElement>;
  /** Optional content for corner cell */
  cornerContent?: ReactNode;
  /** Width of row headers (default: 150) */
  headerWidth?: number;
  /** Height of column headers (default: 40) */
  headerHeight?: number;
  /** Total width of content area */
  contentWidth: number;
  /** Total height of content area */
  contentHeight: number;
  /** Optional CSS class name */
  className?: string;
}

/**
 * SuperGridScrollContainer - CSS Grid layout with sticky headers
 *
 * Layout structure (CSS Grid):
 * ```
 * ┌─────────────┬──────────────────────┐
 * │   Corner    │   Column Headers     │ <- Sticky top
 * │  (sticky)   │      (sticky)        │
 * ├─────────────┼──────────────────────┤
 * │     Row     │                      │
 * │   Headers   │     Data Grid        │ <- Scrollable
 * │  (sticky)   │                      │
 * └─────────────┴──────────────────────┘
 * ```
 *
 * SCROLL Requirements:
 * - SCROLL-01: Headers remain fixed during scroll (CSS sticky)
 * - SCROLL-02: Upper-left corner pinned at (0,0)
 * - SCROLL-04: transformOrigin: '0 0' for upper-left zoom anchor
 * - SCROLL-05: Single scroll container (no nested overflow)
 *
 * @param props - Container configuration
 */
export function SuperGridScrollContainer({
  columnHeaderRef,
  rowHeaderRef,
  dataGridRef,
  cornerContent,
  headerWidth = 150,
  headerHeight = 40,
  contentWidth,
  contentHeight,
  className = '',
}: SuperGridScrollContainerProps): JSX.Element {
  return (
    <div
      className={`supergrid ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `${headerWidth}px 1fr`, // Row headers | Data grid
        gridTemplateRows: `${headerHeight}px 1fr`, // Column headers | Data grid
        overflow: 'auto', // Single scroll container (SCROLL-05)
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Corner cell - sticky at top-left, z-index: 3 */}
      <div
        className="supergrid__corner"
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          zIndex: 3,
          width: headerWidth,
          height: headerHeight,
          background: '#f5f5f5',
          borderRight: '1px solid #e5e7eb',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {cornerContent}
      </div>

      {/* Column headers - sticky at top, z-index: 2 */}
      <div
        className="supergrid__column-headers"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: '#f5f5f5',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <svg
          ref={columnHeaderRef}
          width={contentWidth}
          height={headerHeight}
          style={{
            display: 'block',
          }}
        />
      </div>

      {/* Row headers - sticky at left, z-index: 1 */}
      <div
        className="supergrid__row-headers"
        style={{
          position: 'sticky',
          left: 0,
          zIndex: 1,
          gridRow: 2,
          background: '#f5f5f5',
          borderRight: '1px solid #e5e7eb',
        }}
      >
        <svg
          ref={rowHeaderRef}
          width={headerWidth}
          height={contentHeight}
          style={{
            display: 'block',
          }}
        />
      </div>

      {/* Data grid - scrollable content, no sticky */}
      <div
        className="supergrid__data-grid"
        style={{
          gridRow: 2,
          gridColumn: 2,
          transformOrigin: '0 0', // Upper-left anchor for zoom (SCROLL-04)
        }}
      >
        <svg
          ref={dataGridRef}
          width={contentWidth}
          height={contentHeight}
          style={{
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}
