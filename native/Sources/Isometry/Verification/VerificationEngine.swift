import Foundation

/// Core verification algorithms and accuracy calculations for data comparison
/// Implements sophisticated comparison algorithms with difference classification
public actor VerificationEngine {

    // Configuration
    private let timestampTolerance: TimeInterval
    private let contentSimilarityThreshold: Double
    private let acceptableDifferences: Set<String>

    public init(
        timestampTolerance: TimeInterval = 1.0, // 1 second tolerance
        contentSimilarityThreshold: Double = 0.95, // 95% similarity threshold
        acceptableDifferences: Set<String> = ["whitespace", "formatting", "precision"]
    ) {
        self.timestampTolerance = timestampTolerance
        self.contentSimilarityThreshold = contentSimilarityThreshold
        self.acceptableDifferences = acceptableDifferences
    }

    // MARK: - Node Comparison Operations

    /// Compare two nodes and return detailed comparison result
    public func compareNodes(native: Node, alto: Node?) async -> NodeComparisonResult {
        guard let alto = alto else {
            return NodeComparisonResult(
                nodeId: native.id,
                nativePresent: true,
                altoPresent: false,
                differences: ["Node missing in alto-index export"],
                accuracy: 0.0,
                classification: .critical,
                fieldAccuracies: [:]
            )
        }

        var differences: [String] = []
        var fieldAccuracies: [String: Double] = [:]
        var totalAccuracy = 0.0

        // Compare each field with weights
        let fieldComparisons: [(String, Double, Double)] = [
            ("id", compareIdentifiers(native: native.id, alto: alto.id), 0.05),
            ("name", compareStrings(native: native.name, alto: alto.name), 0.20),
            ("content", compareContent(native: native.content, alto: alto.content), 0.30),
            ("summary", compareStrings(native: native.summary, alto: alto.summary), 0.10),
            ("createdAt", compareDates(native: native.createdAt, alto: alto.createdAt), 0.10),
            ("modifiedAt", compareDates(native: native.modifiedAt, alto: alto.modifiedAt), 0.10),
            ("folder", compareStrings(native: native.folder, alto: alto.folder), 0.05),
            ("tags", compareTags(native: native.tags, alto: alto.tags), 0.05),
            ("source", compareStrings(native: native.source, alto: alto.source), 0.03),
            ("sourceId", compareStrings(native: native.sourceId, alto: alto.sourceId), 0.02)
        ]

        for (fieldName, accuracy, weight) in fieldComparisons {
            fieldAccuracies[fieldName] = accuracy
            totalAccuracy += accuracy * weight

            if accuracy < 1.0 {
                differences.append(generateFieldDifference(fieldName: fieldName, accuracy: accuracy, native: native, alto: alto))
            }
        }

        // Classify overall difference
        let classification = classifyDifference(accuracy: totalAccuracy, differences: differences)

        return NodeComparisonResult(
            nodeId: native.id,
            nativePresent: true,
            altoPresent: true,
            differences: differences,
            accuracy: totalAccuracy,
            classification: classification,
            fieldAccuracies: fieldAccuracies
        )
    }

    /// Perform full comparison between two node collections
    public func performFullComparison(dataA: [Node], dataB: [Node]) async -> [NodeComparisonResult] {
        // Create lookup maps for efficient comparison
        let dataBMap = Dictionary(uniqueKeysWithValues: dataB.map { ($0.sourceId ?? $0.id, $0) })

        var results: [NodeComparisonResult] = []

        for nodeA in dataA {
            let sourceId = nodeA.sourceId ?? nodeA.id
            let nodeB = dataBMap[sourceId]
            let result = await compareNodes(native: nodeA, alto: nodeB)
            results.append(result)
        }

        // Check for nodes that exist only in dataB
        let dataAIds = Set(dataA.map { $0.sourceId ?? $0.id })
        let onlyInB = dataB.filter { !dataAIds.contains($0.sourceId ?? $0.id) }

        for orphanNode in onlyInB {
            let orphanResult = NodeComparisonResult(
                nodeId: orphanNode.id,
                nativePresent: false,
                altoPresent: true,
                differences: ["Node exists only in second dataset"],
                accuracy: 0.0,
                classification: .warning,
                fieldAccuracies: [:]
            )
            results.append(orphanResult)
        }

        return results
    }

    /// Perform structural comparison (metadata only)
    public func performStructuralComparison(dataA: [Node], dataB: [Node]) async -> [NodeComparisonResult] {
        let dataBMap = Dictionary(uniqueKeysWithValues: dataB.map { ($0.sourceId ?? $0.id, $0) })

        var results: [NodeComparisonResult] = []

        for nodeA in dataA {
            let sourceId = nodeA.sourceId ?? nodeA.id
            guard let nodeB = dataBMap[sourceId] else {
                results.append(NodeComparisonResult(
                    nodeId: nodeA.id,
                    nativePresent: true,
                    altoPresent: false,
                    differences: ["Node missing in comparison dataset"],
                    accuracy: 0.0,
                    classification: .critical,
                    fieldAccuracies: [:]
                ))
                continue
            }

            var differences: [String] = []
            var fieldAccuracies: [String: Double] = [:]
            var totalAccuracy = 0.0

            // Only compare structural fields
            let structuralComparisons: [(String, Double, Double)] = [
                ("id", compareIdentifiers(native: nodeA.id, alto: nodeB.id), 0.1),
                ("name", compareStrings(native: nodeA.name, alto: nodeB.name), 0.3),
                ("createdAt", compareDates(native: nodeA.createdAt, alto: nodeB.createdAt), 0.2),
                ("modifiedAt", compareDates(native: nodeA.modifiedAt, alto: nodeB.modifiedAt), 0.2),
                ("folder", compareStrings(native: nodeA.folder, alto: nodeB.folder), 0.1),
                ("tags", compareTags(native: nodeA.tags, alto: nodeB.tags), 0.1)
            ]

            for (fieldName, accuracy, weight) in structuralComparisons {
                fieldAccuracies[fieldName] = accuracy
                totalAccuracy += accuracy * weight

                if accuracy < 1.0 {
                    differences.append(generateFieldDifference(fieldName: fieldName, accuracy: accuracy, native: nodeA, alto: nodeB))
                }
            }

            let classification = classifyDifference(accuracy: totalAccuracy, differences: differences)

            results.append(NodeComparisonResult(
                nodeId: nodeA.id,
                nativePresent: true,
                altoPresent: true,
                differences: differences,
                accuracy: totalAccuracy,
                classification: classification,
                fieldAccuracies: fieldAccuracies
            ))
        }

        return results
    }

    /// Perform content-only comparison
    public func performContentComparison(dataA: [Node], dataB: [Node]) async -> [NodeComparisonResult] {
        let dataBMap = Dictionary(uniqueKeysWithValues: dataB.map { ($0.sourceId ?? $0.id, $0) })

        var results: [NodeComparisonResult] = []

        for nodeA in dataA {
            let sourceId = nodeA.sourceId ?? nodeA.id
            guard let nodeB = dataBMap[sourceId] else {
                results.append(NodeComparisonResult(
                    nodeId: nodeA.id,
                    nativePresent: true,
                    altoPresent: false,
                    differences: ["Node missing in comparison dataset"],
                    accuracy: 0.0,
                    classification: .critical,
                    fieldAccuracies: [:]
                ))
                continue
            }

            let contentAccuracy = compareContent(native: nodeA.content, alto: nodeB.content)
            let summaryAccuracy = compareStrings(native: nodeA.summary, alto: nodeB.summary)

            let overallAccuracy = (contentAccuracy * 0.8) + (summaryAccuracy * 0.2)

            var differences: [String] = []
            if contentAccuracy < 1.0 {
                differences.append("Content differs (similarity: \(String(format: "%.1f", contentAccuracy * 100))%)")
            }
            if summaryAccuracy < 1.0 {
                differences.append("Summary differs (similarity: \(String(format: "%.1f", summaryAccuracy * 100))%)")
            }

            let classification = classifyDifference(accuracy: overallAccuracy, differences: differences)

            results.append(NodeComparisonResult(
                nodeId: nodeA.id,
                nativePresent: true,
                altoPresent: true,
                differences: differences,
                accuracy: overallAccuracy,
                classification: classification,
                fieldAccuracies: ["content": contentAccuracy, "summary": summaryAccuracy]
            ))
        }

        return results
    }

    /// Perform metadata-only comparison
    public func performMetadataComparison(dataA: [Node], dataB: [Node]) async -> [NodeComparisonResult] {
        let dataBMap = Dictionary(uniqueKeysWithValues: dataB.map { ($0.sourceId ?? $0.id, $0) })

        var results: [NodeComparisonResult] = []

        for nodeA in dataA {
            let sourceId = nodeA.sourceId ?? nodeA.id
            guard let nodeB = dataBMap[sourceId] else {
                results.append(NodeComparisonResult(
                    nodeId: nodeA.id,
                    nativePresent: true,
                    altoPresent: false,
                    differences: ["Node missing in comparison dataset"],
                    accuracy: 0.0,
                    classification: .critical,
                    fieldAccuracies: [:]
                ))
                continue
            }

            var differences: [String] = []
            var fieldAccuracies: [String: Double] = [:]
            var totalAccuracy = 0.0

            // Compare metadata fields only
            let metadataComparisons: [(String, Double, Double)] = [
                ("source", compareStrings(native: nodeA.source, alto: nodeB.source), 0.2),
                ("sourceId", compareStrings(native: nodeA.sourceId, alto: nodeB.sourceId), 0.3),
                ("sourceUrl", compareStrings(native: nodeA.sourceUrl, alto: nodeB.sourceUrl), 0.1),
                ("version", compareIntegers(native: nodeA.version, alto: nodeB.version), 0.1),
                ("syncVersion", compareIntegers(native: nodeA.syncVersion, alto: nodeB.syncVersion), 0.1),
                ("priority", compareIntegers(native: nodeA.priority, alto: nodeB.priority), 0.1),
                ("importance", compareIntegers(native: nodeA.importance, alto: nodeB.importance), 0.1)
            ]

            for (fieldName, accuracy, weight) in metadataComparisons {
                fieldAccuracies[fieldName] = accuracy
                totalAccuracy += accuracy * weight

                if accuracy < 1.0 {
                    differences.append(generateFieldDifference(fieldName: fieldName, accuracy: accuracy, native: nodeA, alto: nodeB))
                }
            }

            let classification = classifyDifference(accuracy: totalAccuracy, differences: differences)

            results.append(NodeComparisonResult(
                nodeId: nodeA.id,
                nativePresent: true,
                altoPresent: true,
                differences: differences,
                accuracy: totalAccuracy,
                classification: classification,
                fieldAccuracies: fieldAccuracies
            ))
        }

        return results
    }

    // MARK: - Field Comparison Methods

    /// Compare string fields with similarity calculation
    private func compareStrings(native: String?, alto: String?) -> Double {
        switch (native, alto) {
        case (nil, nil):
            return 1.0
        case (nil, _), (_, nil):
            return 0.0
        case let (n?, a?):
            return stringSimilarity(n, a)
        }
    }

    /// Compare content fields with advanced text analysis
    private func compareContent(native: String?, alto: String?) -> Double {
        switch (native, alto) {
        case (nil, nil):
            return 1.0
        case (nil, _), (_, nil):
            return 0.0
        case let (n?, a?):
            return advancedContentSimilarity(native: n, alto: a)
        }
    }

    /// Compare date fields with tolerance
    private func compareDates(native: Date?, alto: Date?) -> Double {
        switch (native, alto) {
        case (nil, nil):
            return 1.0
        case (nil, _), (_, nil):
            return 0.0
        case let (n?, a?):
            let timeDifference = abs(n.timeIntervalSince(a))
            return timeDifference <= timestampTolerance ? 1.0 : max(0.0, 1.0 - (timeDifference / 3600.0)) // Degrade over an hour
        }
    }

    /// Compare identifier fields
    private func compareIdentifiers(native: String, alto: String) -> Double {
        return native == alto ? 1.0 : 0.0
    }

    /// Compare tag arrays
    private func compareTags(native: [String], alto: [String]) -> Double {
        let nativeSet = Set(native)
        let altoSet = Set(alto)

        guard !nativeSet.isEmpty || !altoSet.isEmpty else {
            return 1.0 // Both empty
        }

        let intersection = nativeSet.intersection(altoSet)
        let union = nativeSet.union(altoSet)

        return Double(intersection.count) / Double(union.count)
    }

    /// Compare integer fields
    private func compareIntegers(native: Int?, alto: Int?) -> Double {
        switch (native, alto) {
        case (nil, nil):
            return 1.0
        case (nil, _), (_, nil):
            return 0.0
        case let (n?, a?):
            return n == a ? 1.0 : 0.0
        }
    }

    // MARK: - Similarity Algorithms

    /// Calculate string similarity using multiple algorithms
    private func stringSimilarity(_ str1: String, _ str2: String) -> Double {
        guard !str1.isEmpty && !str2.isEmpty else {
            return str1 == str2 ? 1.0 : 0.0
        }

        // Combine multiple similarity metrics
        let jaroWinkler = jaroWinklerSimilarity(str1, str2)
        let levenshtein = levenshteinSimilarity(str1, str2)
        let longestCommon = longestCommonSubsequenceSimilarity(str1, str2)

        // Weighted average
        return (jaroWinkler * 0.4) + (levenshtein * 0.3) + (longestCommon * 0.3)
    }

    /// Advanced content similarity with markdown awareness
    private func advancedContentSimilarity(native: String, alto: String) -> Double {
        // Normalize whitespace and formatting
        let nativeNormalized = normalizeContent(native)
        let altoNormalized = normalizeContent(alto)

        // Calculate basic similarity
        let basicSimilarity = stringSimilarity(nativeNormalized, altoNormalized)

        // Check for markdown structure preservation
        let markdownScore = compareMarkdownStructure(native: native, alto: alto)

        // Combine scores
        return (basicSimilarity * 0.7) + (markdownScore * 0.3)
    }

    /// Normalize content for comparison
    private func normalizeContent(_ content: String) -> String {
        return content
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    }

    /// Compare markdown structure preservation
    private func compareMarkdownStructure(native: String, alto: String) -> Double {
        let nativeHeaders = extractMarkdownHeaders(native)
        let altoHeaders = extractMarkdownHeaders(alto)

        let nativeLinks = extractMarkdownLinks(native)
        let altoLinks = extractMarkdownLinks(alto)

        let headerSimilarity = compareArrays(nativeHeaders, altoHeaders)
        let linkSimilarity = compareArrays(nativeLinks, altoLinks)

        return (headerSimilarity + linkSimilarity) / 2.0
    }

    /// Extract markdown headers
    private func extractMarkdownHeaders(_ content: String) -> [String] {
        let pattern = "^#+\\s+(.+)$"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .anchorsMatchLines) else {
            return []
        }

        let matches = regex.matches(in: content, range: NSRange(content.startIndex..., in: content))
        return matches.compactMap { match in
            guard let range = Range(match.range(at: 1), in: content) else { return nil }
            return String(content[range])
        }
    }

    /// Extract markdown links
    private func extractMarkdownLinks(_ content: String) -> [String] {
        let pattern = "\\[([^\\]]+)\\]\\(([^\\)]+)\\)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return []
        }

        let matches = regex.matches(in: content, range: NSRange(content.startIndex..., in: content))
        return matches.compactMap { match in
            guard let textRange = Range(match.range(at: 1), in: content),
                  let urlRange = Range(match.range(at: 2), in: content) else { return nil }
            return "\(content[textRange])|\(content[urlRange])"
        }
    }

    /// Compare two string arrays
    private func compareArrays(_ arr1: [String], _ arr2: [String]) -> Double {
        let set1 = Set(arr1)
        let set2 = Set(arr2)

        guard !set1.isEmpty || !set2.isEmpty else {
            return 1.0
        }

        let intersection = set1.intersection(set2)
        let union = set1.union(set2)

        return Double(intersection.count) / Double(union.count)
    }

    // MARK: - String Similarity Implementations

    /// Jaro-Winkler similarity
    private func jaroWinklerSimilarity(_ str1: String, _ str2: String) -> Double {
        let jaro = jaroSimilarity(str1, str2)
        let prefixLength = min(4, commonPrefixLength(str1, str2))
        return jaro + (0.1 * Double(prefixLength) * (1 - jaro))
    }

    /// Jaro similarity
    private func jaroSimilarity(_ str1: String, _ str2: String) -> Double {
        let s1 = Array(str1)
        let s2 = Array(str2)

        if s1.isEmpty && s2.isEmpty { return 1.0 }
        if s1.isEmpty || s2.isEmpty { return 0.0 }

        let matchWindow = max(s1.count, s2.count) / 2 - 1
        guard matchWindow >= 0 else { return s1 == s2 ? 1.0 : 0.0 }

        var s1Matches = Array(repeating: false, count: s1.count)
        var s2Matches = Array(repeating: false, count: s2.count)

        var matches = 0

        // Find matches
        for i in 0..<s1.count {
            let start = max(0, i - matchWindow)
            let end = min(i + matchWindow + 1, s2.count)

            for j in start..<end {
                if s2Matches[j] || s1[i] != s2[j] { continue }
                s1Matches[i] = true
                s2Matches[j] = true
                matches += 1
                break
            }
        }

        guard matches > 0 else { return 0.0 }

        // Calculate transpositions
        var transpositions = 0
        var k = 0

        for i in 0..<s1.count {
            if !s1Matches[i] { continue }
            while !s2Matches[k] { k += 1 }
            if s1[i] != s2[k] { transpositions += 1 }
            k += 1
        }

        let jaro = (Double(matches) / Double(s1.count) +
                   Double(matches) / Double(s2.count) +
                   (Double(matches) - Double(transpositions) / 2.0) / Double(matches)) / 3.0

        return jaro
    }

    /// Levenshtein similarity (normalized)
    private func levenshteinSimilarity(_ str1: String, _ str2: String) -> Double {
        let distance = levenshteinDistance(str1, str2)
        let maxLength = max(str1.count, str2.count)
        guard maxLength > 0 else { return 1.0 }
        return 1.0 - (Double(distance) / Double(maxLength))
    }

    /// Levenshtein distance
    private func levenshteinDistance(_ str1: String, _ str2: String) -> Int {
        let s1 = Array(str1)
        let s2 = Array(str2)
        let m = s1.count
        let n = s2.count

        var dp = Array(repeating: Array(repeating: 0, count: n + 1), count: m + 1)

        for i in 0...m { dp[i][0] = i }
        for j in 0...n { dp[0][j] = j }

        for i in 1...m {
            for j in 1...n {
                if s1[i - 1] == s2[j - 1] {
                    dp[i][j] = dp[i - 1][j - 1]
                } else {
                    dp[i][j] = min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
                }
            }
        }

        return dp[m][n]
    }

    /// Longest Common Subsequence similarity
    private func longestCommonSubsequenceSimilarity(_ str1: String, _ str2: String) -> Double {
        let lcs = longestCommonSubsequenceLength(str1, str2)
        let maxLength = max(str1.count, str2.count)
        guard maxLength > 0 else { return 1.0 }
        return Double(lcs) / Double(maxLength)
    }

    /// Longest Common Subsequence length
    private func longestCommonSubsequenceLength(_ str1: String, _ str2: String) -> Int {
        let s1 = Array(str1)
        let s2 = Array(str2)
        let m = s1.count
        let n = s2.count

        var dp = Array(repeating: Array(repeating: 0, count: n + 1), count: m + 1)

        for i in 1...m {
            for j in 1...n {
                if s1[i - 1] == s2[j - 1] {
                    dp[i][j] = dp[i - 1][j - 1] + 1
                } else {
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
                }
            }
        }

        return dp[m][n]
    }

    /// Common prefix length
    private func commonPrefixLength(_ str1: String, _ str2: String) -> Int {
        let s1 = Array(str1)
        let s2 = Array(str2)
        let minLength = min(s1.count, s2.count)

        for i in 0..<minLength {
            if s1[i] != s2[i] {
                return i
            }
        }

        return minLength
    }

    // MARK: - Difference Classification

    /// Classify difference based on accuracy and patterns
    private func classifyDifference(accuracy: Double, differences: [String]) -> DifferenceClassification {
        if accuracy >= 1.0 {
            return .identical
        } else if accuracy >= 0.999 {
            return .acceptable
        } else if accuracy >= 0.95 {
            // Check if differences are in acceptable categories
            let hasOnlyAcceptableDifferences = differences.allSatisfy { difference in
                acceptableDifferences.contains { acceptableType in
                    difference.localizedCaseInsensitiveContains(acceptableType)
                }
            }

            return hasOnlyAcceptableDifferences ? .acceptable : .warning
        } else {
            return .critical
        }
    }

    /// Generate field difference description
    private func generateFieldDifference(fieldName: String, accuracy: Double, native: Node, alto: Node) -> String {
        let percentage = Int(accuracy * 100)
        return "\(fieldName) differs (\(percentage)% similarity)"
    }
}

// MARK: - Data Types

/// Node comparison result
public struct NodeComparisonResult {
    public let nodeId: String
    public let nativePresent: Bool
    public let altoPresent: Bool
    public let differences: [String]
    public let accuracy: Double
    public let classification: DifferenceClassification
    public let fieldAccuracies: [String: Double]

    public var isAcceptable: Bool {
        return classification == .identical || classification == .acceptable
    }
}

/// Difference classification levels
public enum DifferenceClassification {
    case identical
    case acceptable
    case warning
    case critical

    public var description: String {
        switch self {
        case .identical:
            return "Identical"
        case .acceptable:
            return "Acceptable differences"
        case .warning:
            return "Minor differences"
        case .critical:
            return "Significant differences"
        }
    }
}