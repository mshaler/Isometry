// Notebook context types and utilities
// This file provides the types and utility functions used by NotebookContext

import type {
  NotebookCard,
  NotebookTemplate,
  NotebookCardType,
  LayoutPosition
} from '../types/notebook';
import { devLogger } from "../utils/logging/dev-logger";

// Context type definition
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
  updateCard: (id: string, updates: Partial<NotebookCard>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  setActiveCard: (card: NotebookCard | null) => void;
  loadCards: () => Promise<void>;
  /** SYNC-02: Load a card by ID (or node_id) and set it as activeCard */
  loadCard: (cardId: string) => Promise<void>;

  // Template Methods
  createTemplate: (name: string, description: string, fromCard: NotebookCard) => Promise<NotebookTemplate>;
  deleteTemplate: (templateId: string) => Promise<void>;
  updateTemplate: (templateId: string, updates: Partial<NotebookTemplate>) => Promise<void>;
  duplicateTemplate: (templateId: string, newName: string) => Promise<NotebookTemplate>;

  // Layout Methods
  updateLayout: (component: keyof NotebookLayoutState, position: LayoutPosition) => void;
  toggleNotebookMode: () => void;

  // Integration State and Methods
  integrationState: IntegrationState;
  connectIntegration: () => Promise<void>;
  disconnectIntegration: () => Promise<void>;
  syncWithIntegration: () => Promise<void>;

  // Performance Monitoring
  performanceMetrics: PerformanceMetrics;
  performanceAlerts: PerformanceAlert[];
  optimizationSuggestions: OptimizationSuggestion[];

  // Performance Methods
  clearPerformanceData: () => void;

  // Memory Management
  flushCache: () => void;
  getMemoryUsage: () => MemoryUsage;
}

// Layout state type
export interface NotebookLayoutState {
  capture: LayoutPosition;
  shell: LayoutPosition;
  preview: LayoutPosition;
}

// Default layout configuration
export const DEFAULT_LAYOUT: NotebookLayoutState = {
  capture: { x: 0, y: 0, width: 40, height: 100 },
  shell: { x: 40, y: 0, width: 30, height: 100 },
  preview: { x: 70, y: 0, width: 30, height: 100 },
};

// Integration state type
export interface IntegrationState {
  isConnected: boolean;
  lastSync: Date | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  errorMessage?: string;
  forceSync: () => Promise<void>;
}

// Import performance types from the actual hook
import type {
  PerformanceMetrics as HookPerformanceMetrics,
  PerformanceAlert as HookPerformanceAlert,
  OptimizationSuggestion as HookOptimizationSuggestion
} from '../hooks/performance/useNotebookPerformance';

// Re-export the hook types for the context
export type PerformanceMetrics = HookPerformanceMetrics;
export type PerformanceAlert = HookPerformanceAlert;
export type OptimizationSuggestion = HookOptimizationSuggestion;

export interface MemoryUsage {
  cardCount: number;
  templateCount: number;
  cacheSize: number;
  estimatedMemoryMB: number;
}

// Template manager utilities
export interface TemplateManager {
  loadTemplates: () => NotebookTemplate[];
  saveCustomTemplates: (templates: NotebookTemplate[]) => void;
  createTemplate: (name: string, description: string, fromCard: NotebookCard) => Promise<NotebookTemplate>;
  deleteTemplate: (templateId: string) => Promise<void>;
  updateTemplate: (templateId: string, updates: Partial<NotebookTemplate>) => Promise<void>;
  duplicateTemplate: (templateId: string, newName: string) => Promise<NotebookTemplate>;
}

