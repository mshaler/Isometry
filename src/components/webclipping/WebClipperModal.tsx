import React, { useState, useEffect } from 'react';
import { URLInput } from './URLInput';
import { ExtractionProgress } from './ExtractionProgress';
import { ContentPreview } from './ContentPreview';
import { useWebClipper } from '../../hooks/useWebClipper';

interface WebClipperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type WebClipperStep = 'input' | 'extracting' | 'preview' | 'complete';

export const WebClipperModal: React.FC<WebClipperModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<WebClipperStep>('input');
  const [url, setUrl] = useState('');

  const {
    extractContent,
    saveContent,
    isExtracting,
    isSaving,
    extractedContent,
    error,
    progress,
    reset,
  } = useWebClipper();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      reset();
      setCurrentStep('input');
      setUrl('');
    }
  }, [isOpen, reset]);

  const handleUrlSubmit = async (submittedUrl: string) => {
    setUrl(submittedUrl);
    setCurrentStep('extracting');

    try {
      await extractContent(submittedUrl);
      setCurrentStep('preview');
    } catch (err) {
      // Error is handled by the hook, stay on extracting step to show error
      console.error('Web clipping failed:', err);
    }
  };

  const handleSave = async () => {
    if (!extractedContent) return;

    try {
      await saveContent();
      setCurrentStep('complete');

      // Call completion callback after a brief delay to show success
      setTimeout(() => {
        onImportComplete?.();
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to save clipped content:', err);
    }
  };

  const handleRetry = () => {
    setCurrentStep('input');
    reset();
  };

  const handleBack = () => {
    if (currentStep === 'preview') {
      setCurrentStep('input');
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Web Clipper
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Steps */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center ${currentStep === 'input' ? 'text-blue-600' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                  currentStep === 'input'
                    ? 'border-blue-600 text-blue-600'
                    : ['extracting', 'preview', 'complete'].includes(currentStep)
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300'
                }`}>
                  {['extracting', 'preview', 'complete'].includes(currentStep) ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    '1'
                  )}
                </div>
                <span className="ml-2 text-sm font-medium">Enter URL</span>
              </div>

              <div className={`h-px flex-1 ${currentStep === 'extracting' || currentStep === 'preview' || currentStep === 'complete' ? 'bg-green-500' : 'bg-gray-300'}`} />

              <div className={`flex items-center ${currentStep === 'extracting' ? 'text-blue-600' : currentStep === 'preview' || currentStep === 'complete' ? 'text-green-600' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                  currentStep === 'extracting'
                    ? 'border-blue-600 text-blue-600'
                    : currentStep === 'preview' || currentStep === 'complete'
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300'
                }`}>
                  {currentStep === 'extracting' ? (
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  ) : (currentStep === 'preview' || currentStep === 'complete') ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    '2'
                  )}
                </div>
                <span className="ml-2 text-sm font-medium">Extract Content</span>
              </div>

              <div className={`h-px flex-1 ${currentStep === 'preview' || currentStep === 'complete' ? 'bg-green-500' : 'bg-gray-300'}`} />

              <div className={`flex items-center ${currentStep === 'preview' ? 'text-blue-600' : currentStep === 'complete' ? 'text-green-600' : 'text-gray-500'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                  currentStep === 'preview'
                    ? 'border-blue-600 text-blue-600'
                    : currentStep === 'complete'
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300'
                }`}>
                  {currentStep === 'complete' ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    '3'
                  )}
                </div>
                <span className="ml-2 text-sm font-medium">Preview & Save</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {currentStep === 'input' && (
              <URLInput
                onSubmit={handleUrlSubmit}
                isLoading={false}
                error={error}
                onRetry={handleRetry}
              />
            )}

            {currentStep === 'extracting' && (
              <ExtractionProgress
                url={url}
                isExtracting={isExtracting}
                progress={progress}
                error={error}
                onRetry={handleRetry}
                onCancel={() => setCurrentStep('input')}
              />
            )}

            {currentStep === 'preview' && extractedContent && (
              <ContentPreview
                content={extractedContent}
                isSaving={isSaving}
                onSave={handleSave}
                onBack={handleBack}
                onCancel={onClose}
              />
            )}

            {currentStep === 'complete' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Content Saved Successfully!
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  The web page has been clipped and added to your knowledge base.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};