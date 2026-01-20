import { createContext, useContext, ReactNode, useState, useCallback } from 'react';

export interface Chip {
  id: string;
  label: string;
  hasCheckbox?: boolean;
  checked?: boolean;
}

export interface Wells {
  available: Chip[];
  rows: Chip[];      // Row headers (left side, vertical grouping)
  columns: Chip[];   // Column headers (top, horizontal grouping)
  zLayers: Chip[];
}

interface PAFVContextType {
  wells: Wells;
  moveChip: (fromWell: keyof Wells, fromIndex: number, toWell: keyof Wells, toIndex: number) => void;
  toggleCheckbox: (well: keyof Wells, chipId: string) => void;
  transpose: () => void;
}

const PAFVContext = createContext<PAFVContextType | undefined>(undefined);

const DEFAULT_WELLS: Wells = {
  available: [],
  rows: [
    { id: 'folder', label: 'Folder' },
    { id: 'subfolder', label: 'Sub-folder' },
    { id: 'tags', label: 'Tags' },
  ],
  columns: [
    { id: 'year', label: 'Year' },
    { id: 'month', label: 'Month' },
  ],
  zLayers: [
    { id: 'auditview', label: 'Audit View', hasCheckbox: true, checked: false },
  ],
};

export function PAFVProvider({ children }: { children: ReactNode }) {
  const [wells, setWells] = useState<Wells>(DEFAULT_WELLS);

  const moveChip = useCallback((
    fromWell: keyof Wells,
    fromIndex: number,
    toWell: keyof Wells,
    toIndex: number
  ) => {
    setWells(prev => {
      const newWells: Wells = {
        available: [...prev.available],
        rows: [...prev.rows],
        columns: [...prev.columns],
        zLayers: [...prev.zLayers],
      };
      const [movedChip] = newWells[fromWell].splice(fromIndex, 1);
      newWells[toWell].splice(toIndex, 0, movedChip);
      return newWells;
    });
  }, []);

  const toggleCheckbox = useCallback((well: keyof Wells, chipId: string) => {
    setWells(prev => ({
      ...prev,
      [well]: prev[well].map(chip =>
        chip.id === chipId ? { ...chip, checked: !chip.checked } : chip
      ),
    }));
  }, []);

  const transpose = useCallback(() => {
    setWells(prev => ({
      ...prev,
      rows: prev.columns,
      columns: prev.rows,
    }));
  }, []);

  return (
    <PAFVContext.Provider value={{ wells, moveChip, toggleCheckbox, transpose }}>
      {children}
    </PAFVContext.Provider>
  );
}

export function usePAFV() {
  const context = useContext(PAFVContext);
  if (context === undefined) {
    throw new Error('usePAFV must be used within a PAFVProvider');
  }
  return context;
}
