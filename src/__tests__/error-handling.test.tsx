import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { errorReporting } from '../services/ErrorReportingService';
import { NotificationSystem } from '../components/ui/NotificationSystem';

// Test component that throws an error
function ErrorThrowingComponent({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div data-testid="success">No error</div>;
}

// Mock console.error to avoid noise in test output
const consoleMock = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Error Handling System', () => {
  beforeEach(() => {
    // Clear any existing notifications
    errorReporting.getNotifications().forEach(n => {
      errorReporting.removeNotification(n.id);
    });
    consoleMock.mockClear();
  });

  afterAll(() => {
    consoleMock.mockRestore();
  });

  describe('ErrorBoundary', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary level="component" name="test">
          <ErrorThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('success')).toBeInTheDocument();
    });

    it('should catch errors and display error UI', () => {
      render(
        <ErrorBoundary level="component" name="test">
          <ErrorThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
      expect(screen.getByText(/Test error message/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should allow retry after error', async () => {
      // Test with a component that can be fixed
      let shouldThrow = true;
      function ConditionalErrorComponent() {
        if (shouldThrow) {
          throw new Error('Test error message');
        }
        return <div data-testid="success">No error</div>;
      }

      const { rerender } = render(
        <ErrorBoundary level="component" name="test">
          <ConditionalErrorComponent />
        </ErrorBoundary>
      );

      // Error is displayed
      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();

      // Fix the component
      shouldThrow = false;

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);

      // Rerender with fixed component
      rerender(
        <ErrorBoundary level="component" name="test">
          <ConditionalErrorComponent />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByTestId('success')).toBeInTheDocument();
      });
    });

    it('should show high severity for app-level errors', () => {
      render(
        <ErrorBoundary level="app" name="test">
          <ErrorThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Critical Error')).toBeInTheDocument();
      expect(screen.getByText(/critical error occurred/i)).toBeInTheDocument();
    });

    it('should show medium severity for feature-level errors', () => {
      render(
        <ErrorBoundary level="feature" name="test">
          <ErrorThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error Occurred')).toBeInTheDocument();
    });

    it('should show technical details when requested', () => {
      render(
        <ErrorBoundary level="component" name="test">
          <ErrorThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Initially details are hidden
      expect(screen.queryByText('Technical Details:')).not.toBeInTheDocument();

      // Click show details button - look for button by text content that includes "Details"
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);

      // Now details should be visible
      expect(screen.getByText('Technical Details:')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });
  });

  describe('ErrorReportingService', () => {
    it('should report errors and create notifications', () => {
      const testError = new Error('Service test error');

      errorReporting.reportError({
        error: testError,
        level: 'component',
        name: 'TestComponent'
      });

      const notifications = errorReporting.getNotifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].type).toBe('error');
      expect(notifications[0].title).toBe('Something Went Wrong');
    });

    it('should handle user error reports with actions', () => {
      const mockAction = vi.fn();

      errorReporting.reportUserError(
        'Test Error',
        'This is a test error message',
        [
          { label: 'Test Action', action: mockAction },
          { label: 'Dismiss', _action: () => {} }
        ]
      );

      const notifications = errorReporting.getNotifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].title).toBe('Test Error');
      expect(notifications[0].message).toBe('This is a test error message');
      expect(notifications[0].actions).toHaveLength(2);
    });

    it('should auto-hide info notifications', async () => {
      errorReporting.reportUserInfo('Test Info', 'Auto-hide message');

      const notifications = errorReporting.getNotifications();
      expect(notifications.length).toBe(1);
      expect(notifications[0].autoHide).toBe(true);
      expect(notifications[0].duration).toBe(3000);
    });

    it('should track session information', () => {
      const sessionInfo = errorReporting.getSessionInfo();
      expect(sessionInfo.sessionId).toBeDefined();
      expect(typeof sessionInfo.reportCount).toBe('number');
      expect(typeof sessionInfo.highSeverityCount).toBe('number');
    });
  });

  describe('NotificationSystem', () => {
    it('should render notifications from error reporting service', async () => {
      render(<NotificationSystem />);

      // Add a notification
      errorReporting.reportUserError('Test Notification', 'Test message');

      // Should appear in the notification system
      await waitFor(() => {
        expect(screen.getByText('Test Notification')).toBeInTheDocument();
        expect(screen.getByText('Test message')).toBeInTheDocument();
      });
    });

    it('should handle notification dismissal', async () => {
      render(<NotificationSystem />);

      // Add a notification
      errorReporting.reportUserError('Test Notification', 'Test message');

      // Should be visible
      await waitFor(() => {
        expect(screen.getByText('Test Notification')).toBeInTheDocument();
      });

      // Click dismiss button
      const dismissButton = screen.getByLabelText('Dismiss notification');
      fireEvent.click(dismissButton);

      // Should be removed
      await waitFor(() => {
        expect(screen.queryByText('Test Notification')).not.toBeInTheDocument();
      });
    });

    it('should execute notification actions', async () => {
      const mockAction = vi.fn();
      render(<NotificationSystem />);

      // Add notification with action
      errorReporting.reportUserError(
        'Test Action',
        'Test message',
        [{ label: 'Test Button', action: mockAction }]
      );

      // Wait for notification to appear
      await waitFor(() => {
        expect(screen.getByText('Test Action')).toBeInTheDocument();
      });

      // Click the action button
      const actionButton = screen.getByRole('button', { name: 'Test Button' });
      fireEvent.click(actionButton);

      // Action should have been called
      expect(mockAction).toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should integrate error boundary with notification system', () => {
      const onErrorSpy = vi.fn();

      render(
        <>
          <ErrorBoundary level="feature" name="test" onError={onErrorSpy}>
            <ErrorThrowingComponent shouldThrow={true} />
          </ErrorBoundary>
          <NotificationSystem />
        </>
      );

      // Error boundary should catch error and display appropriate UI
      expect(screen.getByText(/An error occurred/)).toBeInTheDocument();

      // onError callback should be called
      expect(onErrorSpy).toHaveBeenCalled();
      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });
  });
});