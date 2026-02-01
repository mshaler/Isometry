/**
 * Network Monitor Service
 *
 * Monitors network quality and connection changes using the Network Information API
 * with graceful degradation for unsupported browsers.
 */

/**
 * Network connection quality categories
 */
export type ConnectionQuality = 'high' | 'medium' | 'low' | 'offline'

export type QualityConfigMap<T> = {
  high: T
  medium: T
  low: T
  offline?: T
}

/**
 * Effective connection type from Network Information API
 */
export type EffectiveConnectionType = 'slow-2g' | '2g' | '3g' | '4g'

/**
 * Connection information from Network Information API
 */
export interface ConnectionInfo {
  effectiveType?: EffectiveConnectionType
  downlink?: number
  rtt?: number
  saveData?: boolean
}

/**
 * Network quality metrics and characteristics
 */
export interface NetworkQuality {
  quality: ConnectionQuality
  downlink: number
  rtt: number
  effectiveType: EffectiveConnectionType | 'unknown'
  saveData: boolean
  timestamp: number
}

/**
 * Network change event
 */
export interface NetworkChangeEvent {
  previous: NetworkQuality
  current: NetworkQuality
  qualityChanged: boolean
}

/**
 * Network monitoring configuration
 */
export interface NetworkMonitorConfig {
  // Thresholds for quality classification
  highQualityDownlink: number // Mbps
  mediumQualityDownlink: number // Mbps
  highQualityRTT: number // ms
  mediumQualityRTT: number // ms

  // Monitoring settings
  pollingInterval: number // ms
  enablePolling: boolean
  respectSaveData: boolean
}

/**
 * Default network monitor configuration
 */
const DEFAULT_CONFIG: NetworkMonitorConfig = {
  // Quality thresholds based on research best practices
  highQualityDownlink: 2.0, // 2 Mbps or higher = high quality
  mediumQualityDownlink: 0.5, // 0.5-2 Mbps = medium quality
  highQualityRTT: 150, // <150ms = good latency
  mediumQualityRTT: 500, // 150-500ms = medium latency

  // Monitoring configuration
  pollingInterval: 30000, // Check every 30 seconds as fallback
  enablePolling: true,
  respectSaveData: true
}

/**
 * Network Monitor with feature detection and graceful degradation
 */
export class NetworkMonitor {
  private config: NetworkMonitorConfig
  private currentQuality: NetworkQuality
  private listeners: Array<(event: NetworkChangeEvent) => void> = []
  private pollingInterval?: NodeJS.Timeout
  private isSupported: boolean
  private connection?: any

  constructor(config?: Partial<NetworkMonitorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.isSupported = this.checkNetworkInfoSupport()
    this.connection = this.getConnection()

    // Initialize with current quality
    this.currentQuality = this.getCurrentQuality()

    this.setupEventListeners()
  }

  /**
   * Check if Network Information API is supported
   */
  private checkNetworkInfoSupport(): boolean {
    return !!(navigator as any).connection &&
           typeof (navigator as any).connection.addEventListener === 'function'
  }

  /**
   * Get connection object with feature detection
   */
  private getConnection(): any {
    return (navigator as any).connection ||
           (navigator as any).mozConnection ||
           (navigator as any).webkitConnection
  }

  /**
   * Get current network quality assessment
   */
  getCurrentQuality(): NetworkQuality {
    // Check online status first
    if (!navigator.onLine) {
      return {
        quality: 'offline',
        downlink: 0,
        rtt: Infinity,
        effectiveType: 'unknown',
        saveData: false,
        timestamp: Date.now()
      }
    }

    let connectionInfo: ConnectionInfo = {}

    // Get connection info if supported
    if (this.isSupported && this.connection) {
      connectionInfo = {
        effectiveType: this.connection.effectiveType,
        downlink: this.connection.downlink,
        rtt: this.connection.rtt,
        saveData: this.connection.saveData
      }
    }

    // Classify quality based on available metrics
    const quality = this.classifyConnectionQuality(connectionInfo)

    return {
      quality,
      downlink: connectionInfo.downlink || 1.0, // Default assumption: 1 Mbps
      rtt: connectionInfo.rtt || 200, // Default assumption: 200ms
      effectiveType: connectionInfo.effectiveType || 'unknown',
      saveData: connectionInfo.saveData || false,
      timestamp: Date.now()
    }
  }

  /**
   * Classify connection quality based on metrics
   */
  private classifyConnectionQuality(info: ConnectionInfo): ConnectionQuality {
    // Respect user's save data preference
    if (this.config.respectSaveData && info.saveData) {
      return 'low'
    }

    // Use effective type as primary indicator if available
    if (info.effectiveType) {
      switch (info.effectiveType) {
        case 'slow-2g':
        case '2g':
          return 'low'
        case '3g':
          return 'medium'
        case '4g':
          // Further classify 4g based on actual metrics if available
          if (info.downlink && info.rtt) {
            return this.classifyByMetrics(info.downlink, info.rtt)
          }
          return 'high'
        default:
          break
      }
    }

    // Fallback to metric-based classification
    if (info.downlink && info.rtt) {
      return this.classifyByMetrics(info.downlink, info.rtt)
    }

    // Conservative fallback when no information available
    return 'medium'
  }

