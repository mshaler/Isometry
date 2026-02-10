/**
 * ChoicePrompt Component
 *
 * Renders GSD decision points as interactive button groups:
 * - Numbered choice buttons with keyboard shortcuts
 * - Multi-select support with checkboxes
 * - "Write custom response" option to open Capture
 * - Keyboard shortcuts (1-9) for quick selection
 */

import { useState, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Edit3,
  Keyboard,
  ArrowRight,
  MessageSquarePlus
} from 'lucide-react';
import { ChoicePromptProps } from '../../types/gsd';

export function ChoicePrompt({
  choices,
  multiSelect,
  onSelect,
  onFreeformInput,
  disabled = false
}: ChoicePromptProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // Reset selection when choices change
  useEffect(() => {
    setSelectedIndices([]);
  }, [choices]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;

      // Numbers 1-9 for choice selection
      const num = parseInt(event.key);
      if (num >= 1 && num <= Math.min(9, choices.length)) {
        event.preventDefault();
        const index = num - 1;
        handleChoiceToggle(index);
      }

      // Enter to submit selection
      if (event.key === 'Enter' && selectedIndices.length > 0) {
        event.preventDefault();
        handleSubmit();
      }

      // Escape to open freeform input
      if (event.key === 'Escape') {
        event.preventDefault();
        onFreeformInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [choices.length, selectedIndices, disabled]);

  const handleChoiceToggle = (index: number) => {
    if (multiSelect) {
      setSelectedIndices(prev =>
        prev.includes(index)
          ? prev.filter(i => i !== index)
          : [...prev, index]
      );
    } else {
      setSelectedIndices([index]);
    }
  };

  const handleSubmit = () => {
    if (selectedIndices.length > 0) {
      onSelect(selectedIndices);
    }
  };

  const isSelected = (index: number) => selectedIndices.includes(index);

  return (
    <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-700 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-blue-200 flex items-center gap-2">
          <MessageSquarePlus size={16} />
          GSD needs your input
        </h3>
        <div className="flex items-center gap-2 text-xs text-blue-400">
          <Keyboard size={12} />
          <span>Press 1-{Math.min(9, choices.length)} to select</span>
        </div>
      </div>

      {/* Instructions */}
      <p className="text-sm text-gray-300">
        {multiSelect
          ? 'Select one or more options, then click Submit:'
          : 'Choose an option:'}
      </p>

      {/* Choice Buttons */}
      <div className="space-y-2">
        {choices.map((choice, index) => {
          const shortcut = (index + 1).toString();
          const selected = isSelected(index);

          return (
            <button
              key={choice.id}
              onClick={() => handleChoiceToggle(index)}
              disabled={disabled}
              className={`w-full flex items-center gap-3 p-3 rounded-md border transition-all duration-200 text-left group ${
                selected
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/25'
                  : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700 hover:border-gray-500'
              } ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {/* Selection Indicator */}
              <div className="flex items-center">
                {multiSelect ? (
                  selected ? (
                    <CheckSquare size={16} className="text-blue-200" />
                  ) : (
                    <Square size={16} className="text-gray-400 group-hover:text-gray-300" />
                  )
                ) : (
                  <div className={`w-4 h-4 rounded-full border-2 transition-colors ${
                    selected
                      ? 'bg-blue-400 border-blue-400'
                      : 'border-gray-400 group-hover:border-gray-300'
                  }`}>
                    {selected && <div className="w-2 h-2 bg-white rounded-full m-0.5" />}
                  </div>
                )}
              </div>

              {/* Shortcut Badge */}
              {index < 9 && (
                <div className={`flex items-center justify-center w-6 h-6 rounded text-xs font-bold transition-colors ${
                  selected
                    ? 'bg-blue-700 text-blue-100'
                    : 'bg-gray-700 text-gray-400 group-hover:bg-gray-600 group-hover:text-gray-300'
                }`}>
                  {shortcut}
                </div>
              )}

              {/* Choice Text */}
              <span className="flex-1 font-medium">
                {choice.text}
              </span>

              {/* Selection Arrow */}
              {selected && (
                <ArrowRight size={16} className="text-blue-200" />
              )}
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {/* Submit Button */}
        {(selectedIndices.length > 0 || !multiSelect) && (
          <button
            onClick={handleSubmit}
            disabled={disabled || selectedIndices.length === 0}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              disabled || selectedIndices.length === 0
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25'
            }`}
          >
            {multiSelect ? `Submit (${selectedIndices.length})` : 'Submit'}
          </button>
        )}

        {/* Custom Response Button */}
        <button
          onClick={onFreeformInput}
          disabled={disabled}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-all duration-200 ${
            disabled
              ? 'border-gray-600 text-gray-500 cursor-not-allowed'
              : 'border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white hover:bg-gray-700'
          }`}
        >
          <Edit3 size={14} />
          Write custom response...
        </button>
      </div>

      {/* Keyboard Hints */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-700">
        <div className="flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">1-9</kbd> Select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">Enter</kbd> Submit
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">Esc</kbd> Custom
          </span>
        </div>
        {multiSelect && (
          <span>Multiple selections allowed</span>
        )}
      </div>
    </div>
  );
}