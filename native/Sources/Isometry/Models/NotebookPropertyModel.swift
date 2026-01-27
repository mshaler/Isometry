import Foundation
import SwiftUI
import Combine

/// Property types supported in Isometry notebook cards
/// Matches React prototype PropertyType enum for consistency
public enum PropertyType: String, CaseIterable, Codable, Sendable {
    case text = "text"
    case number = "number"
    case date = "date"
    case boolean = "boolean"
    case select = "select"
    case tags = "tags"
    case reference = "reference"

    public var displayName: String {
        switch self {
        case .text: return "Text"
        case .number: return "Number"
        case .date: return "Date"
        case .boolean: return "Boolean"
        case .select: return "Select"
        case .tags: return "Tags"
        case .reference: return "Reference"
        }
    }

    public var icon: String {
        switch self {
        case .text: return "textformat"
        case .number: return "number"
        case .date: return "calendar"
        case .boolean: return "checkmark.circle"
        case .select: return "list.bullet"
        case .tags: return "tag"
        case .reference: return "link"
        }
    }
}

/// Type-safe property value storage
/// Uses associated types to ensure type safety while maintaining JSON serialization
public enum PropertyValue: Codable, Equatable, Sendable {
    case text(String)
    case number(Double)
    case date(Date)
    case boolean(Bool)
    case select(String)
    case tags([String])
    case reference([String]) // Multiple node ID references
    case null

    public var type: PropertyType {
        switch self {
        case .text: return .text
        case .number: return .number
        case .date: return .date
        case .boolean: return .boolean
        case .select: return .select
        case .tags: return .tags
        case .reference: return .reference
        case .null: return .text // Default to text for null values
        }
    }

    public var stringValue: String {
        switch self {
        case .text(let value): return value
        case .number(let value): return String(value)
        case .date(let value): return ISO8601DateFormatter().string(from: value)
        case .boolean(let value): return String(value)
        case .select(let value): return value
        case .tags(let values): return values.joined(separator: ", ")
        case .reference(let values): return values.joined(separator: ", ")
        case .null: return ""
        }
    }

    /// Convert to JSON-serializable format for database storage
    public var jsonValue: Any {
        switch self {
        case .text(let value): return value
        case .number(let value): return value
        case .date(let value): return ISO8601DateFormatter().string(from: value)
        case .boolean(let value): return value
        case .select(let value): return value
        case .tags(let value): return value
        case .reference(let value): return value
        case .null: return NSNull()
        }
    }

    /// Create PropertyValue from JSON-serializable format
    public static func from(jsonValue: Any, type: PropertyType) -> PropertyValue? {
        switch type {
        case .text:
            guard let string = jsonValue as? String else { return nil }
            return .text(string)
        case .number:
            if let double = jsonValue as? Double {
                return .number(double)
            } else if let int = jsonValue as? Int {
                return .number(Double(int))
            }
            return nil
        case .date:
            guard let string = jsonValue as? String,
                  let date = ISO8601DateFormatter().date(from: string) else { return nil }
            return .date(date)
        case .boolean:
            guard let bool = jsonValue as? Bool else { return nil }
            return .boolean(bool)
        case .select:
            guard let string = jsonValue as? String else { return nil }
            return .select(string)
        case .tags:
            guard let array = jsonValue as? [String] else { return nil }
            return .tags(array)
        case .reference:
            guard let array = jsonValue as? [String] else { return nil }
            return .reference(array)
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        switch self {
        case .text(let value):
            try container.encode("text", forKey: .type)
            try container.encode(value, forKey: .value)
        case .number(let value):
            try container.encode("number", forKey: .type)
            try container.encode(value, forKey: .value)
        case .date(let value):
            try container.encode("date", forKey: .type)
            try container.encode(ISO8601DateFormatter().string(from: value), forKey: .value)
        case .boolean(let value):
            try container.encode("boolean", forKey: .type)
            try container.encode(value, forKey: .value)
        case .select(let value):
            try container.encode("select", forKey: .type)
            try container.encode(value, forKey: .value)
        case .tags(let values):
            try container.encode("tags", forKey: .type)
            try container.encode(values, forKey: .value)
        case .reference(let values):
            try container.encode("reference", forKey: .type)
            try container.encode(values, forKey: .value)
        case .null:
            try container.encode("null", forKey: .type)
            try container.encodeNil(forKey: .value)
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "text":
            let value = try container.decode(String.self, forKey: .value)
            self = .text(value)
        case "number":
            let value = try container.decode(Double.self, forKey: .value)
            self = .number(value)
        case "date":
            let dateString = try container.decode(String.self, forKey: .value)
            guard let date = ISO8601DateFormatter().date(from: dateString) else {
                throw DecodingError.dataCorruptedError(forKey: .value, in: container, debugDescription: "Invalid date format")
            }
            self = .date(date)
        case "boolean":
            let value = try container.decode(Bool.self, forKey: .value)
            self = .boolean(value)
        case "select":
            let value = try container.decode(String.self, forKey: .value)
            self = .select(value)
        case "tags":
            let values = try container.decode([String].self, forKey: .value)
            self = .tags(values)
        case "reference":
            let values = try container.decode([String].self, forKey: .value)
            self = .reference(values)
        case "null":
            self = .null
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "Unknown property type")
        }
    }

