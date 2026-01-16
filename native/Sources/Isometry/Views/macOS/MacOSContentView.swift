#if os(macOS)
import SwiftUI

/// macOS-optimized main content view with three-column navigation
public struct MacOSContentView: View {
    @EnvironmentObject private var appState: AppState
    @State private var selectedFolder: String?
    @State private var selectedNode: Node?
    @State private var searchText = ""
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    public init() {}

    public var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            // Sidebar: Folders
            MacOSSidebarView(selectedFolder: $selectedFolder)
                .navigationSplitViewColumnWidth(min: 180, ideal: 220, max: 300)
        } content: {
            // Content: Node list
            if appState.isLoading {
                LoadingView()
            } else if let error = appState.error {
                MacOSErrorView(error: error)
            } else {
                MacOSNodeListView(
                    folder: selectedFolder,
                    searchText: searchText,
                    selectedNode: $selectedNode
                )
                .navigationSplitViewColumnWidth(min: 250, ideal: 350, max: 500)
            }
        } detail: {
            // Detail: Node editor
            if let node = selectedNode {
                MacOSNodeDetailView(node: node)
            } else {
                MacOSEmptyDetailView()
            }
        }
        .searchable(text: $searchText, placement: .sidebar, prompt: "Search nodes...")
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                MacOSToolbarItems()
            }
        }
        .navigationTitle("")
    }
}

// MARK: - macOS Sidebar

struct MacOSSidebarView: View {
    @Binding var selectedFolder: String?
    @EnvironmentObject private var appState: AppState
    @State private var folders: [String] = []
    @State private var isExpanded = true

    var body: some View {
        List(selection: $selectedFolder) {
            Section("Library", isExpanded: $isExpanded) {
                NavigationLink(value: Optional<String>.none) {
                    Label("All Notes", systemImage: "doc.text")
                }

                NavigationLink(value: "recent" as String?) {
                    Label("Recent", systemImage: "clock")
                }

                NavigationLink(value: "favorites" as String?) {
                    Label("Favorites", systemImage: "star")
                }
            }

            Section("Folders") {
                ForEach(folders, id: \.self) { folder in
                    NavigationLink(value: folder) {
                        Label(folder, systemImage: "folder")
                    }
                    .contextMenu {
                        Button("Rename...") { }
                        Divider()
                        Button("Delete", role: .destructive) { }
                    }
                }
            }

            Section("Tags") {
                Label("Work", systemImage: "tag")
                    .foregroundStyle(.blue)
                Label("Personal", systemImage: "tag")
                    .foregroundStyle(.green)
                Label("Ideas", systemImage: "tag")
                    .foregroundStyle(.purple)
            }
        }
        .listStyle(.sidebar)
        .task {
            await loadFolders()
        }
        .toolbar {
            ToolbarItem {
                Button {
                    // Add folder
                } label: {
                    Image(systemName: "folder.badge.plus")
                }
                .help("New Folder")
            }
        }
    }

    private func loadFolders() async {
        guard let db = appState.database else { return }
        do {
            let nodes = try await db.getAllNodes()
            let uniqueFolders = Set(nodes.compactMap(\.folder))
            folders = uniqueFolders.sorted()
        } catch {
            print("Failed to load folders: \(error)")
        }
    }
}

// MARK: - macOS Node List

struct MacOSNodeListView: View {
    @EnvironmentObject private var appState: AppState
    @State private var nodes: [Node] = []
    @State private var isLoading = true
    @State private var sortOrder = [KeyPathComparator(\Node.modifiedAt, order: .reverse)]
    @State private var selectedNodeId: String?

