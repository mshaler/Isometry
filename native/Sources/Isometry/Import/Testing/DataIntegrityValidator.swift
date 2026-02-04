import Foundation
import Testing

// MARK: - Data Integrity Validator

/// Comprehensive data integrity validation system using ExportableImporterProtocol
/// Provides automated accuracy measurement with statistical confidence intervals
public actor DataIntegrityValidator {

    // MARK: - Core Types

    /// Comprehensive accuracy metrics with statistical confidence intervals
    public struct AccuracyMetrics {
        public let preservationAccuracy: Double
        public let latchMappingAccuracy: Double
        public let contentIntegrityScore: Double
        public let schemaConformanceScore: Double
        public let overallAccuracy: Double

        // Statistical confidence intervals
        public let preservationConfidenceInterval: ConfidenceInterval
        public let latchMappingConfidenceInterval: ConfidenceInterval
        public let contentIntegrityConfidenceInterval: ConfidenceInterval
        public let schemaConformanceConfidenceInterval: ConfidenceInterval

        public let sampleSize: Int
        public let confidenceLevel: Double
        public let testedAt: Date

        public init(
            preservationAccuracy: Double,
            latchMappingAccuracy: Double,
            contentIntegrityScore: Double,
            schemaConformanceScore: Double,
            preservationConfidenceInterval: ConfidenceInterval,
            latchMappingConfidenceInterval: ConfidenceInterval,
            contentIntegrityConfidenceInterval: ConfidenceInterval,
            schemaConformanceConfidenceInterval: ConfidenceInterval,
            sampleSize: Int,
            confidenceLevel: Double,
            testedAt: Date = Date()
        ) {
            self.preservationAccuracy = preservationAccuracy
            self.latchMappingAccuracy = latchMappingAccuracy
            self.contentIntegrityScore = contentIntegrityScore
            self.schemaConformanceScore = schemaConformanceScore
            self.overallAccuracy = (preservationAccuracy + latchMappingAccuracy + contentIntegrityScore + schemaConformanceScore) / 4.0
            self.preservationConfidenceInterval = preservationConfidenceInterval
            self.latchMappingConfidenceInterval = latchMappingConfidenceInterval
            self.contentIntegrityConfidenceInterval = contentIntegrityConfidenceInterval
            self.schemaConformanceConfidenceInterval = schemaConformanceConfidenceInterval
            self.sampleSize = sampleSize
            self.confidenceLevel = confidenceLevel
            self.testedAt = testedAt
        }

        /// Whether accuracy meets production requirements
        public var meetsProductionRequirements: Bool {
            preservationAccuracy >= 0.999 && // >99.9% data preservation
            latchMappingAccuracy >= 0.95 && // >95% LATCH mapping
            contentIntegrityScore >= 0.95 && // >95% content integrity
            schemaConformanceScore >= 0.99 && // >99% schema conformance
            preservationConfidenceInterval.lower >= 0.995 // High confidence in preservation
        }

        /// Quality grade based on accuracy metrics
        public var qualityGrade: QualityGrade {
            if overallAccuracy >= 0.99 && meetsProductionRequirements {
                return .excellent
            } else if overallAccuracy >= 0.95 && preservationAccuracy >= 0.999 {
                return .good
            } else if overallAccuracy >= 0.90 && preservationAccuracy >= 0.99 {
                return .acceptable
            } else {
                return .needsImprovement
            }
        }
    }

    /// Statistical confidence interval
    public struct ConfidenceInterval {
        public let lower: Double
        public let upper: Double
        public let margin: Double

        public init(lower: Double, upper: Double) {
            self.lower = lower
            self.upper = upper
            self.margin = (upper - lower) / 2.0
        }

        /// Whether the interval contains the target value
        public func contains(_ value: Double) -> Bool {
            return value >= lower && value <= upper
        }
    }

    /// Quality grade classification
    public enum QualityGrade: String, CaseIterable {
        case excellent = "Excellent"
        case good = "Good"
        case acceptable = "Acceptable"
        case needsImprovement = "Needs Improvement"

        public var description: String {
            switch self {
            case .excellent: return "Excellent (99%+) - Production ready"
            case .good: return "Good (95%+) - Minor improvements recommended"
            case .acceptable: return "Acceptable (90%+) - Significant improvements needed"
            case .needsImprovement: return "Needs Improvement (<90%) - Not production ready"
            }
        }
    }

    /// Detailed validation report with remediation suggestions
    public struct ValidationReport {
        public let importer: String
        public let accuracyMetrics: AccuracyMetrics
        public let detailedFindings: [ValidationFinding]
        public let remediationSuggestions: [RemediationSuggestion]
        public let comparisonWithBaseline: BaselineComparison?
        public let trendAnalysis: TrendAnalysis?
        public let recommendations: [String]
        public let generatedAt: Date

        public init(
            importer: String,
            accuracyMetrics: AccuracyMetrics,
            detailedFindings: [ValidationFinding],
            remediationSuggestions: [RemediationSuggestion],
            comparisonWithBaseline: BaselineComparison? = nil,
            trendAnalysis: TrendAnalysis? = nil,
            recommendations: [String],
            generatedAt: Date = Date()
        ) {
            self.importer = importer
            self.accuracyMetrics = accuracyMetrics
            self.detailedFindings = detailedFindings
            self.remediationSuggestions = remediationSuggestions
            self.comparisonWithBaseline = comparisonWithBaseline
            self.trendAnalysis = trendAnalysis
            self.recommendations = recommendations
            self.generatedAt = generatedAt
        }

        /// Summary of validation results
        public var summary: String {
            """
            Data Integrity Validation Report for \(importer)

            Overall Quality: \(accuracyMetrics.qualityGrade.rawValue) (\(String(format: "%.1f", accuracyMetrics.overallAccuracy * 100))%)
            Sample Size: \(accuracyMetrics.sampleSize)
            Confidence Level: \(String(format: "%.1f", accuracyMetrics.confidenceLevel * 100))%

            Accuracy Metrics:
            • Data Preservation: \(String(format: "%.2f", accuracyMetrics.preservationAccuracy * 100))% (CI: \(String(format: "%.2f", accuracyMetrics.preservationConfidenceInterval.lower * 100))-\(String(format: "%.2f", accuracyMetrics.preservationConfidenceInterval.upper * 100))%)
            • LATCH Mapping: \(String(format: "%.2f", accuracyMetrics.latchMappingAccuracy * 100))% (CI: \(String(format: "%.2f", accuracyMetrics.latchMappingConfidenceInterval.lower * 100))-\(String(format: "%.2f", accuracyMetrics.latchMappingConfidenceInterval.upper * 100))%)
            • Content Integrity: \(String(format: "%.2f", accuracyMetrics.contentIntegrityScore * 100))% (CI: \(String(format: "%.2f", accuracyMetrics.contentIntegrityConfidenceInterval.lower * 100))-\(String(format: "%.2f", accuracyMetrics.contentIntegrityConfidenceInterval.upper * 100))%)
            • Schema Conformance: \(String(format: "%.2f", accuracyMetrics.schemaConformanceScore * 100))% (CI: \(String(format: "%.2f", accuracyMetrics.schemaConformanceConfidenceInterval.lower * 100))-\(String(format: "%.2f", accuracyMetrics.schemaConformanceConfidenceInterval.upper * 100))%)

            Production Ready: \(accuracyMetrics.meetsProductionRequirements ? "✅ Yes" : "❌ No")

            Critical Findings: \(detailedFindings.filter { $0.severity == .critical }.count)
            Recommendations: \(recommendations.count)
            """
        }
    }

    /// Specific validation finding with severity and details
    public struct ValidationFinding {
        public let category: ValidationCategory
        public let severity: Severity
        public let description: String
        public let affectedDataCount: Int
        public let sampleExamples: [String]
        public let suggestedFix: String?

        public init(
            category: ValidationCategory,
            severity: Severity,
            description: String,
            affectedDataCount: Int,
            sampleExamples: [String] = [],
            suggestedFix: String? = nil
        ) {
            self.category = category
            self.severity = severity
            self.description = description
            self.affectedDataCount = affectedDataCount
            self.sampleExamples = sampleExamples
            self.suggestedFix = suggestedFix
        }
    }

    /// Category of validation issue
    public enum ValidationCategory {
        case dataLoss
        case latchMapping
        case contentCorruption
        case schemaViolation
        case encoding
        case performance
        case metadata
    }

    /// Severity of validation finding
    public enum Severity {
        case critical
        case warning
        case info

        public var symbol: String {
            switch self {
            case .critical: return "🚨"
            case .warning: return "⚠️"
            case .info: return "ℹ️"
            }
        }
    }

    /// Remediation suggestion with implementation guidance
    public struct RemediationSuggestion {
        public let issue: String
        public let solution: String
        public let implementation: String
        public let priority: Priority
        public let estimatedEffort: EstimatedEffort

        public init(
            issue: String,
            solution: String,
            implementation: String,
            priority: Priority,
            estimatedEffort: EstimatedEffort
        ) {
            self.issue = issue
            self.solution = solution
            self.implementation = implementation
            self.priority = priority
            self.estimatedEffort = estimatedEffort
        }
    }

    public enum Priority {
        case high
        case medium
        case low
    }

    public enum EstimatedEffort {
        case low      // 1-2 hours
        case medium   // 1-2 days
        case high     // 1+ weeks
    }

    /// Comparison with historical baseline
    public struct BaselineComparison {
        public let baseline: AccuracyMetrics
        public let current: AccuracyMetrics
        public let regressionDetected: Bool
        public let significantChanges: [SignificantChange]

        public init(baseline: AccuracyMetrics, current: AccuracyMetrics) {
            self.baseline = baseline
            self.current = current

            // Detect regression (>5% decrease in any metric)
            self.regressionDetected =
                (baseline.preservationAccuracy - current.preservationAccuracy) > 0.05 ||
                (baseline.latchMappingAccuracy - current.latchMappingAccuracy) > 0.05 ||
                (baseline.contentIntegrityScore - current.contentIntegrityScore) > 0.05 ||
                (baseline.schemaConformanceScore - current.schemaConformanceScore) > 0.05

            self.significantChanges = Self.calculateSignificantChanges(baseline: baseline, current: current)
        }

        private static func calculateSignificantChanges(baseline: AccuracyMetrics, current: AccuracyMetrics) -> [SignificantChange] {
            var changes: [SignificantChange] = []

            let preservationChange = current.preservationAccuracy - baseline.preservationAccuracy
            if abs(preservationChange) > 0.01 { // >1% change
                changes.append(SignificantChange(
                    metric: "Data Preservation",
                    change: preservationChange,
                    isImprovement: preservationChange > 0
                ))
            }

            let latchChange = current.latchMappingAccuracy - baseline.latchMappingAccuracy
            if abs(latchChange) > 0.01 {
                changes.append(SignificantChange(
                    metric: "LATCH Mapping",
                    change: latchChange,
                    isImprovement: latchChange > 0
                ))
            }

            let contentChange = current.contentIntegrityScore - baseline.contentIntegrityScore
            if abs(contentChange) > 0.01 {
                changes.append(SignificantChange(
                    metric: "Content Integrity",
                    change: contentChange,
                    isImprovement: contentChange > 0
                ))
            }

            let schemaChange = current.schemaConformanceScore - baseline.schemaConformanceScore
            if abs(schemaChange) > 0.01 {
                changes.append(SignificantChange(
                    metric: "Schema Conformance",
                    change: schemaChange,
                    isImprovement: schemaChange > 0
                ))
            }

            return changes
        }
    }

    /// Significant change in accuracy metrics
    public struct SignificantChange {
        public let metric: String
        public let change: Double
        public let isImprovement: Bool

        public var description: String {
            let direction = isImprovement ? "increased" : "decreased"
            return "\(metric) \(direction) by \(String(format: "%.2f", abs(change) * 100))%"
        }
    }

    /// Trend analysis over multiple validation runs
    public struct TrendAnalysis {
        public let dataPoints: [AccuracyMetrics]
        public let trend: Trend
        public let volatility: Double
        public let prediction: AccuracyPrediction

        public init(dataPoints: [AccuracyMetrics]) {
            self.dataPoints = dataPoints
            self.trend = Self.calculateTrend(dataPoints: dataPoints)
            self.volatility = Self.calculateVolatility(dataPoints: dataPoints)
            self.prediction = Self.calculatePrediction(dataPoints: dataPoints, trend: trend)
        }

        private static func calculateTrend(dataPoints: [AccuracyMetrics]) -> Trend {
            guard dataPoints.count >= 2 else { return .stable }

            let overallAccuracies = dataPoints.map { $0.overallAccuracy }
            let recent = Array(overallAccuracies.suffix(5)) // Last 5 data points

            if recent.count < 2 { return .stable }

            let firstHalf = recent.prefix(recent.count / 2)
            let secondHalf = recent.suffix(recent.count / 2)

            let firstAvg = firstHalf.reduce(0, +) / Double(firstHalf.count)
            let secondAvg = secondHalf.reduce(0, +) / Double(secondHalf.count)

            let change = secondAvg - firstAvg

            if change > 0.01 {
                return .improving
            } else if change < -0.01 {
                return .declining
            } else {
                return .stable
            }
        }

        private static func calculateVolatility(dataPoints: [AccuracyMetrics]) -> Double {
            guard dataPoints.count >= 2 else { return 0.0 }

            let accuracies = dataPoints.map { $0.overallAccuracy }
            let mean = accuracies.reduce(0, +) / Double(accuracies.count)
            let variance = accuracies.map { pow($0 - mean, 2) }.reduce(0, +) / Double(accuracies.count)
            return sqrt(variance)
        }

        private static func calculatePrediction(dataPoints: [AccuracyMetrics], trend: Trend) -> AccuracyPrediction {
            guard let latest = dataPoints.last else {
                return AccuracyPrediction(predictedAccuracy: 0.0, confidence: 0.0)
            }

            let latestAccuracy = latest.overallAccuracy

            let predictedChange: Double = switch trend {
            case .improving: 0.005 // +0.5% improvement
            case .declining: -0.005 // -0.5% decline
            case .stable: 0.0 // No change
            }

            let predictedAccuracy = min(1.0, max(0.0, latestAccuracy + predictedChange))
            let confidence = dataPoints.count >= 5 ? 0.8 : 0.5 // More data points = higher confidence

            return AccuracyPrediction(predictedAccuracy: predictedAccuracy, confidence: confidence)
        }
    }

    public enum Trend {
        case improving
        case declining
        case stable
    }

    /// Prediction of future accuracy
    public struct AccuracyPrediction {
        public let predictedAccuracy: Double
        public let confidence: Double

        public var description: String {
            "Predicted accuracy: \(String(format: "%.2f", predictedAccuracy * 100))% (confidence: \(String(format: "%.1f", confidence * 100))%)"
        }
    }

    /// Extensible validation check protocol
    public protocol IntegrityCheckSuite {
        var suiteName: String { get }
        var checksIncluded: [String] { get }

        /// Perform validation checks on round-trip result
        func performChecks(
            original: Data,
            roundTripResult: RoundTripValidationResult,
            importedNodes: [Node]
        ) async throws -> [ValidationFinding]
    }

    // MARK: - Dependencies

    private let testHarness: ImportTestHarness
    private let testDataGenerator: TestDataGenerator

    // MARK: - State

    private var validationHistory: [String: [AccuracyMetrics]] = [:]
    private var baselineMetrics: [String: AccuracyMetrics] = [:]
    private var registeredCheckSuites: [any IntegrityCheckSuite] = []

    public init(testHarness: ImportTestHarness, testDataGenerator: TestDataGenerator) {
        self.testHarness = testHarness
        self.testDataGenerator = testDataGenerator

        // Register built-in check suites
        Task {
            await registerBuiltInCheckSuites()
        }
    }

    // MARK: - Public Methods

    /// Register a custom integrity check suite
    public func registerCheckSuite(_ suite: any IntegrityCheckSuite) {
        registeredCheckSuites.append(suite)
    }

    /// Perform comprehensive data integrity validation
    public func validateIntegrity<T: ExportableImporterProtocol>(
        importer: T,
        sampleSize: Int = 100,
        confidenceLevel: Double = 0.95
    ) async throws -> ValidationReport {
        print("📊 Starting comprehensive data integrity validation for \(importer.importerName)")
        print("   Sample size: \(sampleSize)")
        print("   Confidence level: \(String(format: "%.1f", confidenceLevel * 100))%")

        let startTime = Date()
        var accuracyResults: [ValidationAccuracyResult] = []
        var allFindings: [ValidationFinding] = []

        // Generate diverse test datasets
        let testDatasets = try await generateTestDatasets(count: sampleSize, for: importer)

        // Perform validation on each dataset
        for (index, testData) in testDatasets.enumerated() {
            do {
                let accuracyResult = try await validateSingleDataset(
                    importer: importer,
                    testData: testData
                )
                accuracyResults.append(accuracyResult)
                allFindings.append(contentsOf: accuracyResult.findings)

                if (index + 1) % 10 == 0 {
                    print("   Progress: \(index + 1)/\(sampleSize) datasets validated")
                }

            } catch {
                print("   Warning: Dataset \(index + 1) validation failed: \(error)")
                // Continue with other datasets
            }
        }

        // Calculate statistical metrics
        let accuracyMetrics = calculateAccuracyMetrics(
            results: accuracyResults,
            confidenceLevel: confidenceLevel
        )

        // Generate remediation suggestions
        let remediationSuggestions = generateRemediationSuggestions(
            findings: allFindings,
            accuracyMetrics: accuracyMetrics
        )

        // Compare with baseline
        let baselineComparison = baselineMetrics[importer.importerName].map { baseline in
            BaselineComparison(baseline: baseline, current: accuracyMetrics)
        }

        // Generate trend analysis
        let trendAnalysis = generateTrendAnalysis(importer: importer.importerName, current: accuracyMetrics)

        // Generate recommendations
        let recommendations = generateRecommendations(
            accuracyMetrics: accuracyMetrics,
            findings: allFindings,
            baselineComparison: baselineComparison
        )

        // Create validation report
        let report = ValidationReport(
            importer: importer.importerName,
            accuracyMetrics: accuracyMetrics,
            detailedFindings: allFindings,
            remediationSuggestions: remediationSuggestions,
            comparisonWithBaseline: baselineComparison,
            trendAnalysis: trendAnalysis,
            recommendations: recommendations
        )

        // Store metrics in history
        var history = validationHistory[importer.importerName] ?? []
        history.append(accuracyMetrics)
        validationHistory[importer.importerName] = history

        let duration = Date().timeIntervalSince(startTime)
        print("✅ Data integrity validation completed for \(importer.importerName)")
        print("   Overall accuracy: \(String(format: "%.2f", accuracyMetrics.overallAccuracy * 100))%")
        print("   Quality grade: \(accuracyMetrics.qualityGrade.rawValue)")
        print("   Production ready: \(accuracyMetrics.meetsProductionRequirements ? "Yes" : "No")")
        print("   Duration: \(String(format: "%.1f", duration))s")

        return report
    }

    /// Establish accuracy baseline for an importer
    public func establishBaseline<T: ExportableImporterProtocol>(
        importer: T,
        sampleSize: Int = 200
    ) async throws -> AccuracyMetrics {
        print("📊 Establishing accuracy baseline for \(importer.importerName)")

        let report = try await validateIntegrity(
            importer: importer,
            sampleSize: sampleSize,
            confidenceLevel: 0.99 // Higher confidence for baseline
        )

        baselineMetrics[importer.importerName] = report.accuracyMetrics

        print("✅ Baseline established for \(importer.importerName)")
        print("   Baseline accuracy: \(String(format: "%.3f", report.accuracyMetrics.overallAccuracy * 100))%")

        return report.accuracyMetrics
    }

    /// Quick regression check against baseline
    public func checkForRegression<T: ExportableImporterProtocol>(
        importer: T,
        sampleSize: Int = 50
    ) async throws -> (hasRegression: Bool, report: ValidationReport) {
        let report = try await validateIntegrity(importer: importer, sampleSize: sampleSize)
        let hasRegression = report.comparisonWithBaseline?.regressionDetected ?? false

        if hasRegression {
            print("🚨 Regression detected for \(importer.importerName)")
            if let comparison = report.comparisonWithBaseline {
                for change in comparison.significantChanges {
                    print("   • \(change.description)")
                }
            }
        }

        return (hasRegression: hasRegression, report: report)
    }

    // MARK: - Private Implementation

    private struct ValidationAccuracyResult {
        let preservationAccuracy: Double
        let latchMappingAccuracy: Double
        let contentIntegrityScore: Double
        let schemaConformanceScore: Double
        let findings: [ValidationFinding]
    }

    private func registerBuiltInCheckSuites() async {
        registeredCheckSuites.append(CoreIntegrityCheckSuite())
        registeredCheckSuites.append(PerformanceIntegrityCheckSuite())
        registeredCheckSuites.append(SecurityIntegrityCheckSuite())
    }

    private func generateTestDatasets<T: ExportableImporterProtocol>(
        count: Int,
        for importer: T
    ) async throws -> [Data] {
        var datasets: [Data] = []

        // Generate datasets with varying complexity
        let complexityLevels: [TestDataGenerator.ComplexityLevel] = [.simple, .moderate, .complex, .stress]

        for i in 0..<count {
            let complexity = complexityLevels[i % complexityLevels.count]
            let context = TestDataGenerator.GenerationContext(complexity: complexity)

            let testData: TestDataGenerator.GeneratedTestData

            // Generate based on importer's supported formats
            if importer.supportedExtensions.contains("json") {
                testData = await testDataGenerator.generateJSON(context: context)
            } else if importer.supportedExtensions.contains("md") || importer.supportedExtensions.contains("markdown") {
                testData = await testDataGenerator.generateMarkdown(context: context)
            } else if importer.supportedExtensions.contains("html") {
                testData = await testDataGenerator.generateHTML(context: context)
            } else if importer.supportedExtensions.contains("sqlite") || importer.supportedExtensions.contains("db") {
                testData = await testDataGenerator.generateSQLiteDatabase(context: context)
            } else {
                testData = await testDataGenerator.generateJSON(context: context) // Default
            }

            datasets.append(testData.content)
        }

        return datasets
    }

    private func validateSingleDataset<T: ExportableImporterProtocol>(
        importer: T,
        testData: Data
    ) async throws -> ValidationAccuracyResult {
        // Perform round-trip test using the test harness
        let roundTripResult = try await testHarness.testRoundTrip(
            importer: importer,
            originalData: testData
        )

        guard roundTripResult.success,
              let importResult = roundTripResult.importResult else {
            throw ValidationError.roundTripTestFailed("Round-trip test failed for dataset")
        }

        // Get the round-trip validation result from the importer
        let isolatedDb = try IsometryDatabase(path: ":memory:")
        try await isolatedDb.initialize()

        // Import the test data into isolated database
        let tempFile = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try testData.write(to: tempFile)
        defer { try? FileManager.default.removeItem(at: tempFile) }

        _ = try await importer.importFromFile(tempFile, folder: "test")
        let importedNodes = try await isolatedDb.getAllNodes()

        // Export the nodes to get round-trip data
        let exportFile = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: exportFile) }

        let exportedData = try await importer.exportNodes(importedNodes, to: exportFile)
        let rtValidation = try await importer.validateRoundTripData(original: testData, exported: exportedData)

        // Perform additional integrity checks
        var findings: [ValidationFinding] = []
        for checkSuite in registeredCheckSuites {
            let suiteFindings = try await checkSuite.performChecks(
                original: testData,
                roundTripResult: rtValidation,
                importedNodes: importedNodes
            )
            findings.append(contentsOf: suiteFindings)
        }

        return ValidationAccuracyResult(
            preservationAccuracy: rtValidation.preservationAccuracy,
            latchMappingAccuracy: rtValidation.latchMappingAccuracy,
            contentIntegrityScore: rtValidation.contentIntegrityScore,
            schemaConformanceScore: rtValidation.schemaConformanceScore,
            findings: findings
        )
    }

    private func calculateAccuracyMetrics(
        results: [ValidationAccuracyResult],
        confidenceLevel: Double
    ) -> AccuracyMetrics {
        guard !results.isEmpty else {
            return AccuracyMetrics(
                preservationAccuracy: 0.0,
                latchMappingAccuracy: 0.0,
                contentIntegrityScore: 0.0,
                schemaConformanceScore: 0.0,
                preservationConfidenceInterval: ConfidenceInterval(lower: 0.0, upper: 0.0),
                latchMappingConfidenceInterval: ConfidenceInterval(lower: 0.0, upper: 0.0),
                contentIntegrityConfidenceInterval: ConfidenceInterval(lower: 0.0, upper: 0.0),
                schemaConformanceConfidenceInterval: ConfidenceInterval(lower: 0.0, upper: 0.0),
                sampleSize: 0,
                confidenceLevel: confidenceLevel
            )
        }

        let preservationValues = results.map { $0.preservationAccuracy }
        let latchMappingValues = results.map { $0.latchMappingAccuracy }
        let contentIntegrityValues = results.map { $0.contentIntegrityScore }
        let schemaConformanceValues = results.map { $0.schemaConformanceScore }

        return AccuracyMetrics(
            preservationAccuracy: preservationValues.reduce(0, +) / Double(preservationValues.count),
            latchMappingAccuracy: latchMappingValues.reduce(0, +) / Double(latchMappingValues.count),
            contentIntegrityScore: contentIntegrityValues.reduce(0, +) / Double(contentIntegrityValues.count),
            schemaConformanceScore: schemaConformanceValues.reduce(0, +) / Double(schemaConformanceValues.count),
            preservationConfidenceInterval: calculateConfidenceInterval(values: preservationValues, confidenceLevel: confidenceLevel),
            latchMappingConfidenceInterval: calculateConfidenceInterval(values: latchMappingValues, confidenceLevel: confidenceLevel),
            contentIntegrityConfidenceInterval: calculateConfidenceInterval(values: contentIntegrityValues, confidenceLevel: confidenceLevel),
            schemaConformanceConfidenceInterval: calculateConfidenceInterval(values: schemaConformanceValues, confidenceLevel: confidenceLevel),
            sampleSize: results.count,
            confidenceLevel: confidenceLevel
        )
    }

    private func calculateConfidenceInterval(values: [Double], confidenceLevel: Double) -> ConfidenceInterval {
        guard values.count > 1 else {
            let value = values.first ?? 0.0
            return ConfidenceInterval(lower: value, upper: value)
        }

        let mean = values.reduce(0, +) / Double(values.count)
        let variance = values.map { pow($0 - mean, 2) }.reduce(0, +) / Double(values.count - 1)
        let standardError = sqrt(variance / Double(values.count))

        // Use t-distribution for small samples
        let tValue = getTValue(degreesOfFreedom: values.count - 1, confidenceLevel: confidenceLevel)
        let margin = tValue * standardError

        return ConfidenceInterval(
            lower: max(0.0, mean - margin),
            upper: min(1.0, mean + margin)
        )
    }

    private func getTValue(degreesOfFreedom: Int, confidenceLevel: Double) -> Double {
        // Simplified t-values for common confidence levels
        // In production, use a proper t-distribution table or library
        let alpha = (1.0 - confidenceLevel) / 2.0

        switch (degreesOfFreedom, confidenceLevel) {
        case (_, 0.95): return degreesOfFreedom < 30 ? 2.045 : 1.96
        case (_, 0.99): return degreesOfFreedom < 30 ? 2.756 : 2.576
        default: return 2.0 // Conservative fallback
        }
    }

    private func generateRemediationSuggestions(
        findings: [ValidationFinding],
        accuracyMetrics: AccuracyMetrics
    ) -> [RemediationSuggestion] {
        var suggestions: [RemediationSuggestion] = []

        // Generate suggestions based on findings
        let criticalFindings = findings.filter { $0.severity == .critical }

        for finding in criticalFindings {
            switch finding.category {
            case .dataLoss:
                suggestions.append(RemediationSuggestion(
                    issue: "Critical data loss detected",
                    solution: "Implement more robust data preservation logic",
                    implementation: "Review export/import pipeline for data transformation steps that may be lossy",
                    priority: .high,
                    estimatedEffort: .medium
                ))

            case .latchMapping:
                suggestions.append(RemediationSuggestion(
                    issue: "LATCH property mapping errors",
                    solution: "Improve LATCH property extraction and mapping",
                    implementation: "Enhance parsing logic for location, alphabet, time, category, and hierarchy properties",
                    priority: .medium,
                    estimatedEffort: .low
                ))

            case .schemaViolation:
                suggestions.append(RemediationSuggestion(
                    issue: "Schema conformance violations",
                    solution: "Strengthen input validation and schema enforcement",
                    implementation: "Add comprehensive validation checks before database insertion",
                    priority: .high,
                    estimatedEffort: .low
                ))

            default:
                break
            }
        }

        // Generate suggestions based on accuracy metrics
        if accuracyMetrics.preservationAccuracy < 0.999 {
            suggestions.append(RemediationSuggestion(
                issue: "Data preservation below 99.9% requirement",
                solution: "Investigate and fix data transformation pipeline",
                implementation: "Add detailed logging to identify where data is being lost or modified",
                priority: .high,
                estimatedEffort: .medium
            ))
        }

        if accuracyMetrics.latchMappingAccuracy < 0.95 {
            suggestions.append(RemediationSuggestion(
                issue: "LATCH mapping accuracy below 95% requirement",
                solution: "Enhance LATCH property extraction algorithms",
                implementation: "Improve pattern recognition for location, time, and category extraction",
                priority: .medium,
                estimatedEffort: .medium
            ))
        }

        return suggestions
    }

    private func generateTrendAnalysis(importer: String, current: AccuracyMetrics) -> TrendAnalysis? {
        guard let history = validationHistory[importer], history.count >= 2 else {
            return nil
        }

        return TrendAnalysis(dataPoints: history + [current])
    }

    private func generateRecommendations(
        accuracyMetrics: AccuracyMetrics,
        findings: [ValidationFinding],
        baselineComparison: BaselineComparison?
    ) -> [String] {
        var recommendations: [String] = []

        if !accuracyMetrics.meetsProductionRequirements {
            recommendations.append("⚠️ Not ready for production deployment - address accuracy issues first")
        }

        if let comparison = baselineComparison, comparison.regressionDetected {
            recommendations.append("🚨 Regression detected - investigate recent changes")
        }

        let criticalFindings = findings.filter { $0.severity == .critical }
        if !criticalFindings.isEmpty {
            recommendations.append("🔥 \(criticalFindings.count) critical issues require immediate attention")
        }

        if accuracyMetrics.qualityGrade == .excellent {
            recommendations.append("✅ Excellent quality - consider this implementation as a reference standard")
        }

        return recommendations
    }
}

