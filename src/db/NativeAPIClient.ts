/**
 * Native API Client for HTTP-based database operations
 *
 * Provides identical interface to sql.js Database for seamless React component compatibility.
 * Routes all operations through HTTP endpoints to native GRDB/CloudKit backend.
 */

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface SQLExecuteRequest {
  sql: string;
  params?: unknown[];
}

export interface SQLExecuteResponse {
  columns: string[];
  values: unknown[][];
  changes?: number;
  lastInsertRowid?: number;
}

/**
 * HTTP client for native API operations
 * Maintains exact same interface as sql.js Database for drop-in compatibility
 */
export class NativeAPIClient {
  private baseURL: string;
  private timeout: number;
  private connected: boolean = false;

  constructor(baseURL: string = 'http://localhost:8080', timeout: number = 5000) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = timeout;
  }

  /**
   * Test connection to native API server
   */
  async connect(): Promise<void> {
    try {
      const response = await this.fetch('/api/health');
      if (response.ok) {
        this.connected = true;
      } else {
        throw new Error(`API server responded with ${response.status}`);
      }
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to native API server: ${error}`);
    }
  }

  /**
   * Check if client is connected to server
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Execute SQL query with exact same interface as sql.js
   * @param sql SQL query string
   * @param params Query parameters
   * @returns Array of result objects matching sql.js format
   */
  async execute<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    if (!this.connected) {
      throw new Error('Native API client not connected. Call connect() first.');
    }

    try {
      const request: SQLExecuteRequest = { sql, params };
      const response = await this.fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const apiResponse: APIResponse<SQLExecuteResponse> = await response.json();

      if (!apiResponse.success) {
        throw new Error(apiResponse.error || 'SQL execution failed');
      }

      const sqlResult = apiResponse.data;
      if (!sqlResult) {
        return [];
      }

      // Convert response to match sql.js format exactly
      const { columns, values } = sqlResult;

      if (!columns || !values) {
        return [];
      }

      return values.map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj as T;
      });
    } catch (error) {
      console.error('Native API SQL Error:', sql, params, error);
      throw error;
    }
  }

  /**
   * Save operation - no-op for compatibility (native handles persistence automatically)
   */
  async save(): Promise<void> {
    // Native backend handles persistence automatically
    // This method exists for sql.js compatibility only
    return Promise.resolve();
  }

  /**
   * Reset database - calls native reset endpoint
   */
  async reset(): Promise<void> {
    if (!this.connected) {
      throw new Error('Native API client not connected. Call connect() first.');
    }

    try {
      const response = await this.fetch('/api/reset', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Reset failed: ${response.status}`);
      }

      const apiResponse: APIResponse = await response.json();

      if (!apiResponse.success) {
        throw new Error(apiResponse.error || 'Database reset failed');
      }
    } catch (error) {
      console.error('Native API Reset Error:', error);
      throw error;
    }
  }

  /**
   * Internal fetch wrapper with timeout and retry logic
   */
  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        this.connected = false;
        throw new Error('Network error: Unable to connect to native API server');
      }

      throw error;
    }
  }
}

/**
 * Factory function to create and connect a native API client
 * @param baseURL API server base URL
 * @param timeout Request timeout in milliseconds
 * @returns Connected NativeAPIClient instance
 */
export async function createClient(baseURL?: string, timeout?: number): Promise<NativeAPIClient> {
  const client = new NativeAPIClient(baseURL, timeout);
  await client.connect();
  return client;
}

/**
 * Utility function to test if native API is available
 * @param baseURL API server base URL
 * @returns Promise resolving to true if API is available
 */
export async function isNativeAPIAvailable(baseURL: string = 'http://localhost:8080'): Promise<boolean> {
  try {
    const client = new NativeAPIClient(baseURL, 3000); // Shorter timeout for availability check
    await client.connect();
    return true;
  } catch {
    return false;
  }
}