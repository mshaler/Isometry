import SwiftUI

/// Main content view with navigation
public struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @State private var selectedFolder: String?
    @State private var searchText = ""

    public init() {}

    public var body: some View {
        Group {
            if appState.navigation.isDatabaseMode {
                DatabaseContentView()
                    .environmentObject(appState)
            } else if appState.isNotebookMode {
                NotebookContentView()
                    .environmentObject(appState)
            } else {
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
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Menu {
                    ForEach(AppMode.allCases, id: \.self) { mode in
                        Button {
                            appState.navigation.switchMode(to: mode)
                        } label: {
                            HStack {
                                Image(systemName: mode.systemImage)
                                Text(mode.title)
                                if appState.navigation.currentMode == mode {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    HStack {
                        Image(systemName: appState.navigation.currentMode.systemImage)
                        Text(appState.navigation.currentMode.title)
                        Image(systemName: "chevron.down")
                            .font(.caption)
                    }
                }
                .help("Switch App Mode")
            }

            if !appState.isNotebookMode && !appState.navigation.isDatabaseMode {
                ToolbarItem(placement: .automatic) {
                    SyncStatusButton()
                }

                #if DEBUG
                ToolbarItem(placement: .primaryAction) {
                    ProductionVerificationMenuButton()
                }
                #endif
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

            Section("Tools") {
                Button {
                    showingImportSheet = true
                } label: {
                    Label("Import Notes...", systemImage: "square.and.arrow.down")
                }

                Divider()

                Button {
                    appState.navigation.navigateToVersionControl()
                } label: {
                    Label("Database Version Control", systemImage: "arrow.triangle.branch")
                }

                Button {
                    appState.navigation.navigateToETLWorkflow()
                } label: {
                    Label("ETL Operations", systemImage: "arrow.triangle.2.circlepath.circle")
                }

                Button {
                    appState.navigation.navigateToDataCatalog()
                } label: {
                    Label("Data Catalog", systemImage: "rectangle.3.group")
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
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
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

// MARK: - Production Verification Menu Button

#if DEBUG
struct ProductionVerificationMenuButton: View {
    @State private var showingCloudKitVerification = false
    @State private var showingAppStoreCompliance = false
    @State private var showingPerformanceValidation = false

    var body: some View {
        Menu {
            Button("CloudKit Production Verification") {
                showingCloudKitVerification = true
            }

            Button("App Store Compliance") {
                showingAppStoreCompliance = true
            }

            Button("Performance Validation") {
                showingPerformanceValidation = true
            }
        } label: {
            Image(systemName: "gear.badge.checkmark")
                .foregroundColor(.blue)
        }
        .help("Production Verification Tools")
        .sheet(isPresented: $showingCloudKitVerification) {
            CloudKitProductionVerificationView()
        }
        .sheet(isPresented: $showingAppStoreCompliance) {
            AppStoreComplianceView()
        }
        .sheet(isPresented: $showingPerformanceValidation) {
            PerformanceValidationView()
        }
    }
}
#endif

// MARK: - Database Content View

/// Database management content view for v2.2 features
struct DatabaseContentView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationSplitView {
            // Database navigation sidebar
            DatabaseSidebarView()
        } detail: {
            // Content area based on selected section
            DatabaseDetailView()
        }
        .navigationTitle("Database Management")
    }
}

// MARK: - Database Sidebar

struct DatabaseSidebarView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        List(selection: $appState.navigation.selectedDatabaseSection) {
            Section("Database Operations") {
                ForEach(DatabaseSection.allCases, id: \.self) { section in
                    NavigationLink(value: section) {
                        Label {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(section.title)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                Text(section.description)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .lineLimit(2)
                            }
                        } icon: {
                            Image(systemName: section.systemImage)
                                .foregroundColor(.blue)
                        }
                    }
                }
            }

            Section("Quick Actions") {
                Button {
                    appState.navigation.navigateToVersionControl()
                } label: {
                    Label("Create Branch", systemImage: "plus.branch")
                }

                Button {
                    appState.navigation.navigateToETLWorkflow()
                } label: {
                    Label("Start ETL Operation", systemImage: "play.circle")
                }

                Button {
                    appState.navigation.navigateToDataCatalog()
                } label: {
                    Label("Browse Data Sources", systemImage: "magnifyingglass")
                }
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("Database")
    }
}

// MARK: - Database Detail View

struct DatabaseDetailView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Group {
            switch appState.navigation.selectedDatabaseSection {
            case .versionControl:
                if appState.database != nil {
                    DatabaseFeatureWipView(
                        section: .versionControl,
                        message: "Database Version Control interface is being integrated. This will provide git-like database versioning with branch management, merging, and rollback capabilities."
                    )
                } else {
                    DatabaseNotAvailableView()
                }

            case .etlWorkflow:
                if appState.database != nil {
                    DatabaseFeatureWipView(
                        section: .etlWorkflow,
                        message: "ETL Operations interface is being integrated. This will provide extract, transform, and load workflow management with comprehensive data lineage tracking."
                    )
                } else {
                    DatabaseNotAvailableView()
                }

            case .dataCatalog:
                if appState.database != nil {
                    DatabaseFeatureWipView(
                        section: .dataCatalog,
                        message: "Data Catalog interface is being integrated. This will provide Sources → Streams → Surfaces navigation with comprehensive search and discovery."
                    )
                } else {
                    DatabaseNotAvailableView()
                }

            case .none:
                DatabaseOverviewView()
            }
        }
    }
}

// MARK: - Database Overview View

struct DatabaseOverviewView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        VStack(spacing: 24) {
            VStack(spacing: 16) {
                Image(systemName: "cylinder.split.1x2")
                    .font(.system(size: 64))
                    .foregroundColor(.blue)

                Text("Database Management")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("Access advanced database features including version control, ETL operations, and data catalog management.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 400)
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
                ForEach(DatabaseSection.allCases, id: \.self) { section in
                    DatabaseFeatureCard(section: section)
                }
            }
            .padding(.horizontal, 40)

            Spacer()
        }
        .padding()
    }
}

struct DatabaseFeatureCard: View {
    let section: DatabaseSection
    @EnvironmentObject private var appState: AppState

    var body: some View {
        Button {
            appState.navigation.switchToDatabaseSection(section)
        } label: {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    Image(systemName: section.systemImage)
                        .font(.title2)
                        .foregroundColor(.blue)
                    Spacer()
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(section.title)
                        .font(.headline)
                        .foregroundColor(.primary)

                    Text(section.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(3)
                }

                Spacer()
            }
            .padding()
            .frame(height: 120)
            .background(.ultraThinMaterial)
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Database Feature WIP View

struct DatabaseFeatureWipView: View {
    let section: DatabaseSection
    let message: String

    var body: some View {
        VStack(spacing: 24) {
            VStack(spacing: 16) {
                Image(systemName: section.systemImage)
                    .font(.system(size: 64))
                    .foregroundColor(.blue)

                Text(section.title)
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("Integration in Progress")
                    .font(.title3)
                    .foregroundColor(.orange)
            }

            VStack(spacing: 16) {
                Text(message)
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 500)

                HStack(spacing: 16) {
                    Label("Navigation: Complete", systemImage: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    Label("UI Integration: In Progress", systemImage: "gear.circle")
                        .foregroundColor(.orange)
                }
                .font(.caption)
            }

            VStack(spacing: 12) {
                Text("Component Status")
                    .font(.headline)

                Text("✅ Navigation structure implemented")
                Text("✅ Backend components exist")
                Text("🔄 UI integration being completed")
                Text("🔄 Component compilation fixes in progress")
            }
            .font(.caption)
            .foregroundColor(.secondary)
            .frame(maxWidth: 400)

            Spacer()
        }
        .padding()
        .navigationTitle(section.title)
    }
}

// MARK: - Database Not Available View

struct DatabaseNotAvailableView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(.orange)

            Text("Database Not Available")
                .font(.headline)

            Text("The database is not currently available. Please try again later.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

// MARK: - Preview

#Preview {
    ContentView()
        .environmentObject(AppState())
}
