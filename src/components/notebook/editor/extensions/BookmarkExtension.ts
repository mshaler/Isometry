import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { BookmarkNode } from '../nodes/BookmarkNode';

export interface BookmarkAttributes {
  url: string;
  title: string;
  description: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bookmark: {
      setBookmark: (url?: string) => ReturnType;
    };
  }
}

export const BookmarkExtension = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true, // Non-editable inline content

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-url') || '',
        renderHTML: (attributes) => ({ 'data-url': attributes.url }),
      },
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') || '',
        renderHTML: (attributes) => ({ 'data-title': attributes.title }),
      },
      description: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-description') || '',
        renderHTML: (attributes) => ({ 'data-description': attributes.description }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-bookmark]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-bookmark': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkNode);
  },

  addCommands() {
    return {
      setBookmark: (url = '') => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { url, title: '', description: '' },
        });
      },
    };
  },
});
