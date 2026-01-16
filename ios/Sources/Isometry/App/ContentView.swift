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

    var body: some View {
        List(selection: $selectedFolder) {
            Section("Folders") {
                NavigationLink(value: Optional<String>.none) {
                    Label("All Notes", systemImage: "doc.text")
                }

                ForEach(folders, id: \.self) { folder in
                    NavigationLink(value: folder) {
                        Label(folder, systemImage: "folder")
                    }
                }
            }
        }
        .navigationTitle("Isometry")
        .task {
            await loadFolders()
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
