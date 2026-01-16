/**
 * SettingsSection Component
 *
 * Expandable settings section with content placeholder.
 * Extracted from RightSidebar.tsx lines 61-105.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================
// Types
// ============================================

export interface SettingsSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

// ============================================
// Component
// ============================================

export function SettingsSection({
  title,
  expanded,
  onToggle,
  children,
}: SettingsSectionProps) {
  const { theme } = useTheme();

  const headerStyles =
    theme === 'NeXTSTEP'
      ? 'bg-[#a8a8a8] border-t-2 border-l-2 border-[#c8c8c8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050]'
      : 'bg-gray-100 hover:bg-gray-200 rounded-lg';

  const contentStyles =
    theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4] border border-[#a0a0a0]'
      : 'bg-white border border-gray-200 rounded-lg';

  const placeholderStyles =
    theme === 'NeXTSTEP' ? 'text-[#808080]' : 'text-gray-500';

  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className={`w-full h-8 px-2 flex items-center gap-2 ${headerStyles}`}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <span className="font-medium text-sm">{title}</span>
      </button>

      {expanded && (
        <div className={`mt-2 px-2 py-3 ${contentStyles}`}>
          {children || (
            <p className={`text-xs text-center ${placeholderStyles}`}>
              Coming soon...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default SettingsSection;
