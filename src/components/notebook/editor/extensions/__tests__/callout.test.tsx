/**
 * CalloutExtension Tests
 *
 * Phase 112-03: Unit tests for CalloutExtension TipTap node
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TestEditorWrapper, hasNodeType } from '@/test/tiptap/test-utils';
import { CalloutExtension } from '../CalloutExtension';
import { calloutTypes } from '@/test/tiptap/fixtures';

describe('CalloutExtension', () => {
  it('renders editor with callout extension loaded', async () => {
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, CalloutExtension] }}
      />
    );
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  it('inserts callout via setCallout command', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, CalloutExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Execute setCallout command
    editorRef!.commands.setCallout({ type: 'info' });

    // Verify callout node was inserted
    expect(hasNodeType(editorRef!, 'callout')).toBe(true);

    // Verify HTML contains callout attributes
    const html = editorRef!.getHTML();
    expect(html).toContain('data-callout');
    expect(html).toContain('data-type="info"');
  });

  it.each(calloutTypes)('supports callout type: %s', async (type) => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, CalloutExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert callout with specific type
    editorRef!.commands.setCallout({ type });

    // Verify the type attribute
    const html = editorRef!.getHTML();
    expect(html).toContain(`data-type="${type}"`);
  });

  it('contains nested paragraph content', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, CalloutExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert callout
    editorRef!.commands.setCallout({ type: 'warning' });

    // Verify it has nested paragraph structure
    const doc = editorRef!.state.doc;
    let hasNestedParagraph = false;
    doc.descendants((node, _pos, parent) => {
      if (parent?.type.name === 'callout' && node.type.name === 'paragraph') {
        hasNestedParagraph = true;
        return false;
      }
      return true;
    });

    expect(hasNestedParagraph).toBe(true);
  });

  it('defaults to info type when no type specified', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, CalloutExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert callout without type
    editorRef!.commands.setCallout({});

    // Verify default type is info
    const html = editorRef!.getHTML();
    expect(html).toContain('data-type="info"');
  });
});