    private enum CodingKeys: String, CodingKey {
        case type, value
    }
}

/// Property definition schema for property configuration
/// Matches React PropertyDefinition interface
public struct PropertyDefinition: Codable, Identifiable, Sendable {
    public let id: String
    public let name: String
    public let type: PropertyType
    public let required: Bool
    public let defaultValue: PropertyValue?
    public let options: [String]? // For select/tags properties
    public let placeholder: String?
    public let description: String?

    public init(
        id: String = UUID().uuidString,
        name: String,
        type: PropertyType,
        required: Bool = false,
        defaultValue: PropertyValue? = nil,
        options: [String]? = nil,
        placeholder: String? = nil,
        description: String? = nil
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.required = required
        self.defaultValue = defaultValue
        self.options = options
        self.placeholder = placeholder
        self.description = description
    }
}

/// Property validation error types
public enum PropertyValidationError: Error, LocalizedError {
    case required(String)
    case invalidType(String, PropertyType)
    case invalidOption(String, [String])
    case invalidFormat(String)
    case custom(String)

    public var errorDescription: String? {
        switch self {
        case .required(let field):
            return "\(field) is required"
        case .invalidType(let field, let type):
            return "\(field) must be a valid \(type.displayName.lowercased())"
        case .invalidOption(let field, let options):
            return "\(field) must be one of: \(options.joined(separator: ", "))"
        case .invalidFormat(let message):
            return message
        case .custom(let message):
            return message
        }
    }
}

/// Main property management model for notebook cards
/// Provides property editing, validation, and CloudKit synchronization
@MainActor
public class NotebookPropertyModel: ObservableObject {

    // MARK: - Published Properties

    /// Current property values for the active card
    @Published public var properties: [String: PropertyValue] = [:]

    /// Custom property definitions beyond built-in ones
    @Published public var customDefinitions: [PropertyDefinition] = []

    /// Whether there are unsaved property changes
    @Published public var isDirty = false

    /// Validation errors for each property
    @Published public var validationErrors: [String: String] = [:]

    /// Current save state
    @Published public var isSaving = false

    /// Success indicator for UI feedback
    @Published public var saveSuccess = false

    // MARK: - Private Properties

    private var database: IsometryDatabase
    private var autoSaveTimer: Timer?
    private var autoSaveDelay: TimeInterval = 1.0
    private var cancellables = Set<AnyCancellable>()
    private var lastSavedProperties: [String: PropertyValue] = [:]

    // MARK: - Computed Properties

    /// All available property definitions (built-in + custom)
    public var allDefinitions: [PropertyDefinition] {
        return Array(Self.builtInDefinitions.values) + customDefinitions
    }

    /// Number of properties with non-empty values
    public var propertyCount: Int {
        return properties.values.filter { value in
            switch value {
            case .text(let str): return !str.isEmpty
            case .tags(let arr), .reference(let arr): return !arr.isEmpty
            case .null: return false
            default: return true
            }
        }.count
    }

    // MARK: - Built-in Property Definitions

