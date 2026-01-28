import Foundation
import SwiftUI
import Combine

/// GSD Executor Pattern ETL Operation Manager
/// Orchestrates complex data import/export workflows with user control
@MainActor
public class ETLOperationManager: ObservableObject {
    internal let database: IsometryDatabase
    internal let storageManager: ContentAwareStorageManager
    internal let versionManager: ETLVersionManager
    internal let catalog: ETLDataCatalog
    private var operationQueue: [ETLOperation] = []
    internal var activeOperations: [UUID: ETLOperationExecution] = [:]
    internal var operationHistory: [ETLOperationResult] = []

    @Published public private(set) var currentOperations: [ETLOperationExecution] = []
    @Published public private(set) var queuedOperations: [ETLOperation] = []
    @Published public private(set) var recentResults: [ETLOperationResult] = []
    @Published public private(set) var isExecuting = false

    public init(database: IsometryDatabase, storageManager: ContentAwareStorageManager, versionManager: ETLVersionManager) {
        self.database = database
        self.storageManager = storageManager
        self.versionManager = versionManager
        self.catalog = ETLDataCatalog(database: database, versionManager: versionManager)
        // loadOperationHistory is actor-isolated, call asynchronously
        Task {
            await loadOperationHistory()
        }
    }

    // MARK: - Public Interface

    /// Create a new ETL operation from template
    public func createOperation(from template: ETLOperationTemplate) -> ETLOperation {
        ETLOperation(
            id: UUID(),
            template: template,
            configuration: template.defaultConfiguration,
            createdAt: Date(),
            status: .created
        )
    }

    /// Queue an operation for execution
    public func queueOperation(_ operation: ETLOperation) async {
        operationQueue.append(operation)
        await updatePublishedState()
    }

    /// Execute a single operation immediately
    public func executeOperation(_ operation: ETLOperation) async throws -> ETLOperationResult {
        let execution = ETLOperationExecution(
            operation: operation,
            startedAt: Date(),
            progress: 0.0,
            status: .running,
            currentPhase: .preparing
        )

        activeOperations[operation.id] = execution
        await updatePublishedState()

        do {
            let result = try await performOperation(operation, execution: execution)
            activeOperations.removeValue(forKey: operation.id)
            operationHistory.append(result)
            await updatePublishedState()
            await saveOperationHistory()
            return result
        } catch {
            activeOperations.removeValue(forKey: operation.id)
            let failedResult = ETLOperationResult(
                operationId: operation.id,
                operation: operation,
                status: .failed(error.localizedDescription),
                startedAt: execution.startedAt,
                completedAt: Date(),
                totalDuration: Date().timeIntervalSince(execution.startedAt),
                processedItems: 0,
                importedNodes: [],
                errors: [error]
            )
            operationHistory.append(failedResult)
            await updatePublishedState()
            throw error
        }
    }

    /// Execute all queued operations in sequence
    public func executeQueue() async {
        guard !isExecuting else { return }

        await MainActor.run {
            isExecuting = true
        }

        for operation in operationQueue {
            do {
                _ = try await executeOperation(operation)
            } catch {
                print("Operation \(operation.id) failed: \(error)")
                // Continue with next operation even if one fails
            }
        }

        operationQueue.removeAll()
        await MainActor.run {
            isExecuting = false
        }
        await updatePublishedState()
    }

    /// Cancel an active operation
    public func cancelOperation(_ operationId: UUID) async {
        if let execution = activeOperations[operationId] {
            activeOperations[operationId] = ETLOperationExecution(
                operation: execution.operation,
                startedAt: execution.startedAt,
                progress: execution.progress,
                status: .cancelled,
                currentPhase: execution.currentPhase
            )
        }
        await updatePublishedState()
    }

    /// Get operation templates available to user
    public func getAvailableTemplates() -> [ETLOperationTemplate] {
        return ETLOperationTemplate.allTemplates
    }

    // MARK: - Operation Execution (GSD Pattern)

    private func performOperation(
        _ operation: ETLOperation,
        execution: ETLOperationExecution
    ) async throws -> ETLOperationResult {

        let executor = ETLOperationExecutor(
            operation: operation,
            database: database,
            progressHandler: { [weak self] phase, progress in
                Task { @MainActor in
                    if let self = self {
                        await self.updateOperationProgress(operation.id, phase: phase, progress: progress)
                    }
                }
            }
        )

        return try await executor.execute()
    }

    private func updateOperationProgress(_ operationId: UUID, phase: ETLPhase, progress: Double) async {
        if let execution = activeOperations[operationId] {
            activeOperations[operationId] = ETLOperationExecution(
                operation: execution.operation,
                startedAt: execution.startedAt,
                progress: progress,
                status: .running,
                currentPhase: phase
            )
            await updatePublishedState()
        }
    }

