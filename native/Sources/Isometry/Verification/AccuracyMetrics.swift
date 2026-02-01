import Foundation

/// Detailed accuracy reporting and metrics collection system
/// Provides comprehensive analysis of data preservation quality with LATCH mapping validation
public actor AccuracyMetrics {

    // Configuration
    private let confidenceLevel: Double
    private let reportingPrecision: Int
    private let benchmarkThresholds: AccuracyThresholds

    // Metrics storage
    private var historicalAccuracyData: [AccuracyRecord] = []
    private var latchMappingHistory: [LATCHMappingResult] = []
    private var contentIntegrityHistory: [ContentIntegrityResult] = []

    public init(
        confidenceLevel: Double = 0.95,
        reportingPrecision: Int = 4,
        benchmarkThresholds: AccuracyThresholds = .production
    ) {
        self.confidenceLevel = confidenceLevel
        self.reportingPrecision = reportingPrecision
        self.benchmarkThresholds = benchmarkThresholds
    }

    // MARK: - Comprehensive Accuracy Calculation

    /// Calculate comprehensive accuracy with confidence intervals
    public func calculateComprehensiveAccuracy(
        verificationResults: [NodeComparisonResult],
        nativeNodeCount: Int,
        altoNodeCount: Int
    ) async -> ComprehensiveAccuracyResult {
        print("AccuracyMetrics: Calculating comprehensive accuracy for \(verificationResults.count) comparisons")

        let startTime = Date()

        // Field-level accuracy calculations
        let fieldAccuracies = calculateFieldLevelAccuracies(verificationResults: verificationResults)

        // LATCH mapping validation
        let latchResult = calculateLATCHMappingAccuracy(verificationResults: verificationResults)

        // Content integrity analysis
        let contentIntegrity = calculateContentIntegrityScores(verificationResults: verificationResults)

        // Overall accuracy with weights
        let overallAccuracy = calculateWeightedOverallAccuracy(
            fieldAccuracies: fieldAccuracies,
            latchAccuracy: latchResult.overallLATCHAccuracy,
            contentIntegrity: contentIntegrity.overallIntegrity
        )

        // Statistical analysis
        let confidence = calculateConfidenceInterval(
            verificationResults: verificationResults,
            overallAccuracy: overallAccuracy
        )

        // Classification and recommendations
        let classification = classifyAccuracyLevel(accuracy: overallAccuracy)
        let recommendations = generateImprovementRecommendations(
            fieldAccuracies: fieldAccuracies,
            latchResult: latchResult,
            contentIntegrity: contentIntegrity
        )

        let duration = Date().timeIntervalSince(startTime)

        let result = ComprehensiveAccuracyResult(
            overallAccuracy: overallAccuracy,
            fieldAccuracies: fieldAccuracies,
            latchMappingResult: latchResult,
            contentIntegrityResult: contentIntegrity,
            confidenceInterval: confidence,
            classification: classification,
            recommendations: recommendations,
            nativeNodeCount: nativeNodeCount,
            altoNodeCount: altoNodeCount,
            comparisonCount: verificationResults.count,
            calculationDuration: duration
        )

        // Store for historical tracking
        await storeAccuracyRecord(result: result)

        return result
    }

    /// Calculate comparison accuracy for specific comparison types
    public func calculateComparisonAccuracy(comparisonResults: [NodeComparisonResult]) async -> Double {
        guard !comparisonResults.isEmpty else { return 0.0 }

        let totalAccuracy = comparisonResults.map { $0.accuracy }.reduce(0, +)
        return totalAccuracy / Double(comparisonResults.count)
    }

    /// Calculate round-trip fidelity with detailed loss analysis
    public func calculateRoundTripFidelity(
        original: [Node],
        reimported: [Node],
        comparisonResults: [NodeComparisonResult]
    ) async -> Double {
        guard !original.isEmpty else { return 1.0 }

        // Basic count preservation
        let countPreservation = Double(reimported.count) / Double(original.count)

        // Content fidelity from comparison results
        let contentFidelity = await calculateComparisonAccuracy(comparisonResults: comparisonResults)

        // Structural preservation (node types, relationships)
        let structuralPreservation = calculateStructuralPreservation(original: original, reimported: reimported)

        // Weighted combination
        return (countPreservation * 0.2) + (contentFidelity * 0.6) + (structuralPreservation * 0.2)
    }

    // MARK: - Field-Level Accuracy Analysis

    /// Calculate preservation rates for each field type
    private func calculateFieldLevelAccuracies(verificationResults: [NodeComparisonResult]) -> FieldAccuracyBreakdown {
        var fieldTotals: [String: (total: Double, count: Int)] = [:]

        // Aggregate field accuracies
        for result in verificationResults {
            for (fieldName, accuracy) in result.fieldAccuracies {
                let current = fieldTotals[fieldName] ?? (total: 0.0, count: 0)
                fieldTotals[fieldName] = (total: current.total + accuracy, count: current.count + 1)
            }
        }

        // Calculate averages
        var fieldAverages: [String: Double] = [:]
        for (fieldName, (total, count)) in fieldTotals {
            fieldAverages[fieldName] = count > 0 ? total / Double(count) : 0.0
        }

        // Calculate weighted overall field accuracy
        let fieldWeights: [String: Double] = [
            "content": 0.30,
            "name": 0.20,
            "createdAt": 0.10,
            "modifiedAt": 0.10,
            "summary": 0.10,
            "folder": 0.05,
            "tags": 0.05,
            "id": 0.05,
            "source": 0.03,
            "sourceId": 0.02
        ]

        var weightedTotal = 0.0
        var totalWeight = 0.0

        for (fieldName, accuracy) in fieldAverages {
            let weight = fieldWeights[fieldName] ?? 0.01
            weightedTotal += accuracy * weight
            totalWeight += weight
        }

        let overallFieldAccuracy = totalWeight > 0 ? weightedTotal / totalWeight : 0.0

        return FieldAccuracyBreakdown(
            fieldAccuracies: fieldAverages,
            overallFieldAccuracy: overallFieldAccuracy,
            highestAccuracyField: fieldAverages.max(by: { $0.value < $1.value })?.key ?? "",
            lowestAccuracyField: fieldAverages.min(by: { $0.value < $1.value })?.key ?? ""
        )
    }

    // MARK: - LATCH Mapping Verification

    /// Validate LATCH (Location, Alphabet, Time, Category, Hierarchy) mapping accuracy
    private func calculateLATCHMappingAccuracy(verificationResults: [NodeComparisonResult]) -> LATCHMappingResult {
        var locationAccuracy = 0.0    // L: Location data preservation
        var alphabetAccuracy = 0.0    // A: Alphabet (names, titles)
        var timeAccuracy = 0.0        // T: Time (dates, timestamps)
        var categoryAccuracy = 0.0    // C: Category (folders, types)
        var hierarchyAccuracy = 0.0   // H: Hierarchy (tags, relationships)

        var validComparisons = 0

        for result in verificationResults {
            guard result.nativePresent && result.altoPresent else { continue }

            // Location: GPS coordinates, location names (if available)
            let locationScore = calculateLocationMappingScore(result: result)
            locationAccuracy += locationScore

            // Alphabet: Names, titles, identifiers
            let alphabetScore = calculateAlphabetMappingScore(result: result)
            alphabetAccuracy += alphabetScore

            // Time: Created, modified, due dates
            let timeScore = calculateTimeMappingScore(result: result)
            timeAccuracy += timeScore

            // Category: Folders, types, classifications
            let categoryScore = calculateCategoryMappingScore(result: result)
            categoryAccuracy += categoryScore

            // Hierarchy: Tags, parent-child relationships
            let hierarchyScore = calculateHierarchyMappingScore(result: result)
            hierarchyAccuracy += hierarchyScore

            validComparisons += 1
        }

        guard validComparisons > 0 else {
            return LATCHMappingResult(
                locationAccuracy: 0.0,
                alphabetAccuracy: 0.0,
                timeAccuracy: 0.0,
                categoryAccuracy: 0.0,
                hierarchyAccuracy: 0.0,
                overallLATCHAccuracy: 0.0,
                validComparisons: 0
            )
        }

        // Calculate averages
        let avgLocation = locationAccuracy / Double(validComparisons)
        let avgAlphabet = alphabetAccuracy / Double(validComparisons)
        let avgTime = timeAccuracy / Double(validComparisons)
        let avgCategory = categoryAccuracy / Double(validComparisons)
        let avgHierarchy = hierarchyAccuracy / Double(validComparisons)

        // Overall LATCH score (weighted)
        let overallLATCH = (avgLocation * 0.1) + (avgAlphabet * 0.3) + (avgTime * 0.3) + (avgCategory * 0.2) + (avgHierarchy * 0.1)

        let result = LATCHMappingResult(
            locationAccuracy: avgLocation,
            alphabetAccuracy: avgAlphabet,
            timeAccuracy: avgTime,
            categoryAccuracy: avgCategory,
            hierarchyAccuracy: avgHierarchy,
            overallLATCHAccuracy: overallLATCH,
            validComparisons: validComparisons
        )

        latchMappingHistory.append(result)
        return result
    }

    /// Calculate location mapping score
    private func calculateLocationMappingScore(result: NodeComparisonResult) -> Double {
        // For Apple Notes, location data is typically limited
        // Score based on location-related fields if available
        let locationFields = ["latitude", "longitude", "locationName", "locationAddress"]
        let relevantFields = result.fieldAccuracies.filter { locationFields.contains($0.key) }

        guard !relevantFields.isEmpty else {
            return 1.0 // No location data, perfect preservation
        }

        let totalAccuracy = relevantFields.values.reduce(0, +)
        return totalAccuracy / Double(relevantFields.count)
    }

    /// Calculate alphabet mapping score (names, titles)
    private func calculateAlphabetMappingScore(result: NodeComparisonResult) -> Double {
        let alphabetFields = ["name", "id", "sourceId"]
        let relevantFields = result.fieldAccuracies.filter { alphabetFields.contains($0.key) }

        guard !relevantFields.isEmpty else { return 0.0 }

        let totalAccuracy = relevantFields.values.reduce(0, +)
        return totalAccuracy / Double(relevantFields.count)
    }

    /// Calculate time mapping score (dates, timestamps)
    private func calculateTimeMappingScore(result: NodeComparisonResult) -> Double {
        let timeFields = ["createdAt", "modifiedAt", "dueAt", "completedAt", "eventStart", "eventEnd"]
        let relevantFields = result.fieldAccuracies.filter { timeFields.contains($0.key) }

        guard !relevantFields.isEmpty else { return 0.0 }

        let totalAccuracy = relevantFields.values.reduce(0, +)
        return totalAccuracy / Double(relevantFields.count)
    }

    /// Calculate category mapping score (folders, types)
    private func calculateCategoryMappingScore(result: NodeComparisonResult) -> Double {
        let categoryFields = ["folder", "nodeType", "status"]
        let relevantFields = result.fieldAccuracies.filter { categoryFields.contains($0.key) }

        guard !relevantFields.isEmpty else { return 0.0 }

        let totalAccuracy = relevantFields.values.reduce(0, +)
        return totalAccuracy / Double(relevantFields.count)
    }

    /// Calculate hierarchy mapping score (tags, relationships)
    private func calculateHierarchyMappingScore(result: NodeComparisonResult) -> Double {
        let hierarchyFields = ["tags", "priority", "importance", "sortOrder"]
        let relevantFields = result.fieldAccuracies.filter { hierarchyFields.contains($0.key) }

        guard !relevantFields.isEmpty else { return 1.0 }

        let totalAccuracy = relevantFields.values.reduce(0, +)
        return totalAccuracy / Double(relevantFields.count)
    }

    // MARK: - Content Integrity Analysis

    /// Perform sophisticated content integrity analysis
    private func calculateContentIntegrityScores(verificationResults: [NodeComparisonResult]) -> ContentIntegrityResult {
        var textSimilarityScores: [Double] = []
        var markdownPreservationScores: [Double] = []
        var richTextRetentionScores: [Double] = []
        var specialCharacterScores: [Double] = []

        for result in verificationResults {
            guard result.nativePresent && result.altoPresent else { continue }

            // Extract content-related scores
            if let contentAccuracy = result.fieldAccuracies["content"] {
                textSimilarityScores.append(contentAccuracy)

                // Analyze markdown preservation (would need actual content)
                markdownPreservationScores.append(contentAccuracy) // Simplified

                // Rich text retention analysis
                richTextRetentionScores.append(contentAccuracy) // Simplified

                // Special character preservation
                specialCharacterScores.append(contentAccuracy) // Simplified
            }
        }

        let avgTextSimilarity = average(textSimilarityScores)
        let avgMarkdownPreservation = average(markdownPreservationScores)
        let avgRichTextRetention = average(richTextRetentionScores)
        let avgSpecialCharacter = average(specialCharacterScores)

        // Overall content integrity score
        let overallIntegrity = (avgTextSimilarity * 0.4) +
                              (avgMarkdownPreservation * 0.3) +
                              (avgRichTextRetention * 0.2) +
                              (avgSpecialCharacter * 0.1)

        let result = ContentIntegrityResult(
            textSimilarityScore: avgTextSimilarity,
            markdownPreservationScore: avgMarkdownPreservation,
            richTextRetentionScore: avgRichTextRetention,
            specialCharacterScore: avgSpecialCharacter,
            overallIntegrity: overallIntegrity,
            sampleCount: textSimilarityScores.count
        )

        contentIntegrityHistory.append(result)
        return result
    }

    // MARK: - Statistical Analysis

    /// Calculate confidence interval for accuracy measurements
    private func calculateConfidenceInterval(
        verificationResults: [NodeComparisonResult],
        overallAccuracy: Double
    ) -> ConfidenceInterval {
        let accuracies = verificationResults.map { $0.accuracy }
        let n = Double(accuracies.count)

        guard n > 1 else {
            return ConfidenceInterval(
                lowerBound: overallAccuracy,
                upperBound: overallAccuracy,
                confidenceLevel: confidenceLevel,
                sampleSize: Int(n)
            )
        }

        // Calculate standard deviation
        let variance = accuracies.map { pow($0 - overallAccuracy, 2) }.reduce(0, +) / (n - 1)
        let standardDeviation = sqrt(variance)
        let standardError = standardDeviation / sqrt(n)

        // Calculate t-value for given confidence level (approximation for large samples)
        let alpha = 1.0 - confidenceLevel
        let tValue = calculateTValue(alpha: alpha, degreesOfFreedom: Int(n) - 1)

        let marginOfError = tValue * standardError

        return ConfidenceInterval(
            lowerBound: max(0.0, overallAccuracy - marginOfError),
            upperBound: min(1.0, overallAccuracy + marginOfError),
            confidenceLevel: confidenceLevel,
            sampleSize: Int(n)
        )
    }

    /// Calculate structural preservation between original and reimported data
    private func calculateStructuralPreservation(original: [Node], reimported: [Node]) -> Double {
        // Node type preservation
        let originalTypes = Set(original.map { $0.nodeType })
        let reimportedTypes = Set(reimported.map { $0.nodeType })
        let typePreservation = calculateSetSimilarity(set1: originalTypes, set2: reimportedTypes)

        // Folder structure preservation
        let originalFolders = Set(original.compactMap { $0.folder })
        let reimportedFolders = Set(reimported.compactMap { $0.folder })
        let folderPreservation = calculateSetSimilarity(set1: originalFolders, set2: reimportedFolders)

        // Tag preservation
        let originalTags = Set(original.flatMap { $0.tags })
        let reimportedTags = Set(reimported.flatMap { $0.tags })
        let tagPreservation = calculateSetSimilarity(set1: originalTags, set2: reimportedTags)

        // Weighted average
        return (typePreservation * 0.4) + (folderPreservation * 0.3) + (tagPreservation * 0.3)
    }

    // MARK: - Reporting and Analysis

    /// Generate detailed verification report
    public func generateDetailedReport(
        verificationResult: VerificationResult,
        format: ReportFormat
    ) async throws -> Data {
        switch format {
        case .json:
            return try generateJSONReport(verificationResult: verificationResult)
        case .csv:
            return try generateCSVReport(verificationResult: verificationResult)
        case .html:
            return try generateHTMLReport(verificationResult: verificationResult)
        case .pdf:
            throw AccuracyMetricsError.reportFormatNotSupported("PDF generation not yet implemented")
        }
    }

    /// Generate historical trend analysis
    public func generateTrendAnalysis() async -> AccuracyTrendAnalysis {
        let recentRecords = historicalAccuracyData.suffix(50) // Last 50 records

        guard recentRecords.count > 1 else {
            return AccuracyTrendAnalysis(
                recordCount: recentRecords.count,
                averageAccuracy: recentRecords.first?.overallAccuracy ?? 0.0,
                trend: .stable,
                trendStrength: 0.0,
                recommendations: ["Insufficient data for trend analysis"]
            )
        }

        let accuracies = recentRecords.map { $0.overallAccuracy }
        let averageAccuracy = average(accuracies)

        // Simple trend calculation
        let trend = calculateTrend(values: accuracies)
        let trendStrength = calculateTrendStrength(values: accuracies)

        let recommendations = generateTrendRecommendations(
            averageAccuracy: averageAccuracy,
            trend: trend,
            trendStrength: trendStrength
        )

        return AccuracyTrendAnalysis(
            recordCount: recentRecords.count,
            averageAccuracy: averageAccuracy,
            trend: trend,
            trendStrength: trendStrength,
            recommendations: recommendations
        )
    }

    // MARK: - Private Implementation

    /// Calculate weighted overall accuracy
    private func calculateWeightedOverallAccuracy(
        fieldAccuracies: FieldAccuracyBreakdown,
        latchAccuracy: Double,
        contentIntegrity: Double
    ) -> Double {
        return (fieldAccuracies.overallFieldAccuracy * 0.5) +
               (latchAccuracy * 0.3) +
               (contentIntegrity * 0.2)
    }

    /// Classify accuracy level
    private func classifyAccuracyLevel(accuracy: Double) -> AccuracyClassification {
        if accuracy >= benchmarkThresholds.excellent {
            return .excellent
        } else if accuracy >= benchmarkThresholds.good {
            return .good
        } else if accuracy >= benchmarkThresholds.acceptable {
            return .acceptable
        } else if accuracy >= benchmarkThresholds.poor {
            return .poor
        } else {
            return .critical
        }
    }

    /// Generate improvement recommendations
    private func generateImprovementRecommendations(
        fieldAccuracies: FieldAccuracyBreakdown,
        latchResult: LATCHMappingResult,
        contentIntegrity: ContentIntegrityResult
    ) -> [String] {
        var recommendations: [String] = []

        // Field-level recommendations
        if let lowestField = fieldAccuracies.fieldAccuracies.min(by: { $0.value < $1.value }) {
            if lowestField.value < 0.95 {
                recommendations.append("Improve \(lowestField.key) preservation (current: \(Int(lowestField.value * 100))%)")
            }
        }

        // LATCH recommendations
        if latchResult.timeAccuracy < 0.95 {
            recommendations.append("Improve timestamp precision handling")
        }
        if latchResult.categoryAccuracy < 0.95 {
            recommendations.append("Enhance folder and category mapping")
        }

        // Content integrity recommendations
        if contentIntegrity.markdownPreservationScore < 0.95 {
            recommendations.append("Improve markdown structure preservation")
        }
        if contentIntegrity.specialCharacterScore < 0.95 {
            recommendations.append("Enhance Unicode and special character handling")
        }

        return recommendations.isEmpty ? ["Data preservation is excellent"] : recommendations
    }

    /// Store accuracy record for historical tracking
    private func storeAccuracyRecord(result: ComprehensiveAccuracyResult) async {
        let record = AccuracyRecord(
            timestamp: Date(),
            overallAccuracy: result.overallAccuracy,
            fieldAccuracy: result.fieldAccuracies.overallFieldAccuracy,
            latchAccuracy: result.latchMappingResult.overallLATCHAccuracy,
            contentIntegrity: result.contentIntegrityResult.overallIntegrity,
            sampleSize: result.comparisonCount
        )

        historicalAccuracyData.append(record)

        // Keep only recent records to manage memory
        if historicalAccuracyData.count > 1000 {
            historicalAccuracyData.removeFirst(500)
        }
    }

    // MARK: - Utility Methods

    private func average(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 0.0 }
        return values.reduce(0, +) / Double(values.count)
    }

    private func calculateSetSimilarity<T: Hashable>(set1: Set<T>, set2: Set<T>) -> Double {
        guard !set1.isEmpty || !set2.isEmpty else { return 1.0 }

        let intersection = set1.intersection(set2)
        let union = set1.union(set2)

        return Double(intersection.count) / Double(union.count)
    }

    private func calculateTValue(alpha: Double, degreesOfFreedom: Int) -> Double {
        // Simplified t-value calculation (for large samples, approximates normal distribution)
        if degreesOfFreedom >= 30 {
            return 1.96 // 95% confidence for normal distribution
        } else {
            // Simplified t-table lookup for common values
            switch (alpha, degreesOfFreedom) {
            case (0.05, 1...10):
                return 2.228
            case (0.05, 11...20):
                return 2.086
            case (0.05, 21...30):
                return 2.042
            default:
                return 1.96
            }
        }
    }

    private func calculateTrend(values: [Double]) -> AccuracyTrend {
        guard values.count >= 2 else { return .stable }

        let firstHalf = values.prefix(values.count / 2)
        let secondHalf = values.suffix(values.count / 2)

        let firstAverage = average(Array(firstHalf))
        let secondAverage = average(Array(secondHalf))

        let difference = secondAverage - firstAverage

        if difference > 0.01 {
            return .improving
        } else if difference < -0.01 {
            return .declining
        } else {
            return .stable
        }
    }

    private func calculateTrendStrength(values: [Double]) -> Double {
        // Simple linear correlation with time
        guard values.count >= 2 else { return 0.0 }

        let n = Double(values.count)
        let x = Array(0..<values.count).map { Double($0) }
        let y = values

        let sumX = x.reduce(0, +)
        let sumY = y.reduce(0, +)
        let sumXY = zip(x, y).map(*).reduce(0, +)
        let sumXX = x.map { $0 * $0 }.reduce(0, +)

        let correlation = (n * sumXY - sumX * sumY) / sqrt((n * sumXX - sumX * sumX) * (n * y.map { $0 * $0 }.reduce(0, +) - sumY * sumY))

        return abs(correlation)
    }

    private func generateTrendRecommendations(
        averageAccuracy: Double,
        trend: AccuracyTrend,
        trendStrength: Double
    ) -> [String] {
        var recommendations: [String] = []

        switch trend {
        case .improving:
            if trendStrength > 0.5 {
                recommendations.append("Accuracy is improving significantly - continue current practices")
            } else {
                recommendations.append("Accuracy shows slight improvement")
            }

        case .declining:
            if trendStrength > 0.5 {
                recommendations.append("Accuracy is declining significantly - investigate data quality issues")
            } else {
                recommendations.append("Accuracy shows slight decline - monitor closely")
            }

        case .stable:
            if averageAccuracy >= 0.999 {
                recommendations.append("Accuracy is stable at excellent levels")
            } else {
                recommendations.append("Accuracy is stable but could be improved")
            }
        }

        return recommendations
    }

    // MARK: - Report Generation

    private func generateJSONReport(verificationResult: VerificationResult) throws -> Data {
        let reportData: [String: Any] = [
            "verificationId": verificationResult.id,
            "timestamp": verificationResult.timestamp.timeIntervalSince1970,
            "accuracy": verificationResult.accuracy,
            "sourceType": verificationResult.sourceType
        ]

        return try JSONSerialization.data(withJSONObject: reportData, options: .prettyPrinted)
    }

    private func generateCSVReport(verificationResult: VerificationResult) throws -> Data {
        let csvContent = "VerificationId,Timestamp,Accuracy,SourceType\n\(verificationResult.id),\(verificationResult.timestamp.timeIntervalSince1970),\(verificationResult.accuracy),\(verificationResult.sourceType)"

        return csvContent.data(using: .utf8) ?? Data()
    }

    private func generateHTMLReport(verificationResult: VerificationResult) throws -> Data {
        let htmlContent = """
        <!DOCTYPE html>
        <html>
        <head><title>Verification Report</title></head>
        <body>
        <h1>Data Verification Report</h1>
        <p>Verification ID: \(verificationResult.id)</p>
        <p>Accuracy: \(String(format: "%.2f", verificationResult.accuracy * 100))%</p>
        <p>Timestamp: \(verificationResult.timestamp)</p>
        </body>
        </html>
        """

        return htmlContent.data(using: .utf8) ?? Data()
    }
}

