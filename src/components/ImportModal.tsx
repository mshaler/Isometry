import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { ImportWizard } from './import/ImportWizard';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    // Add small delay for smooth animation
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 150);
  }, [onClose]);

  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  const handleImportComplete = useCallback(() => {
    // Give user a moment to see completion before closing
    setTimeout(handleClose, 2000);
  }, [handleClose]);

  if (!isOpen && !isClosing) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 transition-opacity duration-150 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleBackdropClick}
    >
      <div
        className={`relative w-full max-w-7xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl transition-transform duration-150 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Universal Markdown Import
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Import markdown files with automatic relationship extraction and intelligent field mapping
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <ImportWizard onImportComplete={handleImportComplete} />
        </div>
      </div>
    </div>
  );
};