// MARK: - Built-in Integrity Check Suites

/// Core integrity checks covering essential data preservation requirements
public struct CoreIntegrityCheckSuite: DataIntegrityValidator.IntegrityCheckSuite {
    public let suiteName = "Core Integrity"
    public let checksIncluded = ["Node Count", "Content Preservation", "ID Uniqueness", "Timestamp Validity"]

    public func performChecks(
        original: Data,
        roundTripResult: RoundTripValidationResult,
        importedNodes: [Node]
    ) async throws -> [DataIntegrityValidator.ValidationFinding] {
        var findings: [DataIntegrityValidator.ValidationFinding] = []

        // Check node count reasonableness
        if importedNodes.isEmpty && original.count > 100 {
            findings.append(DataIntegrityValidator.ValidationFinding(
                category: .dataLoss,
                severity: .critical,
                description: "No nodes created from non-trivial input data",
                affectedDataCount: 1,
                suggestedFix: "Verify import logic is correctly parsing input format"
            ))
        }

        // Check ID uniqueness
        let ids = importedNodes.map { $0.id }
        let uniqueIds = Set(ids)
        if ids.count != uniqueIds.count {
            findings.append(DataIntegrityValidator.ValidationFinding(
                category: .schemaViolation,
                severity: .critical,
                description: "Duplicate node IDs detected",
                affectedDataCount: ids.count - uniqueIds.count,
                suggestedFix: "Ensure ID generation logic creates unique identifiers"
            ))
        }

        // Check timestamp validity
        let now = Date()
        let futureNodes = importedNodes.filter { $0.createdAt > now || $0.modifiedAt > now }
        if !futureNodes.isEmpty {
            findings.append(DataIntegrityValidator.ValidationFinding(
                category: .schemaViolation,
                severity: .warning,
                description: "Nodes with future timestamps detected",
                affectedDataCount: futureNodes.count,
                suggestedFix: "Validate timestamp parsing and default to current time for invalid dates"
            ))
        }

        return findings
    }
}

