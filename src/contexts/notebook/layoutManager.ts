import type { LayoutPosition } from '../../types/notebook';
import type { NotebookLayoutState } from './types';

const LAYOUT_STORAGE_KEY = 'notebook_layout';

export function createLayoutManager(defaultLayout: NotebookLayoutState) {
  const saveLayout = (layout: NotebookLayoutState) => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch (error) {
      console.warn('Failed to save layout:', error);
    }
  };

  const loadLayout = (): NotebookLayoutState => {
    try {
      const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (savedLayout) {
        return JSON.parse(savedLayout);
      }
    } catch (error) {
      console.warn('Failed to load layout:', error);
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