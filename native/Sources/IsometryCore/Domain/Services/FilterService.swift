import Foundation

/// Business logic service for Filter operations and LATCH DSL compilation
/// Handles complex filtering logic that spans multiple dimensions
public actor FilterService {
    private let nodeRepository: NodeRepository

    /// Initialize with required dependencies
    /// - Parameter nodeRepository: Repository for node data access
    public init(nodeRepository: NodeRepository) {
        self.nodeRepository = nodeRepository
    }

    // MARK: - LATCH Filter Compilation

    /// Compile a LATCH DSL expression into executable filter
    /// - Parameter expression: LATCH DSL string (e.g., "category:work AND created:>2024-01-01")
    /// - Returns: Compiled filter that can be executed
    /// - Throws: ServiceError on parsing or compilation errors
    public func compileFilter(expression: String) async throws -> CompiledFilter {
        let tokens = try tokenize(expression: expression)
        let ast = try parse(tokens: tokens)
        let sqlQuery = try generateSQL(from: ast)

        return CompiledFilter(
            expression: expression,
            sqlQuery: sqlQuery,
            parameters: extractParameters(from: ast),
            compiledAt: Date()
        )
    }

    /// Execute a compiled filter and return matching nodes
    /// - Parameters:
    ///   - filter: Previously compiled filter
    ///   - limit: Maximum number of results
    ///   - offset: Number of results to skip
    /// - Returns: Array of matching nodes
    /// - Throws: ServiceError on execution errors
    public func executeFilter(
        _ filter: CompiledFilter,
        limit: Int? = nil,
        offset: Int? = nil
    ) async throws -> [Node] {
        // Execute the compiled SQL query
        let results = try await nodeRepository.executeSQL(filter.sqlQuery, arguments: filter.parameters)

        // Apply pagination if specified
        var paginatedResults = results
        if let offset = offset, offset > 0 {
            paginatedResults = Array(results.dropFirst(offset))
        }
        if let limit = limit, limit > 0 {
            paginatedResults = Array(paginatedResults.prefix(limit))
        }

        return paginatedResults
    }

    /// Get available filter fields and their types for schema introspection
    /// - Returns: Schema describing available LATCH filter fields
    public func getFilterSchema() async -> FilterSchema {
        return FilterSchema(
            location: LocationFields(
                latitude: FieldType.number,
                longitude: FieldType.number,
                locationName: FieldType.text,
                locationAddress: FieldType.text
            ),
            alphabet: AlphabetFields(
                name: FieldType.text,
                content: FieldType.text,
                summary: FieldType.text
            ),
            time: TimeFields(
                created: FieldType.date,
                modified: FieldType.date,
                due: FieldType.date,
                completed: FieldType.date,
                eventStart: FieldType.date,
                eventEnd: FieldType.date
            ),
            category: CategoryFields(
                nodeType: FieldType.text,
                folder: FieldType.text,
                tags: FieldType.array,
                status: FieldType.text
            ),
            hierarchy: HierarchyFields(
                priority: FieldType.number,
                importance: FieldType.number,
                sortOrder: FieldType.number
            )
        )
    }

    // MARK: - Preset Filter Management

    /// Save a frequently used filter as a preset
    /// - Parameters:
    ///   - name: Human-readable name for the preset
    ///   - expression: LATCH DSL expression
    ///   - description: Optional description
    /// - Returns: The created filter preset
    /// - Throws: ServiceError on validation errors
    public func saveFilterPreset(
        name: String,
        expression: String,
        description: String? = nil
    ) async throws -> FilterPreset {
        // Validate the expression by compiling it
        let compiled = try await compileFilter(expression: expression)

        let preset = FilterPreset(
            id: UUID().uuidString,
            name: name,
            expression: expression,
            description: description,
            compiledFilter: compiled,
            createdAt: Date(),
            lastUsedAt: nil
        )

        // Note: In a full implementation, this would be persisted
        // For now, we just return the preset
        return preset
    }

    /// Apply common filters with predefined logic
    /// - Parameter filterType: Type of common filter to apply
    /// - Returns: Array of matching nodes
    /// - Throws: ServiceError on execution errors
    public func applyCommonFilter(_ filterType: CommonFilterType) async throws -> [Node] {
        let expression: String

        switch filterType {
        case .today:
            expression = "created:today"
        case .thisWeek:
            expression = "created:>-7days"
        case .overdue:
            expression = "due:<now AND completed:null"
        case .highPriority:
            expression = "priority:>=8"
        case .important:
            expression = "importance:>=8"
        case .incomplete:
            expression = "completed:null AND due:!null"
        case .hasLocation:
            expression = "location:!null"
        case .recentlyModified:
            expression = "modified:>-24hours"
        }

        let filter = try await compileFilter(expression: expression)
        return try await executeFilter(filter)
    }

    // MARK: - Advanced Filtering

    /// Create a complex multi-dimensional filter
    /// - Parameter criteria: Multi-dimensional filter criteria
    /// - Returns: Array of matching nodes
    /// - Throws: ServiceError on compilation or execution errors
    public func filterByMultipleCriteria(_ criteria: MultiDimensionalFilter) async throws -> [Node] {
        var expressions: [String] = []

        // Location criteria
        if let location = criteria.location {
            if let bounds = location.bounds {
                expressions.append("latitude:>=\(bounds.south) AND latitude:<=\(bounds.north)")
                expressions.append("longitude:>=\(bounds.west) AND longitude:<=\(bounds.east)")
            }
            if let radius = location.radiusFilter {
                // Simplified distance filter (would need proper geographic calculation)
                expressions.append("latitude:>=\(radius.centerLat - radius.radiusKm/111) AND latitude:<=\(radius.centerLat + radius.radiusKm/111)")
                expressions.append("longitude:>=\(radius.centerLng - radius.radiusKm/111) AND longitude:<=\(radius.centerLng + radius.radiusKm/111)")
            }
        }

        // Alphabet (text) criteria
        if let alphabet = criteria.alphabet {
            if let searchTerm = alphabet.searchTerm {
                expressions.append("content:contains('\(searchTerm)') OR name:contains('\(searchTerm)')")
            }
            if let namePattern = alphabet.namePattern {
                expressions.append("name:matches('\(namePattern)')")
            }
        }

        // Time criteria
        if let time = criteria.time {
            if let start = time.createdAfter {
                expressions.append("created:>='\(formatDate(start))'")
            }
            if let end = time.createdBefore {
                expressions.append("created:<='\(formatDate(end))'")
            }
            if let dueBefore = time.dueBefore {
                expressions.append("due:<='\(formatDate(dueBefore))'")
            }
        }

        // Category criteria
        if let category = criteria.category {
            if let nodeTypes = category.nodeTypes, !nodeTypes.isEmpty {
                let typeList = nodeTypes.map { "'\($0)'" }.joined(separator: ",")
                expressions.append("type:in(\(typeList))")
            }
            if let tags = category.tags, !tags.isEmpty {
                let tagExpressions = tags.map { "tags:contains('\($0)')" }
                expressions.append("(\(tagExpressions.joined(separator: " OR ")))")
            }
            if let folder = category.folder {
                expressions.append("folder:'\(folder)'")
            }
        }

        // Hierarchy criteria
        if let hierarchy = criteria.hierarchy {
            if let minPriority = hierarchy.minPriority {
                expressions.append("priority:>=\(minPriority)")
            }
            if let maxPriority = hierarchy.maxPriority {
                expressions.append("priority:<=\(maxPriority)")
            }
            if let minImportance = hierarchy.minImportance {
                expressions.append("importance:>=\(minImportance)")
            }
        }

        // Combine all expressions
        guard !expressions.isEmpty else {
            // Return all nodes if no criteria specified
            return try await nodeRepository.getAll(limit: criteria.limit, offset: criteria.offset, includeDeleted: false)
        }

        let combinedExpression = expressions.joined(separator: " AND ")
        let filter = try await compileFilter(expression: combinedExpression)
        return try await executeFilter(filter, limit: criteria.limit, offset: criteria.offset)
    }

    // MARK: - Private Implementation

    /// Tokenize LATCH DSL expression into tokens
    private func tokenize(expression: String) throws -> [Token] {
        var tokens: [Token] = []
        var current = ""
        var i = expression.startIndex

        while i < expression.endIndex {
            let char = expression[i]

            switch char {
            case " ", "\t", "\n":
                if !current.isEmpty {
                    tokens.append(try parseToken(current))
                    current = ""
                }
            case "(":
                if !current.isEmpty {
                    tokens.append(try parseToken(current))
                    current = ""
                }
                tokens.append(.leftParen)
            case ")":
                if !current.isEmpty {
                    tokens.append(try parseToken(current))
                    current = ""
                }
                tokens.append(.rightParen)
            case "\"", "'":
                // Handle quoted strings
                if !current.isEmpty {
                    tokens.append(try parseToken(current))
                    current = ""
                }
                let quote = char
                i = expression.index(after: i)
                var quoted = ""
                while i < expression.endIndex && expression[i] != quote {
                    quoted.append(expression[i])
                    i = expression.index(after: i)
                }
                tokens.append(.string(quoted))
            default:
                current.append(char)
            }

            i = expression.index(after: i)
        }

        if !current.isEmpty {
            tokens.append(try parseToken(current))
        }

        return tokens
    }

    /// Parse a string token into appropriate token type
    private func parseToken(_ token: String) throws -> Token {
        let upper = token.uppercased()

        switch upper {
        case "AND":
            return .and
        case "OR":
            return .or
        case "NOT":
            return .not
        default:
            if token.contains(":") {
                let parts = token.split(separator: ":", maxSplits: 1)
                guard parts.count == 2 else {
                    throw ServiceError.invalidData("Invalid field:value format: \(token)")
                }
                return .fieldValue(String(parts[0]), String(parts[1]))
            } else {
                return .identifier(token)
            }
        }
    }

    /// Parse tokens into an abstract syntax tree
    private func parse(tokens: [Token]) throws -> FilterAST {
        var index = 0
        return try parseExpression(tokens: tokens, index: &index)
    }

    /// Parse expression with operator precedence
    private func parseExpression(tokens: [Token], index: inout Int) throws -> FilterAST {
        var left = try parseTerm(tokens: tokens, index: &index)

        while index < tokens.count {
            guard case .or = tokens[index] else { break }
            index += 1
            let right = try parseTerm(tokens: tokens, index: &index)
            left = .or(left, right)
        }

        return left
    }

    /// Parse term (AND has higher precedence than OR)
    private func parseTerm(tokens: [Token], index: inout Int) throws -> FilterAST {
        var left = try parseFactor(tokens: tokens, index: &index)

        while index < tokens.count {
            guard case .and = tokens[index] else { break }
            index += 1
            let right = try parseFactor(tokens: tokens, index: &index)
            left = .and(left, right)
        }

        return left
    }

    /// Parse factor (highest precedence)
    private func parseFactor(tokens: [Token], index: inout Int) throws -> FilterAST {
        guard index < tokens.count else {
            throw ServiceError.invalidData("Unexpected end of expression")
        }

        switch tokens[index] {
        case .not:
            index += 1
            let expr = try parseFactor(tokens: tokens, index: &index)
            return .not(expr)
        case .leftParen:
            index += 1
            let expr = try parseExpression(tokens: tokens, index: &index)
            guard index < tokens.count, case .rightParen = tokens[index] else {
                throw ServiceError.invalidData("Missing closing parenthesis")
            }
            index += 1
            return expr
        case .fieldValue(let field, let value):
            index += 1
            return .fieldValue(field, value)
        default:
            throw ServiceError.invalidData("Unexpected token: \(tokens[index])")
        }
    }

    /// Generate SQL query from AST
    private func generateSQL(from ast: FilterAST) throws -> String {
        let whereClause = try generateWhereClause(from: ast)
        return "SELECT * FROM nodes WHERE \(whereClause) AND deleted_at IS NULL"
    }

    /// Generate WHERE clause from AST
    private func generateWhereClause(from ast: FilterAST) throws -> String {
        switch ast {
        case .and(let left, let right):
            return "(\(try generateWhereClause(from: left)) AND \(try generateWhereClause(from: right)))"
        case .or(let left, let right):
            return "(\(try generateWhereClause(from: left)) OR \(try generateWhereClause(from: right)))"
        case .not(let expr):
            return "NOT (\(try generateWhereClause(from: expr)))"
        case .fieldValue(let field, let value):
            return try generateFieldCondition(field: field, value: value)
        }
    }

    /// Generate SQL condition for field:value pair
    private func generateFieldCondition(field: String, value: String) throws -> String {
        // Map LATCH field names to database columns
        let columnName: String
        switch field.lowercased() {
        // Location
        case "latitude", "lat":
            columnName = "latitude"
        case "longitude", "lng", "lon":
            columnName = "longitude"
        case "location":
            return "(latitude IS NOT NULL AND longitude IS NOT NULL)"
        // Alphabet
        case "name", "title":
            columnName = "name"
        case "content":
            columnName = "content"
        case "summary":
            columnName = "summary"
        // Time
        case "created", "created_at":
            columnName = "created_at"
        case "modified", "modified_at":
            columnName = "modified_at"
        case "due", "due_at":
            columnName = "due_at"
        case "completed", "completed_at":
            columnName = "completed_at"
        case "event_start":
            columnName = "event_start"
        case "event_end":
            columnName = "event_end"
        // Category
        case "type", "node_type":
            columnName = "node_type"
        case "folder":
            columnName = "folder"
        case "tags":
            columnName = "tags"
        case "status":
            columnName = "status"
        // Hierarchy
        case "priority":
            columnName = "priority"
        case "importance":
            columnName = "importance"
        case "sort_order":
            columnName = "sort_order"
        default:
            throw ServiceError.invalidData("Unknown field: \(field)")
        }

        // Parse value operators
        if value.hasPrefix(">=") {
            let actualValue = String(value.dropFirst(2))
            return "\(columnName) >= '\(actualValue)'"
        } else if value.hasPrefix("<=") {
            let actualValue = String(value.dropFirst(2))
            return "\(columnName) <= '\(actualValue)'"
        } else if value.hasPrefix(">") {
            let actualValue = String(value.dropFirst(1))
            return "\(columnName) > '\(actualValue)'"
        } else if value.hasPrefix("<") {
            let actualValue = String(value.dropFirst(1))
            return "\(columnName) < '\(actualValue)'"
        } else if value.hasPrefix("!") {
            let actualValue = String(value.dropFirst(1))
            if actualValue == "null" {
                return "\(columnName) IS NOT NULL"
            } else {
                return "\(columnName) != '\(actualValue)'"
            }
        } else if value == "null" {
            return "\(columnName) IS NULL"
        } else if value.hasPrefix("contains(") && value.hasSuffix(")") {
            let searchTerm = String(value.dropFirst(9).dropLast(1))
            return "\(columnName) LIKE '%\(searchTerm)%'"
        } else {
            return "\(columnName) = '\(value)'"
        }
    }

    /// Extract parameters from AST (for prepared statements)
    private func extractParameters(from ast: FilterAST) -> [Any] {
        // For now, return empty array as we're using inline SQL
        // In production, would use parameterized queries
        return []
    }

    /// Format date for SQL
    private func formatDate(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: date)
    }
}

