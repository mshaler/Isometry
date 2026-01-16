import { usePAFV, type Wells, type Chip } from '@/contexts/PAFVContext';
import { useTheme } from '@/contexts/ThemeContext';

// Available facets that can be assigned to axes
const AVAILABLE_FACETS: Chip[] = [
  { id: 'folder', label: 'Folder' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'tags', label: 'Tags' },
  { id: 'year', label: 'Year' },
  { id: 'month', label: 'Month' },
  { id: 'nodeType', label: 'Type' },
];

interface AxisSelectorProps {
  compact?: boolean;
}

export function AxisSelector({ compact = false }: AxisSelectorProps) {
  const { wells, moveChip } = usePAFV();
  const { theme } = useTheme();

  // Get current axis assignments
  const xAxis = wells.xRows[0]?.id || null;
  const yAxis = wells.yColumns[0]?.id || null;

  // Find chip location in wells
  const findChipLocation = (chipId: string): { well: keyof Wells; index: number } | null => {
    for (const wellName of ['available', 'xRows', 'yColumns', 'zLayers'] as const) {
      const index = wells[wellName].findIndex(c => c.id === chipId);
      if (index !== -1) {
        return { well: wellName, index };
      }
    }
    return null;
  };

  const handleAxisChange = (axis: 'x' | 'y', facetId: string | null) => {
    if (!facetId) return;

    const targetWell = axis === 'x' ? 'xRows' : 'yColumns';
    const location = findChipLocation(facetId);

    if (location) {
      // Move existing chip to front of target well
      moveChip(location.well, location.index, targetWell, 0);
    }
  };

  const selectClass = theme === 'NeXTSTEP'
    ? 'bg-white border border-[#808080] px-2 py-1 text-sm'
    : 'bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">X:</span>
        <select
          value={xAxis || ''}
          onChange={(e) => handleAxisChange('x', e.target.value || null)}
          className={selectClass}
        >
          <option value="">None</option>
          {AVAILABLE_FACETS.map(f => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <span className="text-gray-500">Y:</span>
        <select
          value={yAxis || ''}
          onChange={(e) => handleAxisChange('y', e.target.value || null)}
          className={selectClass}
        >
          <option value="">None</option>
          {AVAILABLE_FACETS.map(f => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={`p-3 ${
      theme === 'NeXTSTEP'
        ? 'bg-[#d4d4d4] border-b border-[#808080]'
        : 'bg-gray-50 border-b border-gray-200'
    }`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">X Axis:</label>
          <select
            value={xAxis || ''}
            onChange={(e) => handleAxisChange('x', e.target.value || null)}
            className={selectClass}
          >
            <option value="">None</option>
            {AVAILABLE_FACETS.map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Y Axis:</label>
          <select
            value={yAxis || ''}
            onChange={(e) => handleAxisChange('y', e.target.value || null)}
            className={selectClass}
          >
            <option value="">None</option>
            {AVAILABLE_FACETS.map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-xs text-gray-500">
          Drag facets between axes to reconfigure the view
        </div>
      </div>
    </div>
  );
}
