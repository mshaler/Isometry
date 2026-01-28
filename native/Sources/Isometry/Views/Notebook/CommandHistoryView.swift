import SwiftUI
import Foundation

/// Comprehensive command history search interface with advanced filtering
public struct CommandHistoryView: View {
    @StateObject private var commandHistory = CommandHistoryManager()
    @State private var searchText: String = ""
    @State private var historyEntries: [HistoryEntry] = []
    @State private var isLoading: Bool = false
    @State private var selectedFilter: HistoryFilterType = .all
    @State private var showingFilterOptions: Bool = false
    @State private var expandedEntries: Set<UUID> = []

    // Pagination
    @State private var hasMoreResults: Bool = true
    @State private var currentOffset: Int = 0
    private let pageSize: Int = 50

    // Search suggestions
    @State private var searchSuggestions: [CommandSuggestion] = []
    @State private var showingSuggestions: Bool = false

    public init() {}

    public var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search and filter section
                searchHeader

                // Quick filters
                quickFilters

                // Search results
                searchResults
            }
            .navigationTitle("Command History")
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.large)
#endif
            .searchable(
                text: $searchText,
                prompt: "Search commands and output..."
            )
            .searchSuggestions {
                if showingSuggestions {
                    ForEach(searchSuggestions) { suggestion in
                        Button(suggestion.command) {
                            searchText = suggestion.command
                            performSearch()
                        }
                        .foregroundStyle(.primary)
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    filterButton
                }
            }
            .sheet(isPresented: $showingFilterOptions) {
                filterOptionsSheet
            }
            .task {
                await loadInitialHistory()
            }
            .onChange(of: searchText) { _, newValue in
                handleSearchTextChange(newValue)
            }
            .refreshable {
                await refreshHistory()
            }
        }
    }

    // MARK: - Search Header

    private var searchHeader: some View {
        VStack(spacing: 12) {
            // Search statistics
            if !historyEntries.isEmpty || isLoading {
                HStack {
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Searching...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("\(historyEntries.count) results")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        if hasMoreResults {
                            Text("• More available")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }

                    Spacer()

                    // Active filter indicator
                    if selectedFilter != .all {
                        FilterChip(filter: selectedFilter) {
                            selectedFilter = .all
                            Task { await performFilteredSearch() }
                        }
                    }
                }
                .padding(.horizontal)
            }
        }
        .padding(.vertical, 8)
        .background(.regularMaterial)
    }

    // MARK: - Quick Filters

    private var quickFilters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(HistoryFilterType.allCases, id: \.self) { filter in
                    QuickFilterButton(
                        filter: filter,
                        isSelected: selectedFilter == filter
                    ) {
                        selectedFilter = filter
                        Task { await performFilteredSearch() }
                    }
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 8)
    }

    // MARK: - Search Results

    private var searchResults: some View {
        Group {
            if isLoading && historyEntries.isEmpty {
                loadingView
            } else if historyEntries.isEmpty {
                emptyView
            } else {
                resultsList
            }
        }
    }

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.2)
            Text("Searching command history...")
                .font(.headline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.background)
    }

    private var emptyView: some View {
        ContentUnavailableView {
            Label("No Commands Found", systemImage: "magnifyingglass")
        } description: {
            Text(emptyDescription)
        } actions: {
            Button("Clear Filters") {
                searchText = ""
                selectedFilter = .all
                Task { await loadInitialHistory() }
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private var emptyDescription: String {
        if !searchText.isEmpty {
            return "No commands match '\(searchText)'. Try a different search term."
        } else if selectedFilter != .all {
            return "No commands found for the selected filter. Try changing your filter options."
        } else {
            return "No command history available. Commands will appear here as you use the shell."
        }
    }

    private var resultsList: some View {
        List {
            ForEach(historyEntries) { entry in
                CommandHistoryRow(
                    entry: entry,
                    isExpanded: expandedEntries.contains(entry.id),
                    searchQuery: searchText
                ) {
                    toggleExpanded(entry.id)
                } onExecuteAgain: { command in
                    // TODO: Integrate with shell execution
                    print("Execute again: \(command)")
                } onCopyCommand: { command in
                    copyToClipboard(command)
                } onShowContext: { context in
                    // TODO: Navigate to associated notebook card
                    print("Show context: \(context)")
                }
            }

            // Load more button
            if hasMoreResults && !isLoading {
                loadMoreButton
            }
        }
        .listStyle(PlainListStyle())
    }

    private var loadMoreButton: some View {
        HStack {
            Spacer()
            Button("Load More") {
                Task { await loadMoreResults() }
            }
            .buttonStyle(.bordered)
            Spacer()
        }
        .padding()
    }

    // MARK: - Filter Button and Sheet

    private var filterButton: some View {
        Button(action: { showingFilterOptions = true }) {
            Image(systemName: "line.3.horizontal.decrease.circle")
        }
    }

    private var filterOptionsSheet: some View {
        NavigationView {
            FilterOptionsView(
                selectedFilter: $selectedFilter,
                searchText: $searchText
            ) {
                showingFilterOptions = false
                Task { await performFilteredSearch() }
            }
        }
    }

    // MARK: - Actions

    private func handleSearchTextChange(_ newValue: String) {
        // Debounce search
        Task {
            try? await Task.sleep(for: .milliseconds(300))
            if newValue == searchText {
                if newValue.isEmpty {
                    showingSuggestions = false
                    await loadInitialHistory()
                } else {
                    await loadSearchSuggestions(for: newValue)
                    await performSearch()
                }
            }
        }
    }

    private func loadSearchSuggestions(for query: String) async {
        do {
            let suggestions = try await commandHistory.getCommandSuggestions(
                prefix: query,
                limit: 5
            )
            await MainActor.run {
                searchSuggestions = suggestions
                showingSuggestions = !suggestions.isEmpty
            }
        } catch {
            await MainActor.run {
                showingSuggestions = false
            }
        }
    }

    private func performSearch() async {
        await MainActor.run {
            isLoading = true
            currentOffset = 0
            hasMoreResults = true
        }

        do {
            let filter = createFilter()
            let results = try await commandHistory.searchHistory(
                filter: filter,
                limit: pageSize,
                offset: 0
            )

            await MainActor.run {
                historyEntries = results
                hasMoreResults = results.count == pageSize
                currentOffset = results.count
                isLoading = false
                showingSuggestions = false
            }
        } catch {
            await MainActor.run {
                historyEntries = []
                isLoading = false
                showingSuggestions = false
            }
        }
    }

    private func performFilteredSearch() async {
        await performSearch()
    }

    private func loadInitialHistory() async {
        do {
            let results = try await commandHistory.getRecentCommands(limit: pageSize)
            await MainActor.run {
                historyEntries = results
                hasMoreResults = results.count == pageSize
                currentOffset = results.count
            }
        } catch {
            // Handle error
        }
    }

    private func loadMoreResults() async {
        guard !isLoading else { return }

        await MainActor.run {
            isLoading = true
        }

        do {
            let filter = createFilter()
            let results = try await commandHistory.searchHistory(
                filter: filter,
                limit: pageSize,
                offset: currentOffset
            )

            await MainActor.run {
                historyEntries.append(contentsOf: results)
                hasMoreResults = results.count == pageSize
                currentOffset += results.count
                isLoading = false
            }
        } catch {
            await MainActor.run {
                isLoading = false
            }
        }
    }

    private func refreshHistory() async {
        await commandHistory.invalidateCache()
        await loadInitialHistory()
    }

    private func createFilter() -> HistoryFilter {
        var filter = HistoryFilter(
            type: selectedFilter.commandType,
            searchQuery: searchText.isEmpty ? nil : searchText
        )

        // Apply additional filter logic based on selectedFilter
        switch selectedFilter {
        case .successful:
            filter = HistoryFilter(success: true, searchQuery: filter.searchQuery)
        case .failed:
            filter = HistoryFilter(success: false, searchQuery: filter.searchQuery)
        case .today:
            filter = HistoryFilter.today()
            filter = HistoryFilter(
                dateRange: filter.dateRange,
                searchQuery: searchText.isEmpty ? nil : searchText
            )
        default:
            break
        }

        return filter
    }

    private func toggleExpanded(_ entryId: UUID) {
        if expandedEntries.contains(entryId) {
            expandedEntries.remove(entryId)
        } else {
            expandedEntries.insert(entryId)
        }
    }

    private func copyToClipboard(_ command: String) {
        #if canImport(AppKit)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(command, forType: .string)
        #endif

        #if canImport(UIKit)
        UIPasteboard.general.string = command
        #endif
    }
}

// MARK: - Supporting Views

/// Individual command history row with expandable details
private struct CommandHistoryRow: View {
    let entry: HistoryEntry
    let isExpanded: Bool
    let searchQuery: String
    let onToggleExpanded: () -> Void
    let onExecuteAgain: (String) -> Void
    let onCopyCommand: (String) -> Void
    let onShowContext: (CommandContext) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Main command row
            HStack {
                // Command type icon
                Image(systemName: entry.type == .claude ? "brain" : "terminal")
                    .foregroundStyle(entry.type == .claude ? .blue : .green)
                    .font(.caption)

                // Command text with search highlighting
                CommandText(
                    command: entry.command,
                    searchQuery: searchQuery
                )
                .font(.system(.body, design: .monospaced))
                .lineLimit(isExpanded ? nil : 1)

                Spacer()

                // Status indicators
                HStack(spacing: 4) {
                    if let success = entry.success {
                        Image(systemName: success ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundStyle(success ? .green : .red)
                            .font(.caption)
                    }

                    if let duration = entry.duration {
                        Text("\(Int(duration * 1000))ms")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .fontDesign(.monospaced)
                    }
                }
            }

            // Timestamp and metadata
            HStack {
                Text(entry.timestamp, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let cwd = entry.cwd {
                    Text("• \(cwd.replacingOccurrences(of: NSHomeDirectory(), with: "~"))")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                        .fontDesign(.monospaced)
                        .lineLimit(1)
                }

                Spacer()

                Button(action: onToggleExpanded) {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            // Expanded details
            if isExpanded {
                expandedContent
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            onToggleExpanded()
        }
    }

    private var expandedContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            Divider()

            // Command output
            if let response = entry.response, !response.output.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Output:")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)

                    Text(response.output)
                        .font(.caption)
                        .fontDesign(.monospaced)
                        .padding(8)
                        .background(.regularMaterial)
                        .cornerRadius(6)
                        .textSelection(.enabled)
                }
            }

            // Error output
            if let response = entry.response, let error = response.error, !error.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Error:")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.red)

                    Text(error)
                        .font(.caption)
                        .fontDesign(.monospaced)
                        .foregroundStyle(.red)
                        .padding(8)
                        .background(.red.opacity(0.1))
                        .cornerRadius(6)
                        .textSelection(.enabled)
                }
            }

            // Context information
            if let context = entry.context {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Context:")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)

                    HStack {
                        Image(systemName: "note.text")
                            .foregroundStyle(.blue)
                            .font(.caption)

                        Text(context.cardTitle ?? "Unknown Card")
                            .font(.caption)
                            .foregroundStyle(.primary)

                        Spacer()

                        Button("Show Card") {
                            onShowContext(context)
                        }
                        .font(.caption)
                        .buttonStyle(.bordered)
                    }
                    .padding(8)
                    .background(.blue.opacity(0.1))
                    .cornerRadius(6)
                }
            }

            // Action buttons
            HStack {
                Button("Execute Again") {
                    onExecuteAgain(entry.command)
                }
                .font(.caption)
                .buttonStyle(.borderedProminent)

                Button("Copy Command") {
                    onCopyCommand(entry.command)
                }
                .font(.caption)
                .buttonStyle(.bordered)

                Spacer()
            }
        }
    }
}

