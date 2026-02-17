/**
 * GalleryCard — Individual card renderer for Gallery view
 *
 * Uses CSS custom properties from primitives-gallery.css for dimensions.
 * Supports selection highlighting, tag pills, and priority indicator.
 */
import { cn } from '@/lib/utils';
import type { Card } from '@/types/card';

interface GalleryCardProps {
  card: Card;
  selected: boolean;
  onClick: () => void;
}

export function GalleryCard({ card, selected, onClick }: GalleryCardProps) {
  const hasTags = card.tags && card.tags.length > 0;

  return (
    <div
      className={cn(
        'relative cursor-pointer transition-transform hover:scale-[1.02]',
        'bg-card border border-border overflow-hidden shrink-0',
        'rounded-[var(--iso-gallery-card-radius,8px)]',
        selected && 'ring-2 ring-primary'
      )}
      style={{
        width: 'var(--iso-gallery-card-w, 220px)',
        height: 'var(--iso-gallery-card-h, 160px)',
        padding: 'var(--iso-gallery-card-pad, 16px)',
      }}
      data-selected={selected || undefined}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Priority indicator */}
      {card.priority > 0 && (
        <div
          className="absolute top-0 left-0 w-1 h-full rounded-l-[var(--iso-gallery-card-radius,8px)]"
          style={{
            backgroundColor: card.priority >= 3 ? 'var(--color-error, #ef4444)' :
              card.priority === 2 ? 'var(--color-warning, #f59e0b)' :
              'var(--color-info, #3b82f6)',
          }}
        />
      )}

      {/* Card name header */}
      <div className="font-medium text-sm text-card-foreground truncate mb-1">
        {card.name}
      </div>

      {/* Content preview */}
      {card.content && (
        <div className="text-xs text-muted-foreground line-clamp-3 flex-1">
          {card.content}
        </div>
      )}

      {/* Tag pills */}
      {hasTags && (
        <div className="absolute bottom-[var(--iso-gallery-card-pad,16px)] left-[var(--iso-gallery-card-pad,16px)] right-[var(--iso-gallery-card-pad,16px)] flex flex-wrap gap-1 overflow-hidden max-h-5">
          {card.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground truncate max-w-[80px]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
