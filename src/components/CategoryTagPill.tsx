/**
 * CategoryTagPill - Visual tag pill with color background
 *
 * Displays a tag name in a rounded pill shape with assigned color.
 * Shows selected state with border, supports click interaction.
 */

import { getContrastText } from '../utils/tag-colors';

export interface CategoryTagPillProps {
  /** Tag name to display */
  tag: string;

  /** Background color (hex string) */
  color: string;

  /** Whether tag is selected for filtering */
  selected: boolean;

  /** Click handler */
  onClick: () => void;

  /** Optional className for additional styling */
  className?: string;
}

/**
 * CategoryTagPill component
 */
export function CategoryTagPill({
  tag,
  color,
  selected,
  onClick,
  className = '',
}: CategoryTagPillProps) {
  const textColor = getContrastText(color);

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center
        px-3 py-1.5
        rounded-full
        text-sm font-medium
        transition-all duration-150
        hover:scale-105
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        ${selected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
        ${className}
      `}
      style={{
        backgroundColor: color,
        color: textColor,
        border: selected ? `2px solid ${textColor}` : 'none',
      }}
      aria-pressed={selected}
      aria-label={`${tag} tag ${selected ? '(selected)' : ''}`}
    >
      {tag}
    </button>
  );
}
