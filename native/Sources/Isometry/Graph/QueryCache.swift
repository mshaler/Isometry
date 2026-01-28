import Foundation

/// Cache entry with timestamp and TTL support
public struct CacheEntry<T>: Sendable where T: Sendable {
    public let data: T
    public let timestamp: Date
    public let ttl: TimeInterval

    public init(data: T, timestamp: Date = Date(), ttl: TimeInterval) {
        self.data = data
        self.timestamp = timestamp
        self.ttl = ttl
    }

    /// Check if this cache entry is still valid
    public var isValid: Bool {
        Date().timeIntervalSince(timestamp) < ttl
    }

    /// Get remaining time before expiry
    public var timeToExpiry: TimeInterval {
        max(0, ttl - Date().timeIntervalSince(timestamp))
    }
}

/// Configuration options for query cache
public struct QueryCacheOptions {
    public let defaultTTL: TimeInterval
    public let maxSize: Int
    public let cleanupInterval: TimeInterval

    public init(
        defaultTTL: TimeInterval = 300, // 5 minutes
        maxSize: Int = 100,
        cleanupInterval: TimeInterval = 60 // 1 minute
    ) {
        self.defaultTTL = defaultTTL
        self.maxSize = maxSize
        self.cleanupInterval = cleanupInterval
    }

    /// Preset for graph queries (longer TTL due to computation cost)
    public static let graphQueries = QueryCacheOptions(
        defaultTTL: 600, // 10 minutes
        maxSize: 200,
        cleanupInterval: 120 // 2 minutes
    )

    /// Preset for UI queries (shorter TTL for responsiveness)
    public static let uiQueries = QueryCacheOptions(
        defaultTTL: 60, // 1 minute
        maxSize: 50,
        cleanupInterval: 30 // 30 seconds
    )
}

