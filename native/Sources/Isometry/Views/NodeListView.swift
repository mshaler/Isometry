import SwiftUI

/// Displays a list of nodes with filtering and search
public struct NodeListView: View {
    @EnvironmentObject private var appState: AppState
    @State private var nodes: [Node] = []
    @State private var isLoading = true
    @State private var selectedNode: Node?
    @State private var showingNewNodeSheet = false

    let folder: String?
    let searchText: String

    public init(folder: String?, searchText: String) {
        self.folder = folder
        self.searchText = searchText
    }

    public var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if nodes.isEmpty {
                emptyState
            } else {
                nodeList
            }
        }
        .navigationTitle(folder ?? "All Notes")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showingNewNodeSheet = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .task(id: folder) {
            await loadNodes()
        }
        .task(id: searchText) {
            await loadNodes()
        }
        .sheet(isPresented: $showingNewNodeSheet) {
            NewNodeSheet(folder: folder) { newNode in
                nodes.insert(newNode, at: 0)
            }
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Notes", systemImage: "doc.text")
        } description: {
            if searchText.isEmpty {
                Text("Create your first note to get started.")
            } else {
                Text("No notes match '\(searchText)'")
            }
        } actions: {
            Button("New Note") {
                showingNewNodeSheet = true
            }
        }
    }

    private var nodeList: some View {
        ScrollView {
            LazyVStack(spacing: 0, pinnedViews: []) {
                ForEach(nodes) { node in
                    NodeRow(node: node)
                        .id(node.id) // Stable identity for efficient diffing
                        .contentShape(Rectangle())
                        .onTapGesture {
                            selectedNode = node
                        }
                        .background(selectedNode?.id == node.id ? Color.accentColor.opacity(0.1) : Color.clear)
                        .onAppear {
                            // Prefetch next batch when approaching end
                            prefetchIfNeeded(for: node)
                        }
                    Divider()
                }
            }
        }
    }

    /// Prefetch more data when user scrolls near the end
    /// Threshold: start prefetching when 10 items from end
    private func prefetchIfNeeded(for node: Node) {
        guard let index = nodes.firstIndex(where: { $0.id == node.id }) else { return }

        let prefetchThreshold = 10
        let remainingItems = nodes.count - index

        if remainingItems <= prefetchThreshold {
            // In a paginated implementation, this would trigger loading more data
            // For now, just log for performance monitoring
            PerformanceMonitor.shared.logEvent("Prefetch", "Near end of list, \(remainingItems) items remaining")
        }
    }

    private func loadNodes() async {
        guard let db = appState.database else { return }
        isLoading = true

        do {
            if !searchText.isEmpty {
                // Use FTS5 search
                nodes = try await db.searchNodes(query: searchText)
            } else if let folder {
                nodes = try await db.getNodes(inFolder: folder)
            } else {
                nodes = try await db.getAllNodes()
            }
        } catch {
            print("Failed to load nodes: \(error)")
            nodes = []
        }

        isLoading = false
    }
}

// MARK: - Node Row

struct NodeRow: View {
    let node: Node

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(node.name)
                    .font(.headline)

                Spacer()

                if node.priority > 0 {
                    priorityBadge
                }
            }

            if let summary = node.summary, !summary.isEmpty {
                Text(summary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            HStack {
                if let folder = node.folder {
                    Label(folder, systemImage: "folder")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(node.modifiedAt, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
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
}

// MARK: - New Node Sheet

struct NewNodeSheet: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss

    let folder: String?
    let onSave: (Node) -> Void

    @State private var name = ""
    @State private var content = ""
    @State private var priority = 0
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Name", text: $name)

                    TextEditor(text: $content)
                        .frame(minHeight: 100)
                }

                Section("Metadata") {
                    Picker("Priority", selection: $priority) {
                        Text("None").tag(0)
                        Text("Low").tag(3)
                        Text("Medium").tag(2)
                        Text("High").tag(1)
                    }
                }
            }
            .navigationTitle("New Note")
            #if os(iOS)
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            await saveNode()
                        }
                    }
                    .disabled(name.isEmpty || isSaving)
                }
            }
        }
    }

    private func saveNode() async {
        guard let db = appState.database, !name.isEmpty else { return }

        isSaving = true

        let node = Node(
            name: name,
            content: content,
            folder: folder,
            priority: priority
        )

        do {
            try await db.createNode(node)
            onSave(node)
            dismiss()
        } catch {
            print("Failed to save node: \(error)")
        }

        isSaving = false
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        NodeListView(folder: nil, searchText: "")
            .environmentObject(AppState())
    }
}
