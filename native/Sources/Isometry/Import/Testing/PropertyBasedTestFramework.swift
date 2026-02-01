import Foundation
import Testing

// MARK: - Property-Based Testing Framework

/// Property-based testing framework for ETL pipelines
/// Validates that ETL operations preserve invariants across all data transformations
public actor PropertyBasedTestFramework {

    // MARK: - Core Types

    /// Generic property test definition
    public struct PropertyTest<T> {
        public let name: String
        public let generator: () async throws -> T
        public let property: (T) async throws -> Bool
        public let shrink: ((T) -> [T])?
        public let iterations: Int

        public init(
            name: String,
            generator: @escaping () async throws -> T,
            property: @escaping (T) async throws -> Bool,
            shrink: ((T) -> [T])? = nil,
            iterations: Int = 100
        ) {
            self.name = name
            self.generator = generator
            self.property = property
            self.shrink = shrink
            self.iterations = iterations
        }
    }

    /// Testing strategy configuration
    public enum TestStrategy {
        case exhaustive(Int)        // Test all possible values up to limit
        case random(seed: UInt64)   // Randomized testing with seed
        case edgeCases              // Focus on boundary conditions
        case performance            // Large-scale performance validation
        case lifecycle              // Full data lifecycle testing
        case concurrency(threads: Int) // Multi-threaded testing

        public var iterationCount: Int {
            switch self {
            case .exhaustive(let limit): return limit
            case .random: return 100
            case .edgeCases: return 50
            case .performance: return 10
            case .lifecycle: return 25
            case .concurrency(let threads): return threads * 5
            }
        }

        public var seed: UInt64 {
            switch self {
            case .random(let seed): return seed
            default: return 42
            }
        }
    }

    /// Test execution result
    public struct TestResult {
        public let testName: String
        public let strategy: TestStrategy
        public let iterations: Int
        public let passed: Int
        public let failed: Int
        public let errors: [TestFailure]
        public let executionTime: TimeInterval
        public let memoryUsage: Int64

        public var success: Bool { failed == 0 }

        public init(
            testName: String,
            strategy: TestStrategy,
            iterations: Int,
            passed: Int,
            failed: Int,
            errors: [TestFailure],
            executionTime: TimeInterval,
            memoryUsage: Int64
        ) {
            self.testName = testName
            self.strategy = strategy
            self.iterations = iterations
            self.passed = passed
            self.failed = failed
            self.errors = errors
            self.executionTime = executionTime
            self.memoryUsage = memoryUsage
        }
    }

    /// Test failure details
    public struct TestFailure {
        public let iteration: Int
        public let input: String
        public let error: Error
        public let shrinkPath: [String]

        public init(iteration: Int, input: String, error: Error, shrinkPath: [String] = []) {
            self.iteration = iteration
            self.input = input
            self.error = error
            self.shrinkPath = shrinkPath
        }
    }

    // MARK: - ETL Invariant Validators

    /// Protocol for defining ETL invariants that must hold
    public protocol InvariantValidator {
        associatedtype Input
        associatedtype Output

        /// Validates that the invariant holds for the given input/output pair
        func validate(input: Input, output: Output) async throws -> Bool

        /// Human-readable description of the invariant
        var description: String { get }
    }

    /// Data integrity invariant - imported data matches source data semantically
    public struct DataIntegrityValidator: InvariantValidator {
        public typealias Input = Any
        public typealias Output = [Node]

        public let description = "Data integrity: imported data matches source data semantically"

        public init() {}

        public func validate(input: Any, output: [Node]) async throws -> Bool {
            // Verify that essential data was preserved
            // This is a simplified check - actual validation depends on input type
            guard !output.isEmpty else { return false }

            // All nodes should have valid IDs and timestamps
            for node in output {
                guard !node.id.isEmpty,
                      node.createdAt <= Date(),
                      node.modifiedAt <= Date() else {
                    return false
                }
            }

            return true
        }
    }

    /// LATCH property mapping invariant
    public struct LATCHMappingValidator: InvariantValidator {
        public typealias Input = Any
        public typealias Output = [Node]

        public let description = "LATCH property mapping: all LATCH properties correctly extracted"

        public init() {}

        public func validate(input: Any, output: [Node]) async throws -> Bool {
            for node in output {
                // Location (L) - if present, should be valid
                if let lat = node.latitude, let lng = node.longitude {
                    guard lat >= -90 && lat <= 90,
                          lng >= -180 && lng <= 180 else {
                        return false
                    }
                }

                // Alphabet (A) - name should be non-empty
                guard !node.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                    return false
                }

                // Time (T) - timestamps should be valid and consistent
                guard node.createdAt <= node.modifiedAt else {
                    return false
                }

                // Category (C) - folder should be valid if present
                if let folder = node.folder {
                    guard !folder.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                        return false
                    }
                }

                // Hierarchy (H) - sort order should be valid
                guard node.sortOrder >= 0 else {
                    return false
                }
            }

            return true
        }
    }

    /// Idempotency invariant - importing same data twice produces identical results
    public struct IdempotencyValidator: InvariantValidator {
        public typealias Input = (first: [Node], second: [Node])
        public typealias Output = Bool

        public let description = "Idempotency: importing same data twice produces identical results"

        public init() {}

        public func validate(input: (first: [Node], second: [Node]), output: Bool) async throws -> Bool {
            let (first, second) = input

            guard first.count == second.count else { return false }

            // Sort by ID for comparison
            let sortedFirst = first.sorted { $0.id < $1.id }
            let sortedSecond = second.sorted { $0.id < $1.id }

            for (node1, node2) in zip(sortedFirst, sortedSecond) {
                // Core content should be identical
                guard node1.id == node2.id,
                      node1.name == node2.name,
                      node1.content == node2.content,
                      node1.nodeType == node2.nodeType else {
                    return false
                }
            }

            return true
        }
    }

    /// Schema consistency invariant - all nodes conform to Isometry schema
    public struct SchemaConsistencyValidator: InvariantValidator {
        public typealias Input = Any
        public typealias Output = [Node]

        public let description = "Schema consistency: all imported nodes conform to Isometry schema"

        public init() {}

        public func validate(input: Any, output: [Node]) async throws -> Bool {
            for node in output {
                // Required fields validation
                guard !node.id.isEmpty,
                      !node.name.isEmpty,
                      !node.nodeType.isEmpty else {
                    return false
                }

                // Priority and importance should be within valid range
                guard node.priority >= 0 && node.priority <= 10,
                      node.importance >= 0 && node.importance <= 10 else {
                    return false
                }

                // Version should be positive
                guard node.version > 0 else {
                    return false
                }

                // Tags should be valid strings
                for tag in node.tags {
                    guard !tag.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                        return false
                    }
                }
            }

            return true
        }
    }

    // MARK: - Test Execution Engine

    /// Test execution engine with configurable iterations and detailed reporting
    public actor TestExecutionEngine {
        private var generator: RandomNumberGenerator

        public init(seed: UInt64 = 42) {
            self.generator = SystemRandomNumberGenerator()
        }

        /// Execute property-based test with the specified strategy
        public func execute<T>(
            test: PropertyTest<T>,
            strategy: TestStrategy = .random(seed: 42)
        ) async throws -> TestResult {
            let startTime = Date()
            let memoryStart = getCurrentMemoryUsage()

            var passed = 0
            var failed = 0
            var errors: [TestFailure] = []

            let iterations = min(test.iterations, strategy.iterationCount)

            for iteration in 0..<iterations {
                do {
                    let input = try await test.generator()
                    let result = try await test.property(input)

                    if result {
                        passed += 1
                    } else {
                        failed += 1
                        let failure = TestFailure(
                            iteration: iteration,
                            input: String(describing: input),
                            error: PropertyTestError.propertyViolation("Property returned false"),
                            shrinkPath: []
                        )
                        errors.append(failure)

                        // Attempt shrinking if shrink function is provided
                        if let shrink = test.shrink {
                            let minimalFailure = try await findMinimalFailure(
                                input: input,
                                property: test.property,
                                shrink: shrink
                            )
                            if let minimal = minimalFailure {
                                errors[errors.count - 1] = TestFailure(
                                    iteration: iteration,
                                    input: String(describing: minimal.input),
                                    error: minimal.error,
                                    shrinkPath: minimal.shrinkPath
                                )
                            }
                        }
                    }
                } catch {
                    failed += 1
                    let failure = TestFailure(
                        iteration: iteration,
                        input: "Generation failed",
                        error: error,
                        shrinkPath: []
                    )
                    errors.append(failure)
                }
            }

            let executionTime = Date().timeIntervalSince(startTime)
            let memoryUsage = getCurrentMemoryUsage() - memoryStart

            return TestResult(
                testName: test.name,
                strategy: strategy,
                iterations: iterations,
                passed: passed,
                failed: failed,
                errors: errors,
                executionTime: executionTime,
                memoryUsage: memoryUsage
            )
        }

        /// Find minimal failing example through shrinking
        private func findMinimalFailure<T>(
            input: T,
            property: (T) async throws -> Bool,
            shrink: (T) -> [T]
        ) async throws -> (input: T, error: Error, shrinkPath: [String])? {
            var current = input
            var shrinkPath: [String] = []

            let candidates = shrink(current)
            for candidate in candidates {
                do {
                    let result = try await property(candidate)
                    if !result {
                        current = candidate
                        shrinkPath.append(String(describing: candidate))

                        // Recursively shrink further
                        if let further = try await findMinimalFailure(
                            input: candidate,
                            property: property,
                            shrink: shrink
                        ) {
                            return further
                        }

                        return (
                            input: current,
                            error: PropertyTestError.propertyViolation("Minimal failing example"),
                            shrinkPath: shrinkPath
                        )
                    }
                } catch {
                    return (
                        input: candidate,
                        error: error,
                        shrinkPath: shrinkPath + [String(describing: candidate)]
                    )
                }
            }

            return nil
        }

        /// Get current memory usage in bytes
        private func getCurrentMemoryUsage() -> Int64 {
            var info = mach_task_basic_info()
            var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

            let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
                $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                    task_info(mach_task_self_,
                             task_flavor_t(MACH_TASK_BASIC_INFO),
                             $0,
                             &count)
                }
            }

            if kerr == KERN_SUCCESS {
                return Int64(info.resident_size)
            } else {
                return 0
            }
        }
    }

    // MARK: - Test Builder

    /// Convenience methods for building common property tests
    public static func buildDataIntegrityTest<Input>(
        name: String,
        generator: @escaping () async throws -> Input,
        importer: @escaping (Input) async throws -> [Node],
        iterations: Int = 100
    ) -> PropertyTest<Input> {
        let validator = DataIntegrityValidator()

        return PropertyTest(
            name: name,
            generator: generator,
            property: { input in
                do {
                    let output = try await importer(input)
                    return try await validator.validate(input: input, output: output)
                } catch {
                    return false
                }
            },
            iterations: iterations
        )
    }

    public static func buildLATCHMappingTest<Input>(
        name: String,
        generator: @escaping () async throws -> Input,
        importer: @escaping (Input) async throws -> [Node],
        iterations: Int = 100
    ) -> PropertyTest<Input> {
        let validator = LATCHMappingValidator()

        return PropertyTest(
            name: name,
            generator: generator,
            property: { input in
                do {
                    let output = try await importer(input)
                    return try await validator.validate(input: input, output: output)
                } catch {
                    return false
                }
            },
            iterations: iterations
        )
    }

    public static func buildSchemaConsistencyTest<Input>(
        name: String,
        generator: @escaping () async throws -> Input,
        importer: @escaping (Input) async throws -> [Node],
        iterations: Int = 100
    ) -> PropertyTest<Input> {
        let validator = SchemaConsistencyValidator()

        return PropertyTest(
            name: name,
            generator: generator,
            property: { input in
                do {
                    let output = try await importer(input)
                    return try await validator.validate(input: input, output: output)
                } catch {
                    return false
                }
            },
            iterations: iterations
        )
    }
}

