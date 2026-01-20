import SwiftUI

/// Main content view with navigation
public struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @State private var selectedFolder: String?
    @State private var searchText = ""

    public init() {}

    public var body: some View {
        NavigationSplitView {
            SidebarView(selectedFolder: $selectedFolder)
        } detail: {
            if appState.isLoading {
                LoadingView()
            } else if let error = appState.error {
                ErrorView(error: error)
            } else {
                NodeListView(
                    folder: selectedFolder,
                    searchText: searchText
                )
            }
        }
        .searchable(text: $searchText, prompt: "Search nodes...")
        .toolbar {
            ToolbarItem(placement: .automatic) {
                SyncStatusButton()
            }
        }
    }
}

// MARK: - Sidebar

struct SidebarView: View {
    @Binding var selectedFolder: String?
    @EnvironmentObject private var appState: AppState
    @State private var folders: [String] = []
    @State private var showingImportSheet = false
    @State private var nodeCount = 0

    var body: some View {
        List(selection: $selectedFolder) {
            Section("Folders") {
                NavigationLink(value: Optional<String>.none) {
                    Label("All Notes (\(nodeCount))", systemImage: "doc.text")
                }

                ForEach(folders, id: \.self) { folder in
                    NavigationLink(value: folder) {
                        Label(folder, systemImage: "folder")
                    }
                }
            }

            Section {
                Button {
                    showingImportSheet = true
                } label: {
                    Label("Import Notes...", systemImage: "square.and.arrow.down")
                }
            }
        }
        .navigationTitle("Isometry")
        .task {
            await loadFolders()
        }
        .refreshable {
            await loadFolders()
        }
        .sheet(isPresented: $showingImportSheet) {
            ImportView(onComplete: {
                Task { await loadFolders() }
            })
        }
        .onChange(of: appState.importStatus) { _, status in
            if case .completed = status {
                Task { await loadFolders() }
            }
        }
    }

    private func loadFolders() async {
        guard let db = appState.database else { return }
        do {
            nodeCount = try await db.countNodes()
            let nodes = try await db.getAllNodes()
            let uniqueFolders = Set(nodes.compactMap(\.folder))
            folders = uniqueFolders.sorted()
        } catch {
            print("Failed to load folders: \(error)")
        }
    }
}

// MARK: - Import View

struct ImportView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var importPath = ""

    let onComplete: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Import notes from alto-index export format (Apple Notes markdown with YAML frontmatter).")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                #if os(macOS)
                Section("Import Path") {
                    HStack {
                        TextField("Path to notes directory", text: $importPath)
                            .textFieldStyle(.roundedBorder)

                        Button("Browse...") {
                            browseForFolder()
                        }
                    }

                    if let defaultPath = AppState.defaultAltoIndexPath {
                        Button("Use Default Path") {
                            importPath = defaultPath.path
                        }
                        .font(.caption)
                    }
                }
                #else
                Section("Import Path") {
                    TextField("Path to notes directory", text: $importPath)

                    Text("Enter the full path to your notes folder, or use the default alto-index path if available.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                #endif

                Section {
                    Button {
                        Task {
                            await performImport()
                        }
                    } label: {
                        HStack {
                            if case .importing = appState.importStatus {
                                ProgressView()
                                    .padding(.trailing, 4)
                            }
                            Text("Import Notes")
                        }
                    }
                    .disabled(importPath.isEmpty || appState.importStatus == .importing)
                }

                if let result = appState.lastImportResult {
                    Section("Last Import") {
                        LabeledContent("Imported", value: "\(result.imported)")
                        LabeledContent("Failed", value: "\(result.failed)")
                        LabeledContent("Total", value: "\(result.total)")
                    }
                }

                if case .failed(let error) = appState.importStatus {
                    Section {
                        Text(error.localizedDescription)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Import Notes")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func performImport() async {
        guard !importPath.isEmpty else { return }
        let url = URL(fileURLWithPath: importPath)
        await appState.importNotes(from: url)
        onComplete()
    }

    #if os(macOS)
    private func browseForFolder() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.message = "Select the folder containing your notes"

        if panel.runModal() == .OK, let url = panel.url {
            importPath = url.path
        }
    }
    #endif
}

// MARK: - Loading View

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading database...")
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Error View

struct ErrorView: View {
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
                .padding(.horizontal)
        }
    }
}

// MARK: - Sync Status Button

struct SyncStatusButton: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
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
                    .scaleEffect(0.7)
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

// MARK: - Preview

#Preview {
    ContentView()
        .environmentObject(AppState())
}
