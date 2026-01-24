import SwiftUI

/// Native SwiftUI equivalent of React MiniNav component
/// Provides view switching, axis mapping, and filter controls
struct MiniNavView: View {
    @ObservedObject var viewModel: SuperGridViewModel
    let onFiltersToggle: () -> Void

    @State private var showingAxisPicker = false
    @State private var showingOriginPicker = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // View switcher
            HStack {
                Text("View")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Picker("View Type", selection: $viewModel.currentViewType) {
                    Text("Grid").tag(ViewType.grid)
                    Text("List").tag(ViewType.list)
                    Text("Kanban").tag(ViewType.kanban)
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 200)
            }

            // Origin pattern selector
            HStack {
                Text("Pattern")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Button(action: { showingOriginPicker = true }) {
                    HStack {
                        Image(systemName: originIcon)
                        Text(originLabel)
                            .font(.caption)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(6)
                }
                .buttonStyle(.plain)
            }

            // Axis mapping
            HStack {
                Text("Axes")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Button(action: { showingAxisPicker = true }) {
                    HStack {
                        Text("X: \(axisLabel(viewModel.currentConfig.xAxisMapping))")
                        Text("•")
                            .foregroundStyle(.tertiary)
                        Text("Y: \(axisLabel(viewModel.currentConfig.yAxisMapping))")
                    }
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(6)
                }
                .buttonStyle(.plain)
            }

            // Filter controls
            HStack {
                Button(action: onFiltersToggle) {
                    HStack {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                        Text("Filters")
                            .font(.caption)

                        if viewModel.hasActiveFilters {
                            Circle()
                                .fill(Color.blue)
                                .frame(width: 6, height: 6)
                        }
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(viewModel.hasActiveFilters ? Color.blue.opacity(0.1) : Color.gray.opacity(0.1))
                    .foregroundColor(viewModel.hasActiveFilters ? .blue : .primary)
                    .cornerRadius(6)
                }
                .buttonStyle(.plain)

                Spacer()

                // Zoom controls
                HStack(spacing: 4) {
                    Button("-") {
                        viewModel.zoomOut()
                    }
                    .font(.caption)
                    .frame(width: 24, height: 24)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(4)

                    Text("\(Int(viewModel.currentConfig.zoomLevel * 100))%")
                        .font(.caption2)
                        .frame(width: 40)
                        .foregroundStyle(.secondary)

                    Button("+") {
                        viewModel.zoomIn()
                    }
                    .font(.caption)
                    .frame(width: 24, height: 24)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(4)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(12)
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
        .frame(width: 280)
        .popover(isPresented: $showingOriginPicker) {
            OriginPatternPicker(
                selectedPattern: $viewModel.currentConfig.originPattern,
                onPatternChange: { pattern in
                    viewModel.updateOriginPattern(pattern)
                }
            )
        }
        .popover(isPresented: $showingAxisPicker) {
            AxisMappingPicker(
                xAxisMapping: $viewModel.currentConfig.xAxisMapping,
                yAxisMapping: $viewModel.currentConfig.yAxisMapping,
                onAxisChange: { xAxis, yAxis in
                    viewModel.updateAxisMapping(x: xAxis, y: yAxis)
                }
            )
        }
    }

    private var originIcon: String {
        switch viewModel.currentConfig.originPattern {
        case "anchor":
            return "grid"
        case "bipolar":
            return "plus.circle"
        default:
            return "grid"
        }
    }

    private var originLabel: String {
        switch viewModel.currentConfig.originPattern {
        case "anchor":
            return "Spreadsheet"
        case "bipolar":
            return "Matrix"
        default:
            return "Unknown"
        }
    }

    private func axisLabel(_ mapping: String) -> String {
        switch mapping {
        case "time":
            return "Time"
        case "category":
            return "Category"
        case "hierarchy":
            return "Priority"
        case "location":
            return "Location"
        case "alphabet":
            return "Name"
        default:
            return mapping.capitalized
        }
    }
}

// MARK: - View Type Enum
enum ViewType: String, CaseIterable {
    case grid = "grid"
    case list = "list"
    case kanban = "kanban"
}

// MARK: - Origin Pattern Picker
struct OriginPatternPicker: View {
    @Binding var selectedPattern: String
    let onPatternChange: (String) -> Void

    private let patterns = [
        ("anchor", "Spreadsheet", "Traditional grid starting from top-left", "grid"),
        ("bipolar", "Matrix", "Center origin for semantic quadrants", "plus.circle")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Origin Pattern")
                .font(.headline)
                .padding(.bottom, 4)

            ForEach(patterns, id: \.0) { pattern in
                Button(action: {
                    selectedPattern = pattern.0
                    onPatternChange(pattern.0)
                }) {
                    HStack {
                        Image(systemName: pattern.3)
                            .foregroundColor(selectedPattern == pattern.0 ? .blue : .secondary)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(pattern.1)
                                .font(.subheadline)
                                .foregroundColor(.primary)

                            Text(pattern.2)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        Spacer()

                        if selectedPattern == pattern.0 {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.blue)
                        }
                    }
                    .padding(8)
                    .background(selectedPattern == pattern.0 ? Color.blue.opacity(0.1) : Color.clear)
                    .cornerRadius(6)
                }
                .buttonStyle(.plain)
            }
        }
        .padding()
        .frame(width: 300)
    }
}

// MARK: - Axis Mapping Picker
struct AxisMappingPicker: View {
    @Binding var xAxisMapping: String
    @Binding var yAxisMapping: String
    let onAxisChange: (String, String) -> Void

    private let latchOptions = [
        ("location", "Location", "Geographic or spatial position"),
        ("alphabet", "Name", "Alphabetical sorting"),
        ("time", "Time", "Chronological ordering"),
        ("category", "Category", "Folders and tags"),
        ("hierarchy", "Priority", "Importance and urgency")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Axis Mapping")
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                Text("X-Axis (Horizontal)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                ForEach(latchOptions, id: \.0) { option in
                    AxisOptionRow(
                        option: option,
                        isSelected: xAxisMapping == option.0,
                        onSelect: {
                            xAxisMapping = option.0
                            onAxisChange(xAxisMapping, yAxisMapping)
                        }
                    )
                }
            }

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                Text("Y-Axis (Vertical)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                ForEach(latchOptions, id: \.0) { option in
                    AxisOptionRow(
                        option: option,
                        isSelected: yAxisMapping == option.0,
                        onSelect: {
                            yAxisMapping = option.0
                            onAxisChange(xAxisMapping, yAxisMapping)
                        }
                    )
                }
            }
        }
        .padding()
        .frame(width: 280)
    }
}

struct AxisOptionRow: View {
    let option: (String, String, String)
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(option.1)
                        .font(.subheadline)
                        .foregroundColor(.primary)

                    Text(option.2)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.blue)
                }
            }
            .padding(6)
            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
            .cornerRadius(4)
        }
        .buttonStyle(.plain)
    }
}