    @MainActor
    internal func updatePublishedState() {
        currentOperations = Array(activeOperations.values)
        queuedOperations = operationQueue
        recentResults = Array(operationHistory.suffix(10))
    }

    // MARK: - Persistence

    private func loadOperationHistory() {
        // Load from UserDefaults or Core Data
        // For now, start with empty history
        operationHistory = []
    }

    internal func saveOperationHistory() async {
        // Save to UserDefaults or Core Data
        // Implementation would depend on chosen persistence strategy
    }
}

// MARK: - ETL Operation Types

public struct ETLOperation: Identifiable, Codable, Sendable {
    public let id: UUID
    public let template: ETLOperationTemplate
    public var configuration: ETLOperationConfiguration
    public let createdAt: Date
    public var status: ETLOperationStatus

    public var name: String { template.name }
    public var description: String { template.description }
}

public struct ETLOperationExecution: Identifiable {
    public let operation: ETLOperation
    public let startedAt: Date
    public var progress: Double // 0.0 to 1.0
    public var status: ETLExecutionStatus
    public var currentPhase: ETLPhase

    public var id: UUID { operation.id }
}

public struct ETLErrorInfo: Codable, Sendable {
    public let message: String
    public let code: String?

    public init(error: Error) {
        self.message = error.localizedDescription
        self.code = nil
    }

    public init(message: String, code: String? = nil) {
        self.message = message
        self.code = code
    }
}

public struct ETLOperationResult: Identifiable, Sendable {
    public let operationId: UUID
    public let operation: ETLOperation
    public let status: ETLResultStatus
    public let startedAt: Date
    public let completedAt: Date
    public let totalDuration: TimeInterval
    public let processedItems: Int
    public let importedNodes: [Node]
    public let errors: [ETLErrorInfo]

    public var id: UUID { operationId }
    public var successRate: Double {
        guard processedItems > 0 else { return 0.0 }
        return Double(importedNodes.count) / Double(processedItems)
    }
}

public enum ETLOperationStatus: Codable, Sendable {
    case created
    case queued
    case running
    case completed
    case failed
    case cancelled
}

public enum ETLExecutionStatus: Equatable {
    case preparing
    case running
    case cancelling
    case cancelled
}

public enum ETLResultStatus: Codable, Sendable {
    case success
    case partialSuccess
    case failed(String)

    public var isSuccess: Bool {
        switch self {
        case .success, .partialSuccess: return true
        case .failed: return false
        }
    }
}

public enum ETLPhase: CaseIterable, Codable, Sendable {
    case preparing
    case scanning
    case extracting
    case transforming
    case validating
    case loading
    case finalizing

    public var displayName: String {
        switch self {
        case .preparing: return "Preparing"
        case .scanning: return "Scanning Sources"
        case .extracting: return "Extracting Data"
        case .transforming: return "Transforming"
        case .validating: return "Validating"
        case .loading: return "Loading to Database"
        case .finalizing: return "Finalizing"
        }
    }

    public var systemImage: String {
        switch self {
        case .preparing: return "gearshape"
        case .scanning: return "magnifyingglass"
        case .extracting: return "arrow.down.doc"
        case .transforming: return "arrow.triangle.2.circlepath"
        case .validating: return "checkmark.shield"
        case .loading: return "arrow.up.doc"
        case .finalizing: return "checkmark.circle"
        }
    }
}

// MARK: - Operation Templates

public struct ETLOperationTemplate: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let description: String
    public let category: ETLCategory
    public let estimatedDuration: TimeInterval
    public let complexity: ETLComplexity
    public let requiredPermissions: [ETLPermission]
    public let supportedSources: [ETLSourceType]
    public let defaultConfiguration: ETLOperationConfiguration

    public static let allTemplates: [ETLOperationTemplate] = [
        .appleNotesImport,
        .appleRemindersImport,
        .appleCalendarImport,
        .appleContactsImport,
        .safariDataImport,
        .bulkOfficeImport,
        .sqliteDirectSync,
        .fullSystemImport,
        .dataExportArchive,
        .cloudSyncSetup
    ]
}

public enum ETLCategory: String, CaseIterable, Codable, Sendable {
    case `import` = "Import"
    case export = "Export"
    case sync = "Sync"
    case maintenance = "Maintenance"

    public var systemImage: String {
        switch self {
        case .import: return "square.and.arrow.down"
        case .export: return "square.and.arrow.up"
        case .sync: return "arrow.triangle.2.circlepath"
        case .maintenance: return "wrench.and.screwdriver"
        }
    }
}

