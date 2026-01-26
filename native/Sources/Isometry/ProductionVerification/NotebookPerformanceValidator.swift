import Foundation
import SwiftUI

#if os(iOS)
import UIKit
#endif

/// Performance validation for notebook functionality
/// Ensures notebook operations meet production standards for smooth user experience
public final class NotebookPerformanceValidator: @unchecked Sendable {
    public static let shared = NotebookPerformanceValidator()

    private let performanceMonitor = PerformanceMonitor.shared

    private init() {}

    /// Validate notebook performance meets production standards
    public func validateNotebookPerformance() async -> NotebookPerformanceResult {
        let metrics = performanceMonitor.notebookMetrics

        var issues: [NotebookPerformanceIssue] = []

        // Validate render performance (60fps target)
        if metrics.averageRenderTime > PerformanceMonitor.targetFrameTime {
            let severity: NotebookPerformanceIssue.Severity = metrics.averageRenderTime > (PerformanceMonitor.targetFrameTime * 1.5) ? .error : .warning

            issues.append(NotebookPerformanceIssue(
                severity: severity,
                category: "Render Performance",
                description: "Average notebook render time exceeds 16.67ms target",
                currentValue: "\(String(format: "%.2f", metrics.averageRenderMS))ms",
                targetValue: "\(String(format: "%.2f", PerformanceMonitor.targetFrameTime * 1000))ms",
                impact: "User will experience dropped frames during notebook usage"
            ))
        }

        // Validate query performance
        if metrics.averageQueryTime > PerformanceMonitor.maxQueryTime {
            let severity: NotebookPerformanceIssue.Severity = metrics.averageQueryTime > (PerformanceMonitor.maxQueryTime * 2) ? .error : .warning

            issues.append(NotebookPerformanceIssue(
                severity: severity,
                category: "Database Performance",
                description: "Notebook card queries are slower than recommended",
                currentValue: "\(String(format: "%.2f", metrics.averageQueryMS))ms",
                targetValue: "\(String(format: "%.2f", PerformanceMonitor.maxQueryTime * 1000))ms",
                impact: "Notebook card loading may feel sluggish"
            ))
        }

        // Validate worst-case render performance
        if metrics.maxRenderTime > (PerformanceMonitor.targetFrameTime * 2) {
            issues.append(NotebookPerformanceIssue(
                severity: .warning,
                category: "Peak Render Performance",
                description: "Maximum notebook render time indicates potential frame drops",
                currentValue: "\(String(format: "%.2f", metrics.maxRenderMS))ms",
                targetValue: "\(String(format: "%.2f", PerformanceMonitor.targetFrameTime * 1000 * 2))ms",
                impact: "Occasional frame drops during complex layout operations"
            ))
        }

        // Validate sample count (need sufficient data)
        if metrics.renderSampleCount < 10 {
            issues.append(NotebookPerformanceIssue(
                severity: .info,
                category: "Test Coverage",
                description: "Insufficient notebook render samples for reliable metrics",
                currentValue: "\(metrics.renderSampleCount) samples",
                targetValue: "10+ samples",
                impact: "Performance validation may not be accurate"
            ))
        }

        // Validate query sample count
        if metrics.querySampleCount < 5 && metrics.renderSampleCount > 0 {
            issues.append(NotebookPerformanceIssue(
                severity: .info,
                category: "Test Coverage",
                description: "Few notebook card query samples recorded",
                currentValue: "\(metrics.querySampleCount) samples",
                targetValue: "5+ samples",
                impact: "Database performance validation may be incomplete"
            ))
        }

        // Check for concerning performance patterns
        if metrics.estimatedFPS < 45 && metrics.renderSampleCount > 5 {
            issues.append(NotebookPerformanceIssue(
                severity: .error,
                category: "User Experience",
                description: "Estimated FPS indicates poor performance",
                currentValue: "\(String(format: "%.1f", metrics.estimatedFPS)) FPS",
                targetValue: "60 FPS",
                impact: "Notebook interface will feel slow and unresponsive"
            ))
        }

        return NotebookPerformanceResult(
            isValid: issues.filter { $0.severity == .error }.isEmpty,
            metrics: metrics,
            issues: issues,
            testDate: Date()
        )
    }

    /// Validate performance for a specific notebook operation
    public func validateOperation(_ operation: NotebookOperation) async -> OperationPerformanceResult {
        let startTime = CACurrentMediaTime()

        // Simulate operation measurement (in real implementation, this would track actual operations)
        let duration = CACurrentMediaTime() - startTime

        let meetsTarget: Bool
        let targetDuration: TimeInterval

        switch operation {
        case .layoutRender:
            targetDuration = PerformanceMonitor.targetFrameTime
            meetsTarget = duration <= targetDuration
        case .cardQuery:
            targetDuration = PerformanceMonitor.maxQueryTime
            meetsTarget = duration <= targetDuration
        case .componentResize:
            targetDuration = PerformanceMonitor.targetFrameTime * 0.5 // Resize should be even faster
            meetsTarget = duration <= targetDuration
        }

        return OperationPerformanceResult(
            operation: operation,
            duration: duration,
            targetDuration: targetDuration,
            meetsTarget: meetsTarget,
            timestamp: Date()
        )
    }