// Card operations interface
export interface CardOperations {
  loadCards: () => Promise<NotebookCard[]>;
  /** SYNC-02: Load a card by ID (or node_id) */
  loadCardById: (cardId: string) => Promise<NotebookCard | null>;
  createCard: (
    type: NotebookCardType,
    template?: NotebookTemplate,
    saveTemplates?: (templates: NotebookTemplate[]) => void,
    allTemplates?: NotebookTemplate[]
  ) => Promise<NotebookCard>;
  updateCard: (id: string, updates: Partial<NotebookCard>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
}

// Layout manager interface
export interface LayoutManager {
  loadLayout: () => NotebookLayoutState;
  saveLayout: (layout: NotebookLayoutState) => void;
  updateLayout: (
    current: NotebookLayoutState,
    component: keyof NotebookLayoutState,
    position: LayoutPosition
  ) => NotebookLayoutState;
}

// Factory functions for managers
export function createTemplateManager(): TemplateManager {
  return {
    loadTemplates: () => {
      try {
        const stored = localStorage.getItem('notebook_templates');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    },

    saveCustomTemplates: (templates: NotebookTemplate[]) => {
      try {
        localStorage.setItem('notebook_templates', JSON.stringify(templates));
      } catch (error) {
        devLogger.warn('Failed to save custom templates', { error });
      }
    },

    createTemplate: async (name: string, description: string, fromCard: NotebookCard) => {
      const template: NotebookTemplate = {
        id: crypto.randomUUID(),
        name,
        description,
        category: 'custom',
        cardType: fromCard.cardType,
        markdownContent: fromCard.markdownContent || '',
        properties: fromCard.properties || {},
        tags: [],
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        usageCount: 0
      };

      const existingTemplates = JSON.parse(localStorage.getItem('notebook_templates') || '[]');
      const updatedTemplates = [...existingTemplates, template];
      localStorage.setItem('notebook_templates', JSON.stringify(updatedTemplates));

      return template;
    },

    deleteTemplate: async (templateId: string) => {
      const existingTemplates = JSON.parse(localStorage.getItem('notebook_templates') || '[]');
      const updatedTemplates = existingTemplates.filter((t: NotebookTemplate) => t.id !== templateId);
      localStorage.setItem('notebook_templates', JSON.stringify(updatedTemplates));
    },

    updateTemplate: async (templateId: string, updates: Partial<NotebookTemplate>) => {
      const existingTemplates = JSON.parse(localStorage.getItem('notebook_templates') || '[]');
      const updatedTemplates = existingTemplates.map((t: NotebookTemplate) =>
        t.id === templateId ? { ...t, ...updates, modifiedAt: new Date().toISOString() } : t
      );
      localStorage.setItem('notebook_templates', JSON.stringify(updatedTemplates));
    },

    duplicateTemplate: async (templateId: string, newName: string) => {
      const existingTemplates = JSON.parse(localStorage.getItem('notebook_templates') || '[]');
      const originalTemplate = existingTemplates.find((t: NotebookTemplate) => t.id === templateId);

      if (!originalTemplate) {
        throw new Error('Template not found');
      }

      const duplicatedTemplate: NotebookTemplate = {
        ...originalTemplate,
        id: crypto.randomUUID(),
        name: newName,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        usageCount: 0
      };

      const updatedTemplates = [...existingTemplates, duplicatedTemplate];
      localStorage.setItem('notebook_templates', JSON.stringify(updatedTemplates));

      return duplicatedTemplate;
    }
  };
}

export function createCardOperations(
  execute: (query: string, params?: unknown[]) => unknown[] | Promise<unknown[]>,
  performanceHook: {
    measureRender: (name: string, duration: number) => void;
    measureQuery: (name: string, duration: number) => void;
  }
): CardOperations {
  return {
    loadCards: async () => {
      const startTime = performance.now();
      try {
        // This would normally query the database
        const result = await execute(
          'SELECT * FROM notebook_cards ORDER BY modified_at DESC'
        ) as any[];

        const endTime = performance.now();
        performanceHook.measureQuery('loadCards', endTime - startTime);

        return result.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          nodeId: row.node_id as string,
          markdownContent: row.markdown_content as string | null,
          renderedContent: row.rendered_content as string | null,
          properties: row.properties ? JSON.parse(row.properties as string) : null,
          templateId: row.template_id as string | null,
          cardType: row.card_type as string,
          layoutPosition: row.layout_position ? JSON.parse(row.layout_position as string) : null,
          createdAt: row.created_at as string,
          modifiedAt: row.modified_at as string
        }));
      } catch (error) {
        devLogger.error('Failed to load cards', { error });
        return [];
      }
    },

