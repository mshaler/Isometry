import SwiftUI

/// Isometry app scene configuration
/// Note: @main entry point is in the IsometryApp executable target
public struct IsometryAppScene: App {
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

            // Initialize sync manager only if CloudKit entitlements are present
            // CKContainer crashes without proper entitlements, so check first
            if Self.isCloudKitAvailable() {
                let sync = CloudKitSyncManager(database: db)
                self.syncManager = sync
            } else {
                print("CloudKit sync disabled: entitlements not configured")
            }

            isLoading = false

        } catch {
            self.error = error
            isLoading = false
        }
    }

    // MARK: - CloudKit Availability Check

    /// Checks if CloudKit entitlements are properly configured
    /// CKContainer will crash without entitlements, so we check the entitlements plist
    private static func isCloudKitAvailable() -> Bool {
        // SwiftUI previews don't have CloudKit
        if ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1" {
            return false
        }

        #if os(iOS) || os(visionOS)
        // On iOS/visionOS, CloudKit is available if the app is properly signed
        // We check for the ubiquity identity token as a proxy
        return FileManager.default.ubiquityIdentityToken != nil
        #elseif os(macOS)
        // On macOS, check for proper code signing with CloudKit entitlements
        guard let entitlements = Bundle.main.infoDictionary else {
            return false
        }

        // Check if we're running from Xcode with a proper signing identity
        if let prefix = entitlements["AppIdentifierPrefix"] as? String, !prefix.isEmpty {
            return true
        }

        // For command-line builds, check if we can read the entitlements
        let hasCodeSignature = Bundle.main.executableURL.flatMap { url in
            let task = Process()
            task.executableURL = URL(fileURLWithPath: "/usr/bin/codesign")
            task.arguments = ["-d", "--entitlements", "-", url.path]
            let pipe = Pipe()
            task.standardOutput = pipe
            task.standardError = pipe
            do {
                try task.run()
                task.waitUntilExit()
                let data = pipe.fileHandleForReading.readDataToEndOfFile()
                let output = String(data: data, encoding: .utf8) ?? ""
                return output.contains("com.apple.developer.icloud-container-identifiers")
            } catch {
                return false
            }
        } ?? false

        return hasCodeSignature
        #else
        return false
        #endif
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

    // MARK: - Import

    @Published public var importStatus: ImportStatus = .idle
    @Published public var lastImportResult: ImportResult?

    /// Imports notes from alto-index directory
    public func importNotes(from url: URL) async {
        guard let db = database else { return }

        importStatus = .importing
        do {
            let importer = AltoIndexImporter(database: db)
            let result = try await importer.importNotes(from: url)
            lastImportResult = result
            importStatus = .completed(imported: result.imported, failed: result.failed)
        } catch {
            importStatus = .failed(error)
        }
    }

    /// Gets the default alto-index notes path
    public static var defaultAltoIndexPath: URL? {
        #if os(macOS)
        let home = FileManager.default.homeDirectoryForCurrentUser
        return home
            .appendingPathComponent("Library/Containers/com.altoindex.AltoIndex/Data/Documents/alto-index/notes")
        #else
        // On iOS, we need to use document picker or file import
        return nil
        #endif
    }
}

/// Import status enum
public enum ImportStatus: Equatable {
    case idle
    case importing
    case completed(imported: Int, failed: Int)
    case failed(Error)

    public static func == (lhs: ImportStatus, rhs: ImportStatus) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.importing, .importing):
            return true
        case (.completed(let lImported, let lFailed), .completed(let rImported, let rFailed)):
            return lImported == rImported && lFailed == rFailed
        case (.failed, .failed):
            return true
        default:
            return false
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
