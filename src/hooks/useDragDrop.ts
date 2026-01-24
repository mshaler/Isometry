/**
 * useDragDrop - Generic drag-and-drop hook for axis reordering
 *
 * Provides drag state management for HTML5 Drag and Drop API.
 * Used by AxisNavigator to drag LATCH axes to plane drop zones.
 *
 * @module hooks/useDragDrop
 */

import { useState, useCallback } from 'react';

export interface DragState {
  /** Currently dragged item ID (null if not dragging) */
  draggedId: string | null;

  /** Current drop zone being hovered over (null if none) */
  hoveredZone: string | null;
}

export interface UseDragDropResult {
  /** Current drag state */
  dragState: DragState;

  /** Start dragging an item */
  handleDragStart: (itemId: string) => (e: React.DragEvent) => void;

  /** End dragging */
  handleDragEnd: () => void;

  /** Enter a drop zone */
  handleDragEnter: (zoneId: string) => (e: React.DragEvent) => void;

  /** Leave a drop zone */
  handleDragLeave: (zoneId: string) => (e: React.DragEvent) => void;

  /** Allow drop on a zone */
  handleDragOver: (e: React.DragEvent) => void;

  /** Handle drop on a zone */
  handleDrop: (zoneId: string, onDrop: (itemId: string, zoneId: string) => void) => (e: React.DragEvent) => void;
}

/**
 * Hook for managing drag-and-drop interactions.
 *
 * @example
 * ```tsx
 * const { dragState, handleDragStart, handleDrop } = useDragDrop();
 *
 * // Draggable item
 * <div
 *   draggable
 *   onDragStart={handleDragStart('time')}
 *   className={dragState.draggedId === 'time' ? 'dragging' : ''}
 * >
 *   Time
 * </div>
 *
 * // Drop zone
 * <div
 *   onDragOver={handleDragOver}
 *   onDrop={handleDrop('x-axis', (itemId, zoneId) => {
 *     console.log(`Dropped ${itemId} on ${zoneId}`);
 *   })}
 * >
 *   X-Axis Drop Zone
 * </div>
 * ```
 */
export function useDragDrop(): UseDragDropResult {
  const [dragState, setDragState] = useState<DragState>({
    draggedId: null,
    hoveredZone: null,
  });

  // Start dragging
  const handleDragStart = useCallback((itemId: string) => {
    return (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', itemId);
      setDragState({ draggedId: itemId, hoveredZone: null });
    };
  }, []);

  // End dragging
  const handleDragEnd = useCallback(() => {
    setDragState({ draggedId: null, hoveredZone: null });
  }, []);

  // Enter drop zone
  const handleDragEnter = useCallback((zoneId: string) => {
    return (e: React.DragEvent) => {
      e.preventDefault();
      setDragState((prev) => ({ ...prev, hoveredZone: zoneId }));
    };
  }, []);

  // Leave drop zone
  const handleDragLeave = useCallback((zoneId: string) => {
    return (_e: React.DragEvent) => {
      // Only clear hover if leaving the specific zone
      setDragState((prev) => ({
        ...prev,
        hoveredZone: prev.hoveredZone === zoneId ? null : prev.hoveredZone,
      }));
    };
  }, []);

  // Allow drop (required for drop to work)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop
  const handleDrop = useCallback(
    (zoneId: string, onDrop: (itemId: string, zoneId: string) => void) => {
      return (e: React.DragEvent) => {
        e.preventDefault();
        const itemId = e.dataTransfer.getData('text/plain');
        if (itemId) {
          onDrop(itemId, zoneId);
        }
        setDragState({ draggedId: null, hoveredZone: null });
      };
    },
    []
  );

  return {
    dragState,
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
