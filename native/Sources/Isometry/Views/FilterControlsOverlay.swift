import SwiftUI

/// Native filter controls overlay - equivalent to React filter overlay
/// Provides comprehensive filtering interface with presets
struct FilterControlsOverlay: View {
    @Binding var isPresented: Bool
    @ObservedObject var viewModel: SuperGridViewModel

    @State private var searchText = ""
    @State private var selectedCategories: Set<String> = []
    @State private var selectedPriorities: Set<Int> = []
    @State private var timeRange = TimeRange.all
    @State private var showingPresetSave = false
    @State private var newPresetName = ""

    private let categories = ["Work", "Personal", "Learning", "Health", "Projects", "Ideas"]
    private let priorities = [1, 2, 3, 4]

    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.3)
                .ignoresSafeArea()
                .onTapGesture {
                    isPresented = false
                }

            // Filter panel
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack {
                    Text("Filters")
                        .font(.title2)
                        .fontWeight(.semibold)

                    Spacer()

                    Button("Clear All") {
                        clearAllFilters()
                    }
                    .disabled(!hasActiveFilters)

                    Button("Close") {
                        isPresented = false
                    }
                }

                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        // Search
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Search")
                                .font(.headline)

                            HStack {
                                Image(systemName: "magnifyingglass")
                                    .foregroundStyle(.secondary)

                                TextField("Search notes...", text: $searchText)
                                    .textFieldStyle(.roundedBorder)
                                    .onSubmit {
                                        applyFilters()
                                    }

                                if !searchText.isEmpty {
                                    Button("Clear") {
                                        searchText = ""
                                        applyFilters()
                                    }
                                    .font(.caption)
                                }
                            }
                        }

                        // Time Range
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Time Range")
                                .font(.headline)

                            Picker("Time Range", selection: $timeRange) {
                                ForEach(TimeRange.allCases, id: \.self) { range in
                                    Text(range.displayName).tag(range)
                                }
                            }
                            .pickerStyle(.segmented)
                            .onChange(of: timeRange) { _ in
                                applyFilters()
                            }
                        }

                        // Categories
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Categories")
                                    .font(.headline)

                                Spacer()

                                if selectedCategories.count > 0 {
                                    Text("\(selectedCategories.count) selected")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }

                            LazyVGrid(columns: [
                                GridItem(.flexible()),
                                GridItem(.flexible())
                            ], spacing: 8) {
                                ForEach(categories, id: \.self) { category in
                                    CategoryChip(
                                        category: category,
                                        isSelected: selectedCategories.contains(category),
                                        onToggle: {
                                            if selectedCategories.contains(category) {
                                                selectedCategories.remove(category)
                                            } else {
                                                selectedCategories.insert(category)
                                            }
                                            applyFilters()
                                        }
                                    )
                                }
                            }
                        }

                        // Priority
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Priority")
                                    .font(.headline)

                                Spacer()

                                if selectedPriorities.count > 0 {
                                    Text("\(selectedPriorities.count) selected")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }

                            HStack {
                                ForEach(priorities, id: \.self) { priority in
                                    PriorityChip(
                                        priority: priority,
                                        isSelected: selectedPriorities.contains(priority),
                                        onToggle: {
                                            if selectedPriorities.contains(priority) {
                                                selectedPriorities.remove(priority)
                                            } else {
                                                selectedPriorities.insert(priority)
                                            }
                                            applyFilters()
                                        }
                                    )
                                }

                                Spacer()
                            }
                        }

                        Divider()

                        // Filter Presets
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Presets")
                                    .font(.headline)

                                Spacer()

                                Button("Save Current") {
                                    showingPresetSave = true
                                }
                                .disabled(!hasActiveFilters)
                            }

                            if viewModel.filterPresets.isEmpty {
                                Text("No saved presets")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .padding(.vertical, 8)
                            } else {
                                ForEach(viewModel.filterPresets) { preset in
                                    PresetRow(
                                        preset: preset,
                                        onApply: {
                                            applyPreset(preset)
                                        }
                                    )
                                }
                            }
                        }

                        // Action buttons
                        HStack {
                            Button("Apply Filters") {
                                applyFilters()
                                isPresented = false
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(!hasActiveFilters)

                            Spacer()

                            Button("Cancel") {
                                isPresented = false
                            }
                        }
                        .padding(.top, 8)
                    }
                }
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(12)
            .frame(width: 400, height: 600)
            .shadow(radius: 20)
        }
        .sheet(isPresented: $showingPresetSave) {
            SavePresetSheet(
                presetName: $newPresetName,
                filterConfig: currentFilterConfig,
                onSave: { name in
                    savePreset(name: name)
                    showingPresetSave = false
                    newPresetName = ""
                }
            )
        }
    }

    // MARK: - Computed Properties
    private var hasActiveFilters: Bool {
        !searchText.isEmpty ||
        !selectedCategories.isEmpty ||
        !selectedPriorities.isEmpty ||
        timeRange != .all
    }

    private var currentFilterConfig: String {
        var config: [String: Any] = [:]

        if !searchText.isEmpty {
            config["search"] = searchText
        }

        if !selectedCategories.isEmpty {
            config["category"] = Array(selectedCategories)
        }

        if !selectedPriorities.isEmpty {
            config["priority"] = Array(selectedPriorities)
        }

        if timeRange != .all {
            let (start, end) = timeRange.dateRange
            config["timeRange"] = [
                "start": ISO8601DateFormatter().string(from: start),
                "end": ISO8601DateFormatter().string(from: end)
            ]
        }

        guard let data = try? JSONSerialization.data(withJSONObject: config),
              let json = String(data: data, encoding: .utf8) else {
            return "{}"
        }

        return json
    }

    // MARK: - Actions
    private func clearAllFilters() {
        searchText = ""
        selectedCategories.removeAll()
        selectedPriorities.removeAll()
        timeRange = .all
        viewModel.clearFilters()
    }

    private func applyFilters() {
        let config = currentFilterConfig
        viewModel.currentConfig.filterConfig = config
        viewModel.hasActiveFilters = config != "{}"

        Task {
            await viewModel.updateGridData()
        }
    }

    private func applyPreset(_ preset: FilterPreset) {
        viewModel.applyFilter(preset)

        // Update UI to match preset
        if let config = preset.decodedConfig {
            searchText = config["search"] as? String ?? ""
            selectedCategories = Set(config["category"] as? [String] ?? [])
            selectedPriorities = Set(config["priority"] as? [Int] ?? [])

            // Parse time range if present
            if let timeRangeConfig = config["timeRange"] as? [String: String] {
                timeRange = TimeRange.custom // Could be enhanced
            } else {
                timeRange = .all
            }
        }
    }

    private func savePreset(name: String) {
        let preset = FilterPreset(
            name: name,
            filterConfig: currentFilterConfig,
            description: generateDescription(),
            iconName: "line.3.horizontal.decrease.circle"
        )

        // In full implementation, save to database
        viewModel.filterPresets.append(preset)
    }

    private func generateDescription() -> String {
        var parts: [String] = []

        if !searchText.isEmpty {
            parts.append("Search: \(searchText)")
        }
        if !selectedCategories.isEmpty {
            parts.append("\(selectedCategories.count) categories")
        }
        if !selectedPriorities.isEmpty {
            parts.append("\(selectedPriorities.count) priorities")
        }
        if timeRange != .all {
            parts.append(timeRange.displayName)
        }

        return parts.joined(separator: ", ")
    }
}