/// Thread-safe query result cache with TTL and automatic cleanup
/// Implements caching patterns from CardBoard v1/v2 graph service
public actor QueryCache {
    private var cache: [String: AnyCacheEntry] = [:]
    private let options: QueryCacheOptions
    private var cleanupTask: Task<Void, Never>?

    public init(options: QueryCacheOptions = QueryCacheOptions()) {
        self.options = options
        Task { await startPeriodicCleanup() }
    }

    deinit {
        cleanupTask?.cancel()
    }

    // MARK: - Cache Operations

    /// Get cached value if available and valid
    public func get<T: Sendable>(key: String, as type: T.Type) -> T? {
        guard let entry = cache[key] else { return nil }

        if entry.isValid {
            return entry.data as? T
        } else {
            // Remove expired entry
            cache.removeValue(forKey: key)
            return nil
        }
    }

    /// Store value in cache with custom TTL
    public func set<T: Sendable>(_ value: T, for key: String, ttl: TimeInterval? = nil) {
        let effectiveTTL = ttl ?? options.defaultTTL
        let entry = AnyCacheEntry(data: value, ttl: effectiveTTL)

        // Evict oldest entries if at capacity
        if cache.count >= options.maxSize {
            evictOldestEntries(count: cache.count - options.maxSize + 1)
        }

        cache[key] = entry
    }

    /// Remove specific cache entry
    public func remove(key: String) {
        cache.removeValue(forKey: key)
    }

    /// Clear all cache entries matching pattern
    public func invalidate(pattern: String) {
        let regex: NSRegularExpression
        do {
            regex = try NSRegularExpression(pattern: pattern)
        } catch {
            // If pattern is invalid, treat as literal string
            cache.removeValue(forKey: pattern)
            return
        }

        let keysToRemove = cache.keys.filter { key in
            let range = NSRange(location: 0, length: key.utf16.count)
            return regex.firstMatch(in: key, range: range) != nil
        }

        for key in keysToRemove {
            cache.removeValue(forKey: key)
        }
    }

    /// Clear all cache entries
    public func clear() {
        cache.removeAll()
    }

    /// Get or compute cached value
    public func getOrCompute<T: Sendable>(
        key: String,
        ttl: TimeInterval? = nil,
        compute: () async throws -> T
    ) async throws -> T {
        // Check for existing valid cache entry
        if let cached: T = get(key: key, as: T.self) {
            return cached
        }

        // Compute new value
        let result = try await compute()

        // Cache the result
        set(result, for: key, ttl: ttl)

        return result
    }

    /// Get or compute cached value with async computation
    public func getOrComputeAsync<T: Sendable>(
        key: String,
        ttl: TimeInterval? = nil,
        compute: @Sendable () async throws -> T
    ) async throws -> T {
        // Check for existing valid cache entry
        if let cached: T = get(key: key, as: T.self) {
            return cached
        }

        // Compute new value
        let result = try await compute()

        // Cache the result
        set(result, for: key, ttl: ttl)

        return result
    }

    // MARK: - Cache Statistics

    /// Get current cache statistics
    public func getStats() -> CacheStats {
        let totalEntries = cache.count
        let validEntries = cache.values.filter(\.isValid).count
        let expiredEntries = totalEntries - validEntries

        let totalMemoryEstimate = cache.values.reduce(0) { total, entry in
            total + estimateMemoryUsage(of: entry.data)
        }

        return CacheStats(
            totalEntries: totalEntries,
            validEntries: validEntries,
            expiredEntries: expiredEntries,
            hitRate: 0.0, // Would need hit tracking for accurate rate
            estimatedMemoryBytes: totalMemoryEstimate
        )
    }

    /// Get cache entries grouped by TTL ranges
    public func getExpiryAnalysis() -> [String: Int] {
        var analysis: [String: Int] = [:]
        let now = Date()

        for entry in cache.values {
            let timeLeft = entry.ttl - now.timeIntervalSince(entry.timestamp)

            let bucket: String
            if timeLeft <= 0 {
                bucket = "expired"
            } else if timeLeft <= 60 {
                bucket = "expiring_soon" // < 1 minute
            } else if timeLeft <= 300 {
                bucket = "short_term" // < 5 minutes
            } else {
                bucket = "long_term" // >= 5 minutes
            }

            analysis[bucket, default: 0] += 1
        }

        return analysis
    }

    // MARK: - Key Generation Utilities

    /// Generate cache key from query name and parameters
    public static func createKey(queryName: String, parameters: [String: Any]) -> String {
        let sortedParams = parameters.keys.sorted().compactMap { key -> String? in
            guard let value = parameters[key] else { return nil }

            // Convert value to string representation
            let stringValue: String
            if let data = value as? Data {
                stringValue = data.base64EncodedString()
            } else if let codable = value as? (any Codable) {
                // Best effort to serialize Codable types
                if let jsonData = try? JSONEncoder().encode(QueryCacheAnyCodable(codable)),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    stringValue = jsonString
                } else {
                    stringValue = String(describing: value)
                }
            } else {
                stringValue = String(describing: value)
            }

            return "\(key)=\(stringValue)"
        }

        let paramString = sortedParams.joined(separator: "&")
        return "\(queryName)?\(paramString)"
    }

    /// Generate cache key with hash for long parameter lists
    public static func createHashedKey(queryName: String, parameters: [String: Any]) -> String {
        let fullKey = createKey(queryName: queryName, parameters: parameters)

        // If key is too long, hash the parameters
        if fullKey.count > 200 {
            let paramString = parameters.keys.sorted().compactMap { key -> String? in
                guard let value = parameters[key] else { return nil }
                return "\(key)=\(value)"
            }.joined(separator: "&")

            let hash = paramString.hash
            return "\(queryName)#\(abs(hash))"
        }

        return fullKey
    }

    // MARK: - Private Methods

    private func evictOldestEntries(count: Int) {
        // Sort by timestamp and remove oldest entries
        let sortedKeys = cache.keys.sorted { key1, key2 in
            let timestamp1 = cache[key1]?.timestamp ?? Date.distantPast
            let timestamp2 = cache[key2]?.timestamp ?? Date.distantPast
            return timestamp1 < timestamp2
        }

        for key in sortedKeys.prefix(count) {
            cache.removeValue(forKey: key)
        }
    }

    private func cleanupExpired() {
        let keysToRemove = cache.compactMap { (key, entry) in
            entry.isValid ? nil : key
        }

        for key in keysToRemove {
            cache.removeValue(forKey: key)
        }
    }

    private func startPeriodicCleanup() {
        cleanupTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(options.cleanupInterval * 1_000_000_000))

                if !Task.isCancelled {
                    cleanupExpired()
                }
            }
        }
    }

    private func estimateMemoryUsage(of value: any Sendable) -> Int {
        // Rough memory estimation
        switch value {
        case is String:
            return (value as! String).utf8.count
        case is Data:
            return (value as! Data).count
        case is [Any]:
            return (value as! [Any]).count * 8 // Rough estimate
        default:
            return MemoryLayout.size(ofValue: value)
        }
    }
}

