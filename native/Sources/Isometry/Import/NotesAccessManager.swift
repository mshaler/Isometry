import Foundation
import EventKit

/// TCC permission and authorization management for Apple Notes access
/// Provides graceful degradation and privacy compliance
public actor NotesAccessManager {

    // Permission tracking
    private var currentStatus: PermissionStatus = .notDetermined
    private var lastPermissionCheck: Date = .distantPast
    private var permissionCallbacks: [(PermissionStatus) -> Void] = []

    // EventKit store for Notes access
    private let eventStore = EKEventStore()

    public init() {
        Task {
            await updatePermissionStatus()
        }
    }

    // MARK: - Permission Status Management

    /// Current permission status for Notes access
    public enum PermissionStatus: String, Sendable, CaseIterable {
        case notDetermined = "not_determined"
        case denied = "denied"
        case restricted = "restricted"
        case authorized = "authorized"

        public var isAccessible: Bool {
            return self == .authorized
        }

        public var requiresUserAction: Bool {
            return self == .notDetermined || self == .denied
        }
    }

    /// Available access levels based on current permissions
    public enum AccessLevel: String, Sendable, CaseIterable {
        case none = "none"
        case readOnly = "read_only"
        case fullAccess = "full_access"

        public var description: String {
            switch self {
            case .none:
                return "No access available"
            case .readOnly:
                return "Read-only access via alto-index export"
            case .fullAccess:
                return "Full live access to Apple Notes"
            }
        }
    }

    // MARK: - Permission Request and Status

    /// Request Notes access permission from user
    public func requestNotesAccess() async throws -> PermissionStatus {
        print("Requesting Notes access permission...")

        return try await withCheckedThrowingContinuation { continuation in
            // Request access for Notes (which maps to Reminders in EventKit)
            eventStore.requestFullAccessToReminders { [weak self] granted, error in
                Task {
                    await self?.handlePermissionResponse(granted: granted, error: error, continuation: continuation)
                }
            }
        }
    }

    /// Check current permission status without prompting user
    public func checkCurrentPermissionStatus() async -> PermissionStatus {
        // Cache permission status for 30 seconds to avoid repeated system calls
        let now = Date()
        if now.timeIntervalSince(lastPermissionCheck) < 30.0 {
            return currentStatus
        }

        await updatePermissionStatus()
        return currentStatus
    }

    /// Get available access level based on current permissions
    public func getAvailableAccessLevel() async -> AccessLevel {
        let status = await checkCurrentPermissionStatus()

        switch status {
        case .authorized:
            return .fullAccess
        case .denied, .restricted, .notDetermined:
            // Check if alto-index export is available as fallback
            if await isAltoIndexExportAvailable() {
                return .readOnly
            } else {
                return .none
            }
        }
    }

    // MARK: - Permission Change Monitoring

    /// Add callback for permission status changes
    public func addPermissionChangeCallback(_ callback: @escaping (PermissionStatus) -> Void) {
        permissionCallbacks.append(callback)
    }

    /// Remove all permission change callbacks
    public func clearPermissionChangeCallbacks() {
        permissionCallbacks.removeAll()
    }

    // MARK: - User Messaging and Guidance

    /// Get user-friendly message about current permission status
    public func getPermissionStatusMessage() async -> String {
        let status = await checkCurrentPermissionStatus()

        switch status {
        case .notDetermined:
            return "Isometry needs permission to access your Apple Notes for live synchronization. This allows real-time updates when you make changes in the Notes app."

        case .denied:
            return "Notes access is currently denied. You can enable it in System Settings > Privacy & Security > Full Disk Access to enable live synchronization. Alternatively, Isometry can use exported notes via the alto-index tool."

        case .restricted:
            return "Notes access is restricted by your system administrator. Isometry will use exported notes via the alto-index tool for synchronization."

        case .authorized:
            return "Notes access is authorized. Isometry can synchronize your notes in real-time."
        }
    }

    /// Get step-by-step instructions for granting permission
    public func getPermissionInstructions() async -> [String] {
        let status = await checkCurrentPermissionStatus()

        switch status {
        case .notDetermined:
            return [
                "Click 'Allow' when prompted for Notes access",
                "This enables real-time synchronization with Apple Notes"
            ]

        case .denied:
            return [
                "Open System Settings (or System Preferences on older macOS)",
                "Navigate to Privacy & Security > Full Disk Access",
                "Find Isometry in the list and toggle it on",
                "Restart Isometry to enable live synchronization",
                "Alternative: Use alto-index export for periodic sync"
            ]

        case .restricted:
            return [
                "Contact your system administrator to modify privacy restrictions",
                "Alternative: Use alto-index export tool for periodic synchronization",
                "Export instructions available in app documentation"
            ]

        case .authorized:
            return [
                "Permission already granted",
                "Live synchronization is available"
            ]
        }
    }

    // MARK: - Fallback Access Methods

    /// Check if alto-index export is available as fallback
    private func isAltoIndexExportAvailable() async -> Bool {
        let homeDirectory = FileManager.default.homeDirectoryForCurrentUser
        let altoIndexPaths = [
            homeDirectory.appendingPathComponent("Documents/alto-index"),
            homeDirectory.appendingPathComponent("Desktop/alto-index"),
            homeDirectory.appendingPathComponent("Downloads/alto-index")
        ]

        for path in altoIndexPaths {
            if FileManager.default.fileExists(atPath: path.path) {
                print("Found alto-index export at: \(path.path)")
                return true
            }
        }

        return false
    }

    /// Get recommended fallback access method
    public func getRecommendedFallbackMethod() async -> (method: String, instructions: [String]) {
        let hasAltoIndex = await isAltoIndexExportAvailable()

        if hasAltoIndex {
            return (
                method: "Alto-index Export",
                instructions: [
                    "Your existing alto-index export was found",
                    "Isometry will use this for periodic synchronization",
                    "Run alto-index periodically to update exported notes",
                    "Live sync will be available when permissions are granted"
                ]
            )
        } else {
            return (
                method: "Setup Alto-index Export",
                instructions: [
                    "Install alto-index: pip install alto-index",
                    "Export your notes: alto-index export ~/Documents/alto-index",
                    "Isometry will automatically detect and sync the exported notes",
                    "Run export periodically for updated content",
                    "Grant full permission for live sync when ready"
                ]
            )
        }
    }

    // MARK: - Privacy Compliance

    /// Get privacy information for App Store compliance
    public func getPrivacyInformation() -> (dataTypes: [String], usageDescription: String, retentionPolicy: String) {
        return (
            dataTypes: [
                "Note titles and content",
                "Note creation and modification dates",
                "Note folder organization",
                "Note tags and metadata"
            ],
            usageDescription: "Isometry accesses your Apple Notes to provide unified knowledge management. Your notes are processed locally and synced with your personal Isometry database. No data is transmitted to external servers without your explicit consent.",
            retentionPolicy: "Notes data is retained locally in your personal Isometry database. You can delete imported notes at any time through the app interface. Data is not shared with third parties."
        )
    }

    /// Log permission request for audit compliance
    private func logPermissionRequest(granted: Bool, error: Error?) {
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let logMessage = "[\(timestamp)] Notes permission request: granted=\(granted), error=\(error?.localizedDescription ?? "none")"

        print("PRIVACY AUDIT: \(logMessage)")

        // In production, this would be logged to a secure audit file
        // following App Store privacy requirements
    }

    // MARK: - Internal Implementation

    /// Update permission status from EventKit
    private func updatePermissionStatus() async {
        let authStatus = EKEventStore.authorizationStatus(for: .reminder)

        currentStatus = mapEventKitStatus(authStatus)
        lastPermissionCheck = Date()

        print("Permission status updated: \(currentStatus.rawValue)")

        // Notify callbacks of status change
        for callback in permissionCallbacks {
            callback(currentStatus)
        }
    }

    /// Map EventKit authorization status to our permission status
    private func mapEventKitStatus(_ status: EKAuthorizationStatus) -> PermissionStatus {
        switch status {
        case .notDetermined:
            return .notDetermined
        case .restricted:
            return .restricted
        case .denied:
            return .denied
        case .fullAccess:
            return .authorized
        case .writeOnly:
            return .denied // We need read access, so write-only is insufficient
        @unknown default:
            return .notDetermined
        }
    }

    /// Handle permission response from EventKit
    private func handlePermissionResponse(
        granted: Bool,
        error: Error?,
        continuation: CheckedContinuation<PermissionStatus, Error>
    ) async {
        // Log for privacy audit
        logPermissionRequest(granted: granted, error: error)

        if let error = error {
            print("Permission request error: \(error.localizedDescription)")
            continuation.resume(throwing: PermissionError.requestFailed(error))
            return
        }

        // Update our status
        await updatePermissionStatus()

        if granted {
            print("Notes permission granted")
            continuation.resume(returning: .authorized)
        } else {
            print("Notes permission denied")
            continuation.resume(returning: .denied)
        }
    }
}

