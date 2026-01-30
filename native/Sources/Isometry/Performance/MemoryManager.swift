import Foundation
import os.log
import os.signpost
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// Advanced memory management system for rendering optimization
/// Provides pool allocation, garbage collection, and memory pressure monitoring
@available(iOS 14.0, macOS 11.0, *)
public actor AdvancedMemoryManager {

    // MARK: - Types

    public struct MemoryMetrics {
        public let totalAllocated: UInt64
        public let currentUsage: UInt64
        public let poolUtilization: Double
        public let activeBuffers: Int
        public let fragmentationRatio: Double
        public let gcCollections: Int
        public let leaksDetected: Int

        public var memoryEfficiency: Double {
            return poolUtilization * (1.0 - fragmentationRatio)
        }

        public var isHealthy: Bool {
            return poolUtilization < 0.8 && fragmentationRatio < 0.3 && leaksDetected == 0
        }
    }

    public struct AllocationStrategy {
        public let enablePooling: Bool
        public let gcThreshold: Double
        public let compactionInterval: TimeInterval
        public let leakDetectionEnabled: Bool

        public static let performance = AllocationStrategy(
            enablePooling: true,
            gcThreshold: 0.8,
            compactionInterval: 30.0,
            leakDetectionEnabled: false
        )

        public static let balanced = AllocationStrategy(
            enablePooling: true,
            gcThreshold: 0.7,
            compactionInterval: 60.0,
            leakDetectionEnabled: true
        )

        public static let conservative = AllocationStrategy(
            enablePooling: true,
            gcThreshold: 0.5,
            compactionInterval: 15.0,
            leakDetectionEnabled: true
        )
    }

    // MARK: - Memory Buffer Management

    private class ManagedBuffer {
        let data: NSMutableData
        let identifier: String
        let allocatedAt: Date
        var lastAccessed: Date
        var accessCount: Int
        let size: Int

        init(size: Int, identifier: String) {
            self.data = NSMutableData(length: size) ?? NSMutableData()
            self.identifier = identifier
            self.size = size
            self.allocatedAt = Date()
            self.lastAccessed = Date()
            self.accessCount = 1
        }

        func markAccessed() {
            lastAccessed = Date()
            accessCount += 1
        }

        var ageInSeconds: TimeInterval {
            return Date().timeIntervalSince(allocatedAt)
        }

        var idleTime: TimeInterval {
            return Date().timeIntervalSince(lastAccessed)
        }
    }

    // MARK: - Properties

    private let poolSize: UInt64
    private var strategy: AllocationStrategy
    private let logger = os.Logger(subsystem: "Isometry", category: "AdvancedMemoryManager")
    private let signposter = OSSignposter(logger: os.Logger(subsystem: "Isometry", category: "MemoryPerformance"))

    // Buffer management
    private var bufferPool: [String: ManagedBuffer] = [:]
    private var freeBlocks: [Int: [NSMutableData]] = [:]
    private var currentUsage: UInt64 = 0

    // Performance tracking
    private var allocationCount: Int = 0
    private var deallocationCount: Int = 0
    private var gcCollections: Int = 0
    private var leaksDetected: Int = 0
    private var lastCompaction: Date = Date()

    // Memory pressure monitoring
    private var memoryPressureObserver: NSObjectProtocol?

    // MARK: - Initialization

    public init(poolSize: UInt64, strategy: AllocationStrategy = .balanced) {
        self.poolSize = poolSize
        self.strategy = strategy

        Task {
            await setupMemoryPressureMonitoring()
        }

        // Start periodic compaction
        if strategy.compactionInterval > 0 {
            Task {
                await startPeriodicCompaction()
            }
        }

        logger.info("AdvancedMemoryManager initialized: \(poolSize / 1024 / 1024)MB pool, strategy: \(strategy.enablePooling ? "pooled" : "direct")")
    }

    deinit {
        if let observer = memoryPressureObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Public Memory Management API

    /// Allocate memory buffer with identifier for tracking
    public func allocateBuffer(size: Int, identifier: String, type: String = "default") async -> NSMutableData? {
        let state = signposter.beginInterval("allocateBuffer")
        defer { signposter.endInterval("allocateBuffer", state) }

        // Check if we already have this buffer
        if let existing = bufferPool[identifier] {
            existing.markAccessed()
            logger.debug("Reused buffer: \(identifier)")
            return existing.data
        }

        // Check memory pressure
        if currentUsage + UInt64(size) > poolSize {
            await performGarbageCollection()

            if currentUsage + UInt64(size) > poolSize {
                logger.warning("Allocation failed for \(identifier): insufficient memory (\(self.currentUsage + UInt64(size)) > \(self.poolSize))")
                return nil
            }
        }

        // Try to reuse from free blocks if pooling enabled
        if strategy.enablePooling, let buffer = reuseBuffer(size: size) {
            let managed = ManagedBuffer(size: size, identifier: identifier)
            managed.data.setData(buffer as Data)
            bufferPool[identifier] = managed
            currentUsage += UInt64(size)
            allocationCount += 1

            logger.debug("Reused pooled buffer: \(identifier) (\(size) bytes)")
            return managed.data
        }

        // Allocate new buffer
        let managed = ManagedBuffer(size: size, identifier: identifier)
        if managed.data.length == 0 {
            logger.error("Failed to allocate \(size) bytes for \(identifier)")
            return nil
        }

        bufferPool[identifier] = managed
        currentUsage += UInt64(size)
        allocationCount += 1

        logger.debug("Allocated buffer: \(identifier) (\(size) bytes)")
        return managed.data
    }

    /// Release buffer by identifier
    public func releaseBuffer(identifier: String) async {
        guard let buffer = bufferPool.removeValue(forKey: identifier) else {
            logger.warning("Attempted to release unknown buffer: \(identifier)")
            return
        }

        currentUsage -= UInt64(buffer.size)
        deallocationCount += 1

        // Add to free blocks if pooling enabled
        if strategy.enablePooling {
            addToFreeBlocks(buffer: buffer.data, size: buffer.size)
        }

        logger.debug("Released buffer: \(identifier) (\(buffer.size) bytes)")
    }

    /// Force garbage collection
    public func forceGarbageCollection() async {
        let state = signposter.beginInterval("forceGarbageCollection")
        defer { signposter.endInterval("forceGarbageCollection", state) }

        await performGarbageCollection()
        logger.info("Forced garbage collection completed")
    }

    /// Compact memory and defragment
    public func compactMemory() async {
        let state = signposter.beginInterval("compactMemory")
        defer { signposter.endInterval("compactMemory", state) }

        let beforeUsage = currentUsage
        let beforeBuffers = bufferPool.count

        // Remove idle buffers
        let idleThreshold: TimeInterval = 120.0 // 2 minutes
        let idleBuffers = bufferPool.filter { $0.value.idleTime > idleThreshold }

        for (identifier, _) in idleBuffers {
            await releaseBuffer(identifier: identifier)
        }

        // Clear fragmented free blocks
        let totalFreeBlocks = freeBlocks.values.flatMap { $0 }.count
        if totalFreeBlocks > 50 {
            freeBlocks.removeAll()
        }

        lastCompaction = Date()
        logger.info("Memory compaction: \(beforeBuffers) -> \(self.bufferPool.count) buffers, \(beforeUsage / 1024 / 1024) -> \(self.currentUsage / 1024 / 1024)MB")
    }

    /// Release unused buffers to free memory
    public func releaseUnusedBuffers() async {
        let state = signposter.beginInterval("releaseUnusedBuffers")
        defer { signposter.endInterval("releaseUnusedBuffers", state) }

        // Release least recently used buffers
        let sortedBuffers = bufferPool.sorted { $0.value.lastAccessed < $1.value.lastAccessed }
        let toRemove = sortedBuffers.prefix(sortedBuffers.count / 3)

        for (identifier, _) in toRemove {
            await releaseBuffer(identifier: identifier)
        }

        logger.info("Released \(toRemove.count) unused buffers")
    }

    /// Get current memory metrics
    public func getMemoryMetrics() async -> MemoryMetrics {
        let fragmentationRatio = calculateFragmentationRatio()

        return MemoryMetrics(
            totalAllocated: poolSize,
            currentUsage: currentUsage,
            poolUtilization: Double(currentUsage) / Double(poolSize),
            activeBuffers: bufferPool.count,
            fragmentationRatio: fragmentationRatio,
            gcCollections: gcCollections,
            leaksDetected: leaksDetected
        )
    }

    /// Detect memory leaks by analyzing buffer usage patterns
    public func detectMemoryLeaks() async -> [String] {
        guard strategy.leakDetectionEnabled else { return [] }

        var suspiciousBuffers: [String] = []

        for (identifier, buffer) in bufferPool {
            // Check for buffers that are old but never accessed
            if buffer.ageInSeconds > 300 && buffer.accessCount <= 1 {
                suspiciousBuffers.append(identifier)
                logger.warning("Potential memory leak detected: \(identifier) (age: \(buffer.ageInSeconds)s, accesses: \(buffer.accessCount))")
            }

            // Check for buffers with extremely high access counts (possible retain cycles)
            if buffer.accessCount > 1000 && buffer.idleTime > 30 {
                suspiciousBuffers.append(identifier)
                logger.warning("Potential retain cycle detected: \(identifier) (accesses: \(buffer.accessCount), idle: \(buffer.idleTime)s)")
            }
        }

        if !suspiciousBuffers.isEmpty {
            leaksDetected = suspiciousBuffers.count
        }

        return suspiciousBuffers
    }

    /// Update memory management strategy
    public func updateStrategy(_ newStrategy: AllocationStrategy) async {
        strategy = newStrategy
        logger.info("Memory strategy updated: gc threshold \(newStrategy.gcThreshold), compaction interval \(newStrategy.compactionInterval)s")
    }

    /// Get memory pressure level (0.0 - 1.0)
    public func getMemoryPressure() async -> Double {
        return Double(currentUsage) / Double(poolSize)
    }

    /// Get current usage in bytes
    public func getCurrentUsage() async -> UInt64 {
        return currentUsage
    }

    /// Update pool size (resize memory pool)
    public func updatePoolSize(_ newSize: UInt64) async {
        logger.info("Updating pool size: \(self.poolSize / 1024 / 1024)MB -> \(newSize / 1024 / 1024)MB")

        // If shrinking pool, ensure we're within new limits
        if newSize < currentUsage {
            await performGarbageCollection()

            if newSize < currentUsage {
                logger.warning("Cannot shrink pool below current usage (\(self.currentUsage) bytes)")
                return
            }
        }
    }

    // MARK: - Private Implementation

    private func setupMemoryPressureMonitoring() async {
        // Monitor system memory pressure notifications (iOS/macOS specific)
        #if os(iOS)
        memoryPressureObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task {
                await self?.handleMemoryPressure()
            }
        }
        #elseif os(macOS)
        // macOS doesn't have equivalent memory warning notifications
        // Could monitor system memory pressure via dispatch source instead
        #endif
    }

    private func handleMemoryPressure() async {
        logger.warning("System memory pressure detected - performing emergency cleanup")
        await performGarbageCollection()
        await compactMemory()
    }

    private func startPeriodicCompaction() async {
        Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(strategy.compactionInterval * 1_000_000_000))

                if Date().timeIntervalSince(lastCompaction) >= strategy.compactionInterval {
                    await compactMemory()
                }
            }
        }
    }

    private func performGarbageCollection() async {
        let beforeUsage = currentUsage
        let pressureThreshold = strategy.gcThreshold

        if Double(currentUsage) / Double(poolSize) < pressureThreshold {
            return // No GC needed
        }

        gcCollections += 1
        let pressure = Double(currentUsage) / Double(poolSize)
        logger.info("Starting garbage collection (pressure: \(String(format: "%.1f%%", pressure * 100)))")

        // Remove buffers based on usage patterns
        let now = Date()
        var toRemove: [String] = []

        for (identifier, buffer) in bufferPool {
            // Remove buffers idle for more than 5 minutes during GC
            if now.timeIntervalSince(buffer.lastAccessed) > 300 {
                toRemove.append(identifier)
            }
        }

        for identifier in toRemove {
            await releaseBuffer(identifier: identifier)
        }

        // Clear excessive free blocks
        if freeBlocks.values.flatMap({ $0 }).count > 20 {
            freeBlocks.removeAll()
        }

        let afterUsage = currentUsage
        logger.info("GC completed: \(beforeUsage / 1024 / 1024)MB -> \(afterUsage / 1024 / 1024)MB (freed \((beforeUsage - afterUsage) / 1024 / 1024)MB)")
    }

    private func reuseBuffer(size: Int) -> NSMutableData? {
        // Find best fit from free blocks
        let sizeClass = getSizeClass(size: size)

        if let freeList = freeBlocks[sizeClass], !freeList.isEmpty {
            return freeBlocks[sizeClass]?.removeFirst()
        }

        // Try larger size classes
        for largerClass in freeBlocks.keys.sorted().filter({ $0 > sizeClass }) {
            if let freeList = freeBlocks[largerClass], !freeList.isEmpty {
                return freeBlocks[largerClass]?.removeFirst()
            }
        }

        return nil
    }

    private func addToFreeBlocks(buffer: NSMutableData, size: Int) {
        let sizeClass = getSizeClass(size: size)

        if freeBlocks[sizeClass] == nil {
            freeBlocks[sizeClass] = []
        }

        // Limit free blocks to prevent excessive memory overhead
        if freeBlocks[sizeClass]!.count < 10 {
            freeBlocks[sizeClass]!.append(buffer)
        }
    }

    private func getSizeClass(size: Int) -> Int {
        // Round up to nearest power of 2 for size classification
        return 1 << (32 - size.leadingZeroBitCount)
    }

    private func calculateFragmentationRatio() -> Double {
        let totalFreeBlocks = freeBlocks.values.flatMap { $0 }.count
        let totalBuffers = bufferPool.count + totalFreeBlocks

        return totalBuffers > 0 ? Double(totalFreeBlocks) / Double(totalBuffers) : 0.0
    }
}

