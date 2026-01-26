import Foundation
import SwiftUI

/// App mode enumeration
public enum AppMode: String, CaseIterable, Codable {
    case main = "main"
    case notebook = "notebook"
    case database = "database"

    var title: String {
        switch self {
        case .main: return "Isometry"
        case .notebook: return "Notebook"
        case .database: return "Database"
        }
    }

    var systemImage: String {
        switch self {
        case .main: return "square.grid.3x3"
        case .notebook: return "book.pages"
        case .database: return "cylinder.split.1x2"
        }
    }
}

/// Database management section for v2.2 features
public enum DatabaseSection: String, CaseIterable, Codable {
    case versionControl = "version-control"
    case etlWorkflow = "etl-workflow"
    case dataCatalog = "data-catalog"

    var title: String {
        switch self {
        case .versionControl: return "Version Control"
        case .etlWorkflow: return "ETL Operations"
        case .dataCatalog: return "Data Catalog"
        }
    }

    var systemImage: String {
        switch self {
        case .versionControl: return "arrow.triangle.branch"
        case .etlWorkflow: return "arrow.triangle.2.circlepath.circle"
        case .dataCatalog: return "rectangle.3.group"
        }
    }

    var description: String {
        switch self {
        case .versionControl: return "Git-like database versioning with branch management"
        case .etlWorkflow: return "Extract, Transform, Load operations center"
        case .dataCatalog: return "Sources, Streams, and Surfaces navigator"
        }
    }
}

/// Navigation state management
@MainActor
public final class NavigationModel: ObservableObject {
    @Published public var currentMode: AppMode = .main
    @Published public var previousMode: AppMode = .main

    // State preservation
    @Published public var mainViewState: MainViewState = MainViewState()
    @Published public var notebookViewState: NotebookViewState = NotebookViewState()
    @Published public var databaseViewState: DatabaseViewState = DatabaseViewState()

    // Database management navigation
    @Published public var selectedDatabaseSection: DatabaseSection? = nil

    public var isDatabaseMode: Bool {
        currentMode == .database
    }

    private let userDefaults = UserDefaults.standard
    private let currentModeKey = "NavigationModel.currentMode"

    public init() {
        loadPersistedState()
    }

    public func switchMode(to newMode: AppMode) {
        previousMode = currentMode
        currentMode = newMode
        savePersistedState()
    }

    public func toggleMode() {
        let newMode: AppMode = currentMode == .main ? .notebook : .main
        switchMode(to: newMode)
    }

    public func switchToDatabaseSection(_ section: DatabaseSection) {
        switchMode(to: .database)
        selectedDatabaseSection = section
        databaseViewState.selectedSection = section
    }

    public func navigateToVersionControl() {
        switchToDatabaseSection(.versionControl)
    }

    public func navigateToETLWorkflow() {
        switchToDatabaseSection(.etlWorkflow)
    }

    public func navigateToDataCatalog() {
        switchToDatabaseSection(.dataCatalog)
    }

    private func loadPersistedState() {
        if let modeString = userDefaults.string(forKey: currentModeKey),
           let mode = AppMode(rawValue: modeString) {
            currentMode = mode
        }
    }

    private func savePersistedState() {
        userDefaults.set(currentMode.rawValue, forKey: currentModeKey)
    }
}

// State preservation structures
public struct MainViewState: Codable {
    public var selectedFolder: String?
    public var searchText: String = ""
}

public struct NotebookViewState: Codable {
    public var selectedCardId: String?
    public var lastEditingComponent: String? // "capture", "shell", "preview"
}

public struct DatabaseViewState: Codable {
    public var selectedSection: DatabaseSection?
    public var versionControlBranch: String?
    public var etlSelectedTemplate: String?
    public var catalogSelectedCategory: String?

    public init() {
        selectedSection = nil
        versionControlBranch = nil
        etlSelectedTemplate = nil
        catalogSelectedCategory = nil
    }
}