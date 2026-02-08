import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { NotebookCard, NotebookCardType, NotebookTemplate } from '../types/notebook';
import { useSQLite } from '../db/SQLiteProvider';
import { useNotebookIntegration } from '@/hooks';
import { useNotebookPerformance } from '../hooks/performance/useNotebookPerformance';
import { useErrorReporting } from '../services/ErrorReportingService';
import {
  type NotebookContextType,
  DEFAULT_LAYOUT,
  createTemplateManager,
  createCardOperations,
  createLayoutManager
} from './notebook';

const NotebookContext = createContext<NotebookContextType | null>(null);

const MAX_CACHE_SIZE = 50;

export function NotebookProvider({ children }: { children: ReactNode }) {
  // Core state
  const [activeCard, setActiveCard] = useState<NotebookCard | null>(null);
  const [cards, setCards] = useState<NotebookCard[]>([]);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [isNotebookMode, setIsNotebookMode] = useState(() => {
    try {
      return localStorage.getItem('notebook_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [templates, setTemplates] = useState(createTemplateManager().loadTemplates());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Hooks
  const { db, execute } = useSQLite();
  const errorReporting = useErrorReporting();
  const performanceHook = useNotebookPerformance('NotebookProvider', cards.length);

  // Managers
  const templateManager = createTemplateManager();
  const cardOperations = createCardOperations(
    execute as (query: string, params?: unknown[]) => unknown[] | Promise<unknown[]>,
    performanceHook
  );
  const layoutManager = createLayoutManager(DEFAULT_LAYOUT);

  // Card cache for performance optimization
  const cardCache = new Map<string, NotebookCard>();

  // Load layout on mount
  useEffect(() => {
    setLayout(layoutManager.loadLayout());
  }, []);

  // Load templates on mount
  useEffect(() => {
    setTemplates(templateManager.loadTemplates());
  }, []);

  // Load cards when database is ready
  useEffect(() => {
    if (db && isNotebookMode) {
      loadCards().catch(err => {
        setError(err);
        errorReporting.reportUserError('Database Connection Failed', 'Unable to load your notebook cards. Please check your database connection.', [
          {
            label: 'Retry',
            action: () => loadCards().catch(() => {}) // Prevent further errors
          },
          {
            label: 'OK',
            action: () => {} // No-op
          }
        ]);
      });
    }
  }, [db, isNotebookMode]);

  // Card operations
  const loadCards = useCallback(async () => {
    if (!db) return;

    setLoading(true);
    setError(null);

    try {
      const notebookCards = await cardOperations.loadCards();

      // Update cache with LRU eviction
      notebookCards.forEach(card => {
        if (cardCache.size >= MAX_CACHE_SIZE) {
          // Remove oldest entry (simple LRU)
          const firstKey = cardCache.keys().next().value;
          if (firstKey) cardCache.delete(firstKey);
        }
        cardCache.set(card.id, card);
      });

      setCards(notebookCards);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load cards');
      setError(error);

      errorReporting.reportUserError(
        'Failed to Load Notebook Cards',
        'Your notebook cards could not be loaded. This might be due to a database connection issue or corrupted data.',
        [
          {
            label: 'Retry',
            action: () => {
              setError(null);
              loadCards().catch(() => {}); // Prevent recursive errors
            }
          },
          {
            label: 'OK',
            action: () => {} // No-op
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  }, [db, cardOperations, errorReporting]);

  // Integration hook - avoid circular dependency by providing callback
  const integrationState = useNotebookIntegration({
    activeCard: activeCard ? {
      id: activeCard.id,
      nodeId: activeCard.nodeId,
      content: activeCard.markdownContent || '',
      properties: activeCard.properties || {},
      modifiedAt: new Date(activeCard.modifiedAt),
      syncStatus: 'synced' as const
    } : null,
    cards: cards.map(card => ({
      id: card.id,
      nodeId: card.nodeId,
      content: card.markdownContent || '',
      properties: card.properties || {},
      modifiedAt: new Date(card.modifiedAt),
      syncStatus: 'synced' as const
    })),
    loadCards
  });

  const createCard = useCallback(async (type: NotebookCardType, templateId?: string) => {
    const template = templateId ? templates.find(t => t.id === templateId) : undefined;

    try {
      const newCard = await cardOperations.createCard(
        type,
        template,
        templateManager.saveCustomTemplates,
        templates
      );

      setCards(prev => [newCard, ...prev]);
      setActiveCard(newCard);

      // Update template usage if applicable
      if (template && template.category === 'custom') {
        setTemplates(templateManager.loadTemplates());
      }

      return newCard;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create card');
      setError(error);

      errorReporting.reportUserError(
        'Failed to Create Card',
        `Could not create a new ${type} card. This might be due to a database issue or insufficient permissions.`,
        [
          {
            label: 'Try Again',
            action: () => setError(null)
          },
          {
            label: 'OK',
            action: () => setError(null)
          }
        ]
      );

      throw error;
    }
  }, [templates, cardOperations, templateManager, errorReporting]);

  const updateCard = useCallback(async (id: string, updates: Partial<NotebookCard>) => {
    try {
      await cardOperations.updateCard(id, updates);

      // Update local state
      setCards(prev => prev.map(card =>
        card.id === id ? { ...card, ...updates } : card
      ));

      // Update active card if it's the one being updated
      if (activeCard?.id === id) {
        setActiveCard(prev => prev ? { ...prev, ...updates } : null);
      }

      // Update cache
      const cachedCard = cardCache.get(id);
      if (cachedCard) {
        cardCache.set(id, { ...cachedCard, ...updates });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update card');
      setError(error);
      throw error;
    }
  }, [activeCard, cardOperations]);

  const deleteCard = useCallback(async (id: string) => {
    try {
      await cardOperations.deleteCard(id);

      // Update local state
      setCards(prev => prev.filter(card => card.id !== id));

      // Clear active card if it's the one being deleted
      if (activeCard?.id === id) {
        setActiveCard(null);
      }

      // Remove from cache
      cardCache.delete(id);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete card');
      setError(error);
      throw error;
    }
  }, [activeCard, cardOperations]);

  // Template operations
  const createTemplate = useCallback(async (name: string, description: string, fromCard: NotebookCard) => {
    try {
      const template = await templateManager.createTemplate(name, description, fromCard);
      setTemplates(templateManager.loadTemplates());
      return template;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create template');
      setError(error);
      throw error;
    }
  }, [templateManager]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    try {
      await templateManager.deleteTemplate(templateId);
      setTemplates(templateManager.loadTemplates());
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete template');
      setError(error);
      throw error;
    }
  }, [templateManager]);

  const updateTemplate = useCallback(async (templateId: string, updates: Partial<NotebookTemplate>) => {
    try {
      await templateManager.updateTemplate(templateId, updates);
      setTemplates(templateManager.loadTemplates());
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update template');
      setError(error);
      throw error;
    }
  }, [templateManager]);

  const duplicateTemplate = useCallback(async (templateId: string, newName: string) => {
    try {
      const template = await templateManager.duplicateTemplate(templateId, newName);
      setTemplates(templateManager.loadTemplates());
      return template;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to duplicate template');
      setError(error);
      throw error;
    }
  }, [templateManager]);

  // Layout operations
  const updateLayout = useCallback((component: keyof typeof layout, position: typeof layout.capture) => {
    const newLayout = layoutManager.updateLayout(layout, component, position);
    setLayout(newLayout);
  }, [layout, layoutManager]);

  const toggleNotebookMode = useCallback(() => {
    const newMode = !isNotebookMode;
    setIsNotebookMode(newMode);

    try {
      localStorage.setItem('notebook_mode', newMode.toString());
    } catch (error) {
      console.warn('Failed to save notebook mode:', error);
    }

    if (newMode && db) {
      loadCards().catch(err => setError(err));
    }
  }, [isNotebookMode, db, loadCards]);

  // Memory management
  const flushCache = useCallback(() => {
    cardCache.clear();
  }, []);

  const getMemoryUsage = useCallback(() => {
    return {
      cardCount: cards.length,
      templateCount: templates.length,
      cacheSize: cardCache.size,
      estimatedMemoryMB: Math.round((cards.length * 5 + templates.length * 2 + cardCache.size * 5) / 1024)
    };
  }, [cards.length, templates.length, cardCache.size]);

  const contextValue: NotebookContextType = {
    // State
    activeCard,
    cards,
    layout,
    isNotebookMode,
    templates,
    loading,
    error,

    // Card Methods
    createCard,
    updateCard,
    deleteCard,
    setActiveCard,
    loadCards,

    // Template Methods
    createTemplate,
    deleteTemplate,
    updateTemplate,
    duplicateTemplate,

    // Layout Methods
    updateLayout,
    toggleNotebookMode,

    // Integration State and Methods
    integrationState: integrationState as any,
    connectIntegration: async () => {}, // Placeholder - integration is always connected in same app
    disconnectIntegration: async () => {}, // Placeholder - integration is always connected in same app
    syncWithIntegration: integrationState.forceSync,

    // Performance Monitoring
    performanceMetrics: performanceHook.metrics,
    performanceAlerts: performanceHook.alerts,
    optimizationSuggestions: performanceHook.suggestions,

    // Performance Methods
    clearPerformanceData: performanceHook.clearMetrics,
    dismissAlert: () => {}, // Placeholder - alerts auto-expire
    applyOptimization: () => {}, // Placeholder - suggestions are informational only

    // Memory Management
    flushCache,
    getMemoryUsage
  };

  return (
    <NotebookContext.Provider value={contextValue}>
      {children}
    </NotebookContext.Provider>
  );
}

export function useNotebook(): NotebookContextType {
  const context = useContext(NotebookContext);
  if (!context) {
    throw new Error('useNotebook must be used within a NotebookProvider');
  }
  return context;
}