// MARK: - Supporting Views
struct CategoryChip: View {
    let category: String
    let isSelected: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            Text(category)
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(isSelected ? Color.blue : Color.gray.opacity(0.2))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(6)
        }
        .buttonStyle(.plain)
    }
}

struct PriorityChip: View {
    let priority: Int
    let isSelected: Bool
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            Text("P\(priority)")
                .font(.caption)
                .fontWeight(.medium)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(isSelected ? priorityColor : Color.gray.opacity(0.2))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(6)
        }
        .buttonStyle(.plain)
    }

    private var priorityColor: Color {
        switch priority {
        case 1: return .red
        case 2: return .orange
        case 3: return .yellow
        default: return .gray
        }
    }
}

struct PresetRow: View {
    let preset: FilterPreset
    let onApply: () -> Void

    var body: some View {
        HStack {
            Image(systemName: preset.iconName ?? "line.3.horizontal.decrease.circle")
                .foregroundColor(.blue)

            VStack(alignment: .leading, spacing: 2) {
                Text(preset.name)
                    .font(.subheadline)

                if let description = preset.description {
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            Button("Apply") {
                onApply()
            }
            .buttonStyle(.borderless)
            .foregroundColor(.blue)
        }
        .padding(.vertical, 4)
    }
}

struct SavePresetSheet: View {
    @Binding var presetName: String
    let filterConfig: String
    let onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Preset Details") {
                    TextField("Preset Name", text: $presetName)

                    if !filterConfig.isEmpty {
                        Text("Current filters will be saved")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Save Preset")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(presetName)
                        dismiss()
                    }
                    .disabled(presetName.isEmpty)
                }
            }
        }
        .frame(width: 300, height: 200)
    }
}

// MARK: - Time Range Enum
enum TimeRange: CaseIterable {
    case all
    case today
    case thisWeek
    case thisMonth
    case thisYear
    case custom

    var displayName: String {
        switch self {
        case .all: return "All Time"
        case .today: return "Today"
        case .thisWeek: return "This Week"
        case .thisMonth: return "This Month"
        case .thisYear: return "This Year"
        case .custom: return "Custom"
        }
    }

    var dateRange: (start: Date, end: Date) {
        let calendar = Calendar.current
        let now = Date()

        switch self {
        case .all:
            return (Date.distantPast, Date.distantFuture)
        case .today:
            let start = calendar.startOfDay(for: now)
            let end = calendar.date(byAdding: .day, value: 1, to: start) ?? now
            return (start, end)
        case .thisWeek:
            let start = calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? now
            let end = calendar.date(byAdding: .weekOfYear, value: 1, to: start) ?? now
            return (start, end)
        case .thisMonth:
            let start = calendar.dateInterval(of: .month, for: now)?.start ?? now
            let end = calendar.date(byAdding: .month, value: 1, to: start) ?? now
            return (start, end)
        case .thisYear:
            let start = calendar.dateInterval(of: .year, for: now)?.start ?? now
            let end = calendar.date(byAdding: .year, value: 1, to: start) ?? now
            return (start, end)
        case .custom:
            return (now, now)
        }
    }
}