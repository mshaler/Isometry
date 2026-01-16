/**
 * AccordionSection Component
 *
 * Theme-aware collapsible section with chevron toggle.
 * Extracted pattern from Sidebar and RightSidebar filter panels.
 */

import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// ============================================
// Types
// ============================================

export interface AccordionSectionProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  className?: string;
}

// ============================================
// Component
// ============================================

export function AccordionSection({
  title,
  icon,
  badge,
  children,
  defaultExpanded = true,
  expanded: controlledExpanded,
  onToggle,
  className = '',
}: AccordionSectionProps) {
  const { theme } = useTheme();
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  // Support both controlled and uncontrolled modes
  const expanded = controlledExpanded ?? internalExpanded;

  const handleToggle = () => {
    const newExpanded = !expanded;
    if (controlledExpanded === undefined) {
      setInternalExpanded(newExpanded);
    }
    onToggle?.(newExpanded);
  };

  const headerStyles =
    theme === 'NeXTSTEP'
      ? `
        bg-[#c0c0c0]
        border-b border-[#707070]
        hover:bg-[#c8c8c8]
      `
      : `
        bg-gray-50
        border-b border-gray-200
        hover:bg-gray-100
      `;

  const titleStyles =
    theme === 'NeXTSTEP'
      ? 'text-xs font-medium text-[#404040]'
      : 'text-xs font-semibold text-gray-700';

  const chevronStyles =
    theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-400';

  const contentStyles =
    theme === 'NeXTSTEP'
      ? 'bg-[#d4d4d4]'
      : 'bg-white';

  return (
    <div className={`${className}`}>
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className={`
          w-full px-3 py-2
          flex items-center gap-2
          ${headerStyles}
          cursor-pointer
          transition-colors duration-150
        `}
        aria-expanded={expanded}
      >
        <ChevronRight
          className={`
            w-3.5 h-3.5 flex-shrink-0
            transition-transform duration-200
            ${expanded ? 'rotate-90' : ''}
            ${chevronStyles}
          `}
        />
        {icon && (
          <span
            className={`w-4 h-4 ${
              theme === 'NeXTSTEP' ? 'text-[#606060]' : 'text-gray-500'
            }`}
          >
            {icon}
          </span>
        )}
        <span className={`flex-1 text-left ${titleStyles}`}>{title}</span>
        {badge && <span className="flex-shrink-0">{badge}</span>}
      </button>

      {/* Content */}
      <div
        className={`
          overflow-hidden
          transition-all duration-200 ease-in-out
          ${expanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className={`${contentStyles} p-3`}>{children}</div>
      </div>
    </div>
  );
}

export default AccordionSection;
