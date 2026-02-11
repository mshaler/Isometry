/**
 * Network-Aware Sync Hook
 *
 * Provides intelligent sync behavior that adapts to network conditions,
 * integrating with the background sync queue and existing infrastructure.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  NetworkMonitor,
  getNetworkMonitor,
  ConnectionQuality,
  NetworkChangeEvent,
} from '../../services/system/networkMonitor';
import { useBackgroundSync } from './useBackgroundSync'
import { useCleanupEffect } from '../../utils/memoryManagement'

/**
 * Local quality-keyed config map for network-aware sync.
 * Maps high/medium/low quality levels to a typed value.
 */
interface LocalQualityConfig<T> {
  high: T
  medium: T
  low: T
  [key: string]: T
}

/**
 * Shape used when optimizing unknown payloads.
 * Allows property access on the spread result.
 */
interface PayloadRecord {
  [key: string]: unknown
  id?: unknown
  metadata?: unknown
  description?: string
  type?: unknown
  title?: unknown
}

/**
 * Network-aware sync configuration
 */
interface NetworkAwareSyncConfig {
  // Quality-based sync behavior
  enableRealTimeSync?: LocalQualityConfig<boolean>

  // Sync frequency by quality (milliseconds)
  syncFrequency?: LocalQualityConfig<number>

  // Payload optimization
  enablePayloadOptimization?: boolean
  maxPayloadSizes?: LocalQualityConfig<number>

  // Concurrency limits
  maxConcurrentOperations?: LocalQualityConfig<number>

  // Compression settings
  compressionThresholds?: LocalQualityConfig<number>

  // Auto-adapt behavior
  autoAdjustPriority?: boolean
  degradeOnSlowConnection?: boolean
  pauseOnOffline?: boolean
}

/**
 * Default configuration optimized for each connection quality
 */
const DEFAULT_CONFIG: Required<NetworkAwareSyncConfig> = {
  enableRealTimeSync: {
    high: true, // Full real-time sync on fast connections
    medium: true, // Reduced real-time sync on medium connections
    low: false // No real-time sync on slow connections
  },

  syncFrequency: {
    high: 5000, // 5 seconds
    medium: 15000, // 15 seconds
    low: 60000 // 1 minute
  },

  enablePayloadOptimization: true,

  maxPayloadSizes: {
    high: 10 * 1024 * 1024, // 10 MB
    medium: 2 * 1024 * 1024, // 2 MB
    low: 512 * 1024 // 512 KB
  },

  maxConcurrentOperations: {
    high: 6,
    medium: 3,
    low: 1
  },

  compressionThresholds: {
    high: 1024 * 1024, // 1 MB - compress large payloads even on fast connections
    medium: 512 * 1024, // 512 KB
    low: 100 * 1024 // 100 KB - compress everything on slow connections
  },

  autoAdjustPriority: true,
  degradeOnSlowConnection: true,
  pauseOnOffline: true
}

/**
 * Network adaptation metrics
 */
interface NetworkAdaptationMetrics {
  currentQuality: ConnectionQuality
  adaptedSyncFrequency: number
  adaptedMaxPayload: number
  adaptedConcurrency: number
  compressionEnabled: boolean
  realTimeSyncEnabled: boolean
  totalAdaptations: number
  bandwidthSavings: number // estimated bytes saved
  performanceImpact: 'positive' | 'neutral' | 'negative'
}

/**
 * Hook for network-aware sync optimization
 */
