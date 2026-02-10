/**
 * Formatting utilities for KanbanView
 */

import type { Node } from '../../types/node';

/**
 * Get priority color for visual indicators
 */
export function getPriorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'high':
      return '#ef4444';
    case 'medium':
      return '#f59e0b';
    case 'low':
      return '#22c55e';
    default:
      return '#6b7280';
  }
}

/**
 * Format card metadata for display
 */
export function formatCardMetadata(card: Node): string {
  const parts: string[] = [];

  // Add modified date
  if (card.modifiedAt) {
    const date = new Date(card.modifiedAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      parts.push('Today');
    } else if (diffDays === 1) {
      parts.push('Yesterday');
    } else if (diffDays < 7) {
      parts.push(`${diffDays}d ago`);
    } else {
      parts.push(date.toLocaleDateString());
    }
  }

  // Add folder (always show for metadata)
  if (card.folder) {
    parts.push(card.folder);
  }

  return parts.join(' • ');
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}