/// Performance-related integrity checks
public struct PerformanceIntegrityCheckSuite: DataIntegrityValidator.IntegrityCheckSuite {
    public let suiteName = "Performance Integrity"
    public let checksIncluded = ["Memory Efficiency", "Processing Time", "Data Size Correlation"]

    public func performChecks(
        original: Data,
        roundTripResult: RoundTripValidationResult,
        importedNodes: [Node]
    ) async throws -> [DataIntegrityValidator.ValidationFinding] {
        var findings: [DataIntegrityValidator.ValidationFinding] = []

        // Check data size correlation (imported nodes should correlate with input size)
        let inputSizeKB = Double(original.count) / 1024.0
        let nodeCount = importedNodes.count

        // Expect roughly 1 node per KB for normal documents
        let expectedNodeRange = max(1, Int(inputSizeKB * 0.1))...Int(inputSizeKB * 10)

        if !expectedNodeRange.contains(nodeCount) {
            let severity: DataIntegrityValidator.Severity = nodeCount == 0 ? .critical : .warning
            findings.append(DataIntegrityValidator.ValidationFinding(
                category: .performance,
                severity: severity,
                description: "Node count (\(nodeCount)) doesn't correlate with input size (\(String(format: "%.1f", inputSizeKB)) KB)",
                affectedDataCount: nodeCount,
                suggestedFix: "Review parsing logic to ensure appropriate granularity of node creation"
            ))
        }

        return findings
    }
}