// MARK: - Property Test Errors

public enum PropertyTestError: Error, LocalizedError {
    case propertyViolation(String)
    case generationFailed(Error)
    case shrinkingFailed(Error)

    public var errorDescription: String? {
        switch self {
        case .propertyViolation(let message):
            return "Property violation: \(message)"
        case .generationFailed(let error):
            return "Test data generation failed: \(error.localizedDescription)"
        case .shrinkingFailed(let error):
            return "Shrinking failed: \(error.localizedDescription)"
        }
    }
}

// MARK: - Round-Trip Testing Framework

extension PropertyBasedTestFramework {

    /// Specialized round-trip testing for data lifecycle validation
    public static func buildRoundTripTest<TInput, TIntermediate>(
        name: String,
        generator: @escaping () async throws -> TInput,
        transform: @escaping (TInput) async throws -> TIntermediate,
        inverseTransform: @escaping (TIntermediate) async throws -> TInput,
        equivalenceCheck: @escaping (TInput, TInput) async throws -> Bool,
        iterations: Int = 100
    ) -> PropertyTest<TInput> {
        return PropertyTest(
            name: name,
            generator: generator,
            property: { originalInput in
                let transformed = try await transform(originalInput)
                let roundTripInput = try await inverseTransform(transformed)
                return try await equivalenceCheck(originalInput, roundTripInput)
            },
            iterations: iterations
        )
    }