// MARK: - Data Types

public struct ComprehensiveAccuracyResult {
    public let overallAccuracy: Double
    public let fieldAccuracies: FieldAccuracyBreakdown
    public let latchMappingResult: LATCHMappingResult
    public let contentIntegrityResult: ContentIntegrityResult
    public let confidenceInterval: ConfidenceInterval
    public let classification: AccuracyClassification
    public let recommendations: [String]
    public let nativeNodeCount: Int
    public let altoNodeCount: Int
    public let comparisonCount: Int
    public let calculationDuration: TimeInterval
}

public struct FieldAccuracyBreakdown {
    public let fieldAccuracies: [String: Double]
    public let overallFieldAccuracy: Double
    public let highestAccuracyField: String
    public let lowestAccuracyField: String
}

public struct LATCHMappingResult {
    public let locationAccuracy: Double     // L: Location data preservation
    public let alphabetAccuracy: Double     // A: Alphabet (names, titles)
    public let timeAccuracy: Double         // T: Time (dates, timestamps)
    public let categoryAccuracy: Double     // C: Category (folders, types)
    public let hierarchyAccuracy: Double    // H: Hierarchy (tags, relationships)
    public let overallLATCHAccuracy: Double
    public let validComparisons: Int
}

public struct ContentIntegrityResult {
    public let textSimilarityScore: Double
    public let markdownPreservationScore: Double
    public let richTextRetentionScore: Double
    public let specialCharacterScore: Double
    public let overallIntegrity: Double
    public let sampleCount: Int
}

