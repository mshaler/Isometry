/**
 * Configuration Hooks
 *
 * React hooks for configuration management
 */

import { useContext } from 'react';
import { ConfigurationContext } from './context';
import type { ConfigurationContextValue } from './types';

/**
 * Main configuration hook
 */
export const useConfiguration = (): ConfigurationContextValue => {
  const context = useContext(ConfigurationContext);
  if (!context) {
    throw new Error('useConfiguration must be used within a ConfigurationProvider');
  }
  return context;
};

/**
 * Hook to get a specific configuration value
 */
export const useConfigValue = <T = unknown>(key: string, defaultValue?: T): T | undefined => {
  const { getValue } = useConfiguration();
  return getValue<T>(key) ?? defaultValue;
};

/**
 * Hook to get configuration setter functions
 */
export const useConfigSetter = () => {
  const { setValue, setMultiple, deleteConfiguration } = useConfiguration();
  return { setValue, setMultiple, deleteConfiguration };
};

/**
 * Hook to get validation functions
 */
export const useConfigValidation = () => {
  const { validate, validateAll } = useConfiguration();
  return { validate, validateAll };
};

/**
 * Hook to get environment management functions
 */
export const useConfigEnvironment = () => {
  const { 
    currentEnvironment, 
    switchEnvironment, 
    getEnvironments,
    exportConfiguration,
    importConfiguration
  } = useConfiguration();
  
  return {
    currentEnvironment,
    switchEnvironment,
    getEnvironments,
    exportConfiguration,
    importConfiguration
  };
};

/**
 * Hook to get change tracking functions
 */
export const useConfigChanges = () => {
  const {
    getChanges,
    rollback,
    subscribe,
    subscribeToChanges
  } = useConfiguration();
  
  return {
    getChanges,
    rollback,
    subscribe,
    subscribeToChanges
  };
};

/**
 * Hook to get hot reload functions
 */
export const useConfigHotReload = () => {
  const {
    enableHotReload,
    isHotReloadEnabled
  } = useConfiguration();
  
  return {
    enableHotReload,
    isHotReloadEnabled
  };
};
