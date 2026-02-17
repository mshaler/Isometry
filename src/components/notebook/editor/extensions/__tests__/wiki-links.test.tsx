/**
 * WikiLink Extension Tests
 *
 * Phase 112-03: Unit tests for WikiLink TipTap mark extension
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TestEditorWrapper, hasMarkType } from '@/test/tiptap/test-utils';
import { WikiLink, createWikiLinkSuggestion } from '../wiki-links';
import { testCards, queryCardsByName } from '@/test/tiptap/fixtures';

describe('WikiLink Extension', () => {
  describe('Extension Loading', () => {
    it('renders editor with wiki link extension loaded', async () => {
      render(
        <TestEditorWrapper
          options={{
            extensions: [
              StarterKit,
              WikiLink.configure({
                suggestion: createWikiLinkSuggestion(
                  () => [],
                  () => {},
                  undefined,
                  () => ({})
                ),
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

  describe('setWikiLink Command', () => {
    it('applies wiki link mark with href and title', async () => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [
              StarterKit,
              WikiLink.configure({
                suggestion: {},
              }),
            ],
            content: '<p>Test link text</p>',
          }}
        >
          {(editor) => {
            editorRef = editor;
            return null;
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => expect(editorRef).not.toBeNull());

      // Select text and apply wiki link
      editorRef!.commands.selectAll();
      editorRef!.commands.setWikiLink({
        href: '#card-001',
        title: 'Project Overview',
      });

      // Verify wiki link mark was applied
      expect(hasMarkType(editorRef!, 'wikiLink')).toBe(true);

      // Verify HTML contains correct attributes
      const html = editorRef!.getHTML();
      expect(html).toContain('data-type="wiki-link"');
      expect(html).toContain('href="#card-001"');
      expect(html).toContain('title="Project Overview"');
    });

    it('renders with wiki-link CSS class', async () => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [
              StarterKit,
              WikiLink.configure({
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
      editorRef!.commands.setWikiLink({
        href: '#card-002',
        title: 'Meeting Notes',
      });

      const html = editorRef!.getHTML();
      expect(html).toContain('class="wiki-link');
    });
  });

  describe('unsetWikiLink Command', () => {
    it('removes wiki link mark', async () => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [
              StarterKit,
              WikiLink.configure({
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

      // Apply then remove wiki link
      editorRef!.commands.selectAll();
      editorRef!.commands.setWikiLink({ href: '#test', title: 'Test' });
      expect(hasMarkType(editorRef!, 'wikiLink')).toBe(true);

      editorRef!.commands.selectAll();
      editorRef!.commands.unsetWikiLink();
      expect(hasMarkType(editorRef!, 'wikiLink')).toBe(false);
    });
  });

  describe('Suggestion Configuration', () => {
    it('createWikiLinkSuggestion returns config with char "[["', () => {
      const suggestion = createWikiLinkSuggestion(
        () => [],
        () => {},
        undefined,
        () => ({})
      );
      expect(suggestion.char).toBe('[[');
    });

    it('suggestion allows spaces in query', () => {
      const suggestion = createWikiLinkSuggestion(
        () => [],
        () => {},
        undefined,
        () => ({})
      );
      expect(suggestion.allowSpaces).toBe(true);
    });

    it('queries cards using provided function', () => {
      const queryFn = vi.fn().mockReturnValue(testCards);
      const suggestion = createWikiLinkSuggestion(
        queryFn,
        () => {},
        undefined,
        () => ({})
      );

      suggestion.items!({ query: 'Project', editor: {} as Editor });
      expect(queryFn).toHaveBeenCalledWith('Project');
    });

    it('returns matching cards from query', () => {
      const suggestion = createWikiLinkSuggestion(
        queryCardsByName,
        () => {},
        undefined,
        () => ({})
      );

      const results = suggestion.items!({ query: 'Meeting', editor: {} as Editor });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('Meeting');
    });
  });

  describe('Card Selection', () => {
    it('calls onSelectFn when card is selected', async () => {
      const onSelectFn = vi.fn();
      const suggestion = createWikiLinkSuggestion(
        () => testCards,
        onSelectFn,
        'source-card-123',
        () => ({})
      );

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
      const selectedCard = testCards[0];

      suggestion.command!({
        editor: mockEditor,
        range: mockRange,
        props: selectedCard,
      });

      expect(onSelectFn).toHaveBeenCalledWith(selectedCard, 'source-card-123');
    });
  });

  describe('HTML Serialization', () => {
    it('renders wiki links as anchor tags with data-type attribute', async () => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [
              StarterKit,
              WikiLink.configure({
                suggestion: {},
              }),
            ],
            content: '<p>Link text</p>',
          }}
        >
          {(editor) => {
            editorRef = editor;
            return null;
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => expect(editorRef).not.toBeNull());

      // Apply wiki link
      editorRef!.commands.selectAll();
      editorRef!.commands.setWikiLink({
        href: '#card-003',
        title: 'Test Card',
      });

      // Get HTML output and verify it has correct structure
      const html = editorRef!.getHTML();
      expect(html).toContain('<a');
      expect(html).toContain('data-type="wiki-link"');
      expect(html).toContain('href="#card-003"');
      expect(html).toContain('title="Test Card"');
    });
  });
});
