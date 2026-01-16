/**
 * TextFormatPanel Component
 *
 * Text formatting options panel.
 * Extracted from RightSidebar.tsx lines 77-98.
 */

import { useTheme } from '@/contexts/ThemeContext';

// ============================================
// Component
// ============================================

export function TextFormatPanel() {
  const { theme } = useTheme();

  const inputStyles =
    theme === 'NeXTSTEP'
      ? 'w-full h-7 px-2 bg-white border-t-2 border-l-2 border-[#707070] border-b-2 border-r-2 border-b-[#e8e8e8] border-r-[#e8e8e8] text-sm'
      : 'w-full h-7 px-2 bg-white border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  const labelStyles = theme === 'NeXTSTEP' ? 'text-xs text-[#404040]' : 'text-xs text-gray-600';

  return (
    <div className="space-y-2">
      <div>
        <label className={`block mb-1 ${labelStyles}`}>Font Family</label>
        <select className={inputStyles}>
          <option>Helvetica</option>
          <option>Times</option>
          <option>Courier</option>
        </select>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={`block mb-1 ${labelStyles}`}>Size</label>
          <input type="number" defaultValue="12" className={inputStyles} />
        </div>
        <div className="flex-1">
          <label className={`block mb-1 ${labelStyles}`}>Color</label>
          <input type="color" defaultValue="#000000" className={inputStyles} />
        </div>
      </div>
    </div>
  );
}

export default TextFormatPanel;
