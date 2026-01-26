import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, Bug, ChevronDown, ChevronUp } from 'lucide-react';

// Type definitions for global error reporting
interface ErrorReportingData {
  error: Error;
  errorInfo?: ErrorInfo;
  level?: string;
  name?: string;
  retryCount: number;
}

interface GlobalErrorReporting {
  reportError: (data: ErrorReportingData) => void;
}

declare global {
  interface Window {
    errorReporting?: GlobalErrorReporting;
  }
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  level?: 'app' | 'feature' | 'component';
  name?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  retryCount: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error for debugging
    console.error(`Error Boundary (${this.props.level || 'unknown'} level):`, {
      name: this.props.name,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount
    });

    // Report to external error tracking if configured
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to global error service if available
    if (typeof window !== 'undefined' && window.errorReporting) {
      window.errorReporting.reportError({
        error,
        errorInfo,
        level: this.props.level,
        name: this.props.name,
        retryCount: this.state.retryCount
      });
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleShowDetails = () => {
    this.setState(prevState => ({ showDetails: !prevState.showDetails }));
  };

  getErrorSeverity = (): 'low' | 'medium' | 'high' => {
    const { level } = this.props;
    const { retryCount } = this.state;

    if (level === 'app' || retryCount > 2) return 'high';
    if (level === 'feature' || retryCount > 0) return 'medium';
    return 'low';
  };

  getErrorMessage = (): string => {
    const { error } = this.state;
    // const { level, name } = this.props; // Level is assigned but not used in current implementation
    const severity = this.getErrorSeverity();

    if (severity === 'high') {
      return 'A critical error occurred. Please refresh the page or contact support if the issue persists.';
    }

    if (severity === 'medium') {
      return `An error occurred in ${name || 'this section'}. You can try again or continue using other parts of the app.`;
    }

    return error?.message || 'Something went wrong. Please try again.';
  };

  getActionableSteps = (): string[] => {
    const severity = this.getErrorSeverity();
    const steps: string[] = [];

    if (severity === 'low') {
      steps.push('Try the action again');
      steps.push('Refresh this section');
    } else if (severity === 'medium') {
      steps.push('Try again in a few moments');
      steps.push('Check your internet connection');
      steps.push('Use other features while we investigate');
    } else {
      steps.push('Refresh the entire page');
      steps.push('Clear browser cache and try again');
      steps.push('Contact support if the problem persists');
    }

    return steps;
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const severity = this.getErrorSeverity();
      const message = this.getErrorMessage();
      const steps = this.getActionableSteps();

      const containerClasses = `p-6 m-4 rounded-lg border-2 ${
        severity === 'high'
          ? 'border-red-500 bg-red-50'
          : severity === 'medium'
          ? 'border-orange-500 bg-orange-50'
          : 'border-yellow-500 bg-yellow-50'
      }`;

      const iconColor = severity === 'high' ? 'text-red-600' : severity === 'medium' ? 'text-orange-600' : 'text-yellow-600';

      return (
        <div className={containerClasses}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-6 h-6 mt-0.5 flex-shrink-0 ${iconColor}`} />
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className={`font-semibold text-lg ${iconColor}`}>
                    {severity === 'high' ? 'Critical Error' : severity === 'medium' ? 'Error Occurred' : 'Something Went Wrong'}
                  </h3>
                  <p className="mt-2 text-gray-700">
                    {message}
                  </p>
                </div>
              </div>

              {/* Actionable steps */}
              <div className="mt-4">
                <p className="font-medium text-gray-800 mb-2">What you can do:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  {steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={this.handleRetry}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>

                <button
                  onClick={this.handleShowDetails}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  <Bug className="w-4 h-4" />
                  {this.state.showDetails ? 'Hide' : 'Show'} Details
                  {this.state.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Error details */}
              {this.state.showDetails && this.state.error && (
                <div className="mt-4 p-4 bg-gray-100 rounded-md">
                  <h4 className="font-medium text-gray-800 mb-2">Technical Details:</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Error:</p>
                      <code className="block text-xs bg-white p-2 rounded mt-1 text-red-600">
                        {this.state.error.message}
                      </code>
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Stack Trace:</p>
                        <pre className="block text-xs bg-white p-2 rounded mt-1 overflow-x-auto max-h-32 text-gray-600">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Component Stack:</p>
                        <pre className="block text-xs bg-white p-2 rounded mt-1 overflow-x-auto max-h-32 text-gray-600">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 pt-2 border-t">
                      Retry count: {this.state.retryCount} |
                      Level: {this.props.level || 'unknown'} |
                      Component: {this.props.name || 'unnamed'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
