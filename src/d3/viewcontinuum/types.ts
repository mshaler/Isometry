/**
 * Types and interfaces for ViewContinuum
 */

import type { Node } from '../../types/node';
import type {
  ViewAxisMapping,
  CardPosition,
  ViewTransitionEvent
} from '../../types/views';

/**
 * @deprecated ViewRenderer interface replaced by IsometryViewEngine
 * Kept for backward compatibility during transition
 */
export interface ViewRenderer {
  render(cards: Node[], axisMapping: ViewAxisMapping, activeFilters: any[]): void;
  getCardPositions(): Map<string, CardPosition>;
  scrollToCard(cardId: string): void;
  destroy(): void;
}

/**
 * Event handlers for ViewContinuum
 */
export interface ViewContinuumCallbacks {
  onViewChange?: (event: ViewTransitionEvent) => void;
  onSelectionChange?: (selectedIds: string[], focusedId: string | null) => void;
  onCardClick?: (card: Node) => void;
  onFilterChange?: (filters: any[]) => void;
}

// Re-export CardPosition for external use
export type { CardPosition };