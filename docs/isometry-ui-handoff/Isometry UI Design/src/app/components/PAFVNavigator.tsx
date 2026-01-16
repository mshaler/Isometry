import { useState } from 'react';
import { useDrag, useDrop, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTheme } from '@/contexts/ThemeContext';

interface Chip {
  id: string;
  label: string;
  hasCheckbox?: boolean;
  checked?: boolean;
}

interface ChipData extends Chip {
  well: string;
}

const ItemType = 'CHIP';

function DraggableChip({ 
  chip, 
  well, 
  index, 
  moveChip,
  toggleCheckbox,
  theme
}: { 
  chip: Chip; 
  well: string; 
  index: number; 
  moveChip: (fromWell: string, fromIndex: number, toWell: string, toIndex: number) => void;
  toggleCheckbox: (well: string, chipId: string) => void;
  theme: 'NeXTSTEP' | 'Modern';
}) {
  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: { well, index, chip },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ItemType,
    hover: (item: { well: string; index: number; chip: Chip }) => {
      if (item.well !== well || item.index !== index) {
        moveChip(item.well, item.index, well, index);
        item.well = well;
        item.index = index;
      }
    },
  });

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`flex items-center gap-1.5 h-7 px-2.5 cursor-move text-xs transition-opacity w-full ${
        isDragging ? 'opacity-50' : 'opacity-100'
      } ${
        theme === 'NeXTSTEP'
          ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] shadow-[2px_2px_3px_rgba(0,0,0,0.4)]'
          : 'bg-white hover:bg-gray-50 rounded-md border border-gray-300 shadow-sm'
      }`}
    >
      {chip.hasCheckbox && (
        <input
          type="checkbox"
          checked={chip.checked || false}
          onChange={() => toggleCheckbox(well, chip.id)}
          onClick={(e) => e.stopPropagation()}
          className={`w-3 h-3 cursor-pointer ${
            theme === 'Modern' ? 'rounded accent-blue-500' : ''
          }`}
        />
      )}
      <span>{chip.label}</span>
    </div>
  );
}

function DropWell({ 
  title, 
  well, 
  chips, 
  moveChip, 
  toggleCheckbox,
  theme
}: { 
  title: string; 
  well: string; 
  chips: Chip[]; 
  moveChip: (fromWell: string, fromIndex: number, toWell: string, toIndex: number) => void;
  toggleCheckbox: (well: string, chipId: string) => void;
  theme: 'NeXTSTEP' | 'Modern';
}) {
  const [, drop] = useDrop({
    accept: ItemType,
    drop: (item: { well: string; index: number; chip: Chip }) => {
      if (item.well !== well) {
        moveChip(item.well, item.index, well, chips.length);
      }
    },
  });

  return (
    <div className="flex-1 min-w-0">
      <div className={`text-[10px] mb-1 px-1 ${
        theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'
      }`}>{title}</div>
      <div
        ref={drop}
        className={`min-h-[140px] p-2 flex flex-col gap-1.5 ${
          theme === 'NeXTSTEP'
            ? 'bg-[#a0a0a0] border-t-2 border-l-2 border-[#606060] border-b-2 border-r-2 border-r-[#d0d0d0] border-b-[#d0d0d0] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]'
            : 'bg-gray-50 border border-gray-300 rounded-lg'
        }`}
      >
        {chips.map((chip, index) => (
          <DraggableChip
            key={chip.id}
            chip={chip}
            well={well}
            index={index}
            moveChip={moveChip}
            toggleCheckbox={toggleCheckbox}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}

function PAFVNavigatorContent() {
  const { theme } = useTheme();
  const [wells, setWells] = useState<Record<string, Chip[]>>({
    available: [],
    xRows: [
      { id: 'folder', label: 'Folder' },
      { id: 'subfolder', label: 'Sub-folder' },
      { id: 'tags', label: 'Tags' },
    ],
    yColumns: [
      { id: 'year', label: 'Year' },
      { id: 'month', label: 'Month' },
    ],
    zLayers: [
      { id: 'auditview', label: 'Audit View', hasCheckbox: true, checked: false },
    ],
  });

  const moveChip = (fromWell: string, fromIndex: number, toWell: string, toIndex: number) => {
    setWells((prev) => {
      const newWells = { ...prev };
      const [movedChip] = newWells[fromWell].splice(fromIndex, 1);
      newWells[toWell].splice(toIndex, 0, movedChip);
      return newWells;
    });
  };

  const toggleCheckbox = (well: string, chipId: string) => {
    setWells((prev) => ({
      ...prev,
      [well]: prev[well].map((chip) =>
        chip.id === chipId ? { ...chip, checked: !chip.checked } : chip
      ),
    }));
  };

  return (
    <div className={`p-3 ${
      theme === 'NeXTSTEP'
        ? 'bg-[#b8b8b8] border-t-2 border-l-2 border-[#d8d8d8] border-b-2 border-r-2 border-b-[#505050] border-r-[#505050] shadow-[inset_1px_1px_2px_rgba(255,255,255,0.6),inset_-1px_-1px_2px_rgba(0,0,0,0.2)]'
        : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
    }`}>
      <div className="flex gap-3">
        <DropWell
          title="Available"
          well="available"
          chips={wells.available}
          moveChip={moveChip}
          toggleCheckbox={toggleCheckbox}
          theme={theme}
        />
        <DropWell
          title="x Rows"
          well="xRows"
          chips={wells.xRows}
          moveChip={moveChip}
          toggleCheckbox={toggleCheckbox}
          theme={theme}
        />
        <DropWell
          title="y Columns"
          well="yColumns"
          chips={wells.yColumns}
          moveChip={moveChip}
          toggleCheckbox={toggleCheckbox}
          theme={theme}
        />
        <DropWell
          title="z Layers"
          well="zLayers"
          chips={wells.zLayers}
          moveChip={moveChip}
          toggleCheckbox={toggleCheckbox}
          theme={theme}
        />
      </div>
    </div>
  );
}

export function PAFVNavigator() {
  return (
    <DndProvider backend={HTML5Backend}>
      <PAFVNavigatorContent />
    </DndProvider>
  );
}