import React, { useState, useCallback } from 'react';
import { Upload, File, CheckCircle, AlertCircle, X } from 'lucide-react';
import { importOfficeFile, type OfficeImportResult, type OfficeImportOptions } from '../utils/officeDocumentProcessor';
import type { Node } from '../types/node';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (nodes: Node[]) => void;
  folder?: string;
}

interface FileStatus {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: OfficeImportResult;
  error?: string;
}

export function ImportWizard({ isOpen, onClose, onImportComplete, folder }: ImportWizardProps) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [importOptions, setImportOptions] = useState<OfficeImportOptions>({
    nodeType: 'document',
    folder: folder || undefined,
    source: 'bulk-import',
    preserveFormatting: true,
    extractTables: true
  });

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    const supportedExtensions = ['.xlsx', '.xls', '.docx', '.doc'];
    const validFiles = newFiles.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return supportedExtensions.includes(extension);
    });

    const fileStatuses: FileStatus[] = validFiles.map(file => ({
      file,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...fileStatuses]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const processFiles = useCallback(async () => {
    const allNodes: Node[] = [];

    for (let i = 0; i < files.length; i++) {
      const fileStatus = files[i];

      if (fileStatus.status !== 'pending') continue;

      // Update status to processing
      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'processing' } : f
      ));

      try {
        const result = await importOfficeFile(fileStatus.file, importOptions);

        // Update status to success
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'success', result } : f
        ));

        allNodes.push(...result.nodes);
      } catch (error) {
        // Update status to error
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? {
            ...f,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          } : f
        ));
      }
    }

    // Call completion handler with all imported nodes
    if (allNodes.length > 0 && onImportComplete) {
      onImportComplete(allNodes);
    }
  }, [files, importOptions, onImportComplete]);

  const resetWizard = useCallback(() => {
    setFiles([]);
    setImportOptions({
      nodeType: 'document',
      folder: folder || undefined,
      source: 'bulk-import',
      preserveFormatting: true,
      extractTables: true
    });
  }, [folder]);

  if (!isOpen) return null;

  const pendingFiles = files.filter(f => f.status === 'pending');
  const processingFiles = files.filter(f => f.status === 'processing');
  const successFiles = files.filter(f => f.status === 'success');
  const errorFiles = files.filter(f => f.status === 'error');

  const totalNodes = files.reduce((sum, f) => sum + (f.result?.nodes.length || 0), 0);
  const totalErrors = files.reduce((sum, f) => sum + (f.result?.errors.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Import Office Documents
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Import Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Import Settings</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Node Type
                </label>
                <select
                  value={importOptions.nodeType}
                  onChange={(e) => setImportOptions(prev => ({ ...prev, nodeType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                >
                  <option value="document">Document</option>
                  <option value="spreadsheet">Spreadsheet</option>
                  <option value="note">Note</option>
                  <option value="reference">Reference</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Folder
                </label>
                <input
                  type="text"
                  value={importOptions.folder || ''}
                  onChange={(e) => setImportOptions(prev => ({ ...prev, folder: e.target.value || undefined }))}
                  placeholder="Optional folder name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={importOptions.preserveFormatting}
                  onChange={(e) => setImportOptions(prev => ({ ...prev, preserveFormatting: e.target.checked }))}
                  className="mr-2"
                />
                Preserve Formatting
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={importOptions.extractTables}
                  onChange={(e) => setImportOptions(prev => ({ ...prev, extractTables: e.target.checked }))}
                  className="mr-2"
                />
                Extract Tables
              </label>
            </div>
          </div>

          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg mb-2 text-gray-900 dark:text-white">
              Drop your Office documents here
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supports XLSX, XLS, DOCX, DOC files
            </p>
            <input
              type="file"
              id="file-input"
              multiple
              accept=".xlsx,.xls,.docx,.doc"
              onChange={handleFileSelect}
              className="hidden"
            />
            <label
              htmlFor="file-input"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              Select Files
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Files ({files.length})
                </h3>
                <div className="flex space-x-2">
                  {pendingFiles.length > 0 && (
                    <button
                      onClick={processFiles}
                      disabled={processingFiles.length > 0}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      Import {pendingFiles.length} Files
                    </button>
                  )}
                  <button
                    onClick={resetWizard}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Import Summary */}
              {(successFiles.length > 0 || errorFiles.length > 0) && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="flex items-center text-green-600">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {totalNodes} nodes imported
                    </span>
                    {totalErrors > 0 && (
                      <span className="flex items-center text-red-600">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {totalErrors} errors
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* File Status List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((fileStatus, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <File className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-white">
                          {fileStatus.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Status Indicator */}
                      {fileStatus.status === 'pending' && (
                        <span className="text-sm text-gray-500">Pending</span>
                      )}
                      {fileStatus.status === 'processing' && (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm text-blue-600">Processing</span>
                        </div>
                      )}
                      {fileStatus.status === 'success' && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-600">
                            {fileStatus.result?.nodes.length || 0} nodes
                          </span>
                        </div>
                      )}
                      {fileStatus.status === 'error' && (
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-red-600 max-w-xs truncate" title={fileStatus.error}>
                            {fileStatus.error}
                          </span>
                        </div>
                      )}

                      {/* Remove Button */}
                      {fileStatus.status === 'pending' && (
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500">
            Supported formats: XLSX, XLS, DOCX, DOC
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Close
            </button>
            {totalNodes > 0 && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Done ({totalNodes} imported)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportWizard;