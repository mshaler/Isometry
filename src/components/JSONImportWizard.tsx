import React, { useState, useCallback, useEffect } from 'react';
import { Upload, File, CheckCircle, AlertCircle, X, Settings, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import {
  importJSONFile,
  previewJSONFile,
  type JSONImportResult,
  type JSONImportOptions,
  type JSONPreview,
  type FieldMapping,
  type LATCHProperty
} from '../utils/jsonProcessor';
import type { Node } from '../types/node';

interface JSONImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (nodes: Node[]) => void;
  folder?: string;
}

interface FileStatus {
  file: File;
  status: 'pending' | 'previewing' | 'ready' | 'processing' | 'success' | 'error';
  preview?: JSONPreview;
  result?: JSONImportResult;
  error?: string;
  fieldMappings?: FieldMapping[];
}

type WizardStep = 'upload' | 'configure' | 'preview' | 'import';

export function JSONImportWizard({ isOpen, onClose, onImportComplete, folder }: JSONImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<number>>(new Set());

  const [globalOptions, setGlobalOptions] = useState<JSONImportOptions>({
    nodeType: 'json-object',
    folder: folder || undefined,
    source: 'json-import',
    streamingMode: false,
    batchSize: 100
  });

  // Reset wizard when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('upload');
      setFiles([]);
      setExpandedFiles(new Set());
      setGlobalOptions({
        nodeType: 'json-object',
        folder: folder || undefined,
        source: 'json-import',
        streamingMode: false,
        batchSize: 100
      });
    }
  }, [isOpen, folder]);

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
    const validFiles = newFiles.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      return extension === '.json';
    });

    const fileStatuses: FileStatus[] = validFiles.map(file => ({
      file,
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...fileStatuses]);

    // Auto-advance to configure step if we have files
    if (validFiles.length > 0 && currentStep === 'upload') {
      setCurrentStep('configure');
    }
  }, [currentStep]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  }, []);

  const generatePreview = useCallback(async (index: number) => {
    const fileStatus = files[index];
    if (!fileStatus || fileStatus.status !== 'pending') return;

    setFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, status: 'previewing' } : f
    ));

    try {
      const preview = await previewJSONFile(fileStatus.file);

      setFiles(prev => prev.map((f, i) =>
        i === index ? {
          ...f,
          status: 'ready',
          preview,
          fieldMappings: preview.inferredMappings
        } : f
      ));
    } catch (error) {
      setFiles(prev => prev.map((f, i) =>
        i === index ? {
          ...f,
          status: 'error',
          error: error instanceof Error ? error.message : 'Preview failed'
        } : f
      ));
    }
  }, [files]);

  const generateAllPreviews = useCallback(async () => {
    const pendingFiles = files
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => file.status === 'pending');

    for (const { index } of pendingFiles) {
      await generatePreview(index);
    }

    if (pendingFiles.length > 0) {
      setCurrentStep('preview');
    }
  }, [files, generatePreview]);

  const updateFieldMapping = useCallback((fileIndex: number, mappingIndex: number, newMapping: FieldMapping) => {
    setFiles(prev => prev.map((file, i) => {
      if (i === fileIndex && file.fieldMappings) {
        const newMappings = [...file.fieldMappings];
        newMappings[mappingIndex] = newMapping;
        return { ...file, fieldMappings: newMappings };
      }
      return file;
    }));
  }, []);

  const addFieldMapping = useCallback((fileIndex: number) => {
    setFiles(prev => prev.map((file, i) => {
      if (i === fileIndex) {
        const newMapping: FieldMapping = {
          jsonPath: '',
          targetProperty: 'name'
        };
        return {
          ...file,
          fieldMappings: [...(file.fieldMappings || []), newMapping]
        };
      }
      return file;
    }));
  }, []);

  const removeFieldMapping = useCallback((fileIndex: number, mappingIndex: number) => {
    setFiles(prev => prev.map((file, i) => {
      if (i === fileIndex && file.fieldMappings) {
        const newMappings = file.fieldMappings.filter((_, idx) => idx !== mappingIndex);
        return { ...file, fieldMappings: newMappings };
      }
      return file;
    }));
  }, []);

  const processFiles = useCallback(async () => {
    setCurrentStep('import');

    const allNodes: Node[] = [];

    for (let i = 0; i < files.length; i++) {
      const fileStatus = files[i];

      if (fileStatus.status !== 'ready') continue;

      // Update status to processing
      setFiles(prev => prev.map((f, idx) =>
        idx === i ? { ...f, status: 'processing' } : f
      ));

      try {
        const options: JSONImportOptions = {
          ...globalOptions,
          fieldMappings: fileStatus.fieldMappings
        };

        const result = await importJSONFile(fileStatus.file, options);

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
  }, [files, globalOptions, onImportComplete]);

  const toggleFileExpansion = useCallback((index: number) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  if (!isOpen) return null;

  const readyFiles = files.filter(f => f.status === 'ready');
  const processingFiles = files.filter(f => f.status === 'processing');
  const successFiles = files.filter(f => f.status === 'success');
  const errorFiles = files.filter(f => f.status === 'error');

  const totalNodes = files.reduce((sum, f) => sum + (f.result?.nodes.length || 0), 0);
  const totalErrors = files.reduce((sum, f) => sum + (f.result?.errors.length || 0), 0);

  const canProceed = files.some(f => f.status === 'pending') ? false :
                    currentStep === 'configure' ? files.some(f => f.status === 'ready') :
                    currentStep === 'preview' ? readyFiles.length > 0 :
                    false;

  const stepTitles = {
    upload: 'Upload JSON Files',
    configure: 'Configure Import',
    preview: 'Preview & Map Fields',
    import: 'Import Progress'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {stepTitles[currentStep]}
            </h2>
            <div className="flex items-center space-x-2 mt-2">
              {(['upload', 'configure', 'preview', 'import'] as WizardStep[]).map((step, index) => (
                <React.Fragment key={step}>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      step === currentStep ? 'bg-blue-600' :
                      (['upload', 'configure', 'preview', 'import'] as WizardStep[]).indexOf(currentStep) > index ? 'bg-green-600' :
                      'bg-gray-300'
                    }`}
                  />
                  {index < 3 && <div className="w-8 h-0.5 bg-gray-300" />}
                </React.Fragment>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(95vh-200px)]">
          {/* Upload Step */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              {/* File Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-xl mb-2 text-gray-900 dark:text-white">
                  Drop your JSON files here
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Supports .json files up to 100MB
                </p>
                <input
                  type="file"
                  id="json-file-input"
                  multiple
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="json-file-input"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                >
                  Select JSON Files
                </label>
              </div>

              {files.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Selected Files ({files.length})
                  </h3>
                  <div className="space-y-2">
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
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Configure Step */}
          {currentStep === 'configure' && (
            <div className="space-y-6">
              {/* Global Import Options */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Global Import Settings
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Default Node Type
                    </label>
                    <select
                      value={globalOptions.nodeType}
                      onChange={(e) => setGlobalOptions(prev => ({ ...prev, nodeType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                    >
                      <option value="json-object">JSON Object</option>
                      <option value="note">Note</option>
                      <option value="document">Document</option>
                      <option value="data">Data</option>
                      <option value="reference">Reference</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Folder
                    </label>
                    <input
                      type="text"
                      value={globalOptions.folder || ''}
                      onChange={(e) => setGlobalOptions(prev => ({ ...prev, folder: e.target.value || undefined }))}
                      placeholder="Optional folder name"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={globalOptions.streamingMode}
                      onChange={(e) => setGlobalOptions(prev => ({ ...prev, streamingMode: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm">Streaming Mode (for large files)</span>
                  </label>

                  <div className="flex items-center space-x-2">
                    <label className="text-sm">Batch Size:</label>
                    <input
                      type="number"
                      value={globalOptions.batchSize}
                      onChange={(e) => setGlobalOptions(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 100 }))}
                      min="10"
                      max="1000"
                      className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>
              </div>

              {/* File List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Files to Process ({files.length})
                  </h3>
                  <button
                    onClick={generateAllPreviews}
                    disabled={!files.some(f => f.status === 'pending')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Eye className="w-4 h-4 inline mr-2" />
                    Generate Previews
                  </button>
                </div>

                <div className="space-y-2">
                  {files.map((fileStatus, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 dark:border-gray-600 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <File className="w-5 h-5 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {fileStatus.file.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {fileStatus.status === 'pending' && (
                            <button
                              onClick={() => generatePreview(index)}
                              className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                            >
                              Preview
                            </button>
                          )}
                          {fileStatus.status === 'previewing' && (
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                              <span className="text-sm text-blue-600">Analyzing...</span>
                            </div>
                          )}
                          {fileStatus.status === 'ready' && (
                            <span className="text-sm text-green-600 flex items-center">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Ready
                            </span>
                          )}
                          {fileStatus.status === 'error' && (
                            <span className="text-sm text-red-600 flex items-center">
                              <AlertCircle className="w-4 h-4 mr-1" />
                              Error
                            </span>
                          )}
                        </div>
                      </div>

                      {fileStatus.error && (
                        <div className="mt-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                          {fileStatus.error}
                        </div>
                      )}

                      {fileStatus.preview && (
                        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center justify-between">
                            <span>
                              {fileStatus.preview.estimatedNodeCount} items •
                              {fileStatus.preview.inferredMappings.length} auto-mapped fields
                            </span>
                          </div>

                          {fileStatus.preview.warnings.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {fileStatus.preview.warnings.map((warning, idx) => (
                                <div key={idx} className="flex items-center text-yellow-600">
                                  <AlertCircle className="w-4 h-4 mr-1" />
                                  <span className="text-sm">{warning}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {currentStep === 'preview' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Field Mapping Configuration
              </h3>

              <div className="space-y-4">
                {readyFiles.map((fileStatus, fileIndex) => (
                  <div key={fileIndex} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleFileExpansion(fileIndex)}
                    >
                      <div className="flex items-center space-x-2">
                        {expandedFiles.has(fileIndex) ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                        <File className="w-5 h-5 text-gray-400" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {fileStatus.file.name}
                        </span>
                        <span className="text-sm text-gray-500">
                          ({fileStatus.preview?.estimatedNodeCount} items)
                        </span>
                      </div>
                    </div>

                    {expandedFiles.has(fileIndex) && (
                      <div className="mt-4 space-y-4">
                        {/* Field Mappings */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900 dark:text-white">Field Mappings</h4>
                            <button
                              onClick={() => addFieldMapping(fileIndex)}
                              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Add Mapping
                            </button>
                          </div>

                          <div className="space-y-2">
                            {(fileStatus.fieldMappings || []).map((mapping, mappingIndex) => (
                              <FieldMappingEditor
                                key={mappingIndex}
                                mapping={mapping}
                                availablePaths={Object.keys(fileStatus.preview?.structure.properties || {})}
                                onChange={(newMapping) => updateFieldMapping(fileIndex, mappingIndex, newMapping)}
                                onRemove={() => removeFieldMapping(fileIndex, mappingIndex)}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Sample Data Preview */}
                        {fileStatus.preview?.sampleData && (
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Sample Data</h4>
                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-h-40 overflow-y-auto">
                              <pre className="text-sm text-gray-600 dark:text-gray-400">
                                {JSON.stringify(fileStatus.preview.sampleData[0], null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Step */}
          {currentStep === 'import' && (
            <div className="space-y-6">
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

              {/* File Import Status */}
              <div className="space-y-2">
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
            {currentStep === 'upload' && 'Supports JSON files up to 100MB'}
            {currentStep === 'configure' && 'Configure import settings and generate previews'}
            {currentStep === 'preview' && 'Review field mappings and sample data'}
            {currentStep === 'import' && 'Import completed'}
          </div>

          <div className="flex space-x-3">
            {/* Back Button */}
            {currentStep !== 'upload' && currentStep !== 'import' && (
              <button
                onClick={() => {
                  const steps: WizardStep[] = ['upload', 'configure', 'preview', 'import'];
                  const currentIndex = steps.indexOf(currentStep);
                  if (currentIndex > 0) {
                    setCurrentStep(steps[currentIndex - 1]);
                  }
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Back
              </button>
            )}

            {/* Next/Process Button */}
            {currentStep === 'upload' && files.length > 0 && (
              <button
                onClick={() => setCurrentStep('configure')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Configure Import
              </button>
            )}

            {currentStep === 'configure' && canProceed && (
              <button
                onClick={() => setCurrentStep('preview')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Preview Mappings
              </button>
            )}

            {currentStep === 'preview' && readyFiles.length > 0 && (
              <button
                onClick={processFiles}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Import {readyFiles.length} Files
              </button>
            )}

            {/* Close Button */}
            {(currentStep === 'upload' && files.length === 0) || currentStep === 'import' ? (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {totalNodes > 0 ? `Done (${totalNodes} imported)` : 'Close'}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Field mapping editor component
interface FieldMappingEditorProps {
  mapping: FieldMapping;
  availablePaths: string[];
  onChange: (mapping: FieldMapping) => void;
  onRemove: () => void;
}

function FieldMappingEditor({ mapping, availablePaths, onChange, onRemove }: FieldMappingEditorProps) {
  const latchProperties: LATCHProperty[] = [
    'name', 'content', 'summary',
    'latitude', 'longitude', 'locationName', 'locationAddress',
    'createdAt', 'modifiedAt', 'dueAt', 'completedAt', 'eventStart', 'eventEnd',
    'folder', 'tags', 'status', 'nodeType',
    'priority', 'importance', 'sortOrder'
  ];

  return (
    <div className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded">
      <select
        value={mapping.jsonPath}
        onChange={(e) => onChange({ ...mapping, jsonPath: e.target.value })}
        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
      >
        <option value="">Select JSON field</option>
        {availablePaths.map(path => (
          <option key={path} value={path}>{path}</option>
        ))}
      </select>

      <span className="text-gray-400">→</span>

      <select
        value={mapping.targetProperty}
        onChange={(e) => onChange({ ...mapping, targetProperty: e.target.value as LATCHProperty })}
        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
      >
        {latchProperties.map(prop => (
          <option key={prop} value={prop}>{prop}</option>
        ))}
      </select>

      <button
        onClick={onRemove}
        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default JSONImportWizard;