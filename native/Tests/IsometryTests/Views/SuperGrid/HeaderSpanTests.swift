import XCTest
@testable import Isometry

/// Tests for header span calculation and rendering
/// Ensures the signature SuperGrid feature works correctly
final class HeaderSpanTests: XCTestCase {

    // MARK: - Header Span Calculation Tests

    func testCalculateHeaderSpans_withSimpleCombinations() {
        // Given
        let combinations = [
            ["Q1", "Jan"],
            ["Q1", "Feb"],
            ["Q2", "Mar"]
        ]
        let dimensions = [
            GridDimension(id: "quarter", name: "Quarter", type: .time),
            GridDimension(id: "month", name: "Month", type: .time)
        ]

        // When
        let spans = HeaderSpanCalculator.calculateHeaderSpans(
            combinations: combinations,
            dimensions: dimensions
        )

        // Then
        XCTAssertGreaterThan(spans.count, 0, "Should generate spans")

        // Find Q1 span (should span indices 0-1)
        let q1Span = spans.first { $0.value == "Q1" }
        XCTAssertNotNil(q1Span, "Should have Q1 span")
        XCTAssertEqual(q1Span?.startIndex, 0)
        XCTAssertEqual(q1Span?.endIndex, 1)
        XCTAssertTrue(q1Span?.spanAcrossDimensions == true)

        // Find Q2 span (should be at index 2)
        let q2Span = spans.first { $0.value == "Q2" }
        XCTAssertNotNil(q2Span, "Should have Q2 span")
        XCTAssertEqual(q2Span?.startIndex, 2)
        XCTAssertEqual(q2Span?.endIndex, 2)
        XCTAssertFalse(q2Span?.spanAcrossDimensions == true)
    }

    func testCalculateHeaderSpans_withParentDimensionChanges() {
        // Given: When parent dimension changes, child spans should reset
        let combinations = [
            ["Q1", "Jan"],
            ["Q1", "Jan"], // Same month but in same quarter
            ["Q2", "Jan"]  // Same month but different quarter - should break span
        ]
        let dimensions = [
            GridDimension(id: "quarter", name: "Quarter", type: .time),
            GridDimension(id: "month", name: "Month", type: .time)
        ]

        // When
        let spans = HeaderSpanCalculator.calculateHeaderSpans(
            combinations: combinations,
            dimensions: dimensions
        )

        // Then: Should have separate Jan spans for Q1 and Q2
        let janSpans = spans.filter { $0.value == "Jan" }
        XCTAssertGreaterThanOrEqual(janSpans.count, 2, "Should have separate Jan spans when parent quarter changes")

        // First Jan span should be for Q1 (indices 0-1)
        let firstJanSpan = janSpans.first { $0.startIndex == 0 }
        XCTAssertEqual(firstJanSpan?.endIndex, 1)

        // Second Jan span should be for Q2 (index 2)
        let secondJanSpan = janSpans.first { $0.startIndex == 2 }
        XCTAssertEqual(secondJanSpan?.endIndex, 2)
    }

    func testCalculateHeaderSpans_withEmptyData() {
        // Given
        let combinations: [[String]] = []
        let dimensions: [GridDimension] = []

        // When
        let spans = HeaderSpanCalculator.calculateHeaderSpans(
            combinations: combinations,
            dimensions: dimensions
        )

        // Then
        XCTAssertTrue(spans.isEmpty, "Should return empty spans for empty data")
    }

    func testCalculateHeaderSpans_withSingleCell() {
        // Given
        let combinations = [["Q1", "Jan"]]
        let dimensions = [
            GridDimension(id: "quarter", name: "Quarter", type: .time),
            GridDimension(id: "month", name: "Month", type: .time)
        ]

        // When
        let spans = HeaderSpanCalculator.calculateHeaderSpans(
            combinations: combinations,
            dimensions: dimensions
        )

        // Then
        XCTAssertEqual(spans.count, 2, "Should have spans for both dimensions")

        let q1Span = spans.first { $0.value == "Q1" }
        XCTAssertEqual(q1Span?.startIndex, 0)
        XCTAssertEqual(q1Span?.endIndex, 0)
        XCTAssertFalse(q1Span?.spanAcrossDimensions == true)

        let janSpan = spans.first { $0.value == "Jan" }
        XCTAssertEqual(janSpan?.startIndex, 0)
        XCTAssertEqual(janSpan?.endIndex, 0)
        XCTAssertFalse(janSpan?.spanAcrossDimensions == true)
    }

