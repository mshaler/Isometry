/**
 * FeedbackWidget - Non-intrusive floating feedback collection component
 *
 * Integrates with useFeedbackCollection hook to provide contextual user feedback
 * collection with smart positioning and minimal UI footprint.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFeedbackCollection, type FeedbackData } from '../../hooks/useFeedbackCollection';

interface FeedbackWidgetProps {
  enabled?: boolean;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
}

interface QuickRating {
  value: number;
  label: string;
  emoji: string;
}

const QUICK_RATINGS: QuickRating[] = [
  { value: 1, label: 'Very Poor', emoji: '😤' },
  { value: 2, label: 'Poor', emoji: '😕' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '😊' },
  { value: 5, label: 'Excellent', emoji: '🤩' }
];

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  enabled = true,
  position = 'bottom-right',
  className = ''
}) => {
  const {
    isVisible,
    currentEvent,
    canShowMore,
    submitFeedback,
    dismissFeedback,
    getPromptText
  } = useFeedbackCollection({}, enabled);

  const [feedbackStep, setFeedbackStep] = useState<'prompt' | 'rating' | 'details' | 'thanks'>('prompt');
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FeedbackData['category']>('general');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  const widgetRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when widget becomes visible
  useEffect(() => {
    if (isVisible) {
      setFeedbackStep('prompt');
      setSelectedRating(null);
      setSelectedCategory('general');
      setFeedbackMessage('');
      setIsAnimating(true);

      // Remove animation class after animation completes
      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [isVisible]);

  // Handle outside click to dismiss
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        handleDismiss('outside-click');
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isVisible]);

  // Focus textarea when details step is shown
  useEffect(() => {
    if (feedbackStep === 'details' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [feedbackStep]);

  const handleDismiss = useCallback((reason?: 'manual' | 'timeout' | 'outside-click') => {
    dismissFeedback(reason);
  }, [dismissFeedback]);

  const handleRatingSelect = useCallback((rating: number) => {
    setSelectedRating(rating);

    // Auto-advance to category selection for ratings ≤ 3, or submit for 4-5
    if (rating <= 3) {
      setFeedbackStep('details');
      setSelectedCategory(rating <= 2 ? 'bug-report' : 'concept-clarity');
    } else {
      // For positive ratings, submit immediately with minimal data
      handleSubmit(rating, 'general', '');
    }
  }, []);

  const handleCategorySelect = useCallback((category: FeedbackData['category']) => {
    setSelectedCategory(category);
  }, []);

  const handleSubmit = useCallback((
    rating: number = selectedRating!,
    category: FeedbackData['category'] = selectedCategory,
    message: string = feedbackMessage
  ) => {
    if (!currentEvent) return;

    const contextData = {
      currentView: window.location.hash || 'unknown',
      pafvState: 'unknown', // Would be populated by PAFV context
      userAction: currentEvent.context,
      timeInView: Date.now() - currentEvent.timestamp
    };

    submitFeedback({
      rating,
      category,
      message: message.trim() || undefined,
      contextData
    });

    setFeedbackStep('thanks');
    setTimeout(() => {
      // Widget will be hidden by useFeedbackCollection hook
    }, 1500);
  }, [selectedRating, selectedCategory, feedbackMessage, currentEvent, submitFeedback]);

  const getPositionClasses = () => {
    const base = 'fixed z-50 transition-all duration-300 ease-out';
    const positions = {
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4'
    };
    return `${base} ${positions[position]}`;
  };

  const getAnimationClasses = () => {
    if (!isVisible) return 'translate-y-full opacity-0 pointer-events-none';
    if (isAnimating) return 'translate-y-0 opacity-100 animate-bounce';
    return 'translate-y-0 opacity-100';
  };

  if (!enabled || !canShowMore) return null;

  return (
    <div
      ref={widgetRef}
      className={`
        ${getPositionClasses()}
        ${getAnimationClasses()}
        ${className}
      `}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-w-sm w-80">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Quick Feedback
            </span>
          </div>
          <button
            onClick={() => handleDismiss('manual')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Dismiss feedback"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {feedbackStep === 'prompt' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {getPromptText?.() || 'How was your experience?'}
              </p>
              <div className="grid grid-cols-5 gap-2">
                {QUICK_RATINGS.map((rating) => (
                  <button
                    key={rating.value}
                    onClick={() => handleRatingSelect(rating.value)}
                    className="
                      flex flex-col items-center p-2 rounded-lg
                      hover:bg-gray-50 dark:hover:bg-gray-700
                      transition-colors duration-200
                      group
                    "
                    title={rating.label}
                  >
                    <span className="text-lg group-hover:scale-110 transition-transform">
                      {rating.emoji}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {rating.value}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {feedbackStep === 'details' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Help us understand what happened:
              </p>

              {/* Category Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'concept-clarity', label: 'Concept Clarity' },
                    { id: 'bug-report', label: 'Bug Report' },
                    { id: 'feature-request', label: 'Feature Request' },
                    { id: 'general', label: 'General' }
                  ].map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id as FeedbackData['category'])}
                      className={`
                        px-3 py-2 text-xs rounded-md border transition-colors
                        ${selectedCategory === category.id
                          ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-600 dark:text-blue-300'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-600'
                        }
                      `}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Details (optional)
                </label>
                <textarea
                  ref={textareaRef}
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="Tell us more about your experience..."
                  className="
                    w-full px-3 py-2 text-sm border border-gray-200 rounded-md resize-none
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300
                    dark:focus:ring-blue-400 dark:focus:border-blue-400
                  "
                  rows={3}
                  maxLength={500}
                />
                <div className="text-xs text-gray-400 text-right">
                  {feedbackMessage.length}/500
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => setFeedbackStep('prompt')}
                  className="
                    flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md
                    text-gray-700 hover:bg-gray-50
                    dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700
                    transition-colors
                  "
                >
                  Back
                </button>
                <button
                  onClick={() => handleSubmit()}
                  className="
                    flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md
                    hover:bg-blue-700 transition-colors
                  "
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {feedbackStep === 'thanks' && (
            <div className="text-center space-y-3">
              <div className="text-2xl">🙏</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Thank you for your feedback!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Your input helps us improve the experience.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackWidget;