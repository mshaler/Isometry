import Foundation

/// JSON importer with schema inference and Node mapping capabilities
/// Supports universal JSON data interchange with automatic type detection
public actor JSONImporter {
    private let database: IsometryDatabase

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - Public Interface

    /// Import JSON from file URL with schema inference
    public func importJSON(from fileURL: URL, folder: String? = nil) async throws -> ImportResult {
        let startTime = Date()

        guard fileURL.startAccessingSecurityScopedResource() else {
            throw JSONImportError.fileAccessDenied
        }
        defer { fileURL.stopAccessingSecurityScopedResource() }

        guard fileURL.pathExtension.lowercased() == "json" else {
            throw JSONImportError.unsupportedFormat(fileURL.pathExtension)
        }

        // Check file size for memory management (limit to 100MB)
        let fileAttributes = try FileManager.default.attributesOfItem(atPath: fileURL.path)
        let fileSize = fileAttributes[.size] as? Int64 ?? 0

        if fileSize > 100 * 1024 * 1024 { // 100MB limit
            return try await importLargeJSON(from: fileURL, folder: folder, startTime: startTime)
        } else {
            return try await importStandardJSON(from: fileURL, folder: folder, startTime: startTime)
        }
    }

    /// Import JSON from raw string data
    public func importJSONString(_ jsonString: String, filename: String = "string-data.json", folder: String? = nil) async throws -> ImportResult {
        let startTime = Date()

        guard let data = jsonString.data(using: .utf8) else {
            throw JSONImportError.invalidFormat("Unable to convert string to UTF-8 data")
        }

        return try await processJSONData(data, filename: filename, folder: folder, startTime: startTime)
    }

    // MARK: - Import Processing

    private func importStandardJSON(from fileURL: URL, folder: String?, startTime: Date) async throws -> ImportResult {
        do {
            let data = try Data(contentsOf: fileURL)
            return try await processJSONData(data, filename: fileURL.lastPathComponent, folder: folder, startTime: startTime)
        } catch {
            return ImportResult(
                imported: 0,
                failed: 1,
                nodes: [],
                errors: [ImportError.fileFailed(fileURL.lastPathComponent, error)]
            )
        }
    }

    private func importLargeJSON(from fileURL: URL, folder: String?, startTime: Date) async throws -> ImportResult {
        // For large files, use streaming approach
        do {
            return try await streamProcessJSONFile(fileURL, folder: folder, startTime: startTime)
        } catch {
            return ImportResult(
                imported: 0,
                failed: 1,
                nodes: [],
                errors: [ImportError.fileFailed(fileURL.lastPathComponent, error)]
            )
        }
    }

    private func processJSONData(_ data: Data, filename: String, folder: String?, startTime: Date) async throws -> ImportResult {
        // Parse JSON
        let jsonObject = try JSONSerialization.jsonObject(with: data, options: [])

        // Infer schema
        let schema = inferSchema(from: jsonObject, filename: filename)

        // Convert to nodes based on schema
        let conversionResult = try await convertToNodes(
            jsonObject,
            schema: schema,
            filename: filename,
            folder: folder
        )

        return ImportResult(
            imported: conversionResult.nodes.count,
            failed: conversionResult.errors.count,
            nodes: conversionResult.nodes,
            errors: conversionResult.errors
        )
    }

    private func streamProcessJSONFile(_ fileURL: URL, folder: String?, startTime: Date) async throws -> ImportResult {
        // For large files, attempt to parse as streaming array
        // This is a simplified streaming approach for arrays of objects

        let fileHandle = try FileHandle(forReadingFrom: fileURL)
        defer { fileHandle.closeFile() }

        var result = ImportResult()
        var buffer = Data()
        let chunkSize = 1024 * 1024 // 1MB chunks

        while true {
            let chunk = fileHandle.readData(ofLength: chunkSize)
            if chunk.isEmpty { break }

            buffer.append(chunk)

            // Try to extract complete JSON objects from buffer
            // This is a simplified implementation - real streaming would be more complex
            if let extractedObjects = try? extractCompleteJSONObjects(from: &buffer) {
                for jsonObject in extractedObjects {
                    do {
                        let schema = inferSchema(from: jsonObject, filename: fileURL.lastPathComponent)
                        let conversionResult = try await convertToNodes(
                            jsonObject,
                            schema: schema,
                            filename: fileURL.lastPathComponent,
                            folder: folder
                        )

                        result.nodes.append(contentsOf: conversionResult.nodes)
                        result.imported += conversionResult.nodes.count
                        result.errors.append(contentsOf: conversionResult.errors)
                        result.failed += conversionResult.errors.count
                    } catch {
                        result.failed += 1
                        result.errors.append(ImportError.fileFailed("stream object", error))
                    }
                }
            }
        }

        return result
    }

    private func extractCompleteJSONObjects(from buffer: inout Data) throws -> [Any]? {
        // Simplified JSON object extraction for streaming
        // In a real implementation, this would use a proper streaming JSON parser

        let string = String(data: buffer, encoding: .utf8) ?? ""
        let lines = string.components(separatedBy: .newlines)

        var objects: [Any] = []
        var newBuffer = Data()

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.hasPrefix("{") && trimmed.hasSuffix("}") {
                // Potential complete JSON object
                if let data = trimmed.data(using: .utf8),
                   let jsonObject = try? JSONSerialization.jsonObject(with: data, options: []) {
                    objects.append(jsonObject)
                } else {
                    // Not a complete object, add to new buffer
                    newBuffer.append(line.data(using: .utf8) ?? Data())
                    newBuffer.append("\n".data(using: .utf8) ?? Data())
                }
            } else if !trimmed.isEmpty {
                // Incomplete line, add to new buffer
                newBuffer.append(line.data(using: .utf8) ?? Data())
                newBuffer.append("\n".data(using: .utf8) ?? Data())
            }
        }

        buffer = newBuffer
        return objects.isEmpty ? nil : objects
    }

    // MARK: - Schema Inference

    /// Infer JSON schema and determine optimal Node mapping strategy
    public func inferSchema(from jsonObject: Any, filename: String) -> JSONSchema {
        let rootType = determineType(jsonObject)

        switch rootType {
        case .object:
            return inferObjectSchema(jsonObject as! [String: Any], filename: filename)
        case .array:
            return inferArraySchema(jsonObject as! [Any], filename: filename)
        default:
            return JSONSchema(
                type: rootType,
                filename: filename,
                rootStructure: .primitive,
                inferredMapping: .singleNode,
                properties: [:],
                arrayItemType: nil,
                estimatedNodeCount: 1,
                latchMappings: [:]
            )
        }
    }

    private func inferObjectSchema(_ object: [String: Any], filename: String) -> JSONSchema {
        var properties: [String: JSONSchema.PropertyInfo] = [:]
        var latchMappings: [String: JSONSchema.LATCHProperty] = [:]

        for (key, value) in object {
            let type = determineType(value)
            let sampleValue = getSampleValue(value)

            properties[key] = JSONSchema.PropertyInfo(
                type: type,
                required: true,
                sampleValue: sampleValue
            )

            // Detect potential LATCH mappings
            if let latchProperty = detectLATCHProperty(key: key, value: value) {
                latchMappings[key] = latchProperty
            }
        }

        return JSONSchema(
            type: .object,
            filename: filename,
            rootStructure: .object,
            inferredMapping: .singleNode,
            properties: properties,
            arrayItemType: nil,
            estimatedNodeCount: 1,
            latchMappings: latchMappings
        )
    }

    private func inferArraySchema(_ array: [Any], filename: String) -> JSONSchema {
        guard !array.isEmpty else {
            return JSONSchema(
                type: .array,
                filename: filename,
                rootStructure: .array,
                inferredMapping: .multipleNodes,
                properties: [:],
                arrayItemType: .null,
                estimatedNodeCount: 0,
                latchMappings: [:]
            )
        }

        // Analyze first few items to determine structure
        let sampleSize = min(array.count, 10)
        let samples = Array(array.prefix(sampleSize))

        let itemTypes = samples.map { determineType($0) }
        let dominantType = mostCommonType(itemTypes)

        var properties: [String: JSONSchema.PropertyInfo] = [:]
        var latchMappings: [String: JSONSchema.LATCHProperty] = [:]

        if dominantType == .object {
            // Analyze object properties across samples
            let objectSamples = samples.compactMap { $0 as? [String: Any] }
            let allKeys = Set(objectSamples.flatMap { $0.keys })

            for key in allKeys {
                let valuesForKey = objectSamples.compactMap { $0[key] }
                let typesForKey = valuesForKey.map { determineType($0) }
                let dominantTypeForKey = mostCommonType(typesForKey)
                let required = valuesForKey.count == objectSamples.count

                properties[key] = JSONSchema.PropertyInfo(
                    type: dominantTypeForKey,
                    required: required,
                    sampleValue: valuesForKey.first.flatMap { getSampleValue($0) }
                )

                // Detect LATCH mappings across array items
                if let firstValue = valuesForKey.first,
                   let latchProperty = detectLATCHProperty(key: key, value: firstValue) {
                    latchMappings[key] = latchProperty
                }
            }
        }

        return JSONSchema(
            type: .array,
            filename: filename,
            rootStructure: .array,
            inferredMapping: dominantType == .object ? .multipleNodes : .singleNode,
            properties: properties,
            arrayItemType: dominantType,
            estimatedNodeCount: array.count,
            latchMappings: latchMappings
        )
    }

    private func determineType(_ value: Any) -> JSONSchema.ValueType {
        switch value {
        case is NSNull:
            return .null
        case is Bool:
            return .boolean
        case is Int, is Int32, is Int64, is Float, is Double, is NSNumber:
            return .number
        case is String:
            return .string
        case is [Any]:
            return .array
        case is [String: Any]:
            return .object
        default:
            return .string
        }
    }

    private func getSampleValue(_ value: Any) -> String? {
        switch value {
        case let str as String:
            return str.count > 100 ? String(str.prefix(97)) + "..." : str
        case let num as NSNumber:
            return num.stringValue
        case let bool as Bool:
            return bool ? "true" : "false"
        case is NSNull:
            return nil
        default:
            return String(describing: value)
        }
    }

    private func mostCommonType(_ types: [JSONSchema.ValueType]) -> JSONSchema.ValueType {
        let counts = types.reduce(into: [:]) { result, type in
            result[type, default: 0] += 1
        }
        return counts.max(by: { $0.value < $1.value })?.key ?? .string
    }

    private func detectLATCHProperty(key: String, value: Any) -> JSONSchema.LATCHProperty? {
        let lowercaseKey = key.lowercased()

        // Location detection
        if lowercaseKey.contains("lat") && (value is Double || value is Float) {
            return .location(.latitude)
        }
        if lowercaseKey.contains("lon") && (value is Double || value is Float) {
            return .location(.longitude)
        }
        if lowercaseKey.contains("address") || lowercaseKey.contains("location") {
            return .location(.address)
        }

        // Time detection
        if lowercaseKey.contains("created") || lowercaseKey.contains("date") {
            return .time(.created)
        }
        if lowercaseKey.contains("modified") || lowercaseKey.contains("updated") {
            return .time(.modified)
        }
        if lowercaseKey.contains("due") {
            return .time(.due)
        }

        // Category detection
        if lowercaseKey.contains("tag") || lowercaseKey.contains("category") {
            return .category(.tags)
        }
        if lowercaseKey.contains("folder") || lowercaseKey.contains("group") {
            return .category(.folder)
        }
        if lowercaseKey.contains("status") || lowercaseKey.contains("state") {
            return .category(.status)
        }

        // Hierarchy detection
        if lowercaseKey.contains("priority") {
            return .hierarchy(.priority)
        }
        if lowercaseKey.contains("importance") {
            return .hierarchy(.importance)
        }
        if lowercaseKey.contains("order") || lowercaseKey.contains("sort") {
            return .hierarchy(.sortOrder)
        }

        // Alphabet detection (name/title fields)
        if lowercaseKey.contains("name") || lowercaseKey.contains("title") {
            return .alphabet(.name)
        }
        if lowercaseKey.contains("content") || lowercaseKey.contains("body") || lowercaseKey.contains("description") {
            return .alphabet(.content)
        }
        if lowercaseKey.contains("summary") || lowercaseKey.contains("excerpt") {
            return .alphabet(.summary)
        }

        return nil
    }

    // MARK: - Node Conversion

    private struct ConversionResult {
        let nodes: [Node]
        let errors: [ImportError]
        let totalItems: Int
        let processedItems: Int
    }

    private func convertToNodes(
        _ jsonObject: Any,
        schema: JSONSchema,
        filename: String,
        folder: String?
    ) async throws -> ConversionResult {

        switch schema.rootStructure {
        case .object:
            let node = try await convertObjectToNode(
                jsonObject as! [String: Any],
                schema: schema,
                filename: filename,
                folder: folder
            )

            try await database.createNode(node)

            return ConversionResult(
                nodes: [node],
                errors: [],
                totalItems: 1,
                processedItems: 1
            )

        case .array:
            let array = jsonObject as! [Any]
            var nodes: [Node] = []
            var errors: [ImportError] = []

            for (index, item) in array.enumerated() {
                do {
                    if schema.arrayItemType == .object {
                        let itemObject = item as! [String: Any]
                        let node = try await convertObjectToNode(
                            itemObject,
                            schema: schema,
                            filename: filename,
                            folder: folder,
                            index: index
                        )
                        try await database.createNode(node)
                        nodes.append(node)
                    } else {
                        // Convert primitive array item to simple node
                        let node = try await convertPrimitiveToNode(
                            item,
                            filename: filename,
                            folder: folder,
                            index: index
                        )
                        try await database.createNode(node)
                        nodes.append(node)
                    }
                } catch {
                    errors.append(ImportError.fileFailed("item \(index)", error))
                }
            }

            return ConversionResult(
                nodes: nodes,
                errors: errors,
                totalItems: array.count,
                processedItems: nodes.count
            )

        case .primitive:
            let node = try await convertPrimitiveToNode(
                jsonObject,
                filename: filename,
                folder: folder
            )
            try await database.createNode(node)

            return ConversionResult(
                nodes: [node],
                errors: [],
                totalItems: 1,
                processedItems: 1
            )
        }
    }

    private func convertObjectToNode(
        _ object: [String: Any],
        schema: JSONSchema,
        filename: String,
        folder: String?,
        index: Int? = nil
    ) async throws -> Node {

        var nodeType = "json-object"
        var name = filename.replacingOccurrences(of: ".json", with: "")
        var content: String? = nil
        var summary: String? = nil

        // LATCH property mapping
        var latitude: Double? = nil
        var longitude: Double? = nil
        var locationName: String? = nil
        var locationAddress: String? = nil
        var createdAt = Date()
        var modifiedAt = Date()
        var dueAt: Date? = nil
        var tags: [String] = ["json-import"]
        var status: String? = nil
        var priority = 0
        var importance = 0
        var sortOrder = index ?? 0

        // Apply LATCH mappings
        for (key, value) in object {
            if let latchProperty = schema.latchMappings[key] {
                switch latchProperty {
                case .alphabet(.name):
                    name = String(describing: value)
                case .alphabet(.content):
                    content = String(describing: value)
                case .alphabet(.summary):
                    summary = String(describing: value)
                case .location(.latitude):
                    latitude = value as? Double
                case .location(.longitude):
                    longitude = value as? Double
                case .location(.address):
                    locationAddress = String(describing: value)
                case .time(.created):
                    if let dateString = value as? String {
                        createdAt = parseDate(dateString) ?? Date()
                    }
                case .time(.modified):
                    if let dateString = value as? String {
                        modifiedAt = parseDate(dateString) ?? Date()
                    }
                case .time(.due):
                    if let dateString = value as? String {
                        dueAt = parseDate(dateString)
                    }
                case .category(.tags):
                    if let tagArray = value as? [String] {
                        tags.append(contentsOf: tagArray)
                    } else if let tagString = value as? String {
                        tags.append(tagString)
                    }
                case .category(.folder):
                    // Override folder parameter if found in data
                    // Use provided folder parameter as default
                    break
                case .category(.status):
                    status = String(describing: value)
                case .hierarchy(.priority):
                    priority = value as? Int ?? 0
                case .hierarchy(.importance):
                    importance = value as? Int ?? 0
                case .hierarchy(.sortOrder):
                    sortOrder = value as? Int ?? (index ?? 0)
                }
            }
        }

        // Generate content if not explicitly mapped
        if content == nil {
            content = generateMarkdownContent(from: object, schema: schema)
        }

        // Generate summary if not explicitly mapped
        if summary == nil {
            summary = generateObjectSummary(from: object, name: name)
        }

        // Add index to name if processing array item
        if let index {
            name = "\(name) (\(index + 1))"
        }

        return Node(
            id: UUID().uuidString,
            nodeType: nodeType,
            name: name,
            content: content,
            summary: summary,
            latitude: latitude,
            longitude: longitude,
            locationName: locationName,
            locationAddress: locationAddress,
            createdAt: createdAt,
            modifiedAt: modifiedAt,
            dueAt: dueAt,
            folder: folder,
            tags: tags,
            status: status,
            priority: priority,
            importance: importance,
            sortOrder: sortOrder,
            source: "json-import",
            sourceId: generateSourceId(filename: filename, index: index),
            sourceUrl: nil
        )
    }

    private func convertPrimitiveToNode(
        _ value: Any,
        filename: String,
        folder: String?,
        index: Int? = nil
    ) async throws -> Node {

        let valueString = String(describing: value)
        var name = filename.replacingOccurrences(of: ".json", with: "")

        if let index {
            name = "\(name) (\(index + 1))"
        }

        return Node(
            id: UUID().uuidString,
            nodeType: "json-value",
            name: name,
            content: valueString,
            summary: "JSON value: \(valueString.prefix(100))",
            folder: folder,
            tags: ["json-import", "primitive-value"],
            sortOrder: index ?? 0,
            source: "json-import",
            sourceId: generateSourceId(filename: filename, index: index)
        )
    }

    private func generateMarkdownContent(from object: [String: Any], schema: JSONSchema) -> String {
        var lines: [String] = []

        // Create markdown representation of JSON object
        for (key, value) in object.sorted(by: { $0.key < $1.key }) {
            let formattedValue = formatValueForMarkdown(value)
            lines.append("**\(key):** \(formattedValue)")
        }

        return lines.joined(separator: "\n")
    }

    private func formatValueForMarkdown(_ value: Any) -> String {
        switch value {
        case let str as String:
            // Escape markdown special characters
            return str.replacingOccurrences(of: "*", with: "\\*")
                      .replacingOccurrences(of: "_", with: "\\_")
                      .replacingOccurrences(of: "|", with: "\\|")
        case let array as [Any]:
            let items = array.prefix(5).map { String(describing: $0) }
            let display = items.joined(separator: ", ")
            let suffix = array.count > 5 ? "... (\(array.count) items)" : ""
            return "[\(display)\(suffix)]"
        case let dict as [String: Any]:
            let keys = Array(dict.keys.prefix(3))
            let keyDisplay = keys.joined(separator: ", ")
            let suffix = dict.count > 3 ? "... (\(dict.count) properties)" : ""
            return "{\(keyDisplay)\(suffix)}"
        case is NSNull:
            return "*null*"
        default:
            return String(describing: value)
        }
    }

    private func generateObjectSummary(from object: [String: Any], name: String) -> String {
        let propertyCount = object.count
        let hasContent = object.values.contains { !String(describing: $0).isEmpty }

        return "JSON object '\(name)' with \(propertyCount) properties\(hasContent ? " containing data" : "")"
    }

    private func generateSourceId(filename: String, index: Int?) -> String {
        if let index {
            return "\(filename)[\(index)]"
        } else {
            return filename
        }
    }

    private func parseDate(_ dateString: String) -> Date? {
        let formatters: [DateFormatter] = {
            let iso8601 = DateFormatter()
            iso8601.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"

            let iso8601Millis = DateFormatter()
            iso8601Millis.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"

            let simple = DateFormatter()
            simple.dateFormat = "yyyy-MM-dd"

            return [iso8601Millis, iso8601, simple]
        }()

        for formatter in formatters {
            if let date = formatter.date(from: dateString) {
                return date
            }
        }

        return nil
    }
}

// MARK: - Supporting Types

public struct JSONSchema: Codable, Sendable {
    public let type: ValueType
    public let filename: String
    public let rootStructure: StructureType
    public let inferredMapping: MappingStrategy
    public let properties: [String: PropertyInfo]
    public let arrayItemType: ValueType?
    public let estimatedNodeCount: Int
    public let latchMappings: [String: LATCHProperty]

    public enum ValueType: String, Codable, CaseIterable {
        case null, boolean, number, string, array, object
    }

    public enum StructureType: String, Codable {
        case object, array, primitive
    }

    public enum MappingStrategy: String, Codable {
        case singleNode, multipleNodes
    }

    public struct PropertyInfo: Codable {
        public let type: ValueType
        public let required: Bool
        public let sampleValue: String?
    }

    public enum LATCHProperty: Codable {
        case location(LocationProperty)
        case alphabet(AlphabetProperty)
        case time(TimeProperty)
        case category(CategoryProperty)
        case hierarchy(HierarchyProperty)

        public enum LocationProperty: String, Codable {
            case latitude, longitude, address, name
        }

        public enum AlphabetProperty: String, Codable {
            case name, content, summary
        }

        public enum TimeProperty: String, Codable {
            case created, modified, due, completed, eventStart, eventEnd
        }

        public enum CategoryProperty: String, Codable {
            case folder, tags, status
        }

        public enum HierarchyProperty: String, Codable {
            case priority, importance, sortOrder
        }
    }
}

public enum JSONImportError: Error, LocalizedError {
    case fileAccessDenied
    case unsupportedFormat(String)
    case invalidFormat(String)
    case processingFailed(String, Error)

    public var errorDescription: String? {
        switch self {
        case .fileAccessDenied:
            return "Access to the file was denied. Please check permissions."
        case .unsupportedFormat(let format):
            return "Unsupported file format: \(format). Expected .json"
        case .invalidFormat(let details):
            return "Invalid JSON format: \(details)"
        case .processingFailed(let context, let error):
            return "Failed to process \(context): \(error.localizedDescription)"
        }
    }
}