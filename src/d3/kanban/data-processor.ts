/**
 * Data processing utilities for KanbanView
 */

import type { Node } from '../../types/node';
import type { ViewAxisMapping } from '../../types/views';
import type { KanbanColumn, FlattenedCard } from './types';

/**
 * Group cards by column facet (x-axis mapping)
 */
export function groupCardsByFacet(cards: Node[], axisMapping: ViewAxisMapping): KanbanColumn[] {
  const xAxis = axisMapping.xAxis;

  if (!xAxis) {
    // Default to status grouping when no axis mapping
    return groupByStatus(cards);
  }

  const facet = xAxis.facet;

  // Group cards by facet value
  const groups = new Map<string, Node[]>();

  for (const card of cards) {
    const facetValue = getCardFacetValue(card, facet);
    const key = facetValue !== null && facetValue !== undefined ?
      String(facetValue) : 'No Value';

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(card);
  }

  // Convert to columns
  const columns: KanbanColumn[] = Array.from(groups.entries()).map(([key, cards]) => ({
    id: key,
    title: formatColumnTitle(key, facet),
    cards,
    facetValue: key === 'No Value' ? null : key
  }));

  // Sort columns by logical order
  sortColumnsByLogicalOrder(columns, facet);

  // Apply sort to cards within columns
  applySortToColumns(columns, axisMapping);

  return columns;
}

/**
 * Group cards by status (default kanban mode)
 */
export function groupByStatus(cards: Node[]): KanbanColumn[] {
  const statusGroups = new Map<string, Node[]>();

  for (const card of cards) {
    const status = card.status || 'No Status';
    if (!statusGroups.has(status)) {
      statusGroups.set(status, []);
    }
    statusGroups.get(status)!.push(card);
  }

  const columns = Array.from(statusGroups.entries()).map(([status, cards]) => ({
    id: status,
    title: formatStatus(status),
    cards,
    facetValue: status === 'No Status' ? null : status
  }));

  // Sort by typical kanban status progression
  const statusOrder = ['backlog', 'todo', 'in-progress', 'review', 'done'];
  columns.sort((a, b) => {
    const aIndex = statusOrder.indexOf(a.id.toLowerCase());
    const bIndex = statusOrder.indexOf(b.id.toLowerCase());
    if (aIndex === -1 && bIndex === -1) return a.title.localeCompare(b.title);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return columns;
}

/**
 * Apply sorting to cards within columns based on axis mapping
 */
export function applySortToColumns(columns: KanbanColumn[], axisMapping: ViewAxisMapping): void {
  const yAxis = axisMapping.yAxis;

  if (!yAxis) {
    // Default sort by modified date (newest first)
    for (const column of columns) {
      column.cards.sort((a, b) => {
        const aDate = new Date(a.modifiedAt || 0);
        const bDate = new Date(b.modifiedAt || 0);
        return bDate.getTime() - aDate.getTime();
      });
    }
    return;
  }

  const sortFacet = yAxis.facet;

  for (const column of columns) {
    column.cards.sort((a, b) => {
      const aValue = getCardFacetValue(a, sortFacet);
      const bValue = getCardFacetValue(b, sortFacet);

      // Handle priority sorting (special case)
      if (sortFacet === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[aValue as keyof typeof priorityOrder] || 0;
        const bPriority = priorityOrder[bValue as keyof typeof priorityOrder] || 0;
        return bPriority - aPriority; // High to low
      }

      // Handle date sorting
      if (sortFacet.includes('date') || sortFacet.includes('At')) {
        const aDate = new Date((aValue as string | number) || 0);
        const bDate = new Date((bValue as string | number) || 0);
        return bDate.getTime() - aDate.getTime(); // Newest first
      }

      // Default string comparison
      const aStr = aValue ? String(aValue) : '';
      const bStr = bValue ? String(bValue) : '';
      return aStr.localeCompare(bStr);
    });
  }
}

/**
 * Flatten cards with their calculated positions
 */
export function flattenCardsWithPositions(
  columns: KanbanColumn[],
  config: {
    cardWidth: number; cardHeight: number; columnWidth: number;
    columnSpacing: number; cardSpacing: number;
    padding: { top: number; right: number; bottom: number; left: number }
  }
): FlattenedCard[] {
  const flattened: FlattenedCard[] = [];

  columns.forEach((column, columnIndex) => {
    const columnX = config.padding.left + columnIndex * (config.columnWidth + config.columnSpacing);

    column.cards.forEach((card, cardIndex) => {
      const cardY = config.padding.top + 60 + cardIndex * (config.cardHeight + config.cardSpacing); // 60 for header

      flattened.push({
        card,
        x: columnX + (config.columnWidth - config.cardWidth) / 2, // Center in column
        y: cardY,
        columnIndex,
        cardIndex
      });
    });
  });

  return flattened;
}

/**
 * Get value for a specific facet from a card
 */
export function getCardFacetValue(card: Node, facet: string): unknown {
  return (card as any)[facet] || null;
}

/**
 * Format column title for display
 */
export function formatColumnTitle(value: string, facet: string): string {
  if (facet === 'status') {
    return formatStatus(value);
  }

  if (facet === 'priority') {
    return formatPriority(value);
  }

  // Default: capitalize first letter
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Format status values for display
 */
export function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'todo': 'To Do',
    'in-progress': 'In Progress',
    'in_progress': 'In Progress',
    'review': 'In Review',
    'done': 'Completed',
    'backlog': 'Backlog',
    'blocked': 'Blocked',
    'cancelled': 'Cancelled',
    'No Status': 'Uncategorized'
  };

  return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Format priority values for display
 */
export function formatPriority(priority: string): string {
  const priorityMap: Record<string, string> = {
    'high': 'High Priority',
    'medium': 'Medium Priority',
    'low': 'Low Priority'
  };

  return priorityMap[priority] || priority.charAt(0).toUpperCase() + priority.slice(1);
}

/**
 * Sort columns by logical order based on facet type
 */
export function sortColumnsByLogicalOrder(columns: KanbanColumn[], facet: string): void {
  if (facet === 'status') {
    // Standard kanban progression
    const statusOrder = ['backlog', 'todo', 'in-progress', 'review', 'done', 'cancelled'];
    columns.sort((a, b) => {
      const aIndex = statusOrder.indexOf(a.id.toLowerCase());
      const bIndex = statusOrder.indexOf(b.id.toLowerCase());
      if (aIndex === -1 && bIndex === -1) return a.title.localeCompare(b.title);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  } else if (facet === 'priority') {
    // High to low priority
    const priorityOrder = ['high', 'medium', 'low'];
    columns.sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a.id.toLowerCase());
      const bIndex = priorityOrder.indexOf(b.id.toLowerCase());
      if (aIndex === -1 && bIndex === -1) return a.title.localeCompare(b.title);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  } else {
    // Alphabetical for other facets
    columns.sort((a, b) => a.title.localeCompare(b.title));
  }
}