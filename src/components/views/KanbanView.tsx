/**
 * KanbanView — Single-axis PAFV projection in the Grid Continuum
 *
 * Renders cards grouped into columns by facet value (e.g., status).
 * Uses Y-axis PAFV mapping or falls back to 'status' for column facet.
 * Supports drag-and-drop between columns with SQL persistence.
 */
import { useMemo, useEffect, useCallback, useRef } from 'react';
import { useFilters } from '@/state/FilterContext';
import { useSelection } from '@/state/SelectionContext';
import { useSQLiteQuery } from '@/hooks/database/useSQLiteQuery';
import { usePAFV } from '@/hooks/usePAFV';
import { compileFilters } from '@/filters/compiler';
import { rowToCard } from '@/types/card';
import type { Card } from '@/types/card';
import { KanbanColumn } from './KanbanColumn';
import '@/styles/primitives-kanban.css';

/** Map field names to database column names */
const FIELD_TO_COLUMN: Record<string, string> = {
  status: 'status',
  folder: 'folder',
  priority: 'priority',
  // Add more mappings as needed
};

/** Transform database rows to Card objects */
const cardTransform = (rows: Record<string, unknown>[]): Card[] =>
  rows.map(rowToCard);

/** Extract unique string values from query result */
const extractValues = (rows: Record<string, unknown>[]): string[] =>
  rows.map((r) => r.value as string).filter(Boolean);

export function KanbanView() {
  const { activeFilters } = useFilters();
  const {
    select,
    isSelected,
    registerScrollToNode,
    unregisterScrollToNode,
  } = useSelection();

  // Get PAFV state for column facet determination
  const pafvState = usePAFV();
  const yMapping = pafvState.mappings.find((m) => m.plane === 'y');

  // Determine column facet from Y-axis mapping or default to 'status'
  const columnFacet = yMapping?.field ?? 'status';
  const columnColumn = FIELD_TO_COLUMN[columnFacet] ?? columnFacet;

  // Compile LATCH filters to SQL WHERE clause
  const { cardsSQL, cardsParams } = useMemo(() => {
    const compiled = compileFilters(activeFilters);
    return {
      cardsSQL: `SELECT * FROM cards WHERE ${compiled.sql} ORDER BY modified_at DESC`,
      cardsParams: compiled.params,
    };
  }, [activeFilters]);

  // Fetch cards from database
  const { data: cards } = useSQLiteQuery<Card>(cardsSQL, cardsParams, {
    transform: cardTransform,
  });

  // Discover unique facet values for columns
  // This gives us the column order and ensures we have all possible values
  const facetSQL = useMemo(() => {
    return `SELECT DISTINCT ${columnColumn} as value FROM cards WHERE deleted_at IS NULL AND ${columnColumn} IS NOT NULL ORDER BY ${columnColumn}`;
  }, [columnColumn]);

  const { data: facetValues } = useSQLiteQuery<string>(facetSQL, [], {
    transform: extractValues,
  });

  const cardList = cards ?? [];
  const columnValues = facetValues ?? [];

  // Group cards by facet value
  const cardsByColumn = useMemo(() => {
    const groups = new Map<string, Card[]>();

    // Initialize columns with empty arrays
    for (const value of columnValues) {
      groups.set(value, []);
    }

    // Add uncategorized column for null values
    groups.set('(Uncategorized)', []);

    // Distribute cards to columns
    for (const card of cardList) {
      const facetValue = (card as unknown as Record<string, unknown>)[columnFacet];
      const key = facetValue != null ? String(facetValue) : '(Uncategorized)';

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(card);
    }

    // Remove uncategorized if empty
    if (groups.get('(Uncategorized)')?.length === 0) {
      groups.delete('(Uncategorized)');
    }

    return groups;
  }, [cardList, columnValues, columnFacet]);

  // Column keys in order
  const sortedColumns = useMemo(() => {
    const keys = Array.from(cardsByColumn.keys());
    // Move uncategorized to end
    const uncatIndex = keys.indexOf('(Uncategorized)');
    if (uncatIndex > -1) {
      keys.splice(uncatIndex, 1);
      keys.push('(Uncategorized)');
    }
    return keys;
  }, [cardsByColumn]);

  // Scroll to node implementation
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToNode = useCallback(
    (id: string) => {
      // Find which column contains the card
      for (const [columnKey, columnCards] of cardsByColumn.entries()) {
        const cardIndex = columnCards.findIndex((c) => c.id === id);
        if (cardIndex >= 0) {
          // Find the column element and scroll into view
          const columnIndex = sortedColumns.indexOf(columnKey);
          const container = containerRef.current;
          if (container) {
            const columnEls = container.querySelectorAll('[data-column-id]');
            const columnEl = columnEls[columnIndex];
            if (columnEl) {
              columnEl.scrollIntoView({ behavior: 'smooth', inline: 'center' });
              // Could also scroll to card within column if needed
            }
          }
          break;
        }
      }
    },
    [cardsByColumn, sortedColumns]
  );

  // Register scrollToNode for cross-canvas sync
  useEffect(() => {
    registerScrollToNode(scrollToNode);
    return () => unregisterScrollToNode();
  }, [scrollToNode, registerScrollToNode, unregisterScrollToNode]);

  const handleCardClick = useCallback(
    (cardId: string) => {
      select(cardId);
    },
    [select]
  );

  return (
    <div
      ref={containerRef}
      className="kanban-view h-full overflow-x-auto overflow-y-hidden"
      style={{
        display: 'grid',
        gridAutoFlow: 'column',
        gridAutoColumns: 'min-content',
        gap: 'var(--iso-kanban-col-gap, 12px)',
        padding: '16px',
        alignItems: 'stretch',
      }}
    >
      {sortedColumns.map((columnKey) => {
        const columnCards = cardsByColumn.get(columnKey) ?? [];
        // For uncategorized, we need to handle the null/empty value case
        const facetValue = columnKey === '(Uncategorized)' ? '' : columnKey;

        return (
          <KanbanColumn
            key={columnKey}
            columnId={columnKey}
            facetValue={facetValue}
            facetColumn={columnColumn}
            cards={columnCards}
            onCardClick={handleCardClick}
            isCardSelected={isSelected}
          />
        );
      })}

      {/* Empty state */}
      {sortedColumns.length === 0 && (
        <div className="flex items-center justify-center w-full h-full text-muted-foreground">
          No cards to display
        </div>
      )}
    </div>
  );
}
