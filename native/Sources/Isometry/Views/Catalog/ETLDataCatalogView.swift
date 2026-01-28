import SwiftUI
import Charts

/// Native Dataset Navigator UI following Sources → Streams → Surfaces hierarchy
/// Provides visual exploration and management of data catalog
struct ETLDataCatalogView: View {
    @State private var catalog: ETLDataCatalog
    @State private var versionManager: ETLVersionManager
    @State private var storageManager: ContentAwareStorageManager

    @State private var selectedHierarchyLevel: HierarchyLevel = .streams
    @State private var searchText = ""
    @State private var selectedCategory: String = "All"
    @State private var searchResults: ETLCatalogSearchResults?
    @State private var showingLineageGraph = false
    @State private var catalogStats: ETLCatalogStats?

    private let database: IsometryDatabase

    init(database: IsometryDatabase) {
        self.database = database
        let versionManager = ETLVersionManager(database: database)
        self._catalog = State(initialValue: ETLDataCatalog(database: database, versionManager: versionManager))
        self._versionManager = State(initialValue: versionManager)
        self._storageManager = State(initialValue: ContentAwareStorageManager(database: database))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchAndFilterSection
                hierarchySelectorSection
                contentSection
            }
            .navigationTitle("Data Catalog")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    HStack {
                        Button {
                            showingLineageGraph = true
                        } label: {
                            Image(systemName: "flowchart")
                        }

                        Menu {
                            Button("Refresh Catalog") {
                                Task { await refreshCatalog() }
                            }
                            Button("Show Statistics") {
                                Task { await loadCatalogStats() }
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingLineageGraph) {
                DataLineageGraphView(catalog: catalog)
            }
            .task {
                await loadCatalogStats()
            }
        }
    }

    // MARK: - Search and Filter Section

    private var searchAndFilterSection: some View {
        VStack(spacing: 12) {
            // Search Bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)

                TextField("Search sources, streams, surfaces...", text: $searchText)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        Task { await performSearch() }
                    }

                if !searchText.isEmpty {
                    Button("Clear") {
                        searchText = ""
                        searchResults = nil
                    }
                    .font(.caption)
                }
            }

            // Category Filter
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    CategoryFilterChip(
                        title: "All",
                        isSelected: selectedCategory == "All",
                        onTap: { selectedCategory = "All" }
                    )

                    ForEach(getCategories(), id: \.self) { category in
                        CategoryFilterChip(
                            title: category,
                            isSelected: selectedCategory == category,
                            onTap: { selectedCategory = category }
                        )
                    }
                }
                .padding(.horizontal)
            }
        }
        .padding()
        .background(Color(NSColor.systemGray))
    }

    // MARK: - Hierarchy Selector

    private var hierarchySelectorSection: some View {
        VStack(spacing: 16) {
            if let stats = catalogStats {
                CatalogStatsHeader(stats: stats)
            }

            Picker("View", selection: $selectedHierarchyLevel) {
                ForEach(HierarchyLevel.allCases, id: \.self) { level in
                    Text(level.displayName).tag(level)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
        }
        .padding(.vertical)
        .background(.ultraThinMaterial)
    }

    // MARK: - Content Section

    private var contentSection: some View {
        Group {
            if let results = searchResults {
                SearchResultsView(results: results, catalog: catalog)
            } else {
                switch selectedHierarchyLevel {
                case .sources:
                    SourcesGridView(catalog: catalog, category: selectedCategory)
                case .streams:
                    StreamsGridView(catalog: catalog, category: selectedCategory)
                case .surfaces:
                    SurfacesGridView(catalog: catalog, category: selectedCategory)
                }
            }
        }
    }

    // MARK: - Actions

    private func performSearch() async {
        guard !searchText.isEmpty else {
            searchResults = nil
            return
        }

        do {
            let scope = selectedHierarchyLevel.searchScope
            searchResults = try await catalog.search(query: searchText, scope: scope)
        } catch {
            // Handle search error
            print("Search failed: \(error)")
        }
    }

    private func refreshCatalog() async {
        // Refresh catalog data
        await loadCatalogStats()
    }

    private func loadCatalogStats() async {
        do {
            catalogStats = try await catalog.getCatalogStats()
        } catch {
            print("Failed to load catalog stats: \(error)")
        }
    }

    private func getCategories() -> [String] {
        switch selectedHierarchyLevel {
        case .sources:
            return ETLSourceCategory.allCases.map(\.rawValue)
        case .streams:
            return ETLStreamDomain.allCases.map(\.rawValue)
        case .surfaces:
            return ["Contact Cards", "Project Dashboards", "Timeline Views", "Analytics"]
        }
    }
}

// MARK: - Hierarchy Level

enum HierarchyLevel: String, CaseIterable {
    case sources = "sources"
    case streams = "streams"
    case surfaces = "surfaces"

    var displayName: String {
        switch self {
        case .sources: return "Sources"
        case .streams: return "Streams"
        case .surfaces: return "Surfaces"
        }
    }

    var searchScope: ETLCatalogScope {
        switch self {
        case .sources: return .sources
        case .streams: return .streams
        case .surfaces: return .surfaces
        }
    }
}

// MARK: - Supporting Views

struct CatalogStatsHeader: View {
    let stats: ETLCatalogStats

    var body: some View {
        HStack {
            StatCard(
                title: "Sources",
                value: "\(stats.sourceCount)",
                systemImage: "cylinder.fill",
                color: .blue
            )

            StatCard(
                title: "Streams",
                value: "\(stats.streamCount)",
                systemImage: "flowchart.fill",
                color: .green
            )

            StatCard(
                title: "Surfaces",
                value: "\(stats.surfaceCount)",
                systemImage: "rectangle.on.rectangle",
                color: .purple
            )

            StatCard(
                title: "Nodes",
                value: "\(stats.totalNodes)",
                systemImage: "circle.grid.3x3.fill",
                color: .orange
            )
        }
        .padding(.horizontal)
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let systemImage: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: systemImage)
                .font(.caption)
                .foregroundColor(color)

            Text(value)
                .font(.headline)
                .fontWeight(.bold)
                .foregroundColor(color)

            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(8)
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct CategoryFilterChip: View {
    let title: String
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Text(title)
                .font(.caption)
                .fontWeight(isSelected ? .medium : .regular)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.blue : Color(NSColor.secondarySystemFill))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(12)
        }
    }
}

// MARK: - Sources Grid View

struct SourcesGridView: View {
    @ObservedObject var catalog: ETLDataCatalog
    let category: String

    @State private var sources: [ETLDataSource] = []

    var body: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            ForEach(sources) { source in
                SourceCard(source: source)
            }
        }
        .padding()
        .task {
            await loadSources()
        }
        .onChange(of: category) { _, _ in
            Task { await loadSources() }
        }
    }

    private func loadSources() async {
        do {
            if category == "All" {
                sources = try await catalog.getAllSources()
            } else if let categoryEnum = ETLSourceCategory(rawValue: category) {
                sources = try await catalog.getSources(by: categoryEnum)
            }
        } catch {
            print("Failed to load sources: \(error)")
        }
    }
}

