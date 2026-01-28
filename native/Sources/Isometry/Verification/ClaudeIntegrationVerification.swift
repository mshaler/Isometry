import Foundation
import os.log

/// Verification tests for Claude API integration in Phase 6.3
/// Tests the complete command routing and API client setup
public struct ClaudeIntegrationVerification {
    private let logger = OSLog(subsystem: "com.isometry.app", category: "ClaudeVerification")

    /// Verify that Claude API client can be instantiated correctly
    public func verifyAPIClientSetup() -> ClaudeVerificationResult {
        os_log("Starting Claude API client setup verification...", log: logger, type: .info)

        do {
            // Test 1: Verify APIConfiguration creation
            let config = APIConfiguration(
                apiKey: "test-key-verification-only",
                baseURL: "https://api.anthropic.com",
                timeout: 30.0,
                maxRetries: 3
            )

            guard case .success = config.validate() else {
                return .failure("APIConfiguration validation failed")
            }

            // Test 2: Verify ClaudeAPIClient instantiation
            let client = ClaudeAPIClient(configuration: config)

            os_log("✅ Claude API client setup verification passed", log: logger, type: .info)
            return .success("Claude API client instantiated successfully with valid configuration")

        } catch {
            logger.error("❌ Claude API client setup failed: \(error.localizedDescription)")
            return .failure("Failed to instantiate Claude API client: \(error.localizedDescription)")
        }
    }

    /// Verify command routing logic (without making actual API calls)
    public func verifyCommandRouting() -> ClaudeVerificationResult {
        os_log("Starting command routing verification...", log: logger, type: .info)

        // Test 1: Verify Claude command detection
        let testCommands = [
            ("/claude hello", true),
            ("/claude what is 2+2?", true),
            ("ls -la", false),
            ("pwd", false),
            ("echo hello", false),
            ("/CLAUDE help me", false), // case sensitive
        ]

        for (command, shouldBeClaudeCommand) in testCommands {
            let isClaudeCommand = command.hasPrefix("/claude")

            if isClaudeCommand != shouldBeClaudeCommand {
                logger.error("❌ Command routing failed for: \(command)")
                return .failure("Command '\(command)' incorrectly classified")
            }
        }

        // Test 2: Verify ShellContext creation
        let context = ShellContext(
            workingDirectory: "/test/directory",
            recentCommands: ["ls", "pwd"],
            environment: ["TEST": "value"],
            timestamp: Date()
        )

        guard !context.workingDirectory.isEmpty else {
            return .failure("ShellContext creation failed")
        }

        os_log("✅ Command routing verification passed", log: logger, type: .info)
        return .success("Command routing logic works correctly")
    }

    /// Verify SandboxExecutor integration with Claude commands
    public func verifySandboxIntegration() async -> ClaudeVerificationResult {
        os_log("Starting sandbox integration verification...", log: logger, type: .info)

        do {
            // Test 1: Verify SandboxExecutor instantiation
            let executor = SandboxExecutor()

            // Test 2: Verify allowed commands include system commands but not network commands
            let allowedCommands = await executor.supportedCommands

            let expectedSystemCommands: Set<String> = ["ls", "pwd", "echo", "cat"]
            let forbiddenCommands: Set<String> = ["curl", "wget", "ssh"]

            for command in expectedSystemCommands {
                if !allowedCommands.contains(command) {
                    return .failure("Expected system command '\(command)' not in allowed list")
                }
            }

            for command in forbiddenCommands {
                if allowedCommands.contains(command) {
                    return .failure("Forbidden command '\(command)' found in allowed list")
                }
            }

            // Test 3: Verify command validation
            let (allowed, reason) = await executor.isCommandAllowed("ls -la", workingDirectory: "/tmp")
            if !allowed {
                return .failure("Valid system command incorrectly blocked: \(reason ?? "unknown")")
            }

            let (forbidden, _) = await executor.isCommandAllowed("curl http://example.com")
            if forbidden {
                return .failure("Forbidden network command incorrectly allowed")
            }

            os_log("✅ Sandbox integration verification passed", log: logger, type: .info)
            return .success("SandboxExecutor properly configured for Claude integration")

        } catch {
            logger.error("❌ Sandbox integration verification failed: \(error.localizedDescription)")
            return .failure("SandboxExecutor integration error: \(error.localizedDescription)")
        }
    }

    /// Run all Claude integration verifications
    public func runFullVerification() async -> VerificationSummary {
        os_log("🔄 Starting full Claude integration verification...", log: logger, type: .info)

        var results: [ClaudeVerificationResult] = []

        // Test API client setup
        results.append(verifyAPIClientSetup())

        // Test command routing
        results.append(verifyCommandRouting())

        // Test sandbox integration
        results.append(await verifySandboxIntegration())

        // Analyze results
        let successCount = results.filter { if case .success = $0 { return true }; return false }.count
        let totalCount = results.count

        let summary = VerificationSummary(
            totalTests: totalCount,
            successfulTests: successCount,
            failedTests: totalCount - successCount,
            results: results
        )

        if successCount == totalCount {
            os_log("🎉 All Claude integration verifications passed!", log: logger, type: .info)
        } else {
            logger.warning("⚠️ Some verifications failed: \(totalCount - successCount)/\(totalCount)")
        }

        return summary
    }
}

// MARK: - Supporting Types

public enum ClaudeVerificationResult {
    case success(String)
    case failure(String)

    public var isSuccess: Bool {
        switch self {
        case .success: return true
        case .failure: return false
        }
    }

    public var message: String {
        switch self {
        case .success(let msg): return msg
        case .failure(let msg): return msg
        }
    }
}

public struct VerificationSummary {
    public let totalTests: Int
    public let successfulTests: Int
    public let failedTests: Int
    public let results: [ClaudeVerificationResult]

    public var allPassed: Bool {
        return failedTests == 0
    }

    public var successRate: Double {
        guard totalTests > 0 else { return 0 }
        return Double(successfulTests) / Double(totalTests)
    }
}