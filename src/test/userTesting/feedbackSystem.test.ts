/**
 * User Testing Feedback System Tests
 *
 * Validates the real-time feedback collection system
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedbackCollection } from '../../hooks/useFeedbackCollection';

// Mock session storage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock analytics
vi.mock('../../utils/logging/analytics', () => ({
  analytics: {
    track: vi.fn(),
  },
}));

describe.skip('useFeedbackCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('initializes with default state', () => {
    const { result } = renderHook(() => useFeedbackCollection());

    expect(result.current.isVisible).toBe(false);
    expect(result.current.currentEvent).toBe(null);
    expect(result.current.sessionCount).toBe(0);
    expect(result.current.canShowMore).toBe(true);
  });

  test('respects display rules for maximum sessions', () => {
    const displayRules = { maxPerSession: 2 };
    const { result } = renderHook(() => useFeedbackCollection(displayRules));

    // Trigger feedback multiple times
    act(() => {
      result.current.triggerConfusion('test-context');
    });

    expect(result.current.canShowMore).toBe(true);

    // Complete feedback cycle to increment session count
    act(() => {
      result.current.dismissFeedback('manual');
    });

    expect(result.current.sessionCount).toBe(1);

    // Trigger again
    act(() => {
      result.current.triggerSuccess('another-test');
    });

    act(() => {
      result.current.dismissFeedback('manual');
    });

    expect(result.current.sessionCount).toBe(2);
    expect(result.current.canShowMore).toBe(false);
  });

  test('triggers feedback with delay', async () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useFeedbackCollection({ triggerDelay: 1000 }));

    act(() => {
      result.current.triggerConfusion('axis-mapping');
    });

    // Should not be visible immediately
    expect(result.current.isVisible).toBe(false);

    // Fast-forward past delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isVisible).toBe(true);
    expect(result.current.currentEvent?.type).toBe('confusion');
    expect(result.current.currentEvent?.context).toBe('axis-mapping');
  });

  test('submits feedback correctly', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useFeedbackCollection({ triggerDelay: 0 }));

    // Trigger feedback
    act(() => {
      result.current.triggerSuccess('view-transition');
    });

    expect(result.current.isVisible).toBe(true);

    // Submit feedback
    act(() => {
      result.current.submitFeedback({
        rating: 4,
        category: 'concept-clarity',
        message: 'That worked well!',
        contextData: {
          currentView: 'supergrid',
          pafvState: 'L:created,A:name,T:modified,C:status,H:priority',
          userAction: 'view-transition',
          timeInView: 5000
        }
      });
    });

    expect(result.current.isVisible).toBe(false);
    expect(result.current.sessionCount).toBe(1);
    expect(result.current.collectedFeedback).toHaveLength(1);

    const feedback = result.current.collectedFeedback[0];
    expect(feedback.rating).toBe(4);
    expect(feedback.category).toBe('concept-clarity');
    expect(feedback.message).toBe('That worked well!');
  });

  test('respects cooldown period', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useFeedbackCollection({
        cooldownMinutes: 5,
        triggerDelay: 0
      })
    );

    // Trigger and dismiss first feedback
    act(() => {
      result.current.triggerConfusion('test');
      result.current.dismissFeedback('manual');
    });

    expect(result.current.sessionCount).toBe(1);

    // Try to trigger again immediately (should be blocked by cooldown)
    act(() => {
      result.current.triggerConfusion('test2');
    });

    expect(result.current.isVisible).toBe(false);

    // Fast-forward past cooldown (5 minutes = 300,000 ms)
    act(() => {
      vi.advanceTimersByTime(300001);
    });

    // Now should be able to trigger again
    act(() => {
      result.current.triggerConfusion('test3');
    });

    expect(result.current.isVisible).toBe(true);
  });

  test('provides correct prompt text for different event types', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useFeedbackCollection({ triggerDelay: 0 }));

    act(() => {
      result.current.triggerConfusion('axis-mapping');
    });

    const promptText = result.current.getPromptText?.();
    expect(promptText).toBe('How clear was that axis mapping process?');
  });

  test('handles session storage persistence', () => {
    const storedData = JSON.stringify({
      sessionCount: 2,
      lastShownTimestamp: Date.now() - 1000,
      collectedFeedback: [
        {
          eventId: 'test-event',
          rating: 3,
          category: 'general',
          contextData: {},
          timestamp: Date.now()
        }
      ]
    });

    sessionStorageMock.getItem.mockReturnValue(storedData);

    const { result } = renderHook(() => useFeedbackCollection());

    expect(result.current.sessionCount).toBe(2);
    expect(result.current.collectedFeedback).toHaveLength(1);
  });

  test('auto-dismisses after timeout', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useFeedbackCollection({ triggerDelay: 0 }));

    act(() => {
      result.current.triggerConfusion('test');
    });

    expect(result.current.isVisible).toBe(true);

    // Fast-forward 30 seconds (auto-dismiss timeout)
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(result.current.isVisible).toBe(false);
  });

  test('tracks different event types correctly', () => {
    const { result } = renderHook(() => useFeedbackCollection());

    // Test all trigger types
    act(() => {
      result.current.triggerConfusion('confusion-test');
    });
    expect(result.current.currentEvent?.type).toBe('confusion');

    act(() => {
      result.current.dismissFeedback();
    });

    act(() => {
      result.current.triggerSuccess('success-test');
    });
    expect(result.current.currentEvent?.type).toBe('success');

    act(() => {
      result.current.dismissFeedback();
    });

    act(() => {
      result.current.triggerFrustration('frustration-test');
    });
    expect(result.current.currentEvent?.type).toBe('frustration');

    act(() => {
      result.current.dismissFeedback();
    });

    act(() => {
      result.current.triggerDiscovery('discovery-test');
    });
    expect(result.current.currentEvent?.type).toBe('discovery');
  });
});

describe.skip('FeedbackWidget Integration', () => {
  test('should render without errors when enabled', async () => {
    // This is a smoke test - actual rendering tests would need React Testing Library
    // and proper DOM setup
    const { useFeedbackCollection } = await import('../../hooks/useFeedbackCollection');
    const hook = useFeedbackCollection();

    expect(hook).toBeDefined();
    expect(typeof hook.triggerConfusion).toBe('function');
    expect(typeof hook.submitFeedback).toBe('function');
    expect(typeof hook.dismissFeedback).toBe('function');
  });
});