import Foundation
import os.log

/// Statistical analysis engine for A/B testing with significance testing and power analysis
public final class ABTestStatistics: Sendable {

    private let logger = Logger(subsystem: "com.isometry.app", category: "ABTestStatistics")

    public init() {}

    // MARK: - Primary Analysis Methods

    /// Analyze ongoing experiment for statistical significance
    public func analyzeExperiment(
        variants: [ABTestVariant],
        results: ExperimentResults,
        configuration: ABTestConfiguration
    ) async -> StatisticalAnalysis {
        // Extract metrics for control and test variants
        let controlVariant = variants.first { $0.isControl }
        let testVariants = variants.filter { !$0.isControl }

        guard let control = controlVariant,
              let controlMetrics = results.variantMetrics[control.id],
              !testVariants.isEmpty else {
            return StatisticalAnalysis(
                hasStatisticalSignificance: false,
                confidence: 0.0,
                pValue: 1.0,
                winningVariant: nil,
                effectSize: 0.0,
                recommendedAction: .needMoreData,
                analysisDate: Date()
            )
        }

        // Find the best performing test variant
        let primaryMetric = configuration.primaryMetric
        var bestTestVariant: ABTestVariant?
        var bestPValue = 1.0
        var bestEffectSize = 0.0
        var bestConfidence = 0.0

        for testVariant in testVariants {
            guard let testMetrics = results.variantMetrics[testVariant.id] else { continue }

            let analysis = performTTest(
                controlMetrics: controlMetrics,
                testMetrics: testMetrics,
                primaryMetric: primaryMetric,
                significanceLevel: configuration.significanceLevel
            )

            if analysis.pValue < bestPValue {
                bestPValue = analysis.pValue
                bestEffectSize = analysis.effectSize
                bestConfidence = analysis.confidence
                bestTestVariant = testVariant
            }
        }

        let hasSignificance = bestPValue < configuration.significanceLevel
        let recommendedAction = determineRecommendedAction(
            pValue: bestPValue,
            significanceLevel: configuration.significanceLevel,
            sampleSize: controlMetrics.userCount + (results.variantMetrics[bestTestVariant?.id ?? ""]?.userCount ?? 0),
            expectedSampleSize: configuration.expectedSampleSize,
            effectSize: bestEffectSize
        )

        return StatisticalAnalysis(
            hasStatisticalSignificance: hasSignificance,
            confidence: bestConfidence,
            pValue: bestPValue,
            winningVariant: hasSignificance ? bestTestVariant?.id : nil,
            effectSize: bestEffectSize,
            recommendedAction: recommendedAction,
            analysisDate: Date()
        )
    }

    /// Perform final comprehensive analysis when experiment completes
    public func performFinalAnalysis(
        experiment: ABTest,
        events: [ABTestEvent]
    ) async -> StatisticalAnalysis {
        let controlVariant = experiment.variants.first { $0.isControl }
        let testVariants = experiment.variants.filter { !$0.isControl }

        guard let control = controlVariant, !testVariants.isEmpty else {
            return StatisticalAnalysis(
                hasStatisticalSignificance: false,
                confidence: 0.0,
                pValue: 1.0,
                winningVariant: nil,
                effectSize: 0.0,
                recommendedAction: .stopInconclusive,
                analysisDate: Date()
            )
        }

        // Generate comprehensive metrics from events
        let controlMetrics = generateMetricsFromEvents(
            events: events.filter { $0.variantId == control.id }
        )

        var bestResult: (variant: ABTestVariant, analysis: TTestResult)?

        for testVariant in testVariants {
            let testEvents = events.filter { $0.variantId == testVariant.id }
            let testMetrics = generateMetricsFromEvents(events: testEvents)

            let analysis = performTTest(
                controlMetrics: controlMetrics,
                testMetrics: testMetrics,
                primaryMetric: experiment.configuration.primaryMetric,
                significanceLevel: experiment.configuration.significanceLevel
            )

            if bestResult == nil || analysis.pValue < bestResult!.analysis.pValue {
                bestResult = (testVariant, analysis)
            }
        }

        guard let best = bestResult else {
            return StatisticalAnalysis(
                hasStatisticalSignificance: false,
                confidence: 0.0,
                pValue: 1.0,
                winningVariant: nil,
                effectSize: 0.0,
                recommendedAction: .stopInconclusive,
                analysisDate: Date()
            )
        }

        let hasSignificance = best.analysis.pValue < experiment.configuration.significanceLevel
        let winnerVariant = hasSignificance ? best.variant.id : nil

        return StatisticalAnalysis(
            hasStatisticalSignificance: hasSignificance,
            confidence: best.analysis.confidence,
            pValue: best.analysis.pValue,
            winningVariant: winnerVariant,
            effectSize: best.analysis.effectSize,
            recommendedAction: hasSignificance ? .declareWinner : .stopInconclusive,
            analysisDate: Date()
        )
    }

