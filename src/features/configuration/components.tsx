/**
 * Configuration Components
 *
 * Additional components for configuration management
 */

import React, { ComponentType } from 'react';
import { ConfigurationProvider } from './ConfigurationProvider';
import { useConfiguration } from './hooks';
import type { ConfigurationWrapperProps } from './types';

/**
 * Configuration wrapper component with error boundary
 */
export const ConfigurationWrapper: React.FC<ConfigurationWrapperProps> = ({
  children,
  fallback = <div>Loading configuration...</div>,
  errorBoundary = true
}) => {
  if (errorBoundary) {
    return (
      <ConfigurationErrorBoundary fallback={fallback}>
        {children}
      </ConfigurationErrorBoundary>
    );
  }
  
  return <>{children}</>;
};

/**
 * HOC for wrapping components with configuration
 */
export function withConfiguration<P extends object>(
  WrappedComponent: ComponentType<P>,
  configKey?: string
) {
  const WithConfigurationComponent = (props: P) => {
    const config = useConfiguration();
    
    const configProps = configKey 
      ? { [configKey]: config }
      : { configuration: config };
    
    return <WrappedComponent {...props} {...configProps} />;
  };
  
  WithConfigurationComponent.displayName = `withConfiguration(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithConfigurationComponent;
}

/**
 * Error boundary for configuration
 */
class ConfigurationErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Configuration error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    
    return this.props.children;
  }
}

/**
 * Configuration status component
 */
export const ConfigurationStatus: React.FC = () => {
  const { configurations, currentEnvironment, isLoading, error } = useConfiguration();
  
  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading configurations...</div>;
  }
  
  if (error) {
    return <div className="text-sm text-red-500">Configuration error: {error.message}</div>;
  }
  
  return (
    <div className="text-sm text-gray-600">
      {configurations.length} configurations loaded ({currentEnvironment})
    </div>
  );
};
