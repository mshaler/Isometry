import Foundation
import SwiftUI
import EventKit

/// Comprehensive permission management UI and user flow for Apple Notes access
/// Provides user-friendly interfaces following iOS Human Interface Guidelines
public struct NotesPermissionHandler {
    private let notesAccessManager: NotesAccessManager

    public init(notesAccessManager: NotesAccessManager = NotesAccessManager()) {
        self.notesAccessManager = notesAccessManager
    }

    // MARK: - Permission Flow UI Components

    /// Main permission request view with clear explanation
    public struct PermissionRequestView: View {
        @State private var permissionStatus: NotesAccessManager.PermissionStatus = .notDetermined
        @State private var isRequesting = false
        @State private var showingInstructions = false
        @State private var statusMessage = ""

        private let notesAccessManager: NotesAccessManager
        private let onPermissionGranted: () -> Void
        private let onFallbackSelected: () -> Void

        public init(
            notesAccessManager: NotesAccessManager,
            onPermissionGranted: @escaping () -> Void = {},
            onFallbackSelected: @escaping () -> Void = {}
        ) {
            self.notesAccessManager = notesAccessManager
            self.onPermissionGranted = onPermissionGranted
            self.onFallbackSelected = onFallbackSelected
        }

        public var body: some View {
            VStack(spacing: 24) {
                // Header
                notesAccessHeaderView

                // Status indicator
                permissionStatusIndicator

                // Main content based on status
                Group {
                    switch permissionStatus {
                    case .notDetermined:
                        initialPermissionRequestView
                    case .denied:
                        permissionDeniedView
                    case .restricted:
                        permissionRestrictedView
                    case .authorized:
                        permissionGrantedView
                    }
                }

                // Action buttons
                actionButtonsView

                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 32)
            .task {
                await updatePermissionStatus()
            }
        }

        // MARK: - UI Components

        private var notesAccessHeaderView: some View {
            VStack(spacing: 16) {
                Image(systemName: "note.text")
                    .font(.system(size: 64))
                    .foregroundColor(.blue)

                VStack(spacing: 8) {
                    Text("Connect to Apple Notes")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .multilineTextAlignment(.center)

                    Text("Enhance Isometry with your Notes data")
                        .font(.title3)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
        }

        private var permissionStatusIndicator: some View {
            HStack(spacing: 12) {
                Group {
                    switch permissionStatus {
                    case .authorized:
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    case .denied, .restricted:
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.red)
                    case .notDetermined:
                        Image(systemName: "questionmark.circle.fill")
                            .foregroundColor(.orange)
                    }
                }
                .font(.title2)

                Text(statusMessage)
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Spacer()
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(12)
        }

        private var initialPermissionRequestView: some View {
            VStack(spacing: 16) {
                Text("Why Isometry needs Notes access")
                    .font(.headline)

                VStack(alignment: .leading, spacing: 12) {
                    benefitItem(icon: "arrow.triangle.2.circlepath", title: "Real-time synchronization", description: "Updates instantly when you modify notes")
                    benefitItem(icon: "doc.text.magnifyingglass", title: "Complete note access", description: "Import all notes, folders, and metadata")
                    benefitItem(icon: "shield.lefthalf.filled", title: "Privacy protected", description: "Data stays on your device")
                    benefitItem(icon: "speedometer", title: "Faster performance", description: "Direct database access vs. manual exports")
                }

                Divider()
                    .padding(.vertical, 8)

                VStack(spacing: 8) {
                    Text("Alternative: Alto-index Export")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Text("If you prefer not to grant access, you can use periodic exports via the alto-index tool.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
        }

        private var permissionDeniedView: some View {
            VStack(spacing: 16) {
                Text("Notes access is currently denied")
                    .font(.headline)
                    .foregroundColor(.red)

                Text("To enable real-time synchronization with Apple Notes, you'll need to grant permission in System Settings.")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)

                Button("Show Instructions") {
                    showingInstructions = true
                }
                .buttonStyle(.borderedProminent)

                alternativeSyncOptionsView
            }
        }

        private var permissionRestrictedView: some View {
            VStack(spacing: 16) {
                Text("Notes access is restricted")
                    .font(.headline)
                    .foregroundColor(.orange)

                Text("Your system administrator has restricted Notes access. Contact them to modify privacy settings.")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)

                alternativeSyncOptionsView
            }
        }

        private var permissionGrantedView: some View {
            VStack(spacing: 16) {
                Text("Notes access granted!")
                    .font(.headline)
                    .foregroundColor(.green)

                Text("Isometry can now synchronize your notes in real-time. Changes in Apple Notes will appear automatically.")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)

                Button("Continue to Isometry") {
                    onPermissionGranted()
                }
                .buttonStyle(.borderedProminent)
            }
        }

        private var alternativeSyncOptionsView: some View {
            VStack(spacing: 12) {
                Text("Alternative Sync Options")
                    .font(.subheadline)
                    .fontWeight(.medium)

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "terminal")
                            .foregroundColor(.blue)
                        Text("Use alto-index export tool for periodic sync")
                            .font(.caption)
                    }

                    HStack {
                        Image(systemName: "arrow.clockwise")
                            .foregroundColor(.orange)
                        Text("Manual export when you want to update")
                            .font(.caption)
                    }

                    HStack {
                        Image(systemName: "shield")
                            .foregroundColor(.green)
                        Text("No system permissions required")
                            .font(.caption)
                    }
                }

                Button("Set up Alto-index Export") {
                    onFallbackSelected()
                }
                .buttonStyle(.bordered)
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(12)
        }