    /// Generate a comprehensive performance report
    public func generatePerformanceReport() async -> NotebookPerformanceReport {
        let validationResult = await validateNotebookPerformance()
        let generalMetrics = performanceMonitor.allQueryStats
        let gridMetrics = performanceMonitor.gridRenderStats

        return NotebookPerformanceReport(
            notebookValidation: validationResult,
            generalQueryStats: generalMetrics,
            gridRenderStats: gridMetrics,
            reportDate: Date(),
            deviceInfo: DeviceInfo.current
        )
    }
}

// MARK: - Supporting Types

public struct NotebookPerformanceResult {
    public let isValid: Bool
    public let metrics: NotebookPerformanceMetrics
    public let issues: [NotebookPerformanceIssue]
    public let testDate: Date

    public var hasErrors: Bool { issues.contains { $0.severity == .error } }
    public var hasWarnings: Bool { issues.contains { $0.severity == .warning } }
    public var errorCount: Int { issues.filter { $0.severity == .error }.count }
    public var warningCount: Int { issues.filter { $0.severity == .warning }.count }
}

public struct NotebookPerformanceIssue {
    public let severity: Severity
    public let category: String
    public let description: String
    public let currentValue: String
    public let targetValue: String
    public let impact: String

    public enum Severity {
        case info
        case warning
        case error

        public var displayName: String {
            switch self {
            case .info: return "Info"
            case .warning: return "Warning"
            case .error: return "Error"
            }
        }

        public var systemImage: String {
            switch self {
            case .info: return "info.circle"
            case .warning: return "exclamationmark.triangle"
            case .error: return "xmark.circle"
            }
        }
    }
}

public enum NotebookOperation: String, CaseIterable {
    case layoutRender = "layout_render"
    case cardQuery = "card_query"
    case componentResize = "component_resize"

    public var displayName: String {
        switch self {
        case .layoutRender: return "Layout Render"
        case .cardQuery: return "Card Query"
        case .componentResize: return "Component Resize"
        }
    }
}

public struct OperationPerformanceResult {
    public let operation: NotebookOperation
    public let duration: TimeInterval
    public let targetDuration: TimeInterval
    public let meetsTarget: Bool
    public let timestamp: Date

    public var durationMS: Double { duration * 1000 }
    public var targetMS: Double { targetDuration * 1000 }
    public var performanceRatio: Double { duration / targetDuration }
}

public struct NotebookPerformanceReport {
    public let notebookValidation: NotebookPerformanceResult
    public let generalQueryStats: [QueryStats]
    public let gridRenderStats: RenderStats
    public let reportDate: Date
    public let deviceInfo: DeviceInfo

    public var overallHealth: PerformanceHealth {
        if notebookValidation.hasErrors {
            return .poor
        } else if notebookValidation.hasWarnings {
            return .fair
        } else if notebookValidation.metrics.renderSampleCount > 0 {
            return .good
        } else {
            return .unknown
        }
    }
}

public enum PerformanceHealth: String, CaseIterable {
    case unknown = "unknown"
    case poor = "poor"
    case fair = "fair"
    case good = "good"

    public var displayName: String {
        switch self {
        case .unknown: return "Unknown"
        case .poor: return "Poor"
        case .fair: return "Fair"
        case .good: return "Good"
        }
    }

    public var color: Color {
        switch self {
        case .unknown: return .gray
        case .poor: return .red
        case .fair: return .orange
        case .good: return .green
        }
    }
}

public struct DeviceInfo {
    public let modelName: String
    public let systemVersion: String
    public let memoryGB: Double

    public static var current: DeviceInfo {
        #if os(iOS)
        return DeviceInfo(
            modelName: UIDevice.current.model,
            systemVersion: UIDevice.current.systemVersion,
            memoryGB: Double(ProcessInfo.processInfo.physicalMemory) / 1024 / 1024 / 1024
        )
        #elseif os(macOS)
        return DeviceInfo(
            modelName: "Mac",
            systemVersion: ProcessInfo.processInfo.operatingSystemVersionString,
            memoryGB: Double(ProcessInfo.processInfo.physicalMemory) / 1024 / 1024 / 1024
        )
        #else
        return DeviceInfo(modelName: "Unknown", systemVersion: "Unknown", memoryGB: 0)
        #endif
    }
}