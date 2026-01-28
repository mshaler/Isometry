import SwiftUI
#if os(iOS)
import UIKit
#endif

/// Density level configuration for hierarchical data aggregation
public struct DensityLevel: Identifiable, Hashable {
    public let id: String
    public let name: String
    public let aggregation: AggregationType
    public let collapseDepth: Int

    public enum AggregationType {
        case none      // Individual items visible
        case group     // Group similar items
        case rollup    // Aggregate with counts/sums
    }

    public init(id: String, name: String, aggregation: AggregationType, collapseDepth: Int) {
        self.id = id
        self.name = name
        self.aggregation = aggregation
        self.collapseDepth = collapseDepth
    }
}

/// Density hierarchy definition for mapping sparse to dense values
public struct DensityHierarchy: Identifiable, Hashable {
    public let id = UUID()
    public let sparseValues: [String]
    public let denseValue: String
    public let mapping: [String: String] // sparse → dense

    public init(sparseValues: [String], denseValue: String) {
        self.sparseValues = sparseValues
        self.denseValue = denseValue

        var mapping: [String: String] = [:]
        for sparse in sparseValues {
            mapping[sparse] = denseValue
        }
        self.mapping = mapping
    }
}

/// SuperDensitySparsity control for managing data aggregation levels
/// Implements the signature CardBoard feature for "Janus translation"
@MainActor
public final class DensityControlViewModel: ObservableObject {
    @Published public private(set) var currentLevel: Int = 0
    @Published public private(set) var hierarchies: [DensityHierarchy] = []
    @Published public private(set) var facetId: String = ""

    // Configuration
    public let maxLevel: Int
    public var onChange: ((String, Int, DensityHierarchy?) -> Void)?

    public init(facetId: String, hierarchies: [DensityHierarchy] = []) {
        self.facetId = facetId
        self.hierarchies = hierarchies
        self.maxLevel = hierarchies.count
    }

    // MARK: - Level Management

    public func setLevel(_ level: Int) {
        let newLevel = max(0, min(level, maxLevel))
        guard newLevel != currentLevel else { return }

        currentLevel = newLevel
        let hierarchy = currentLevel > 0 ? hierarchies[currentLevel - 1] : nil
        onChange?(facetId, currentLevel, hierarchy)
    }

    public func getCurrentHierarchy() -> DensityHierarchy? {
        guard currentLevel > 0 && currentLevel <= hierarchies.count else {
            return nil
        }
        return hierarchies[currentLevel - 1]
    }

    public func getLevelDescription() -> String {
        if currentLevel == 0 {
            return "Individual"
        } else if let hierarchy = getCurrentHierarchy() {
            return hierarchy.denseValue
        } else {
            return "Level \(currentLevel)"
        }
    }

    // MARK: - Hierarchy Management

    public func updateHierarchies(_ newHierarchies: [DensityHierarchy]) {
        hierarchies = newHierarchies
        // Reset level if it exceeds new hierarchy count
        if currentLevel > newHierarchies.count {
            setLevel(newHierarchies.count)
        }
    }
}

/// SwiftUI control for density level selection
public struct DensitySliderControl: View {
    @ObservedObject private var viewModel: DensityControlViewModel

    public init(viewModel: DensityControlViewModel) {
        self.viewModel = viewModel
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Text("Density")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.secondary)

                Spacer()