// MARK: - Supporting Types

/// Compiled filter ready for execution
public struct CompiledFilter: Codable, Sendable {
    public let expression: String
    public let sqlQuery: String
    public let parameters: [String] // Simplified - would need proper parameter types
    public let compiledAt: Date

    public init(expression: String, sqlQuery: String, parameters: [Any], compiledAt: Date) {
        self.expression = expression
        self.sqlQuery = sqlQuery
        self.parameters = parameters.map { "\($0)" } // Simplified conversion
        self.compiledAt = compiledAt
    }
}

/// Filter preset for commonly used filters
public struct FilterPreset: Codable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let expression: String
    public let description: String?
    public let compiledFilter: CompiledFilter
    public let createdAt: Date
    public let lastUsedAt: Date?

    public init(
        id: String,
        name: String,
        expression: String,
        description: String?,
        compiledFilter: CompiledFilter,
        createdAt: Date,
        lastUsedAt: Date?
    ) {
        self.id = id
        self.name = name
        self.expression = expression
        self.description = description
        self.compiledFilter = compiledFilter
        self.createdAt = createdAt
        self.lastUsedAt = lastUsedAt
    }
}

/// Multi-dimensional filter criteria
public struct MultiDimensionalFilter {
    public let location: LocationCriteria?
    public let alphabet: AlphabetCriteria?
    public let time: TimeCriteria?
    public let category: CategoryCriteria?
    public let hierarchy: HierarchyCriteria?
    public let limit: Int?
    public let offset: Int?