    /// Build data preservation test for import/export cycles
    public static func buildDataPreservationTest<TData>(
        name: String,
        generator: @escaping () async throws -> TData,
        importer: @escaping (TData) async throws -> [Node],
        exporter: @escaping ([Node]) async throws -> TData,
        preservationCheck: @escaping (TData, TData) async throws -> Double,
        threshold: Double = 0.999
    ) -> PropertyTest<TData> {
        return PropertyTest(
            name: name,
            generator: generator,
            property: { originalData in
                let importedNodes = try await importer(originalData)
                let exportedData = try await exporter(importedNodes)
                let preservationScore = try await preservationCheck(originalData, exportedData)
                return preservationScore >= threshold
            },
            iterations: iterations
        )
    }

    /// Build mathematical invariant test
    public static func buildInvariantTest<T>(
        name: String,
        generator: @escaping () async throws -> T,
        operation: @escaping (T) async throws -> T,
        invariant: @escaping (T, T) async throws -> Bool
    ) -> PropertyTest<T> {
        return PropertyTest(
            name: name,
            generator: generator,
            property: { input in
                let result = try await operation(input)
                return try await invariant(input, result)
            }
        )
    }

    /// Build mutation testing property to validate property correctness
    public static func buildMutationTest<T>(
        name: String,
        generator: @escaping () async throws -> T,
        property: @escaping (T) async throws -> Bool,
        mutations: [@escaping (T) -> T]
    ) -> PropertyTest<T> {
        return PropertyTest(
            name: name,
            generator: generator,
            property: { input in
                // Original property should pass
                let originalResult = try await property(input)
                guard originalResult else { return false }

                // At least one mutation should fail the property
                var anyMutationFailed = false
                for mutation in mutations {
                    let mutatedInput = mutation(input)
                    let mutatedResult = try await property(mutatedInput)
                    if !mutatedResult {
                        anyMutationFailed = true
                        break
                    }
                }

                return anyMutationFailed
            }
        )
    }

