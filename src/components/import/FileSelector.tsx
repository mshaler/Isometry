import React, { useCallback, useState, useRef } from 'react';
import type { SelectedFile } from './ImportWizard';

interface FileSelectorProps {
  onFilesSelected: (files: SelectedFile[]) => void;
  selectedFiles: SelectedFile[];
}

export const FileSelector: React.FC<FileSelectorProps> = ({
  onFilesSelected,
  selectedFiles,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (fileList: FileList) => {
    setIsLoading(true);
    setError(null);

    try {
      const markdownFiles = Array.from(fileList).filter(
        file => file.name.endsWith('.md') || file.name.endsWith('.markdown')
      );

      if (markdownFiles.length === 0) {
        setError('No markdown files found. Please select .md or .markdown files.');
        setIsLoading(false);
        return;
      }

      const selectedFiles: SelectedFile[] = [];

      for (const file of markdownFiles) {
        try {
          const content = await readFileContent(file);
          selectedFiles.push({
            file,
            content,
            path: file.name,
            name: file.name.replace(/\.md$/, '').replace(/\.markdown$/, ''),
          });
        } catch (err) {
          console.error(`Failed to read file ${file.name}:`, err);
          setError(`Failed to read file: ${file.name}`);
        }
      }

      if (selectedFiles.length > 0) {
        onFilesSelected(selectedFiles);
      }
    } catch (err) {
      setError('Failed to process selected files');
      console.error('File processing error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [onFilesSelected]);

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsText(file, 'utf-8');
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="file-selector">
      {/* Drag and Drop Area */}
      <div
        className={`drop-zone border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md,.markdown"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center">
          <div className="w-16 h-16 mb-4 text-gray-400 dark:text-gray-500">
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              className="w-full h-full"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-gray-600 dark:text-gray-400">
                Reading files...
              </span>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Drop markdown files here
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Or click to browse for .md and .markdown files
              </p>
              <button
                onClick={handleBrowseClick}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Browse Files
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Selected Files Display */}
      {selectedFiles.length > 0 && (
        <div className="selected-files mt-6">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Selected Files ({selectedFiles.length})
          </h4>
          <div className="files-list space-y-2">
            {selectedFiles.map((selectedFile, index) => (
              <div
                key={index}
                className="file-item flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="file-info flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatFileSize(selectedFile.file.size)} • {selectedFile.path}
                  </p>
                </div>
                <div className="file-meta text-right">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    Markdown
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Button */}
      {selectedFiles.length > 0 && (
        <div className="next-action mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Ready to preview {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'}
          </p>
        </div>
      )}
    </div>
  );
};