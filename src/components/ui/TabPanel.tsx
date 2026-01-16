/**
 * TabPanel Component
 *
 * Theme-aware tab navigation with icon support.
 * Extracted pattern from Sidebar and RightSidebar.
 */

import { useState, type ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================
// Types
// ============================================

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabPanelProps {
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
}

// ============================================
// Component
// ============================================

export function TabPanel({
  tabs,
  defaultTab,
  activeTab: controlledActiveTab,
  onTabChange,
  className = '',
}: TabPanelProps) {
  const { theme } = useTheme();
  const [internalActiveTab, setInternalActiveTab] = useState(
    defaultTab || tabs[0]?.id
  );

  // Support both controlled and uncontrolled modes
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabClick = (tabId: string) => {
    if (!controlledActiveTab) {
      setInternalActiveTab(tabId);
    }
    onTabChange?.(tabId);
  };

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  // Tab button styles
  const tabBaseStyles =
    theme === 'NeXTSTEP'
      ? `
        px-3 py-1.5 text-xs
        border-t-2 border-l-2 border-r-2
        border-b-0
        -mb-[2px]
      `
      : `
        px-3 py-1.5 text-xs font-medium
        rounded-t-lg
        -mb-px
      `;

  const tabActiveStyles =
    theme === 'NeXTSTEP'
      ? `
        bg-[#d4d4d4] text-[#404040]
        border-t-[#ffffff] border-l-[#ffffff] border-r-[#707070]
        z-10
      `
      : `
        bg-white text-gray-900
        border border-gray-200 border-b-white
      `;

  const tabInactiveStyles =
    theme === 'NeXTSTEP'
      ? `
        bg-[#b0b0b0] text-[#606060]
        border-t-[#d4d4d4] border-l-[#d4d4d4] border-r-[#707070]
        hover:bg-[#c0c0c0]
      `
      : `
        bg-gray-100 text-gray-600
        border border-transparent
        hover:bg-gray-200 hover:text-gray-900
      `;

  // Content panel styles
  const panelStyles =
    theme === 'NeXTSTEP'
      ? `
        bg-[#d4d4d4]
        border-2
        border-t-[#ffffff] border-l-[#ffffff]
        border-b-[#707070] border-r-[#707070]
      `
      : `
        bg-white
        border border-gray-200
        rounded-b-lg rounded-tr-lg
      `;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Tab list */}
      <div className="flex" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && handleTabClick(tab.id)}
            className={`
              ${tabBaseStyles}
              ${activeTab === tab.id ? tabActiveStyles : tabInactiveStyles}
              ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              flex items-center gap-1.5
              transition-colors duration-150
            `}
          >
            {tab.icon && <span className="w-3.5 h-3.5">{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={activeTab}
        className={`${panelStyles} flex-1 overflow-auto`}
      >
        {activeTabContent}
      </div>
    </div>
  );
}

export default TabPanel;
