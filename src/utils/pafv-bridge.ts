import type { PAFVState, Plane, LATCHAxis } from '../types/pafv';

/**
 * React PAFV Bridge Client for native synchronization
 * Handles debounced messaging, sequence IDs, and coordinate batch updates
 * Connects React PAFV state changes to native SuperGridView rendering
 */
export class PAFVBridge {
    private sequenceId: UInt64 = 0;
    private debounceTimer: number | null = null;
    private readonly debounceInterval = 16; // 60fps limit (16ms)

    // Performance monitoring
    private messageCount = 0;
    private totalLatency = 0;
    private lastMessageTime = 0;

    // Batched updates
    private pendingAxisUpdate: AxisMappingUpdate | null = null;
    private pendingCoordinates: CoordinateBatch[] = [];

    constructor() {
        this.log('PAFVBridge initialized');
        this.setupBridgeAvailabilityCheck();
    }

    // MARK: - Bridge Availability

    private setupBridgeAvailabilityCheck(): void {
        if (typeof window === 'undefined') {
            this.warn('PAFVBridge: Running in non-browser environment');
            return;
        }

        if (!(window as any)._isometryBridge?.pafv) {
            this.warn('PAFVBridge: Native bridge not available, will queue messages');

            // Listen for bridge ready event
            window.addEventListener('isometry-bridge-ready', () => {
                this.log('PAFVBridge: Native bridge became available');
                this.flushPendingMessages();
            });
        }
    }

    private get isNativeBridgeAvailable(): boolean {
        return !!(window as any)._isometryBridge?.pafv;
    }

    private flushPendingMessages(): void {
        if (this.pendingAxisUpdate) {
            this.sendAxisMappingUpdateImmediate(this.pendingAxisUpdate);
            this.pendingAxisUpdate = null;
        }

        if (this.pendingCoordinates.length > 0) {
            this.sendCoordinateBatch([...this.pendingCoordinates]);
            this.pendingCoordinates = [];
        }
    }

    // MARK: - Axis Mapping Updates

    /**
     * Send React AxisMapping changes to native ViewConfig
     * Debounced to prevent bridge flooding during rapid axis drag operations
     */
    public sendAxisMappingUpdate(state: PAFVState): void {
        const update: AxisMappingUpdate = {
            mappings: state.mappings.map(mapping => ({
                plane: mapping.plane,
                axis: mapping.axis,
                facet: mapping.facet
            })),
            viewMode: state.viewMode,
            sequenceId: this.getNextSequenceId(),
            timestamp: Date.now()
        };

        // Store for potential queuing if bridge not available
        this.pendingAxisUpdate = update;

        // Cancel existing debounce timer
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
        }

