/**
 * Enhanced Data Synchronization System
 *
 * Advanced offline-first synchronization with conflict resolution,
 * cross-device consistency, and persistent offline queuing.
 */

import { syncManager, type DataChange, type SyncConflict } from './sync-manager';
import { performanceMonitor } from './performance-monitor';

export interface SyncDevice {
  id: string;
  name: string;
  platform: 'iOS' | 'macOS' | 'browser';
  lastSeen: number;
  version: string;
}

export interface SyncSession {
  id: string;
  deviceId: string;
  startTime: number;
  endTime?: number;
  changesSent: number;
  changesReceived: number;
  conflictsResolved: number;
  status: 'active' | 'completed' | 'failed';
}

export interface OfflineChange {
  change: DataChange;
  attempts: number;
  lastAttempt: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  dependencies: string[]; // IDs of changes that must be synced first
}

export interface ConflictResolutionStrategy {
  strategy: 'last_write_wins' | 'first_write_wins' | 'merge_properties' | 'custom';
  mergeFunction?: (local: Record<string, unknown>, _remote: Record<string, unknown>) => Record<string, unknown>;
  conflictThreshold: number; // Time window in ms for conflict detection
}

export interface CrossDeviceState {
  devices: Map<string, SyncDevice>;
  activeSessions: Map<string, SyncSession>;
  changeVector: Map<string, number>; // Vector clocks for ordering
  globalSequence: number;
}

/**
 * Enhanced Sync Manager with Advanced Capabilities
 */
export class EnhancedSyncManager {
  private deviceId: string;
  private offlineStorage: Map<string, OfflineChange> = new Map();
  private conflictStrategy: ConflictResolutionStrategy;
  private crossDeviceState: CrossDeviceState;
  private storageKey = 'isometry-offline-changes';
  private deviceStorageKey = 'isometry-device-info';

  // Configuration
  private readonly maxOfflineChanges = 1000;
  private readonly syncSessionTimeout = 5 * 60 * 1000; // 5 minutes
  private readonly deviceHeartbeatInterval = 30 * 1000; // 30 seconds
  private readonly persistenceInterval = 10 * 1000; // 10 seconds

  // Timers
  private persistenceTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(conflictStrategy?: Partial<ConflictResolutionStrategy>) {
    this.deviceId = this.generateDeviceId();
    this.conflictStrategy = {
      strategy: 'last_write_wins',
      conflictThreshold: 5000, // 5 seconds
      ...conflictStrategy
    };

    this.crossDeviceState = {
      devices: new Map(),
      activeSessions: new Map(),
      changeVector: new Map(),
      globalSequence: 0
    };

    this.loadPersistedData();
    this.setupConflictResolution();
    this.startPeriodicPersistence();
  }

  /**
   * Initialize enhanced sync with device registration
   */
  async initialize(): Promise<void> {
    console.log('🔄 Initializing enhanced sync manager...');

    // Register current device
    const deviceInfo: SyncDevice = {
      id: this.deviceId,
      name: this.getDeviceName(),
      platform: this.getDevicePlatform(),
      lastSeen: Date.now(),
      version: this.getAppVersion()
    };

    this.crossDeviceState.devices.set(this.deviceId, deviceInfo);

    // Start heartbeat for device presence
    this.startDeviceHeartbeat();

    // Load and process offline changes
    await this.processOfflineChanges();

    console.log(`✅ Enhanced sync initialized for device: ${deviceInfo.name} (${this.deviceId.slice(-8)})`);
  }

  /**
   * Enhanced publish with priority and dependency tracking
   */
  async publishChange(
    change: DataChange,
    options?: {
      priority?: OfflineChange['priority'];
      dependencies?: string[];
      skipOfflineQueue?: boolean;
    }
  ): Promise<void> {
    const priority = options?.priority || 'normal';
    const dependencies = options?.dependencies || [];

    // Add to vector clock
    this.crossDeviceState.changeVector.set(this.deviceId,
      (this.crossDeviceState.changeVector.get(this.deviceId) || 0) + 1);

    change.version = this.crossDeviceState.globalSequence++;
    change.sessionId = this.deviceId;

    // Try immediate sync first
    try {
      await syncManager.publishLocalChange(change);
      performanceMonitor.recordSyncOperation(0, true); // Immediate success
    } catch (error) {
      console.warn('Immediate sync failed, queuing for offline:', error);

      if (!options?.skipOfflineQueue) {
        this.addToOfflineQueue(change, priority, dependencies);
      }

      performanceMonitor.recordSyncOperation(0, false);
      throw error;
    }
  }

