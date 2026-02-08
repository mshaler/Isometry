import type { NotebookCard, NotebookCardType, NotebookTemplate, LayoutPosition } from '../../types/notebook';
import type { NotebookIntegrationState } from '@/hooks';
import type { PerformanceMetrics, PerformanceAlert, OptimizationSuggestion } from '@/hooks';

export interface NotebookLayoutState {
  capture: LayoutPosition;
  shell: LayoutPosition;
  preview: LayoutPosition;
}

export interface NotebookContextType {
  // State
  activeCard: NotebookCard | null;
  cards: NotebookCard[];
  layout: NotebookLayoutState;
  isNotebookMode: boolean;
  templates: NotebookTemplate[];
  loading: boolean;
  error: Error | null;

  // Card Methods
  createCard: (type: NotebookCardType, templateId?: string) => Promise<NotebookCard>;
  updateCard: (id: string, _updates: Partial<NotebookCard>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  setActiveCard: (card: NotebookCard | null) => void;
  loadCards: () => Promise<void>;

  // Template Methods
  createTemplate: (name: string, _description: string, fromCard: NotebookCard) => Promise<NotebookTemplate>;
  deleteTemplate: (templateId: string) => Promise<void>;
  updateTemplate: (templateId: string, _updates: Partial<NotebookTemplate>) => Promise<void>;
  duplicateTemplate: (templateId: string, _newName: string) => Promise<NotebookTemplate>;

  // Layout Methods
  updateLayout: (component: keyof NotebookLayoutState, _position: LayoutPosition) => void;
  toggleNotebookMode: () => void;

  // Integration State and Methods
  integrationState: NotebookIntegrationState;
  connectIntegration: () => Promise<void>;
  disconnectIntegration: () => Promise<void>;
  syncWithIntegration: (cardId: string) => Promise<void>;

  // Performance Monitoring
  performanceMetrics: PerformanceMetrics;
  performanceAlerts: PerformanceAlert[];
  optimizationSuggestions: OptimizationSuggestion[];

  // Performance Methods
  clearPerformanceData: () => void;
  dismissAlert: (alertId: string) => void;
  applyOptimization: (suggestionId: string) => void;

  // Memory Management
  flushCache: () => void;
  getMemoryUsage: () => {
    cardCount: number;
    templateCount: number;
    cacheSize: number;
    estimatedMemoryMB: number;
  };
}

export const DEFAULT_LAYOUT: NotebookLayoutState = {
  capture: { x: 0, y: 0, width: 33, height: 100 },
  shell: { x: 33, y: 0, width: 34, height: 100 },
  preview: { x: 67, y: 0, width: 33, height: 100 }
};