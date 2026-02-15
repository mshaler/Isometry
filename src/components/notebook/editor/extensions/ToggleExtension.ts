import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ToggleNode } from '../nodes/ToggleNode';

export interface ToggleAttributes {
  title: string;
  open: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggle: {
      setToggle: (attributes?: Partial<ToggleAttributes>) => ReturnType;
    };
  }
}

export const ToggleExtension = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      title: {
        default: 'Toggle section',
        parseHTML: (element) => element.getAttribute('data-title') || 'Toggle section',
        renderHTML: (attributes) => ({ 'data-title': attributes.title }),
      },
      open: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-open') === 'true',
        renderHTML: (attributes) => ({ 'data-open': String(attributes.open) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-toggle]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toggle': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleNode);
  },

  addCommands() {
    return {
      setToggle: (attributes = {}) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { title: 'Toggle section', open: true, ...attributes },
          content: [{ type: 'paragraph' }],
        });
      },
    };
  },
});
