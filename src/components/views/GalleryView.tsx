/**
 * GalleryView — 0-axis entry in the Grid Continuum
 *
 * Renders cards in a responsive gallery layout using row-based virtual
 * scrolling. Integrates with LATCH FilterContext, SelectionContext, and
 * useSQLiteQuery for live data.
 *
 * Architecture: Row-based virtualization (not CSS Grid auto-fit) because
 * TanStack Virtual uses translateY positioning, incompatible with auto-fit.
 * Solution: measure container → compute columns → chunk into rows → virtualize rows.
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useFilters } from '@/state/FilterContext';
import { useSelection } from '@/state/SelectionContext';
import { compileFilters } from '@/filters/compiler';
import { useSQLiteQuery } from '@/hooks/database/useSQLiteQuery';
import { useVirtualizedList } from '@/hooks/performance/useVirtualizedList';
import { rowToCard } from '@/types/card';
import type { Card } from '@/types/card';
import { GalleryCard } from './GalleryCard';
import '@/styles/primitives-gallery.css';

// Card dimension constants matching CSS custom property defaults
const CARD_WIDTH = 220;   // --iso-gallery-card-w
const CARD_HEIGHT = 160;  // --iso-gallery-card-h
const GAP = 12;           // --iso-gallery-gap

/** Chunk array into sub-arrays of given size */
function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/** Transform database rows to Card objects */
const cardTransform = (rows: Record<string, unknown>[]): Card[] =>
  rows.map(rowToCard);

export function GalleryView() {
  const { activeFilters } = useFilters();
  const {
    select,
    isSelected,
    registerScrollToNode,
    unregisterScrollToNode,
  } = useSelection();

  // Measure container width for responsive column count
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute column count from container width
  const columnCount = Math.max(1, Math.floor(containerWidth / (CARD_WIDTH + GAP)));
  const rowHeight = CARD_HEIGHT + GAP;

  // Compile LATCH filters to SQL WHERE clause
  const { sql, params } = useMemo(() => {
    const compiled = compileFilters(activeFilters);
    return {
      sql: `SELECT * FROM cards WHERE ${compiled.sql} ORDER BY modified_at DESC`,
      params: compiled.params,
    };
  }, [activeFilters]);

  // Fetch cards from sql.js
  const { data: cards } = useSQLiteQuery<Card>(sql, params, {
    transform: cardTransform,
  });

  const cardList = cards ?? [];

  // Group cards into rows for row-based virtualization
  const rows = useMemo(
    () => chunkArray(cardList, columnCount),
    [cardList, columnCount]
  );

  // Row-based virtualizer
  const { containerRef, virtualItems, totalSize, scrollToIndex } =
    useVirtualizedList(rows.length, {
      containerHeight: 600,
      estimateSize: rowHeight,
      overscan: 3,
    });

  // Register scrollToNode for cross-canvas sync
  useEffect(() => {
    registerScrollToNode((id: string) => {
      const cardIndex = cardList.findIndex((c) => c.id === id);
      if (cardIndex >= 0) {
        const rowIndex = Math.floor(cardIndex / columnCount);
        scrollToIndex(rowIndex, { align: 'auto' });
      }
    });
    return () => unregisterScrollToNode();
  }, [cardList, columnCount, scrollToIndex, registerScrollToNode, unregisterScrollToNode]);

  const handleCardClick = useCallback(
    (id: string) => {
      select(id);
    },
    [select]
  );

  return (
    <div ref={wrapperRef} className="gallery-wrapper h-full overflow-hidden">
      <div
        ref={containerRef}
        className="overflow-auto h-full"
        style={{ padding: 'var(--iso-gallery-pad, 24px)' }}
      >
        <div style={{ height: totalSize, position: 'relative' }}>
          {virtualItems.map((virtualRow) => {
            const rowCards = rows[virtualRow.index] ?? [];
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  width: '100%',
                  display: 'flex',
                  gap: `${GAP}px`,
                }}
              >
                {rowCards.map((card) => (
                  <GalleryCard
                    key={card.id}
                    card={card}
                    selected={isSelected(card.id)}
                    onClick={() => handleCardClick(card.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
