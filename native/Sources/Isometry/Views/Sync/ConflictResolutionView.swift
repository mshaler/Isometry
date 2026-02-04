import SwiftUI

/// Type alias to disambiguate ConflictResolution
public typealias SyncConflictResolution = CloudKitSyncManager.ConflictResolution

/// View for resolving sync conflicts between local and remote versions
public struct ConflictResolutionView: View {
    // MARK: - Properties

    let conflict: SyncConflict
    let onResolve: (SyncConflictResolution) -> Void
    let onDismiss: () -> Void

    @State private var selectedResolution: ConflictResolutionChoice?
    @State private var isResolving = false

    // MARK: - Resolution Choice

    enum ConflictResolutionChoice: String, CaseIterable {
        case keepLocal = "Keep Local"
        case keepRemote = "Keep Remote"
        case merge = "Merge Both"

        var icon: String {
            switch self {
            case .keepLocal: return "iphone"
            case .keepRemote: return "cloud"
            case .merge: return "arrow.triangle.merge"
            }
        }

        var description: String {
            switch self {
            case .keepLocal: return "Use your local version"
            case .keepRemote: return "Use the cloud version"
            case .merge: return "Combine both versions"
            }
        }
    }

    // MARK: - Body

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                conflictHeader
                    .padding()

                Divider()

                comparisonView
                    .padding()

                Divider()

                resolutionPicker
                    .padding()

