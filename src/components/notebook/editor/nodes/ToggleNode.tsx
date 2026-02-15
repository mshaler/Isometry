import { useState } from 'react';
import { NodeViewWrapper, NodeViewContent, NodeViewProps } from '@tiptap/react';

export function ToggleNode({ node, updateAttributes }: NodeViewProps) {
  const [isOpen, setIsOpen] = useState<boolean>(node.attrs.open ?? true);
  const title = node.attrs.title || 'Toggle section';

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    updateAttributes({ open: newState });
  };

  return (
    <NodeViewWrapper className={`toggle ${isOpen ? 'toggle--open' : ''}`}>
      <div className="toggle__header" onClick={handleToggle}>
        <span className="toggle__icon" contentEditable={false}>
          {isOpen ? '\u25BC' : '\u25B6'}
        </span>
        <input
          type="text"
          className="toggle__title"
          value={title}
          onChange={(e) => updateAttributes({ title: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="Toggle title..."
        />
      </div>
      {isOpen && (
        <NodeViewContent className="toggle__content" />
      )}
    </NodeViewWrapper>
  );
}
