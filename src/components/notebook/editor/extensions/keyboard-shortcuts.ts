import { Extension } from '@tiptap/core';

/**
 * AppleNotesShortcuts - Keyboard shortcuts matching Apple Notes behavior
 *
 * Shortcuts implemented:
 * - Cmd+Shift+L: Toggle checklist/task list
 * - Cmd+1-6: Set heading level 1-6
 * - Cmd+Shift+H: Insert horizontal rule
 * - Cmd+Shift+X: Toggle strikethrough
 * - Tab: Indent list item (when in list)
 * - Shift+Tab: Outdent list item (when in list)
 * - Cmd+[: Outdent (alternative)
 * - Cmd+]: Indent (alternative)
 *
 * Note: Basic formatting (Cmd+B, Cmd+I, Cmd+U) already provided by StarterKit
 */
export const AppleNotesShortcuts = Extension.create({
  name: 'appleNotesShortcuts',

  addKeyboardShortcuts() {
    return {
      // Checklist toggle (KEYS-01)
      'Mod-Shift-l': () => {
        // Try to toggle task list first, fall back to bullet list if not available
        return this.editor.chain().focus().toggleTaskList().run()
          || this.editor.chain().focus().toggleBulletList().run();
      },

      // Heading levels (KEYS-02)
      'Mod-1': () => this.editor.chain().focus().toggleHeading({ level: 1 }).run(),
      'Mod-2': () => this.editor.chain().focus().toggleHeading({ level: 2 }).run(),
      'Mod-3': () => this.editor.chain().focus().toggleHeading({ level: 3 }).run(),
      'Mod-4': () => this.editor.chain().focus().toggleHeading({ level: 4 }).run(),
      'Mod-5': () => this.editor.chain().focus().toggleHeading({ level: 5 }).run(),
      'Mod-6': () => this.editor.chain().focus().toggleHeading({ level: 6 }).run(),

      // Horizontal rule (KEYS-04)
      'Mod-Shift-h': () => this.editor.chain().focus().setHorizontalRule().run(),

      // Strikethrough (KEYS-05)
      'Mod-Shift-x': () => this.editor.chain().focus().toggleStrike().run(),

      // Indent/outdent (KEYS-03)
      'Tab': () => {
        // If in list, sink (indent)
        if (this.editor.isActive('bulletList') || this.editor.isActive('orderedList') || this.editor.isActive('taskList')) {
          return this.editor.chain().focus().sinkListItem('listItem').run()
            || this.editor.chain().focus().sinkListItem('taskItem').run();
        }
        // Otherwise, let default handle (insert tab or focus next element)
        return false;
      },
      'Shift-Tab': () => {
        // If in list, lift (outdent)
        if (this.editor.isActive('bulletList') || this.editor.isActive('orderedList') || this.editor.isActive('taskList')) {
          return this.editor.chain().focus().liftListItem('listItem').run()
            || this.editor.chain().focus().liftListItem('taskItem').run();
        }
        return false;
      },

      // Alternative indent/outdent (KEYS-03)
      'Mod-]': () => {
        if (this.editor.isActive('bulletList') || this.editor.isActive('orderedList') || this.editor.isActive('taskList')) {
          return this.editor.chain().focus().sinkListItem('listItem').run()
            || this.editor.chain().focus().sinkListItem('taskItem').run();
        }
        return false;
      },
      'Mod-[': () => {
        if (this.editor.isActive('bulletList') || this.editor.isActive('orderedList') || this.editor.isActive('taskList')) {
          return this.editor.chain().focus().liftListItem('listItem').run()
            || this.editor.chain().focus().liftListItem('taskItem').run();
        }
        return false;
      },
    };
  },
});
