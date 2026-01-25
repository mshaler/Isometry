import Foundation
import SwiftUI

/// Header span data structure for visual overlays in SuperGrid
/// Represents how headers should span across multiple grid cells
public struct HeaderSpan: Identifiable, Hashable {
    public let id = UUID()
    public let dimensionIndex: Int
    public let startIndex: Int
    public let endIndex: Int
    public let value: String
    public let spanAcrossDimensions: Bool

    public init(dimensionIndex: Int, startIndex: Int, endIndex: Int, value: String, spanAcrossDimensions: Bool = false) {
        self.dimensionIndex = dimensionIndex
        self.startIndex = startIndex
        self.endIndex = endIndex
        self.value = value
        self.spanAcrossDimensions = spanAcrossDimensions
    }

    /// Calculate the span width in grid cells
    public var spanWidth: Int {
        return endIndex - startIndex + 1
    }
}

/// Dimension configuration for header span calculation
public struct GridDimension: Identifiable, Hashable {
    public let id: String
    public let name: String
    public let type: DimensionType

    public enum DimensionType {
        case category
        case time
        case hierarchy
        case alphabet
        case location
    }

    public init(id: String, name: String, type: DimensionType) {
        self.id = id
        self.name = name
        self.type = type
    }
}

/// Calculator for header spans in SuperGrid
/// This is the signature feature from v1/v2 SuperGrid - stacked headers with visual overlays
public final class HeaderSpanCalculator {

    /// Calculate header spans for visual overlays
    /// - Parameters:
    ///   - combinations: Array of header value combinations for each grid cell
    ///   - dimensions: Array of dimension configurations
    /// - Returns: Array of header spans for rendering
    public static func calculateHeaderSpans(
        combinations: [[String]],
        dimensions: [GridDimension]
    ) -> [HeaderSpan] {
        guard !combinations.isEmpty && !dimensions.isEmpty else {
            return []
        }

        var spans: [HeaderSpan] = []

        // For each dimension column, calculate basic spans
        for (dimensionIndex, dimension) in dimensions.enumerated() {
            let dimensionSpans = calculateSpansForDimension(
                combinations: combinations,
                dimensionIndex: dimensionIndex,
                dimension: dimension
            )
            spans.append(contentsOf: dimensionSpans)
        }

        return spans
    }

    /// Calculate spans for a single dimension
    private static func calculateSpansForDimension(
        combinations: [[String]],
        dimensionIndex: Int,
        dimension: GridDimension
    ) -> [HeaderSpan] {
        var spans: [HeaderSpan] = []
        var currentValue: String?
        var startIndex = 0

        for (index, combination) in combinations.enumerated() {
            guard dimensionIndex < combination.count else { continue }

            let cellValue = combination[dimensionIndex]

            // Check if any parent dimension changed
            let parentChanged = hasParentDimensionChanged(
                combinations: combinations,
                currentIndex: index,
                dimensionIndex: dimensionIndex
            )

            if cellValue != currentValue || parentChanged {
                // End previous span if exists
                if let value = currentValue, startIndex < index {
                    spans.append(HeaderSpan(
                        dimensionIndex: dimensionIndex,
                        startIndex: startIndex,
                        endIndex: index - 1,
                        value: value,
                        spanAcrossDimensions: startIndex < index - 1
                    ))
                }

                // Start new span
                currentValue = cellValue
                startIndex = index
            }

            // Handle last item
            if index == combinations.count - 1, let value = currentValue {
                spans.append(HeaderSpan(
                    dimensionIndex: dimensionIndex,
                    startIndex: startIndex,
                    endIndex: index,
                    value: value,
                    spanAcrossDimensions: startIndex < index
                ))
            }
        }

        return spans
    }

    /// Check if any parent dimension has changed values
    private static func hasParentDimensionChanged(
        combinations: [[String]],
        currentIndex: Int,
        dimensionIndex: Int
    ) -> Bool {
        guard currentIndex > 0 && dimensionIndex > 0 else {
            return false
        }

        let currentCombination = combinations[currentIndex]
        let previousCombination = combinations[currentIndex - 1]

        // Check all parent dimensions (those with lower indices)
        for parentDimIndex in 0..<dimensionIndex {
            guard parentDimIndex < currentCombination.count &&
                  parentDimIndex < previousCombination.count else {
                continue
            }

            if currentCombination[parentDimIndex] != previousCombination[parentDimIndex] {
                return true
            }
        }

        return false
    }
}

/// Extension to generate test data for header spans
extension HeaderSpanCalculator {
    /// Generate sample combinations for testing
    public static func sampleCombinations() -> ([[String]], [GridDimension]) {
        let combinations = [
            ["Q1", "Jan", "High"],
            ["Q1", "Jan", "Medium"],
            ["Q1", "Feb", "High"],
            ["Q1", "Feb", "Low"],
            ["Q2", "Mar", "High"],
            ["Q2", "Mar", "Medium"],
            ["Q2", "Apr", "Low"]
        ]

        let dimensions = [
            GridDimension(id: "quarter", name: "Quarter", type: .time),
            GridDimension(id: "month", name: "Month", type: .time),
            GridDimension(id: "priority", name: "Priority", type: .hierarchy)
        ]

        return (combinations, dimensions)
    }
}