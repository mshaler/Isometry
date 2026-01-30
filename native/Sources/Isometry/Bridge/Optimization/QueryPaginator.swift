/**
 * QueryPaginator Actor for WebView Bridge Optimization
 *
 * Implements async query execution with cursor-based pagination using SQL LIMIT/OFFSET
 * with stable ordering, and integration with BinarySerializer for efficient transport.
 * Uses proper Swift concurrency patterns with actor isolation for thread safety.
 */

import Foundation
import GRDB
import OSLog

/// Represents a pagination cursor for stable pagination
public struct PaginationCursor: Sendable, Codable {
    public let value: String
    public let direction: PaginationDirection
    public let timestamp: TimeInterval

    public init(value: String, direction: PaginationDirection = .forward, timestamp: TimeInterval = Date().timeIntervalSince1970) {
        self.value = value
        self.direction = direction
        self.timestamp = timestamp
    }
}

/// Direction for pagination
public enum PaginationDirection: String, Sendable, Codable {
    case forward
    case backward
}

/// Configuration for paginated queries
public struct PaginatedQuery: Sendable {
    public let sql: String
    public let parameters: [DatabaseValue]
    public let limit: Int
    public let cursor: PaginationCursor?
    public let orderBy: String

    public init(sql: String, parameters: [DatabaseValue] = [], limit: Int = 50, cursor: PaginationCursor? = nil, orderBy: String = "id ASC") {
        self.sql = sql
        self.parameters = parameters
        self.limit = min(limit, 50) // Enforce 50 record maximum
        self.cursor = cursor
        self.orderBy = orderBy
    }
}

/// Result of a paginated query
public struct PaginatedResult<T: Sendable>: Sendable {
    public let data: [T]
    public let nextCursor: PaginationCursor?
    public let previousCursor: PaginationCursor?
    public let hasMore: Bool
    public let hasPrevious: Bool
    public let pageInfo: PageInfo

    public init(data: [T], nextCursor: PaginationCursor?, previousCursor: PaginationCursor?, hasMore: Bool, hasPrevious: Bool, pageInfo: PageInfo) {
        self.data = data
        self.nextCursor = nextCursor
        self.previousCursor = previousCursor
        self.hasMore = hasMore
        self.hasPrevious = hasPrevious
        self.pageInfo = pageInfo
    }
}

/// Page information metadata
public struct PageInfo: Sendable {
    public let currentPage: Int
    public let pageSize: Int
    public let isFirstPage: Bool
    public let isLastPage: Bool

    public init(currentPage: Int, pageSize: Int, isFirstPage: Bool, isLastPage: Bool) {
        self.currentPage = currentPage
        self.pageSize = pageSize
        self.isFirstPage = isFirstPage
        self.isLastPage = isLastPage
    }
}

/// Configuration options for QueryPaginator
public struct PaginatorOptions: Sendable {
    public let defaultPageSize: Int
    public let maxPageSize: Int
    public let enableEstimation: Bool
    public let cursorField: String
    public let cacheTimeout: TimeInterval

    public init(
        defaultPageSize: Int = 50,
        maxPageSize: Int = 50,
        enableEstimation: Bool = false,
        cursorField: String = "id",
        cacheTimeout: TimeInterval = 300 // 5 minutes
    ) {
        self.defaultPageSize = min(defaultPageSize, 50)
        self.maxPageSize = min(maxPageSize, 50)
        self.enableEstimation = enableEstimation
        self.cursorField = cursorField
        self.cacheTimeout = cacheTimeout
    }
}

/// Performance metrics for pagination operations
public struct PaginatorMetrics: Sendable {
    public let totalQueries: Int
    public let totalRecords: Int
    public let averagePageSize: Double
    public let averageQueryTime: TimeInterval
    public let cacheHits: Int
    public let cursorErrors: Int

    public init(totalQueries: Int, totalRecords: Int, averagePageSize: Double, averageQueryTime: TimeInterval, cacheHits: Int, cursorErrors: Int) {
        self.totalQueries = totalQueries
        self.totalRecords = totalRecords
        self.averagePageSize = averagePageSize
        self.averageQueryTime = averageQueryTime
        self.cacheHits = cacheHits
        self.cursorErrors = cursorErrors
    }
}

