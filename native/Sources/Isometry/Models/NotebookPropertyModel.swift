import Foundation
import SwiftUI
import Combine

/// Property types supported in the notebook system
public enum PropertyType: String, CaseIterable, Codable {
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
public enum PropertyValue: Codable, Equatable {
    case text(String)
    case number(Double)
    case date(Date)
    case boolean(Bool)
    case select(String)
    case tags([String])
    case reference(String) // Node ID reference

    public var type: PropertyType {
        switch self {
        case .text: return .text
        case .number: return .number
        case .date: return .date
        case .boolean: return .boolean
        case .select: return .select
        case .tags: return .tags
        case .reference: return .reference
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
        case .reference(let value): return value
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
        case .reference(let value):
            try container.encode("reference", forKey: .type)
            try container.encode(value, forKey: .value)
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
            let value = try container.decode(String.self, forKey: .value)
            self = .reference(value)
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "Unknown property type")
        }
    }

    private enum CodingKeys: String, CodingKey {
        case type, value
    }
}

/// Property definition schema
public struct PropertyDefinition: Codable, Identifiable {
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

/// Property validation error
public struct PropertyValidationError: Error, Identifiable {
    public let id = UUID()
    public let propertyKey: String
    public let message: String

    public init(propertyKey: String, message: String) {
        self.propertyKey = propertyKey
        self.message = message
    }
}

/// Property management model with validation and CloudKit sync
@MainActor
public class NotebookPropertyModel: ObservableObject {

    // MARK: - Published Properties

    /// Current property values
    @Published public var properties: [String: PropertyValue] = [:]

    /// Property definitions for type safety and validation
    @Published public var definitions: [String: PropertyDefinition] = [:]

    /// Whether there are unsaved property changes
    @Published public var isDirty: Bool = false

    /// Validation errors by property key
    @Published public var validationErrors: [String: String] = [:]

    /// Currently active notebook card
    @Published public var activeCard: NotebookCard? = nil

    /// Whether a save operation is in progress
    @Published public var isSaving: Bool = false

    // MARK: - Private Properties

    private var database: IsometryDatabase
    private var autoSaveTimer: Timer?
    private var autoSaveDelay: TimeInterval = 1.0
    private var cancellables = Set<AnyCancellable>()
    private var lastSavedProperties: [String: PropertyValue] = [:]

    // MARK: - Built-in Property Definitions

    public static let builtInDefinitions: [String: PropertyDefinition] = [
        "priority": PropertyDefinition(
            name: "Priority",
            type: .select,
            options: ["Low", "Medium", "High", "Urgent"],
            description: "Task or item priority level"
        ),
        "status": PropertyDefinition(
            name: "Status",
            type: .select,
            options: ["Todo", "In Progress", "Review", "Done"],
            description: "Current status of the item"
        ),
        "tags": PropertyDefinition(
            name: "Tags",
            type: .tags,
            description: "Categorization tags"
        ),
        "due_date": PropertyDefinition(
            name: "Due Date",
            type: .date,
            description: "When this item is due"
        ),
        "assignee": PropertyDefinition(
            name: "Assignee",
            type: .text,
            placeholder: "Person responsible",
            description: "Who is responsible for this item"
        ),
        "effort": PropertyDefinition(
            name: "Effort",
            type: .number,
            placeholder: "Hours or story points",
            description: "Estimated effort required"
        ),
        "completed": PropertyDefinition(
            name: "Completed",
            type: .boolean,
            defaultValue: .boolean(false),
            description: "Whether this item is completed"
        )
    ]

    // MARK: - Initialization

    public init(database: IsometryDatabase) {
        self.database = database
        self.definitions = Self.builtInDefinitions
        setupAutoSave()
    }

    deinit {
        autoSaveTimer?.invalidate()
    }

    // MARK: - Public Methods

    /// Load properties for a notebook card
    public func loadCard(_ card: NotebookCard) {
        // Save current changes before loading new card
        saveCurrentChanges()

        activeCard = card

        // Convert card properties to PropertyValue format
        var newProperties: [String: PropertyValue] = [:]

        if let cardProperties = card.properties {
            for (key, value) in cardProperties {
                if let propertyValue = convertToPropertyValue(value, forKey: key) {
                    newProperties[key] = propertyValue
                }
            }
        }

        properties = newProperties
        lastSavedProperties = newProperties
        isDirty = false
        validationErrors.removeAll()
    }

    /// Update a property value
    public func updateProperty(key: String, value: PropertyValue) {
        properties[key] = value
        isDirty = true

        // Validate the property
        validateProperty(key: key, value: value)

        // Schedule auto-save
        scheduleAutoSave()
    }

    /// Remove a property
    public func removeProperty(key: String) {
        properties.removeValue(forKey: key)
        definitions.removeValue(forKey: key)
        validationErrors.removeValue(forKey: key)
        isDirty = true

        scheduleAutoSave()
    }

    /// Add a new property
    public func addProperty(key: String, definition: PropertyDefinition) {
        definitions[key] = definition

        // Set default value if provided
        if let defaultValue = definition.defaultValue {
            updateProperty(key: key, value: defaultValue)
        } else {
            // Set empty value based on type
            let emptyValue: PropertyValue = switch definition.type {
            case .text: .text("")
            case .number: .number(0)
            case .date: .date(Date())
            case .boolean: .boolean(false)
            case .select: .select(definition.options?.first ?? "")
            case .tags: .tags([])
            case .reference: .reference("")
            }
            updateProperty(key: key, value: emptyValue)
        }
    }

