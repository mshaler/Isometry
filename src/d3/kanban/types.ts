/**
 * Type definitions for KanbanView
 */

import type { Node } from '../../types/node';

/**
 * Internal interface for kanban columns
 */
export interface KanbanColumn {
  id: string;
  title: string;
  cards: Node[];
  facetValue: string | null;
}

/**
 * Internal interface for flattened cards with position data
 */
export interface FlattenedCard {
  card: Node;
  x: number;
  y: number;
  columnIndex: number;
  cardIndex: number;
}

/**
 * Kanban layout configuration
 */
export interface KanbanConfig {
  cardWidth: number;
  cardHeight: number;
  columnWidth: number;
  columnSpacing: number;
  cardSpacing: number;
  padding: { top: number; right: number; bottom: number; left: number };
  headerHeight: number;
}