import { useCallback } from 'react';
import { EditorContent, type Editor } from '@tiptap/react';

interface TipTapEditorProps {
  editor: Editor | null;
  className?: string;
}

/**
 * TipTapEditor - Core editor component for the Capture pane
 *
 * CRITICAL PERFORMANCE NOTE:
 * The editor instance must be created with these settings in useTipTapEditor:
 * - immediatelyRender: true
 * - shouldRerenderOnTransaction: false
 *
 * Without shouldRerenderOnTransaction: false, documents with 10,000+ characters
 * will experience noticeable lag on every keystroke as React re-renders.
 *
 * This component only renders the EditorContent - the editor configuration
 * and state management is handled by useTipTapEditor hook.
 */
export function TipTapEditor({ editor, className }: TipTapEditorProps) {
  // Focus editor and move cursor to end when clicking empty space
  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!editor) return;

    // Only handle clicks on the container itself, not on existing content
    const target = e.target as HTMLElement;
    if (target.closest('.ProseMirror') && !target.classList.contains('ProseMirror')) {
      // Clicked on content inside ProseMirror, let it handle naturally
      return;
    }

    // Focus the editor
    editor.commands.focus('end');
  }, [editor]);

  if (!editor) {
    return (
      <div className={`${className} flex items-center justify-center text-gray-400`}>
        Loading editor...
      </div>
    );
  }

  return (
    <div
      className={`${className || ''} tiptap-editor prose prose-sm max-w-none h-full`}
      onClick={handleContainerClick}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

