import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { logger } from '../utils/logger';

// Types for configuration management system
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

// Configuration context
interface ConfigurationContextValue {
  configurations: Record<string, ConfigurationItem>;
  environment: ConfigurationEnvironment;
  isLoading: boolean;
  error?: string;
  getValue: <T>(key: string, defaultValue?: T) => T | undefined;
  setValue: <T>(key: string, value: T, environment?: ConfigurationEnvironment) => Promise<void>;
  setBulkValues: (updates: Record<string, unknown>, environment?: ConfigurationEnvironment) => Promise<void>;
  getConfigurationItem: (key: string) => ConfigurationItem | undefined;
  getAllConfigurations: () => Record<string, ConfigurationItem>;
  getConfigurationsByCategory: (category: string) => Record<string, ConfigurationItem>;
  rollback: (key: string) => Promise<void>;
  hotReload: () => Promise<void>;
  exportConfigurations: (format?: 'json' | 'plist') => string | null;
  importConfigurations: (data: string, format?: 'json' | 'plist') => Promise<void>;
  validateConfiguration: (key: string, value: string) => ValidationResult;
}

const ConfigurationContext = createContext<ConfigurationContextValue | undefined>(undefined);

// Configuration provider component
interface ConfigurationProviderProps {
  children: ReactNode;
  environment?: ConfigurationEnvironment;
  enableHotReload?: boolean;
  hotReloadInterval?: number; // in milliseconds
}