/// QueryPaginator actor for handling large dataset pagination
public actor QueryPaginator {
    // MARK: - Properties

    private let database: DatabaseQueue
    private let options: PaginatorOptions
    private let logger = Logger(subsystem: "IsometryBridge", category: "QueryPaginator")

    // Metrics tracking
    private var totalQueries = 0
    private var totalRecords = 0
    private var queryTimes: [TimeInterval] = []
    private var pageSizes: [Int] = []
    private var cacheHits = 0
    private var cursorErrors = 0

    // Cursor validation cache
    private var cursorCache: [String: (timestamp: TimeInterval, valid: Bool)] = [:]

    // MARK: - Initialization

    public init(database: DatabaseQueue, options: PaginatorOptions = PaginatorOptions()) {
        self.database = database
        self.options = options
    }

    // MARK: - Public Methods

    /// Execute a paginated query with cursor-based pagination
    public func executePaginatedQuery<T: FetchableRecord & Sendable>(
        query: PaginatedQuery,
        recordType: T.Type
    ) async throws -> PaginatedResult<T> {
        let startTime = CACurrentMediaTime()

        defer {
            let queryTime = CACurrentMediaTime() - startTime
            updateMetrics(pageSize: query.limit, queryTime: queryTime)
        }

        do {
            // Build paginated SQL
            let paginatedSQL = buildPaginatedSQL(query: query)

            // Execute query with one extra record to check for more pages
            let results = try await database.read { db in
                try recordType.fetchAll(db, sql: paginatedSQL.sql, arguments: StatementArguments(paginatedSQL.parameters))
            }

            // Process results and generate pagination info
            let paginationResult = try processPaginatedResults(
                results: results,
                originalQuery: query,
                queryTime: CACurrentMediaTime() - startTime
            )

            updateTotalQueries()

            return paginationResult

        } catch {
            incrementCursorErrors()
            throw QueryPaginatorError.paginationFailed(underlying: error)
        }
    }

    /// Create a paginated query from standard parameters
    public func createPaginatedQuery(
        sql: String,
        parameters: [DatabaseValue] = [],
        limit: Int? = nil,
        cursor: PaginationCursor? = nil,
        orderBy: String? = nil
    ) -> PaginatedQuery {
        let actualLimit = min(limit ?? options.defaultPageSize, options.maxPageSize)
        let actualOrderBy = orderBy ?? "\(options.cursorField) ASC"

        return PaginatedQuery(
            sql: sql,
            parameters: parameters,
            limit: actualLimit,
            cursor: cursor,
            orderBy: actualOrderBy
        )
    }

    /// Generate a stable cursor from a record
    public func generateCursor<T: FetchableRecord>(
        from record: T,
        direction: PaginationDirection = .forward
    ) throws -> PaginationCursor {
        // Use reflection to get cursor field value
        let mirror = Mirror(reflecting: record)

        for child in mirror.children {
            if let label = child.label, label == options.cursorField {
                if let value = child.value as? CustomStringConvertible {
                    return PaginationCursor(
                        value: value.description,
                        direction: direction,
                        timestamp: Date().timeIntervalSince1970
                    )
                }
            }
        }

        throw QueryPaginatorError.cursorFieldNotFound(field: options.cursorField)
    }

    /// Validate cursor stability and freshness
    public func validateCursor(_ cursor: PaginationCursor) async throws -> Bool {
        let cacheKey = "\(cursor.value)_\(cursor.direction.rawValue)_\(cursor.timestamp)"

        // Check cache first
        if let cached = cursorCache[cacheKey],
           Date().timeIntervalSince1970 - cached.timestamp < options.cacheTimeout {
            if cached.valid {
                incrementCacheHits()
            }
            return cached.valid
        }

        do {
            // Verify cursor exists in database
            let exists = try await database.read { [self] db in
                try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM (SELECT \(self.options.cursorField) FROM nodes WHERE \(self.options.cursorField) = ?)", arguments: [cursor.value]) ?? 0 > 0
            }

            // Cache the result
            cursorCache[cacheKey] = (timestamp: Date().timeIntervalSince1970, valid: exists)

            // Clean old cache entries
            cleanCursorCache()

            return exists
        } catch {
            incrementCursorErrors()
            return false
        }
    }

    /// Get next page using cursor
    public func getNextPage<T: FetchableRecord & Sendable>(
        from currentResult: PaginatedResult<T>,
        originalQuery: PaginatedQuery,
        recordType: T.Type
    ) async throws -> PaginatedResult<T>? {
        guard currentResult.hasMore, let nextCursor = currentResult.nextCursor else {
            return nil
        }

        let nextQuery = PaginatedQuery(
            sql: originalQuery.sql,
            parameters: originalQuery.parameters,
            limit: originalQuery.limit,
            cursor: nextCursor,
            orderBy: originalQuery.orderBy
        )

        return try await executePaginatedQuery(query: nextQuery, recordType: recordType)
    }

    /// Get previous page using cursor
    public func getPreviousPage<T: FetchableRecord & Sendable>(
        from currentResult: PaginatedResult<T>,
        originalQuery: PaginatedQuery,
        recordType: T.Type
    ) async throws -> PaginatedResult<T>? {
        guard currentResult.hasPrevious, let previousCursor = currentResult.previousCursor else {
            return nil
        }

        let prevQuery = PaginatedQuery(
            sql: originalQuery.sql,
            parameters: originalQuery.parameters,
            limit: originalQuery.limit,
            cursor: previousCursor,
            orderBy: originalQuery.orderBy
        )

        return try await executePaginatedQuery(query: prevQuery, recordType: recordType)
    }

    /// Get current paginator metrics
    public func getMetrics() -> PaginatorMetrics {
        let averagePageSize = pageSizes.isEmpty ? 0.0 : Double(pageSizes.reduce(0, +)) / Double(pageSizes.count)
        let averageQueryTime = queryTimes.isEmpty ? 0.0 : queryTimes.reduce(0, +) / Double(queryTimes.count)

        return PaginatorMetrics(
            totalQueries: totalQueries,
            totalRecords: totalRecords,
            averagePageSize: averagePageSize,
            averageQueryTime: averageQueryTime,
            cacheHits: cacheHits,
            cursorErrors: cursorErrors
        )
    }

    /// Reset metrics (useful for testing)
    public func resetMetrics() {
        totalQueries = 0
        totalRecords = 0
        queryTimes = []
        pageSizes = []
        cacheHits = 0
        cursorErrors = 0
        cursorCache = [:]
    }

    /// Clear cursor cache
    public func clearCache() {
        cursorCache = [:]
    }

    // MARK: - Private Methods

    private func buildPaginatedSQL(query: PaginatedQuery) -> (sql: String, parameters: [DatabaseValue]) {
        var sql = query.sql
        var parameters = query.parameters

        // Add cursor condition if provided
        if let cursor = query.cursor {
            let comparisonOperator = cursor.direction == .forward ? ">" : "<"
            let cursorCondition = "\(options.cursorField) \(comparisonOperator) ?"

            if sql.lowercased().contains("where") {
                sql += " AND \(cursorCondition)"
            } else {
                sql += " WHERE \(cursorCondition)"
            }

            parameters.append(DatabaseValue.text(cursor.value))
        }

        // Add ordering (ensure consistent ordering for stable pagination)
        if !sql.lowercased().contains("order by") {
            sql += " ORDER BY \(query.orderBy)"
        }

        // Add limit (request one extra record to check for more pages)
        sql += " LIMIT \(query.limit + 1)"

        return (sql: sql, parameters: parameters)
    }

    private func processPaginatedResults<T: FetchableRecord & Sendable>(
        results: [T],
        originalQuery: PaginatedQuery,
        queryTime: TimeInterval
    ) throws -> PaginatedResult<T> {
        let hasMore = results.count > originalQuery.limit
        let data = hasMore ? Array(results.dropLast()) : results

        var nextCursor: PaginationCursor?
        var previousCursor: PaginationCursor?

        // Generate next cursor if there are more records
        if hasMore, let lastRecord = data.last {
            nextCursor = try generateCursor(from: lastRecord, direction: .forward)
        }

        // Generate previous cursor if this isn't the first page
        if originalQuery.cursor != nil, let firstRecord = data.first {
            previousCursor = try generateCursor(from: firstRecord, direction: .backward)
        }

        // Estimate current page number (rough approximation)
        let currentPage = originalQuery.cursor != nil ?
            max(Int(queryTime / (queryTimes.isEmpty ? 0.1 : queryTimes.reduce(0, +) / Double(queryTimes.count))) + 1, 1) : 1

        let pageInfo = PageInfo(
            currentPage: currentPage,
            pageSize: data.count,
            isFirstPage: originalQuery.cursor == nil,
            isLastPage: !hasMore
        )

        return PaginatedResult(
            data: data,
            nextCursor: nextCursor,
            previousCursor: previousCursor,
            hasMore: hasMore,
            hasPrevious: originalQuery.cursor != nil,
            pageInfo: pageInfo
        )
    }

    private func cleanCursorCache() {
        let now = Date().timeIntervalSince1970
        cursorCache = cursorCache.filter { _, entry in
            now - entry.timestamp < options.cacheTimeout
        }
    }

    private func updateMetrics(pageSize: Int, queryTime: TimeInterval) {
        totalRecords += pageSize

        // Keep last 100 measurements
        queryTimes.append(queryTime)
        pageSizes.append(pageSize)

        if queryTimes.count > 100 {
            queryTimes.removeFirst()
        }
        if pageSizes.count > 100 {
            pageSizes.removeFirst()
        }
    }

    private func updateTotalQueries() {
        totalQueries += 1
    }

    private func incrementCacheHits() {
        cacheHits += 1
    }

    private func incrementCursorErrors() {
        cursorErrors += 1
    }
}

// MARK: - Error Types

public enum QueryPaginatorError: Error {
    case paginationFailed(underlying: Error)
    case cursorFieldNotFound(field: String)
    case invalidCursor(reason: String)
}

// MARK: - Extensions

extension QueryPaginatorError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .paginationFailed(let error):
            return "Pagination query failed: \(error.localizedDescription)"
        case .cursorFieldNotFound(let field):
            return "Cursor field '\(field)' not found in record"
        case .invalidCursor(let reason):
            return "Invalid cursor: \(reason)"
        }
    }
}