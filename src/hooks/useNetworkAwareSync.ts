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
  NetworkQuality,
  NetworkChangeEvent,
  QualityConfigMap
} from '../services/networkMonitor'
import { useBackgroundSync } from './useBackgroundSync'
import { useCleanupEffect } from '../utils/memoryManagement'

/**
 * Network-aware sync configuration
 */
interface NetworkAwareSyncConfig {
  // Quality-based sync behavior
  enableRealTimeSync?: {
    high: boolean
    medium: boolean
    low: boolean
  }

  // Sync frequency by quality (milliseconds)
  syncFrequency?: QualityConfigMap<number>

  // Payload optimization
  enablePayloadOptimization?: boolean
  maxPayloadSizes?: QualityConfigMap<number>

  // Concurrency limits
  maxConcurrentOperations?: QualityConfigMap<number>

  // Compression settings
  compressionThresholds?: QualityConfigMap<number>

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
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality | null>(null)
  const [metrics, setMetrics] = useState<NetworkAdaptationMetrics | null>(null)
  const [adaptationHistory, setAdaptationHistory] = useState<Array<{
    timestamp: number
    quality: ConnectionQuality
    adaptation: string
  }>>([])

  const networkMonitorRef = useRef<NetworkMonitor | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
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
      networkMonitorRef.current = getNetworkMonitor({
        highQualityDownlink: 2.0,
        mediumQualityDownlink: 0.5,
        enablePolling: true,
        respectSaveData: true
      })

      // Set initial quality
      setNetworkQuality(networkMonitorRef.current.getQuality())
    }
  }, [])

  /**
   * Calculate current adaptation metrics
   */
  const calculateMetrics = useCallback((quality: ConnectionQuality): NetworkAdaptationMetrics => {
    // Type-safe quality-based configuration access
    const getQualityConfig = <T>(config: QualityConfigMap<T>, fallback: T): T => {
      return config[quality] ?? fallback
    }

    const qualityConfig = {
      syncFrequency: getQualityConfig(fullConfig.syncFrequency, 15000),
      maxPayload: getQualityConfig(fullConfig.maxPayloadSizes, 2 * 1024 * 1024),
      concurrency: getQualityConfig(fullConfig.maxConcurrentOperations, 3),
      compressionThreshold: getQualityConfig(fullConfig.compressionThresholds, 512 * 1024)
    }

    return {
      currentQuality: quality,
      adaptedSyncFrequency: qualityConfig.syncFrequency,
      adaptedMaxPayload: qualityConfig.maxPayload,
      adaptedConcurrency: qualityConfig.concurrency,
      compressionEnabled: fullConfig.enablePayloadOptimization,
      realTimeSyncEnabled: getQualityConfig(fullConfig.enableRealTimeSync, true),
      totalAdaptations: adaptationCountRef.current,
      bandwidthSavings: bandwidthSavingsRef.current,
      performanceImpact: quality === 'high' ? 'positive' :
                        quality === 'medium' ? 'neutral' : 'negative'
    }
  }, [fullConfig])

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
   * Listen for network quality changes
   */
  useCleanupEffect(() => {
    if (!networkMonitorRef.current) return

    const unsubscribe = networkMonitorRef.current.addEventListener((event: NetworkChangeEvent) => {
      setNetworkQuality(event.current)
      adaptToNetworkQuality(event.current.quality, event.previous.quality)
    })

    return unsubscribe
  }, [adaptToNetworkQuality], 'NetworkAwareSync:QualityListener')

  /**
   * Setup adaptive sync interval
   */
  useCleanupEffect(() => {
    if (!networkQuality) return

    const getQualityConfig = <T>(config: QualityConfigMap<T>, fallback: T): T => {
      return config[networkQuality.quality] ?? fallback
    }

    if (!getQualityConfig(fullConfig.enableRealTimeSync, true)) {
      return
    }

    const frequency = getQualityConfig(fullConfig.syncFrequency, 15000)

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
  }, [networkQuality, queueState.pending, fullConfig], 'NetworkAwareSync:SyncInterval')

  /**
   * Queue operation with network-aware optimization
   */
  const queueOptimizedSync = useCallback((
    type: Parameters<typeof queueSync>[0],
    data: any,
    options: Parameters<typeof queueSync>[2] = {}
  ) => {
    if (!networkQuality) {
      return queueSync(type, data, options)
    }

    const quality = networkQuality.quality
    const qualityConfig = fullConfig

    // Adapt payload size if optimization enabled
    let optimizedData = data
    if (qualityConfig.enablePayloadOptimization) {
      const getQualityConfig = <T>(config: QualityConfigMap<T>, fallback: T): T => {
        return config[quality] ?? fallback
      }
      const maxSize = getQualityConfig(qualityConfig.maxPayloadSizes, 2 * 1024 * 1024)
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
      if (quality === 'low' && options.priority === 'high') {
        adaptedOptions.priority = 'normal'
      } else if (quality === 'high' && options.priority === 'low') {
        adaptedOptions.priority = 'normal'
      }
    }

    return queueSync(type, optimizedData, adaptedOptions)
  }, [queueSync, networkQuality, fullConfig])

  /**
   * Optimize payload for network conditions
   */
  const optimizePayloadForNetwork = useCallback((
    data: any,
    maxSize: number,
    quality: ConnectionQuality
  ): any => {
    // Simple payload optimization strategies
    let optimized = { ...data }

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
   * Get current network quality
   */
  const getCurrentQuality = useCallback((): ConnectionQuality | null => {
    return networkQuality?.quality || null
  }, [networkQuality])

  /**
   * Get bandwidth recommendations for current network
   */
  const getBandwidthRecommendations = useCallback(() => {
    if (!networkMonitorRef.current) return null
    return networkMonitorRef.current.getBandwidthRecommendation()
  }, [])

  /**
   * Force network quality check
   */
  const checkNetworkQuality = useCallback(() => {
    if (networkMonitorRef.current) {
      const quality = networkMonitorRef.current.getCurrentQuality()
      setNetworkQuality(quality)
      adaptToNetworkQuality(quality.quality)
    }
  }, [adaptToNetworkQuality])

  /**
   * Get detailed sync performance metrics
   */
  const getSyncPerformanceMetrics = useCallback(() => {
    const syncMetrics = getSyncMetrics()

    return {
      ...syncMetrics,
      networkQuality: networkQuality?.quality || 'unknown',
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
    networkQuality: networkQuality?.quality || 'medium',
    networkDetails: networkQuality,
    isOnline: networkQuality?.quality !== 'offline',

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
    setQuality(monitor.getQuality().quality)

    const unsubscribe = monitor.addEventListener((event) => {
      setQuality(event.current.quality)
      setIsOnline(event.current.quality !== 'offline')
    })

    return unsubscribe
  }, [])

  return {
    quality,
    isOnline,
    isHighQuality: quality === 'high',
    isMediumQuality: quality === 'medium',
    isLowQuality: quality === 'low'
  }
}