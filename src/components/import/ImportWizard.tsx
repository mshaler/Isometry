import React, { useState, useCallback } from 'react';
import { FileSelector } from './FileSelector';
import { MarkdownPreview } from './MarkdownPreview';
import { FieldMapper } from './FieldMapper';
import { ImportProgress } from './ImportProgress';
import { useMarkdownImport } from '../../hooks/useMarkdownImport';

export interface ImportWizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
}

export interface SelectedFile {
  file: File;
  content: string;
  path: string;
  name: string;
}

export interface FieldMapping {
  [fieldName: string]: {
    targetProperty: string;
    customProperty?: string;
  };
}

interface ImportWizardProps {
  onImportComplete?: () => void;
}

export const ImportWizard: React.FC<ImportWizardProps> = ({ onImportComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [currentFile, setCurrentFile] = useState<SelectedFile | null>(null);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping>({});
  const [isImporting, setIsImporting] = useState(false);

  const { importMarkdownFiles, progress, error, results } = useMarkdownImport();

  const steps: ImportWizardStep[] = [
    {
      id: 'files',
      title: 'Select Files',
      description: 'Choose markdown files to import',
      component: FileSelector,
    },
    {
      id: 'preview',
      title: 'Preview Content',
      description: 'Review markdown content and detect format',
      component: MarkdownPreview,
    },
    {
      id: 'mapping',
      title: 'Map Fields',
      description: 'Configure property mappings',
      component: FieldMapper,
    },
    {
      id: 'import',
      title: 'Import Progress',
      description: 'Import files and track progress',
      component: ImportProgress,
    },
  ];

  const handleFilesSelected = useCallback((files: SelectedFile[]) => {
    setSelectedFiles(files);
    if (files.length > 0) {
      setCurrentFile(files[0]);
      setCurrentStep(1);
    }
  }, []);

  const handlePreviewNext = useCallback(() => {
    setCurrentStep(2);
  }, []);

  const handleMappingNext = useCallback((mappings: FieldMapping) => {
    setFieldMappings(mappings);
    setCurrentStep(3);
    // Start import process
    handleStartImport(mappings);
  }, [selectedFiles]);

  const handleStartImport = useCallback(async (mappings: FieldMapping) => {
    if (selectedFiles.length === 0) return;

    setIsImporting(true);
    try {
      await importMarkdownFiles(selectedFiles, mappings);
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setIsImporting(false);
    }
  }, [selectedFiles, importMarkdownFiles]);

  // Watch for import completion
  React.useEffect(() => {
    if (progress && !isImporting && progress.total > 0 && progress.completed + progress.failed === progress.total && progress.completed > 0) {
      // Import is complete and successful
      if (onImportComplete) {
        onImportComplete();
      }
    }
  }, [progress, isImporting, onImportComplete]);

  const handleStepChange = useCallback((stepIndex: number) => {
    if (stepIndex < currentStep || stepIndex === 0) {
      setCurrentStep(stepIndex);
    }
  }, [currentStep]);

  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setSelectedFiles([]);
    setCurrentFile(null);
    setFieldMappings({});
    setIsImporting(false);
  }, []);

  const getCurrentStepComponent = () => {
    const StepComponent = steps[currentStep].component;

    switch (currentStep) {
      case 0: // File Selection
        return (
          <StepComponent
            onFilesSelected={handleFilesSelected}
            selectedFiles={selectedFiles}
          />
        );
      case 1: // Preview
        return (
          <StepComponent
            file={currentFile}
            files={selectedFiles}
            onNext={handlePreviewNext}
            onFileChange={setCurrentFile}
          />
        );
      case 2: // Field Mapping
        return (
          <StepComponent
            file={currentFile}
            files={selectedFiles}
            onNext={handleMappingNext}
            fieldMappings={fieldMappings}
          />
        );
      case 3: // Import Progress
        return (
          <StepComponent
            files={selectedFiles}
            progress={progress}
            error={error}
            results={results}
            isImporting={isImporting}
            onReset={handleReset}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="import-wizard max-w-6xl mx-auto p-6">
      <div className="wizard-header mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Universal Markdown Import
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Import markdown files with automatic relationship extraction and intelligent field mapping
        </p>
      </div>

      {/* Step Navigation */}
      <div className="step-navigation mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => handleStepChange(index)}
                className={`step-button flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-medium transition-colors ${
                  index === currentStep
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : index < currentStep
                    ? 'bg-green-600 border-green-600 text-white cursor-pointer hover:bg-green-700'
                    : 'border-gray-300 text-gray-300 cursor-not-allowed'
                }`}
                disabled={index > currentStep}
              >
                {index < currentStep ? '✓' : index + 1}
              </button>

              <div className="ml-3 min-w-0 flex-1">
                <p className={`text-sm font-medium ${
                  index === currentStep ? 'text-blue-600 dark:text-blue-400' :
                  index < currentStep ? 'text-green-600 dark:text-green-400' :
                  'text-gray-500 dark:text-gray-400'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {step.description}
                </p>
              </div>

              {index < steps.length - 1 && (
                <div className={`w-8 h-px mx-4 ${
                  index < currentStep ? 'bg-green-600' : 'bg-gray-300'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="step-content bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        {getCurrentStepComponent()}
      </div>

      {/* Global Error Display */}
      {error && (
        <div className="error-display mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
            Import Error
          </h3>
          <p className="text-sm text-red-600 dark:text-red-300">
            {error.message || 'An unexpected error occurred during import'}
          </p>
        </div>
      )}
    </div>
  );
};