    func testCalculateHeaderSpans_withComplexHierarchy() {
        // Given: More complex hierarchy with 3 levels
        let combinations = [
            ["2024", "Q1", "Jan"],
            ["2024", "Q1", "Feb"],
            ["2024", "Q1", "Mar"],
            ["2024", "Q2", "Apr"],
            ["2024", "Q2", "May"],
            ["2025", "Q1", "Jan"]
        ]
        let dimensions = [
            GridDimension(id: "year", name: "Year", type: .time),
            GridDimension(id: "quarter", name: "Quarter", type: .time),
            GridDimension(id: "month", name: "Month", type: .time)
        ]

        // When
        let spans = HeaderSpanCalculator.calculateHeaderSpans(
            combinations: combinations,
            dimensions: dimensions
        )

        // Then
        // 2024 should span indices 0-4
        let year2024Span = spans.first { $0.value == "2024" && $0.dimensionIndex == 0 }
        XCTAssertEqual(year2024Span?.startIndex, 0)
        XCTAssertEqual(year2024Span?.endIndex, 4)
        XCTAssertTrue(year2024Span?.spanAcrossDimensions == true)

        // First Q1 should span indices 0-2
        let firstQ1Span = spans.first { $0.value == "Q1" && $0.startIndex == 0 }
        XCTAssertEqual(firstQ1Span?.endIndex, 2)
        XCTAssertTrue(firstQ1Span?.spanAcrossDimensions == true)

        // Q2 should span indices 3-4
        let q2Span = spans.first { $0.value == "Q2" }
        XCTAssertEqual(q2Span?.startIndex, 3)
        XCTAssertEqual(q2Span?.endIndex, 4)
        XCTAssertTrue(q2Span?.spanAcrossDimensions == true)

        // Second Q1 (for 2025) should be at index 5
        let secondQ1Span = spans.first { $0.value == "Q1" && $0.startIndex == 5 }
        XCTAssertEqual(secondQ1Span?.endIndex, 5)
        XCTAssertFalse(secondQ1Span?.spanAcrossDimensions == true)
    }

    // MARK: - HeaderSpan Model Tests

    func testHeaderSpan_spanWidth() {
        // Given
        let span = HeaderSpan(
            dimensionIndex: 0,
            startIndex: 2,
            endIndex: 5,
            value: "Test"
        )

        // When
        let width = span.spanWidth

        // Then
        XCTAssertEqual(width, 4, "Span width should be endIndex - startIndex + 1")
    }

    // MARK: - Sample Data Tests

    func testSampleCombinations_generateValidData() {
        // When
        let (combinations, dimensions) = HeaderSpanCalculator.sampleCombinations()

        // Then
        XCTAssertFalse(combinations.isEmpty, "Should generate sample combinations")
        XCTAssertFalse(dimensions.isEmpty, "Should generate sample dimensions")

        // All combinations should have the same number of elements as dimensions
        for combination in combinations {
            XCTAssertEqual(combination.count, dimensions.count,
                         "Each combination should match dimension count")
        }
    }

    func testSampleCombinations_withSpanCalculation() {
        // Given
        let (combinations, dimensions) = HeaderSpanCalculator.sampleCombinations()

        // When
        let spans = HeaderSpanCalculator.calculateHeaderSpans(
            combinations: combinations,
            dimensions: dimensions
        )

        // Then
        XCTAssertGreaterThan(spans.count, 0, "Sample data should generate spans")

        // Should have spans for all dimension types
        let dimensionIndices = Set(spans.map { $0.dimensionIndex })
        XCTAssertEqual(dimensionIndices.count, dimensions.count,
                      "Should have spans for all dimensions")
    }

    // MARK: - Performance Tests

    func testCalculateHeaderSpans_performance() {
        // Given: Large dataset to test performance
        var combinations: [[String]] = []
        for year in 2020...2024 {
            for quarter in 1...4 {
                for month in 1...3 {
                    combinations.append(["\(year)", "Q\(quarter)", "Month\(month)"])
                }
            }
        }

        let dimensions = [
            GridDimension(id: "year", name: "Year", type: .time),
            GridDimension(id: "quarter", name: "Quarter", type: .time),
            GridDimension(id: "month", name: "Month", type: .time)
        ]

        // When/Then: Should complete within reasonable time
        measure {
            let spans = HeaderSpanCalculator.calculateHeaderSpans(
                combinations: combinations,
                dimensions: dimensions
            )
            XCTAssertGreaterThan(spans.count, 0)
        }
    }
}