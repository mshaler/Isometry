/**
 * Memory Leak Prevention Utilities
 *
 * Provides patterns and utilities for preventing memory leaks in React components
 * with proper cleanup functions for side effects, WebSocket connections, timers,
 * event listeners, and other resource-intensive operations.
 */

import { useEffect, useRef, useCallback } from 'react'

/**
 * Type for cleanup function that releases resources
 */
export type CleanupFunction = () => void

/**
 * Stack for managing multiple cleanup operations
 */
export class CleanupStack {
  private cleanups: CleanupFunction[] = []
  private isDestroyed = false

  /**
   * Add a cleanup function to the stack
   */
  add(cleanup: CleanupFunction): void {
    if (this.isDestroyed) {
      // If stack is already destroyed, execute cleanup immediately
      cleanup()
      return
    }

    this.cleanups.push(cleanup)
  }

  /**
   * Add WebSocket cleanup with proper connection handling
   */
  addWebSocket(ws: WebSocket): void {
    this.add(() => {
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    })
  }

  /**
   * Add timer cleanup (interval or timeout)
   */
  addTimer(timerId: NodeJS.Timeout): void {
    this.add(() => clearInterval(timerId))
  }

  /**
   * Add event listener cleanup
   */
  addEventListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options)
    this.add(() => target.removeEventListener(type, listener, options))
  }

  /**
   * Add subscription cleanup (for RxJS or similar)
   */
  addSubscription(subscription: { unsubscribe: () => void }): void {
    this.add(() => subscription.unsubscribe())
  }

  /**
   * Add AbortController cleanup
   */
  addAbortController(controller: AbortController): void {
    this.add(() => {
      if (!controller.signal.aborted) {
        controller.abort()
      }
    })
  }

  /**
   * Execute all cleanup functions and clear the stack
   */
  destroy(): void {
    if (this.isDestroyed) return

    // Execute all cleanups in reverse order (LIFO)
    const cleanups = [...this.cleanups].reverse()
    this.cleanups = []
    this.isDestroyed = true

    cleanups.forEach((cleanup, index) => {
      try {
        cleanup()
      } catch (error) {
        console.warn(`Cleanup function ${index} failed:`, error)
      }
    })
  }

  /**
   * Get number of pending cleanup operations
   */
  get size(): number {
    return this.cleanups.length
  }

  /**
   * Check if stack has been destroyed
   */
  get destroyed(): boolean {
    return this.isDestroyed
  }
}

/**
 * Create a new cleanup stack for managing multiple cleanup operations
 */
export function createCleanupStack(): CleanupStack {
  return new CleanupStack()
}

/**
 * Enhanced useEffect hook that ensures proper cleanup and prevents memory leaks
 *
 * @param effect Function that returns cleanup or undefined
 * @param deps Dependency array
 * @param debugName Optional name for debugging cleanup issues
 */
export function useCleanupEffect(
  effect: () => CleanupFunction | void,
  deps?: React.DependencyList,
  debugName?: string
): void {
  const cleanupRef = useRef<CleanupFunction | null>(null)
  const debugNameRef = useRef(debugName)

  useEffect(() => {
    // Clear any previous cleanup
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    // Execute effect and store cleanup
    const cleanup = effect()

    if (cleanup) {
      if (typeof cleanup !== 'function') {
        console.error(
          `useCleanupEffect${debugNameRef.current ? ` (${debugNameRef.current})` : ''}: ` +
          'Effect must return a function or undefined for cleanup'
        )
        return
      }
      cleanupRef.current = cleanup
    }

    // Return cleanup function for React
    return () => {
      if (cleanupRef.current) {
        try {
          cleanupRef.current()
        } catch (error) {
          console.error(
            `Cleanup failed${debugNameRef.current ? ` in ${debugNameRef.current}` : ''}:`,
            error
          )
        }
        cleanupRef.current = null
      }
    }
  }, deps)
}

/**
 * Hook for managing WebSocket connections with automatic cleanup
 */
