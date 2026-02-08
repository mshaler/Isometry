/**
 * useFeedbackCollection - Real-time user feedback collection hook
 *
 * Provides interface for collecting contextual user feedback with smart triggering
 * and non-intrusive UX patterns. Integrates with existing analytics service.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { analytics } from '../utils/logging/analytics';

export interface FeedbackEvent {
  id: string;
  type: 'confusion' | 'success' | 'frustration' | 'discovery';
  context: string;
  timestamp: number;
  userAgent: string;
  sessionId: string;
}

export interface FeedbackData {
  eventId: string;
  rating?: number; // 1-5 scale
  category: 'concept-clarity' | 'feature-request' | 'bug-report' | 'general';
  message?: string;
  contextData: {
    currentView: string;
    pafvState: string;
    userAction: string;
    timeInView: number;
  };
  timestamp: number;
}

export interface FeedbackDisplayRules {
  maxPerSession: number;
  cooldownMinutes: number;
  contextAware: boolean;
  triggerDelay: number; // ms after triggering event
}

export interface FeedbackCollectionState {
  isVisible: boolean;
  currentEvent: FeedbackEvent | null;
  sessionCount: number;
  lastShownTimestamp: number;
  collectedFeedback: FeedbackData[];
}

const DEFAULT_DISPLAY_RULES: FeedbackDisplayRules = {
  maxPerSession: 3,
  cooldownMinutes: 10,
  contextAware: true,
  triggerDelay: 2000
};

const SESSION_STORAGE_KEY = 'isometry_feedback_state';

export function useFeedbackCollection(
  displayRules: Partial<FeedbackDisplayRules> = {},
  enabled: boolean = true
) {
  const rules = { ...DEFAULT_DISPLAY_RULES, ...displayRules };

  const [state, setState] = useState<FeedbackCollectionState>(() => {
    // Load persisted state from session storage
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return {
            isVisible: false, // Never restore visibility
            currentEvent: null,
            sessionCount: parsed.sessionCount || 0,
            lastShownTimestamp: parsed.lastShownTimestamp || 0,
            collectedFeedback: parsed.collectedFeedback || []
          };
        } catch {
          // Fall through to default state
        }
      }
    }

    return {
      isVisible: false,
      currentEvent: null,
      sessionCount: 0,
      lastShownTimestamp: 0,
      collectedFeedback: []
    };
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string>(generateSessionId());

  // Persist state changes to session storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        sessionCount: state.sessionCount,
        lastShownTimestamp: state.lastShownTimestamp,
        collectedFeedback: state.collectedFeedback
      }));
    }
  }, [state.sessionCount, state.lastShownTimestamp, state.collectedFeedback]);

  // Check if feedback can be shown based on display rules
  const canShowFeedback = useCallback(() => {
    if (!enabled) return false;

    const now = Date.now();
    const timeSinceLastShown = now - state.lastShownTimestamp;
    const cooldownMs = rules.cooldownMinutes * 60 * 1000;

    return (
      state.sessionCount < rules.maxPerSession &&
      timeSinceLastShown > cooldownMs &&
      !state.isVisible
    );
  }, [enabled, state.sessionCount, state.lastShownTimestamp, state.isVisible, rules]);

  // Trigger feedback collection for specific events
  const triggerFeedback = useCallback((
    type: FeedbackEvent['type'],
    context: string,
    userAction?: string
  ) => {
    if (!canShowFeedback()) {
      return;
    }

    const event: FeedbackEvent = {
      id: generateEventId(),
      type,
      context,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: sessionIdRef.current
    };

    // Track the trigger event in analytics
    analytics.track('feedback_triggered', 'User_Testing', `${type}:${context}`);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Show feedback after delay (allows user to complete their action)
    timeoutRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        isVisible: true,
        currentEvent: event,
        lastShownTimestamp: Date.now()
      }));
    }, rules.triggerDelay);
  }, [canShowFeedback, rules.triggerDelay]);

  // Context-aware feedback triggers based on user behavior patterns
  const triggerConfusion = useCallback((context: string) => {
    triggerFeedback('confusion', context);
  }, [triggerFeedback]);

  const triggerSuccess = useCallback((context: string) => {
    triggerFeedback('success', context);
  }, [triggerFeedback]);

  const triggerFrustration = useCallback((context: string) => {
    triggerFeedback('frustration', context);
  }, [triggerFeedback]);

  const triggerDiscovery = useCallback((context: string) => {
    triggerFeedback('discovery', context);
  }, [triggerFeedback]);

  // Submit feedback data
  const submitFeedback = useCallback((feedbackData: Omit<FeedbackData, 'eventId' | 'timestamp'>) => {
    if (!state.currentEvent) return;

    const completeFeedback: FeedbackData = {
      ...feedbackData,
      eventId: state.currentEvent.id,
      timestamp: Date.now()
    };

    // Store feedback locally
    setState(prev => ({
      ...prev,
      isVisible: false,
      currentEvent: null,
      sessionCount: prev.sessionCount + 1,
      collectedFeedback: [...prev.collectedFeedback, completeFeedback]
    }));

    // Send to analytics service
    analytics.track('feedback_submitted', 'User_Testing', `${feedbackData.category}:${feedbackData.rating || 'no-rating'}`);

    // Send detailed feedback to backend if available
    if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.userFeedback) {
      window.webkit.messageHandlers.userFeedback.postMessage({
        type: 'feedbackSubmitted',
        data: completeFeedback,
        event: state.currentEvent
      }).catch((error: Error) => {
        console.warn('Failed to send feedback to native:', error);
      });
    }

    // Debug logging in development
    if (import.meta.env.DEV) {
      console.log('Feedback submitted:', {
        event: state.currentEvent,
        feedback: completeFeedback
      });
    }
  }, [state.currentEvent]);

  // Dismiss feedback without submitting
  const dismissFeedback = useCallback((reason: 'manual' | 'timeout' | 'outside-click' = 'manual') => {
    if (state.currentEvent) {
      analytics.track('feedback_dismissed', 'User_Testing', reason);
    }

    setState(prev => ({
      ...prev,
      isVisible: false,
      currentEvent: null,
      sessionCount: prev.sessionCount + 1 // Count dismissal to prevent spam
    }));
  }, [state.currentEvent]);

  // Get contextual prompt text based on event type and context
  const getPromptText = useCallback((event: FeedbackEvent): string => {
    const contextMap = {
      confusion: {
        'axis-mapping': 'How clear was that axis mapping process?',
        'view-transition': 'Did that view transition make sense?',
        'pafv-concept': 'How well do you understand the PAFV spatial projection?',
        default: 'Was that confusing? Help us improve!'
      },
      success: {
        'axis-mapping': 'Great! How smooth was that axis mapping?',
        'view-transition': 'Nice transition! How intuitive was that?',
        'feature-discovery': 'You found a new feature! How discoverable was it?',
        default: 'Awesome! How was that experience?'
      },
      frustration: {
        'performance': 'Sorry about the slowness. How problematic was that?',
        'ui-interaction': 'That interaction seemed difficult. How frustrating?',
        default: 'We noticed you might be stuck. How can we help?'
      },
      discovery: {
        'super-feature': 'You discovered a Super* feature! How easy was it to find?',
        'shortcut': 'You found a keyboard shortcut! How discoverable was it?',
        default: 'You found something new! How obvious was it?'
      }
    };

    const typeMap = contextMap[event.type];
    return typeMap[event.context as keyof typeof typeMap] || typeMap.default;
  }, []);

  // Auto-dismiss after timeout
  useEffect(() => {
    if (state.isVisible && state.currentEvent) {
      const timeout = setTimeout(() => {
        dismissFeedback('timeout');
      }, 30000); // 30 second timeout

      return () => clearTimeout(timeout);
    }
  }, [state.isVisible, state.currentEvent, dismissFeedback]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    isVisible: state.isVisible,
    currentEvent: state.currentEvent,
    sessionCount: state.sessionCount,
    canShowMore: state.sessionCount < rules.maxPerSession,

    // Trigger functions
    triggerConfusion,
    triggerSuccess,
    triggerFrustration,
    triggerDiscovery,

    // Interaction functions
    submitFeedback,
    dismissFeedback,

    // Utility functions
    getPromptText: state.currentEvent ? () => getPromptText(state.currentEvent!) : null,

    // Analytics data
    collectedFeedback: state.collectedFeedback,

    // Configuration
    displayRules: rules
  };
}

// Helper functions
function generateEventId(): string {
  return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Type extensions for native bridge
declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        userFeedback?: {
          postMessage: (data: unknown) => Promise<unknown>;
        };
      };
    };
  }
}