/**
 * InlinePropertyExtension Tests
 *
 * Phase 112-03: Unit tests for InlinePropertyExtension TipTap mark
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TestEditorWrapper, hasMarkType } from '@/test/tiptap/test-utils';
import { InlinePropertyExtension } from '../InlinePropertyExtension';
import { testInlineProperties } from '@/test/tiptap/fixtures';

describe('InlinePropertyExtension', () => {
  describe('Extension Loading', () => {
    it('renders editor with inline property extension loaded', async () => {
      render(
        <TestEditorWrapper
          options={{
            extensions: [StarterKit, InlinePropertyExtension],
          }}
        />
      );
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });
    });
  });

  describe('setInlineProperty Command', () => {
    it('applies inline property mark with key and value', async () => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [StarterKit, InlinePropertyExtension],
            content: '<p>Test property</p>',
          }}
        >
          {(editor) => {
            editorRef = editor;
            return null;
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => expect(editorRef).not.toBeNull());

      // Select text and apply inline property
      editorRef!.commands.selectAll();
      editorRef!.commands.setInlineProperty({ key: 'status', value: 'active' });

      // Verify inline property mark was applied
      expect(hasMarkType(editorRef!, 'inlineProperty')).toBe(true);

      // Verify HTML contains correct attributes
      const html = editorRef!.getHTML();
      expect(html).toContain('data-type="inline-property"');
      expect(html).toContain('data-key="status"');
      expect(html).toContain('data-value="active"');
    });

    it('renders with inline-property CSS class', async () => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [StarterKit, InlinePropertyExtension],
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
      editorRef!.commands.setInlineProperty({ key: 'priority', value: 'high' });

      const html = editorRef!.getHTML();
      expect(html).toContain('class="inline-property"');
    });
  });

  describe('unsetInlineProperty Command', () => {
    it('removes inline property mark', async () => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [StarterKit, InlinePropertyExtension],
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

      // Apply then remove inline property
      editorRef!.commands.selectAll();
      editorRef!.commands.setInlineProperty({ key: 'test', value: 'value' });
      expect(hasMarkType(editorRef!, 'inlineProperty')).toBe(true);

      editorRef!.commands.selectAll();
      editorRef!.commands.unsetInlineProperty();
      expect(hasMarkType(editorRef!, 'inlineProperty')).toBe(false);
    });
  });

  describe('Input Rule', () => {
    it('has input rule pattern for @key: value syntax', () => {
      // The pattern is: /@(\w+):\s*(\S+)\s$/
      // Test the regex directly
      const pattern = /@(\w+):\s*(\S+)\s$/;

      // Should match
      expect('@status: active '.match(pattern)).not.toBeNull();
      expect('@priority: high '.match(pattern)).not.toBeNull();
      expect('@due: 2026-02-28 '.match(pattern)).not.toBeNull();

      // Should not match (missing space at end)
      expect('@status: active'.match(pattern)).toBeNull();

      // Should not match (missing value)
      expect('@status: '.match(pattern)).toBeNull();
    });

    it('extracts key and value from pattern', () => {
      const pattern = /@(\w+):\s*(\S+)\s$/;

      const match = '@status: active '.match(pattern);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('status');
      expect(match![2]).toBe('active');
    });

    it.each(testInlineProperties)('matches property: @$key: $value', ({ key, value }) => {
      const pattern = /@(\w+):\s*(\S+)\s$/;
      const input = `@${key}: ${value} `;

      const match = input.match(pattern);
      expect(match).not.toBeNull();
      expect(match![1]).toBe(key);
      expect(match![2]).toBe(value);
    });
  });

  describe('HTML Parsing', () => {
    it('parses inline properties from HTML', async () => {
      let editorRef: Editor | null = null;
      const htmlWithProperty = `<p><span data-type="inline-property" data-key="status" data-value="active" class="inline-property">@status: active</span></p>`;

      render(
        <TestEditorWrapper
          options={{
            extensions: [StarterKit, InlinePropertyExtension],
            content: htmlWithProperty,
          }}
        >
          {(editor) => {
            editorRef = editor;
            return null;
          }}
        </TestEditorWrapper>
      );

      await waitFor(() => expect(editorRef).not.toBeNull());

      // Verify inline property mark exists
      expect(hasMarkType(editorRef!, 'inlineProperty')).toBe(true);
    });
  });

  describe('Property Variations', () => {
    it.each(testInlineProperties)('handles property: @$key: $value', async ({ key, value }) => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [StarterKit, InlinePropertyExtension],
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
      editorRef!.commands.setInlineProperty({ key, value });

      const html = editorRef!.getHTML();
      expect(html).toContain(`data-key="${key}"`);
      expect(html).toContain(`data-value="${value}"`);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty key', async () => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [StarterKit, InlinePropertyExtension],
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
      // Apply with empty key - should still apply the mark
      editorRef!.commands.setInlineProperty({ key: '', value: 'value' });

      expect(hasMarkType(editorRef!, 'inlineProperty')).toBe(true);
    });

    it('handles special characters in value', async () => {
      let editorRef: Editor | null = null;
      render(
        <TestEditorWrapper
          options={{
            extensions: [StarterKit, InlinePropertyExtension],
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
      editorRef!.commands.setInlineProperty({ key: 'url', value: 'https://example.com' });

      const html = editorRef!.getHTML();
      expect(html).toContain('data-value="https://example.com"');
    });
  });
});