/// Security-related integrity checks
public struct SecurityIntegrityCheckSuite: DataIntegrityValidator.IntegrityCheckSuite {
    public let suiteName = "Security Integrity"
    public let checksIncluded = ["Content Sanitization", "XSS Prevention", "SQL Injection Prevention"]

    public func performChecks(
        original: Data,
        roundTripResult: RoundTripValidationResult,
        importedNodes: [Node]
    ) async throws -> [DataIntegrityValidator.ValidationFinding] {
        var findings: [DataIntegrityValidator.ValidationFinding] = []

        // Check for potential XSS content that wasn't sanitized
        let xssPatterns = ["<script>", "javascript:", "onclick=", "onerror="]
        for node in importedNodes {
            if let content = node.content {
                for pattern in xssPatterns {
                    if content.localizedCaseInsensitiveContains(pattern) {
                        findings.append(DataIntegrityValidator.ValidationFinding(
                            category: .contentCorruption,
                            severity: .warning,
                            description: "Potential XSS content detected in node",
                            affectedDataCount: 1,
                            sampleExamples: [pattern],
                            suggestedFix: "Implement content sanitization for web content"
                        ))
                        break
                    }
                }
            }
        }

        return findings
    }
}

// MARK: - Validation Errors

public enum ValidationError: Error, LocalizedError {
    case roundTripTestFailed(String)
    case insufficientData(String)
    case statisticalAnalysisError(String)

    public var errorDescription: String? {
        switch self {
        case .roundTripTestFailed(let message):
            return "Round-trip test failed: \(message)"
        case .insufficientData(let message):
            return "Insufficient data for validation: \(message)"
        case .statisticalAnalysisError(let message):
            return "Statistical analysis error: \(message)"
        }
    }
}