import Foundation
import Vapor

/// HTTP controller for Filter operations and LATCH DSL
struct FiltersController: RouteCollection {

    func boot(routes: RoutesBuilder) throws {
        let filters = routes.grouped("filters")

        // Filter operations
        filters.post("compile", use: compileFilter)
        filters.post("execute", use: executeFilter)
        filters.get("schema", use: getFilterSchema)

        // Common filters
        filters.get("common", ":filterType", use: applyCommonFilter)
    }

    // MARK: - Route Handlers

    /// POST /api/v1/filters/compile - Compile LATCH DSL expression
    func compileFilter(req: Request) async throws -> CompileFilterResponse {
        let request = try req.content.decode(CompileFilterRequest.self)

        do {
            let compiledFilter = try await req.filterService.compileFilter(expression: request.expression)
            return CompileFilterResponse(
                success: true,
                compiledFilter: compiledFilter,
                error: nil
            )
        } catch {
            return CompileFilterResponse(
                success: false,
                compiledFilter: nil,
                error: error.localizedDescription
            )
        }
    }

    /// POST /api/v1/filters/execute - Execute compiled filter
    func executeFilter(req: Request) async throws -> ExecuteFilterResponse {
        let request = try req.content.decode(ExecuteFilterRequest.self)

        let startTime = Date()

        // If filter is provided as string, compile it first
        let filter: CompiledFilter
        if let compiledFilter = request.compiledFilter {
            filter = compiledFilter
        } else if let expression = request.expression {
            filter = try await req.filterService.compileFilter(expression: expression)
        } else {
            throw Abort(.badRequest, reason: "Either 'expression' or 'compiledFilter' must be provided")
        }

        let nodes = try await req.filterService.executeFilter(
            filter,
            limit: request.limit,
            offset: request.offset
        )

        let executionTime = Date().timeIntervalSince(startTime)

        return ExecuteFilterResponse(
            nodes: nodes.map(NodeSummaryDTO.init),
            compiledSQL: filter.sqlQuery,
            executionTime: executionTime,
            resultCount: nodes.count,
            pagination: PaginationInfo(
                limit: request.limit ?? nodes.count,
                offset: request.offset ?? 0,
                total: nodes.count, // Note: This is approximate for filtered results
                hasMore: false // Would need additional query to determine
            )
        )
    }

    /// GET /api/v1/filters/schema - Get filter field schema
    func getFilterSchema(req: Request) async throws -> FilterSchemaResponse {
        let schema = await req.filterService.getFilterSchema()
        return FilterSchemaResponse(schema)
    }

    /// GET /api/v1/filters/common/:filterType - Apply common filter
    func applyCommonFilter(req: Request) async throws -> CommonFilterResponse {
        guard let filterTypeParam = req.parameters.get("filterType") else {
            throw Abort(.badRequest, reason: "Missing filter type parameter")
        }

        guard let filterType = CommonFilterType(rawValue: filterTypeParam.lowercased()) else {
            let validTypes = CommonFilterType.allCases.map(\.rawValue).joined(separator: ", ")
            throw Abort(.badRequest, reason: "Invalid filter type. Valid types: \(validTypes)")
        }

        let nodes = try await req.filterService.applyCommonFilter(filterType)

        return CommonFilterResponse(
            filterType: filterTypeParam,
            nodes: nodes.map(NodeSummaryDTO.init),
            resultCount: nodes.count
        )
    }
}

// MARK: - Request/Response Models

/// Request to compile a LATCH DSL expression
struct CompileFilterRequest: Content {
    let expression: String
}

/// Response from filter compilation
struct CompileFilterResponse: Content {
    let success: Bool
    let compiledFilter: CompiledFilter?
    let error: String?
}

/// Request to execute a filter
struct ExecuteFilterRequest: Content {
    let expression: String?
    let compiledFilter: CompiledFilter?
    let limit: Int?
    let offset: Int?
}

/// Response from filter execution
struct ExecuteFilterResponse: Content {
    let nodes: [NodeSummaryDTO]
    let compiledSQL: String
    let executionTime: TimeInterval
    let resultCount: Int
    let pagination: PaginationInfo
}

/// Response for filter schema
struct FilterSchemaResponse: Content {
    let location: LocationFieldsDTO
    let alphabet: AlphabetFieldsDTO
    let time: TimeFieldsDTO
    let category: CategoryFieldsDTO
    let hierarchy: HierarchyFieldsDTO

    init(_ schema: FilterSchema) {
        self.location = LocationFieldsDTO(schema.location)
        self.alphabet = AlphabetFieldsDTO(schema.alphabet)
        self.time = TimeFieldsDTO(schema.time)
        self.category = CategoryFieldsDTO(schema.category)
        self.hierarchy = HierarchyFieldsDTO(schema.hierarchy)
    }
}

/// Response for common filters
struct CommonFilterResponse: Content {
    let filterType: String
    let nodes: [NodeSummaryDTO]
    let resultCount: Int
}

// MARK: - Schema DTOs

struct LocationFieldsDTO: Content {
    let latitude: String
    let longitude: String
    let locationName: String
    let locationAddress: String

    init(_ fields: LocationFields) {
        self.latitude = fields.latitude.rawValue
        self.longitude = fields.longitude.rawValue
        self.locationName = fields.locationName.rawValue
        self.locationAddress = fields.locationAddress.rawValue
    }
}

struct AlphabetFieldsDTO: Content {
    let name: String
    let content: String
    let summary: String

    init(_ fields: AlphabetFields) {
        self.name = fields.name.rawValue
        self.content = fields.content.rawValue
        self.summary = fields.summary.rawValue
    }
}

struct TimeFieldsDTO: Content {
    let created: String
    let modified: String
    let due: String
    let completed: String
    let eventStart: String
    let eventEnd: String

    init(_ fields: TimeFields) {
        self.created = fields.created.rawValue
        self.modified = fields.modified.rawValue
        self.due = fields.due.rawValue
        self.completed = fields.completed.rawValue
        self.eventStart = fields.eventStart.rawValue
        self.eventEnd = fields.eventEnd.rawValue
    }
}

struct CategoryFieldsDTO: Content {
    let nodeType: String
    let folder: String
    let tags: String
    let status: String

    init(_ fields: CategoryFields) {
        self.nodeType = fields.nodeType.rawValue
        self.folder = fields.folder.rawValue
        self.tags = fields.tags.rawValue
        self.status = fields.status.rawValue
    }
}

struct HierarchyFieldsDTO: Content {
    let priority: String
    let importance: String
    let sortOrder: String

    init(_ fields: HierarchyFields) {
        self.priority = fields.priority.rawValue
        self.importance = fields.importance.rawValue
        self.sortOrder = fields.sortOrder.rawValue
    }
}