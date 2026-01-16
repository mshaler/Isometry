import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppState } from '@/contexts/AppStateContext';
import { useFilters } from '@/contexts/FilterContext';
import { useSQLiteQuery } from '@/hooks/useSQLiteQuery';

interface CardData {
  id: string;
  name: string;
  content: string;
  category: string;
  status: string;
  priority: number;
}

export function Canvas() {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = ['Tab 1', 'Tab 2', 'Tab 3'];
  const { theme } = useTheme();
  const { activeDataset } = useAppState();
  const { compiledQuery } = useFilters();

  // Query cards from SQLite with filters
  const { data: cards, loading, error } = useSQLiteQuery<CardData>(
    `SELECT * FROM cards WHERE dataset_id = ? AND (${compiledQuery.sql})`,
    [activeDataset.toLowerCase(), ...compiledQuery.params]
  );

  return (
    <div className={`flex-1 flex flex-col m-3 overflow-hidden ${
      theme === 'NeXTSTEP'
        ? 'bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8]'
        : 'bg-white rounded-lg shadow-lg border border-gray-200'
    }`}>
      {/* Main Canvas Area */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading cards...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full text-red-500">
            Error: {error.message}
          </div>
        )}
        {!loading && !error && cards && cards.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            No cards found
          </div>
        )}
        {!loading && !error && cards && cards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map(card => (
              <div
                key={card.id}
                className={`p-4 ${
                  theme === 'NeXTSTEP'
                    ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
                    : 'bg-white rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow'
                }`}
              >
                <h3 className="font-medium text-sm mb-1">{card.name}</h3>
                {card.content && (
                  <p className="text-xs text-gray-600 mb-2">{card.content}</p>
                )}
                <div className="flex gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#a0a0a0]'
                      : 'bg-blue-100 text-blue-700'
                  }`}>{card.category}</span>
                  <span className={`px-2 py-0.5 rounded ${
                    theme === 'NeXTSTEP'
                      ? 'bg-[#a0a0a0]'
                      : 'bg-gray-100 text-gray-600'
                  }`}>{card.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
