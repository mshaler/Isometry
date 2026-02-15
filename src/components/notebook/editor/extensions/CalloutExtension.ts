import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CalloutNode } from '../nodes/CalloutNode';

export type CalloutType = 'info' | 'warning' | 'tip' | 'error';

export interface CalloutAttributes {
  type: CalloutType;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: Partial<CalloutAttributes>) => ReturnType;
    };
  }
}

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: {
        default: 'info' as CalloutType,
        parseHTML: (element) => element.getAttribute('data-type') as CalloutType || 'info',
        renderHTML: (attributes) => ({ 'data-type': attributes.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNode);
  },

  addCommands() {
    return {
      setCallout: (attributes = {}) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { type: 'info', ...attributes },
          content: [{ type: 'paragraph' }],
        });
      },
    };
  },
});