struct SourceCard: View {
    let source: ETLDataSource

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: source.category.systemImage)
                    .font(.title2)
                    .foregroundColor(.blue)

                Spacer()

                SourceStatusBadge(status: source.status)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(source.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Text(source.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                if let lastSync = source.lastSync {
                    Text("Synced \(formatRelativeTime(lastSync))")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if source.errorCount > 0 {
                    Text("\(source.errorCount) errors")
                        .font(.caption2)
                        .foregroundColor(.red)
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }

    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct SourceStatusBadge: View {
    let status: ETLSourceStatus

    var body: some View {
        Text(status.rawValue.capitalized)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(backgroundColor)
            .foregroundColor(foregroundColor)
            .cornerRadius(4)
    }

    private var backgroundColor: Color {
        switch status {
        case .active: return .green.opacity(0.2)
        case .inactive: return .gray.opacity(0.2)
        case .error: return .red.opacity(0.2)
        case .syncing: return .blue.opacity(0.2)
        case .configured: return .orange.opacity(0.2)
        }
    }

    private var foregroundColor: Color {
        switch status {
        case .active: return .green
        case .inactive: return .gray
        case .error: return .red
        case .syncing: return .blue
        case .configured: return .orange
        }
    }
}

// MARK: - Streams Grid View

struct StreamsGridView: View {
    @ObservedObject var catalog: ETLDataCatalog
    let category: String

    @State private var streams: [ETLDataStream] = []

    var body: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            ForEach(streams) { stream in
                StreamCard(stream: stream)
            }
        }
        .padding()
        .task {
            await loadStreams()
        }
        .onChange(of: category) { _, _ in
            Task { await loadStreams() }
        }
    }

    private func loadStreams() async {
        do {
            if category == "All" {
                streams = try await catalog.getAllStreams()
            } else if let domainEnum = ETLStreamDomain(rawValue: category) {
                streams = try await catalog.getStreams(by: domainEnum)
            }
        } catch {
            print("Failed to load streams: \(error)")
        }
    }
}

struct StreamCard: View {
    let stream: ETLDataStream

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: stream.domain.systemImage)
                    .font(.title2)
                    .foregroundColor(.green)

                Spacer()

                StreamStatusBadge(status: stream.status)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(stream.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Text(stream.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                Text("\(stream.recordCount) records")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Spacer()

                Text("Updated \(formatRelativeTime(stream.lastUpdated))")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }

    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct StreamStatusBadge: View {
    let status: ETLStreamStatus

    var body: some View {
        Text(status.rawValue.capitalized)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(backgroundColor)
            .foregroundColor(foregroundColor)
            .cornerRadius(4)
    }

    private var backgroundColor: Color {
        switch status {
        case .active: return .green.opacity(0.2)
        case .building: return .blue.opacity(0.2)
        case .error: return .red.opacity(0.2)
        case .deprecated: return .gray.opacity(0.2)
        }
    }

    private var foregroundColor: Color {
        switch status {
        case .active: return .green
        case .building: return .blue
        case .error: return .red
        case .deprecated: return .gray
        }
    }
}

// MARK: - Surfaces Grid View

struct SurfacesGridView: View {
    @ObservedObject var catalog: ETLDataCatalog
    let category: String

    @State private var surfaces: [ETLDataSurface] = []

    var body: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            ForEach(surfaces) { surface in
                SurfaceCard(surface: surface)
            }
        }
        .padding()
        .task {
            await loadSurfaces()
        }
        .onChange(of: category) { _, _ in
            Task { await loadSurfaces() }
        }
    }

    private func loadSurfaces() async {
        do {
            if category == "All" {
                surfaces = try await catalog.getAllSurfaces()
            } else {
                surfaces = try await catalog.getSurfaces(for: category)
            }
        } catch {
            print("Failed to load surfaces: \(error)")
        }
    }
}

