import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Node } from '@/types/node';

interface CardOverlayContextValue {
  selectedNode: Node | null;
  setSelectedNode: (node: Node | null) => void;
  clearSelection: () => void;
}

const CardOverlayContext = createContext<CardOverlayContextValue | null>(null);

export function CardOverlayProvider({ children }: { children: React.ReactNode }) {
  const [selectedNode, setSelectedNodeState] = useState<Node | null>(null);

  const setSelectedNode = useCallback((node: Node | null) => {
    setSelectedNodeState(node);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeState(null);
  }, []);

  return (
    <CardOverlayContext.Provider value={{
      selectedNode,
      setSelectedNode,
      clearSelection,
    }}>
      {children}
    </CardOverlayContext.Provider>
  );
}

export function useCardOverlay(): CardOverlayContextValue {
  const context = useContext(CardOverlayContext);
  if (!context) {
    throw new Error('useCardOverlay must be used within CardOverlayProvider');
  }
  return context;
}
