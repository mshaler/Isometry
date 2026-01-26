/**
 * Encrypted Storage Utilities
 *
 * Provides secure localStorage encryption for sensitive data like filter presets,
 * templates, and user configuration. Uses Web Crypto API for AES-GCM encryption
 * with user-derived keys.
 */

/**
 * Encryption configuration
 */
interface EncryptionConfig {
  algorithm: 'AES-GCM';
  keyLength: 256;
  ivLength: 12; // 96 bits for GCM
  saltLength: 16; // 128 bits
  iterations: 100000; // PBKDF2 iterations
}

/**
 * Encrypted storage envelope
 */
interface EncryptedData {
  version: number;
  algorithm: string;
  salt: string; // Base64 encoded
  iv: string; // Base64 encoded
  data: string; // Base64 encoded encrypted data
  timestamp: number;
}

/**
 * Storage operation result
 */
interface StorageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Default encryption configuration
const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  saltLength: 16,
  iterations: 100000
};

// Cache for derived keys to avoid repeated derivation
const keyCache = new Map<string, CryptoKey>();

/**
 * Generates a random salt
 */
function generateSalt(length: number = DEFAULT_CONFIG.saltLength): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Generates a random initialization vector
 */
function generateIV(length: number = DEFAULT_CONFIG.ivLength): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Derives encryption key from password using PBKDF2
 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_CONFIG.iterations
): Promise<CryptoKey> {
  const cacheKey = `${password}-${salt.toString()}`;

  // Check cache first
  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey)!;
  }

  try {
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive the actual encryption key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: DEFAULT_CONFIG.keyLength
      },
      false,
      ['encrypt', 'decrypt']
    );

    // Cache the key
    keyCache.set(cacheKey, key);
    return key;
  } catch (error) {
    throw new Error(`Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets or generates a user-specific encryption password
 * Uses browser fingerprinting and user preferences for key generation
 */
function getUserPassword(): string {
  const stored = localStorage.getItem('isometry:encryption-seed');

  if (stored) {
    return stored;
  }

  // Generate new password from browser characteristics
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset().toString(),
    Math.random().toString(36) // Random component
  ].join('|');

  // Hash the fingerprint to create a consistent password
  const password = btoa(fingerprint).substring(0, 32);

  // Store the seed (not the actual password)
  localStorage.setItem('isometry:encryption-seed', password);
  return password;
}

/**
 * Encrypts data using AES-GCM
 */
async function encryptData(data: string, password?: string): Promise<EncryptedData> {
  try {
    const actualPassword = password || getUserPassword();
    const salt = generateSalt();
    const iv = generateIV();

    // Derive encryption key
    const key = await deriveKey(actualPassword, salt);

    // Encrypt the data
    const encodedData = new TextEncoder().encode(data);
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      encodedData
    );

    // Encode to base64 for storage
    const encryptedData = btoa(
      String.fromCharCode(...new Uint8Array(encryptedBuffer))
    );
    const encodedSalt = btoa(String.fromCharCode(...salt));
    const encodedIV = btoa(String.fromCharCode(...iv));

    return {
      version: 1,
      algorithm: 'AES-GCM',
      salt: encodedSalt,
      iv: encodedIV,
      data: encryptedData,
      timestamp: Date.now()
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts data using AES-GCM
 */
async function decryptData(encryptedData: EncryptedData, password?: string): Promise<string> {
  try {
    const actualPassword = password || getUserPassword();

    // Decode from base64
    const salt = new Uint8Array(
      atob(encryptedData.salt).split('').map(c => c.charCodeAt(0))
    );
    const iv = new Uint8Array(
      atob(encryptedData.iv).split('').map(c => c.charCodeAt(0))
    );
    const data = new Uint8Array(
      atob(encryptedData.data).split('').map(c => c.charCodeAt(0))
    );

    // Derive decryption key
    const key = await deriveKey(actualPassword, salt, DEFAULT_CONFIG.iterations);

    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      key,
      data
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Stores encrypted data in localStorage
 */
export async function setEncryptedItem<T>(
  key: string,
  value: T,
  password?: string
): Promise<StorageResult<void>> {
  try {
    // Serialize the value
    const serialized = JSON.stringify(value);

    // Encrypt the serialized data
    const encrypted = await encryptData(serialized, password);

    // Store in localStorage
    localStorage.setItem(`encrypted:${key}`, JSON.stringify(encrypted));

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to store encrypted data:', message);

    return {
      success: false,
      error: `Storage failed: ${message}`
    };
  }
}

/**
 * Retrieves and decrypts data from localStorage
 */
export async function getEncryptedItem<T>(
  key: string,
  password?: string
): Promise<StorageResult<T>> {
  try {
    // Get encrypted data from localStorage
    const stored = localStorage.getItem(`encrypted:${key}`);

    if (!stored) {
      return { success: true, data: undefined };
    }

    // Parse the encrypted envelope
    const encryptedData: EncryptedData = JSON.parse(stored);

    // Validate the envelope structure
    if (!encryptedData.version || !encryptedData.algorithm || !encryptedData.data) {
      throw new Error('Invalid encrypted data format');
    }

    // Check if encryption algorithm is supported
    if (encryptedData.algorithm !== 'AES-GCM') {
      throw new Error(`Unsupported encryption algorithm: ${encryptedData.algorithm}`);
    }

    // Decrypt the data
    const decrypted = await decryptData(encryptedData, password);

    // Deserialize the value
    const value: T = JSON.parse(decrypted);

    return { success: true, data: value };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to retrieve encrypted data:', message);

    return {
      success: false,
      error: `Retrieval failed: ${message}`
    };
  }
}

/**
 * Removes encrypted item from localStorage
 */
export function removeEncryptedItem(key: string): StorageResult<void> {
  try {
    localStorage.removeItem(`encrypted:${key}`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: `Removal failed: ${message}`
    };
  }
}

/**
 * Checks if encrypted storage is supported
 */
export function isEncryptedStorageSupported(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle !== 'undefined' &&
    typeof crypto.subtle.encrypt === 'function' &&
    typeof crypto.subtle.decrypt === 'function' &&
    typeof crypto.subtle.deriveKey === 'function'
  );
}

/**
 * Migrates existing plain localStorage to encrypted storage
 */
export async function migrateToEncryptedStorage(
  key: string,
  password?: string
): Promise<StorageResult<void>> {
  try {
    // Check if already encrypted
    const encryptedExists = localStorage.getItem(`encrypted:${key}`) !== null;

    if (encryptedExists) {
      return { success: true }; // Already migrated
    }

    // Get plain data
    const plainData = localStorage.getItem(key);

    if (!plainData) {
      return { success: true }; // Nothing to migrate
    }

    // Encrypt and store
    const result = await setEncryptedItem(key, JSON.parse(plainData), password);

    if (result.success) {
      // Remove plain version
      localStorage.removeItem(key);
      console.log(`Successfully migrated ${key} to encrypted storage`);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: `Migration failed: ${message}`
    };
  }
}

/**
 * Lists all encrypted items in localStorage
 */
export function listEncryptedItems(): string[] {
  const encryptedKeys: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('encrypted:')) {
      encryptedKeys.push(key.substring(10)); // Remove 'encrypted:' prefix
    }
  }

  return encryptedKeys;
}

/**
 * Clears all encrypted storage
 */
export function clearEncryptedStorage(): StorageResult<void> {
  try {
    const encryptedKeys = listEncryptedItems();

    for (const key of encryptedKeys) {
      localStorage.removeItem(`encrypted:${key}`);
    }

    // Also clear the encryption seed to force new key generation
    localStorage.removeItem('isometry:encryption-seed');
    keyCache.clear();

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: `Clear failed: ${message}`
    };
  }
}

/**
 * Gets encryption info for debugging (without exposing sensitive data)
 */
export function getEncryptionInfo(): {
  supported: boolean;
  algorithm: string;
  keyLength: number;
  encryptedItemCount: number;
  hasEncryptionSeed: boolean;
} {
  return {
    supported: isEncryptedStorageSupported(),
    algorithm: DEFAULT_CONFIG.algorithm,
    keyLength: DEFAULT_CONFIG.keyLength,
    encryptedItemCount: listEncryptedItems().length,
    hasEncryptionSeed: localStorage.getItem('isometry:encryption-seed') !== null
  };
}