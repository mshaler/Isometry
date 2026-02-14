import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  List,
  ListOrdered,
  Quote,
  Code
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  theme?: 'NeXTSTEP' | 'Modern';
}

// Default state when editor state is not available
const defaultEditorState = {
  isBold: false,
  isItalic: false,
  isHeading1: false,
  isHeading2: false,
  isHeading3: false,
  isBulletList: false,
  isOrderedList: false,
  isBlockquote: false,
  isCode: false,
  canUndo: false,
  canRedo: false,
};

/**
 * EditorToolbar - Formatting toolbar for TipTap editor
 *
 * Uses useEditorState with selector pattern for optimal performance.
 * Only the specific states we need are subscribed to, preventing
 * unnecessary re-renders when other editor state changes.
 */
export function EditorToolbar({ editor, theme = 'Modern' }: EditorToolbarProps) {
  // Use selector pattern to only subscribe to the states we need
  // This prevents re-rendering the entire component on every keystroke
  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) return defaultEditorState;
      const ed = ctx.editor;
      // Type assertion needed because StarterKit commands are dynamically added
      const canCommands = ed.can() as unknown as {
        undo(): boolean;
        redo(): boolean;
      };
      return {
        isBold: ed.isActive('bold'),
        isItalic: ed.isActive('italic'),
        isHeading1: ed.isActive('heading', { level: 1 }),
        isHeading2: ed.isActive('heading', { level: 2 }),
        isHeading3: ed.isActive('heading', { level: 3 }),
        isBulletList: ed.isActive('bulletList'),
        isOrderedList: ed.isActive('orderedList'),
        isBlockquote: ed.isActive('blockquote'),
        isCode: ed.isActive('code'),
        canUndo: canCommands.undo(),
        canRedo: canCommands.redo(),
      };
    },
  }) ?? defaultEditorState;

  if (!editor) {
    return null;
  }

  const buttonClass = (isActive: boolean) => `
    p-1.5 rounded transition-colors
    ${isActive
      ? theme === 'NeXTSTEP'
        ? 'bg-[#0066cc] text-white'
        : 'bg-blue-500 text-white'
      : theme === 'NeXTSTEP'
        ? 'hover:bg-[#b0b0b0] text-gray-700'
        : 'hover:bg-gray-200 text-gray-700'
    }
  `;

  const disabledClass = (canPerform: boolean) => `
    p-1.5 rounded transition-colors
    ${canPerform
      ? theme === 'NeXTSTEP'
        ? 'hover:bg-[#b0b0b0] text-gray-700'
        : 'hover:bg-gray-200 text-gray-700'
      : 'opacity-50 cursor-not-allowed text-gray-400'
    }
  `;

  const dividerClass = `
    w-px h-5 mx-1
    ${theme === 'NeXTSTEP' ? 'bg-[#999999]' : 'bg-gray-300'}
  `;

  // Type assertion for editor with StarterKit commands
  // StarterKit adds these commands dynamically which TypeScript doesn't know about
  const ed = editor as unknown as {
    chain(): {
      focus(): {
        toggleBold(): { run(): void };
        toggleItalic(): { run(): void };
        toggleCode(): { run(): void };
        toggleHeading(opts: { level: number }): { run(): void };
        toggleBulletList(): { run(): void };
        toggleOrderedList(): { run(): void };
        toggleBlockquote(): { run(): void };
        undo(): { run(): void };
        redo(): { run(): void };
      };
    };
  };

  return (
    <div className={`
      flex items-center gap-0.5 p-1 border-b
      ${theme === 'NeXTSTEP'
        ? 'bg-[#d4d4d4] border-[#707070]'
        : 'bg-gray-50 border-gray-200'
      }
    `}>
      {/* Text formatting */}
      <button
        onClick={() => ed.chain().focus().toggleBold().run()}
        className={buttonClass(editorState.isBold)}
        title="Bold (Cmd+B)"
      >
        <Bold size={16} />
      </button>
      <button
        onClick={() => ed.chain().focus().toggleItalic().run()}
        className={buttonClass(editorState.isItalic)}
        title="Italic (Cmd+I)"
      >
        <Italic size={16} />
      </button>
      <button
        onClick={() => ed.chain().focus().toggleCode().run()}
        className={buttonClass(editorState.isCode)}
        title="Inline Code"
      >
        <Code size={16} />
      </button>

      <div className={dividerClass} />

      {/* Headings */}
      <button
        onClick={() => ed.chain().focus().toggleHeading({ level: 1 }).run()}
        className={buttonClass(editorState.isHeading1)}
        title="Heading 1"
      >
        <Heading1 size={16} />
      </button>
      <button
        onClick={() => ed.chain().focus().toggleHeading({ level: 2 }).run()}
        className={buttonClass(editorState.isHeading2)}
        title="Heading 2"
      >
        <Heading2 size={16} />
      </button>
      <button
        onClick={() => ed.chain().focus().toggleHeading({ level: 3 }).run()}
        className={buttonClass(editorState.isHeading3)}
        title="Heading 3"
      >
        <Heading3 size={16} />
      </button>

      <div className={dividerClass} />

      {/* Lists */}
      <button
        onClick={() => ed.chain().focus().toggleBulletList().run()}
        className={buttonClass(editorState.isBulletList)}
        title="Bullet List"
      >
        <List size={16} />
      </button>
      <button
        onClick={() => ed.chain().focus().toggleOrderedList().run()}
        className={buttonClass(editorState.isOrderedList)}
        title="Numbered List"
      >
        <ListOrdered size={16} />
      </button>
      <button
        onClick={() => ed.chain().focus().toggleBlockquote().run()}
        className={buttonClass(editorState.isBlockquote)}
        title="Blockquote"
      >
        <Quote size={16} />
      </button>

      <div className={dividerClass} />

      {/* Undo/Redo */}
      <button
        onClick={() => ed.chain().focus().undo().run()}
        disabled={!editorState.canUndo}
        className={disabledClass(editorState.canUndo)}
        title="Undo (Cmd+Z)"
      >
        <Undo size={16} />
      </button>
      <button
        onClick={() => ed.chain().focus().redo().run()}
        disabled={!editorState.canRedo}
        className={disabledClass(editorState.canRedo)}
        title="Redo (Cmd+Shift+Z)"
      >
        <Redo size={16} />
      </button>
    </div>
  );
}

