import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { NotebookCard, NotebookCardType, NotebookTemplate, LayoutPosition } from '../types/notebook';
import { createNotebookCardTemplate, rowToNotebookCard, notebookCardToRow } from '../types/notebook';
import { useDatabase } from '../db/DatabaseContext';

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

  // Methods
  createCard: (type: NotebookCardType, template?: string) => Promise<NotebookCard>;
  updateCard: (id: string, updates: Partial<NotebookCard>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  setActiveCard: (card: NotebookCard | null) => void;
  updateLayout: (component: keyof NotebookLayoutState, position: LayoutPosition) => void;
  toggleNotebookMode: () => void;
  loadCards: () => Promise<void>;
}

const NotebookContext = createContext<NotebookContextType | undefined>(undefined);

const LAYOUT_STORAGE_KEY = 'isometry-notebook-layout';
const DEFAULT_LAYOUT: NotebookLayoutState = {
  capture: { x: 0, y: 0, width: 400, height: 600 },
  shell: { x: 400, y: 0, width: 400, height: 300 },
  preview: { x: 400, y: 300, width: 400, height: 300 },
};

export function NotebookProvider({ children }: { children: ReactNode }) {
  const { db, execute } = useDatabase();
  const [activeCard, setActiveCard] = useState<NotebookCard | null>(null);
  const [cards, setCards] = useState<NotebookCard[]>([]);
  const [layout, setLayout] = useState<NotebookLayoutState>(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
    } catch {
      return DEFAULT_LAYOUT;
    }
  });
  const [isNotebookMode, setIsNotebookMode] = useState(false);
  const [templates] = useState<NotebookTemplate[]>([]); // TODO: Implement template management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Persist layout to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch (err) {
      console.warn('Failed to save layout to localStorage:', err);
    }
  }, [layout]);

  // Load cards on database ready
  useEffect(() => {
    if (db && isNotebookMode) {
      loadCards().catch(console.error);
    }
  }, [db, isNotebookMode]);

  const loadCards = useCallback(async () => {
    if (!db) return;

    setLoading(true);
    setError(null);

    try {
      const rows = execute<Record<string, unknown>>(
        `SELECT nc.*, n.name, n.node_type
         FROM notebook_cards nc
         JOIN nodes n ON nc.node_id = n.id
         WHERE n.deleted_at IS NULL
         ORDER BY nc.modified_at DESC`
      );

      const notebookCards = rows.map(rowToNotebookCard);
      setCards(notebookCards);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load cards');
      setError(error);
      console.error('Failed to load notebook cards:', err);
    } finally {
      setLoading(false);
    }
  }, [db, execute]);

  const createCard = useCallback(async (type: NotebookCardType, templateId?: string): Promise<NotebookCard> => {
    if (!db) throw new Error('Database not initialized');

    const nodeId = crypto.randomUUID();
    const cardId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      // Create node first
      execute(
        `INSERT INTO nodes (id, node_type, name, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?)`,
        [nodeId, 'notebook', `Untitled ${type} card`, now, now]
      );

      // Create notebook card
      const cardTemplate = createNotebookCardTemplate(nodeId, type);
      cardTemplate.id = cardId;
      if (templateId) {
        cardTemplate.templateId = templateId;
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
      throw error;
    }
  }, [db, execute]);

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
      throw error;
    }
  }, [db, execute, activeCard]);

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
      throw error;
    }
  }, [db, execute, cards, activeCard]);

  const updateLayout = useCallback((component: keyof NotebookLayoutState, position: LayoutPosition) => {
    setLayout(prev => ({
      ...prev,
      [component]: position,
    }));
  }, []);

  const toggleNotebookMode = useCallback(() => {
    setIsNotebookMode(prev => !prev);
  }, []);

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
    updateLayout,
    toggleNotebookMode,
    loadCards,
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