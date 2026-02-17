import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

/**
 * Pane dimensions for each canvas in the Three-Canvas notebook.
 */
interface PaneDimensions {
  capture: { width: number; height: number };
  shell: { width: number; height: number };
  preview: { width: number; height: number };
}

/**
 * Context value providing pane layout information.
 * - dimensions: Current dimensions of each pane
 * - isResizing: True while resize is in progress (before debounce completes)
 * - containerWidth/Height: Overall container dimensions
 */
interface PaneLayoutContextValue {
  dimensions: PaneDimensions;
  isResizing: boolean;
  containerWidth: number;
  containerHeight: number;
}

const PaneLayoutContext = createContext<PaneLayoutContextValue | null>(null);

const DEBOUNCE_MS = 500; // Per spec: 500ms debounce for resize

interface PaneLayoutProviderProps {
  children: ReactNode;
  /** Optional percentages from react-resizable-panels Layout */
  panelPercentages?: { capture: number; shell: number; preview: number };
}

/**
 * Provider that coordinates pane resize events with 500ms debounce.
 * Wrap around NotebookLayout to provide dimensions to all panes.
 */
export function PaneLayoutProvider({ children, panelPercentages }: PaneLayoutProviderProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [containerWidth, setContainerWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  const [containerHeight, setContainerHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 800
  );

  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate pane dimensions from percentages and container size
  const calculateDimensions = useCallback((): PaneDimensions => {
    const percentages = panelPercentages ?? { capture: 33.33, shell: 33.33, preview: 33.33 };
    return {
      capture: {
        width: Math.round(containerWidth * (percentages.capture / 100)),
        height: containerHeight,
      },
      shell: {
        width: Math.round(containerWidth * (percentages.shell / 100)),
        height: containerHeight,
      },
      preview: {
        width: Math.round(containerWidth * (percentages.preview / 100)),
        height: containerHeight,
      },
    };
  }, [containerWidth, containerHeight, panelPercentages]);

  const [dimensions, setDimensions] = useState<PaneDimensions>(calculateDimensions);

  // Update dimensions when percentages or container size changes
  useEffect(() => {
    setDimensions(calculateDimensions());
  }, [calculateDimensions]);

  // Debounced window resize handler (500ms per spec)
  useEffect(() => {
    const handleResize = () => {
      setIsResizing(true);

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        setContainerWidth(window.innerWidth);
        setContainerHeight(window.innerHeight);
        setIsResizing(false);
      }, DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  const value: PaneLayoutContextValue = {
    dimensions,
    isResizing,
    containerWidth,
    containerHeight,
  };

  return (
    <PaneLayoutContext.Provider value={value}>
      {children}
    </PaneLayoutContext.Provider>
  );
}

/**
 * Hook to access pane layout dimensions and resize state.
 * Must be used within PaneLayoutProvider.
 */
export function usePaneLayout(): PaneLayoutContextValue {
  const context = useContext(PaneLayoutContext);
  if (!context) {
    throw new Error('usePaneLayout must be used within PaneLayoutProvider');
  }
  return context;
}

/**
 * Hook that returns null if PaneLayoutProvider is absent (for gradual adoption).
 */
export function usePaneLayoutOptional(): PaneLayoutContextValue | null {
  return useContext(PaneLayoutContext);
}
