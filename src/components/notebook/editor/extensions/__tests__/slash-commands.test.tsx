/**
 * SlashCommands Extension Tests
 *
 * Phase 112-03: Unit tests for SlashCommands TipTap extension
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TestEditorWrapper } from '@/test/tiptap/test-utils';
import {
  SlashCommands,
  SLASH_COMMANDS,
  createSlashCommandSuggestion,
} from '../slash-commands';
import { expectedSlashCommandCategories, expectedSlashCommandIds } from '@/test/tiptap/fixtures';

describe('SlashCommands Extension', () => {
  describe('Extension Registration', () => {
    it('renders editor with slash commands extension loaded', async () => {
      render(
        <TestEditorWrapper
          options={{
            extensions: [
              StarterKit,
              SlashCommands.configure({
                suggestion: createSlashCommandSuggestion(() => ({
                  onStart: () => {},
                  onUpdate: () => {},
                  onExit: () => {},
                  onKeyDown: () => false,
                })),
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

  describe('SLASH_COMMANDS Registry', () => {
    it('contains expected categories', () => {
      const categories = [...new Set(SLASH_COMMANDS.map((c) => c.category))];
      expectedSlashCommandCategories.forEach((category) => {
        expect(categories).toContain(category);
      });
    });

    it('contains expected command IDs', () => {
      const ids = SLASH_COMMANDS.map((c) => c.id);
      expectedSlashCommandIds.forEach((id) => {
        expect(ids).toContain(id);
      });
    });

    it('all commands have required properties', () => {
      SLASH_COMMANDS.forEach((cmd) => {
        expect(cmd).toHaveProperty('id');
        expect(cmd).toHaveProperty('label');
        expect(cmd).toHaveProperty('description');
        expect(cmd).toHaveProperty('category');
        expect(cmd).toHaveProperty('action');
        expect(typeof cmd.id).toBe('string');
        expect(typeof cmd.label).toBe('string');
        expect(typeof cmd.description).toBe('string');
        expect(typeof cmd.action).toBe('function');
      });
    });

    it('command labels are unique', () => {
      const labels = SLASH_COMMANDS.map((c) => c.label);
      const uniqueLabels = [...new Set(labels)];
      expect(labels.length).toBe(uniqueLabels.length);
    });

    it('command IDs are unique', () => {
      const ids = SLASH_COMMANDS.map((c) => c.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  describe('Suggestion Configuration', () => {
    it('createSlashCommandSuggestion returns config with char "/"', () => {
      const suggestion = createSlashCommandSuggestion(() => ({}));
      expect(suggestion.char).toBe('/');
    });

    it('filters commands by query', () => {
      const suggestion = createSlashCommandSuggestion(() => ({}));
      const mockEditor = {} as Editor;

      // Test filtering for heading
      const headingItems = suggestion.items!({ query: 'head', editor: mockEditor });
      const headingIds = headingItems.map((c) => c.id);
      expect(headingIds.some((id) => id.includes('h'))).toBe(true);
    });

    it('returns all commands when query is empty', () => {
      const suggestion = createSlashCommandSuggestion(() => ({}));
      const mockEditor = {} as Editor;

      const allItems = suggestion.items!({ query: '', editor: mockEditor });
      expect(allItems.length).toBe(SLASH_COMMANDS.length);
    });

    it('filters by shortcut', () => {
      const suggestion = createSlashCommandSuggestion(() => ({}));
      const mockEditor = {} as Editor;

      // Test filtering by shortcut
      const codeItems = suggestion.items!({ query: 'code', editor: mockEditor });
      expect(codeItems.some((c) => c.shortcut === 'code')).toBe(true);
    });

    it('filters by description', () => {
      const suggestion = createSlashCommandSuggestion(() => ({}));
      const mockEditor = {} as Editor;

      // Test filtering by description
      const items = suggestion.items!({ query: 'visualization', editor: mockEditor });
      expect(items.length).toBeGreaterThan(0);
    });
  });

  describe('Command Actions', () => {
    it('h1 command exists and is callable', () => {
      const h1Command = SLASH_COMMANDS.find((c) => c.id === 'h1');
      expect(h1Command).toBeDefined();
      expect(typeof h1Command!.action).toBe('function');
    });

    it('callout command exists', () => {
      const calloutCommand = SLASH_COMMANDS.find((c) => c.id === 'callout');
      expect(calloutCommand).toBeDefined();
      expect(calloutCommand!.category).toBe('format');
    });

    it('toggle command exists', () => {
      const toggleCommand = SLASH_COMMANDS.find((c) => c.id === 'toggle');
      expect(toggleCommand).toBeDefined();
      expect(toggleCommand!.category).toBe('format');
    });

    it('bookmark command exists', () => {
      const bookmarkCommand = SLASH_COMMANDS.find((c) => c.id === 'bookmark');
      expect(bookmarkCommand).toBeDefined();
      expect(bookmarkCommand!.category).toBe('format');
    });

    it('isometry commands dispatch custom events', async () => {
      const saveCardCommand = SLASH_COMMANDS.find((c) => c.id === 'save-card');
      expect(saveCardCommand).toBeDefined();

      // Verify it dispatches isometry:save-card event
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      // Create mock editor and range
      const mockEditor = {
        chain: () => ({
          focus: () => ({
            deleteRange: () => ({
              run: () => true,
            }),
          }),
        }),
        getText: () => 'test content',
      } as unknown as Editor;

      const mockRange = { from: 0, to: 0 };

      saveCardCommand!.action({ editor: mockEditor, range: mockRange });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'isometry:save-card',
        })
      );

      dispatchSpy.mockRestore();
    });

    it('heading commands exist for h1-h6', () => {
      const headingLevels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      headingLevels.forEach((level) => {
        const cmd = SLASH_COMMANDS.find((c) => c.id === level);
        expect(cmd).toBeDefined();
        expect(cmd!.category).toBe('format');
      });
    });
  });

  describe('Isometry-Specific Commands', () => {
    it('contains pafv-query command', () => {
      const cmd = SLASH_COMMANDS.find((c) => c.id === 'pafv-query');
      expect(cmd).toBeDefined();
      expect(cmd!.category).toBe('isometry');
      expect(cmd!.content).toContain('PAFV Query');
    });

    it('contains latch-filter command', () => {
      const cmd = SLASH_COMMANDS.find((c) => c.id === 'latch-filter');
      expect(cmd).toBeDefined();
      expect(cmd!.category).toBe('isometry');
      expect(cmd!.content).toContain('Location');
    });

    it('contains graph-query command', () => {
      const cmd = SLASH_COMMANDS.find((c) => c.id === 'graph-query');
      expect(cmd).toBeDefined();
      expect(cmd!.category).toBe('isometry');
      expect(cmd!.content).toContain('RECURSIVE');
    });

    it('contains supergrid embed command', () => {
      const cmd = SLASH_COMMANDS.find((c) => c.id === 'supergrid');
      expect(cmd).toBeDefined();
      expect(cmd!.category).toBe('isometry');
    });

    it('contains network embed command', () => {
      const cmd = SLASH_COMMANDS.find((c) => c.id === 'network');
      expect(cmd).toBeDefined();
      expect(cmd!.category).toBe('isometry');
    });

    it('contains timeline embed command', () => {
      const cmd = SLASH_COMMANDS.find((c) => c.id === 'timeline');
      expect(cmd).toBeDefined();
      expect(cmd!.category).toBe('isometry');
    });
  });
});
