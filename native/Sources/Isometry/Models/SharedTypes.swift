//
//  SharedTypes.swift
//  Isometry
//
//  Created by Claude Code on 2/5/26.
//

import Foundation

// MARK: - Type Aliases for Disambiguation

/// Centralized type disambiguation to resolve conflicts between modules
public typealias CommandDateRange = ShellDateRange

// MARK: - Date Range Extensions

extension ShellDateRange {
    /// Convenience initializer for command history date ranges
    public static func commandRange(from start: Date, to end: Date) -> ShellDateRange {
        return ShellDateRange(start: start, end: end)
    }

    /// Create a date range for today
    public static func today() -> ShellDateRange {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? Date()
        return ShellDateRange(start: startOfDay, end: endOfDay)
    }
}