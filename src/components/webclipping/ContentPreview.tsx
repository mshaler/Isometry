import React, { useState } from 'react';

interface ExtractedContent {
  title: string;
  content: string;
  summary?: string;
  url: string;
  metadata: {
    title?: string;
    description?: string;
    imageUrl?: string;
    siteName?: string;
    author?: string;
    publishedDate?: Date;
    tags?: string[];
  };
}

interface ContentPreviewProps {
  content: ExtractedContent;
  isSaving: boolean;
  onSave: () => void;
  onBack: () => void;
  onCancel: () => void;
}

export const ContentPreview: React.FC<ContentPreviewProps> = ({
  content,
  isSaving,
  onSave,
  onBack,
  onCancel,
}) => {
  const [showMetadata, setShowMetadata] = useState(false);

  const formatDate = (date?: Date) => {
    if (!date) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).length;
  };

  const getReadingTime = (text: string) => {
    const wordCount = getWordCount(text);
    const wordsPerMinute = 200; // Average reading speed
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  };

  return (
    <div className="content-preview">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Preview Clipped Content
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Review the extracted content before saving to your knowledge base.
        </p>
      </div>

      {/* Content stats */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-semibold text-gray-900 dark:text-white">
              {getWordCount(content.content)}
            </div>
            <div className="text-gray-500 dark:text-gray-400">Words</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900 dark:text-white">
              {getReadingTime(content.content)}
            </div>
            <div className="text-gray-500 dark:text-gray-400">Read Time</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900 dark:text-white">
              {content.metadata.tags?.length || 0}
            </div>
            <div className="text-gray-500 dark:text-gray-400">Tags</div>
          </div>
        </div>
      </div>

      {/* Metadata toggle */}
      <div className="mb-4">
        <button
          onClick={() => setShowMetadata(!showMetadata)}
          className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <svg
            className={`w-4 h-4 transform transition-transform ${showMetadata ? 'rotate-90' : 'rotate-0'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          <span>{showMetadata ? 'Hide' : 'Show'} Metadata</span>
        </button>
      </div>

      {/* Metadata section */}
      {showMetadata && (
        <div className="mb-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Extracted Metadata
          </h4>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Site:</span>
                <div className="font-medium text-gray-900 dark:text-white">
                  {content.metadata.siteName || 'Unknown'}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Author:</span>
                <div className="font-medium text-gray-900 dark:text-white">
                  {content.metadata.author || 'Unknown'}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Published:</span>
                <div className="font-medium text-gray-900 dark:text-white">
                  {formatDate(content.metadata.publishedDate)}
                </div>
              </div>
            </div>
            {content.metadata.description && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Description:</span>
                <div className="font-medium text-gray-900 dark:text-white mt-1">
                  {content.metadata.description}
                </div>
              </div>
            )}
            {content.metadata.tags && content.metadata.tags.length > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Tags:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {content.metadata.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <span className="text-gray-500 dark:text-gray-400">Source URL:</span>
              <div className="font-mono text-xs text-gray-700 dark:text-gray-300 break-all mt-1">
                {content.url}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content preview */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          Content Preview
        </h4>

        {/* Title */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {content.title}
          </h2>
          {content.summary && (
            <p className="text-gray-600 dark:text-gray-400 mt-2 italic">
              {content.summary}
            </p>
          )}
        </div>

        {/* Featured image */}
        {content.metadata.imageUrl && (
          <div className="mb-4">
            <img
              src={content.metadata.imageUrl}
              alt="Featured image"
              className="max-w-full h-48 object-cover rounded-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div
            className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-4"
            dangerouslySetInnerHTML={{
              __html: content.content.length > 2000
                ? content.content.substring(0, 2000) + '...'
                : content.content
            }}
          />
          {content.content.length > 2000 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Content truncated for preview. Full content will be saved.
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-3">
        <button
          onClick={onBack}
          className="flex-1 py-2 px-4 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
          disabled={isSaving}
        >
          Back
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className={`flex-2 py-2 px-6 rounded-lg font-medium transition-colors ${
            isSaving
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isSaving ? (
            <span className="flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Saving...
            </span>
          ) : (
            'Save to Knowledge Base'
          )}
        </button>
      </div>

      {/* Save info */}
      <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <p className="text-sm text-green-600 dark:text-green-300">
          <span className="font-medium">Ready to save:</span> This content will be added to your knowledge base
          as a web clip. Images will be cached locally and all tracking has been removed.
        </p>
      </div>
    </div>
  );
};