    public init(
        location: LocationCriteria? = nil,
        alphabet: AlphabetCriteria? = nil,
        time: TimeCriteria? = nil,
        category: CategoryCriteria? = nil,
        hierarchy: HierarchyCriteria? = nil,
        limit: Int? = nil,
        offset: Int? = nil
    ) {
        self.location = location
        self.alphabet = alphabet
        self.time = time
        self.category = category
        self.hierarchy = hierarchy
        self.limit = limit
        self.offset = offset
    }
}

public struct LocationCriteria {
    public let bounds: GeoBounds?
    public let radiusFilter: RadiusFilter?

    public init(bounds: GeoBounds? = nil, radiusFilter: RadiusFilter? = nil) {
        self.bounds = bounds
        self.radiusFilter = radiusFilter
    }
}

public struct GeoBounds {
    public let north: Double
    public let south: Double
    public let east: Double
    public let west: Double

    public init(north: Double, south: Double, east: Double, west: Double) {
        self.north = north
        self.south = south
        self.east = east
        self.west = west
    }
}

public struct RadiusFilter {
    public let centerLat: Double
    public let centerLng: Double
    public let radiusKm: Double

    public init(centerLat: Double, centerLng: Double, radiusKm: Double) {
        self.centerLat = centerLat
        self.centerLng = centerLng
        self.radiusKm = radiusKm
    }
}