    /**
     * SYNC-02: Load a card by ID (or node_id)
     */
    loadCardById: async (cardId: string) => {
      const startTime = performance.now();
      try {
        const result = await execute(
          `SELECT nc.*, n.name, n.node_type
           FROM notebook_cards nc
           JOIN nodes n ON nc.node_id = n.id
           WHERE (nc.id = ? OR nc.node_id = ?) AND n.deleted_at IS NULL
           LIMIT 1`,
          [cardId, cardId]
        ) as Record<string, unknown>[];

        const endTime = performance.now();
        performanceHook.measureQuery('loadCardById', endTime - startTime);

        if (result.length === 0) {
          return null;
        }

        const row = result[0];
        return {
          id: row.id as string,
          nodeId: row.node_id as string,
          markdownContent: row.markdown_content as string | null,
          renderedContent: row.rendered_content as string | null,
          properties: row.properties ? JSON.parse(row.properties as string) : null,
          templateId: row.template_id as string | null,
          cardType: row.card_type as string,
          layoutPosition: row.layout_position ? JSON.parse(row.layout_position as string) : null,
          createdAt: row.created_at as string,
          modifiedAt: row.modified_at as string
        };
      } catch (error) {
        devLogger.error('Failed to load card by ID', { error });
        return null;
      }
    },

    createCard: async (type, template) => {
      const startTime = performance.now();
      const now = new Date().toISOString();
      const nodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newCard: NotebookCard = {
        id: crypto.randomUUID(),
        nodeId,
        cardType: type,
        markdownContent: template?.markdownContent || '',
        renderedContent: null,
        properties: template?.properties || null,
        templateId: template?.id || null,
        layoutPosition: null,
        createdAt: now,
        modifiedAt: now
      };

      try {
        await execute(
          `INSERT INTO notebook_cards (id, node_id, card_type, markdown_content, properties, template_id, created_at, modified_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newCard.id,
            newCard.nodeId,
            newCard.cardType,
            newCard.markdownContent,
            newCard.properties ? JSON.stringify(newCard.properties) : null,
            newCard.templateId,
            newCard.createdAt,
            newCard.modifiedAt
          ]
        );

        const endTime = performance.now();
        performanceHook.measureQuery('createCard', endTime - startTime);

        return newCard;
      } catch (error) {
        devLogger.error('Failed to create card', { error });
        throw error;
      }
    },

    updateCard: async (id, updates) => {
      const startTime = performance.now();
      const modifiedAt = new Date().toISOString();

      try {
        await execute(
          `UPDATE notebook_cards
           SET markdown_content = ?, properties = ?, modified_at = ?
           WHERE id = ?`,
          [
            updates.markdownContent,
            updates.properties ? JSON.stringify(updates.properties) : null,
            modifiedAt,
            id
          ]
        );

        const endTime = performance.now();
        performanceHook.measureQuery('updateCard', endTime - startTime);
      } catch (error) {
        devLogger.error('Failed to update card', { error });
        throw error;
      }
    },

    deleteCard: async (id) => {
      const startTime = performance.now();

      try {
        await execute('DELETE FROM notebook_cards WHERE id = ?', [id]);

        const endTime = performance.now();
        performanceHook.measureQuery('deleteCard', endTime - startTime);
      } catch (error) {
        devLogger.error('Failed to delete card', { error });
        throw error;
      }
    }
  };
}

export function createLayoutManager(defaultLayout: NotebookLayoutState): LayoutManager {
  return {
    loadLayout: () => {
      try {
        const stored = localStorage.getItem('notebook_layout');
        return stored ? JSON.parse(stored) : defaultLayout;
      } catch {
        return defaultLayout;
      }
    },

    saveLayout: (layout: NotebookLayoutState) => {
      try {
        localStorage.setItem('notebook_layout', JSON.stringify(layout));
      } catch (error) {
        devLogger.warn('Failed to save layout', { error });
      }
    },

    updateLayout: (current, component, position) => {
      const newLayout = {
        ...current,
        [component]: position
      };

      try {
        localStorage.setItem('notebook_layout', JSON.stringify(newLayout));
      } catch (error) {
        devLogger.warn('Failed to save layout', { error });
      }

      return newLayout;
    }
  };
}