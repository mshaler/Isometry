import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { NotebookCard, NotebookCardType, NotebookTemplate, LayoutPosition } from '../types/notebook';
import { createNotebookCardTemplate, rowToNotebookCard, notebookCardToRow, BUILT_IN_TEMPLATES } from '../types/notebook';
import { useDatabase } from '../db/DatabaseContext';
import { useNotebookIntegration } from '../hooks/useNotebookIntegration';
import { useNotebookPerformance } from '../hooks/useNotebookPerformance';
import type { NotebookIntegrationState } from '../hooks/useNotebookIntegration';
import type { PerformanceMetrics, PerformanceAlert, OptimizationSuggestion } from '../hooks/useNotebookPerformance';
import { useErrorReporting } from '../services/ErrorReportingService';

interface NotebookLayoutState {
  capture: LayoutPosition;
  shell: LayoutPosition;
  preview: LayoutPosition;
}

interface NotebookContextType {
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

  // Template Methods
  createTemplate: (name: string, description: string, fromCard: NotebookCard) => Promise<NotebookTemplate>;
  deleteTemplate: (templateId: string) => Promise<void>;
  updateTemplate: (templateId: string, updates: Partial<NotebookTemplate>) => Promise<void>;
  duplicateTemplate: (templateId: string, newName: string) => Promise<NotebookTemplate>;

  // Layout Methods
  updateLayout: (component: keyof NotebookLayoutState, position: LayoutPosition) => void;
  toggleNotebookMode: () => void;

  // Integration State and Methods
  integrationStatus: NotebookIntegrationState;
  syncWithMainApp: () => Promise<void>;
  resolveConflicts: (cardId: string, resolution: 'notebook' | 'main' | 'merge') => Promise<void>;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;

  // Performance Monitoring
  performanceMetrics: PerformanceMetrics;
  performanceAlerts: PerformanceAlert[];
  optimizationSuggestions: OptimizationSuggestion[];
  performanceScore: number;
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';

  // Performance Methods
  startPerformanceMonitoring: () => void;
  stopPerformanceMonitoring: () => void;
  measureRender: (componentName: string, duration: number) => void;
  measureQuery: (queryName: string, duration: number) => void;
  clearPerformanceMetrics: () => void;

  // Memory Management
  cardCache: Map<string, NotebookCard>;
  maxCacheSize: number;
  isOffline: boolean;
  pendingChanges: number;
}

const NotebookContext = createContext<NotebookContextType | undefined>(undefined);

const LAYOUT_STORAGE_KEY = 'isometry-notebook-layout';
const TEMPLATES_STORAGE_KEY = 'isometry-notebook-templates';

const DEFAULT_LAYOUT: NotebookLayoutState = {
  capture: { x: 0, y: 0, width: 400, height: 600 },
  shell: { x: 400, y: 0, width: 400, height: 300 },
  preview: { x: 400, y: 300, width: 400, height: 300 },
};

