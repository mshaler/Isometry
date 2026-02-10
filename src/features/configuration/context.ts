/**
 * Configuration Context
 *
 * React context for configuration management
 */

import { createContext } from 'react';
import type { ConfigurationContextValue } from './types';

// Configuration context
export const ConfigurationContext = createContext<ConfigurationContextValue | undefined>(undefined);