    /// Validate all properties
    public func validateProperties() -> Bool {
        validationErrors.removeAll()

        for (key, value) in properties {
            validateProperty(key: key, value: value)
        }

        return validationErrors.isEmpty
    }

    /// Save properties now
    @discardableResult
    public func saveNow() async -> Bool {
        return await performSave()
    }

    /// Update the database reference
    public func updateDatabase(_ newDatabase: IsometryDatabase) {
        database = newDatabase
    }

    // MARK: - Private Methods

    private func setupAutoSave() {
        // Monitor property changes for auto-save
        $properties
            .debounce(for: .milliseconds(500), scheduler: RunLoop.main)
            .sink { [weak self] _ in
                self?.scheduleAutoSave()
            }
            .store(in: &cancellables)
    }

    private func scheduleAutoSave() {
        // Cancel existing timer
        autoSaveTimer?.invalidate()

        // Only schedule if there are changes to save
        guard isDirty, activeCard != nil else { return }

        // Schedule new auto-save
        autoSaveTimer = Timer.scheduledTimer(withTimeInterval: autoSaveDelay, repeats: false) { [weak self] _ in
            Task { @MainActor in
                await self?.performSave()
            }
        }
    }

    @discardableResult
    private func performSave() async -> Bool {
        guard isDirty, let activeCard = activeCard else {
            return false
        }

        // Prevent concurrent saves
        guard !isSaving else {
            return false
        }

        isSaving = true

        do {
            // Convert PropertyValue back to card properties format
            var cardProperties: [String: String] = [:]
            for (key, value) in properties {
                cardProperties[key] = value.stringValue
            }

            // Update card with new properties
            let updatedCard = NotebookCard(
                id: activeCard.id,
                title: activeCard.title,
                markdownContent: activeCard.markdownContent,
                properties: cardProperties,
                templateId: activeCard.templateId,
                createdAt: activeCard.createdAt,
                modifiedAt: Date(),
                folder: activeCard.folder,
                tags: activeCard.tags,
                linkedNodeId: activeCard.linkedNodeId,
                syncVersion: activeCard.syncVersion + 1,
                lastSyncedAt: activeCard.lastSyncedAt,
                conflictResolvedAt: activeCard.conflictResolvedAt,
                deletedAt: activeCard.deletedAt
            )

            // Save to database
            try await database.updateNotebookCard(updatedCard)

            // Update local state
            self.activeCard = updatedCard
            lastSavedProperties = properties
            isDirty = false

            isSaving = false
            return true

        } catch {
            print("Failed to save properties: \(error)")
            isSaving = false
            return false
        }
    }

    private func validateProperty(key: String, value: PropertyValue) {
        guard let definition = definitions[key] else { return }

        // Required field validation
        if definition.required {
            switch value {
            case .text(let text) where text.isEmpty:
                validationErrors[key] = "\(definition.name) is required"
                return
            case .tags(let tags) where tags.isEmpty:
                validationErrors[key] = "\(definition.name) is required"
                return
            case .reference(let ref) where ref.isEmpty:
                validationErrors[key] = "\(definition.name) is required"
                return
            default:
                break
            }
        }

        // Type-specific validation
        switch (value, definition.type) {
        case (.number(let num), .number):
            if num.isNaN || num.isInfinite {
                validationErrors[key] = "Invalid number"
            }

        case (.select(let selected), .select):
            if let options = definition.options, !options.contains(selected) {
                validationErrors[key] = "Invalid selection"
            }

        case (.tags(let tags), .tags):
            if let options = definition.options {
                let invalidTags = tags.filter { !options.contains($0) }
                if !invalidTags.isEmpty {
                    validationErrors[key] = "Invalid tags: \(invalidTags.joined(separator: ", "))"
                }
            }

        default:
            break
        }

        // Clear error if validation passed
        validationErrors.removeValue(forKey: key)
    }

    private func convertToPropertyValue(_ value: Any, forKey key: String) -> PropertyValue? {
        // Try to determine type from built-in definitions
        let type = definitions[key]?.type ?? .text

        switch type {
        case .text:
            if let stringValue = value as? String {
                return .text(stringValue)
            }
        case .number:
            if let doubleValue = value as? Double {
                return .number(doubleValue)
            } else if let intValue = value as? Int {
                return .number(Double(intValue))
            } else if let stringValue = value as? String, let doubleValue = Double(stringValue) {
                return .number(doubleValue)
            }
        case .date:
            if let dateValue = value as? Date {
                return .date(dateValue)
            } else if let stringValue = value as? String, let date = ISO8601DateFormatter().date(from: stringValue) {
                return .date(date)
            }
        case .boolean:
            if let boolValue = value as? Bool {
                return .boolean(boolValue)
            } else if let stringValue = value as? String {
                return .boolean(stringValue.lowercased() == "true")
            }
        case .select:
            if let stringValue = value as? String {
                return .select(stringValue)
            }
        case .tags:
            if let arrayValue = value as? [String] {
                return .tags(arrayValue)
            } else if let stringValue = value as? String {
                return .tags(stringValue.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) })
            }
        case .reference:
            if let stringValue = value as? String {
                return .reference(stringValue)
            }
        }

        // Fallback to text
        return .text(String(describing: value))
    }

    private func saveCurrentChanges() {
        autoSaveTimer?.invalidate()

        if isDirty {
            Task {
                await performSave()
            }
        }
    }

    // MARK: - Computed Properties

    /// Number of properties
    public var propertyCount: Int {
        properties.count
    }

    /// Number of validation errors
    public var errorCount: Int {
        validationErrors.count
    }

    /// Whether all validations pass
    public var isValid: Bool {
        validationErrors.isEmpty
    }
}