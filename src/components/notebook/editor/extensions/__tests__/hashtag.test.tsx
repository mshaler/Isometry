/**
 * HashtagExtension Tests
 *
 * Phase 112-03: Unit tests for HashtagExtension TipTap mark
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TestEditorWrapper, hasMarkType } from '@/test/tiptap/test-utils';
import { HashtagExtension, createHashtagSuggestion } from '../HashtagExtension';
import { testTags, queryTags } from '@/test/tiptap/fixtures';

describe('HashtagExtension', () => {
  describe('Extension Loading', () => {
    it('renders editor with hashtag extension loaded', async () => {
      render(
        <TestEditorWrapper
          options={{
            extensions: [
              StarterKit,
              HashtagExtension.configure({
                suggestion: createHashtagSuggestion(() => []),
              }),
            ],
          }}
        />
      );
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });
    });
  });

  describe('setHashtag Command', () => {
    it('applies hashtag mark with tag attribute', async () => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [
              StarterKit,
              HashtagExtension.configure({
                suggestion: {},
              }),
            ],
            content: '<p>Test hashtag</p>',
          }}
        >
          {(editor) => {
            editorRef = editor;
            return null;
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => expect(editorRef).not.toBeNull());

      // Select text and apply hashtag
      editorRef!.commands.selectAll();
      editorRef!.commands.setHashtag({ tag: 'project' });

      // Verify hashtag mark was applied
      expect(hasMarkType(editorRef!, 'hashtag')).toBe(true);

      // Verify HTML contains correct attributes
      const html = editorRef!.getHTML();
      expect(html).toContain('data-type="hashtag"');
      expect(html).toContain('data-tag="project"');
    });

    it('renders with hashtag CSS class', async () => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [
              StarterKit,
              HashtagExtension.configure({
                suggestion: {},
              }),
            ],
            content: '<p>Test text</p>',
          }}
        >
          {(editor) => {
            editorRef = editor;
            return null;
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => expect(editorRef).not.toBeNull());

      editorRef!.commands.selectAll();
      editorRef!.commands.setHashtag({ tag: 'important' });

      const html = editorRef!.getHTML();
      expect(html).toContain('class="hashtag"');
    });
  });

  describe('unsetHashtag Command', () => {
    it('removes hashtag mark', async () => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [
              StarterKit,
              HashtagExtension.configure({
                suggestion: {},
              }),
            ],
            content: '<p>Test text</p>',
          }}
        >
          {(editor) => {
            editorRef = editor;
            return null;
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => expect(editorRef).not.toBeNull());

      // Apply then remove hashtag
      editorRef!.commands.selectAll();
      editorRef!.commands.setHashtag({ tag: 'test' });
      expect(hasMarkType(editorRef!, 'hashtag')).toBe(true);

      editorRef!.commands.selectAll();
      editorRef!.commands.unsetHashtag();
      expect(hasMarkType(editorRef!, 'hashtag')).toBe(false);
    });
  });

  describe('Suggestion Configuration', () => {
    it('createHashtagSuggestion returns config with char "#"', () => {
      const suggestion = createHashtagSuggestion(() => []);
      expect(suggestion.char).toBe('#');
    });

    it('suggestion does not allow spaces', () => {
      const suggestion = createHashtagSuggestion(() => []);
      expect(suggestion.allowSpaces).toBe(false);
    });

    it('queries tags using provided function', () => {
      const queryFn = vi.fn().mockReturnValue(testTags);
      const suggestion = createHashtagSuggestion(queryFn);

      suggestion.items!({ query: 'pro', editor: {} as Editor });
      expect(queryFn).toHaveBeenCalledWith('pro');
    });

    it('returns matching tags from query', () => {
      const suggestion = createHashtagSuggestion(queryTags);

      const results = suggestion.items!({ query: 'meet', editor: {} as Editor });
      expect(results.length).toBeGreaterThan(0);
      expect(results).toContain('meeting');
    });
  });

  describe('Tag Selection', () => {
    it('calls onSelectFn when tag is selected', async () => {
      const onSelectFn = vi.fn();
      const suggestion = createHashtagSuggestion(() => testTags, onSelectFn);

      // Mock editor with chain commands
      const mockEditor = {
        chain: () => ({
          focus: () => ({
            deleteRange: () => ({
              insertContent: () => ({
                run: () => true,
              }),
            }),
          }),
        }),
      } as unknown as Editor;

      const mockRange = { from: 0, to: 5 };

      suggestion.command!({
        editor: mockEditor,
        range: mockRange,
        props: 'project',
      });

      expect(onSelectFn).toHaveBeenCalledWith('project');
    });

    it('does not throw when onSelectFn is undefined', async () => {
      const suggestion = createHashtagSuggestion(() => testTags);

      const mockEditor = {
        chain: () => ({
          focus: () => ({
            deleteRange: () => ({
              insertContent: () => ({
                run: () => true,
              }),
            }),
          }),
        }),
      } as unknown as Editor;

      const mockRange = { from: 0, to: 5 };

      expect(() => {
        suggestion.command!({
          editor: mockEditor,
          range: mockRange,
          props: 'project',
        });
      }).not.toThrow();
    });
  });

  describe('HTML Parsing', () => {
    it('parses hashtags from HTML', async () => {
      let editorRef: Editor | null = null;
      const htmlWithHashtag = `<p><span data-type="hashtag" data-tag="important" class="hashtag">#important</span></p>`;

      render(
        <TestEditorWrapper
          options={{
            extensions: [
              StarterKit,
              HashtagExtension.configure({
                suggestion: {},
              }),
            ],
            content: htmlWithHashtag,
          }}
        >
          {(editor) => {
            editorRef = editor;
            return null;
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => expect(editorRef).not.toBeNull());

      // Verify hashtag mark exists
      expect(hasMarkType(editorRef!, 'hashtag')).toBe(true);
    });
  });

  describe('Tag Variations', () => {
    it.each(testTags.slice(0, 5))('handles tag: %s', async (tag) => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [
              StarterKit,
              HashtagExtension.configure({
                suggestion: {},
              }),
            ],
            content: '<p>Test</p>',
          }}
        >
          {(editor) => {
            editorRef = editor;
            return null;
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => expect(editorRef).not.toBeNull());

      editorRef!.commands.selectAll();
      editorRef!.commands.setHashtag({ tag });

      const html = editorRef!.getHTML();
      expect(html).toContain(`data-tag="${tag}"`);
    });
  });
});