export function useWebSocketCleanup(
  url: string,
  options?: {
    protocols?: string | string[]
    reconnect?: boolean
    reconnectDelay?: number
  }
): {
  socket: WebSocket | null
  send: (data: string) => void
  close: () => void
  readyState: number
} {
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const close = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const send = useCallback((data: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(data)
    }
  }, [])

  useCleanupEffect(() => {
    const socket = new WebSocket(url, options?.protocols)
    socketRef.current = socket

    if (options?.reconnect) {
      socket.addEventListener('close', () => {
        if (reconnectTimeoutRef.current) return // Already reconnecting

        reconnectTimeoutRef.current = setTimeout(() => {
          if (socketRef.current?.readyState === WebSocket.CLOSED) {
            // Trigger re-render to recreate connection
            socketRef.current = null
          }
        }, options.reconnectDelay || 5000)
      })
    }

    return () => {
      close()
    }
  }, [url, options?.protocols, options?.reconnect, options?.reconnectDelay], 'WebSocket')

  return {
    socket: socketRef.current,
    send,
    close,
    readyState: socketRef.current?.readyState ?? WebSocket.CLOSED
  }
}

/**
 * Hook for managing intervals with automatic cleanup
 */
export function useIntervalCleanup(
  callback: () => void,
  delay: number | null,
  immediate = false
): void {
  const savedCallback = useRef<() => void>()

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useCleanupEffect(() => {
    if (delay === null) return

    if (immediate && savedCallback.current) {
      savedCallback.current()
    }

    const intervalId = setInterval(() => {
      if (savedCallback.current) {
        savedCallback.current()
      }
    }, delay)

    return () => clearInterval(intervalId)
  }, [delay, immediate], 'Interval')
}

/**
 * Hook for managing event listeners with automatic cleanup
 */
export function useEventListenerCleanup<T extends EventTarget>(
  target: T | null,
  type: string,
  handler: EventListener,
  options?: AddEventListenerOptions
): void {
  useCleanupEffect(() => {
    if (!target) return

    target.addEventListener(type, handler, options)

    return () => {
      target.removeEventListener(type, handler, options)
    }
  }, [target, type, handler], `EventListener:${type}`)
}

/**
 * Development-only memory leak detector
 */
export const MemoryLeakDetector = {
  /**
   * Track a potential memory leak source
   */
  track(name: string, _resource?: any): void {
    if (process.env.NODE_ENV === 'development') {
      if (!window._isometryMemoryTracker) {
        window._isometryMemoryTracker = new Map()
      }

      const existing = window._isometryMemoryTracker.get(name) || 0
      window._isometryMemoryTracker.set(name, existing + 1)

      if (existing > 10) {
        console.warn(`Potential memory leak detected: ${name} has ${existing + 1} instances`)
      }
    }
  },

  /**
   * Untrack a resource
   */
  untrack(name: string): void {
    if (process.env.NODE_ENV === 'development') {
      if (!window._isometryMemoryTracker) return

      const existing = window._isometryMemoryTracker.get(name) || 0
      if (existing > 1) {
        window._isometryMemoryTracker.set(name, existing - 1)
      } else {
        window._isometryMemoryTracker.delete(name)
      }
    }
  },

  /**
   * Get current tracking stats
   */
  getStats(): Record<string, number> {
    if (process.env.NODE_ENV === 'development' && window._isometryMemoryTracker) {
      return Object.fromEntries(window._isometryMemoryTracker)
    }
    return {}
  }
}

// Type augmentation for development tracking
declare global {
  interface Window {
    _isometryMemoryTracker?: Map<string, number>
  }
}

/**
 * Validation utilities for cleanup functions
 */
export const CleanupValidation = {
  /**
   * Ensure an effect returns a cleanup function
   */
  requireCleanup<T>(effect: () => T, name?: string): T {
    const result = effect()

    if (result && typeof result !== 'function') {
      throw new Error(
        `${name || 'Effect'} must return a cleanup function or undefined, got: ${typeof result}`
      )
    }

    return result
  },

  /**
   * Wrap a function to ensure it's safe to call multiple times
   */
  idempotent(fn: () => void): () => void {
    let called = false

    return () => {
      if (called) return
      called = true
      fn()
    }
  }
}