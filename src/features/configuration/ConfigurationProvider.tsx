/**
 * Configuration Provider Component
 *
 * Main provider component for configuration management
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { logger } from '../../utils/logging/logger';
import { ConfigurationContext } from './context';
import { validateConfigurationValue, validateAllConfigurations } from './validation';
import { getAPIBaseURL } from '../../config/endpoints';
import type {
  ConfigurationItem,
  ConfigurationEnvironment,
  ConfigurationChange,
  ValidationResult,
  ConfigurationProviderProps
} from './types';

export const ConfigurationProvider: React.FC<ConfigurationProviderProps> = ({
  children,
  initialEnvironment = 'development',
  enableCloudSync: _enableCloudSync = false,
  cloudSyncConfig: _cloudSyncConfig,
  enableHotReload = false,
  validationMode = 'strict'
}) => {
  // State
  const [configurations, setConfigurations] = useState<ConfigurationItem[]>([]);
  const [currentEnvironment, setCurrentEnvironment] = useState<ConfigurationEnvironment>(initialEnvironment);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const [changes, setChanges] = useState<ConfigurationChange[]>([]);
  const [subscribers] = useState<Map<string, Set<(value: string) => void>>>(new Map());
  const [changeSubscribers, setChangeSubscribers] = useState<Set<(change: ConfigurationChange) => void>>(new Set());
  const [hotReloadEnabled, setHotReloadEnabled] = useState(enableHotReload);

  // Load initial configurations
  useEffect(() => {
    loadConfigurations();
  }, []);

  // Core operations
  const setValue = useCallback(async (key: string, value: string, environment?: string) => {
    const env = environment || currentEnvironment;
    const config = configurations.find(c => c.key === key);
    
    if (!config) {
      logger.error('configuration', `Configuration key not found: ${key}`);
      return;
    }

    // Validate if in strict mode
    if (validationMode === 'strict') {
      const validation = validateConfigurationValue(value, config.type, config.validationRules);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Update configuration
    const oldValue = config.environmentValues[env] || config.value;
    const updatedConfigurations = configurations.map(c => {
      if (c.key === key) {
        return {
          ...c,
          environmentValues: {
            ...c.environmentValues,
            [env]: value
          },
          lastModified: new Date()
        };
      }
      return c;
    });

    setConfigurations(updatedConfigurations);

    // Track change
    const change: ConfigurationChange = {
      id: `${Date.now()}-${Math.random()}`,
      key,
      oldValue,
      newValue: value,
      environment: env,
      timestamp: new Date(),
      source: 'user'
    };
    setChanges(prev => [change, ...prev.slice(0, 99)]); // Keep last 100 changes

    // Notify subscribers
    const keySubscribers = subscribers.get(key);
    if (keySubscribers) {
      keySubscribers.forEach(callback => callback(value));
    }
    changeSubscribers.forEach(callback => callback(change));

    logger.info('configuration', `Configuration updated: ${key} = ${value} (${env})`);
  }, [configurations, currentEnvironment, validationMode, subscribers, changeSubscribers]);

  const getValue = useCallback(<T = unknown>(key: string, environment?: string): T | undefined => {
    const env = environment || currentEnvironment;
    const config = configurations.find(c => c.key === key);
    
    if (!config) {
      return undefined;
    }

    const value = config.environmentValues[env] || config.value;
    
    try {
      // Type conversion based on configuration type
      switch (config.type) {
        case 'boolean':
          return (value.toLowerCase() === 'true' || value === '1') as unknown as T;
        case 'integer':
          return parseInt(value, 10) as unknown as T;
        case 'double':
          return parseFloat(value) as unknown as T;
        case 'json':
        case 'array':
          return JSON.parse(value) as T;
        default:
          return value as unknown as T;
      }
    } catch (error) {
      logger.error('configuration', `Error parsing configuration value for ${key}`, { error: error as Record<string, unknown> });
      return value as unknown as T;
    }
  }, [configurations, currentEnvironment]);

  const deleteConfiguration = useCallback(async (key: string) => {
    setConfigurations(prev => prev.filter(c => c.key !== key));
    
    const change: ConfigurationChange = {
      id: `${Date.now()}-${Math.random()}`,
      key,
      timestamp: new Date(),
      source: 'user'
    };
    setChanges(prev => [change, ...prev.slice(0, 99)]);
    
    logger.info('configuration', `Configuration deleted: ${key}`);
  }, []);

  // Validation functions
  const validate = useCallback((key: string, value: string): ValidationResult => {
    const config = configurations.find(c => c.key === key);
    if (!config) {
      return {
        isValid: false,
        errors: ['Configuration not found'],
        warnings: []
      };
    }
    return validateConfigurationValue(value, config.type, config.validationRules);
  }, [configurations]);

  const validateAll = useCallback((): Record<string, ValidationResult> => {
    return validateAllConfigurations(configurations);
  }, [configurations]);

  // Bulk operations
  const setMultiple = useCallback(async (changes: Record<string, string>, environment?: string) => {
    const env = environment || currentEnvironment;
    
    for (const [key, value] of Object.entries(changes)) {
      await setValue(key, value, env);
    }
  }, [setValue, currentEnvironment]);

  const exportConfiguration = useCallback((environment?: string): Record<string, string> => {
    const env = environment || currentEnvironment;
    const result: Record<string, string> = {};
    
    for (const config of configurations) {
      result[config.key] = config.environmentValues[env] || config.value;
    }
    
    return result;
  }, [configurations, currentEnvironment]);

  const importConfiguration = useCallback(async (config: Record<string, string>, environment?: string) => {
    await setMultiple(config, environment);
  }, [setMultiple]);

  // Environment management
  const switchEnvironment = useCallback((environment: ConfigurationEnvironment) => {
    setCurrentEnvironment(environment);
    logger.info('configuration', `Switched to environment: ${environment}`);
  }, []);

  const getEnvironments = useCallback((): ConfigurationEnvironment[] => {
    return ['development', 'staging', 'production'];
  }, []);

  // Change tracking
  const getChanges = useCallback((limit?: number): ConfigurationChange[] => {
    return changes.slice(0, limit);
  }, [changes]);

  const rollback = useCallback(async (changeId: string) => {
    const change = changes.find(c => c.id === changeId);
    if (!change || !change.oldValue) {
      throw new Error('Cannot rollback this change');
    }
    
    await setValue(change.key, change.oldValue, change.environment);
    logger.info('configuration', `Rolled back change: ${change.key}`);
  }, [changes, setValue]);

  // Subscription
  const subscribe = useCallback((key: string, callback: (value: string) => void) => {
    const keySubscribers = subscribers.get(key) || new Set();
    keySubscribers.add(callback);
    subscribers.set(key, keySubscribers);
    
    return () => {
      keySubscribers.delete(callback);
      if (keySubscribers.size === 0) {
        subscribers.delete(key);
      }
    };
  }, [subscribers]);

  const subscribeToChanges = useCallback((callback: (change: ConfigurationChange) => void) => {
    setChangeSubscribers(prev => new Set(prev).add(callback));
    
    return () => {
      setChangeSubscribers(prev => {
        const newSet = new Set(prev);
        newSet.delete(callback);
        return newSet;
      });
    };
  }, []);

  // Hot reload
  const enableHotReloadFunc = useCallback((enabled: boolean) => {
    setHotReloadEnabled(enabled);
    logger.info('configuration', `Hot reload ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  const isHotReloadEnabled = useCallback(() => hotReloadEnabled, [hotReloadEnabled]);

  // Helper functions
  const loadConfigurations = async () => {
    setIsLoading(true);
    try {
      // Load configurations from storage/API
      // This would be implemented based on your storage mechanism
      const defaultConfigs: ConfigurationItem[] = [
        {
          id: '1',
          key: 'api.endpoint',
          value: getAPIBaseURL(),
          type: 'url',
          category: 'api',
          description: 'API endpoint URL',
          isRequired: true,
          validationRules: [
            { type: 'required', message: 'API endpoint is required' },
            { type: 'url', message: 'Must be a valid URL' }
          ],
          environmentValues: {},
          lastModified: new Date()
        }
        // Add more default configurations as needed
      ];
      
      setConfigurations(defaultConfigs);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Context value
  const contextValue = useMemo(() => ({
    configurations,
    currentEnvironment,
    isLoading,
    error,
    setValue,
    getValue,
    deleteConfiguration,
    validate,
    validateAll,
    setMultiple,
    exportConfiguration,
    importConfiguration,
    switchEnvironment,
    getEnvironments,
    getChanges,
    rollback,
    subscribe,
    subscribeToChanges,
    enableHotReload: enableHotReloadFunc,
    isHotReloadEnabled
  }), [
    configurations,
    currentEnvironment,
    isLoading,
    error,
    setValue,
    getValue,
    deleteConfiguration,
    validate,
    validateAll,
    setMultiple,
    exportConfiguration,
    importConfiguration,
    switchEnvironment,
    getEnvironments,
    getChanges,
    rollback,
    subscribe,
    subscribeToChanges,
    enableHotReloadFunc,
    isHotReloadEnabled
  ]);

  return (
    <ConfigurationContext.Provider value={contextValue}>
      {children}
    </ConfigurationContext.Provider>
  );
};