/// Text with search highlighting
private struct CommandText: View {
    let command: String
    let searchQuery: String

    var body: some View {
        if searchQuery.isEmpty {
            Text(command)
        } else {
            highlightedText
        }
    }

    private var highlightedText: some View {
        // Simple highlighting - in production, use AttributedString
        Text(command)
            .background {
                if command.localizedCaseInsensitiveContains(searchQuery) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(.yellow.opacity(0.3))
                }
            }
    }
}

/// Quick filter button
private struct QuickFilterButton: View {
    let filter: HistoryFilterType
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: filter.icon)
                Text(filter.title)
            }
            .font(.caption)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? .blue : .regularMaterial)
            .foregroundStyle(isSelected ? .white : .primary)
            .cornerRadius(16)
        }
    }
}

/// Filter chip for active filters
private struct FilterChip: View {
    let filter: HistoryFilterType
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Text(filter.title)
                .font(.caption2)

            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.caption2)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.blue)
        .foregroundStyle(.white)
        .cornerRadius(12)
    }
}

// MARK: - Filter Options Sheet

private struct FilterOptionsView: View {
    @Binding var selectedFilter: HistoryFilterType
    @Binding var searchText: String
    let onApply: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            Form {
                Section("Command Type") {
                    Picker("Type", selection: $selectedFilter) {
                        ForEach(HistoryFilterType.allCases, id: \.self) { filter in
                            Text(filter.title).tag(filter)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Date Range") {
                    // TODO: Add date range picker
                    Text("Date range filtering coming soon")
                        .foregroundStyle(.secondary)
                }

                Section("Success Status") {
                    // TODO: Add success status filter
                    Text("Success status filtering coming soon")
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Filter Options")
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Apply") {
                        onApply()
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
}

// MARK: - Filter Types

/// Available history filter types
public enum HistoryFilterType: CaseIterable {
    case all
    case system
    case claude
    case successful
    case failed
    case today

    var title: String {
        switch self {
        case .all:
            return "All"
        case .system:
            return "System"
        case .claude:
            return "Claude"
        case .successful:
            return "Successful"
        case .failed:
            return "Failed"
        case .today:
            return "Today"
        }
    }

    var icon: String {
        switch self {
        case .all:
            return "list.bullet"
        case .system:
            return "terminal"
        case .claude:
            return "brain"
        case .successful:
            return "checkmark.circle"
        case .failed:
            return "xmark.circle"
        case .today:
            return "calendar"
        }
    }

    var commandType: CommandType? {
        switch self {
        case .system:
            return .system
        case .claude:
            return .claude
        default:
            return nil
        }
    }
}

// MARK: - Preview

#Preview {
    CommandHistoryView()
}