                Text(viewModel.getLevelDescription())
                    .font(.caption)
                    .foregroundColor(.primary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.accentColor.opacity(0.2))
                    .clipShape(Capsule())
            }

            // Slider with labels
            HStack(spacing: 8) {
                Text("Sparse")
                    .font(.caption2)
                    .foregroundColor(.secondary)

                Slider(
                    value: Binding(
                        get: { Double(viewModel.currentLevel) },
                        set: { viewModel.setLevel(Int($0)) }
                    ),
                    in: 0...Double(viewModel.maxLevel),
                    step: 1
                )
                .accentColor(.accentColor)

                Text("Dense")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            // Level indicators
            if viewModel.maxLevel > 0 {
                HStack {
                    ForEach(0...viewModel.maxLevel, id: \.self) { level in
                        Circle()
                            .fill(level == viewModel.currentLevel ? Color.accentColor : Color.gray.opacity(0.3))
                            .frame(width: 6, height: 6)

                        if level < viewModel.maxLevel {
                            Rectangle()
                                .fill(Color.gray.opacity(0.2))
                                .frame(height: 1)
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill({
                    #if os(iOS)
                    Color(UIColor.systemGray6)
                    #else
                    Color(NSColor.controlBackgroundColor)
                    #endif
                }())
                .stroke(Color.gray.opacity(0.2), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Density control for \(viewModel.facetId)")
        .accessibilityValue("Current level: \(viewModel.getLevelDescription())")
    }
}

/// Preset density control with common hierarchies
public struct PresetDensityControl: View {
    @StateObject private var viewModel: DensityControlViewModel
    private let presetType: PresetType

    public enum PresetType {
        case status
        case priority
        case category
        case time

        var facetId: String {
            switch self {
            case .status: return "status"
            case .priority: return "priority"
            case .category: return "category"
            case .time: return "time"
            }
        }

        var hierarchies: [DensityHierarchy] {
            switch self {
            case .status:
                return [
                    DensityHierarchy(
                        sparseValues: ["Capture", "Backlog", "TODO"],
                        denseValue: "TO DO"
                    ),
                    DensityHierarchy(
                        sparseValues: ["Doing", "Blocked", "Review"],
                        denseValue: "Doing"
                    ),
                    DensityHierarchy(
                        sparseValues: ["Done", "NOT TO DO", "Archive"],
                        denseValue: "Done"
                    )
                ]
            case .priority:
                return [
                    DensityHierarchy(
                        sparseValues: ["Critical", "Urgent", "High"],
                        denseValue: "High Priority"
                    ),
                    DensityHierarchy(
                        sparseValues: ["Medium", "Normal"],
                        denseValue: "Medium Priority"
                    ),
                    DensityHierarchy(
                        sparseValues: ["Low", "Someday", "Maybe"],
                        denseValue: "Low Priority"
                    )
                ]
            case .category:
                return [
                    DensityHierarchy(
                        sparseValues: ["Work", "Business", "Professional"],
                        denseValue: "Work"
                    ),
                    DensityHierarchy(
                        sparseValues: ["Personal", "Family", "Home"],
                        denseValue: "Personal"
                    ),
                    DensityHierarchy(
                        sparseValues: ["Learning", "Education", "Research"],
                        denseValue: "Learning"
                    )
                ]
            case .time:
                return [
                    DensityHierarchy(
                        sparseValues: ["Today", "This Morning", "This Afternoon"],
                        denseValue: "Today"
                    ),
                    DensityHierarchy(
                        sparseValues: ["This Week", "Next Week"],
                        denseValue: "This Period"
                    ),
                    DensityHierarchy(
                        sparseValues: ["This Month", "Next Month", "Later"],
                        denseValue: "Future"
                    )
                ]
            }
        }
    }

    public init(type: PresetType) {
        self.presetType = type
        self._viewModel = StateObject(wrappedValue: DensityControlViewModel(
            facetId: type.facetId,
            hierarchies: type.hierarchies
        ))
    }

    public var body: some View {
        DensitySliderControl(viewModel: viewModel)
    }
}

/// Utility functions for applying density transformations
public struct DensityTransformer {

    /// Apply density transformation to a collection of items
    public static func applyDensityTransform<T>(
        to items: [T],
        keyPath: KeyPath<T, String>,
        hierarchy: DensityHierarchy?
    ) -> [T] {
        guard let hierarchy = hierarchy else { return items }

        return items.compactMap { item in
            let value = item[keyPath: keyPath]
            if hierarchy.mapping.keys.contains(value) {
                // This item should be transformed
                // Note: In a real implementation, you'd need a way to create
                // a new instance with the transformed value
                return item
            } else {
                return item
            }
        }
    }

    /// Get aggregated counts for density levels
    public static func getAggregatedCounts<T>(
        from items: [T],
        keyPath: KeyPath<T, String>,
        hierarchy: DensityHierarchy?
    ) -> [String: Int] {
        guard let hierarchy = hierarchy else {
            // Return individual counts
            let counts = items.reduce(into: [String: Int]()) { counts, item in
                let value = item[keyPath: keyPath]
                counts[value, default: 0] += 1
            }
            return counts
        }

        var denseCounts: [String: Int] = [:]

        for item in items {
            let sparseValue = item[keyPath: keyPath]
            let denseValue = hierarchy.mapping[sparseValue] ?? sparseValue
            denseCounts[denseValue, default: 0] += 1
        }

        return denseCounts
    }

    /// Build a density hierarchy from grouped values
    public static func buildDensityHierarchy(
        sparseValues: [String],
        denseMapping: [String: [String]]
    ) -> [DensityHierarchy] {
        return denseMapping.map { denseValue, sparseGroup in
            DensityHierarchy(
                sparseValues: sparseGroup,
                denseValue: denseValue
            )
        }
    }
}

/// Sample factory for creating common density controls
public struct DensityControlFactory {

    @MainActor
    public static func createStatusDensityControl(
        onChange: @escaping (String, Int, DensityHierarchy?) -> Void
    ) -> DensityControlViewModel {
        let hierarchies = [
            DensityHierarchy(
                sparseValues: ["Capture", "Backlog", "TODO"],
                denseValue: "TO DO"
            ),
            DensityHierarchy(
                sparseValues: ["Doing", "Blocked", "Review"],
                denseValue: "Doing"
            ),
            DensityHierarchy(
                sparseValues: ["Done", "NOT TO DO", "Archive"],
                denseValue: "Done"
            )
        ]

        let viewModel = DensityControlViewModel(
            facetId: "status",
            hierarchies: hierarchies
        )
        viewModel.onChange = onChange
        return viewModel
    }

    @MainActor
    public static func createPriorityDensityControl(
        onChange: @escaping (String, Int, DensityHierarchy?) -> Void
    ) -> DensityControlViewModel {
        let hierarchies = [
            DensityHierarchy(
                sparseValues: ["Critical", "Urgent", "High"],
                denseValue: "High Priority"
            ),
            DensityHierarchy(
                sparseValues: ["Medium", "Normal"],
                denseValue: "Medium Priority"
            )
        ]

        let viewModel = DensityControlViewModel(
            facetId: "priority",
            hierarchies: hierarchies
        )
        viewModel.onChange = onChange
        return viewModel
    }
}

// MARK: - Preview Support

#if DEBUG
struct DensityControl_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            PresetDensityControl(type: .status)

            PresetDensityControl(type: .priority)

            PresetDensityControl(type: .category)

            PresetDensityControl(type: .time)
        }
        .padding()
        .frame(width: 300)
        .previewDisplayName("Density Controls")
    }
}
#endif