    /// Build performance invariant test
    public static func buildPerformanceInvariantTest<T>(
        name: String,
        generator: @escaping () async throws -> T,
        operation: @escaping (T) async throws -> T,
        maxExecutionTime: TimeInterval,
        maxMemoryIncrease: Int64 = 10_000_000 // 10MB default
    ) -> PropertyTest<T> {
        return PropertyTest(
            name: name,
            generator: generator,
            property: { input in
                let startTime = Date()
                let startMemory = getCurrentMemoryUsage()

                _ = try await operation(input)

                let executionTime = Date().timeIntervalSince(startTime)
                let memoryIncrease = getCurrentMemoryUsage() - startMemory

                return executionTime <= maxExecutionTime &&
                       memoryIncrease <= maxMemoryIncrease
            }
        )
    }

    /// Build comprehensive data validation test
    public static func buildDataValidationTest<TInput, TOutput>(
        name: String,
        generator: @escaping () async throws -> TInput,
        processor: @escaping (TInput) async throws -> TOutput,
        validators: [DataValidator<TInput, TOutput>]
    ) -> PropertyTest<TInput> {
        return PropertyTest(
            name: name,
            generator: generator,
            property: { input in
                let output = try await processor(input)

                for validator in validators {
                    if !(try await validator.validate(input: input, output: output)) {
                        return false
                    }
                }

                return true
            }
        )
    }

    /// Get current memory usage for performance testing
    private static func getCurrentMemoryUsage() -> Int64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }

        if kerr == KERN_SUCCESS {
            return Int64(info.resident_size)
        } else {
            return 0
        }
    }
}

// MARK: - Data Validation Framework

/// Protocol for custom data validators
public protocol DataValidator<Input, Output> {
    associatedtype Input
    associatedtype Output

    func validate(input: Input, output: Output) async throws -> Bool
    var description: String { get }
}
}

// MARK: - Enhanced Error Types

extension PropertyTestError {
    case timeout(TimeInterval)
    case memoryLimitExceeded(Int64, Int64)
    case executionFailed(String)

    public var enhancedErrorDescription: String? {
        switch self {
        case .timeout(let duration):
            return "Operation timed out after \(duration) seconds"
        case .memoryLimitExceeded(let current, let limit):
            return "Memory limit exceeded: \(current) bytes > \(limit) bytes"
        case .executionFailed(let reason):
            return "Execution failed: \(reason)"
        default:
            return errorDescription
        }
    }
}

// MARK: - Utility Extensions

extension PropertyBasedTestFramework.TestExecutionEngine {

    /// Execute tests with timeout protection
    public func executeWithTimeout<T>(
        test: PropertyTest<T>,
        timeout: TimeInterval,
        strategy: TestStrategy = .random(seed: 42)
    ) async throws -> TestResult {
        return try await withThrowingTaskGroup(of: TestResult.self) { group in
            group.addTask {
                return try await self.execute(test: test, strategy: strategy)
            }

            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                throw PropertyTestError.timeout(timeout)
            }

            guard let result = try await group.next() else {
                throw PropertyTestError.executionFailed("No result returned")
            }

            group.cancelAll()
            return result
        }
    }
}

// MARK: - Swift Testing Integration

extension PropertyBasedTestFramework.TestResult {
    /// Convert to Swift Testing expectation
    public func expectSuccess(file: StaticString = #file, line: UInt = #line) {
        #expect(success, "Property test '\(testName)' failed: \(failed)/\(iterations) iterations failed", sourceLocation: SourceLocation(file: file, line: line))
    }
}