/// Cache statistics for monitoring and optimization
public struct CacheStats: Sendable {
    public let totalEntries: Int
    public let validEntries: Int
    public let expiredEntries: Int
    public let hitRate: Double
    public let estimatedMemoryBytes: Int

    public init(totalEntries: Int, validEntries: Int, expiredEntries: Int, hitRate: Double, estimatedMemoryBytes: Int) {
        self.totalEntries = totalEntries
        self.validEntries = validEntries
        self.expiredEntries = expiredEntries
        self.hitRate = hitRate
        self.estimatedMemoryBytes = estimatedMemoryBytes
    }

    /// Memory usage in megabytes
    public var estimatedMemoryMB: Double {
        Double(estimatedMemoryBytes) / (1024 * 1024)
    }

    /// Cache efficiency as a percentage
    public var efficiency: Double {
        totalEntries > 0 ? Double(validEntries) / Double(totalEntries) * 100 : 0
    }
}

/// Helper for encoding arbitrary Codable values
private struct QueryCacheAnyCodable: Codable {
    let value: any Codable

    init(_ value: any Codable) {
        self.value = value
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let string = value as? String {
            try container.encode(string)
        } else if let int = value as? Int {
            try container.encode(int)
        } else if let double = value as? Double {
            try container.encode(double)
        } else if let bool = value as? Bool {
            try container.encode(bool)
        } else {
            // Fallback to string representation
            try container.encode(String(describing: value))
        }
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Could not decode value")
            )
        }
    }
}

// MARK: - Singleton Caches for Common Use Cases

/// Shared cache instance for graph queries
public let graphQueryCache = QueryCache(options: .graphQueries)

/// Shared cache instance for UI queries
public let uiQueryCache = QueryCache(options: .uiQueries)

/// Type-erased cache entry for storing different types
private struct AnyCacheEntry {
    let data: any Sendable
    let timestamp: Date
    let ttl: TimeInterval

    init<T: Sendable>(data: T, timestamp: Date = Date(), ttl: TimeInterval) {
        self.data = data
        self.timestamp = timestamp
        self.ttl = ttl
    }

    var isValid: Bool {
        Date().timeIntervalSince(timestamp) < ttl
    }

    var timeToExpiry: TimeInterval {
        max(0, ttl - Date().timeIntervalSince(timestamp))
    }
}

// MARK: - Convenience Extensions

extension QueryCache {
    /// Cache a database query result
    public func cacheQuery<T: Sendable>(
        _ queryName: String,
        parameters: [String: Any] = [:],
        ttl: TimeInterval? = nil,
        execute: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        let key = QueryCache.createKey(queryName: queryName, parameters: parameters)
        return try await getOrComputeAsync(key: key, ttl: ttl, compute: execute)
    }

    /// Cache a graph computation result
    public func cacheGraphQuery<T: Sendable>(
        _ queryName: String,
        nodeId: String,
        additionalParams: [String: Any] = [:],
        ttl: TimeInterval? = nil,
        execute: @Sendable () async throws -> T
    ) async throws -> T {
        var params = additionalParams
        params["nodeId"] = nodeId
        let key = QueryCache.createKey(queryName: queryName, parameters: params)
        return try await getOrComputeAsync(key: key, ttl: ttl, compute: execute)
    }
}