import { useState, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppState } from '@/contexts/AppStateContext';
import { useFilters } from '@/contexts/FilterContext';
import { useSQLiteQuery } from '@/hooks/useSQLiteQuery';
import {
  ListView,
  GridView,
  KanbanView,
  TimelineView,
  CalendarView,
  ChartsView,
  NetworkView,
  TreeView,
} from './views';
import type { CardData } from '@/types/CardData';

export function Canvas() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const tabs = ['Tab 1', 'Tab 2', 'Tab 3'];
  const { theme } = useTheme();
  const { activeView, activeDataset } = useAppState();
  const { compiledQuery } = useFilters();

  // Query cards from SQLite with filters
  const { data: cards, loading, error } = useSQLiteQuery<CardData>(
    `SELECT * FROM cards WHERE dataset_id = ? AND (${compiledQuery.sql})`,
    [activeDataset.toLowerCase(), ...compiledQuery.params]
  );

  const handleCardClick = useCallback((card: CardData) => {
    setSelectedCard(card);
    // Could open a detail panel, modal, etc.
    console.log('Card clicked:', card);
  }, []);

  // Render the appropriate view based on activeView
  const renderView = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          Loading cards...
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-red-500">
          Error: {error.message}
        </div>
      );
    }

    if (!cards || cards.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          No cards found
        </div>
      );
    }

    switch (activeView) {
      case 'List':
        return <ListView data={cards} onCardClick={handleCardClick} />;

      case 'Gallery':
      case 'Grid':
        return <GridView data={cards} onCardClick={handleCardClick} />;

      case 'Kanban':
        return <KanbanView data={cards} onCardClick={handleCardClick} />;

      case 'Timeline':
        return <TimelineView data={cards} onCardClick={handleCardClick} />;

      case 'Calendar':
        return <CalendarView data={cards} onCardClick={handleCardClick} />;

      case 'Charts':
        return <ChartsView data={cards} onCardClick={handleCardClick} />;

      case 'Graphs':
        return <NetworkView data={cards} onCardClick={handleCardClick} />;

      case 'Tree':
        return <TreeView data={cards} onCardClick={handleCardClick} />;

      default:
        // Default to List view
        return <ListView data={cards} onCardClick={handleCardClick} />;
    }
  };

  return (
    <div className={`flex-1 flex flex-col m-3 overflow-hidden ${
      theme === 'NeXTSTEP'
        ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
        : 'bg-white rounded-lg shadow-lg border border-gray-200'
    }`}>
      {/* Main Canvas Area */}
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>

      {/* Selected Card Info (optional mini-display) */}
      {selectedCard && (
        <div className={`h-8 flex items-center px-3 text-xs ${
          theme === 'NeXTSTEP'
            ? 'bg-[#d4d4d4] border-t border-[#808080]'
            : 'bg-gray-50 border-t border-gray-200'
        }`}>
          <span className="font-medium mr-2">Selected:</span>
          <span className="truncate">{selectedCard.name}</span>
          <button
            onClick={() => setSelectedCard(null)}
            className={`ml-auto px-2 ${
              theme === 'NeXTSTEP' ? 'hover:bg-[#c0c0c0]' : 'hover:bg-gray-200 rounded'
            }`}
          >
            ×
          </button>
        </div>
      )}

      {/* Sheet Tabs */}
      <div className={theme === 'NeXTSTEP'
        ? 'bg-[#c0c0c0] border-t-2 border-[#808080] flex items-end gap-0.5 px-2 pb-1 pt-2'
        : 'bg-gray-50 border-t border-gray-200 flex items-end gap-1 px-2 pb-1 pt-2'
      }>
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={theme === 'NeXTSTEP'
              ? `px-4 py-1.5 text-sm rounded-t ${
                  activeTab === index
                    ? 'bg-white border-t-2 border-l-2 border-r-2 border-[#808080]'
                    : 'bg-[#b0b0b0] border-t-2 border-l-2 border-r-2 border-[#707070] hover:bg-[#b8b8b8]'
                }`
              : `px-4 py-1.5 text-sm rounded-t-lg ${
                  activeTab === index
                    ? 'bg-white text-gray-900 border-t border-l border-r border-gray-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`
            }
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