    let folder: String?
    let searchText: String
    @Binding var selectedNode: Node?

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if nodes.isEmpty {
                MacOSEmptyListView(searchText: searchText)
            } else {
                Table(nodes, selection: $selectedNodeId, sortOrder: $sortOrder) {
                    TableColumn("Name", value: \.name) { node in
                        HStack {
                            Image(systemName: iconForNode(node))
                                .foregroundStyle(.secondary)
                            Text(node.name)
                                .lineLimit(1)
                        }
                    }
                    .width(min: 150, ideal: 200)

                    TableColumn("Folder") { node in
                        Text(node.folder ?? "—")
                            .foregroundStyle(.secondary)
                    }
                    .width(80)

                    TableColumn("Modified", value: \.modifiedAt) { node in
                        Text(node.modifiedAt, style: .relative)
                            .foregroundStyle(.tertiary)
                    }
                    .width(100)

                    TableColumn("Priority") { node in
                        if node.priority > 0 {
                            PriorityBadge(priority: node.priority)
                        }
                    }
                    .width(60)
                }
                .tableStyle(.inset(alternatesRowBackgrounds: true))
                .onChange(of: sortOrder) { _, newOrder in
                    nodes.sort(using: newOrder)
                }
                .onChange(of: selectedNodeId) { _, newId in
                    selectedNode = nodes.first { $0.id == newId }
                }
            }
        }
        .navigationTitle(folder ?? "All Notes")
        .task(id: folder) {
            await loadNodes()
        }
        .task(id: searchText) {
            await loadNodes()
        }
    }

    private func loadNodes() async {
        guard let db = appState.database else { return }
        isLoading = true

        do {
            if !searchText.isEmpty {
                nodes = try await db.searchNodes(query: searchText)
            } else if let folder {
                nodes = try await db.getNodes(inFolder: folder)
            } else {
                nodes = try await db.getAllNodes()
            }
            nodes.sort(using: sortOrder)
        } catch {
            print("Failed to load nodes: \(error)")
            nodes = []
        }

        isLoading = false
    }

    private func iconForNode(_ node: Node) -> String {
        switch node.nodeType {
        case "note": return "doc.text"
        case "task": return "checkmark.circle"
        case "event": return "calendar"
        case "contact": return "person"
        default: return "doc"
        }
    }
}

// MARK: - macOS Node Detail

struct MacOSNodeDetailView: View {
    let node: Node
    @State private var editedName: String = ""
    @State private var editedContent: String = ""
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Title
                TextField("Title", text: $editedName)
                    .font(.title)
                    .textFieldStyle(.plain)

                Divider()

                // Metadata bar
                HStack(spacing: 16) {
                    Label(node.folder ?? "No Folder", systemImage: "folder")
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                        Text(node.modifiedAt, style: .relative)
                    }
                    if node.priority > 0 {
                        PriorityBadge(priority: node.priority)
                    }
                    Spacer()
                }
                .font(.caption)
                .foregroundStyle(.secondary)

                // Content editor
                TextEditor(text: $editedContent)
                    .font(.body)
                    .frame(minHeight: 300)
                    .scrollContentBackground(.hidden)
                    .background(Color(nsColor: .textBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                // Tags
                if !node.tags.isEmpty {
                    HStack {
                        ForEach(node.tags, id: \.self) { tag in
                            Text(tag)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(.quaternary)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle(node.name)
        .toolbar {
            ToolbarItemGroup {
                Button {
                    // Share
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }

                Button {
                    // Delete
                } label: {
                    Image(systemName: "trash")
                }
            }
        }
        .onAppear {
            editedName = node.name
            editedContent = node.content ?? ""
        }
    }
}

// MARK: - macOS Empty States

struct MacOSEmptyDetailView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text")
                .font(.system(size: 48))
                .foregroundStyle(.quaternary)
            Text("Select a note")
                .font(.title3)
                .foregroundStyle(.secondary)
            Text("Choose a note from the list to view or edit")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }
}

struct MacOSEmptyListView: View {
    let searchText: String

    var body: some View {
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
                // Create new note
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

struct MacOSErrorView: View {
    let error: Error

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
                .foregroundStyle(.orange)

            Text("Failed to load database")
                .font(.headline)

            Text(error.localizedDescription)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 300)

            Button("Try Again") {
                // Retry
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - macOS Toolbar

struct MacOSToolbarItems: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Button {
            // New note
        } label: {
            Image(systemName: "square.and.pencil")
        }
        .help("New Note")

        Divider()

        Button {
            Task {
                await appState.sync()
            }
        } label: {
            switch appState.syncStatus {
            case .idle:
                Image(systemName: "arrow.triangle.2.circlepath")
            case .syncing:
                ProgressView()
                    .scaleEffect(0.6)
            case .synced:
                Image(systemName: "checkmark.circle")
                    .foregroundStyle(.green)
            case .error:
                Image(systemName: "exclamationmark.circle")
                    .foregroundStyle(.red)
            }
        }
        .help("Sync with iCloud")
    }
}

// MARK: - Shared Components

struct PriorityBadge: View {
    let priority: Int

    var body: some View {
        Text("P\(priority)")
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.2))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    private var color: Color {
        switch priority {
        case 1: return .red
        case 2: return .orange
        case 3: return .yellow
        default: return .gray
        }
    }
}

// LoadingView is defined in ContentView.swift

// MARK: - Preview

#Preview {
    MacOSContentView()
        .environmentObject(AppState())
        .frame(width: 1000, height: 600)
}
#endif