export const ConfigurationProvider: React.FC<ConfigurationProviderProps> = ({
  children,
  environment: propEnvironment,
  enableHotReload = true,
  hotReloadInterval = 60000 // 1 minute
}) => {
  const [configurations, setConfigurations] = useState<Record<string, ConfigurationItem>>({});
  const [environment, setEnvironment] = useState<ConfigurationEnvironment>('production');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  // Cache for parsed values to improve performance
  const [valueCache] = useState<Map<string, { value: unknown; timestamp: number }>>(new Map());
  const cacheValidityMs = 30000; // 30 seconds

  // Bridge communication for native integration
  const communicateWithNative = async (method: string, params: unknown = {}) => {
    if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.configuration) {
      try {
        return await window.webkit.messageHandlers.configuration.postMessage({
          method,
          params
        });
      } catch (error) {
        logger.warn('configuration', 'Native configuration communication failed', {}, error as Error);
        return null;
      }
    }
    return null;
  };

  // Detect environment
  const detectEnvironment = (): ConfigurationEnvironment => {
    if (propEnvironment) return propEnvironment;

    if (typeof window !== 'undefined') {
      // Check for environment indicators
      if (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')) {
        return 'development';
      }
      if (window.location.hostname.includes('staging') || window.location.hostname.includes('beta')) {
        return 'staging';
      }
    }

    // Check Node environment
    if (typeof process !== 'undefined') {
      if (process.env.NODE_ENV === 'development') return 'development';
      if (process.env.NODE_ENV === 'test') return 'staging';
    }

    return 'production';
  };

  // Load configurations from native or local storage
  const loadConfigurations = async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      // Try to get configurations from native first
      let configData = await communicateWithNative('getConfigurations');

      // Fallback to local storage if native unavailable
      if (!configData && typeof window !== 'undefined') {
        const stored = localStorage.getItem('app_configurations');
        if (stored) {
          configData = JSON.parse(stored);
        }
      }

      // Use default configurations if nothing available
      if (!configData) {
        configData = getDefaultConfigurations();
      }

      // Process configurations to ensure proper typing
      const processedConfigs = processConfigurations(configData);
      setConfigurations(processedConfigs);

      // Cache in local storage
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_configurations', JSON.stringify(configData));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load configurations';
      setError(errorMessage);
      logger.error('configuration', 'Error loading configurations', {}, err as Error);

      // Load cached configurations as fallback
      try {
        const cached = localStorage.getItem('app_configurations');
        if (cached) {
          const cachedConfigs = processConfigurations(JSON.parse(cached));
          setConfigurations(cachedConfigs);
        }
      } catch (cacheError) {
        logger.error('configuration', 'Failed to load cached configurations', {}, cacheError as Error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Process configuration data to ensure proper typing
  const processConfigurations = (data: unknown): Record<string, ConfigurationItem> => {
    if (!data || typeof data !== 'object') return {};

    const processed: Record<string, ConfigurationItem> = {};
    for (const [key, config] of Object.entries(data as Record<string, unknown>)) {
      if (isValidConfiguration(config)) {
        processed[key] = {
          ...config as ConfigurationItem,
          lastModified: new Date(config.lastModified)
        };
      }
    }
    return processed;
  };

  // Validate configuration structure
  const isValidConfiguration = (config: unknown): config is ConfigurationItem => {
    if (!config || typeof config !== 'object') return false;
    const c = config as Partial<ConfigurationItem>;
    return !!(c.key && c.value !== undefined && c.type && c.category);
  };

  // Get configuration value with type safety and environment awareness
  const getValue = useMemo(() => {
    return function<T>(key: string, defaultValue?: T): T | undefined {
      const startTime = performance.now();

      // Cleanup function to log slow retrievals
      const logPerformance = () => {
        const retrievalTime = performance.now() - startTime;
        if (retrievalTime > 1) { // Log slow retrievals
          logger.debug('configuration', `Configuration retrieval for '${key}' took ${retrievalTime.toFixed(2)}ms`);
        }
      };

      // Check cache first
      const cacheKey = `${key}:${environment}`;
      const cached = valueCache.get(cacheKey);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < cacheValidityMs) {
        logPerformance();
        return cached.value as T;
      }

      const configItem = configurations[key];
      if (!configItem) {
        if (defaultValue !== undefined) {
          logger.info('configuration', `Configuration key '${key}' not found, using default value`);
          logPerformance();
          return defaultValue;
        }
        logger.warn('configuration', `Configuration key '${key}' not found and no default provided`);
        logPerformance();
        return undefined;
      }

      // Check environment-specific override
      let rawValue = configItem.value;
      if (configItem.environmentValues[environment]) {
        rawValue = configItem.environmentValues[environment];
      }

      // Parse value based on type
      const parsedValue = parseConfigurationValue(rawValue, configItem.type);

      // Cache the parsed value
      valueCache.set(cacheKey, { value: parsedValue, timestamp: now });

      logPerformance();
      return parsedValue as T;
    };
  }, [configurations, environment, valueCache]);

  // Set configuration value
  const setValue = async function<T>(key: string, value: T, targetEnvironment?: ConfigurationEnvironment): Promise<void> {
    try {
      const serializedValue = serializeConfigurationValue(value);
      const env = targetEnvironment || environment;

      // Update local state optimistically
      const updatedConfig = configurations[key] ? {
        ...configurations[key],
        [env === environment ? 'value' : 'environmentValues']: {
          ...configurations[key].environmentValues,
          [env]: serializedValue
        },
        lastModified: new Date()
      } : createDefaultConfigItem(key, serializedValue);

      setConfigurations(prev => ({
        ...prev,
        [key]: updatedConfig
      }));

      // Clear cache for this key
      const cacheKey = `${key}:${env}`;
      valueCache.delete(cacheKey);

      // Send to native for persistence and validation
      await communicateWithNative('setValue', {
        key,
        value: serializedValue,
        environment: targetEnvironment
      });

      // Update local storage
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_configurations', JSON.stringify(configurations));
      }

      logger.info('configuration', `Configuration '${key}' updated successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set configuration value');
      throw err;
    }
  }

  // Set multiple configuration values
  const setBulkValues = async (updates: Record<string, unknown>, targetEnvironment?: ConfigurationEnvironment): Promise<void> => {
    try {
      const serializedUpdates: Record<string, string> = {};
      for (const [key, value] of Object.entries(updates)) {
        serializedUpdates[key] = serializeConfigurationValue(value);
      }

      // Send to native for atomic update
      await communicateWithNative('setBulkValues', {
        updates: serializedUpdates,
        environment: targetEnvironment
      });

      // Reload configurations to get the latest state
      await loadConfigurations();

      logger.info('configuration', `Bulk configuration update completed for ${Object.keys(updates).length} keys`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set bulk configuration values');
      throw err;
    }
  };

  // Get configuration item with metadata
  const getConfigurationItem = (key: string): ConfigurationItem | undefined => {
    return configurations[key];
  };

  // Get all configurations
  const getAllConfigurations = (): Record<string, ConfigurationItem> => {
    return configurations;
  };

  // Get configurations by category
  const getConfigurationsByCategory = (category: string): Record<string, ConfigurationItem> => {
    return Object.fromEntries(
      Object.entries(configurations).filter(([_, config]) => config.category === category)
    );
  };

  // Rollback configuration to previous value
  const rollback = async (key: string): Promise<void> => {
    try {
      await communicateWithNative('rollback', { key });
      await loadConfigurations(); // Reload to get updated state
      logger.info('configuration', `Configuration '${key}' rolled back successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback configuration');
      throw err;
    }
  };

  // Hot reload configurations
  const hotReload = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await communicateWithNative('hotReload');
      await loadConfigurations();
      logger.info('configuration', 'Configuration hot reload completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to hot reload configurations');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Export configurations
  const exportConfigurations = (format: 'json' | 'plist' = 'json'): string | null => {
    try {
      const exportData = {
        configurations,
        environment,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      switch (format) {
        case 'json':
          return JSON.stringify(exportData, null, 2);
        case 'plist':
          // Simple plist format (for demo purposes)
          return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>exportDate</key>
  <string>${exportData.exportDate}</string>
  <key>environment</key>
  <string>${exportData.environment}</string>
  <key>configurations</key>
  <dict>
    ${Object.entries(configurations).map(([key, config]) =>
      `<key>${key}</key><string>${config.value}</string>`
    ).join('\n    ')}
  </dict>
</dict>
</plist>`;
        default:
          return null;
      }
    } catch (err) {
      logger.error('configuration', 'Failed to export configurations', {}, err as Error);
      return null;
    }
  };

  // Import configurations
  const importConfigurations = async (data: string, format: 'json' | 'plist' = 'json'): Promise<void> => {
    try {
      let configData;

      switch (format) {
        case 'json':
          configData = JSON.parse(data);
          break;
        case 'plist':
          // Simple plist parsing (for demo purposes)
          throw new Error('Plist import not yet implemented');
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      if (configData.configurations) {
        const processedConfigs = processConfigurations(configData.configurations);
        setConfigurations(processedConfigs);

        // Send to native for persistence
        await communicateWithNative('importConfigurations', {
          data: configData.configurations,
          format
        });

        logger.info('configuration', `Configuration import completed - ${Object.keys(processedConfigs).length} keys imported`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import configurations');
      throw err;
    }
  };

  // Validate configuration value
  const validateConfiguration = (key: string, value: string): ValidationResult => {
    const configItem = configurations[key];
    if (!configItem) {
      return { isValid: false, errors: ['Configuration key not found'], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Type validation
    if (!isValidValueForType(value, configItem.type)) {
      errors.push(`Value is not valid for type ${configItem.type}`);
    }

    // Rule validation
    for (const rule of configItem.validationRules) {
      if (!validateRule(value, rule)) {
        errors.push(rule.message);
      }
    }

    // Additional validations
    if (configItem.isRequired && !value.trim()) {
      errors.push('Required configuration cannot be empty');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedValue: value
    };
  };

  // Parse configuration value based on type
  const parseConfigurationValue = (value: string, type: ConfigurationType): unknown => {
    switch (type) {
      case 'boolean':
        return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
      case 'integer':
        return parseInt(value, 10);
      case 'double':
        return parseFloat(value);
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      case 'array':
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [value];
        } catch {
          return [value];
        }
      default:
        return value;
    }
  };

  // Serialize value for storage
  const serializeConfigurationValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    return JSON.stringify(value);
  };

  // Validate value for type
  const isValidValueForType = (value: string, type: ConfigurationType): boolean => {
    switch (type) {
      case 'boolean':
        return ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(value.toLowerCase());
      case 'integer':
        return !isNaN(parseInt(value, 10));
      case 'double':
        return !isNaN(parseFloat(value));
      case 'json':
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      default:
        return true;
    }
  };

  // Validate against rule
  const validateRule = (value: string, rule: ValidationRule): boolean => {
    switch (rule.type) {
      case 'required':
        return value.trim().length > 0;
      case 'minLength':
        return value.length >= parseInt(rule.parameter || '0', 10);
      case 'maxLength':
        return value.length <= parseInt(rule.parameter || '0', 10);
      case 'pattern':
        try {
          return new RegExp(rule.parameter || '').test(value);
        } catch {
          return false;
        }
      case 'range':
        if (rule.parameter) {
          const [min, max] = rule.parameter.split('-').map(Number);
          const numValue = parseFloat(value);
          return !isNaN(numValue) && numValue >= min && numValue <= max;
        }
        return true;
      default:
        return true;
    }
  };

  // Create default configuration item
  const createDefaultConfigItem = (key: string, value: string): ConfigurationItem => ({
    id: key,
    key,
    value,
    type: 'string',
    category: 'user',
    description: 'User-defined configuration',
    isRequired: false,
    validationRules: [],
    environmentValues: {},
    lastModified: new Date()
  });

  // Get default configurations for demo
  const getDefaultConfigurations = (): Record<string, ConfigurationItem> => {
    const now = new Date();
    return {
      api_timeout: {
        id: 'api_timeout',
        key: 'api_timeout',
        value: '30.0',
        type: 'double',
        category: 'network',
        description: 'API request timeout in seconds',
        isRequired: true,
        validationRules: [
          { type: 'range', parameter: '1-300', message: 'Timeout must be between 1 and 300 seconds' }
        ],
        environmentValues: {},
        lastModified: now
      },
      debug_logging: {
        id: 'debug_logging',
        key: 'debug_logging',
        value: environment === 'development' ? 'true' : 'false',
        type: 'boolean',
        category: 'debugging',
        description: 'Enable debug logging',
        isRequired: false,
        validationRules: [],
        environmentValues: {},
        lastModified: now
      },
      cache_size_limit: {
        id: 'cache_size_limit',
        key: 'cache_size_limit',
        value: '100',
        type: 'integer',
        category: 'performance',
        description: 'Maximum cache size in MB',
        isRequired: true,
        validationRules: [
          { type: 'range', parameter: '10-1000', message: 'Cache size must be between 10 and 1000 MB' }
        ],
        environmentValues: {},
        lastModified: now
      }
    };
  };

  // Initialize environment and configurations
  useEffect(() => {
    const detectedEnvironment = detectEnvironment();
    setEnvironment(detectedEnvironment);
    loadConfigurations();
  }, [propEnvironment]);

  // Set up hot reload timer
  useEffect(() => {
    if (!enableHotReload || hotReloadInterval <= 0) return;

    const interval = setInterval(() => {
      hotReload().catch(err => logger.error('configuration', 'Hot reload failed', {}, err as Error));
    }, hotReloadInterval);

    // Ensure cleanup on component unmount or dependency change
    return () => {
      clearInterval(interval);
    };
  }, [enableHotReload, hotReloadInterval]);

  // Set up native bridge listeners
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleNativeMessage = (event: MessageEvent) => {
        if (event.data?.type === 'configurationUpdate') {
          const updatedConfigs = processConfigurations(event.data.configurations);
          setConfigurations(updatedConfigs);

          // Clear value cache when configurations update
          valueCache.clear();
        }
      };

      window.addEventListener('message', handleNativeMessage);
      return () => window.removeEventListener('message', handleNativeMessage);
    }
  }, []);

  const contextValue: ConfigurationContextValue = {
    configurations,
    environment,
    isLoading,
    error,
    getValue,
    setValue,
    setBulkValues,
    getConfigurationItem,
    getAllConfigurations,
    getConfigurationsByCategory,
    rollback,
    hotReload,
    exportConfigurations,
    importConfigurations,
    validateConfiguration
  };

  return (
    <ConfigurationContext.Provider value={contextValue}>
      {children}
    </ConfigurationContext.Provider>
  );
};

// Hook for using configuration system
export const useConfiguration = (): ConfigurationContextValue => {
  const context = useContext(ConfigurationContext);
  if (!context) {
    throw new Error('useConfiguration must be used within a ConfigurationProvider');
  }
  return context;
};

// Hook for getting a specific configuration value
export const useConfigValue = <T = unknown>(key: string, defaultValue?: T): T | undefined => {
  const { getValue } = useConfiguration();
  return getValue(key, defaultValue);
};

// Hook for setting configuration values
export const useConfigSetter = () => {
  const { setValue, setBulkValues } = useConfiguration();
  return { setValue, setBulkValues };
};

// Hook for configuration validation
export const useConfigValidation = () => {
  const { validateConfiguration } = useConfiguration();
  return validateConfiguration;
};

// Conditional rendering based on configuration
interface ConfigurationWrapperProps {
  configKey: string;
  expectedValue?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export const ConfigurationWrapper: React.FC<ConfigurationWrapperProps> = ({
  configKey,
  expectedValue = 'true',
  children,
  fallback = null
}) => {
  const value = useConfigValue<string>(configKey);

  if (value === expectedValue) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

// Higher-order component for configuration-based features
export function withConfiguration<P extends object>(
  configKey: string,
  expectedValue: string = 'true'
) {
  return function ConfigurationHOC(WrappedComponent: React.ComponentType<P>) {
    return function ConfiguredComponent(props: P) {
      const value = useConfigValue<string>(configKey);

      if (value === expectedValue) {
        return <WrappedComponent {...props} />;
      }

      return null;
    };
  };
}

// Declare global types for native bridge
// Window interface extension moved to browser-bridge.d.ts to avoid conflicts

export default ConfigurationProvider;