public struct AlphabetCriteria {
    public let searchTerm: String?
    public let namePattern: String?

    public init(searchTerm: String? = nil, namePattern: String? = nil) {
        self.searchTerm = searchTerm
        self.namePattern = namePattern
    }
}

public struct TimeCriteria {
    public let createdAfter: Date?
    public let createdBefore: Date?
    public let modifiedAfter: Date?
    public let modifiedBefore: Date?
    public let dueBefore: Date?
    public let dueAfter: Date?

    public init(
        createdAfter: Date? = nil,
        createdBefore: Date? = nil,
        modifiedAfter: Date? = nil,
        modifiedBefore: Date? = nil,
        dueBefore: Date? = nil,
        dueAfter: Date? = nil
    ) {
        self.createdAfter = createdAfter
        self.createdBefore = createdBefore
        self.modifiedAfter = modifiedAfter
        self.modifiedBefore = modifiedBefore
        self.dueBefore = dueBefore
        self.dueAfter = dueAfter
    }
}

public struct CategoryCriteria {
    public let nodeTypes: [String]?
    public let tags: [String]?
    public let folder: String?
    public let status: String?

    public init(nodeTypes: [String]? = nil, tags: [String]? = nil, folder: String? = nil, status: String? = nil) {
        self.nodeTypes = nodeTypes
        self.tags = tags
        self.folder = folder
        self.status = status
    }
}

