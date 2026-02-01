import React, { useState, useEffect } from 'react';

interface URLInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

export const URLInput: React.FC<URLInputProps> = ({
  onSubmit,
  isLoading,
  error,
  onRetry,
}) => {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Clear validation error when user types
  useEffect(() => {
    if (validationError && url) {
      setValidationError(null);
    }
  }, [url, validationError]);

  const validateURL = (urlString: string): boolean => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const normalizeURL = (urlString: string): string => {
    // Add protocol if missing
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      return `https://${urlString}`;
    }
    return urlString;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setValidationError('Please enter a URL');
      return;
    }

    const normalizedUrl = normalizeURL(url.trim());

    if (!validateURL(normalizedUrl)) {
      setValidationError('Please enter a valid URL');
      return;
    }

    setValidationError(null);
    onSubmit(normalizedUrl);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmedText = text.trim();

      // Check if the clipboard content looks like a URL
      if (trimmedText && (trimmedText.includes('.') || trimmedText.startsWith('http'))) {
        setUrl(trimmedText);
      }
    } catch (err) {
      console.warn('Could not read from clipboard:', err);
    }
  };

  const commonDomains = [
    'github.com',
    'stackoverflow.com',
    'medium.com',
    'dev.to',
    'news.ycombinator.com',
    'reddit.com',
  ];

  const handleDomainSuggestion = (domain: string) => {
    setUrl(`https://${domain}/`);
  };

  return (
    <div className="url-input">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Enter URL to Clip
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Paste a URL to extract and save the main content from any web page.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="url-input" className="sr-only">
            Website URL
          </label>
          <div className="relative">
            <input
              id="url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className={`w-full px-4 py-3 pr-20 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                validationError || error
                  ? 'border-red-300 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              disabled={isLoading}
              autoFocus
            />
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              disabled={isLoading}
            >
              Paste
            </button>
          </div>

          {validationError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {validationError}
            </p>
          )}

          {error && (
            <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error.message}
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
              isLoading || !url.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Extracting...
              </span>
            ) : (
              'Extract Content'
            )}
          </button>
        </div>
      </form>

      {/* Quick access domains */}
      <div className="mt-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Quick access to popular sites:
        </p>
        <div className="flex flex-wrap gap-2">
          {commonDomains.map((domain) => (
            <button
              key={domain}
              onClick={() => handleDomainSuggestion(domain)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full transition-colors"
              disabled={isLoading}
            >
              {domain}
            </button>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          Tips for best results:
        </h4>
        <ul className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
          <li>• Works best with articles, blog posts, and documentation</li>
          <li>• Automatically removes ads, navigation, and other clutter</li>
          <li>• Preserves images and formatting from the original page</li>
          <li>• Respects robots.txt and rate limits for ethical crawling</li>
        </ul>
      </div>
    </div>
  );
};