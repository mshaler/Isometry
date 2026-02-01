import React from 'react';
import type { SelectedFile } from './ImportWizard';

export interface ImportProgress {
  total: number;
  completed: number;
  failed: number;
  currentFile: string | null;
  percentage: number;
}

export interface ImportResult {
  success: boolean;
  fileName: string;
  nodeId?: string;
  error?: string;
  relationshipCount?: number;
  tableCount?: number;
  attachmentCount?: number;
}

interface ImportProgressProps {
  files: SelectedFile[];
  progress: ImportProgress | null;
  error: Error | null;
  results: ImportResult[];
  isImporting: boolean;
  onReset: () => void;
}

export const ImportProgress: React.FC<ImportProgressProps> = ({
  files,
  progress,
  error,
  results,
  isImporting,
  onReset,
}) => {
  const isComplete = progress && progress.completed + progress.failed === progress.total;
  const hasErrors = results.some(r => !r.success);

  const getStatusIcon = (result: ImportResult) => {
    if (result.success) {
      return (
        <div className="w-5 h-5 text-green-500">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    } else {
      return (
        <div className="w-5 h-5 text-red-500">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    }
  };

  return (
    <div className="import-progress">
      {/* Overall Progress */}
      <div className="progress-overview mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Import Progress
          </h3>
          {isComplete && (
            <button
              onClick={onReset}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Import More Files
            </button>
          )}
        </div>

        {progress && (
          <div className="progress-bar-container">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span>
                {progress.completed + progress.failed} of {progress.total} files
              </span>
              <span>{Math.round(progress.percentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            {progress.currentFile && isImporting && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Currently processing: {progress.currentFile}
              </p>
            )}
          </div>
        )}

        {isComplete && (
          <div className="completion-summary mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Import Complete
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="stat">
                <span className="text-gray-500 dark:text-gray-400">Total:</span>
                <span className="font-medium text-gray-900 dark:text-white ml-1">
                  {progress?.total || 0}
                </span>
              </div>
              <div className="stat">
                <span className="text-gray-500 dark:text-gray-400">Success:</span>
                <span className="font-medium text-green-600 ml-1">
                  {progress?.completed || 0}
                </span>
              </div>
              <div className="stat">
                <span className="text-gray-500 dark:text-gray-400">Failed:</span>
                <span className="font-medium text-red-600 ml-1">
                  {progress?.failed || 0}
                </span>
              </div>
              <div className="stat">
                <span className="text-gray-500 dark:text-gray-400">Success Rate:</span>
                <span className="font-medium text-gray-900 dark:text-white ml-1">
                  {progress ? Math.round((progress.completed / progress.total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Global Error */}
      {error && (
        <div className="global-error mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <h4 className="font-medium text-red-800 dark:text-red-200 mb-1">
            Import Error
          </h4>
          <p className="text-sm text-red-600 dark:text-red-300">
            {error.message}
          </p>
        </div>
      )}

      {/* Individual File Results */}
      <div className="file-results">
        <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
          File Details
        </h4>
        <div className="results-list space-y-2">
          {files.map((file, index) => {
            const result = results.find(r => r.fileName === file.name);
            const isProcessed = !!result;
            const isCurrent = progress?.currentFile === file.name && isImporting;

            return (
              <div
                key={index}
                className={`result-item p-3 rounded-lg border ${
                  isProcessed
                    ? result.success
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                    : isCurrent
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1">
                    {isProcessed ? (
                      getStatusIcon(result)
                    ) : isCurrent ? (
                      <div className="w-5 h-5 text-blue-500">
                        <div className="animate-spin rounded-full h-full w-full border-b-2 border-current"></div>
                      </div>
                    ) : (
                      <div className="w-5 h-5 text-gray-400">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="ml-3 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {file.name}
                      </p>
                      {result && result.success && (
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {result.relationshipCount !== undefined && (
                            <span>{result.relationshipCount} relationships</span>
                          )}
                          {result.tableCount !== undefined && (
                            <span>{result.tableCount} tables</span>
                          )}
                          {result.attachmentCount !== undefined && (
                            <span>{result.attachmentCount} attachments</span>
                          )}
                        </div>
                      )}
                      {result && result.error && (
                        <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                          {result.error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {isProcessed
                      ? result.success
                        ? 'Imported'
                        : 'Failed'
                      : isCurrent
                      ? 'Processing...'
                      : 'Pending'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Steps */}
      {isComplete && progress?.completed > 0 && (
        <div className="next-steps mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
            Import Successful!
          </h4>
          <p className="text-sm text-blue-600 dark:text-blue-300">
            Your markdown files have been imported successfully. The new nodes and their relationships
            are now available in your Isometry graph. You can view them in the main visualization
            or search for specific content.
          </p>
        </div>
      )}
    </div>
  );
};