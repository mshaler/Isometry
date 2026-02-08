import { useState, useCallback, useEffect, useRef } from 'react';
import { useNotebook } from '../../contexts/NotebookContext';
import { debounce } from '../../utils/debounce';

interface UseMarkdownEditorOptions {
  autoSaveDelay?: number;
  enableAutoSave?: boolean;
}

export function useMarkdownEditor(options: UseMarkdownEditorOptions = {}) {
  const { autoSaveDelay = 2000, enableAutoSave = true } = options;
  const { activeCard, updateCard } = useNotebook();
  const [content, setContent] = useState(activeCard?.markdownContent || '');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-save functionality with debouncing
  const debouncedSave = useCallback(
    debounce(async (...args: unknown[]) => {
      const [cardId, newContent] = args as [string, string];
      if (!enableAutoSave) return;

      setIsSaving(true);
      try {
        await updateCard(cardId, {
          markdownContent: newContent,
          renderedContent: null // Let backend re-render
        });
        setIsDirty(false);
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }, autoSaveDelay),
    [updateCard, enableAutoSave, autoSaveDelay]
  );

  // Content change handler
  const handleContentChange = useCallback((value: string = '') => {
    setContent(value);
    setIsDirty(true);

    if (activeCard?.id && enableAutoSave) {
      debouncedSave(activeCard.id, value);
    }
  }, [activeCard?.id, enableAutoSave, debouncedSave]);

  // Manual save function
  const saveNow = useCallback(async () => {
    if (!activeCard?.id || !isDirty) return;

    setIsSaving(true);
    try {
      await updateCard(activeCard.id, {
        markdownContent: content,
        renderedContent: null
      });
      setIsDirty(false);
    } catch (error) {
      console.error('Manual save failed:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [activeCard?.id, content, isDirty, updateCard]);

  // Sync with active card changes
  useEffect(() => {
    if (activeCard?.markdownContent !== undefined) {
      setContent(activeCard.markdownContent || '');
      setIsDirty(false);
    }
  }, [activeCard?.id, activeCard?.markdownContent]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    content,
    setContent: handleContentChange,
    isDirty,
    isSaving,
    saveNow,
    activeCard
  };
}