                Spacer()
            }
            .navigationTitle("Sync Conflict")
            #if os(iOS)
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        onDismiss()
                    }
                    .disabled(isResolving)
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Resolve") {
                        resolveConflict()
                    }
                    .disabled(selectedResolution == nil || isResolving)
                }
            }
        }
    }

    // MARK: - Subviews

    private var conflictHeader: some View {
        VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.largeTitle)
                .foregroundStyle(.orange)

            Text("Conflict Detected")
                .font(.headline)

            Text("This item was modified both locally and in the cloud.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Text(conflictTypeDescription)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(Color.orange.opacity(0.2))
                .clipShape(Capsule())
        }
    }

    private var conflictTypeDescription: String {
        switch conflict.conflictType {
        case .bothModified:
            return "Both versions modified"
        case .localDeleted:
            return "Deleted locally, modified remotely"
        case .serverDeleted:
            return "Deleted remotely, modified locally"
        case .versionMismatch:
            return "Version mismatch"
        }
    }

    private var comparisonView: some View {
        HStack(spacing: 16) {
            versionCard(
                title: "Local Version",
                icon: "iphone",
                node: conflict.localNode,
                isLocal: true
            )

            Image(systemName: "arrow.left.arrow.right")
                .font(.title2)
                .foregroundStyle(.secondary)

            versionCard(
                title: "Cloud Version",
                icon: "cloud",
                node: conflict.serverNode,
                isLocal: false
            )
        }
    }

    private func versionCard(title: String, icon: String, node: Node, isLocal: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                Text(title)
                    .font(.caption.bold())
            }
            .foregroundStyle(isLocal ? .blue : .green)

            VStack(alignment: .leading, spacing: 4) {
                Text(node.name)
                    .font(.subheadline.bold())
                    .lineLimit(2)

                if let content = node.content {
                    Text(content.prefix(100) + (content.count > 100 ? "..." : ""))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(3)
                }

                Divider()

                Text("Modified: \(formatDate(node.modifiedAt))")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)

                Text("Version: \(node.version)")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
            .padding(8)
            .background(Color.gray.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .frame(maxWidth: .infinity)
    }

    private var resolutionPicker: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Choose Resolution")
                .font(.headline)

            ForEach(ConflictResolutionChoice.allCases, id: \.self) { choice in
                resolutionOption(choice)
            }
        }
    }

    private func resolutionOption(_ choice: ConflictResolutionChoice) -> some View {
        Button {
            selectedResolution = choice
        } label: {
            HStack {
                Image(systemName: choice.icon)
                    .frame(width: 24)

                VStack(alignment: .leading) {
                    Text(choice.rawValue)
                        .font(.subheadline.bold())
                    Text(choice.description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if selectedResolution == choice {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.blue)
                }
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(selectedResolution == choice ? Color.blue : Color.gray.opacity(0.3), lineWidth: selectedResolution == choice ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Actions

    private func resolveConflict() {
        guard let choice = selectedResolution else { return }

        isResolving = true

        let resolvedNode: Node
        let strategy: ConflictResolutionStrategy

        switch choice {
        case .keepLocal:
            resolvedNode = conflict.localNode
            strategy = .localWins

        case .keepRemote:
            resolvedNode = conflict.serverNode
            strategy = .serverWins

        case .merge:
            resolvedNode = mergeNodes(local: conflict.localNode, server: conflict.serverNode)
            strategy = .fieldLevelMerge
        }

        let resolution = SyncConflictResolution(
            nodeId: conflict.nodeId,
            resolvedNode: resolvedNode,
            strategy: strategy,
            resolvedAt: Date()
        )

        onResolve(resolution)
    }

    private func mergeNodes(local: Node, server: Node) -> Node {
        // Use the more recent modification as the base
        var merged = local.modifiedAt > server.modifiedAt ? local : server

        // For text content, use the most recently modified version
        if local.modifiedAt > server.modifiedAt {
            merged.content = local.content
            merged.name = local.name
            merged.summary = local.summary
        }

        // Merge tags: union of both sets
        let allTags = Set(local.tags).union(Set(server.tags))
        merged.tags = Array(allTags).sorted()

        // Increment version to mark as merged
        merged.version = max(local.version, server.version) + 1
        merged.syncVersion = max(local.syncVersion, server.syncVersion) + 1
        merged.conflictResolvedAt = Date()

        return merged
    }

    // MARK: - Helpers

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Conflict List View

/// View for displaying and resolving multiple conflicts
public struct ConflictListView: View {
    let conflicts: [SyncConflict]
    let onResolve: (SyncConflictResolution) -> Void
    let onResolveAll: (ConflictResolutionStrategy) -> Void
    let onDismiss: () -> Void

    @State private var selectedConflict: SyncConflict?

    public init(
        conflicts: [SyncConflict],
        onResolve: @escaping (SyncConflictResolution) -> Void,
        onResolveAll: @escaping (ConflictResolutionStrategy) -> Void,
        onDismiss: @escaping () -> Void
    ) {
        self.conflicts = conflicts
        self.onResolve = onResolve
        self.onResolveAll = onResolveAll
        self.onDismiss = onDismiss
    }

    public var body: some View {
        NavigationStack {
            List {
                if conflicts.count > 1 {
                    Section("Quick Actions") {
                        Button {
                            onResolveAll(.localWins)
                        } label: {
                            Label("Keep All Local", systemImage: "iphone")
                        }

                        Button {
                            onResolveAll(.serverWins)
                        } label: {
                            Label("Keep All Remote", systemImage: "cloud")
                        }

                        Button {
                            onResolveAll(.latestWins)
                        } label: {
                            Label("Keep Newest", systemImage: "clock")
                        }
                    }
                }

                Section("Conflicts (\(conflicts.count))") {
                    ForEach(conflicts, id: \.nodeId) { conflict in
                        conflictRow(conflict)
                    }
                }
            }
            .navigationTitle("Sync Conflicts")
            #if os(iOS)
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        onDismiss()
                    }
                }
            }
            .sheet(item: $selectedConflict) { conflict in
                ConflictResolutionView(
                    conflict: conflict,
                    onResolve: { resolution in
                        onResolve(resolution)
                        selectedConflict = nil
                    },
                    onDismiss: {
                        selectedConflict = nil
                    }
                )
            }
        }
    }

    private func conflictRow(_ conflict: SyncConflict) -> some View {
        Button {
            selectedConflict = conflict
        } label: {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)

                VStack(alignment: .leading) {
                    Text(conflict.localNode.name)
                        .font(.subheadline.bold())

                    Text("Modified: \(formatDate(conflict.detectedAt))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.plain)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

// MARK: - SyncConflict Identifiable

extension SyncConflict: Identifiable {
    public var id: String { nodeId }
}

// MARK: - Preview

#Preview("Single Conflict") {
    let localNode = Node(
        id: "test-1",
        name: "Test Note",
        content: "This is the local version with some changes.",
        modifiedAt: Date().addingTimeInterval(-3600)
    )

    let serverNode = Node(
        id: "test-1",
        name: "Test Note",
        content: "This is the server version with different changes.",
        modifiedAt: Date().addingTimeInterval(-1800)
    )

    let conflict = SyncConflict(
        nodeId: "test-1",
        localNode: localNode,
        serverNode: serverNode,
        detectedAt: Date(),
        conflictType: .bothModified
    )

    ConflictResolutionView(
        conflict: conflict,
        onResolve: { _ in },
        onDismiss: { }
    )
}
