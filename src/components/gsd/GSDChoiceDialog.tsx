import { useState, useEffect, useCallback } from 'react';
import type { GSDChoice, GSDChoicePrompt } from '../../types/gsd';

interface GSDChoiceDialogProps {
  prompt: GSDChoicePrompt | null;
  onChoiceSelect: (choices: GSDChoice[]) => void;
  onCancel?: () => void;
  className?: string;
}

export function GSDChoiceDialog({
  prompt,
  onChoiceSelect,
  onCancel,
  className = '',
}: GSDChoiceDialogProps) {
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Reset selection when prompt changes
  useEffect(() => {
    if (prompt) {
      const defaultChoices = prompt.choices.filter(choice => choice.isDefault);
      setSelectedChoices(defaultChoices.map(choice => choice.id));
    } else {
      setSelectedChoices([]);
    }
  }, [prompt]);

  // Handle timeout countdown
  useEffect(() => {
    if (!prompt?.timeout) return;

    setTimeLeft(prompt.timeout);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          // Auto-select default choices on timeout
          const defaultChoices = prompt.choices.filter(choice => choice.isDefault);
          if (defaultChoices.length > 0) {
            onChoiceSelect(defaultChoices);
          } else {
            onCancel?.();
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [prompt, onChoiceSelect, onCancel]);

  const handleChoiceToggle = useCallback((choiceId: string) => {
    setSelectedChoices(prev => {
      if (!prompt) return prev;

      if (prompt.allowMultiSelect) {
        return prev.includes(choiceId)
          ? prev.filter(id => id !== choiceId)
          : [...prev, choiceId];
      } else {
        return [choiceId];
      }
    });
  }, [prompt]);

  const handleSubmit = useCallback(() => {
    if (!prompt || selectedChoices.length === 0) return;

    const choices = prompt.choices.filter(choice => selectedChoices.includes(choice.id));
    onChoiceSelect(choices);
  }, [prompt, selectedChoices, onChoiceSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!prompt) return;

    if (e.key === 'Escape') {
      onCancel?.();
      return;
    }

    if (e.key === 'Enter' && selectedChoices.length > 0) {
      handleSubmit();
      return;
    }

    // Handle number key shortcuts
    const num = parseInt(e.key);
    if (num >= 1 && num <= prompt.choices.length) {
      const choice = prompt.choices[num - 1];
      if (choice) {
        handleChoiceToggle(choice.id);
      }
    }

    // Handle letter shortcuts
    const shortcut = e.key.toLowerCase();
    const choiceWithShortcut = prompt.choices.find(choice =>
      choice.shortcut?.toLowerCase() === shortcut
    );
    if (choiceWithShortcut) {
      handleChoiceToggle(choiceWithShortcut.id);
    }
  }, [prompt, selectedChoices, handleSubmit, handleChoiceToggle, onCancel]);

  if (!prompt) return null;

  const getChoiceButtonColor = (choice: GSDChoice, isSelected: boolean) => {
    if (choice.action === 'abort') {
      return isSelected
        ? 'bg-red-600 text-white border-red-600'
        : 'border-red-300 text-red-700 hover:bg-red-50';
    }
    if (choice.action === 'modify') {
      return isSelected
        ? 'bg-yellow-600 text-white border-yellow-600'
        : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50';
    }
    return isSelected
      ? 'bg-blue-600 text-white border-blue-600'
      : 'border-gray-300 text-gray-700 hover:bg-gray-50';
  };

  const getChoiceIcon = (choice: GSDChoice) => {
    switch (choice.action) {
      case 'continue': return '▶️';
      case 'modify': return '✏️';
      case 'abort': return '🛑';
      case 'custom': return '⚙️';
      default: return '❓';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        className={`bg-white rounded-lg shadow-2xl border max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col ${className}`}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {prompt.title}
              </h2>
              <p className="text-gray-600 leading-relaxed">
                {prompt.message}
              </p>
            </div>
            {timeLeft !== null && (
              <div className="ml-4 flex items-center gap-2 text-sm">
                <span className="text-orange-500">⏱️</span>
                <span className="font-mono text-orange-600">
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </span>
              </div>
            )}
          </div>

          {/* Selection Mode Indicator */}
          <div className="mt-3 text-sm text-gray-500">
            {prompt.allowMultiSelect
              ? '✨ Multiple selections allowed'
              : '🎯 Single selection only'
            }
          </div>
        </div>

        {/* Choices */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {prompt.choices.map((choice, index) => {
              const isSelected = selectedChoices.includes(choice.id);
              const buttonColor = getChoiceButtonColor(choice, isSelected);

              return (
                <button
                  key={choice.id}
                  onClick={() => handleChoiceToggle(choice.id)}
                  className={`
                    w-full text-left p-4 rounded-lg border-2 transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    ${buttonColor}
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Choice Icon */}
                    <span className="text-xl flex-shrink-0 mt-0.5" role="img" aria-label={choice.action}>
                      {getChoiceIcon(choice)}
                    </span>

                    {/* Choice Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">
                          {choice.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {choice.shortcut && (
                            <span className="text-xs font-mono bg-black bg-opacity-10 px-2 py-1 rounded">
                              {choice.shortcut}
                            </span>
                          )}
                          <span className="text-xs font-mono bg-black bg-opacity-10 px-2 py-1 rounded">
                            {index + 1}
                          </span>
                        </div>
                      </div>
                      {choice.description && (
                        <p className="text-sm opacity-90">
                          {choice.description}
                        </p>
                      )}
                    </div>

                    {/* Selection Indicator */}
                    <div className="flex-shrink-0 ml-2">
                      {prompt.allowMultiSelect ? (
                        <div className={`w-5 h-5 border-2 rounded ${
                          isSelected
                            ? 'bg-current border-current'
                            : 'border-current border-opacity-30'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white ml-0.5 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      ) : (
                        <div className={`w-5 h-5 border-2 rounded-full ${
                          isSelected
                            ? 'bg-current border-current'
                            : 'border-current border-opacity-30'
                        }`}>
                          {isSelected && (
                            <div className="w-2 h-2 bg-white rounded-full ml-1 mt-1" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {selectedChoices.length > 0
                ? `${selectedChoices.length} choice${selectedChoices.length !== 1 ? 's' : ''} selected`
                : 'No choices selected'
              }
            </div>
            <div className="flex gap-2">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={selectedChoices.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Selection
              </button>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Press 1-{prompt.choices.length} to select • Enter to confirm • Esc to cancel
          </div>
        </div>
      </div>
    </div>
  );
}

// Utility hook for managing choice dialogs
export function useGSDChoiceDialog() {
  const [currentPrompt, setCurrentPrompt] = useState<GSDChoicePrompt | null>(null);

  const showChoices = useCallback((prompt: GSDChoicePrompt) => {
    setCurrentPrompt(prompt);
  }, []);

  const hideChoices = useCallback(() => {
    setCurrentPrompt(null);
  }, []);

  return {
    currentPrompt,
    showChoices,
    hideChoices,
    isVisible: currentPrompt !== null,
  };
}

// Helper function to create choice prompts
export function createGSDChoicePrompt(
  title: string,
  message: string,
  choices: Omit<GSDChoice, 'id'>[],
  options: Partial<Pick<GSDChoicePrompt, 'allowMultiSelect' | 'timeout' | 'context'>> = {}
): GSDChoicePrompt {
  return {
    id: crypto.randomUUID(),
    title,
    message,
    choices: choices.map(choice => ({
      ...choice,
      id: crypto.randomUUID(),
    })),
    allowMultiSelect: options.allowMultiSelect ?? false,
    timeout: options.timeout,
    context: options.context,
  };
}