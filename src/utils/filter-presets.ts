/**
 * Filter Preset Storage Utilities
 *
 * Manages saving/loading filter presets to/from encrypted localStorage.
 * Handles JSON serialization with Date objects and provides secure storage.
 */

import type { FilterPreset, FilterState } from '../types/filter';
import {
  setEncryptedItem,
  getEncryptedItem,
  migrateToEncryptedStorage,
  isEncryptedStorageSupported
} from './security/encrypted-storage';
import { logger } from './logging/logger';

const STORAGE_KEY = 'isometry:filter-presets';

interface SerializedFilterPreset {
  id: string;
  name: string;
  filters: unknown;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

/**
 * Serialize preset for storage (converts Dates to ISO strings)
 */
function serializePreset(preset: FilterPreset): Record<string, unknown> {
  return {
    ...preset,
    createdAt: preset.createdAt.toISOString(),
    updatedAt: preset.updatedAt.toISOString(),
  };
}

/**
 * Deserialize preset from storage (converts ISO strings to Dates)
 */
function deserializePreset(data: SerializedFilterPreset): FilterPreset {
  return {
    ...data,
    filters: data.filters as FilterState,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  } as FilterPreset;
}

/**
 * Load all presets from encrypted localStorage
 */
export async function loadPresets(): Promise<FilterPreset[]> {
  try {
    // Check if encryption is supported
    if (!isEncryptedStorageSupported()) {
      logger.warn('storage', 'Encrypted storage not supported, falling back to plain storage');
      return loadPresetsPlain();
    }

    // Try to migrate existing plain storage first
    const migrationResult = await migrateToEncryptedStorage(STORAGE_KEY);
    if (!migrationResult.success) {
      logger.warn('storage', 'Migration failed, using plain storage', { error: migrationResult.error });
      return loadPresetsPlain();
    }

    // Load from encrypted storage
    const result = await getEncryptedItem<SerializedFilterPreset[]>(STORAGE_KEY);

    if (!result.success) {
      logger.error('storage', 'Failed to load encrypted presets', { error: result.error });
      return loadPresetsPlain(); // Fallback
    }

    if (!result.data) {
      return [];
    }

    if (!Array.isArray(result.data)) {
      logger.warn('storage', 'Invalid preset data in encrypted storage, resetting');
      return [];
    }

    return result.data.map(deserializePreset);
  } catch (error) {
    logger.error('storage', 'Failed to load presets from encrypted storage', {}, error as Error);
    return loadPresetsPlain(); // Fallback
  }
}

/**
 * Fallback function for loading presets from plain localStorage
 */
function loadPresetsPlain(): FilterPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      logger.warn('storage', 'Invalid preset data in localStorage, resetting');
      return [];
    }

    return parsed.map(deserializePreset);
  } catch (error) {
    logger.error('storage', 'Failed to load presets from localStorage', {}, error as Error);
    return [];
  }
}

/**
 * Save preset to encrypted localStorage
 */
export async function savePreset(preset: FilterPreset): Promise<void> {
  try {
    const presets = await loadPresets();
    const existingIndex = presets.findIndex((p) => p.id === preset.id);

    if (existingIndex >= 0) {
      // Update existing preset
      presets[existingIndex] = preset;
    } else {
      // Add new preset
      presets.push(preset);
    }

    const serialized = presets.map(serializePreset);

    // Try encrypted storage first
    if (isEncryptedStorageSupported()) {
      const result = await setEncryptedItem(STORAGE_KEY, serialized);

      if (!result.success) {
        logger.warn('storage', 'Failed to save to encrypted storage', { error: result.error });
        // Fallback to plain storage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      }
    } else {
      // Use plain storage as fallback
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    }
  } catch (error) {
    logger.error('storage', 'Failed to save preset', {}, error as Error);
    throw new Error('Failed to save preset');
  }
}

/**
 * Delete preset from encrypted localStorage
 */
export async function deletePreset(id: string): Promise<void> {
  try {
    const presets = await loadPresets();
    const filtered = presets.filter((p) => p.id !== id);

    const serialized = filtered.map(serializePreset);

    // Try encrypted storage first
    if (isEncryptedStorageSupported()) {
      const result = await setEncryptedItem(STORAGE_KEY, serialized);

      if (!result.success) {
        logger.warn('storage', 'Failed to delete from encrypted storage', { error: result.error });
        // Fallback to plain storage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      }
    } else {
      // Use plain storage as fallback
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    }
  } catch (error) {
    logger.error('storage', 'Failed to delete preset', {}, error as Error);
    throw new Error('Failed to delete preset');
  }
}

/**
 * Update preset in encrypted localStorage
 */
export async function updatePreset(
  id: string,
  updates: Partial<FilterPreset>
): Promise<void> {
  try {
    const presets = await loadPresets();
    const existingIndex = presets.findIndex((p) => p.id === id);

    if (existingIndex < 0) {
      throw new Error(`Preset with id ${id} not found`);
    }

    const updated = {
      ...presets[existingIndex],
      ...updates,
      updatedAt: new Date(),
    };

    presets[existingIndex] = updated;

    const serialized = presets.map(serializePreset);

    // Try encrypted storage first
    if (isEncryptedStorageSupported()) {
      const result = await setEncryptedItem(STORAGE_KEY, serialized);

      if (!result.success) {
        console.warn('Failed to update in encrypted storage:', result.error);
        // Fallback to plain storage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      }
    } else {
      // Use plain storage as fallback
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    }
  } catch (error) {
    console.error('Failed to update preset:', error);
    throw new Error('Failed to update preset');
  }
}

/**
 * Check if preset name already exists
 */
export async function presetNameExists(name: string, excludeId?: string): Promise<boolean> {
  const presets = await loadPresets();
  return presets.some((p) => p.name === name && p.id !== excludeId);
}

/**
 * Generate unique preset ID
 */
export function generatePresetId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
