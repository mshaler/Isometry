import SwiftUI

/// Main entry point for the Isometry app
@main
public struct IsometryApp: App {
    @StateObject private var appState = AppState()

    public init() {}

    public var body: some Scene {
        WindowGroup {
            #if os(macOS)
            MacOSContentView()
                .environmentObject(appState)
            #else
            ContentView()
                .environmentObject(appState)
            #endif
        }
        #if os(macOS)
        .windowStyle(.hiddenTitleBar)
        .windowToolbarStyle(.unified(showsTitle: false))
        .defaultSize(width: 1200, height: 800)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Note") {
                    // Create new note
                }
                .keyboardShortcut("n", modifiers: .command)

                Button("New Folder") {
                    // Create new folder
                }
                .keyboardShortcut("n", modifiers: [.command, .shift])
            }

            CommandMenu("View") {
                Button("Show Sidebar") {
                    // Toggle sidebar
                }
                .keyboardShortcut("s", modifiers: [.command, .control])

                Divider()

                Button("Zoom In") { }
                    .keyboardShortcut("+", modifiers: .command)

                Button("Zoom Out") { }
                    .keyboardShortcut("-", modifiers: .command)
            }
        }
        #endif

        #if os(macOS)
        Settings {
            MacOSSettingsView()
                .environmentObject(appState)
        }
        #endif
    }
}

/// Global app state
@MainActor
public final class AppState: ObservableObject {
    // MARK: - Published Properties

    @Published public var isLoading = true
    @Published public var error: Error?
    @Published public var syncStatus: SyncStatus = .idle

    // MARK: - Database

    public private(set) var database: IsometryDatabase?
    public private(set) var syncManager: CloudKitSyncManager?

    // MARK: - Initialization

    public init() {
        Task {
            await initializeDatabase()
        }
    }

    private func initializeDatabase() async {
        do {
            // Get database path
            let fileManager = FileManager.default
            let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            let dbDirectory = appSupport.appendingPathComponent("Isometry", isDirectory: true)

            try fileManager.createDirectory(at: dbDirectory, withIntermediateDirectories: true)

            let dbPath = dbDirectory.appendingPathComponent("isometry.sqlite").path

            // Initialize database
            let db = try IsometryDatabase(path: dbPath)
            try await db.initialize()
            self.database = db

            // Initialize sync manager
            let sync = CloudKitSyncManager(database: db)
            self.syncManager = sync

            isLoading = false

        } catch {
            self.error = error
            isLoading = false
        }
    }

    // MARK: - Sync

    public func sync() async {
        guard let syncManager else { return }

        syncStatus = .syncing
        do {
            try await syncManager.sync()
            syncStatus = .synced
        } catch {
            syncStatus = .error(error)
        }
    }
}

/// Sync status enum
public enum SyncStatus: Equatable {
    case idle
    case syncing
    case synced
    case error(Error)

    public static func == (lhs: SyncStatus, rhs: SyncStatus) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.syncing, .syncing), (.synced, .synced):
            return true
        case (.error, .error):
            return true
        default:
            return false
        }
    }
}
