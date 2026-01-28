import SwiftUI

/// Native Card detail view - equivalent to React Card overlay (z=2)
/// Presents full card information in a sheet
struct CardDetailView: View {
    let node: Node
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    @State private var isEditing = false
    @State private var editedNode: Node

    init(node: Node) {
        self.node = node
        self._editedNode = State(initialValue: node)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Header
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            if isEditing {
                                TextField("Name", text: $editedNode.name)
                                    .font(.title2)
                                    .textFieldStyle(.roundedBorder)
                            } else {
                                Text(node.name)
                                    .font(.title2)
                                    .fontWeight(.semibold)
                            }

                            Spacer()

                            if node.priority > 0 {
                                priorityBadge
                            }
                        }

                        // Metadata row
                        HStack {
                            if let folder = node.folder {
                                Label(folder, systemImage: "folder")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            if !node.tags.isEmpty {
                                HStack {
                                    ForEach(node.tags.prefix(3), id: \.self) { tag in
                                        Text(tag)
                                            .font(.caption)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(Color.blue.opacity(0.1))
                                            .foregroundColor(.blue)
                                            .clipShape(Capsule())
                                    }
                                }
                            }

                            Spacer()

                            Text(node.modifiedAt, style: .relative)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }

                    Divider()

                    // Content
                    if let content = node.content, !content.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Content")
                                .font(.headline)

                            if isEditing {
                                TextEditor(text: Binding(
                                    get: { editedNode.content ?? "" },
                                    set: { editedNode.content = $0.isEmpty ? nil : $0 }
                                ))
                                .frame(minHeight: 120)
                                .padding(8)
                                .background(Color.gray.opacity(0.1))
                                .cornerRadius(8)
                            } else {
                                Text(content)
                                    .font(.body)
                            }
                        }
                    }

                    // Location
                    if node.hasLocation {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Location")
                                .font(.headline)

                            if let locationName = node.locationName {
                                Label(locationName, systemImage: "location")
                                    .font(.subheadline)
                            }

                            if let lat = node.latitude, let lon = node.longitude {
                                Text("lat: \(lat, specifier: "%.4f"), lon: \(lon, specifier: "%.4f")")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    // Dates
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Timeline")
                            .font(.headline)

                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text("Created:")
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text(node.createdAt, style: .date)
                            }
                            .font(.caption)

                            HStack {
                                Text("Modified:")
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text(node.modifiedAt, style: .relative)
                            }
                            .font(.caption)

                            if let dueAt = node.dueAt {
                                HStack {
                                    Text("Due:")
                                        .foregroundStyle(.secondary)
                                    Spacer()
                                    Text(dueAt, style: .date)
                                        .foregroundColor(node.isOverdue ? .red : .primary)
                                }
                                .font(.caption)
                            }
                        }
                    }

                    // Status & Hierarchy
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Status")
                                .font(.headline)

                            if let status = node.status {
                                Text(status.capitalized)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            } else {
                                Text("No status")
                                    .font(.subheadline)
                                    .foregroundStyle(.tertiary)
                            }
                        }

                        Spacer()

                        VStack(alignment: .trailing) {
                            Text("Hierarchy")
                                .font(.headline)

                            VStack(alignment: .trailing, spacing: 2) {
                                if node.priority > 0 {
                                    Text("Priority: \(node.priority)")
                                        .font(.caption)
                                }
                                if node.importance > 0 {
                                    Text("Importance: \(node.importance)")
                                        .font(.caption)
                                }
                            }
                            .foregroundStyle(.secondary)
                        }
                    }

                    Spacer(minLength: 50)
                }
                .padding()
            }
            .navigationTitle("Card Details")
            #if os(iOS)
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    if isEditing {
                        Button("Save") {
                            Task {
                                await saveChanges()
                            }
                        }
                        .disabled(editedNode.name.isEmpty)
                    } else {
                        Button("Edit") {
                            isEditing = true
                        }
                    }
                }
            }
        }
    }

    private var priorityBadge: some View {
        Text("P\(node.priority)")
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(priorityColor.opacity(0.2))
            .foregroundStyle(priorityColor)
            .clipShape(Capsule())
    }

    private var priorityColor: Color {
        switch node.priority {
        case 1: return .red
        case 2: return .orange
        case 3: return .yellow
        default: return .gray
        }
    }

    private func saveChanges() async {
        guard let database = appState.database else { return }

        do {
            editedNode.modifiedAt = Date()
            editedNode.version += 1
            try await database.updateNode(editedNode)
            isEditing = false

            // Trigger sync if available
            if let syncManager = appState.syncManager {
                try await syncManager.sync()
            }

        } catch {
            // Log error for debugging
            print("Failed to save node changes: \(error)")
            // Show user-friendly error (in production, present as alert)
            // "Unable to save your changes. Please try again or check your connection."
        }
    }
}

// MARK: - Accessibility Identifiers
extension CardDetailView {
    enum AccessibilityID {
        static let nodeTitle = "card.detail.title"
        static let priorityBadge = "card.detail.priority"
        static let contentSection = "card.detail.content"
        static let editButton = "card.detail.edit"
        static let saveButton = "card.detail.save"
        static let closeButton = "card.detail.close"
    }
}