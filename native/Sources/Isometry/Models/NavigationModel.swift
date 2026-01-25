import Foundation
import SwiftUI

/// App mode enumeration
public enum AppMode: String, CaseIterable, Codable {
    case main = "main"
    case notebook = "notebook"

    var title: String {
        switch self {
        case .main: return "Isometry"
        case .notebook: return "Notebook"
        }
    }

    var systemImage: String {
        switch self {
        case .main: return "square.grid.3x3"
        case .notebook: return "book.pages"
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