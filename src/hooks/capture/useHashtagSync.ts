/**
 * useHashtagSync - Extracts hashtags from TipTap editor
 *
 * Phase 97-02: Syncs #tag marks to PropertyEditor tags field
 *
 * This hook:
 * 1. Traverses the ProseMirror document
 * 2. Extracts all hashtag marks
 * 3. Calls onTagsChange with extracted tag array
 * 4. Debounces updates (500ms) to avoid excessive re-renders
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { debounce } from '@/utils/debounce';

export interface UseHashtagSyncOptions {
  /** Callback when hashtags change */
  onTagsChange: (tags: string[]) => void;
  /** Debounce delay in ms (default: 500) */
  debounceDelay?: number;
  /** Enable/disable sync (default: true) */
  enabled?: boolean;
}

export function useHashtagSync(
  editor: Editor | null,
  options: UseHashtagSyncOptions
) {
  const {
    onTagsChange,
    debounceDelay = 500,
    enabled = true,
  } = options;

  const lastTagsRef = useRef<string>('[]');

  /**
   * Extract all hashtags from the editor document
   */
  const extractTags = useCallback((): string[] => {
    if (!editor) return [];

    const tags: Set<string> = new Set();
    const doc = editor.state.doc;

    // Traverse all nodes in the document
    doc.descendants((node) => {
      // Check each mark on the node
      node.marks.forEach((mark) => {
        if (mark.type.name === 'hashtag') {
          const { tag } = mark.attrs;
          if (tag) {
            tags.add(tag);
          }
        }
      });
      return true; // Continue traversing
    });

    // Return sorted array for consistent comparison
    return Array.from(tags).sort();
  }, [editor]);

  /**
   * Debounced sync function
   */
  const debouncedSync = useCallback(
    debounce(() => {
      if (!enabled) return;

      const tags = extractTags();
      const serialized = JSON.stringify(tags);

      // Only trigger callback if tags actually changed
      if (serialized !== lastTagsRef.current) {
        lastTagsRef.current = serialized;
        onTagsChange(tags);
      }
    }, debounceDelay),
    [extractTags, onTagsChange, debounceDelay, enabled]
  );

  /**
   * Subscribe to editor updates
   */
  useEffect(() => {
    if (!editor || !enabled) return;

    const handleUpdate = () => {
      debouncedSync();
    };

    editor.on('update', handleUpdate);

    // Initial sync
    debouncedSync();

    return () => {
      editor.off('update', handleUpdate);
      debouncedSync.cancel();
    };
  }, [editor, enabled, debouncedSync]);

  /**
   * Force immediate sync (useful for save operations)
   */
  const syncNow = useCallback(() => {
    debouncedSync.cancel();
    const tags = extractTags();
    const serialized = JSON.stringify(tags);

    if (serialized !== lastTagsRef.current) {
      lastTagsRef.current = serialized;
      onTagsChange(tags);
    }

    return tags;
  }, [extractTags, onTagsChange, debouncedSync]);

  return {
    /** Force immediate sync */
    syncNow,
    /** Get current extracted tags without triggering callback */
    getTags: extractTags,
  };
}
