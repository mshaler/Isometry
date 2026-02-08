import type { ErrorInfo } from 'react';
import { logger } from '../utils/logging/logger';

// Import the interfaces from ErrorBoundary to ensure compatibility
interface ErrorReportingData {
  error: Error;
  errorInfo?: ErrorInfo;
  level?: string;
  name?: string;
  retryCount: number;
}


export interface ErrorReport {
  id: string;
  timestamp: string;
  level: 'low' | 'medium' | 'high';
  message: string;
  stack?: string;
  componentStack?: string;
  errorBoundary?: {
    name?: string;
    level?: 'app' | 'feature' | 'component';
    retryCount: number;
  };
  userAgent: string;
  url: string;
  userId?: string;
  sessionId: string;
  additionalContext?: Record<string, unknown>;
}

export interface ErrorNotification {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
  autoHide?: boolean;
  duration?: number;
}

class ErrorReportingService {
  private reports: ErrorReport[] = [];
  private notifications: ErrorNotification[] = [];
  private listeners: Array<(notifications: ErrorNotification[]) => void> = [];
  private sessionId: string;
  private maxReports = 100;
  private errorHandler!: (event: ErrorEvent) => void;
  private unhandledRejectionHandler!: (event: PromiseRejectionEvent) => void;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalErrorHandlers(): void {
    // Create bound handlers to enable cleanup
    this.errorHandler = (event: ErrorEvent) => {
      this.reportError({
        error: event.error || new Error(event.message),
        level: 'app',
        additionalContext: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          type: 'javascript'
        }
      });
    };