        private var actionButtonsView: some View {
            VStack(spacing: 12) {
                if permissionStatus == .notDetermined {
                    Button(action: {
                        Task {
                            await requestPermission()
                        }
                    }) {
                        HStack {
                            if isRequesting {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "key.horizontal")
                            }
                            Text(isRequesting ? "Requesting Permission..." : "Grant Notes Access")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isRequesting)

                    Button("Use Alto-index Instead") {
                        onFallbackSelected()
                    }
                    .buttonStyle(.bordered)

                } else if permissionStatus == .denied {
                    Button("Open System Settings") {
                        openSystemSettings()
                    }
                    .buttonStyle(.borderedProminent)

                    Button("Check Permission Again") {
                        Task {
                            await updatePermissionStatus()
                        }
                    }
                    .buttonStyle(.bordered)
                }
            }
        }

        // MARK: - Helper Views

        private func benefitItem(icon: String, title: String, description: String) -> some View {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: icon)
                    .foregroundColor(.blue)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
        }

        // MARK: - Actions

        private func requestPermission() async {
            isRequesting = true

            do {
                let newStatus = try await notesAccessManager.requestNotesAccess()
                await MainActor.run {
                    permissionStatus = newStatus
                    isRequesting = false
                    updateStatusMessage()

                    if newStatus == .authorized {
                        onPermissionGranted()
                    }
                }
            } catch {
                await MainActor.run {
                    isRequesting = false
                    statusMessage = "Permission request failed: \(error.localizedDescription)"
                }
            }
        }

        private func updatePermissionStatus() async {
            let status = await notesAccessManager.checkCurrentPermissionStatus()
            let message = await notesAccessManager.getPermissionStatusMessage()

            await MainActor.run {
                permissionStatus = status
                statusMessage = message
            }
        }

        private func updateStatusMessage() {
            Task {
                let message = await notesAccessManager.getPermissionStatusMessage()
                await MainActor.run {
                    statusMessage = message
                }
            }
        }

