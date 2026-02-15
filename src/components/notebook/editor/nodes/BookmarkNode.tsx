import { useState, useMemo } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';

export function BookmarkNode({ node, updateAttributes }: NodeViewProps) {
  const [isEditing, setIsEditing] = useState(!node.attrs.url);
  const [inputUrl, setInputUrl] = useState(node.attrs.url || '');

  const hostname = useMemo(() => {
    try {
      return new URL(node.attrs.url).hostname;
    } catch {
      return '';
    }
  }, [node.attrs.url]);

  const faviconUrl = hostname
    ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
    : '';

  const handleSave = () => {
    if (inputUrl.trim()) {
      // Auto-add https:// if missing
      let finalUrl = inputUrl.trim();
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl;
      }
      updateAttributes({ url: finalUrl });
      setInputUrl(finalUrl);
    }
    setIsEditing(false);
  };

  if (isEditing || !node.attrs.url) {
    return (
      <NodeViewWrapper className="bookmark bookmark--editing">
        <input
          type="url"
          className="bookmark__input"
          placeholder="Paste URL and press Enter..."
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            }
            if (e.key === 'Escape') {
              setIsEditing(false);
            }
          }}
          onBlur={handleSave}
          autoFocus
        />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="bookmark">
      <a
        href={node.attrs.url}
        target="_blank"
        rel="noopener noreferrer"
        className="bookmark__link"
        onClick={(e) => e.stopPropagation()}
      >
        {faviconUrl && (
          <img
            src={faviconUrl}
            alt=""
            className="bookmark__favicon"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <div className="bookmark__content">
          <span className="bookmark__title">
            {node.attrs.title || hostname || node.attrs.url}
          </span>
          {node.attrs.description && (
            <span className="bookmark__description">{node.attrs.description}</span>
          )}
          <span className="bookmark__url">{node.attrs.url}</span>
        </div>
      </a>
      <button
        className="bookmark__edit"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        contentEditable={false}
      >
        Edit
      </button>
    </NodeViewWrapper>
  );
}