public enum ETLComplexity: String, CaseIterable, Codable, Sendable {
    case simple = "Simple"
    case moderate = "Moderate"
    case complex = "Complex"
    case advanced = "Advanced"

    public var color: String {
        switch self {
        case .simple: return "green"
        case .moderate: return "blue"
        case .complex: return "orange"
        case .advanced: return "red"
        }
    }
}

public enum ETLPermission: String, CaseIterable, Codable, Sendable {
    case notes = "Notes Access"
    case reminders = "Reminders Access"
    case calendar = "Calendar Access"
    case contacts = "Contacts Access"
    case fileSystem = "File System Access"
    case network = "Network Access"
    case fullDiskAccess = "Full Disk Access"

    public var systemImage: String {
        switch self {
        case .notes: return "note.text"
        case .reminders: return "checklist"
        case .calendar: return "calendar"
        case .contacts: return "person.crop.circle"
        case .fileSystem: return "folder"
        case .network: return "network"
        case .fullDiskAccess: return "externaldrive"
        }
    }
}

public enum ETLSourceType: String, CaseIterable, Codable, Sendable {
    case appleNotes = "Apple Notes"
    case appleReminders = "Apple Reminders"
    case appleCalendar = "Apple Calendar"
    case appleContacts = "Apple Contacts"
    case safari = "Safari"
    case files = "Files"
    case sqliteDatabase = "SQLite Database"
    case cloudService = "Cloud Service"

    public var systemImage: String {
        switch self {
        case .appleNotes: return "note.text"
        case .appleReminders: return "checklist"
        case .appleCalendar: return "calendar"
        case .appleContacts: return "person.crop.circle"
        case .safari: return "safari"
        case .files: return "folder"
        case .sqliteDatabase: return "cylinder"
        case .cloudService: return "icloud"
        }
    }
}

public struct ETLOperationConfiguration: Codable, Hashable, Equatable, Sendable {
    public var batchSize: Int
    public var enabledSources: [ETLSourceType]
    public var outputFolder: String?
    public var preserveMetadata: Bool
    public var enableDeduplication: Bool
    public var customFilters: [String]
    public var dateRange: DateInterval?

    public static let `default` = ETLOperationConfiguration(
        batchSize: 500,
        enabledSources: [],
        outputFolder: nil,
        preserveMetadata: true,
        enableDeduplication: true,
        customFilters: [],
        dateRange: nil
    )
}

// MARK: - Predefined Templates

extension ETLOperationTemplate {
    public static let appleNotesImport = ETLOperationTemplate(
        id: "apple-notes-import",
        name: "Import Apple Notes",
        description: "Direct sync with Apple Notes database for complete note history",
        category: .import,
        estimatedDuration: 120, // 2 minutes
        complexity: .moderate,
        requiredPermissions: [.notes, .fullDiskAccess],
        supportedSources: [.appleNotes],
        defaultConfiguration: ETLOperationConfiguration(
            batchSize: 500,
            enabledSources: [.appleNotes],
            outputFolder: "notes-import",
            preserveMetadata: true,
            enableDeduplication: true,
            customFilters: [],
            dateRange: nil
        )
    )

    public static let appleRemindersImport = ETLOperationTemplate(
        id: "apple-reminders-import",
        name: "Import Apple Reminders",
        description: "Sync with Reminders app including tasks, lists, and completion status",
        category: .import,
        estimatedDuration: 60, // 1 minute
        complexity: .simple,
        requiredPermissions: [.reminders],
        supportedSources: [.appleReminders],
        defaultConfiguration: ETLOperationConfiguration(
            batchSize: 200,
            enabledSources: [.appleReminders],
            outputFolder: "reminders-import",
            preserveMetadata: true,
            enableDeduplication: true,
            customFilters: [],
            dateRange: nil
        )
    )

    public static let appleCalendarImport = ETLOperationTemplate(
        id: "apple-calendar-import",
        name: "Import Apple Calendar",
        description: "Import calendar events with full metadata and recurrence patterns",
        category: .import,
        estimatedDuration: 90, // 1.5 minutes
        complexity: .moderate,
        requiredPermissions: [.calendar],
        supportedSources: [.appleCalendar],
        defaultConfiguration: ETLOperationConfiguration(
            batchSize: 300,
            enabledSources: [.appleCalendar],
            outputFolder: "calendar-import",
            preserveMetadata: true,
            enableDeduplication: true,
            customFilters: [],
            dateRange: DateInterval(start: Calendar.current.date(byAdding: .year, value: -1, to: Date()) ?? Date(), end: Date())
        )
    )