export function useNetworkAwareSync(config: NetworkAwareSyncConfig = {}) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const [networkQuality, setNetworkQuality] = useState<ConnectionQuality | null>(null)
  const [metrics, setMetrics] = useState<NetworkAdaptationMetrics | null>(null)
  const [adaptationHistory, setAdaptationHistory] = useState<Array<{
    timestamp: number
    quality: ConnectionQuality
    adaptation: string
  }>>([])

  const networkMonitorRef = useRef<NetworkMonitor | null>(null)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const adaptationCountRef = useRef(0)
  const bandwidthSavingsRef = useRef(0)

  const {
    queueSync,
    queueState,
    getMetrics: getSyncMetrics,
    syncQueue
  } = useBackgroundSync({
    autoStart: true,
    enableOptimisticUpdates: true
  })

  /**
   * Initialize network monitor
   */
  useEffect(() => {
    if (!networkMonitorRef.current) {
      networkMonitorRef.current = getNetworkMonitor()

      // Set initial quality — getQuality() returns ConnectionQuality (a string)
      const initialQuality = networkMonitorRef.current?.getQuality()
      setNetworkQuality(initialQuality || 'offline')
    }
  }, [])

  /**
   * Helper to look up a value from a LocalQualityConfig by quality key
   */
  const getQualityValue = useCallback(<T,>(
    configMap: LocalQualityConfig<T>,
    quality: ConnectionQuality,
    fallback: T
  ): T => {
    return configMap[quality] ?? fallback
  }, [])

  /**
   * Calculate current adaptation metrics
   */
  const calculateMetrics = useCallback((quality: ConnectionQuality): NetworkAdaptationMetrics => {
    const qualityConfig = {
      syncFrequency: getQualityValue(fullConfig.syncFrequency, quality, 15000),
      maxPayload: getQualityValue(fullConfig.maxPayloadSizes, quality, 2 * 1024 * 1024),
      concurrency: getQualityValue(fullConfig.maxConcurrentOperations, quality, 3),
      compressionThreshold: getQualityValue(fullConfig.compressionThresholds, quality, 512 * 1024)
    }

    return {
      currentQuality: quality,
      adaptedSyncFrequency: qualityConfig.syncFrequency,
      adaptedMaxPayload: qualityConfig.maxPayload,
      adaptedConcurrency: qualityConfig.concurrency,
      compressionEnabled: fullConfig.enablePayloadOptimization,
      realTimeSyncEnabled: getQualityValue(fullConfig.enableRealTimeSync, quality, true),
      totalAdaptations: adaptationCountRef.current,
      bandwidthSavings: bandwidthSavingsRef.current,
      performanceImpact: quality === 'high' ? 'positive' :
                        quality === 'medium' ? 'neutral' : 'negative'
    }
  }, [fullConfig, getQualityValue])

  /**
   * Adapt sync behavior to network quality
   */
  const adaptToNetworkQuality = useCallback((quality: ConnectionQuality, previous?: ConnectionQuality) => {
    if (!syncQueue) return

    const newMetrics = calculateMetrics(quality)
    setMetrics(newMetrics)

    // Update sync queue behavior based on quality
    switch (quality) {
      case 'high':
        // Enable full real-time sync, high concurrency
        if (fullConfig.pauseOnOffline && previous === 'offline') {
          syncQueue.resume()
        }
        break

      case 'medium':
        // Reduce sync frequency, moderate concurrency
        if (fullConfig.degradeOnSlowConnection && previous === 'high') {
          // Degrade high-priority operations to normal
          adaptationCountRef.current++
        }
        break

      case 'low':
        // Minimal sync, low concurrency, aggressive compression
        if (fullConfig.degradeOnSlowConnection) {
          // Degrade all operations to low priority
          adaptationCountRef.current++
        }
        break

      case 'offline':
        // Pause sync operations entirely
        if (fullConfig.pauseOnOffline) {
          syncQueue.pause()
        }
        break
    }

    // Log adaptation
    setAdaptationHistory(prev => [
      ...prev.slice(-9), // Keep last 10 adaptations
      {
        timestamp: Date.now(),
        quality,
        adaptation: `Adapted from ${previous || 'unknown'} to ${quality}`
      }
    ])

  }, [syncQueue, calculateMetrics, fullConfig])

  /**
   * Listen for network quality changes.
   * NetworkMonitor.addEventListener expects (event: string, callback).
   * NetworkChangeEvent has { type, quality?, timestamp }.
   */
  useCleanupEffect(() => {
    if (!networkMonitorRef.current) return

    const handler = ((evt: Event) => {
      const event = evt as unknown as NetworkChangeEvent
      const newQuality = event.quality || 'offline'
      const previousQuality = networkQuality || undefined
      setNetworkQuality(newQuality)
      adaptToNetworkQuality(newQuality, previousQuality)
    }) as EventListener

    networkMonitorRef.current.addEventListener('quality-change', handler)

    return () => {
      networkMonitorRef.current?.removeEventListener('quality-change', handler)
    }
  }, [adaptToNetworkQuality, networkQuality])

  /**
   * Setup adaptive sync interval
   */
  useCleanupEffect(() => {
    if (!networkQuality) return

    if (!getQualityValue(fullConfig.enableRealTimeSync, networkQuality, true)) {
      return
    }

    const frequency = getQualityValue(fullConfig.syncFrequency, networkQuality, 15000)

    syncIntervalRef.current = setInterval(() => {
      // Trigger background sync for pending operations
      if (queueState.pending > 0) {
        // Process queue based on network quality
        // The queue will automatically handle operations based on current conditions
      }
    }, frequency)

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }
  }, [networkQuality, queueState.pending, fullConfig, getQualityValue])

  /**
   * Queue operation with network-aware optimization
   */
  const queueOptimizedSync = useCallback((
    type: Parameters<typeof queueSync>[0],
    data: unknown,
    options: Parameters<typeof queueSync>[2] = {}
  ) => {
    if (!networkQuality) {
      return queueSync(type, data, options)
    }

    const quality = networkQuality
    const qualityConfig = fullConfig

    // Adapt payload size if optimization enabled
    let optimizedData = data
    if (qualityConfig.enablePayloadOptimization) {
      const maxSize = getQualityValue(qualityConfig.maxPayloadSizes, quality, 2 * 1024 * 1024)
      const currentSize = JSON.stringify(data).length

      if (currentSize > maxSize) {
        // Implement payload reduction strategies
        optimizedData = optimizePayloadForNetwork(data, maxSize, quality)

        // Track bandwidth savings
        const savings = currentSize - JSON.stringify(optimizedData).length
        bandwidthSavingsRef.current += savings
      }
    }

    // Adapt priority based on network quality
    const adaptedOptions = { ...options }
    if (qualityConfig.autoAdjustPriority) {
      if (quality === 'low' && options?.priority === 'high') {
        adaptedOptions.priority = 'normal'
      } else if (quality === 'high' && options?.priority === 'low') {
        adaptedOptions.priority = 'normal'
      }
    }

    return queueSync(type, optimizedData, adaptedOptions)
  }, [queueSync, networkQuality, fullConfig, getQualityValue])

  /**
   * Optimize payload for network conditions
   */
  const optimizePayloadForNetwork = useCallback((
    data: unknown,
    maxSize: number,
    quality: ConnectionQuality
  ): unknown => {
    // Cast to record for property access on unknown data
    const dataRecord = (typeof data === 'object' && data !== null ? data : {}) as PayloadRecord
    let optimized: PayloadRecord = { ...dataRecord }

    // Remove non-essential fields for slow connections
    if (quality === 'low') {
      // Remove large text fields, metadata, etc.
      if (optimized.metadata) delete optimized.metadata
      if (optimized.description && optimized.description.length > 200) {
        optimized.description = optimized.description.substring(0, 197) + '...'
      }
    }

    // Compress data structure if still too large
    const currentSize = JSON.stringify(optimized).length
    if (currentSize > maxSize) {
      // Further reduce payload (implement based on data structure)
      // This is a placeholder for more sophisticated optimization
      optimized = {
        id: optimized.id,
        essential: true, // Mark as essential-only payload
        ...Object.fromEntries(
          Object.entries(optimized)
            .filter(([key]) => ['id', 'type', 'title'].includes(key))
        )
      }
    }

    return optimized
  }, [])

  /**
   * Get current network quality.
   * networkQuality is already a ConnectionQuality string (or null).
   */
  const getCurrentQuality = useCallback((): ConnectionQuality | null => {
    return networkQuality || null
  }, [networkQuality])

  /**
   * Get bandwidth recommendations for current network.
   * NetworkMonitor stub does not expose getBandwidthRecommendation,
   * so we return a basic status from getStatus().
   */
  const getBandwidthRecommendations = useCallback(() => {
    if (!networkMonitorRef.current) return null
    return networkMonitorRef.current.getStatus()
  }, [])

  /**
   * Force network quality check.
   * getQuality() returns ConnectionQuality directly (a string).
   */
  const checkNetworkQuality = useCallback(() => {
    if (networkMonitorRef.current) {
      const quality = networkMonitorRef.current.getQuality()
      setNetworkQuality(quality)
      adaptToNetworkQuality(quality)
    }
  }, [adaptToNetworkQuality])

  /**
   * Get detailed sync performance metrics
   */
  const getSyncPerformanceMetrics = useCallback(() => {
    const syncMetrics = getSyncMetrics()

    return {
      ...syncMetrics,
      networkQuality: networkQuality || 'unknown',
      adaptationMetrics: metrics,
      adaptationHistory: adaptationHistory.slice(-5), // Last 5 adaptations
      bandwidthOptimization: {
        enabled: fullConfig.enablePayloadOptimization,
        totalSavings: bandwidthSavingsRef.current,
        compressionRatio: bandwidthSavingsRef.current > 0 ?
          (bandwidthSavingsRef.current / (bandwidthSavingsRef.current + 1000)) * 100 : 0
      }
    }
  }, [getSyncMetrics, networkQuality, metrics, adaptationHistory, fullConfig])

  return {
    // Network state
    networkQuality: networkQuality || 'medium',
    networkDetails: networkQuality,
    isOnline: networkQuality !== 'offline',

    // Adaptation metrics
    adaptationMetrics: metrics,
    adaptationHistory,

    // Optimized sync operations
    queueOptimizedSync,
    getCurrentQuality,
    checkNetworkQuality,

    // Performance insights
    getBandwidthRecommendations,
    getSyncPerformanceMetrics,

    // Sync state (from background sync)
    queueState,
    isProcessing: queueState.processing > 0
  }
}

/**
 * Simple hook for basic network awareness without full optimization
 */
export function useNetworkQuality() {
  const [quality, setQuality] = useState<ConnectionQuality>('medium')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const monitor = getNetworkMonitor()
    // getQuality() returns ConnectionQuality directly (a string)
    setQuality(monitor.getQuality())

    const handler = ((evt: Event) => {
      const event = evt as unknown as NetworkChangeEvent
      const newQuality = event.quality || 'offline'
      setQuality(newQuality)
      setIsOnline(newQuality !== 'offline')
    }) as EventListener

    monitor.addEventListener('quality-change', handler)

    return () => {
      monitor.removeEventListener('quality-change', handler)
    }
  }, [])

  return {
    quality,
    isOnline,
    isHighQuality: quality === 'high',
    isMediumQuality: quality === 'medium',
    isLowQuality: quality === 'low'
  }
}
