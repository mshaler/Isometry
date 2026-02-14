/**
 * AuditToggle - Toolbar button for enabling/disabling audit highlighting
 *
 * SuperAudit toggle features:
 * - Visual indication of enabled/disabled state
 * - Blue styling when active (matching audit overlay colors)
 * - Gray styling when inactive
 * - Tooltip showing current mode
 *
 * Part of the Super* feature family for SuperGrid.
 */

import React from 'react';
import { Eye } from 'lucide-react';

/**
 * Props for the AuditToggle component.
 */
export interface AuditToggleProps {
  /** Whether audit highlighting is currently enabled */
  enabled: boolean;
  /** Callback when toggle is clicked */
  onToggle: (enabled: boolean) => void;
  /** Optional additional CSS class */
  className?: string;
}

/**
 * Toolbar toggle button for SuperAudit computed value highlighting.
 *
 * Usage:
 * ```tsx
 * <AuditToggle
 *   enabled={isAuditEnabled}
 *   onToggle={(enabled) => superGridEngine.setAuditEnabled(enabled)}
 * />
 * ```
 */
export function AuditToggle({
  enabled,
  onToggle,
  className = '',
}: AuditToggleProps): React.ReactElement {
  const handleClick = () => {
    onToggle(!enabled);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-md text-sm
        transition-colors duration-150
        ${enabled
          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }
        ${className}
      `.trim()}
      title={enabled
        ? 'Audit mode enabled - showing computed value highlighting'
        : 'Enable audit mode to highlight computed values'
      }
      aria-pressed={enabled}
      aria-label="Toggle computed value highlighting"
    >
      <Eye className="w-4 h-4" aria-hidden="true" />
      <span>Audit</span>
    </button>
  );
}

