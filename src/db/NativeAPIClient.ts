// Removed sql.js dependency - now uses native types
interface QueryExecResult {
  columns: string[]
  values: any[][]
}

interface Statement {
  run: (params?: any[]) => { changes: number }
  get: (params?: any[]) => any
  all: (params?: any[]) => any[]
}

interface Database {
  exec: (sql: string) => QueryExecResult[]
  prepare: (sql: string) => Statement
  save?: () => Promise<void>
  close?: () => void
}

/**
 * Native API client for HTTP calls to IsometryAPIServer
 * Provides standard database interface for React components
 */
export class NativeAPIClient {
  private baseUrl: string
  private isAvailable: boolean = false

  constructor(baseUrl: string = 'http://127.0.0.1:8080') {
    this.baseUrl = baseUrl
  }

  /**
   * Test if native API server is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      })
      this.isAvailable = response.ok
      return this.isAvailable
    } catch (error) {
      console.log('Native API not available')
      this.isAvailable = false
      return false
    }
  }

  /**
   * Execute SQL query - returns standard query results
   */
  async executeSQL(sql: string, params: any[] = []): Promise<QueryExecResult[]> {
    if (!this.isAvailable) {
      throw new Error('Native API not available')
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sql,
          params: params.map(this.convertParameter)
        })
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }

      const result = await response.json()

      // Convert to QueryExecResult format
      return [{
        columns: result.columns || [],
        values: result.rows || []
      }]
    } catch (error) {
      console.error('Native API SQL execution failed:', error)
      throw error
    }
  }

  /**
   * Create compatible Database interface
   */
  createCompatibleDatabase(): Database {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const apiClient = this

    return {
      exec: async (sql: string, params?: any) => {
        return apiClient.executeSQL(sql, params)
      },

      prepare: (sql: string) => {
        return {
          step: async () => {
            const results = await apiClient.executeSQL(sql)
            return results.length > 0 && results[0].values.length > 0
          },

          get: async (params?: any) => {
            const results = await apiClient.executeSQL(sql, params)
            if (results.length === 0 || results[0].values.length === 0) {
              return undefined
            }

            // Convert first row to object using column names
            const columns = results[0].columns
            const firstRow = results[0].values[0]
            const rowObject: any = {}

            columns.forEach((column, index) => {
              rowObject[column] = firstRow[index]
            })

            return rowObject
          },

          getAsObject: async (params?: any) => {
            const results = await apiClient.executeSQL(sql, params)
            return results[0]?.values.map(row => {
              const obj: any = {}
              results[0].columns.forEach((col, i) => {
                obj[col] = row[i]
              })
              return obj
            }) || []
          },

          reset: () => {},
          free: () => {}
        } as Statement
      },

      run: async (sql: string, params?: any) => {
        await apiClient.executeSQL(sql, params)
      },

      close: () => {},
      export: () => new Uint8Array(),
      getRowsModified: () => 0,
      create_function: () => {},
      create_aggregate: () => {},

      // Iterator methods for compatibility
      iterateStatements: function* () {},
      each: async () => {}
    } as Database
  }

  /**
   * High-level API methods for better performance
   */
  async getNodes(folder?: string, nodeType?: string): Promise<any[]> {
    if (!this.isAvailable) {
      throw new Error('Native API not available')
    }

    const params = new URLSearchParams()
    if (folder) params.append('folder', folder)
    if (nodeType) params.append('type', nodeType)

    const response = await fetch(`${this.baseUrl}/api/nodes?${params}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch nodes: ${response.statusText}`)
    }

    return response.json()
  }

  async getNotebookCards(folder?: string): Promise<any[]> {
    if (!this.isAvailable) {
      throw new Error('Native API not available')
    }

    const params = folder ? `?folder=${encodeURIComponent(folder)}` : ''
    const response = await fetch(`${this.baseUrl}/api/notebook-cards${params}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch notebook cards: ${response.statusText}`)
    }

    return response.json()
  }

  async saveNotebookCard(card: any): Promise<any> {
    if (!this.isAvailable) {
      throw new Error('Native API not available')
    }

    const method = card.id ? 'PUT' : 'POST'
    const url = card.id
      ? `${this.baseUrl}/api/notebook-cards/${card.id}`
      : `${this.baseUrl}/api/notebook-cards`

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(card)
    })

    if (!response.ok) {
      throw new Error(`Failed to save notebook card: ${response.statusText}`)
    }

    return response.json()
  }

  async deleteNotebookCard(id: string): Promise<void> {
    if (!this.isAvailable) {
      throw new Error('Native API not available')
    }

    const response = await fetch(`${this.baseUrl}/api/notebook-cards/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error(`Failed to delete notebook card: ${response.statusText}`)
    }
  }

  async searchNodes(query: string): Promise<any[]> {
    if (!this.isAvailable) {
      throw new Error('Native API not available')
    }

    const params = new URLSearchParams({ q: query })
    const response = await fetch(`${this.baseUrl}/api/search?${params}`)

    if (!response.ok) {
      throw new Error(`Failed to search nodes: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Convert JavaScript values to API-compatible parameters
   */
  private convertParameter(param: any): any {
    if (param === null || param === undefined) {
      return null
    }
    if (typeof param === 'string' || typeof param === 'number' || typeof param === 'boolean') {
      return param
    }
    // Convert other types to string representation
    return String(param)
  }
}

// Default instance for application use
export const nativeAPI = new NativeAPIClient()