        private func openSystemSettings() {
            if let settingsUrl = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_FullDiskAccess") {
                NSWorkspace.shared.open(settingsUrl)
            }
        }
    }

    // MARK: - Instructions Modal

    /// Detailed permission instructions modal
    public struct PermissionInstructionsView: View {
        @Environment(\.dismiss) private var dismiss
        @State private var instructions: [String] = []

        private let notesAccessManager: NotesAccessManager

        public init(notesAccessManager: NotesAccessManager) {
            self.notesAccessManager = notesAccessManager
        }

        public var body: some View {
            NavigationView {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        Text("Enabling Notes Access")
                            .font(.largeTitle)
                            .fontWeight(.bold)

                        Text("Follow these steps to grant Isometry access to your Apple Notes:")
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        VStack(alignment: .leading, spacing: 16) {
                            ForEach(Array(instructions.enumerated()), id: \.offset) { index, instruction in
                                HStack(alignment: .top, spacing: 12) {
                                    Text("\(index + 1)")
                                        .font(.subheadline)
                                        .fontWeight(.bold)
                                        .foregroundColor(.white)
                                        .frame(width: 24, height: 24)
                                        .background(Color.blue)
                                        .clipShape(Circle())

                                    Text(instruction)
                                        .font(.subheadline)

                                    Spacer()
                                }
                            }
                        }

                        if instructions.contains(where: { $0.contains("Alternative") }) {
                            Divider()

                            AltoIndexSetupView()
                        }
                    }
                    .padding()
                }
                .navigationTitle("Permission Instructions")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    #if os(iOS)
                    ToolbarItem(placement: .navigationBarTrailing) {
                    #else
                    ToolbarItem(placement: .primaryAction) {
                    #endif
                        Button("Done") {
                            dismiss()
                        }
                    }
                }
            }
            .task {
                await loadInstructions()
            }
        }

        private func loadInstructions() async {
            let instructionList = await notesAccessManager.getPermissionInstructions()
            await MainActor.run {
                instructions = instructionList
            }
        }
    }

    // MARK: - Alto-index Setup Guide

    /// Guide for setting up alto-index as fallback
    public struct AltoIndexSetupView: View {
        @State private var isSetupComplete = false

        public var body: some View {
            VStack(alignment: .leading, spacing: 16) {
                Text("Alto-index Export Setup")
                    .font(.headline)

                Text("If you prefer not to grant system access, you can use the alto-index tool for periodic synchronization:")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                VStack(alignment: .leading, spacing: 12) {
                    setupStep(
                        number: 1,
                        title: "Install alto-index",
                        description: "pip install alto-index",
                        isCode: true
                    )

                    setupStep(
                        number: 2,
                        title: "Export your notes",
                        description: "alto-index export ~/Documents/alto-index",
                        isCode: true
                    )

                    setupStep(
                        number: 3,
                        title: "Import to Isometry",
                        description: "Isometry will automatically detect and sync the exported notes"
                    )

                    setupStep(
                        number: 4,
                        title: "Update periodically",
                        description: "Re-run the export command when you want to sync new changes"
                    )
                }

                Button(action: {
                    isSetupComplete.toggle()
                }) {
                    HStack {
                        Image(systemName: isSetupComplete ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(isSetupComplete ? .green : .gray)
                        Text("I've completed the setup")
                    }
                }
                .buttonStyle(.plain)
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(12)
        }

        private func setupStep(number: Int, title: String, description: String, isCode: Bool = false) -> some View {
            HStack(alignment: .top, spacing: 12) {
                Text("\(number)")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.white)
                    .frame(width: 20, height: 20)
                    .background(Color.orange)
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    if isCode {
                        Text(description)
                            .font(.system(.caption, design: .monospaced))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color(NSColor.unemphasizedSelectedContentBackgroundColor))
                            .cornerRadius(6)
                    } else {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()
            }
        }
    }

    // MARK: - Settings Integration

    /// Settings panel for Notes integration management
    public struct NotesIntegrationSettingsView: View {
        @State private var permissionStatus: NotesAccessManager.PermissionStatus = .notDetermined
        @State private var accessLevel: NotesAccessManager.AccessLevel = .none
        @State private var showingPermissionSheet = false

        private let notesAccessManager: NotesAccessManager

        public init(notesAccessManager: NotesAccessManager) {
            self.notesAccessManager = notesAccessManager
        }

        public var body: some View {
            VStack(spacing: 20) {
                // Current status
                settingsStatusView

                // Access level indicator
                accessLevelView

                // Action buttons
                settingsActionsView

                // Privacy information
                privacyInformationView

                Spacer()
            }
            .padding()
            .task {
                await updateStatus()
            }
        }

        private var settingsStatusView: some View {
            VStack(alignment: .leading, spacing: 12) {
                Text("Notes Integration Status")
                    .font(.headline)

                HStack {
                    statusIcon
                    VStack(alignment: .leading, spacing: 4) {
                        Text(permissionStatus.rawValue.replacingOccurrences(of: "_", with: " ").capitalized)
                            .font(.subheadline)
                            .fontWeight(.medium)

                        Text(accessLevel.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
                .padding()
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(12)
            }
        }

        private var statusIcon: some View {
            Group {
                switch permissionStatus {
                case .authorized:
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                case .denied, .restricted:
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.red)
                case .notDetermined:
                    Image(systemName: "questionmark.circle.fill")
                        .foregroundColor(.orange)
                }
            }
            .font(.title2)
        }

        private var accessLevelView: some View {
            VStack(alignment: .leading, spacing: 8) {
                Text("Available Features")
                    .font(.subheadline)
                    .fontWeight(.medium)

                VStack(spacing: 8) {
                    featureRow(
                        title: "Real-time synchronization",
                        available: accessLevel == .fullAccess,
                        icon: "arrow.triangle.2.circlepath"
                    )

                    featureRow(
                        title: "Complete note access",
                        available: accessLevel != .none,
                        icon: "doc.text"
                    )

                    featureRow(
                        title: "Automatic updates",
                        available: accessLevel == .fullAccess,
                        icon: "arrow.clockwise.circle"
                    )

                    featureRow(
                        title: "Metadata preservation",
                        available: accessLevel != .none,
                        icon: "info.circle"
                    )
                }
            }
        }

        private var settingsActionsView: some View {
            VStack(spacing: 12) {
                if permissionStatus != .authorized {
                    Button("Request Notes Access") {
                        showingPermissionSheet = true
                    }
                    .buttonStyle(.borderedProminent)
                }

                Button("Open System Settings") {
                    openSystemSettings()
                }
                .buttonStyle(.bordered)

                Button("Refresh Status") {
                    Task { await updateStatus() }
                }
                .buttonStyle(.bordered)
            }
        }

        private var privacyInformationView: some View {
            VStack(alignment: .leading, spacing: 12) {
                Text("Privacy Information")
                    .font(.headline)

                let privacyInfo = notesAccessManager.getPrivacyInformation()

                VStack(alignment: .leading, spacing: 8) {
                    Text("Data Types Accessed:")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    ForEach(privacyInfo.dataTypes, id: \.self) { dataType in
                        HStack {
                            Image(systemName: "circle.fill")
                                .font(.system(size: 6))
                                .foregroundColor(.secondary)
                            Text(dataType)
                                .font(.caption)
                        }
                    }
                }

                Text(privacyInfo.usageDescription)
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text(privacyInfo.retentionPolicy)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(12)
        }

        private func featureRow(title: String, available: Bool, icon: String) -> some View {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(available ? .green : .gray)
                    .frame(width: 20)

                Text(title)
                    .font(.caption)
                    .foregroundColor(available ? .primary : .secondary)

                Spacer()

                Image(systemName: available ? "checkmark" : "xmark")
                    .foregroundColor(available ? .green : .red)
                    .font(.system(size: 12))
            }
        }

        private func updateStatus() async {
            let status = await notesAccessManager.checkCurrentPermissionStatus()
            let level = await notesAccessManager.getAvailableAccessLevel()

            await MainActor.run {
                permissionStatus = status
                accessLevel = level
            }
        }

        private func openSystemSettings() {
            if let settingsUrl = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_FullDiskAccess") {
                NSWorkspace.shared.open(settingsUrl)
            }
        }
    }

    // MARK: - Public Interface

    /// Present permission request flow
    public static func presentPermissionRequest(
        from viewController: NSViewController,
        notesAccessManager: NotesAccessManager,
        onPermissionGranted: @escaping () -> Void = {},
        onFallbackSelected: @escaping () -> Void = {}
    ) {
        let permissionView = PermissionRequestView(
            notesAccessManager: notesAccessManager,
            onPermissionGranted: onPermissionGranted,
            onFallbackSelected: onFallbackSelected
        )

        let hostingController = NSHostingController(rootView: permissionView)
        hostingController.preferredContentSize = NSSize(width: 600, height: 700)

        let window = NSWindow(contentViewController: hostingController)
        window.title = "Notes Access Permission"
        window.styleMask = [.titled, .closable]
        window.center()
        window.makeKeyAndOrderFront(nil)
    }

    /// Get permission status indicator for UI
    public static func permissionStatusIndicator(
        for status: NotesAccessManager.PermissionStatus
    ) -> (icon: String, color: Color, text: String) {
        switch status {
        case .authorized:
            return ("checkmark.circle.fill", .green, "Authorized")
        case .denied:
            return ("xmark.circle.fill", .red, "Denied")
        case .restricted:
            return ("exclamationmark.triangle.fill", .orange, "Restricted")
        case .notDetermined:
            return ("questionmark.circle.fill", .orange, "Not Determined")
        }
    }

    /// Check if permission request UI should be shown
    public static func shouldShowPermissionRequest(
        for status: NotesAccessManager.PermissionStatus
    ) -> Bool {
        return status.requiresUserAction
    }
}