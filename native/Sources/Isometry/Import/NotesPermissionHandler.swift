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
                notesAccessHeaderView
                permissionStatusIndicator

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
            }
        }

        private var permissionRestrictedView: some View {
            VStack(spacing: 16) {
                Text("Notes access is restricted")
                    .font(.headline)
                    .foregroundColor(.orange)

                Text("Your system administrator has restricted Notes access.")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
            }
        }

        private var permissionGrantedView: some View {
            VStack(spacing: 16) {
                Text("Notes access granted!")
                    .font(.headline)
                    .foregroundColor(.green)

                Text("Isometry can now synchronize your notes in real-time.")
                    .font(.subheadline)
                    .multilineTextAlignment(.center)

                Button("Continue to Isometry") {
                    onPermissionGranted()
                }
                .buttonStyle(.borderedProminent)
            }
        }

        private var actionButtonsView: some View {
            VStack(spacing: 12) {
                if permissionStatus == .notDetermined {
                    Button(action: {
                        Task { await requestPermission() }
                    }) {
                        HStack {
                            if isRequesting {
                                ProgressView().scaleEffect(0.8)
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
                }
            }
        }

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

                        instructionsListView
                    }
                    .padding()
                }
                .navigationTitle("Permission Instructions")
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
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

        private var instructionsListView: some View {
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
        }

        private func loadInstructions() async {
            let instructionList = await notesAccessManager.getPermissionInstructions()
            await MainActor.run {
                instructions = instructionList
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