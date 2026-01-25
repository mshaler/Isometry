import Foundation

/// Thread-safe cache for compiled query results
/// Provides fast lookup for repeated queries with same parameters
/// Key: SHA256 hash of SQL + parameters, Value: Query results
public final class QueryCache: @unchecked Sendable {
    public static let shared = QueryCache()

    private let cache = NSCache<NSString, CacheEntry>()
    private let lock = NSLock()
    private var invalidationListeners: [() -> Void] = []

    private init() {
        // 50MB memory limit
        cache.totalCostLimit = 50 * 1024 * 1024
        // Max 100 cached queries
        cache.countLimit = 100

        // Clear cache on memory pressure
        #if os(iOS)
        NotificationCenter.default.addObserver(
            forKey: UIApplication.didReceiveMemoryWarningNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.invalidate()
        }
        #endif
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Cache Operations

    /// Get cached results for a query
    /// - Parameter key: Cache key (typically SQL + parameters hash)
    /// - Returns: Cached results if available and not expired
    public func get<T>(_ key: String) -> [T]? {
        lock.lock()
        defer { lock.unlock() }

        guard let entry = cache.object(forKey: key as NSString) else {
            return nil
        }

        // Check if entry has expired (5 minute TTL)
        if Date().timeIntervalSince(entry.timestamp) > 300 {
            cache.removeObject(forKey: key as NSString)
            return nil
        }

        return entry.value as? [T]
    }

    /// Store query results in cache
    /// - Parameters:
    ///   - key: Cache key
    ///   - value: Results to cache
    ///   - cost: Estimated memory cost in bytes (optional)
    public func set<T>(_ key: String, value: [T], cost: Int = 0) {
        lock.lock()
        defer { lock.unlock() }

        let entry = CacheEntry(value: value as NSArray, timestamp: Date())
        let estimatedCost = cost > 0 ? cost : value.count * 200 // ~200 bytes per item estimate
        cache.setObject(entry, forKey: key as NSString, cost: estimatedCost)
    }

    /// Invalidate all cached queries
    /// Called after database writes to ensure cache coherency
    public func invalidate() {
        lock.lock()
        defer { lock.unlock() }

        cache.removeAllObjects()

        // Notify listeners
        for listener in invalidationListeners {
            listener()
        }
    }

    /// Invalidate a specific cache key
    public func invalidate(key: String) {
        lock.lock()
        defer { lock.unlock() }

        cache.removeObject(forKey: key as NSString)
    }

    /// Register a listener for cache invalidation events
    public func onInvalidate(_ handler: @escaping () -> Void) {
        lock.lock()
        defer { lock.unlock() }

        invalidationListeners.append(handler)
    }

    // MARK: - Key Generation

    /// Generate a cache key from SQL and parameters
    /// - Parameters:
    ///   - sql: SQL query string
    ///   - parameters: Query parameters
    /// - Returns: Unique cache key
    public static func cacheKey(sql: String, parameters: [Any] = []) -> String {
        var hasher = Hasher()
        hasher.combine(sql)

        for param in parameters {
            hasher.combine(String(describing: param))
        }

        return "query_\(hasher.finalize())"
    }
}

// MARK: - Cache Entry

private class CacheEntry: NSObject {
    let value: NSArray
    let timestamp: Date

    init(value: NSArray, timestamp: Date) {
        self.value = value
        self.timestamp = timestamp
    }
}

// MARK: - UIKit Notification Extension

#if os(iOS)
import UIKit

private extension NotificationCenter {
    func addObserver(
        forKey name: NSNotification.Name,
        object obj: Any?,
        queue: OperationQueue?,
        using block: @escaping (Notification) -> Void
    ) {
        addObserver(forName: name, object: obj, queue: queue, using: block)
    }
}
#endif