public struct HierarchyCriteria {
    public let minPriority: Int?
    public let maxPriority: Int?
    public let minImportance: Int?
    public let maxImportance: Int?

    public init(minPriority: Int? = nil, maxPriority: Int? = nil, minImportance: Int? = nil, maxImportance: Int? = nil) {
        self.minPriority = minPriority
        self.maxPriority = maxPriority
        self.minImportance = minImportance
        self.maxImportance = maxImportance
    }
}

/// Common filter types for quick access
public enum CommonFilterType: String, CaseIterable, Codable, Sendable {
    case today = "today"
    case thisWeek = "this_week"
    case overdue = "overdue"
    case highPriority = "high_priority"
    case important = "important"
    case incomplete = "incomplete"
    case hasLocation = "has_location"
    case recentlyModified = "recently_modified"
}

/// Filter schema for introspection
public struct FilterSchema: Codable, Sendable {
    public let location: LocationFields
    public let alphabet: AlphabetFields
    public let time: TimeFields
    public let category: CategoryFields
    public let hierarchy: HierarchyFields

    public init(location: LocationFields, alphabet: AlphabetFields, time: TimeFields, category: CategoryFields, hierarchy: HierarchyFields) {
        self.location = location
        self.alphabet = alphabet
        self.time = time
        self.category = category
        self.hierarchy = hierarchy
    }
}

