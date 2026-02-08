import { useState, useCallback } from 'react';

export interface NotebookCard {
  id: string;
  content: string;
  type: 'capture' | 'shell' | 'preview';
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface NotebookIntegration {
  cards: NotebookCard[];
  isLoading: boolean;
  error: string | null;
  createCard: (content: string, type: NotebookCard['type']) => Promise<string>;
  updateCard: (id: string, content: string) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  getCard: (id: string) => NotebookCard | null;
}

/**
 * Hook for notebook integration functionality
 * Bridge eliminated - minimal notebook state management
 */
export function useNotebookIntegration(): NotebookIntegration {
  const [cards, setCards] = useState<NotebookCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createCard = useCallback(async (content: string, type: NotebookCard['type']): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const newCard: NotebookCard = {
        id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        type,
        created_at: new Date(),
        updated_at: new Date()
      };

      setCards(prev => [...prev, newCard]);
      return newCard.id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCard = useCallback(async (id: string, content: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      setCards(prev =>
        prev.map(card =>
          card.id === id
            ? { ...card, content, updated_at: new Date() }
            : card
        )
      );
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteCard = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      setCards(prev => prev.filter(card => card.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCard = useCallback((id: string): NotebookCard | null => {
    return cards.find(card => card.id === id) || null;
  }, [cards]);

  return {
    cards,
    isLoading,
    error,
    createCard,
    updateCard,
    deleteCard,
    getCard
  };
}