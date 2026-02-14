/**
 * BacklinksPanel Component
 *
 * Displays cards that link to the currently active card.
 * Enables Obsidian-style graph navigation by showing reverse relationships.
 */

import { useEffect, useState, useCallback } from 'react';
import { Link2, ChevronRight, FileText } from 'lucide-react';
import { useSQLite } from '@/db/SQLiteProvider';
import { useNotebook } from '@/contexts/NotebookContext';
import { useTheme } from '@/contexts/ThemeContext';
import { queryBacklinks, type BacklinkInfo } from '@/utils/editor/backlinks';

const BACKLINKS_LIMIT = 50;

export function BacklinksPanel() {
  const { db } = useSQLite();
  const { activeCard, loadCard } = useNotebook();
  const { theme } = useTheme();
  const [backlinks, setBacklinks] = useState<BacklinkInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // Get the card ID to query backlinks for
  // activeCard has both id (notebook_cards.id) and nodeId (nodes.id)
  // Edges reference nodes.id, so we use nodeId
  const cardId = activeCard?.nodeId || activeCard?.id;

  // Load backlinks when active card changes
  useEffect(() => {
    if (!db || !cardId) {
      setBacklinks([]);
      return;
    }

    setLoading(true);
    try {
      const results = queryBacklinks(db, cardId, BACKLINKS_LIMIT);
      setBacklinks(results);
    } catch (error) {
      console.error('Failed to load backlinks:', error);
      setBacklinks([]);
    } finally {
      setLoading(false);
    }
  }, [db, cardId]);

  // Navigate to a linked card
  const handleBacklinkClick = useCallback((backlinkId: string) => {
    loadCard(backlinkId);
  }, [loadCard]);

  // Format date for display
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return dateStr;
    }
  };

  // Theme-aware styling
  const containerClass = theme === 'NeXTSTEP'
    ? 'p-3 h-full overflow-y-auto'
    : 'p-3 h-full overflow-y-auto';

  const headerClass = theme === 'NeXTSTEP'
    ? 'flex items-center gap-2 mb-3 pb-2 border-b border-[#707070]'
    : 'flex items-center gap-2 mb-3 pb-2 border-b border-gray-200';

  const badgeClass = theme === 'NeXTSTEP'
    ? 'px-1.5 py-0.5 text-xs font-medium bg-[#707070] text-white'
    : 'px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full';

  const itemClass = theme === 'NeXTSTEP'
    ? 'flex items-center gap-2 p-2 hover:bg-[#a0a0a0] cursor-pointer border-b border-[#d0d0d0] last:border-b-0'
    : 'flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors';

  const nameClass = theme === 'NeXTSTEP'
    ? 'flex-1 text-sm font-medium truncate'
    : 'flex-1 text-sm font-medium text-gray-900 truncate';

  const dateClass = theme === 'NeXTSTEP'
    ? 'text-xs text-[#505050]'
    : 'text-xs text-gray-500';

  const emptyClass = theme === 'NeXTSTEP'
    ? 'text-center py-8 text-[#505050]'
    : 'text-center py-8 text-gray-500';

  // No card selected state
  if (!cardId) {
    return (
      <div className={containerClass}>
        <div className={headerClass}>
          <Link2 className="w-4 h-4" />
          <span className="font-medium text-sm">Backlinks</span>
        </div>
        <div className={emptyClass}>
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No card selected</p>
          <p className="text-xs mt-1 opacity-75">Select a card to see its backlinks</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={containerClass}>
        <div className={headerClass}>
          <Link2 className="w-4 h-4" />
          <span className="font-medium text-sm">Backlinks</span>
        </div>
        <div className={emptyClass}>
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // No backlinks state
  if (backlinks.length === 0) {
    return (
      <div className={containerClass}>
        <div className={headerClass}>
          <Link2 className="w-4 h-4" />
          <span className="font-medium text-sm">Backlinks</span>
          <span className={badgeClass}>0</span>
        </div>
        <div className={emptyClass}>
          <Link2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No cards link to this one yet</p>
          <p className="text-xs mt-1 opacity-75">
            Create [[wiki links]] in other cards to see them here
          </p>
        </div>
      </div>
    );
  }

  // Backlinks list
  return (
    <div className={containerClass}>
      <div className={headerClass}>
        <Link2 className="w-4 h-4" />
        <span className="font-medium text-sm">Backlinks</span>
        <span className={badgeClass}>{backlinks.length}</span>
        {backlinks.length >= BACKLINKS_LIMIT && (
          <span className="text-xs opacity-60">+</span>
        )}
      </div>
      <div className="space-y-1">
        {backlinks.map((backlink) => (
          <div
            key={backlink.id}
            className={itemClass}
            onClick={() => handleBacklinkClick(backlink.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleBacklinkClick(backlink.id);
              }
            }}
          >
            <FileText className="w-4 h-4 flex-shrink-0 opacity-60" />
            <span className={nameClass} title={backlink.name}>
              {backlink.name || 'Untitled'}
            </span>
            <span className={dateClass}>{formatDate(backlink.createdAt)}</span>
            <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