  /**
   * Enhanced offline change processing with dependency resolution
   */
  async processOfflineChanges(): Promise<{
    processed: number;
    failed: number;
    conflicts: number;
  }> {
    let processed = 0;
    let failed = 0;
    const conflicts = 0;

    console.log(`📤 Processing ${this.offlineStorage.size} offline changes...`);

    // Sort by priority and dependencies
    const sortedChanges = this.sortChangesByDependencies();

    for (const offlineChange of sortedChanges) {
      try {
        const startTime = performance.now();

        // Check dependencies
        if (!this.areDependenciesSatisfied(offlineChange.dependencies)) {
          console.log(`⏳ Skipping change ${offlineChange.change.id} - dependencies not satisfied`);
          continue;
        }

        // Attempt sync
        await syncManager.publishLocalChange(offlineChange.change);

        // Success - remove from offline queue
        this.offlineStorage.delete(offlineChange.change.id);
        processed++;

        const duration = performance.now() - startTime;
        performanceMonitor.recordSyncOperation(duration, true);

        console.log(`✅ Synced offline change: ${offlineChange.change.id}`);

      } catch (error) {
        console.error(`❌ Failed to sync offline change ${offlineChange.change.id}:`, error);

        offlineChange.attempts++;
        offlineChange.lastAttempt = Date.now();

        // Check if max attempts reached
        if (offlineChange.attempts >= 3) {
          console.error(`🚫 Max attempts reached for change ${offlineChange.change.id}, removing from queue`);
          this.offlineStorage.delete(offlineChange.change.id);
          failed++;
        }

        performanceMonitor.recordSyncOperation(0, false);
      }
    }

    // Persist updated offline queue
    this.persistOfflineChanges();

    console.log(`📊 Offline sync summary: ${processed} processed, ${failed} failed, ${conflicts} conflicts`);

    return { processed, failed, conflicts };
  }

  /**
   * Cross-device sync session management
   */
  async startSyncSession(): Promise<string> {
    const sessionId = this.generateSessionId();
    const session: SyncSession = {
      id: sessionId,
      deviceId: this.deviceId,
      startTime: Date.now(),
      changesSent: 0,
      changesReceived: 0,
      conflictsResolved: 0,
      status: 'active'
    };

    this.crossDeviceState.activeSessions.set(sessionId, session);

    // Auto-close session after timeout
    setTimeout(() => {
      this.endSyncSession(sessionId);
    }, this.syncSessionTimeout);

    console.log(`🚀 Started sync session: ${sessionId}`);
    return sessionId;
  }

  /**
   * End sync session and collect metrics
   */
  async endSyncSession(sessionId: string): Promise<SyncSession | null> {
    const session = this.crossDeviceState.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    session.endTime = Date.now();
    session.status = 'completed';

    this.crossDeviceState.activeSessions.delete(sessionId);

    const duration = session.endTime - session.startTime;
    console.log(`✅ Sync session ${sessionId} completed in ${duration}ms`);
    console.log(`   Sent: ${session.changesSent}, Received: ${session.changesReceived}, Conflicts: ${session.conflictsResolved}`);

    return session;
  }

