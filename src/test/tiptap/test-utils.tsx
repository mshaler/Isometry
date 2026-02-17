/**
 * TipTap Test Utilities
 *
 * Phase 112-03: Test infrastructure for TipTap extensions
 *
 * Provides React testing wrappers for TipTap editors.
 */

import { render, type RenderOptions } from '@testing-library/react';
import { useEditor, EditorContent, type Editor, type EditorOptions } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { type ReactNode, useEffect, useRef } from 'react';

export interface TestEditorOptions {
  content?: string;
  extensions?: EditorOptions['extensions'];
  editorProps?: EditorOptions['editorProps'];
  onCreate?: (editor: Editor) => void;
}

export interface TestEditorWrapperProps {
  options?: TestEditorOptions;
  children?: (editor: Editor) => ReactNode;
  onReady?: (editor: Editor) => void;
}

/**
 * TestEditorWrapper - A React component that wraps TipTap editor for testing
 *
 * Usage:
 * ```tsx
 * let editorRef: Editor | null = null;
 * render(
 *   <TestEditorWrapper
 *     options={{ extensions: [StarterKit, MyExtension] }}
 *   >
 *     {(editor) => { editorRef = editor; return null; }}
 *   </TestEditorWrapper>
 * );
 * await waitFor(() => expect(editorRef).not.toBeNull());
 * ```
 */
export function TestEditorWrapper({
  options,
  children,
  onReady,
}: TestEditorWrapperProps) {
  const hasCalledOnReady = useRef(false);

  const editor = useEditor({
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    extensions: options?.extensions ?? [StarterKit],
    content: options?.content ?? '',
    editorProps: {
      ...options?.editorProps,
      attributes: {
        role: 'textbox',
        'aria-label': 'Test Editor',
        ...options?.editorProps?.attributes,
      },
    },
    onCreate: ({ editor }) => {
      options?.onCreate?.(editor);
    },
  });

  // Call onReady when editor becomes available
  useEffect(() => {
    if (editor && !hasCalledOnReady.current) {
      hasCalledOnReady.current = true;
      onReady?.(editor);
    }
  }, [editor, onReady]);

  if (!editor) {
    return <div data-testid="editor-loading">Loading...</div>;
  }

  return (
    <>
      <EditorContent editor={editor} data-testid="editor-content" />
      {children?.(editor)}
    </>
  );
}

/**
 * Render helper that wraps component with TestEditorWrapper
 */
export function renderWithEditor(
  options?: TestEditorOptions,
  renderOptions?: Omit<RenderOptions, 'wrapper'>
) {
  return render(<TestEditorWrapper options={options} />, renderOptions);
}

/**
 * Create a test editor instance directly (for non-React tests)
 *
 * Note: This creates an editor without React rendering.
 * Use TestEditorWrapper for tests that need React integration.
 */
export async function createTestEditor(
  options?: TestEditorOptions
): Promise<Editor> {
  // Dynamic import to avoid circular dependencies
  const { Editor } = await import('@tiptap/core');

  const editor = new Editor({
    extensions: options?.extensions ?? [StarterKit],
    content: options?.content ?? '',
    editorProps: options?.editorProps,
  });

  return editor;
}

/**
 * Helper to wait for editor commands to settle
 *
 * TipTap commands are synchronous but React rendering is not.
 * Use this after commands when asserting on HTML output.
 */
export function waitForEditorUpdate(_editor: Editor): Promise<void> {
  return new Promise((resolve) => {
    // Use requestAnimationFrame to wait for DOM updates
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => resolve());
    } else {
      // JSDOM fallback
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Get the text content from editor, stripping HTML
 */
export function getEditorText(editor: Editor): string {
  return editor.getText();
}

/**
 * Get the HTML content from editor
 */
export function getEditorHTML(editor: Editor): string {
  return editor.getHTML();
}

/**
 * Check if editor contains a specific node type
 */
export function hasNodeType(editor: Editor, nodeType: string): boolean {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.type.name === nodeType) {
      found = true;
      return false; // Stop traversal
    }
    return true;
  });
  return found;
}

/**
 * Check if editor contains a specific mark type
 */
export function hasMarkType(editor: Editor, markType: string): boolean {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.marks.some((mark) => mark.type.name === markType)) {
      found = true;
      return false; // Stop traversal
    }
    return true;
  });
  return found;
}
