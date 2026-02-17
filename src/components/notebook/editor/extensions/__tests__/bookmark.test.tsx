/**
 * BookmarkExtension Tests
 *
 * Phase 112-03: Unit tests for BookmarkExtension TipTap node
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TestEditorWrapper, hasNodeType } from '@/test/tiptap/test-utils';
import { BookmarkExtension } from '../BookmarkExtension';
import { sampleBookmarks } from '@/test/tiptap/fixtures';

describe('BookmarkExtension', () => {
  it('renders editor with bookmark extension loaded', async () => {
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, BookmarkExtension] }}
      />
    );
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  it('inserts bookmark via setBookmark command', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, BookmarkExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Execute setBookmark command
    const testUrl = sampleBookmarks[0].url;
    editorRef!.commands.setBookmark(testUrl);

    // Verify bookmark node was inserted
    expect(hasNodeType(editorRef!, 'bookmark')).toBe(true);

    // Verify HTML contains bookmark attributes
    const html = editorRef!.getHTML();
    expect(html).toContain('data-bookmark');
  });

  it('stores url attribute', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, BookmarkExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert bookmark with URL
    const testUrl = sampleBookmarks[0].url;
    editorRef!.commands.setBookmark(testUrl);

    // Verify the URL attribute
    const html = editorRef!.getHTML();
    expect(html).toContain(`data-url="${testUrl}"`);
  });

  it('stores title attribute (empty by default)', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, BookmarkExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert bookmark
    editorRef!.commands.setBookmark('https://example.com');

    // Verify the title attribute exists (empty string)
    const html = editorRef!.getHTML();
    expect(html).toContain('data-title=""');
  });

  it('stores description attribute (empty by default)', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, BookmarkExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert bookmark
    editorRef!.commands.setBookmark('https://example.com');

    // Verify the description attribute exists (empty string)
    const html = editorRef!.getHTML();
    expect(html).toContain('data-description=""');
  });

  it('is an atomic node (non-editable)', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, BookmarkExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert bookmark
    editorRef!.commands.setBookmark('https://example.com');

    // Check node schema says it's atomic
    const bookmarkNodeType = editorRef!.schema.nodes.bookmark;
    expect(bookmarkNodeType).toBeDefined();
    expect(bookmarkNodeType.spec.atom).toBe(true);
  });

  it('handles empty URL', async () => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, BookmarkExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert bookmark without URL
    editorRef!.commands.setBookmark();

    // Verify bookmark still created with empty URL
    expect(hasNodeType(editorRef!, 'bookmark')).toBe(true);
    const html = editorRef!.getHTML();
    expect(html).toContain('data-url=""');
  });

  it.each(sampleBookmarks)('handles various URLs: $url', async (bookmark) => {
    let editorRef: Editor | null = null;
    render(
      <TestEditorWrapper
        options={{ extensions: [StarterKit, BookmarkExtension] }}
      >
        {(editor) => {
          editorRef = editor;
          return null;
        }}
      </TestEditorWrapper>
    );

    await waitFor(() => expect(editorRef).not.toBeNull());

    // Insert bookmark with test URL
    editorRef!.commands.setBookmark(bookmark.url);

    // Verify URL is stored correctly
    const html = editorRef!.getHTML();
    expect(html).toContain(`data-url="${bookmark.url}"`);
  });
});
