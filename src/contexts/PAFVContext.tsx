import { createContext, useContext, ReactNode, useState, useCallback } from 'react';

export interface Chip {
  id: string;
  label: string;
  hasCheckbox?: boolean;
  checked?: boolean;
}

export interface Wells {
  available: Chip[];
  xRows: Chip[];
  yColumns: Chip[];
  zLayers: Chip[];
}

interface PAFVContextType {
  wells: Wells;
  moveChip: (fromWell: keyof Wells, fromIndex: number, toWell: keyof Wells, toIndex: number) => void;
  toggleCheckbox: (well: keyof Wells, chipId: string) => void;
}

const PAFVContext = createContext<PAFVContextType | undefined>(undefined);

const DEFAULT_WELLS: Wells = {
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
        xRows: [...prev.xRows],
        yColumns: [...prev.yColumns],
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

  return (
    <PAFVContext.Provider value={{ wells, moveChip, toggleCheckbox }}>
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
