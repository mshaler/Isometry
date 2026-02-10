/**
 * Configuration System Types
 *
 * Type definitions for the configuration management system
 */

export interface ConfigurationItem {
  id: string;
  key: string;
  value: string;
  type: ConfigurationType;
  category: string;
  description: string;
  isRequired: boolean;
  validationRules: ValidationRule[];
  environmentValues: Record<string, string>;
  lastModified: Date;
}

export type ConfigurationType = 'string' | 'boolean' | 'integer' | 'double' | 'json' | 'url' | 'email' | 'array';

export interface ValidationRule {
  type: ValidationType;
  parameter?: string;
  message: string;
}

export type ValidationType = 'required' | 'minLength' | 'maxLength' | 'pattern' | 'range' | 'url' | 'email' | 'json';

export type ConfigurationEnvironment = 'development' | 'staging' | 'production';

export interface ConfigurationChange {
  id: string;
  key: string;
  oldValue?: string;
  newValue?: string;
  environment?: string;
  timestamp: Date;
  source: ChangeSource;
}

export type ChangeSource = 'user' | 'bulk' | 'hotReload' | 'cloudSync' | 'rollback' | 'import' | 'system';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedValue?: string;
}

// Context types
export interface ConfigurationContextValue {
  configurations: ConfigurationItem[];
  currentEnvironment: ConfigurationEnvironment;
  isLoading: boolean;
  error?: Error;
  
  // Core operations
  setValue: (key: string, value: string, environment?: string) => Promise<void>;
  getValue: <T = unknown>(key: string, environment?: string) => T | undefined;
  deleteConfiguration: (key: string) => Promise<void>;
  
  // Validation
  validate: (key: string, value: string) => ValidationResult;
  validateAll: () => Record<string, ValidationResult>;
  
  // Bulk operations
  setMultiple: (changes: Record<string, string>, environment?: string) => Promise<void>;
  exportConfiguration: (environment?: string) => Record<string, string>;
  importConfiguration: (config: Record<string, string>, environment?: string) => Promise<void>;
  
  // Environment management
  switchEnvironment: (environment: ConfigurationEnvironment) => void;
  getEnvironments: () => ConfigurationEnvironment[];
  
  // Change tracking
  getChanges: (limit?: number) => ConfigurationChange[];
  rollback: (changeId: string) => Promise<void>;
  
  // Subscription
  subscribe: (key: string, callback: (value: string) => void) => () => void;
  subscribeToChanges: (callback: (change: ConfigurationChange) => void) => () => void;
  
  // Hot reload
  enableHotReload: (enabled: boolean) => void;
  isHotReloadEnabled: () => boolean;
}

export interface ConfigurationProviderProps {
  children: React.ReactNode;
  initialEnvironment?: ConfigurationEnvironment;
  enableCloudSync?: boolean;
  cloudSyncConfig?: CloudSyncConfig;
  enableHotReload?: boolean;
  validationMode?: 'strict' | 'lenient';
}

export interface CloudSyncConfig {
  apiEndpoint: string;
  apiKey?: string;
  syncInterval: number; // milliseconds
  conflictResolution: 'local' | 'remote' | 'manual';
}

export interface ConfigurationWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorBoundary?: boolean;
}