    public static let builtInDefinitions: [String: PropertyDefinition] = [
        "Tags": PropertyDefinition(
            name: "Tags",
            type: .tags,
            placeholder: "Add tags...",
            description: "Categorization tags for this card"
        ),
        "Priority": PropertyDefinition(
            name: "Priority",
            type: .select,
            defaultValue: .select("medium"),
            options: ["low", "medium", "high", "urgent"],
            description: "Task or content priority level"
        ),
        "Status": PropertyDefinition(
            name: "Status",
            type: .select,
            defaultValue: .select("draft"),
            options: ["draft", "in-progress", "review", "complete", "archived"],
            description: "Current status of the card"
        ),
        "Related Nodes": PropertyDefinition(
            name: "Related Nodes",
            type: .reference,
            placeholder: "Link to other nodes...",
            description: "References to related Isometry nodes"
        ),
        "Due Date": PropertyDefinition(
            name: "Due Date",
            type: .date,
            description: "Target completion date"
        ),
        "Assignee": PropertyDefinition(
            name: "Assignee",
            type: .text,
            placeholder: "Who is responsible?",
            description: "Person responsible for this task"
        ),
        "Effort (hours)": PropertyDefinition(
            name: "Effort (hours)",
            type: .number,
            placeholder: "0",
            description: "Estimated effort in hours"
        ),
        "Archived": PropertyDefinition(
            name: "Archived",
            type: .boolean,
            defaultValue: .boolean(false),
            description: "Whether this card is archived"
        )
    ]

    // MARK: - Initialization

    public init(database: IsometryDatabase) {
        self.database = database
        setupPropertyObservation()
    }

    deinit {
        saveDebounceTimer?.invalidate()
    }

    // MARK: - Public Methods

    /// Update the database reference
    public func updateDatabase(_ database: IsometryDatabase) {
        self.database = database
    }

    /// Load properties for a specific card
    public func loadCard(_ card: NotebookCard) {
        activeCard = card

        // Convert string properties to PropertyValue objects
        var newProperties: [String: PropertyValue] = [:]
        for (key, value) in card.properties {
            // Try to determine type from built-in definitions
            if let definition = allDefinitions.first(where: { $0.name == key }) {
                newProperties[key] = PropertyValue.from(jsonValue: value, type: definition.type) ?? .text(value)
            } else {
                // Default to text for unknown properties
                newProperties[key] = .text(value)
            }
        }

        properties = newProperties
        isDirty = false
        validationErrors.removeAll()
    }

    /// Update a property value with validation
    public func updateProperty(key: String, value: PropertyValue) {
        properties[key] = value
        isDirty = true

        // Validate the new value
        if let definition = allDefinitions.first(where: { $0.name == key }) {
            do {
                try validateProperty(value: value, definition: definition)
                validationErrors[key] = nil
            } catch {
                validationErrors[key] = error.localizedDescription
            }
        }

        // Debounce auto-save
        scheduleAutoSave()
    }

    /// Remove a property
    public func removeProperty(key: String) {
        properties.removeValue(forKey: key)
        validationErrors.removeValue(forKey: key)
        isDirty = true
        scheduleAutoSave()
    }

    /// Add a new property with default value
    public func addProperty(key: String, type: PropertyType) -> Bool {
        // Check if property already exists
        guard !properties.keys.contains(key) else { return false }

        // Create default value based on type
        let defaultValue: PropertyValue
        switch type {
        case .text: defaultValue = .text("")
        case .number: defaultValue = .number(0)
        case .date: defaultValue = .date(Date())
        case .boolean: defaultValue = .boolean(false)
        case .select: defaultValue = .select("")
        case .tags: defaultValue = .tags([])
        case .reference: defaultValue = .reference([])
        }

        updateProperty(key: key, value: defaultValue)
        return true
    }

    /// Add a custom property definition
    public func addCustomDefinition(_ definition: PropertyDefinition) {
        // Check if definition already exists
        guard !allDefinitions.contains(where: { $0.name == definition.name }) else { return }

        customDefinitions.append(definition)

        // Add property with default value if specified
        if let defaultValue = definition.defaultValue {
            updateProperty(key: definition.name, value: defaultValue)
        } else {
            _ = addProperty(key: definition.name, type: definition.type)
        }
    }

