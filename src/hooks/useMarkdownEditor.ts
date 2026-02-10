import { useState, useCallback } from 'react';
import { devLogger } from '../utils/logging';

export interface MarkdownEditorState {
  content: string;
  isEditing: boolean;
  isDirty: boolean;
  lastSaved: Date | null;
  error: string | null;
}

export interface MarkdownEditor {
  state: MarkdownEditorState;
  setContent: (content: string) => void;
  startEditing: () => void;
  stopEditing: () => void;
  save: () => Promise<void>;
  reset: () => void;
  insertText: (text: string, position?: number) => void;
  replaceSelection: (text: string, start: number, end: number) => void;
}

/**
 * Hook for markdown editor functionality
 * Simplified markdown editing for notebook components
 */
export function useMarkdownEditor(initialContent = ''): MarkdownEditor {
  const [state, setState] = useState<MarkdownEditorState>({
    content: initialContent,
    isEditing: false,
    isDirty: false,
    lastSaved: null,
    error: null
  });

  const setContent = useCallback((content: string) => {
    setState(prev => ({
      ...prev,
      content,
      isDirty: content !== initialContent,
      error: null
    }));
  }, [initialContent]);

  const startEditing = useCallback(() => {
    setState(prev => ({
      ...prev,
      isEditing: true,
      error: null
    }));
  }, []);

  const stopEditing = useCallback(() => {
    setState(prev => ({
      ...prev,
      isEditing: false
    }));
  }, []);

  const save = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, error: null }));

    try {
      // In v4, this would save to sql.js database
      devLogger.debug('MarkdownEditor saving content');

      setState(prev => ({
        ...prev,
        isDirty: false,
        lastSaved: new Date()
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message
      }));
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      content: initialContent,
      isDirty: false,
      error: null
    }));
  }, [initialContent]);

  const insertText = useCallback((text: string, position?: number) => {
    setState(prev => {
      const content = prev.content;
      const insertPos = position ?? content.length;
      const newContent = content.slice(0, insertPos) + text + content.slice(insertPos);

      return {
        ...prev,
        content: newContent,
        isDirty: newContent !== initialContent,
        error: null
      };
    });
  }, [initialContent]);

  const replaceSelection = useCallback((text: string, start: number, end: number) => {
    setState(prev => {
      const content = prev.content;
      const newContent = content.slice(0, start) + text + content.slice(end);

      return {
        ...prev,
        content: newContent,
        isDirty: newContent !== initialContent,
        error: null
      };
    });
  }, [initialContent]);

  return {
    state,
    setContent,
    startEditing,
    stopEditing,
    save,
    reset,
    insertText,
    replaceSelection
  };
}