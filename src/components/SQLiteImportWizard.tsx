import React, { useState, useCallback } from 'react';
import { Database, Upload, FileText, CheckCircle, AlertCircle, X, Settings } from 'lucide-react';
import { SQLiteSyncManager, type SQLiteSyncResult, type SQLiteSyncOptions } from '../utils/sqliteSyncManager';
import type { Node } from '../types/node';

interface SQLiteImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (result: SQLiteSyncResult, nodes: Node[]) => void;
}

interface ImportStatus {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: SQLiteSyncResult;
  error?: string;
  nodes?: Node[];
}

export function SQLiteImportWizard({ isOpen, onClose, onImportComplete }: SQLiteImportWizardProps) {
  const [files, setFiles] = useState<ImportStatus[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [syncOptions, setSyncOptions] = useState<SQLiteSyncOptions>({
    batchSize: 500,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    enabledSources: ['notes', 'reminders', 'calendar', 'contacts', 'safari']
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

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
    const supportedExtensions = ['.sqlite', '.db', '.sqlite3', '.sqlitedb'];
    const validFiles = newFiles.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return supportedExtensions.includes(extension) ||
             file.name.toLowerCase().includes('sqlite') ||
             file.name.toLowerCase().includes('.db');
    });

    const importStatuses: ImportStatus[] = validFiles.map(file => ({
      file,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...importStatuses]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const processFiles = useCallback(async () => {
    const syncManager = new SQLiteSyncManager(syncOptions);
    const allNodes: Node[] = [];
    let totalResult: SQLiteSyncResult = {
      imported: 0,
      failed: 0,
      errors: [],
      sources: []
    };

    for (let i = 0; i < files.length; i++) {
      const fileStatus = files[i];

      if (fileStatus.status !== 'pending') continue;

      // Update status to processing
      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'processing' } : f
      ));

      try {
        // Collect imported nodes
        const importedNodes: Node[] = [];

        // Listen for node import events
        const nodeHandler = (event: CustomEvent) => {
          importedNodes.push(event.detail);
        };
        window.addEventListener('node-imported', nodeHandler as EventListener);

        const result = await syncManager.importSQLiteFile(fileStatus.file);

        window.removeEventListener('node-imported', nodeHandler as EventListener);

        // Update status to success
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? {
            ...f,
            status: 'success',
            result,
            nodes: importedNodes
          } : f
        ));

        // Merge results
        totalResult.imported += result.imported;
        totalResult.failed += result.failed;
        totalResult.errors.push(...result.errors);
        totalResult.sources.push(...result.sources);
        allNodes.push(...importedNodes);

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

    // Call completion handler
    if ((totalResult.imported > 0 || totalResult.failed > 0) && onImportComplete) {
      onImportComplete(totalResult, allNodes);
    }
  }, [files, syncOptions, onImportComplete]);

  const resetWizard = useCallback(() => {
    setFiles([]);
    setSyncOptions({
      batchSize: 500,
      maxFileSize: 100 * 1024 * 1024,
      enabledSources: ['notes', 'reminders', 'calendar', 'contacts', 'safari']
    });
    setShowAdvancedOptions(false);
  }, []);

  const toggleSource = useCallback((source: string) => {
    setSyncOptions(prev => ({
      ...prev,
      enabledSources: prev.enabledSources?.includes(source)
        ? prev.enabledSources.filter(s => s !== source)
        : [...(prev.enabledSources || []), source]
    }));
  }, []);

  if (!isOpen) return null;

  const pendingFiles = files.filter(f => f.status === 'pending');
  const processingFiles = files.filter(f => f.status === 'processing');
  const successFiles = files.filter(f => f.status === 'success');
  const errorFiles = files.filter(f => f.status === 'error');

  const totalImported = files.reduce((sum, f) => sum + (f.result?.imported || 0), 0);
  const totalFailed = files.reduce((sum, f) => sum + (f.result?.failed || 0), 0);
  const totalErrors = files.reduce((sum, f) => sum + (f.result?.errors.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Database className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Import SQLite Databases
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Sync Options */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Import Settings</h3>
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                <Settings className="w-4 h-4 mr-1" />
                Advanced Options
              </button>
            </div>

            {/* Enabled Sources */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data Sources to Import
              </label>
              <div className="flex flex-wrap gap-2">
                {['notes', 'reminders', 'calendar', 'contacts', 'safari'].map(source => (
                  <button
                    key={source}
                    onClick={() => toggleSource(source)}
                    className={`px-3 py-1 rounded-full text-sm capitalize ${
                      syncOptions.enabledSources?.includes(source)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {source}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Options */}
            {showAdvancedOptions && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Batch Size
                    </label>
                    <input
                      type="number"
                      value={syncOptions.batchSize}
                      onChange={(e) => setSyncOptions(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 500 }))}
                      min="100"
                      max="2000"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max File Size (MB)
                    </label>
                    <input
                      type="number"
                      value={Math.round((syncOptions.maxFileSize || 0) / 1024 / 1024)}
                      onChange={(e) => setSyncOptions(prev => ({
                        ...prev,
                        maxFileSize: (parseInt(e.target.value) || 100) * 1024 * 1024
                      }))}
                      min="10"
                      max="500"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                    />
                  </div>
                </div>
              </div>
            )}
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
            <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg mb-2 text-gray-900 dark:text-white">
              Drop SQLite database files here
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Supports .sqlite, .db, .sqlite3, .sqlitedb files from Apple apps
            </p>
            <input
              type="file"
              id="sqlite-file-input"
              multiple
              accept=".sqlite,.db,.sqlite3,.sqlitedb"
              onChange={handleFileSelect}
              className="hidden"
            />
            <label
              htmlFor="sqlite-file-input"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              <Upload className="w-4 h-4 mr-2" />
              Select Database Files
            </label>
          </div>

          {/* Supported Apps Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100">Supported Apple Apps</h4>
                <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                  Notes, Reminders, Calendar, Contacts, Safari bookmarks and reading list.
                  Generic SQLite databases will have their structure analyzed and data extracted as tables.
                </p>
              </div>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Database Files ({files.length})
                </h3>
                <div className="flex space-x-2">
                  {pendingFiles.length > 0 && (
                    <button
                      onClick={processFiles}
                      disabled={processingFiles.length > 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
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
                      {totalImported} records imported
                    </span>
                    {totalFailed > 0 && (
                      <span className="flex items-center text-red-600">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {totalFailed} failed
                      </span>
                    )}
                    {totalErrors > 0 && (
                      <span className="flex items-center text-yellow-600">
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
                      <Database className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-white">
                          {fileStatus.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {fileStatus.result?.sources && fileStatus.result.sources.length > 0 && (
                          <p className="text-xs text-blue-600">
                            Detected: {fileStatus.result.sources.join(', ')}
                          </p>
                        )}
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
                            {fileStatus.result?.imported || 0} imported
                            {(fileStatus.result?.failed || 0) > 0 && `, ${fileStatus.result.failed} failed`}
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
            Import SQLite databases from Apple Notes, Reminders, Calendar, Contacts, and Safari
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              Close
            </button>
            {totalImported > 0 && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Done ({totalImported} imported)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SQLiteImportWizard;