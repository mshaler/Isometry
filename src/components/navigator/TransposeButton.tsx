/**
 * TransposeButton Component
 *
 * Quick action button to swap X and Y axis mappings.
 * Visual spec per Figma: 24x24px, ArrowLeftRight icon, positioned between X/Y wells.
 */

import { ArrowLeftRight } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePAFV } from '@/state/PAFVContext';

export function TransposeButton() {
  const { theme } = useTheme();
  const { state, setMapping, removeMapping } = usePAFV();

  const handleTranspose = () => {
    // Get current X and Y mappings
    const xMapping = state.mappings.find(m => m.plane === 'x');
    const yMapping = state.mappings.find(m => m.plane === 'y');

    // If neither axis is mapped, nothing to do
    if (!xMapping && !yMapping) return;

    // Swap: X → Y, Y → X
    if (xMapping && yMapping) {
      // Both are mapped - swap them
      setMapping({ ...xMapping, plane: 'y' });
      setMapping({ ...yMapping, plane: 'x' });
    } else if (xMapping && !yMapping) {
      // Only X is mapped - move to Y
      removeMapping('x');
      setMapping({ ...xMapping, plane: 'y' });
    } else if (!xMapping && yMapping) {
      // Only Y is mapped - move to X
      removeMapping('y');
      setMapping({ ...yMapping, plane: 'x' });
    }
  };

  // Theme-aware styling
  const isNeXTSTEP = theme === 'NeXTSTEP';

  return (
    <button
      onClick={handleTranspose}
      className={`
        w-6 h-6 flex items-center justify-center rounded
        transition-colors
        ${isNeXTSTEP
          ? 'bg-[#d4d4d4] border-t border-l border-[#ffffff] border-b border-r border-b-[#707070] border-r-[#707070] hover:bg-[#e0e0e0]'
          : 'bg-gray-100 hover:bg-blue-100 border border-gray-200 hover:border-blue-300'
        }
      `}
      title="Transpose X and Y axes"
      type="button"
    >
      <ArrowLeftRight className={`w-3.5 h-3.5 ${isNeXTSTEP ? 'text-[#404040]' : 'text-gray-600 hover:text-blue-600'}`} />
    </button>
  );
}