        // Debounce rapid axis changes
        this.debounceTimer = window.setTimeout(() => {
            this.sendAxisMappingUpdateImmediate(update);
            this.debounceTimer = null;
            this.pendingAxisUpdate = null;
        }, this.debounceInterval);
    }

    private async sendAxisMappingUpdateImmediate(update: AxisMappingUpdate): Promise<void> {
        if (!this.isNativeBridgeAvailable) {
            this.warn('PAFVBridge: Axis mapping update queued (bridge not available)');
            return;
        }

        const startTime = performance.now();

        try {
            const result = await (window as any)._isometryBridge.pafv.updateAxisMapping(
                update.mappings,
                update.viewMode,
                update.sequenceId
            );

            const latency = performance.now() - startTime;
            this.trackPerformance(latency);

            this.debug(`Axis mapping update successful: sequenceId=${update.sequenceId}, latency=${latency.toFixed(2)}ms`);

            // Verify sequence ID was processed
            if (result.sequenceId !== update.sequenceId) {
                this.warn(`Sequence ID mismatch: sent=${update.sequenceId}, received=${result.sequenceId}`);
            }

        } catch (error) {
            const latency = performance.now() - startTime;
            this.error('Axis mapping update failed:', error);
            this.trackPerformance(latency, true);

            // On error, could implement retry logic here
        }
    }

    // MARK: - Viewport Updates

    /**
     * Send D3 zoom/pan state to native coordinate system
     * Real-time updates without debouncing for smooth viewport sync
     */
    public sendViewportUpdate(
        zoomLevel: number,
        panOffsetX: number,
        panOffsetY: number
    ): void {
        if (!this.isNativeBridgeAvailable) {
            this.debug('PAFVBridge: Viewport update skipped (bridge not available)');
            return;
        }

        const sequenceId = this.getNextSequenceId();

        // Use requestAnimationFrame for smooth visual updates
        requestAnimationFrame(async () => {
            const startTime = performance.now();

            try {
                await (window as any)._isometryBridge.pafv.updateViewport(
                    zoomLevel,
                    panOffsetX,
                    panOffsetY,
                    sequenceId
                );

                const latency = performance.now() - startTime;
                this.trackPerformance(latency);

                this.debug(`Viewport update successful: zoom=${zoomLevel.toFixed(2)}, pan=(${panOffsetX.toFixed(1)}, ${panOffsetY.toFixed(1)}), latency=${latency.toFixed(2)}ms`);

            } catch (error) {
                const latency = performance.now() - startTime;
                this.error('Viewport update failed:', error);
                this.trackPerformance(latency, true);
            }
        });
    }

    // MARK: - Coordinate Synchronization

    /**
     * Batch send GridCellData positions for native rendering
     * Debounced and batched to prevent bridge flooding with coordinate updates
     */
    public sendCoordinateUpdate(nodeId: string, d3X: number, d3Y: number): void {
        const coordinate: CoordinateBatch = {
            nodeId,
            d3X,
            d3Y,
            sequenceId: this.getNextSequenceId()
        };

        // Add to batch
        this.pendingCoordinates.push(coordinate);

        // Batch coordinates and send after short delay
        if (this.debounceTimer === null) {
            this.debounceTimer = window.setTimeout(() => {
                this.sendCoordinateBatch([...this.pendingCoordinates]);
                this.pendingCoordinates = [];
                this.debounceTimer = null;
            }, this.debounceInterval);
        }
    }

    /**
     * Send batch coordinate updates to native
     */
    public sendCoordinateBatch(coordinates: CoordinateBatch[]): void {
        if (coordinates.length === 0) return;

        if (!this.isNativeBridgeAvailable) {
            this.warn(`PAFVBridge: ${coordinates.length} coordinate updates queued (bridge not available)`);
            return;
        }

        const batchSequenceId = this.getNextSequenceId();

        requestAnimationFrame(async () => {
            const startTime = performance.now();

            try {
                // Convert to native format
                const nativeCoordinates = coordinates.map(coord => ({
                    nodeId: coord.nodeId,
                    x: coord.d3X,
                    y: coord.d3Y
                }));

                const result = await (window as any)._isometryBridge.pafv.syncCoordinates(
                    nativeCoordinates,
                    batchSequenceId
                );

                const latency = performance.now() - startTime;
                this.trackPerformance(latency);

                this.debug(`Coordinate batch sync successful: ${result.processedCount} coordinates, latency=${latency.toFixed(2)}ms`);

            } catch (error) {
                const latency = performance.now() - startTime;
                this.error('Coordinate batch sync failed:', error);
                this.trackPerformance(latency, true);

                // Re-queue coordinates for retry
                this.pendingCoordinates.push(...coordinates);
            }
        });
    }

    // MARK: - Sequence ID Management

    private getNextSequenceId(): UInt64 {
        this.sequenceId++;

        // Handle overflow (though unlikely in practice)
        if (this.sequenceId > Number.MAX_SAFE_INTEGER) {
            this.sequenceId = 1;
            this.warn('PAFVBridge: Sequence ID overflow, reset to 1');
        }

        return this.sequenceId;
    }

    // MARK: - Performance Monitoring

    private trackPerformance(latency: number, isError: boolean = false): void {
        if (!isError) {
            this.messageCount++;
            this.totalLatency += latency;
        }

        // Log performance warning if latency is high
        if (latency > 5) { // 5ms threshold
            this.warn(`High bridge latency detected: ${latency.toFixed(2)}ms`);
        }

        this.lastMessageTime = Date.now();
    }

    /**
     * Get bridge performance statistics
     */
    public getPerformanceStats(): BridgePerformanceStats {
        const avgLatency = this.messageCount > 0 ? this.totalLatency / this.messageCount : 0;
        const timeSinceLastMessage = Date.now() - this.lastMessageTime;

        return {
            messageCount: this.messageCount,
            averageLatency: avgLatency,
            lastMessageAge: timeSinceLastMessage,
            currentSequenceId: this.sequenceId,
            isConnected: this.isNativeBridgeAvailable,
            pendingAxisUpdate: this.pendingAxisUpdate !== null,
            pendingCoordinates: this.pendingCoordinates.length
        };
    }

    // MARK: - Error Boundary Integration

    /**
     * Handle React error boundary failures gracefully
     * Prevents bridge communication errors from breaking the entire app
     */
    public handleBridgeError(error: Error, errorInfo: any): void {
        this.error('PAFVBridge: React error boundary triggered', error, errorInfo);

        // Clear pending operations to prevent further errors
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        this.pendingAxisUpdate = null;
        this.pendingCoordinates = [];

        // Could send error report to native for debugging
        if (this.isNativeBridgeAvailable) {
            try {
                // Would implement native error reporting here if needed
            } catch {
                // Ignore errors in error handling to prevent infinite loops
            }
        }
    }

    // MARK: - Cleanup

    /**
     * Clean up resources when component unmounts
     */
    public dispose(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        this.pendingAxisUpdate = null;
        this.pendingCoordinates = [];

        this.log('PAFVBridge disposed');
    }

    // MARK: - Logging

    private log(message: string): void {
        console.log(`[PAFVBridge] ${message}`);
    }

    private debug(message: string): void {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[PAFVBridge] ${message}`);
        }
    }

    private warn(message: string): void {
        console.warn(`[PAFVBridge] ${message}`);
    }

    private error(message: string, ...args: any[]): void {
        console.error(`[PAFVBridge] ${message}`, ...args);
    }
}

// MARK: - Types

type UInt64 = number; // TypeScript doesn't have true 64-bit ints

interface AxisMappingUpdate {
    mappings: {
        plane: Plane;
        axis: LATCHAxis;
        facet: string;
    }[];
    viewMode: 'grid' | 'list';
    sequenceId: UInt64;
    timestamp: number;
}

interface CoordinateBatch {
    nodeId: string;
    d3X: number;
    d3Y: number;
    sequenceId: UInt64;
}

export interface BridgePerformanceStats {
    messageCount: number;
    averageLatency: number;
    lastMessageAge: number;
    currentSequenceId: UInt64;
    isConnected: boolean;
    pendingAxisUpdate: boolean;
    pendingCoordinates: number;
}

// MARK: - Singleton Instance

/**
 * Singleton PAFVBridge instance for global use
 * Import this to use the bridge from React components
 */
export const pafvBridge = new PAFVBridge();