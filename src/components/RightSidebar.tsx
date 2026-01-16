/**
 * RightSidebar Component
 *
 * Formats and Settings panel using TabPanel and AccordionSection primitives.
 */

import { useState } from 'react';
import { Palette, Settings as SettingsIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { TabPanel, type Tab } from '@/components/ui/TabPanel';
import { AccordionSection } from '@/components/ui/AccordionSection';

// ============================================
// Types
// ============================================

type TabType = 'formats' | 'settings';

// ============================================
// Section Content Components
// ============================================

function TextFormatContent() {
  const { theme } = useTheme();

  const inputClass =
    theme === 'NeXTSTEP'
      ? 'w-full h-7 px-2 bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8] text-sm'
      : 'w-full h-7 px-2 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs block mb-1">Font Family</label>
        <select className={inputClass}>
          <option>Helvetica</option>
          <option>Times</option>
          <option>Courier</option>
        </select>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs block mb-1">Size</label>
          <input type="number" defaultValue="12" className={inputClass} />
        </div>
        <div className="flex-1">
          <label className="text-xs block mb-1">Color</label>
          <input type="color" defaultValue="#000000" className={inputClass} />
        </div>
      </div>
    </div>
  );
}

function PlaceholderContent() {
  return <p className="text-xs text-center text-gray-500">Coming soon...</p>;
}

// ============================================
// Main Component
// ============================================

export function RightSidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('formats');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['View', 'Cell', 'Text'])
  );
  const { theme } = useTheme();

  const formatSections = ['View', 'Cell', 'Text', 'Arrange', 'Conditional Formatting…'];
  const settingsSections = ['General', 'ETL Datasets', 'Toolbars', 'Formats', 'Views', 'Security'];

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedSections(newExpanded);
  };

  const renderSectionContent = (section: string, isFormats: boolean) => {
    if (isFormats && section === 'Text') {
      return <TextFormatContent />;
    }
    return <PlaceholderContent />;
  };

  const renderSections = (sections: string[], isFormats: boolean) => (
    <>
      {sections.map((section) => (
        <AccordionSection
          key={section}
          title={section}
          expanded={expandedSections.has(section)}
          onToggle={() => toggleSection(section)}
          className="mb-2"
        >
          {renderSectionContent(section, isFormats)}
        </AccordionSection>
      ))}
    </>
  );

  const tabs: Tab[] = [
    {
      id: 'formats',
      label: 'Formats',
      icon: <Palette className="w-4 h-4" />,
      content: <div className="p-2">{renderSections(formatSections, true)}</div>,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon className="w-4 h-4" />,
      content: <div className="p-2">{renderSections(settingsSections, false)}</div>,
    },
  ];

  return (
    <div
      className={`w-64 h-full flex flex-col ${
        theme === 'NeXTSTEP'
          ? 'bg-[#c0c0c0] border-l-2 border-[#e8e8e8]'
          : 'bg-white/80 backdrop-blur-xl border-l border-gray-200'
      }`}
    >
      <TabPanel
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as TabType)}
        className="flex-1 flex flex-col"
      />
    </div>
  );
}
