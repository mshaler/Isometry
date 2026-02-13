/**
 * PAFVAxisService - Stub implementation
 *
 * Handles PAFV axis management for SuperDynamic integration.
 * This is a stub for future implementation.
 */

import type { ViewAxisMapping } from '@/types/views';

export interface PAFVAxisServiceConfig {
  enableMetrics?: boolean;
  persistenceDelay?: number;
}

export interface AvailableAxis {
  id: string;
  facet: string;
  label: string;
  description: string;
  latchDimension: string;
}

type ChangeListener = (mapping: ViewAxisMapping) => void;

export interface PAFVAxisService {
  getAvailableAxes: () => AvailableAxis[];
  assignAxis: (slot: 'x' | 'y' | 'z', facet: string) => Promise<void>;
  clearAxis: (slot: 'x' | 'y' | 'z') => Promise<void>;
  swapAxes: (slot1: 'x' | 'y' | 'z', slot2: 'x' | 'y' | 'z') => Promise<void>;
  addChangeListener: (listener: ChangeListener) => void;
  removeChangeListener: (listener: ChangeListener) => void;
  destroy: () => void;
}

/**
 * Creates a PAFV axis service instance
 * Stub implementation - returns no-op functions
 */
export function createPAFVAxisService(
  _database: { exec: (sql: string, params?: unknown[]) => unknown[] },
  _canvasId: string,
  _config?: PAFVAxisServiceConfig
): PAFVAxisService {
  const listeners: ChangeListener[] = [];

  return {
    getAvailableAxes: () => [],
    assignAxis: async () => {},
    clearAxis: async () => {},
    swapAxes: async () => {},
    addChangeListener: (listener) => {
      listeners.push(listener);
    },
    removeChangeListener: (listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
    destroy: () => {
      listeners.length = 0;
    }
  };
}
