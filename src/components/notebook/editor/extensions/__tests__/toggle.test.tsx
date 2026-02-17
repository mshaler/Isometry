/**
 * ToggleExtension Tests
 *
 * Phase 112-03: Unit tests for ToggleExtension TipTap node
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TestEditorWrapper, hasNodeType } from '@/test/tiptap/test-utils';
import { ToggleExtension } from '../ToggleExtension';
import { sampleToggles } from '@/test/tiptap/fixtures';

describe('ToggleExtension', () => {
  it('renders editor with toggle extension loaded', async () => {
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, ToggleExtension] }}
      />
    );
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  it('inserts toggle via setToggle command', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, ToggleExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Execute setToggle command
    editorRef!.commands.setToggle();

    // Verify toggle node was inserted
    expect(hasNodeType(editorRef!, 'toggle')).toBe(true);

    // Verify HTML contains toggle attributes
    const html = editorRef!.getHTML();
    expect(html).toContain('data-toggle');
  });

  it('renders with data-title attribute', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, ToggleExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert toggle with custom title
    const testTitle = sampleToggles[0].title;
    editorRef!.commands.setToggle({ title: testTitle });

    // Verify the title attribute
    const html = editorRef!.getHTML();
    expect(html).toContain(`data-title="${testTitle}"`);
  });

  it('renders with data-open attribute', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, ToggleExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert toggle (defaults to open: true)
    editorRef!.commands.setToggle();

    // Verify the open attribute
    const html = editorRef!.getHTML();
    expect(html).toContain('data-open="true"');
  });

  it('contains nested paragraph content', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, ToggleExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert toggle
    editorRef!.commands.setToggle();

    // Verify it has nested paragraph structure
    const doc = editorRef!.state.doc;
    let hasNestedParagraph = false;
    doc.descendants((node, _pos, parent) => {
      if (parent?.type.name === 'toggle' && node.type.name === 'paragraph') {
        hasNestedParagraph = true;
        return false;
      }
      return true;
    });

    expect(hasNestedParagraph).toBe(true);
  });

  it('defaults to "Toggle section" title when none specified', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, ToggleExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert toggle without title
    editorRef!.commands.setToggle({});

    // Verify default title
    const html = editorRef!.getHTML();
    expect(html).toContain('data-title="Toggle section"');
  });

  it('supports closed state', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, ToggleExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert toggle with open: false
    editorRef!.commands.setToggle({ open: false });

    // Verify the open attribute is false
    const html = editorRef!.getHTML();
    expect(html).toContain('data-open="false"');
  });
});