    this.unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      this.reportError({
        error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        level: 'feature',
        additionalContext: {
          type: 'promise_rejection',
          reason: event.reason
        }
      });
    };

    // Global unhandled errors
    window.addEventListener('error', this.errorHandler);

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);

    // Make service available globally for error boundaries
    (window as unknown as { errorReporting: ErrorReportingService }).errorReporting = this;
  }

  public reportError(params: {
    error: Error;
    errorInfo?: ErrorInfo;
    level?: 'app' | 'feature' | 'component';
    name?: string;
    retryCount?: number;
    additionalContext?: Record<string, unknown>;
  }): string {
    const reportId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const severity = this.determineSeverity(params.error, params.level, params.retryCount);

    const report: ErrorReport = {
      id: reportId,
      timestamp: new Date().toISOString(),
      level: severity,
      message: params.error.message,
      stack: params.error.stack,
      componentStack: params.errorInfo?.componentStack ?? undefined,
      errorBoundary: params.level ? {
        name: params.name,
        level: params.level,
        retryCount: params.retryCount || 0
      } : undefined,
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.sessionId,
      additionalContext: params.additionalContext
    };

    // Store report
    this.reports.unshift(report);
    if (this.reports.length > this.maxReports) {
      this.reports = this.reports.slice(0, this.maxReports);
    }

    // Log to structured logger
    logger.error('error-reporting', 'Error reported', {
      reportId: report.id,
      level: report.level,
      message: report.message,
      url: report.url
    });

    // Create user notification if appropriate
    this.createErrorNotification(report);

    return reportId;
  }

  // Adapter method for GlobalErrorReporting compatibility
  public reportErrorGlobal(data: ErrorReportingData): void {
    this.reportError({
      error: data.error,
      errorInfo: data.errorInfo,
      level: data.level as 'app' | 'feature' | 'component' | undefined,
      name: data.name,
      retryCount: data.retryCount
    });
  }

  private determineSeverity(
    error: Error,
    level?: 'app' | 'feature' | 'component',
    retryCount = 0
  ): 'low' | 'medium' | 'high' {
    // High severity conditions
    if (level === 'app') return 'high';
    if (retryCount > 2) return 'high';
    if (error.name === 'ChunkLoadError') return 'high'; // Bundle loading failures
    if (error.message.includes('out of memory')) return 'high';

    // Medium severity conditions
    if (level === 'feature') return 'medium';
    if (retryCount > 0) return 'medium';
    if (error.name === 'NetworkError') return 'medium';
    if (error.name === 'TypeError' && error.message.includes('fetch')) return 'medium';

    // Default to low
    return 'low';
  }

  private createErrorNotification(report: ErrorReport): void {
    // Don't spam user with too many error notifications
    if (this.notifications.filter(n => n.type === 'error').length >= 3) {
      return;
    }

    const notification: ErrorNotification = {
      id: `notif_${report.id}`,
      type: 'error',
      title: this.getNotificationTitle(report.level),
      message: this.getNotificationMessage(report),
      actions: this.getNotificationActions(report),
      autoHide: report.level === 'low',
      duration: report.level === 'low' ? 5000 : undefined
    };

    this.addNotification(notification);
  }

  private getNotificationTitle(level: 'low' | 'medium' | 'high'): string {
    switch (level) {
      case 'high': return 'Critical Error';
      case 'medium': return 'Error Occurred';
      case 'low': return 'Something Went Wrong';
    }
  }

  private getNotificationMessage(report: ErrorReport): string {
    if (report.level === 'high') {
      return 'A critical error has occurred. Please refresh the page.';
    }
    if (report.level === 'medium') {
      return 'An error occurred. Some features may not work properly.';
    }
    return 'A minor error occurred. You can continue using the app normally.';
  }

  private getNotificationActions(report: ErrorReport): Array<{ label: string; action: () => void }> {
    const actions: Array<{ label: string; action: () => void }> = [];

    if (report.level === 'high') {
      actions.push({
        label: 'Refresh Page',
        action: () => window.location.reload()
      });
    } else {
      actions.push({
        label: 'Retry',
        action: () => {
          // This would need to be connected to the specific operation
          // For now, just remove the notification
          this.removeNotification(report.id);
        }
      });
    }

    actions.push({
      label: 'Dismiss',
      action: () => this.removeNotification(`notif_${report.id}`)
    });

    return actions;
  }

  public addNotification(notification: ErrorNotification): void {
    this.notifications.unshift(notification);
    this.notifyListeners();

    if (notification.autoHide && notification.duration) {
      setTimeout(() => {
        this.removeNotification(notification.id);
      }, notification.duration);
    }
  }

  public removeNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notifyListeners();
  }

  public getNotifications(): ErrorNotification[] {
    return [...this.notifications];
  }

  public onNotificationsChange(listener: (notifications: ErrorNotification[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const currentNotifications = [...this.notifications];
    this.listeners.forEach(listener => listener(currentNotifications));
  }

  public getReports(limit?: number): ErrorReport[] {
    return limit ? this.reports.slice(0, limit) : [...this.reports];
  }

  public clearReports(): void {
    this.reports = [];
  }

  public getSessionInfo(): { sessionId: string; reportCount: number; highSeverityCount: number } {
    return {
      sessionId: this.sessionId,
      reportCount: this.reports.length,
      highSeverityCount: this.reports.filter(r => r.level === 'high').length
    };
  }

  public destroy(): void {
    // Remove global error handlers to prevent memory leaks
    if (this.errorHandler) {
      window.removeEventListener('error', this.errorHandler);
    }
    if (this.unhandledRejectionHandler) {
      window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
    }

    // Clear all data and listeners
    this.reports = [];
    this.notifications = [];
    this.listeners = [];

    // Remove global reference
    interface WindowWithErrorReporting extends Window {
      errorReporting?: any; // Use any to avoid interface compatibility issues
    }
    delete (window as WindowWithErrorReporting).errorReporting;
  }

  // User feedback methods
  public reportUserError(
    title: string,
    _message: string,
    actions?: Array<{ label: string; action: () => void }>
  ): void {
    const notification: ErrorNotification = {
      id: `user_${Date.now()}`,
      type: 'error',
      title,
      message: _message,
      actions: actions || [{
        label: 'OK',
        action: () => this.removeNotification(`user_${Date.now()}`)
      }]
    };

    this.addNotification(notification);
  }

  public reportUserWarning(title: string, message: string): void {
    const notification: ErrorNotification = {
      id: `warning_${Date.now()}`,
      type: 'warning',
      title,
      message,
      autoHide: true,
      duration: 4000
    };

    this.addNotification(notification);
  }

  public reportUserInfo(title: string, message: string): void {
    const notification: ErrorNotification = {
      id: `info_${Date.now()}`,
      type: 'info',
      title,
      message,
      autoHide: true,
      duration: 3000
    };

    this.addNotification(notification);
  }
}

// Create singleton instance
export const errorReporting = new ErrorReportingService();

// Export hook for React components
export function useErrorReporting() {
  return errorReporting;
}