export function NotebookProvider({ children }: { children: ReactNode }) {
  const { db, execute } = useDatabase();
  const errorReporting = useErrorReporting();
  const [activeCard, setActiveCard] = useState<NotebookCard | null>(null);
  const [cards, setCards] = useState<NotebookCard[]>([]);
  const [layout, setLayout] = useState<NotebookLayoutState>(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load layout');
      errorReporting.reportUserWarning('Layout Loading Failed', 'Using default layout due to corrupted saved state');
      console.warn('Failed to load notebook layout:', err);
      return DEFAULT_LAYOUT;
    }
  });
  const [isNotebookMode, setIsNotebookMode] = useState(false);
  const [templates, setTemplates] = useState<NotebookTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Card cache for performance optimization
  const [cardCache] = useState<Map<string, NotebookCard>>(new Map());
  const maxCacheSize = 100;

  // Performance hook
  const performanceHook = useNotebookPerformance('NotebookProvider');

  // Persist layout to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to save layout');
      errorReporting.reportUserWarning('Layout Save Failed', 'Your layout changes could not be saved and may be lost on refresh');
      console.warn('Failed to save layout to localStorage:', err);
    }
  }, [layout, errorReporting]);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  // Load cards on database ready
  useEffect(() => {
    if (db && isNotebookMode) {
      loadCards().catch((error) => {
        const err = error instanceof Error ? error : new Error('Failed to load cards');
        errorReporting.reportUserError('Failed to Load Cards', 'Could not load your notebook cards. Please try refreshing or check your connection.', [
          {
            label: 'Retry',
            action: () => loadCards().catch(() => {}) // Prevent further errors
          },
          {
            label: 'OK',
            action: () => {} // No-op
          }
        ]);
        console.error('Failed to load cards in useEffect:', err);
      });
    }
  }, [db, isNotebookMode, errorReporting]);

  // Load templates from localStorage and merge with built-in templates
  const loadTemplates = useCallback(() => {
    try {
      const savedTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      const customTemplates: NotebookTemplate[] = savedTemplates ? JSON.parse(savedTemplates) : [];

      // Validate custom templates structure
      const validCustomTemplates = customTemplates.filter(template =>
        template.id && template.name && template.markdownContent !== undefined
      );

      // Merge built-in and custom templates
      setTemplates([...BUILT_IN_TEMPLATES, ...validCustomTemplates]);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load custom templates');
      errorReporting.reportUserWarning('Template Loading Failed', 'Using default templates only. Your custom templates could not be loaded.');
      console.warn('Failed to load custom templates:', err);
      setTemplates(BUILT_IN_TEMPLATES);
    }
  }, [errorReporting]);

  // Save custom templates to localStorage
  const saveCustomTemplates = useCallback((customTemplates: NotebookTemplate[]) => {
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(customTemplates));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to save custom templates');
      errorReporting.reportUserError('Template Save Failed', 'Your custom template changes could not be saved and may be lost.', [
        {
          label: 'Retry',
          action: () => {
            try {
              localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(customTemplates));
              errorReporting.reportUserInfo('Templates Saved', 'Your templates have been saved successfully.');
            } catch {
              errorReporting.reportUserError('Save Failed Again', 'Unable to save templates. Please try again later.');
            }
          }
        },
        {
          label: 'OK',
          action: () => {} // No-op
        }
      ]);
      console.warn('Failed to save custom templates:', err);
    }
  }, [errorReporting]);

  const loadCards = useCallback(async () => {
    if (!db) return;

    setLoading(true);
    setError(null);

    const queryStart = performance.now();

    try {
      const rowsResult = execute<Record<string, unknown>>(
        `SELECT nc.*, n.name, n.node_type
         FROM notebook_cards nc
         JOIN nodes n ON nc.node_id = n.id
         WHERE n.deleted_at IS NULL
         ORDER BY nc.modified_at DESC`
      );

      // Handle both sync (sql.js) and async (native API) execute results
      const rows = Array.isArray(rowsResult) ? rowsResult : await rowsResult;

      const queryDuration = performance.now() - queryStart;
      performanceHook.measureQuery('loadCards', queryDuration);

      const notebookCards = rows.map(rowToNotebookCard);

      // Update cache with LRU eviction
      notebookCards.forEach(card => {
        if (cardCache.size >= maxCacheSize) {
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
            label: 'Continue Offline',
            action: () => {
              setError(null);
              errorReporting.reportUserInfo('Working Offline', 'You can continue using the notebook, but changes may not be saved.');
            }
          }
        ]
      );
      console.error('Failed to load notebook cards:', err);
    } finally {
      setLoading(false);
    }
  }, [db, execute, performanceHook, cardCache, maxCacheSize, errorReporting]);

  // Integration hook (with parameters to avoid circular dependency)
  const integrationHook = useNotebookIntegration({
    activeCard,
    cards,
    loadCards
  });

  const createCard = useCallback(async (type: NotebookCardType, templateId?: string): Promise<NotebookCard> => {
    if (!db) throw new Error('Database not initialized');

    const nodeId = crypto.randomUUID();
    const cardId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      // Find template if provided
      let template: NotebookTemplate | undefined;
      if (templateId) {
        template = templates.find(t => t.id === templateId);
        if (template) {
          // Increment usage count for custom templates
          if (template.category === 'custom') {
            template.usageCount = (template.usageCount || 0) + 1;
            const customTemplates = templates.filter(t => t.category === 'custom');
            saveCustomTemplates(customTemplates);
          }
        }
      }

      // Create node first
      const cardName = template ?
        template.markdownContent.split('\n')[0].replace(/^#\s*/, '') || `Untitled ${type} card` :
        `Untitled ${type} card`;

      execute(
        `INSERT INTO nodes (id, node_type, name, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?)`,
        [nodeId, 'notebook', cardName, now, now]
      );

      // Create notebook card with template content
      const cardTemplate = createNotebookCardTemplate(nodeId, template?.cardType || type);
      cardTemplate.id = cardId;
      cardTemplate.templateId = templateId || null;

      // Apply template content and properties
      if (template) {
        cardTemplate.markdownContent = template.markdownContent;
        cardTemplate.properties = { ...template.properties };
      }

      const rowData = notebookCardToRow(cardTemplate);
      execute(
        `INSERT INTO notebook_cards
         (id, node_id, markdown_content, rendered_content, properties, template_id, card_type, layout_position, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rowData.id,
          rowData.node_id,
          rowData.markdown_content,
          rowData.rendered_content,
          rowData.properties,
          rowData.template_id,
          rowData.card_type,
          rowData.layout_position,
          rowData.created_at,
          rowData.modified_at,
        ]
      );

      const newCard = cardTemplate as NotebookCard;
      setCards(prev => [newCard, ...prev]);
      setActiveCard(newCard);

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
            action: () => {
              setError(null);
              // User will need to manually retry the creation
            }
          },
          {
            label: 'OK',
            action: () => {
              setError(null);
            }
          }
        ]
      );
      throw error;
    }
  }, [db, execute, templates, saveCustomTemplates, errorReporting]);

  const updateCard = useCallback(async (id: string, updates: Partial<NotebookCard>): Promise<void> => {
    if (!db) throw new Error('Database not initialized');

    try {
      const now = new Date().toISOString();
      const updatesWithTimestamp = { ...updates, modifiedAt: now };
      const rowData = notebookCardToRow(updatesWithTimestamp);

      // Update only provided fields
      const fields = Object.keys(rowData).filter(key => rowData[key] !== undefined);
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => rowData[field]);

      execute(
        `UPDATE notebook_cards SET ${setClause} WHERE id = ?`,
        [...values, id]
      );

      // Update local state
      setCards(prev =>
        prev.map(card =>
          card.id === id ? { ...card, ...updatesWithTimestamp } : card
        )
      );

      // Update active card if it's the one being updated
      if (activeCard?.id === id) {
        setActiveCard(prev => prev ? { ...prev, ...updatesWithTimestamp } : null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update card');
      setError(error);

      errorReporting.reportUserError(
        'Failed to Update Card',
        'Your changes could not be saved. The card may be locked or there might be a database connection issue.',
        [
          {
            label: 'Retry Save',
            action: () => {
              setError(null);
              updateCard(id, updates).catch(() => {
                errorReporting.reportUserError('Save Still Failed', 'Unable to save your changes. They may be lost.');
              });
            }
          },
          {
            label: 'Continue Editing',
            action: () => {
              setError(null);
              errorReporting.reportUserWarning('Changes Not Saved', 'Continue editing, but remember to save your work elsewhere.');
            }
          }
        ]
      );
      throw error;
    }
  }, [db, execute, activeCard, errorReporting]);

  const deleteCard = useCallback(async (id: string): Promise<void> => {
    if (!db) throw new Error('Database not initialized');

    try {
      // Get the card to find its node_id
      const card = cards.find(c => c.id === id);
      if (!card) throw new Error('Card not found');

      // Delete the notebook card (will cascade to node via foreign key)
      execute('DELETE FROM notebook_cards WHERE id = ?', [id]);
      execute('UPDATE nodes SET deleted_at = datetime("now") WHERE id = ?', [card.nodeId]);

      // Update local state
      setCards(prev => prev.filter(card => card.id !== id));

      if (activeCard?.id === id) {
        setActiveCard(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete card');
      setError(error);

      errorReporting.reportUserError(
        'Failed to Delete Card',
        'The card could not be deleted. It may be in use or there might be a database connection issue.',
        [
          {
            label: 'Try Again',
            action: () => {
              setError(null);
              deleteCard(id).catch(() => {
                errorReporting.reportUserError('Delete Still Failed', 'Unable to delete the card. It will remain in your list.');
              });
            }
          },
          {
            label: 'Cancel',
            action: () => {
              setError(null);
            }
          }
        ]
      );
      throw error;
    }
  }, [db, execute, cards, activeCard, errorReporting]);

  const updateLayout = useCallback((component: keyof NotebookLayoutState, position: LayoutPosition) => {
    setLayout(prev => ({
      ...prev,
      [component]: position,
    }));
  }, []);

  const toggleNotebookMode = useCallback(() => {
    setIsNotebookMode(prev => !prev);
  }, []);

  // Template management methods
  const createTemplate = useCallback(async (name: string, description: string, fromCard: NotebookCard): Promise<NotebookTemplate> => {
    const now = new Date().toISOString();

    const newTemplate: NotebookTemplate = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      category: 'custom',
      cardType: fromCard.cardType,
      markdownContent: fromCard.markdownContent || '',
      properties: { ...(fromCard.properties || {}) },
      tags: [],
      createdAt: now,
      modifiedAt: now,
      usageCount: 0
    };

    const customTemplates = templates.filter(t => t.category === 'custom');
    const updatedCustomTemplates = [...customTemplates, newTemplate];

    saveCustomTemplates(updatedCustomTemplates);
    setTemplates([...BUILT_IN_TEMPLATES, ...updatedCustomTemplates]);

    return newTemplate;
  }, [templates, saveCustomTemplates]);

  const deleteTemplate = useCallback(async (templateId: string): Promise<void> => {
    try {
      const template = templates.find(t => t.id === templateId);
      if (!template || template.category === 'built-in') {
        throw new Error('Cannot delete built-in templates');
      }

      const customTemplates = templates.filter(t => t.category === 'custom' && t.id !== templateId);
      saveCustomTemplates(customTemplates);
      setTemplates([...BUILT_IN_TEMPLATES, ...customTemplates]);

      errorReporting.reportUserInfo('Template Deleted', `Template "${template.name}" has been deleted successfully.`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete template');
      errorReporting.reportUserError(
        'Failed to Delete Template',
        error.message === 'Cannot delete built-in templates'
          ? 'Built-in templates cannot be deleted.'
          : 'The template could not be deleted. Please try again.',
        [
          {
            label: 'OK',
            action: () => {} // No-op
          }
        ]
      );
      throw error;
    }
  }, [templates, saveCustomTemplates, errorReporting]);

  const updateTemplate = useCallback(async (templateId: string, updates: Partial<NotebookTemplate>): Promise<void> => {
    const template = templates.find(t => t.id === templateId);
    if (!template || template.category === 'built-in') {
      throw new Error('Cannot modify built-in templates');
    }

    const updatedTemplate = {
      ...template,
      ...updates,
      modifiedAt: new Date().toISOString()
    };

    const customTemplates = templates.filter(t => t.category === 'custom').map(t =>
      t.id === templateId ? updatedTemplate : t
    );

    saveCustomTemplates(customTemplates);
    setTemplates([...BUILT_IN_TEMPLATES, ...customTemplates]);
  }, [templates, saveCustomTemplates]);

  const duplicateTemplate = useCallback(async (templateId: string, newName: string): Promise<NotebookTemplate> => {
    const template = templates.find(t => t.id === templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const now = new Date().toISOString();
    const duplicatedTemplate: NotebookTemplate = {
      ...template,
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      description: `Copy of ${template.description}`,
      category: 'custom',
      createdAt: now,
      modifiedAt: now,
      usageCount: 0
    };

    const customTemplates = templates.filter(t => t.category === 'custom');
    const updatedCustomTemplates = [...customTemplates, duplicatedTemplate];

    saveCustomTemplates(updatedCustomTemplates);
    setTemplates([...BUILT_IN_TEMPLATES, ...updatedCustomTemplates]);

    return duplicatedTemplate;
  }, [templates, saveCustomTemplates]);

  const value: NotebookContextType = {
    activeCard,
    cards,
    layout,
    isNotebookMode,
    templates,
    loading,
    error,
    createCard,
    updateCard,
    deleteCard,
    setActiveCard,
    loadCards,
    createTemplate,
    deleteTemplate,
    updateTemplate,
    duplicateTemplate,
    updateLayout,
    toggleNotebookMode,

    // Integration features
    integrationStatus: {
      isMainAppConnected: integrationHook.isMainAppConnected,
      lastSyncTime: integrationHook.lastSyncTime,
      pendingChanges: integrationHook.pendingChanges,
      syncInProgress: integrationHook.syncInProgress,
      conflictedCards: integrationHook.conflictedCards,
      offlineQueueSize: integrationHook.offlineQueueSize
    },
    syncWithMainApp: integrationHook.forceSync,
    resolveConflicts: integrationHook.resolveConflict,
    enableOfflineMode: integrationHook.enableOfflineMode,
    disableOfflineMode: integrationHook.disableOfflineMode,

    // Performance features
    performanceMetrics: performanceHook.metrics,
    performanceAlerts: performanceHook.alerts,
    optimizationSuggestions: performanceHook.suggestions,
    performanceScore: performanceHook.performanceScore,
    performanceGrade: performanceHook.performanceGrade,
    startPerformanceMonitoring: performanceHook.startMonitoring,
    stopPerformanceMonitoring: performanceHook.stopMonitoring,
    measureRender: performanceHook.measureRender,
    measureQuery: performanceHook.measureQuery,
    clearPerformanceMetrics: performanceHook.clearMetrics,

    // Memory management
    cardCache,
    maxCacheSize,
    isOffline: !integrationHook.isMainAppConnected,
    pendingChanges: integrationHook.pendingChanges,
  };

  return (
    <NotebookContext.Provider value={value}>
      {children}
    </NotebookContext.Provider>
  );
}

export function useNotebook(): NotebookContextType {
  const context = useContext(NotebookContext);
  if (context === undefined) {
    throw new Error('useNotebook must be used within a NotebookProvider');
  }
  return context;
}