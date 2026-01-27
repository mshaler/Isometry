import type { LayoutPosition } from '../../types/notebook';
import type { NotebookLayoutState } from './types';
import { uiLogger } from '../../utils/logger';

const LAYOUT_STORAGE_KEY = 'notebook_layout';

export function createLayoutManager(defaultLayout: NotebookLayoutState) {
  const saveLayout = (layout: NotebookLayoutState) => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch (error) {
      uiLogger.warn('Failed to save layout', {}, error as Error);
    }
  };

  const loadLayout = (): NotebookLayoutState => {
    try {
      const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (savedLayout) {
        return JSON.parse(savedLayout);
      }
    } catch (error) {
      uiLogger.warn('Failed to load layout', {}, error as Error);
    }
    return defaultLayout;
  };

  const updateLayout = (
    currentLayout: NotebookLayoutState,
    component: keyof NotebookLayoutState,
    position: LayoutPosition
  ): NotebookLayoutState => {
    const newLayout = {
      ...currentLayout,
      [component]: position
    };
    saveLayout(newLayout);
    return newLayout;
  };

  return {
    loadLayout,
    saveLayout,
    updateLayout
  };
}