public struct LocationFields: Codable, Sendable {
    public let latitude: FieldType
    public let longitude: FieldType
    public let locationName: FieldType
    public let locationAddress: FieldType

    public init(latitude: FieldType, longitude: FieldType, locationName: FieldType, locationAddress: FieldType) {
        self.latitude = latitude
        self.longitude = longitude
        self.locationName = locationName
        self.locationAddress = locationAddress
    }
}

public struct AlphabetFields: Codable, Sendable {
    public let name: FieldType
    public let content: FieldType
    public let summary: FieldType

    public init(name: FieldType, content: FieldType, summary: FieldType) {
        self.name = name
        self.content = content
        self.summary = summary
    }
}

public struct TimeFields: Codable, Sendable {
    public let created: FieldType
    public let modified: FieldType
    public let due: FieldType
    public let completed: FieldType
    public let eventStart: FieldType
    public let eventEnd: FieldType

    public init(created: FieldType, modified: FieldType, due: FieldType, completed: FieldType, eventStart: FieldType, eventEnd: FieldType) {
        self.created = created
        self.modified = modified
        self.due = due
        self.completed = completed
        self.eventStart = eventStart
        self.eventEnd = eventEnd
    }
}

public struct CategoryFields: Codable, Sendable {
    public let nodeType: FieldType
    public let folder: FieldType
    public let tags: FieldType
    public let status: FieldType

    public init(nodeType: FieldType, folder: FieldType, tags: FieldType, status: FieldType) {
        self.nodeType = nodeType
        self.folder = folder
        self.tags = tags
        self.status = status
    }
}

public struct HierarchyFields: Codable, Sendable {
    public let priority: FieldType
    public let importance: FieldType
    public let sortOrder: FieldType

    public init(priority: FieldType, importance: FieldType, sortOrder: FieldType) {
        self.priority = priority
        self.importance = importance
        self.sortOrder = sortOrder
    }
}

/// Field types for schema
public enum FieldType: String, Codable, Sendable {
    case text = "text"
    case number = "number"
    case date = "date"
    case array = "array"
    case boolean = "boolean"
}

/// Tokens for LATCH DSL parsing
private enum Token {
    case and
    case or
    case not
    case leftParen
    case rightParen
    case fieldValue(String, String)
    case identifier(String)
    case string(String)
}

/// Abstract syntax tree for LATCH filters
private indirect enum FilterAST {
    case and(FilterAST, FilterAST)
    case or(FilterAST, FilterAST)
    case not(FilterAST)
    case fieldValue(String, String)
}