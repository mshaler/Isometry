import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useEditor, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { useNotebook } from '../../contexts/NotebookContext';
import { useSQLite } from '../../db/SQLiteProvider';
import { debounce } from '../../utils/debounce';
import {
  SlashCommands,
  createSlashCommandSuggestion,
  WikiLink,
  createWikiLinkSuggestion,
  type SlashCommand
} from '../../components/notebook/editor/extensions';
import {
  SlashCommandMenu,
  type SlashCommandMenuRef
} from '../../components/notebook/editor/SlashCommandMenu';
import {
  WikiLinkMenu,
  type WikiLinkMenuRef
} from '../../components/notebook/editor/WikiLinkMenu';
import {
  queryCardsForSuggestions,
  queryRecentCards,
  createLinkEdge,
  type CardSuggestion
} from '../../utils/editor/backlinks';

interface UseTipTapEditorOptions {
  autoSaveDelay?: number;
  enableAutoSave?: boolean;
}

/**
 * useTipTapEditor - TipTap editor hook with Markdown persistence
 *
 * This hook manages the TipTap editor lifecycle and auto-save functionality.
 * Content is stored as Markdown in sql.js (markdownContent column), NOT as
 * ProseMirror JSON. TipTap's internal JSON format is ephemeral.
 *
 * CRITICAL PERFORMANCE: The editor is configured with:
 * - immediatelyRender: true
 * - shouldRerenderOnTransaction: false
 *
 * Without shouldRerenderOnTransaction: false, documents with 10,000+ characters
 * will experience noticeable lag on every keystroke.
 */
export function useTipTapEditor(options: UseTipTapEditorOptions = {}) {
  const { autoSaveDelay = 2000, enableAutoSave = true } = options;
  const { activeCard, updateCard } = useNotebook();
  const { db } = useSQLite();
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const lastActiveCardIdRef = useRef<string | null>(null);
  const isUpdatingContentRef = useRef(false);

  // Query function for wiki link suggestions
  const queryCards = useCallback((query: string): CardSuggestion[] => {
    if (!query) {
      return queryRecentCards(db, 10);
    }
    return queryCardsForSuggestions(db, query, 10);
  }, [db]);

  // Handler when user selects a card to link
  const handleLinkSelect = useCallback((item: CardSuggestion, sourceCardId: string | undefined) => {
    if (sourceCardId && item.id !== sourceCardId) {
      createLinkEdge(db, sourceCardId, item.id);
    }
  }, [db]);

  // Memoize the activeCard nodeId to avoid re-creating extensions on every render
  const sourceCardId = useMemo(() => activeCard?.nodeId, [activeCard?.nodeId]);

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (...args: unknown[]) => {
      const [cardId, markdown] = args as [string, string];
      if (!enableAutoSave) return;

      setIsSaving(true);
      try {
        await updateCard(cardId, {
          markdownContent: markdown,
          renderedContent: null // Let backend re-render if needed
        });
        setIsDirty(false);
      } catch (error) {
        console.error('TipTap auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }, autoSaveDelay),
    [updateCard, enableAutoSave, autoSaveDelay]
  );

  // Create the TipTap editor instance with CRITICAL performance settings
  const editor = useEditor({
    // CRITICAL: These two settings are non-negotiable for performance
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,

    extensions: [
      StarterKit.configure({
        // StarterKit includes: bold, italic, code, heading, bulletList,
        // orderedList, blockquote, history (undo/redo), etc.
      }),
      Link.configure({
        openOnClick: false, // Don't open links on click while editing
        autolink: true, // Auto-detect URLs
      }),
      Placeholder.configure({
        placeholder: 'Type / for commands, [[ for links...',
      }),
      SlashCommands.configure({
        suggestion: createSlashCommandSuggestion(
          () => {
            let component: ReactRenderer<SlashCommandMenuRef>;
            let popup: TippyInstance[];

            return {
              onStart: (props: SuggestionProps<SlashCommand>) => {
                component = new ReactRenderer(SlashCommandMenu, {
                  props: {
                    items: props.items,
                    command: (item: SlashCommand) => props.command(item),
                  },
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },

              onUpdate: (props: SuggestionProps<SlashCommand>) => {
                component?.updateProps({
                  items: props.items,
                  command: (item: SlashCommand) => props.command(item),
                });

                if (!props.clientRect) return;

                popup?.[0]?.setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              },

              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === 'Escape') {
                  popup?.[0]?.hide();
                  return true;
                }

                return component?.ref?.onKeyDown(props) ?? false;
              },

              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          }
        ),
      }),
      WikiLink.configure({
        suggestion: createWikiLinkSuggestion(
          queryCards,
          handleLinkSelect,
          sourceCardId,
          () => {
            let component: ReactRenderer<WikiLinkMenuRef>;
            let popup: TippyInstance[];

            return {
              onStart: (props: SuggestionProps<CardSuggestion>) => {
                component = new ReactRenderer(WikiLinkMenu, {
                  props: {
                    items: props.items,
                    command: (item: CardSuggestion) => props.command(item),
                  },
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },

              onUpdate: (props: SuggestionProps<CardSuggestion>) => {
                component?.updateProps({
                  items: props.items,
                  command: (item: CardSuggestion) => props.command(item),
                });

                if (!props.clientRect) return;

                popup?.[0]?.setProps({
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                });
              },

              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === 'Escape') {
                  popup?.[0]?.hide();
                  return true;
                }

                return component?.ref?.onKeyDown(props) ?? false;
              },

              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          }
        ),
      }),
    ],

    content: activeCard?.markdownContent || '',

    onUpdate: ({ editor: ed }) => {
      // Skip if we're programmatically updating content
      if (isUpdatingContentRef.current) return;

      // Extract content from editor as text
      // TODO: Use proper markdown serialization when @tiptap/pm package is added
      const content = ed.getText();

      setIsDirty(true);

      // Trigger debounced save if we have an active card
      if (activeCard?.id && enableAutoSave) {
        debouncedSave(activeCard.id, content);
      }
    },
  });

  // Manual save function (for Cmd+S)
  const saveNow = useCallback(async () => {
    if (!editor || !activeCard?.id || !isDirty) return;

    // Extract content from editor as text
    // TODO: Use proper markdown serialization when @tiptap/pm package is added
    const content = editor.getText();

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
  }, [editor, activeCard?.id, isDirty, updateCard]);

  // Sync editor content when active card changes
  useEffect(() => {
    if (!editor) return;

    // Only update if the card ID has actually changed
    if (activeCard?.id !== lastActiveCardIdRef.current) {
      lastActiveCardIdRef.current = activeCard?.id || null;

      // Set flag to prevent onUpdate from firing during programmatic content update
      isUpdatingContentRef.current = true;

      // Update editor content with new card's markdown
      editor.commands.setContent(activeCard?.markdownContent || '');
      setIsDirty(false);

      // Clear flag after React has processed the update
      setTimeout(() => {
        isUpdatingContentRef.current = false;
      }, 0);
    }
  }, [editor, activeCard?.id, activeCard?.markdownContent]);

  // Cleanup debounced save on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  return {
    editor,
    isDirty,
    isSaving,
    saveNow,
    activeCard
  };
}

export default useTipTapEditor;
