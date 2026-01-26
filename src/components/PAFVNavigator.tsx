import { useDrag, useDrop, DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ArrowRightLeft } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { usePAFV, type Chip, type Wells } from '@/contexts/PAFVContext';

const ItemType = 'CHIP';

interface DraggableChipProps {
  chip: Chip;
  well: keyof Wells;
  index: number;
  moveChip: (fromWell: keyof Wells, fromIndex: number, toWell: keyof Wells, toIndex: number) => void;
  toggleCheckbox: (well: keyof Wells, chipId: string) => void;
  theme: 'NeXTSTEP' | 'Modern';
}

function DraggableChip({ chip, well, index, moveChip, toggleCheckbox, theme }: DraggableChipProps) {
  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: { well, index, chip },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [, drop] = useDrop({
    accept: ItemType,
    hover: (item: { well: keyof Wells; index: number }) => {
      if (item.well !== well || item.index !== index) {
        moveChip(item.well as keyof Wells, item.index, well, index);
        item.well = well;
        item.index = index;
      }
    },
  });

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`flex items-center gap-1.5 h-7 px-2.5 cursor-move text-xs w-full ${
        isDragging ? 'opacity-50' : 'opacity-100'
      } ${
        theme === 'NeXTSTEP'
          ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070]'
          : 'bg-white hover:bg-gray-50 rounded-md border border-gray-300'
      }`}
    >
      {chip.hasCheckbox && (
        <input
          type="checkbox"
          checked={chip.checked || false}
          onChange={() => toggleCheckbox(well, chip.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-3 h-3 cursor-pointer"
        />
      )}
      <span>{chip.label}</span>
    </div>
  );
}

interface DropWellProps {
  title: string;
  well: keyof Wells;
  chips: Chip[];
  moveChip: (fromWell: keyof Wells, fromIndex: number, toWell: keyof Wells, toIndex: number) => void;
  toggleCheckbox: (well: keyof Wells, chipId: string) => void;
  theme: 'NeXTSTEP' | 'Modern';
}

function DropWell({ title, well, chips, moveChip, toggleCheckbox, theme }: DropWellProps) {
  const [, drop] = useDrop({
    accept: ItemType,
    drop: (item: { well: keyof Wells; index: number }) => {
      if (item.well !== well) {
        moveChip(item.well, item.index, well, chips.length);
      }
    },
  });

  return (
    <div className="flex-1 min-w-0">
      <div className={`text-[10px] mb-1 px-1 ${theme === 'NeXTSTEP' ? 'text-[#404040]' : 'text-gray-600 font-medium'}`}>
        {title}
      </div>
      <div
        ref={drop}
        className={`min-h-[140px] p-2 flex flex-col gap-1.5 ${
          theme === 'NeXTSTEP'
            ? 'bg-[#a0a0a0] border-t-2 border-l-2 border-[#606060] border-b-2 border-r-2 border-r-[#d0d0d0] border-b-[#d0d0d0]'
            : 'bg-gray-50 border border-gray-300 rounded-lg'
        }`}
      >
        {chips.map((chip, index) => (
          <DraggableChip key={chip.id} chip={chip} well={well} index={index} moveChip={moveChip} toggleCheckbox={toggleCheckbox} theme={theme} />
        ))}
      </div>
    </div>
  );
}

function PAFVNavigatorContent() {
  const { theme } = useTheme();
  const { wells, moveChip, toggleCheckbox, transpose } = usePAFV();

  return (
    <div className={`p-3 ${
      theme === 'NeXTSTEP'
        ? 'bg-[#b8b8b8] border-b-2 border-[#505050]'
        : 'bg-white/50 backdrop-blur-xl border-b border-gray-200'
    }`}>
      <div className="flex gap-3">
        <DropWell title="Available" well="available" chips={wells.available} moveChip={moveChip} toggleCheckbox={toggleCheckbox} theme={theme} />
        <DropWell title="Rows" well="rows" chips={wells.rows} moveChip={moveChip} toggleCheckbox={toggleCheckbox} theme={theme} />

        {/* Transpose button between Rows and Columns */}
        <div className="flex items-center">
          <button
            onClick={transpose}
            className={`p-2 rounded transition-colors ${
              theme === 'NeXTSTEP'
                ? 'bg-[#d4d4d4] border-t-2 border-l-2 border-[#ffffff] border-b-2 border-r-2 border-b-[#707070] border-r-[#707070] hover:bg-[#c0c0c0] active:border-t-[#707070] active:border-l-[#707070] active:border-b-[#ffffff] active:border-r-[#ffffff]'
                : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
            }`}
            title="Transpose rows and columns"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
        </div>

        <DropWell title="Columns" well="columns" chips={wells.columns} moveChip={moveChip} toggleCheckbox={toggleCheckbox} theme={theme} />
        <DropWell title="Layers" well="zLayers" chips={wells.zLayers} moveChip={moveChip} toggleCheckbox={toggleCheckbox} theme={theme} />
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