// MARK: - Memory Pool Statistics

public struct MemoryPoolStatistics {
    public let allocations: Int
    public let deallocations: Int
    public let activeBuffers: Int
    public let freeBlocks: Int
    public let hitRate: Double // Buffer reuse rate
    public let efficiency: Double // Memory utilization efficiency

    public init(
        allocations: Int,
        deallocations: Int,
        activeBuffers: Int,
        freeBlocks: Int,
        hitRate: Double,
        efficiency: Double
    ) {
        self.allocations = allocations
        self.deallocations = deallocations
        self.activeBuffers = activeBuffers
        self.freeBlocks = freeBlocks
        self.hitRate = hitRate
        self.efficiency = efficiency
    }
}

// MARK: - Memory Pool Statistics

extension AdvancedMemoryManager {
    /// Get detailed memory pool statistics
    public func getPoolStatistics() async -> MemoryPoolStatistics {
        let freeBlockCount = freeBlocks.values.flatMap { $0 }.count
        let hitRate = allocationCount > 0 ? Double(allocationCount - deallocationCount) / Double(allocationCount) : 0.0
        let efficiency = Double(currentUsage) / Double(poolSize)

        return MemoryPoolStatistics(
            allocations: allocationCount,
            deallocations: deallocationCount,
            activeBuffers: bufferPool.count,
            freeBlocks: freeBlockCount,
            hitRate: hitRate,
            efficiency: efficiency
        )
    }
}