    /// Calculate required sample size for desired statistical power
    public func calculateRequiredSampleSize(
        baselineConversionRate: Double,
        minimumDetectableEffect: Double,
        significanceLevel: Double = 0.05,
        statisticalPower: Double = 0.8
    ) -> Int {
        // Using approximation for two-proportion z-test
        let alpha = significanceLevel
        let beta = 1.0 - statisticalPower

        let p1 = baselineConversionRate
        let p2 = baselineConversionRate + minimumDetectableEffect

        let zAlpha = standardNormalInverse(1.0 - alpha / 2.0)
        let zBeta = standardNormalInverse(1.0 - beta)

        let pooledP = (p1 + p2) / 2.0
        let numerator = (zAlpha * sqrt(2 * pooledP * (1 - pooledP)) + zBeta * sqrt(p1 * (1 - p1) + p2 * (1 - p2)))
        let denominator = abs(p2 - p1)

        let sampleSizePerGroup = pow(numerator / denominator, 2)

        return Int(ceil(sampleSizePerGroup))
    }

    /// Calculate statistical power for given experiment parameters
    public func calculateStatisticalPower(
        controlConversionRate: Double,
        testConversionRate: Double,
        sampleSizePerGroup: Int,
        significanceLevel: Double = 0.05
    ) -> Double {
        let p1 = controlConversionRate
        let p2 = testConversionRate
        let n = Double(sampleSizePerGroup)

        let pooledP = (p1 + p2) / 2.0
        let se1 = sqrt(p1 * (1 - p1) / n)
        let se2 = sqrt(p2 * (1 - p2) / n)
        let sePooled = sqrt(pooledP * (1 - pooledP) * (2 / n))

        let zAlpha = standardNormalInverse(1.0 - significanceLevel / 2.0)
        let criticalValue = zAlpha * sePooled

        let effectSize = abs(p2 - p1)
        let seDiff = sqrt(se1 * se1 + se2 * se2)

        let zBeta = (criticalValue - effectSize) / seDiff
        let power = 1.0 - standardNormalCdf(zBeta)

        return max(0.0, min(1.0, power))
    }

    // MARK: - Statistical Tests