    public static let appleContactsImport = ETLOperationTemplate(
        id: "apple-contacts-import",
        name: "Import Apple Contacts",
        description: "Import contact information with relationships and custom fields",
        category: .import,
        estimatedDuration: 45, // 45 seconds
        complexity: .simple,
        requiredPermissions: [.contacts],
        supportedSources: [.appleContacts],
        defaultConfiguration: ETLOperationConfiguration(
            batchSize: 100,
            enabledSources: [.appleContacts],
            outputFolder: "contacts-import",
            preserveMetadata: true,
            enableDeduplication: true,
            customFilters: [],
            dateRange: nil
        )
    )

    public static let safariDataImport = ETLOperationTemplate(
        id: "safari-data-import",
        name: "Import Safari Data",
        description: "Import bookmarks, reading list, and browsing history",
        category: .import,
        estimatedDuration: 30, // 30 seconds
        complexity: .simple,
        requiredPermissions: [.fullDiskAccess],
        supportedSources: [.safari],
        defaultConfiguration: ETLOperationConfiguration(
            batchSize: 500,
            enabledSources: [.safari],
            outputFolder: "safari-import",
            preserveMetadata: true,
            enableDeduplication: true,
            customFilters: [],
            dateRange: nil
        )
    )

    public static let bulkOfficeImport = ETLOperationTemplate(
        id: "bulk-office-import",
        name: "Bulk Office Documents",
        description: "Import XLSX, DOCX files from selected folders with content extraction",
        category: .import,
        estimatedDuration: 300, // 5 minutes
        complexity: .complex,
        requiredPermissions: [.fileSystem],
        supportedSources: [.files],
        defaultConfiguration: ETLOperationConfiguration(
            batchSize: 50,
            enabledSources: [.files],
            outputFolder: "office-import",
            preserveMetadata: true,
            enableDeduplication: true,
            customFilters: ["*.xlsx", "*.docx", "*.xls", "*.doc"],
            dateRange: nil
        )
    )

    public static let sqliteDirectSync = ETLOperationTemplate(
        id: "sqlite-direct-sync",
        name: "Direct SQLite Sync",
        description: "Direct database-to-database sync with schema detection",
        category: .sync,
        estimatedDuration: 180, // 3 minutes
        complexity: .advanced,
        requiredPermissions: [.fileSystem, .fullDiskAccess],
        supportedSources: [.sqliteDatabase],
        defaultConfiguration: ETLOperationConfiguration(
            batchSize: 1000,
            enabledSources: [.sqliteDatabase],
            outputFolder: "sqlite-sync",
            preserveMetadata: true,
            enableDeduplication: false,
            customFilters: [],
            dateRange: nil
        )
    )

    public static let fullSystemImport = ETLOperationTemplate(
        id: "full-system-import",
        name: "Complete System Import",
        description: "Import all available Apple app data in one comprehensive operation",
        category: .import,
        estimatedDuration: 600, // 10 minutes
        complexity: .advanced,
        requiredPermissions: [.notes, .reminders, .calendar, .contacts, .fullDiskAccess],
        supportedSources: [.appleNotes, .appleReminders, .appleCalendar, .appleContacts, .safari],
        defaultConfiguration: ETLOperationConfiguration(
            batchSize: 500,
            enabledSources: [.appleNotes, .appleReminders, .appleCalendar, .appleContacts, .safari],
            outputFolder: "full-import",
            preserveMetadata: true,
            enableDeduplication: true,
            customFilters: [],
            dateRange: nil
        )
    )

    public static let dataExportArchive = ETLOperationTemplate(
        id: "data-export-archive",
        name: "Create Export Archive",
        description: "Export all database content to multiple formats (JSON, CSV, XLSX)",
        category: .export,
        estimatedDuration: 240, // 4 minutes
        complexity: .complex,
        requiredPermissions: [.fileSystem],
        supportedSources: [],
        defaultConfiguration: ETLOperationConfiguration(
            batchSize: 1000,
            enabledSources: [],
            outputFolder: "exports",
            preserveMetadata: true,
            enableDeduplication: false,
            customFilters: [],
            dateRange: nil
        )
    )

    public static let cloudSyncSetup = ETLOperationTemplate(
        id: "cloud-sync-setup",
        name: "Setup Cloud Sync",
        description: "Configure and initialize CloudKit synchronization",
        category: .sync,
        estimatedDuration: 300, // 5 minutes
        complexity: .moderate,
        requiredPermissions: [.network],
        supportedSources: [.cloudService],
        defaultConfiguration: ETLOperationConfiguration(
            batchSize: 100,
            enabledSources: [.cloudService],
            outputFolder: nil,
            preserveMetadata: true,
            enableDeduplication: true,
            customFilters: [],
            dateRange: nil
        )
    )
}