  /**
   * Advanced conflict resolution with multiple strategies
   */
  async resolveConflict(conflict: SyncConflict): Promise<SyncConflict> {
    const resolvedConflict = { ...conflict };

    switch (this.conflictStrategy.strategy) {
      case 'last_write_wins':
        resolvedConflict.resolutionStrategy = 'remote_wins';
        resolvedConflict.resolvedData = conflict.remoteChange.data;
        break;

      case 'first_write_wins':
        resolvedConflict.resolutionStrategy = 'local_wins';
        resolvedConflict.resolvedData = conflict.localChange.data;
        break;

      case 'merge_properties':
        resolvedConflict.resolutionStrategy = 'merge';
        resolvedConflict.resolvedData = this.mergeChanges(
          conflict.localChange.data,
          conflict.remoteChange.data
        );
        break;

      case 'custom':
        if (this.conflictStrategy.mergeFunction) {
          resolvedConflict.resolutionStrategy = 'merge';
          resolvedConflict.resolvedData = this.conflictStrategy.mergeFunction(
            conflict.localChange.data,
            conflict.remoteChange.data
          );
        } else {
          // Fallback to last write wins
          resolvedConflict.resolutionStrategy = 'remote_wins';
          resolvedConflict.resolvedData = conflict.remoteChange.data;
        }
        break;
    }

    console.log(`🔀 Resolved conflict ${conflict.id} using ${this.conflictStrategy.strategy}`);
    return resolvedConflict;
  }

  /**
   * Get cross-device sync status
   */
  getCrossDeviceStatus(): {
    currentDevice: SyncDevice;
    connectedDevices: SyncDevice[];
    activeSessions: SyncSession[];
    offlineChanges: number;
    lastSync: Date | null;
  } {
    const currentDevice = this.crossDeviceState.devices.get(this.deviceId)!;
    const connectedDevices = Array.from(this.crossDeviceState.devices.values())
      .filter(device => device.id !== this.deviceId);
    const activeSessions = Array.from(this.crossDeviceState.activeSessions.values());

    return {
      currentDevice,
      connectedDevices,
      activeSessions,
      offlineChanges: this.offlineStorage.size,
      lastSync: this.getLastSyncTime()
    };
  }

  /**
   * Force sync all offline changes
   */
  async forceSyncAll(): Promise<void> {
    console.log('🔄 Forcing sync of all offline changes...');
    await this.processOfflineChanges();
  }