struct SurfaceCard: View {
    let surface: ETLDataSurface

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "rectangle.on.rectangle")
                    .font(.title2)
                    .foregroundColor(.purple)

                Spacer()

                RefreshStrategyBadge(strategy: surface.refreshStrategy)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(surface.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Text(surface.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            HStack {
                Text("\(surface.streamIds.count) streams")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Spacer()

                if let lastAccessed = surface.lastAccessed {
                    Text("Used \(formatRelativeTime(lastAccessed))")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                } else {
                    Text("Never used")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }

    private func formatRelativeTime(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct RefreshStrategyBadge: View {
    let strategy: SurfaceRefreshStrategy

    var body: some View {
        Image(systemName: strategy.systemImage)
            .font(.caption)
            .foregroundColor(strategy.color)
    }
}

// MARK: - Search Results View

struct SearchResultsView: View {
    let results: ETLCatalogSearchResults
    @ObservedObject var catalog: ETLDataCatalog

    var body: some View {
        List {
            if !results.sources.isEmpty {
                Section("Sources (\(results.sources.count))") {
                    ForEach(results.sources) { source in
                        SourceRowView(source: source)
                    }
                }
            }

            if !results.streams.isEmpty {
                Section("Streams (\(results.streams.count))") {
                    ForEach(results.streams) { stream in
                        StreamRowView(stream: stream)
                    }
                }
            }

            if !results.surfaces.isEmpty {
                Section("Surfaces (\(results.surfaces.count))") {
                    ForEach(results.surfaces) { surface in
                        SurfaceRowView(surface: surface)
                    }
                }
            }

            if results.totalResults == 0 {
                Section {
                    Text("No results found for '\(results.query)'")
                        .foregroundColor(.secondary)
                        .padding()
                }
            }
        }
    }
}

struct SourceRowView: View {
    let source: ETLDataSource

    var body: some View {
        HStack {
            Image(systemName: source.category.systemImage)
                .foregroundColor(.blue)
                .frame(width: 24)

            VStack(alignment: .leading) {
                Text(source.name)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(source.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            SourceStatusBadge(status: source.status)
        }
    }
}

struct StreamRowView: View {
    let stream: ETLDataStream

    var body: some View {
        HStack {
            Image(systemName: stream.domain.systemImage)
                .foregroundColor(.green)
                .frame(width: 24)

            VStack(alignment: .leading) {
                Text(stream.name)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(stream.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text("\(stream.recordCount)")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

struct SurfaceRowView: View {
    let surface: ETLDataSurface

    var body: some View {
        HStack {
            Image(systemName: "rectangle.on.rectangle")
                .foregroundColor(.purple)
                .frame(width: 24)

            VStack(alignment: .leading) {
                Text(surface.name)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(surface.application)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Text("\(surface.accessCount)")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Data Lineage Graph View

struct DataLineageGraphView: View {
    @ObservedObject var catalog: ETLDataCatalog
    @State private var lineageGraph: ETLDataLineageGraph?

    var body: some View {
        NavigationStack {
            Group {
                if let graph = lineageGraph {
                    // D3.js visualization would go here
                    // For now, show simplified lineage
                    LineageVisualizationView(graph: graph)
                } else {
                    ProgressView("Loading lineage graph...")
                }
            }
            .navigationTitle("Data Lineage")
            .task {
                await loadLineageGraph()
            }
        }
    }

    private func loadLineageGraph() async {
        do {
            lineageGraph = try await catalog.getDataLineageGraph()
        } catch {
            print("Failed to load lineage graph: \(error)")
        }
    }
}

struct LineageVisualizationView: View {
    let graph: ETLDataLineageGraph

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Sources → Streams → Surfaces")
                    .font(.headline)
                    .padding()

                // Simplified lineage visualization
                ForEach(graph.sourceStreamMappings, id: \.id) { mapping in
                    HStack {
                        Text("Source")
                            .font(.caption)
                            .padding(4)
                            .background(.blue.opacity(0.2))
                            .cornerRadius(4)

                        Image(systemName: "arrow.right")

                        Text("Stream")
                            .font(.caption)
                            .padding(4)
                            .background(.green.opacity(0.2))
                            .cornerRadius(4)

                        Spacer()
                    }
                    .padding(.horizontal)
                }
            }
        }
    }
}

// MARK: - Extensions

extension ETLSourceCategory {
    var systemImage: String {
        switch self {
        case .appleEcosystem: return "apple.logo"
        case .webAPIs: return "globe"
        case .fileImports: return "doc.on.doc"
        case .databases: return "cylinder"
        case .cloudServices: return "cloud"
        case .nativeCardboard: return "rectangle.stack"
        }
    }
}

extension ETLStreamDomain {
    var systemImage: String {
        switch self {
        case .people: return "person.2"
        case .messages: return "message"
        case .documents: return "doc.text"
        case .events: return "calendar"
        case .locations: return "location"
        case .projects: return "folder"
        case .media: return "photo.on.rectangle"
        case .system: return "gear"
        }
    }
}

extension SurfaceRefreshStrategy {
    var systemImage: String {
        switch self {
        case .realTime: return "bolt"
        case .onDemand: return "hand.tap"
        case .scheduled: return "clock"
        case .cached: return "externaldrive"
        }
    }

    var color: Color {
        switch self {
        case .realTime: return .green
        case .onDemand: return .blue
        case .scheduled: return .orange
        case .cached: return .gray
        }
    }
}

// MARK: - Database Extensions (Placeholder)

extension ETLDataCatalog {
    func getAllSurfaces() async throws -> [ETLDataSurface] {
        // Placeholder implementation
        return []
    }
}

#Preview {
    ETLDataCatalogView(database: try! IsometryDatabase(path: ":memory:"))
}