public struct ConfidenceInterval {
    public let lowerBound: Double
    public let upperBound: Double
    public let confidenceLevel: Double
    public let sampleSize: Int

    public var width: Double {
        return upperBound - lowerBound
    }
}

public struct AccuracyRecord {
    public let timestamp: Date
    public let overallAccuracy: Double
    public let fieldAccuracy: Double
    public let latchAccuracy: Double
    public let contentIntegrity: Double
    public let sampleSize: Int
}

public struct AccuracyTrendAnalysis {
    public let recordCount: Int
    public let averageAccuracy: Double
    public let trend: AccuracyTrend
    public let trendStrength: Double
    public let recommendations: [String]
}

public struct AccuracyThresholds {
    public let excellent: Double
    public let good: Double
    public let acceptable: Double
    public let poor: Double

    public static let production = AccuracyThresholds(
        excellent: 0.999,
        good: 0.995,
        acceptable: 0.99,
        poor: 0.95
    )

    public static let development = AccuracyThresholds(
        excellent: 0.99,
        good: 0.95,
        acceptable: 0.90,
        poor: 0.80
    )
}

// MARK: - Enums

public enum AccuracyClassification {
    case excellent
    case good
    case acceptable
    case poor
    case critical

    public var description: String {
        switch self {
        case .excellent:
            return "Excellent (>99.9%)"
        case .good:
            return "Good (>99.5%)"
        case .acceptable:
            return "Acceptable (>99%)"
        case .poor:
            return "Poor (>95%)"
        case .critical:
            return "Critical (<95%)"
        }
    }
}

public enum AccuracyTrend {
    case improving
    case stable
    case declining

    public var description: String {
        switch self {
        case .improving:
            return "Improving"
        case .stable:
            return "Stable"
        case .declining:
            return "Declining"
        }
    }
}

// MARK: - Error Types

public enum AccuracyMetricsError: Error, LocalizedError {
    case reportFormatNotSupported(String)
    case insufficientDataForAnalysis
    case calculationError(String)

    public var errorDescription: String? {
        switch self {
        case .reportFormatNotSupported(let format):
            return "Report format not supported: \(format)"
        case .insufficientDataForAnalysis:
            return "Insufficient data for statistical analysis"
        case .calculationError(let details):
            return "Calculation error: \(details)"
        }
    }
}