    /// Perform Welch's t-test for unequal variances
    private func performTTest(
        controlMetrics: VariantMetrics,
        testMetrics: VariantMetrics,
        primaryMetric: String,
        significanceLevel: Double
    ) -> TTestResult {
        // Extract primary metric values
        let (controlMean, controlStd, controlN) = extractMetricStats(controlMetrics, metric: primaryMetric)
        let (testMean, testStd, testN) = extractMetricStats(testMetrics, metric: primaryMetric)

        guard controlN > 1 && testN > 1 else {
            return TTestResult(
                pValue: 1.0,
                tStatistic: 0.0,
                degreesOfFreedom: 0,
                effectSize: 0.0,
                confidence: 0.0
            )
        }

        // Calculate standard error of difference
        let se1 = controlStd * controlStd / Double(controlN)
        let se2 = testStd * testStd / Double(testN)
        let seDiff = sqrt(se1 + se2)

        guard seDiff > 0 else {
            return TTestResult(
                pValue: 1.0,
                tStatistic: 0.0,
                degreesOfFreedom: 0,
                effectSize: 0.0,
                confidence: 0.0
            )
        }

        // Calculate t-statistic
        let tStatistic = (testMean - controlMean) / seDiff

        // Calculate degrees of freedom (Welch-Satterthwaite equation)
        let numerator = pow(se1 + se2, 2)
        let denominator = (se1 * se1) / Double(controlN - 1) + (se2 * se2) / Double(testN - 1)
        let degreesOfFreedom = numerator / denominator

        // Calculate p-value (two-tailed)
        let pValue = 2.0 * (1.0 - tDistributionCdf(abs(tStatistic), df: degreesOfFreedom))

        // Calculate effect size (Cohen's d)
        let pooledStd = sqrt(((Double(controlN - 1) * controlStd * controlStd) + (Double(testN - 1) * testStd * testStd)) / Double(controlN + testN - 2))
        let effectSize = abs(testMean - controlMean) / pooledStd

        // Calculate confidence level
        let confidence = 1.0 - pValue

        return TTestResult(
            pValue: pValue,
            tStatistic: tStatistic,
            degreesOfFreedom: degreesOfFreedom,
            effectSize: effectSize,
            confidence: confidence
        )
    }

    /// Perform chi-square test for conversion rate differences
    private func performChiSquareTest(
        controlSuccesses: Int,
        controlTotal: Int,
        testSuccesses: Int,
        testTotal: Int
    ) -> ChiSquareResult {
        let totalSuccesses = controlSuccesses + testSuccesses
        let totalTotal = controlTotal + testTotal
        let overallRate = Double(totalSuccesses) / Double(totalTotal)

        // Expected values
        let expectedControlSuccesses = Double(controlTotal) * overallRate
        let expectedControlFailures = Double(controlTotal) * (1.0 - overallRate)
        let expectedTestSuccesses = Double(testTotal) * overallRate
        let expectedTestFailures = Double(testTotal) * (1.0 - overallRate)

        // Chi-square statistic
        let chiSquare = pow(Double(controlSuccesses) - expectedControlSuccesses, 2) / expectedControlSuccesses +
                       pow(Double(controlTotal - controlSuccesses) - expectedControlFailures, 2) / expectedControlFailures +
                       pow(Double(testSuccesses) - expectedTestSuccesses, 2) / expectedTestSuccesses +
                       pow(Double(testTotal - testSuccesses) - expectedTestFailures, 2) / expectedTestFailures

        // p-value with 1 degree of freedom
        let pValue = 1.0 - chiSquareDistributionCdf(chiSquare, df: 1)

        return ChiSquareResult(
            pValue: pValue,
            chiSquare: chiSquare,
            degreesOfFreedom: 1
        )
    }

    // MARK: - Helper Methods

    private func extractMetricStats(_ metrics: VariantMetrics, metric: String) -> (mean: Double, std: Double, count: Int) {
        switch metric {
        case "conversion_rate":
            let mean = metrics.conversionRate
            let std = sqrt(mean * (1.0 - mean) / Double(metrics.userCount)) // Standard error for proportion
            return (mean, std, metrics.userCount)
        case "average_value":
            let mean = metrics.userCount > 0 ? metrics.totalValue / Double(metrics.userCount) : 0.0
            let std = sqrt(mean) // Simplified assumption
            return (mean, std, metrics.userCount)
        default:
            return (0.0, 0.0, 0)
        }
    }