// MARK: - Error Types

public enum PermissionError: Error, LocalizedError {
    case requestFailed(Error)
    case alreadyRequesting
    case unsupportedPlatform

    public var errorDescription: String? {
        switch self {
        case .requestFailed(let error):
            return "Permission request failed: \(error.localizedDescription)"
        case .alreadyRequesting:
            return "Permission request already in progress"
        case .unsupportedPlatform:
            return "Permission requests not supported on this platform"
        }
    }
}

// MARK: - Configuration Support

extension NotesAccessManager {

    /// Configuration for permission behavior
    public struct PermissionConfiguration {
        let automaticRetry: Bool
        let retryDelay: TimeInterval
        let maxRetryAttempts: Int
        let fallbackToExport: Bool

        public static let `default` = PermissionConfiguration(
            automaticRetry: true,
            retryDelay: 30.0,
            maxRetryAttempts: 3,
            fallbackToExport: true
        )

        public static let aggressive = PermissionConfiguration(
            automaticRetry: true,
            retryDelay: 10.0,
            maxRetryAttempts: 5,
            fallbackToExport: true
        )

        public static let conservative = PermissionConfiguration(
            automaticRetry: false,
            retryDelay: 60.0,
            maxRetryAttempts: 1,
            fallbackToExport: true
        )
    }
}