import { useTheme } from '@/contexts/ThemeContext';
import { X, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import type { Node } from '@/types/node';

export interface CardProps {
  node: Node;
  onClose?: () => void;
}

/**
 * Card - Display full node details in an overlay
 *
 * Part of GridBlock 5 (z=2 Overlay Layer). Shows rich content for a selected node.
 * Displays: title, body content (truncated at 500 chars), metadata, tags.
 *
 * UX:
 * - Click X button to close
 * - Esc key to close (handled by CardOverlay parent)
 * - Click outside to close (handled by CardOverlay parent)
 */
export function Card({ node, onClose }: CardProps) {
  const { theme } = useTheme();
  const [isPropertiesExpanded, setIsPropertiesExpanded] = useState(true);

  // Truncate content if too long
  const maxContentLength = 500;
  const displayContent = node.content
    ? node.content.length > maxContentLength
      ? node.content.slice(0, maxContentLength) + '...'
      : node.content
    : node.summary || 'No content';

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Build properties list from node metadata
  const properties = [
    { label: 'Type', value: node.nodeType },
    { label: 'Folder', value: node.folder || 'None' },
    { label: 'Created', value: formatDate(node.createdAt) },
    { label: 'Modified', value: formatDate(node.modifiedAt) },
    { label: 'Priority', value: node.priority.toString() },
    { label: 'Importance', value: node.importance.toString() },
  ];

  return (
    <div
      className={`w-[400px] relative ${
        theme === 'NeXTSTEP'
          ? 'bg-white border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,1)]'
          : 'bg-white border-2 border-gray-900 rounded-lg shadow-2xl'
      }`}
      onClick={(e) => e.stopPropagation()} // Prevent click from bubbling to backdrop
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className={`absolute -top-3 -left-3 w-8 h-8 flex items-center justify-center ${
          theme === 'NeXTSTEP'
            ? 'bg-black text-white hover:bg-gray-800 border-2 border-white'
            : 'bg-red-500 text-white hover:bg-red-600 rounded-full shadow-lg'
        }`}
      >
        <X className="w-5 h-5" />
      </button>

      {/* Header */}
      <div
        className={`border-b-4 border-black p-4 ${theme === 'Modern' ? 'rounded-t-md' : ''}`}
      >
        <h1 className="text-2xl font-black uppercase tracking-tight mb-1">
          {node.name}
        </h1>
        {node.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {node.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-0.5 text-xs font-bold bg-gray-200 border border-gray-400 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Properties Table */}
      <div className="border-b-4 border-black">
        <button
          onClick={() => setIsPropertiesExpanded(!isPropertiesExpanded)}
          className="w-full flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border-b-2 border-black"
        >
          {isPropertiesExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <span className="font-bold text-xs uppercase tracking-wide">Properties</span>
        </button>
        {isPropertiesExpanded && (
          <div>
            {properties.map((prop, index) => (
              <div
                key={index}
                className={`flex border-b-2 border-black ${
                  index === properties.length - 1 ? 'border-b-0' : ''
                }`}
              >
                <div className="flex-1 px-4 py-2 border-r-2 border-black bg-gray-50">
                  <span className="font-bold text-sm uppercase tracking-wide">
                    {prop.label}
                  </span>
                </div>
                <div className="flex-1 px-4 py-2 bg-white">
                  <span className="text-sm font-medium">{prop.value}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 max-h-[200px] overflow-y-auto">
        <div className="text-xs font-bold uppercase tracking-wide mb-2 border-b-2 border-black pb-1">
          Content
        </div>
        <div className="text-sm whitespace-pre-wrap">{displayContent}</div>
      </div>

      {/* Footer */}
      <div
        className={`border-t-4 border-black px-4 py-2 bg-gray-50 ${
          theme === 'Modern' ? 'rounded-b-md' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">ID: {node.id.slice(0, 8)}</span>
          {node.sourceUrl && (
            <a
              href={node.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Open in source
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
