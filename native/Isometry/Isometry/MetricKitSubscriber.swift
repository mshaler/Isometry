import Combine
import MetricKit
import os
import SwiftUI

// ---------------------------------------------------------------------------
// MetricKitSubscriber — Crash + Hang Diagnostic Reporting (MKIT-01, MKIT-02)
// ---------------------------------------------------------------------------
// Registers with MXMetricManager to receive diagnostic payloads delivered by
// the OS the day after each crash or hang event. Payloads accumulate in memory
// until the user exports them via Settings > Diagnostics > Export Diagnostics.
//
// Requirements addressed:
//   - MKIT-01: MXMetricManagerSubscriber conformance registered at app launch
//   - MKIT-02: Crash/hang counts and JSON export exposed to SettingsView

@MainActor
final class MetricKitSubscriber: NSObject, ObservableObject, MXMetricManagerSubscriber {

    // MARK: - Published State

    /// Number of crash diagnostics received since last app launch.
    @Published var crashCount: Int = 0

    /// Number of hang diagnostics received since last app launch.
    @Published var hangCount: Int = 0

    // MARK: - Private State

    private var payloads: [MXDiagnosticPayload] = []
    private let logger = Logger(subsystem: "works.isometry.app", category: "MetricKit")

    // MARK: - Lifecycle

    override init() {
        super.init()
        MXMetricManager.shared.add(self)
        logger.info("MetricKit subscriber registered")
    }

    deinit {
        MXMetricManager.shared.remove(self)
    }

    // MARK: - MXMetricManagerSubscriber

    /// Receives diagnostic payloads from MetricKit. Called by the system (not on main thread).
    /// Hops to MainActor to update @Published properties safely.
    nonisolated func didReceive(_ payloads: [MXDiagnosticPayload]) {
        Task { @MainActor in
            self.payloads.append(contentsOf: payloads)
            var crashes = 0
            var hangs = 0
            for payload in payloads {
                crashes += payload.crashDiagnostics?.count ?? 0
                hangs += payload.hangDiagnostics?.count ?? 0
            }
            self.crashCount += crashes
            self.hangCount += hangs
            self.logger.info("Received \(crashes) crash + \(hangs) hang diagnostics")
        }
    }

    // MARK: - Export

    /// Export all stored diagnostic payloads as pretty-printed JSON Data.
    /// Returns nil if no payloads have been received yet.
    func exportJSON() -> Data? {
        guard !payloads.isEmpty else { return nil }
        let dicts = payloads.map { $0.jsonRepresentation() }
        guard let data = try? JSONSerialization.data(
            withJSONObject: dicts,
            options: [.prettyPrinted, .sortedKeys]
        ) else {
            logger.error("Failed to serialize diagnostic payloads to JSON")
            return nil
        }
        return data
    }
}
