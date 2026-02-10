/**
 * Configuration System
 *
 * Main entry point for the configuration management system
 * Exports all types, components, and hooks for configuration management
 */

// Re-export types
export type {
  ConfigurationItem,
  ConfigurationType,
  ValidationRule,
  ValidationType,
  ConfigurationEnvironment,
  ConfigurationChange,
  ChangeSource,
  ValidationResult,
  ConfigurationContextValue,
  ConfigurationProviderProps,
  CloudSyncConfig,
  ConfigurationWrapperProps
} from './configuration/types';

// Re-export validation utilities
export {
  validateConfigurationValue,
  validateAllConfigurations,
  getDefaultValidationRules
} from './configuration/validation';

// Re-export context
export { ConfigurationContext } from './configuration/context';

// Re-export provider
export { ConfigurationProvider } from './configuration/ConfigurationProvider';

// Re-export hooks
export {
  useConfiguration,
  useConfigValue,
  useConfigSetter,
  useConfigValidation,
  useConfigEnvironment,
  useConfigChanges,
  useConfigHotReload
} from './configuration/hooks';

// Re-export components
export {
  ConfigurationWrapper,
  withConfiguration,
  ConfigurationStatus
} from './configuration/components';