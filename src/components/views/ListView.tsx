/**
 * ListView — Hierarchical tree view for the Grid Continuum
 *
 * 1-axis entry in the Grid Continuum. Cards are grouped by folder (PAFV
 * hierarchy axis, MVP default). Supports expand/collapse interaction and
 * full keyboard accessibility per WAI-ARIA tree pattern.
 *
 * Integrates with:
 * - FilterContext (LATCH filters → SQL WHERE)
 * - SelectionContext (single selection + scrollToNode registration)
 * - useSQLiteQuery (sql.js direct query)
 * - useVirtualizedList (TanStack Virtual, 500+ items @ 60fps)
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useFilters } from '@/state/FilterContext';
import { useSelection } from '@/state/SelectionContext';
import { compileFilters } from '@/filters/compiler';
import { useSQLiteQuery } from '@/hooks/database/useSQLiteQuery';
import { useVirtualizedList } from '@/hooks/performance/useVirtualizedList';
import { rowToCard, type Card } from '@/types/card';
import { ListRow } from './ListRow';
import '@/styles/primitives-list.css';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface FlatItem {
  type: 'group' | 'card';
  key: string;
  card?: Card;
  groupKey?: string;
  groupCount?: number;
}

// Stable transform function (outside component to avoid useSQLiteQuery re-runs)
const transformCards = (rows: Record<string, unknown>[]) => rows.map(rowToCard);

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export function ListView() {
  const { activeFilters } = useFilters();
  const { select, isSelected, registerScrollToNode, unregisterScrollToNode } = useSelection();

  // Expand/collapse state (all groups start collapsed)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [focusedIndex, setFocusedIndex] = useState(0);

  // ─── Data fetching ───────────────────────────────────────────────────────
  const { sql, params } = useMemo(() => {
    const compiled = compileFilters(activeFilters);
    return {
      sql: `SELECT * FROM cards WHERE ${compiled.sql} ORDER BY folder, sort_order, name`,
      params: compiled.params,
    };
  }, [activeFilters]);

  const { data: cards } = useSQLiteQuery<Card>(sql, params, {
    transform: transformCards,
  });

  // ─── Grouping by folder ──────────────────────────────────────────────────
  const groups = useMemo(() => {
    if (!cards) return [];
    const grouped = new Map<string, Card[]>();
    for (const card of cards) {
      const folder = card.folder ?? '(No Folder)';
      if (!grouped.has(folder)) grouped.set(folder, []);
      grouped.get(folder)!.push(card);
    }
    return Array.from(grouped.entries()).map(([key, items]) => ({ key, items }));
  }, [cards]);

  // ─── Flat item list for virtualization ───────────────────────────────────
  const flatItems = useMemo<FlatItem[]>(() => {
    const result: FlatItem[] = [];
    for (const group of groups) {
      result.push({
        type: 'group',
        key: `group:${group.key}`,
        groupKey: group.key,
        groupCount: group.items.length,
      });
      if (expandedGroups.has(group.key)) {
        for (const card of group.items) {
          result.push({ type: 'card', key: `card:${card.id}`, card });
        }
      }
    }
    return result;
  }, [groups, expandedGroups]);

  // ─── Toggle group expansion ───────────────────────────────────────────────
  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  // ─── Virtual scrolling ───────────────────────────────────────────────────
  const { containerRef, virtualItems, totalSize, scrollToIndex } = useVirtualizedList(
    flatItems.length,
    { containerHeight: 600, estimateSize: 44, overscan: 10 }
  );

  // Keep focused item in viewport
  useEffect(() => {
    scrollToIndex(focusedIndex, { align: 'auto' });
  }, [focusedIndex, scrollToIndex]);

  // ─── Register scrollToNode with SelectionContext ─────────────────────────
  useEffect(() => {
    registerScrollToNode((id: string) => {
      const index = flatItems.findIndex(
        item => item.type === 'card' && item.card?.id === id
      );
      if (index >= 0) scrollToIndex(index);
    });
    return () => unregisterScrollToNode();
  }, [flatItems, scrollToIndex, registerScrollToNode, unregisterScrollToNode]);

  // ─── Keyboard navigation (WAI-ARIA tree pattern) ─────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(i => Math.min(i + 1, flatItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(i => Math.max(i - 1, 0));
        break;
      case 'ArrowRight': {
        const item = flatItems[focusedIndex];
        if (item?.type === 'group' && !expandedGroups.has(item.groupKey!)) {
          toggleGroup(item.groupKey!);
        }
        break;
      }
      case 'ArrowLeft': {
        const item = flatItems[focusedIndex];
        if (item?.type === 'group' && expandedGroups.has(item.groupKey!)) {
          toggleGroup(item.groupKey!);
        }
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const item = flatItems[focusedIndex];
        if (item?.type === 'card' && item.card) {
          select(item.card.id);
        } else if (item?.type === 'group') {
          toggleGroup(item.groupKey!);
        }
        break;
      }
    }
  }, [flatItems, focusedIndex, expandedGroups, toggleGroup, select]);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      role="tree"
      aria-label="List view"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="overflow-auto h-full focus:outline-none"
    >
      <div style={{ height: totalSize, position: 'relative' }}>
        {virtualItems.map(virtualItem => {
          const item = flatItems[virtualItem.index];
          if (!item) return null;
          const level = item.type === 'group' ? 0 : 1;
          const groupForCard = item.type === 'card'
            ? groups.find(g => g.key === (item.card?.folder ?? '(No Folder)'))
            : null;
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                transform: `translateY(${virtualItem.start}px)`,
                width: '100%',
              }}
            >
              <ListRow
                type={item.type}
                card={item.card}
                groupKey={item.groupKey}
                groupCount={item.groupCount}
                expanded={
                  item.type === 'group'
                    ? expandedGroups.has(item.groupKey!)
                    : undefined
                }
                onToggle={
                  item.type === 'group'
                    ? () => toggleGroup(item.groupKey!)
                    : undefined
                }
                selected={
                  item.type === 'card' && item.card
                    ? isSelected(item.card.id)
                    : false
                }
                onClick={
                  item.type === 'card' && item.card
                    ? () => select(item.card!.id)
                    : () => {}
                }
                level={level}
                focused={virtualItem.index === focusedIndex}
                ariaProps={{
                  'aria-level': level + 1,
                  'aria-setsize':
                    item.type === 'group'
                      ? groups.length
                      : (groupForCard?.items.length ?? 0),
                  'aria-posinset': virtualItem.index + 1,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