  /**
   * Classify quality based on downlink and RTT metrics
   */
  private classifyByMetrics(downlink: number, rtt: number): ConnectionQuality {
    // High quality: fast download and low latency
    if (downlink >= this.config.highQualityDownlink && rtt <= this.config.highQualityRTT) {
      return 'high'
    }

    // Low quality: slow download or high latency
    if (downlink < this.config.mediumQualityDownlink || rtt > this.config.mediumQualityRTT) {
      return 'low'
    }

    // Medium quality: everything else
    return 'medium'
  }

  /**
   * Setup event listeners for network changes
   */
  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', this.handleNetworkChange)
    window.addEventListener('offline', this.handleNetworkChange)

    // Listen for connection changes if supported
    if (this.isSupported && this.connection) {
      this.connection.addEventListener('change', this.handleConnectionChange)
    }

    // Setup polling as fallback
    if (this.config.enablePolling) {
      this.startPolling()
    }
  }

  /**
   * Handle network online/offline changes
   */
  private handleNetworkChange = (): void => {
    const newQuality = this.getCurrentQuality()
    this.updateQuality(newQuality)
  }

  /**
   * Handle connection property changes
   */
  private handleConnectionChange = (): void => {
    const newQuality = this.getCurrentQuality()
    this.updateQuality(newQuality)
  }

  /**
   * Update quality and notify listeners if changed
   */
  private updateQuality(newQuality: NetworkQuality): void {
    const previousQuality = this.currentQuality
    const qualityChanged = previousQuality.quality !== newQuality.quality

    this.currentQuality = newQuality

    if (qualityChanged || this.hasSignificantChange(previousQuality, newQuality)) {
      const event: NetworkChangeEvent = {
        previous: previousQuality,
        current: newQuality,
        qualityChanged
      }

      this.notifyListeners(event)
    }
  }

  /**
   * Check if there's a significant change worth notifying about
   */
  private hasSignificantChange(prev: NetworkQuality, curr: NetworkQuality): boolean {
    // Downlink change of more than 0.5 Mbps
    const downlinkChange = Math.abs(curr.downlink - prev.downlink) > 0.5

    // RTT change of more than 100ms
    const rttChange = Math.abs(curr.rtt - prev.rtt) > 100

    // Effective type changed
    const typeChange = prev.effectiveType !== curr.effectiveType

    // Save data preference changed
    const saveDataChange = prev.saveData !== curr.saveData

    return downlinkChange || rttChange || typeChange || saveDataChange
  }

  /**
   * Start polling for network changes (fallback method)
   */
  private startPolling(): void {
    if (this.pollingInterval) return

    this.pollingInterval = setInterval(() => {
      // Only poll if native events aren't supported
      if (!this.isSupported) {
        this.handleNetworkChange()
      }
    }, this.config.pollingInterval)
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = undefined
    }
  }

  /**
   * Add listener for network changes
   */
  addEventListener(listener: (event: NetworkChangeEvent) => void): () => void {
    this.listeners.push(listener)

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index >= 0) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify all listeners of network changes
   */
  private notifyListeners(event: NetworkChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Error in network change listener:', error)
      }
    })
  }

  /**
   * Get current network quality
   */
  getQuality(): NetworkQuality {
    return this.currentQuality
  }

  /**
   * Check if API is supported
   */
  isNetworkInfoSupported(): boolean {
    return this.isSupported
  }

  /**
   * Get bandwidth recommendation for current connection
   */
  getBandwidthRecommendation(): {
    maxPayloadSize: number // bytes
    compressionLevel: 'none' | 'light' | 'aggressive'
    concurrentRequests: number
    syncFrequency: number // ms
  } {
    const quality = this.currentQuality.quality

    switch (quality) {
      case 'high':
        return {
          maxPayloadSize: 10 * 1024 * 1024, // 10 MB
          compressionLevel: 'light',
          concurrentRequests: 6,
          syncFrequency: 5000 // 5 seconds
        }

      case 'medium':
        return {
          maxPayloadSize: 2 * 1024 * 1024, // 2 MB
          compressionLevel: 'light',
          concurrentRequests: 3,
          syncFrequency: 15000 // 15 seconds
        }

      case 'low':
        return {
          maxPayloadSize: 512 * 1024, // 512 KB
          compressionLevel: 'aggressive',
          concurrentRequests: 1,
          syncFrequency: 60000 // 1 minute
        }

      case 'offline':
      default:
        return {
          maxPayloadSize: 0,
          compressionLevel: 'aggressive',
          concurrentRequests: 0,
          syncFrequency: Infinity
        }
    }
  }

  /**
   * Cleanup listeners and polling
   */
  destroy(): void {
    // Remove event listeners
    window.removeEventListener('online', this.handleNetworkChange)
    window.removeEventListener('offline', this.handleNetworkChange)

    if (this.isSupported && this.connection) {
      this.connection.removeEventListener('change', this.handleConnectionChange)
    }

    // Stop polling
    this.stopPolling()

    // Clear listeners
    this.listeners = []
  }
}

/**
 * Global network monitor instance
 */
let globalNetworkMonitor: NetworkMonitor | null = null

/**
 * Get or create global network monitor
 */
export function getNetworkMonitor(config?: Partial<NetworkMonitorConfig>): NetworkMonitor {
  if (!globalNetworkMonitor) {
    globalNetworkMonitor = new NetworkMonitor(config)
  }
  return globalNetworkMonitor
}

/**
 * Destroy global network monitor
 */
export function destroyNetworkMonitor(): void {
  if (globalNetworkMonitor) {
    globalNetworkMonitor.destroy()
    globalNetworkMonitor = null
  }
}