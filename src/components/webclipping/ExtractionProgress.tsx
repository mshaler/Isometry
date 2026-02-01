import React from 'react';

interface ExtractionProgressProps {
  url: string;
  isExtracting: boolean;
  progress: {
    step: string;
    percentage: number;
    details?: string;
  } | null;
  error: Error | null;
  onRetry: () => void;
  onCancel: () => void;
}

export const ExtractionProgress: React.FC<ExtractionProgressProps> = ({
  url,
  isExtracting,
  progress,
  error,
  onRetry,
  onCancel,
}) => {
  const getStepDescription = (step: string) => {
    switch (step) {
      case 'checking-robots':
        return 'Checking robots.txt permissions';
      case 'downloading':
        return 'Downloading page content';
      case 'extracting-content':
        return 'Extracting main content';
      case 'processing-images':
        return 'Processing and caching images';
      case 'extracting-metadata':
        return 'Extracting metadata';
      case 'cleaning-content':
        return 'Cleaning and formatting content';
      case 'finalizing':
        return 'Finalizing extraction';
      default:
        return 'Processing...';
    }
  };

  const extractionSteps = [
    { id: 'checking-robots', label: 'Permission Check' },
    { id: 'downloading', label: 'Download Page' },
    { id: 'extracting-content', label: 'Extract Content' },
    { id: 'processing-images', label: 'Process Images' },
    { id: 'extracting-metadata', label: 'Extract Metadata' },
    { id: 'cleaning-content', label: 'Clean Content' },
    { id: 'finalizing', label: 'Finalize' },
  ];

  const getCurrentStepIndex = () => {
    if (!progress?.step) return -1;
    return extractionSteps.findIndex(step => step.id === progress.step);
  };

  const currentStepIndex = getCurrentStepIndex();

  if (error) {
    return (
      <div className="extraction-progress">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Extraction Failed
          </h3>
          <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <div className="w-6 h-6 text-red-500 flex-shrink-0">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-red-800 dark:text-red-200">
                Failed to extract content from URL
              </h4>
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {error.message}
              </p>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">URL:</span> {url}
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onRetry}
            className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Common error solutions */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Troubleshooting Tips:
          </h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Check if the URL is accessible and working</li>
            <li>• Some sites block automated content extraction</li>
            <li>• Try a different article or page on the same site</li>
            <li>• Wait a moment and try again (rate limiting)</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="extraction-progress">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Extracting Content
        </h3>
        <div className="text-sm text-gray-600 dark:text-gray-400 break-all">
          <span className="font-medium">URL:</span> {url}
        </div>
      </div>

      {/* Overall Progress */}
      {progress && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {getStepDescription(progress.step)}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round(progress.percentage)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          {progress.details && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {progress.details}
            </p>
          )}
        </div>
      )}

      {/* Step-by-step Progress */}
      <div className="space-y-3">
        {extractionSteps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;

          return (
            <div key={step.id} className="flex items-center space-x-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                isCompleted
                  ? 'bg-green-500 text-white'
                  : isCurrent
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
              }`}>
                {isCompleted ? (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : isCurrent && isExtracting ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-xs font-medium">{index + 1}</span>
                )}
              </div>
              <span className={`text-sm ${
                isCompleted || isCurrent
                  ? 'text-gray-900 dark:text-white font-medium'
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Cancel button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          disabled={!isExtracting}
        >
          Cancel Extraction
        </button>
      </div>

      {/* Extraction info */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          What's happening:
        </h4>
        <ul className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
          <li>• Checking site permissions and rate limits</li>
          <li>• Downloading page content with privacy protection</li>
          <li>• Extracting main article text using readability algorithms</li>
          <li>• Caching images locally with deduplication</li>
          <li>• Removing tracking elements and ads</li>
        </ul>
      </div>
    </div>
  );
};