  /**
   * Clear offline queue (for testing/debugging)
   */
  async clearOfflineQueue(): Promise<void> {
    this.offlineStorage.clear();
    this.persistOfflineChanges();
    console.log('🗑️ Offline queue cleared');
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private setupConflictResolution(): void {
    // Register enhanced conflict handler with sync manager
    syncManager.onConflict(async (conflict: SyncConflict) => {
      return this.resolveConflict(conflict);
    });
  }

  private addToOfflineQueue(
    change: DataChange,
    priority: OfflineChange['priority'],
    dependencies: string[]
  ): void {
    if (this.offlineStorage.size >= this.maxOfflineChanges) {
      console.warn('Offline queue full, removing oldest change');
      const oldestKey = this.offlineStorage.keys().next().value;
      this.offlineStorage.delete(oldestKey);
    }

    const offlineChange: OfflineChange = {
      change,
      attempts: 0,
      lastAttempt: Date.now(),
      priority,
      dependencies
    };

    this.offlineStorage.set(change.id, offlineChange);
    this.persistOfflineChanges();

    console.log(`📥 Added change to offline queue: ${change.id} (priority: ${priority})`);
  }

  private sortChangesByDependencies(): OfflineChange[] {
    const changes = Array.from(this.offlineStorage.values());

    // Sort by priority first, then by dependencies
    return changes.sort((a, b) => {
      // Priority order: critical > high > normal > low
      const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by dependency count (fewer dependencies first)
      return a.dependencies.length - b.dependencies.length;
    });
  }

  private areDependenciesSatisfied(dependencies: string[]): boolean {
    // Check if all dependency changes have been synced (not in offline queue)
    return dependencies.every(depId => !this.offlineStorage.has(depId));
  }

  private mergeChanges(
    localData: Record<string, unknown>,
    remoteData: Record<string, unknown>
  ): Record<string, unknown> {
    // Simple merge strategy - remote wins for conflicts, combine unique properties
    const merged = { ...localData };

    for (const [key, value] of Object.entries(remoteData)) {
      if (key === 'updatedAt' || key === 'version') {
        // Always use remote for timestamp fields
        merged[key] = value;
      } else if (!(key in localData)) {
        // Add remote-only properties
        merged[key] = value;
      } else if (typeof value === 'object' && value !== null &&
                 typeof localData[key] === 'object' && localData[key] !== null) {
        // Recursively merge objects
        merged[key] = this.mergeChanges(
          localData[key] as Record<string, unknown>,
          value as Record<string, unknown>
        );
      } else {
        // Remote wins for primitive conflicts
        merged[key] = value;
      }
    }

    return merged;
  }

  private persistOfflineChanges(): void {
    try {
      const data = {
        changes: Array.from(this.offlineStorage.entries()),
        timestamp: Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to persist offline changes:', error);
    }
  }

  private loadPersistedData(): void {
    try {
      // Load offline changes
      const offlineData = localStorage.getItem(this.storageKey);
      if (offlineData) {
        const parsed = JSON.parse(offlineData);
        this.offlineStorage = new Map(parsed.changes || []);
        console.log(`📁 Loaded ${this.offlineStorage.size} offline changes from storage`);
      }

      // Load device info
      const deviceData = localStorage.getItem(this.deviceStorageKey);
      if (deviceData) {
        const parsed = JSON.parse(deviceData);
        if (parsed.devices) {
          this.crossDeviceState.devices = new Map(parsed.devices);
        }
      }
    } catch (error) {
      console.error('Failed to load persisted data:', error);
      this.offlineStorage = new Map();
    }
  }

  private startPeriodicPersistence(): void {
    this.persistenceTimer = setInterval(() => {
      this.persistOfflineChanges();
      this.persistDeviceInfo();
    }, this.persistenceInterval);
  }

  private persistDeviceInfo(): void {
    try {
      const data = {
        devices: Array.from(this.crossDeviceState.devices.entries()),
        timestamp: Date.now()
      };
      localStorage.setItem(this.deviceStorageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to persist device info:', error);
    }
  }

  private startDeviceHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const device = this.crossDeviceState.devices.get(this.deviceId);
      if (device) {
        device.lastSeen = Date.now();
        this.crossDeviceState.devices.set(this.deviceId, device);
      }
    }, this.deviceHeartbeatInterval);
  }

  private generateDeviceId(): string {
    // Try to get existing device ID from storage
    const stored = localStorage.getItem('isometry-device-id');
    if (stored) {
      return stored;
    }

    // Generate new device ID
    const deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    localStorage.setItem('isometry-device-id', deviceId);
    return deviceId;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private getDeviceName(): string {
    // Detect device name based on platform
    if (typeof navigator !== 'undefined') {
      const platform = navigator.platform || navigator.userAgent;
      if (platform.includes('Mac')) {
        return `Mac (${navigator.userAgent.split(')')[0].split('(')[1] || 'Unknown'})`;
      } else if (platform.includes('iPhone') || platform.includes('iPad')) {
        return `iOS Device (${platform})`;
      } else {
        return `Browser (${navigator.userAgent.split(' ')[0] || 'Unknown'})`;
      }
    }
    return 'Unknown Device';
  }

  private getDevicePlatform(): SyncDevice['platform'] {
    if (typeof navigator !== 'undefined') {
      const platform = navigator.platform || navigator.userAgent;
      if (platform.includes('Mac')) {
        return 'macOS';
      } else if (platform.includes('iPhone') || platform.includes('iPad')) {
        return 'iOS';
      }
    }
    return 'browser';
  }

  private getAppVersion(): string {
    return process.env.REACT_APP_VERSION || '1.0.0';
  }

  private getLastSyncTime(): Date | null {
    const syncState = syncManager.getSyncState();
    return syncState.lastSync;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Final persistence
    this.persistOfflineChanges();
    this.persistDeviceInfo();

    console.log('🧹 Enhanced sync manager destroyed');
  }
}

/**
 * Global enhanced sync manager instance
 */
export const enhancedSyncManager = new EnhancedSyncManager();