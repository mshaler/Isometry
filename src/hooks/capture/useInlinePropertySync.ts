/**
 * useInlinePropertySync - Extracts inline properties from TipTap editor
 *
 * Phase 97-01: Syncs @key: value marks to PropertyEditor
 *
 * This hook:
 * 1. Traverses the ProseMirror document
 * 2. Extracts all inlineProperty marks
 * 3. Calls onPropertiesChange with extracted key-value pairs
 * 4. Debounces updates (500ms) to avoid excessive re-renders
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { debounce } from '@/utils/debounce';

export interface InlineProperties {
  [key: string]: string;
}

export interface UseInlinePropertySyncOptions {
  /** Callback when inline properties change */
  onPropertiesChange: (properties: InlineProperties) => void;
  /** Debounce delay in ms (default: 500) */
  debounceDelay?: number;
  /** Enable/disable sync (default: true) */
  enabled?: boolean;
}

export function useInlinePropertySync(
  editor: Editor | null,
  options: UseInlinePropertySyncOptions
) {
  const {
    onPropertiesChange,
    debounceDelay = 500,
    enabled = true,
  } = options;

  const lastPropertiesRef = useRef<string>('{}');

  /**
   * Extract all inline properties from the editor document
   */
  const extractProperties = useCallback((): InlineProperties => {
    if (!editor) return {};

    const properties: InlineProperties = {};
    const doc = editor.state.doc;

    // Traverse all nodes in the document
    doc.descendants((node) => {
      // Check each mark on the node
      node.marks.forEach((mark) => {
        if (mark.type.name === 'inlineProperty') {
          const { key, value } = mark.attrs;
          if (key && value) {
            // Later occurrences overwrite earlier ones (last wins)
            properties[key] = value;
          }
        }
      });
      return true; // Continue traversing
    });

    return properties;
  }, [editor]);

  /**
   * Debounced sync function
   */
  const debouncedSync = useCallback(
    debounce(() => {
      if (!enabled) return;

      const properties = extractProperties();
      const serialized = JSON.stringify(properties);

      // Only trigger callback if properties actually changed
      if (serialized !== lastPropertiesRef.current) {
        lastPropertiesRef.current = serialized;
        onPropertiesChange(properties);
      }
    }, debounceDelay),
    [extractProperties, onPropertiesChange, debounceDelay, enabled]
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
    const properties = extractProperties();
    const serialized = JSON.stringify(properties);

    if (serialized !== lastPropertiesRef.current) {
      lastPropertiesRef.current = serialized;
      onPropertiesChange(properties);
    }

    return properties;
  }, [extractProperties, onPropertiesChange, debouncedSync]);

  return {
    /** Force immediate sync */
    syncNow,
    /** Get current extracted properties without triggering callback */
    getProperties: extractProperties,
  };
}