    /// Remove a custom property definition
    public func removeCustomDefinition(name: String) {
        customDefinitions.removeAll { $0.name == name }
        removeProperty(key: name)
    }

    /// Validate all properties
    public func validateProperties() -> [String: String] {
        var errors: [String: String] = [:]

        for definition in allDefinitions {
            guard let value = properties[definition.name] else {
                if definition.required {
                    errors[definition.name] = PropertyValidationError.required(definition.name).localizedDescription
                }
                continue
            }

            do {
                try validateProperty(value: value, definition: definition)
            } catch {
                errors[definition.name] = error.localizedDescription
            }
        }

        validationErrors = errors
        return errors
    }

    /// Save properties immediately (bypassing debounce)
    public func saveNow() async throws {
        guard isDirty, let card = activeCard else { return }

        isSaving = true
        defer { isSaving = false }

        // Validate all properties first
        let errors = validateProperties()
        guard errors.isEmpty else {
            throw PropertyValidationError.custom("Please fix validation errors before saving")
        }

        // Convert PropertyValue objects back to strings for storage
        var stringProperties: [String: String] = [:]
        for (key, value) in properties {
            stringProperties[key] = value.stringValue
        }

        // Update card with new properties
        let updatedCard = NotebookCard(
            id: card.id,
            title: card.title,
            markdownContent: card.markdownContent,
            properties: stringProperties,
            templateId: card.templateId,
            createdAt: card.createdAt,
            modifiedAt: Date(),
            folder: card.folder,
            tags: card.tags,
            linkedNodeId: card.linkedNodeId,
            syncVersion: card.syncVersion + 1,
            lastSyncedAt: card.lastSyncedAt,
            conflictResolvedAt: card.conflictResolvedAt,
            deletedAt: card.deletedAt
        )

        // Save to database
        try await database.updateNotebookCard(updatedCard)

        // Update local state
        activeCard = updatedCard
        isDirty = false

        // Show success feedback
        saveSuccess = true
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000) // 2 seconds
            await MainActor.run {
                saveSuccess = false
            }
        }
    }

    // MARK: - Private Methods

    private func setupPropertyObservation() {
        // Observe property changes for auto-save
        $properties
            .dropFirst() // Skip initial value
            .debounce(for: .milliseconds(500), scheduler: RunLoop.main)
            .sink { [weak self] _ in
                Task {
                    try? await self?.saveNow()
                }
            }
            .store(in: &cancellables)
    }

    private func scheduleAutoSave() {
        saveDebounceTimer?.invalidate()
        saveDebounceTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: false) { [weak self] _ in
            Task {
                try? await self?.saveNow()
            }
        }
    }

    private func validateProperty(value: PropertyValue, definition: PropertyDefinition) throws {
        // Check required fields
        if definition.required {
            switch value {
            case .text(let str) where str.isEmpty:
                throw PropertyValidationError.required(definition.name)
            case .tags(let arr) where arr.isEmpty,
                 .reference(let arr) where arr.isEmpty:
                throw PropertyValidationError.required(definition.name)
            case .null:
                throw PropertyValidationError.required(definition.name)
            default:
                break
            }
        }

        // Type-specific validation
        switch (value, definition.type) {
        case (.text, .text), (.number, .number), (.date, .date),
             (.boolean, .boolean), (.tags, .tags), (.reference, .reference):
            // Types match, continue with specific validation
            break
        case (.select(let str), .select):
            // Check if value is in allowed options
            if let options = definition.options, !options.contains(str) {
                throw PropertyValidationError.invalidOption(definition.name, options)
            }
        default:
            throw PropertyValidationError.invalidType(definition.name, definition.type)
        }

        // Additional validation based on type
        switch value {
        case .number(let num):
            guard !num.isNaN && num.isFinite else {
                throw PropertyValidationError.invalidFormat("\(definition.name) must be a valid number")
            }
        case .reference(let refs):
            // Validate that references are valid UUIDs
            for ref in refs {
                guard UUID(uuidString: ref) != nil else {
                    throw PropertyValidationError.invalidFormat("\(definition.name) must contain valid node IDs")
                }
            }
        default:
            break
        }
    }

}