    private func generateMetricsFromEvents(events: [ABTestEvent]) -> VariantMetrics {
        let uniqueUsers = Set(events.map { $0.userId })
        let conversions = events.filter { $0.eventType == .conversion }

        return VariantMetrics(
            variantId: events.first?.variantId ?? "",
            userCount: uniqueUsers.count,
            eventCount: events.count,
            totalValue: events.reduce(0) { $0 + $1.value },
            conversionRate: uniqueUsers.count > 0 ? Double(conversions.count) / Double(uniqueUsers.count) : 0.0,
            eventTypeMetrics: [:],
            lastEvent: events.max(by: { $0.timestamp < $1.timestamp })?.timestamp
        )
    }

    private func determineRecommendedAction(
        pValue: Double,
        significanceLevel: Double,
        sampleSize: Int,
        expectedSampleSize: Int,
        effectSize: Double
    ) -> StatisticalAnalysis.RecommendedAction {
        if pValue < significanceLevel {
            return .declareWinner
        }

        if sampleSize < expectedSampleSize * 2 { // Haven't reached expected size
            return .continueTest
        }

        if effectSize < 0.1 { // Very small effect size
            return .stopInconclusive
        }

        return .needMoreData
    }

    // MARK: - Statistical Distribution Functions

    /// Standard normal cumulative distribution function
    private func standardNormalCdf(_ x: Double) -> Double {
        return 0.5 * (1.0 + erf(x / sqrt(2.0)))
    }

    /// Inverse standard normal cumulative distribution function (approximation)
    private func standardNormalInverse(_ p: Double) -> Double {
        // Rational approximation (Beasley-Springer-Moro algorithm)
        guard p > 0 && p < 1 else { return p <= 0 ? -Double.infinity : Double.infinity }

        if p == 0.5 { return 0.0 }

        let q = p > 0.5 ? 1.0 - p : p
        let t = sqrt(-2.0 * log(q))

        let c0 = 2.515517
        let c1 = 0.802853
        let c2 = 0.010328
        let d1 = 1.432788
        let d2 = 0.189269
        let d3 = 0.001308

        let numerator = c0 + c1 * t + c2 * t * t
        let denominator = 1.0 + d1 * t + d2 * t * t + d3 * t * t * t

        let result = t - numerator / denominator

        return p > 0.5 ? -result : result
    }

    /// T-distribution cumulative distribution function (approximation)
    private func tDistributionCdf(_ x: Double, df: Double) -> Double {
        // For large df, approximate with standard normal
        if df > 30 {
            return standardNormalCdf(x)
        }

        // Simple approximation for small df
        let a = 4.0 * df
        let b = a + x * x
        let y = atan2(x, sqrt(df)) / (.pi / 2.0)

        return 0.5 + y * (0.5 + y * y * (1.0 / 8.0 + y * y * (1.0 / 128.0)))
    }

    /// Chi-square distribution cumulative distribution function (approximation)
    private func chiSquareDistributionCdf(_ x: Double, df: Int) -> Double {
        // Simplified approximation using normal distribution
        let mean = Double(df)
        let variance = 2.0 * Double(df)
        let standardized = (x - mean) / sqrt(variance)

        return standardNormalCdf(standardized)
    }

    /// Error function (used in normal distribution)
    private func erf(_ x: Double) -> Double {
        // Approximation of error function
        let a1 = 0.254829592
        let a2 = -0.284496736
        let a3 = 1.421413741
        let a4 = -1.453152027
        let a5 = 1.061405429
        let p = 0.3275911

        let sign = x >= 0 ? 1.0 : -1.0
        let absX = abs(x)

        let t = 1.0 / (1.0 + p * absX)
        let y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * exp(-absX * absX)

        return sign * y
    }
}

// MARK: - Supporting Types

/// T-test result structure
private struct TTestResult {
    let pValue: Double
    let tStatistic: Double
    let degreesOfFreedom: Double
    let effectSize: Double
    let confidence: Double
}

/// Chi-square test result structure
private struct ChiSquareResult {
    let pValue: Double
    let chiSquare: Double
    let degreesOfFreedom: Int
}