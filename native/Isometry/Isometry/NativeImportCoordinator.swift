import Foundation
import WebKit
import Combine
import os

// ---------------------------------------------------------------------------
// NativeImportCoordinator — Chunked Bridge Transport
// ---------------------------------------------------------------------------
// Orchestrates import from a NativeImportAdapter: accumulates cards from the
// adapter's AsyncStream, slices into 200-card chunks, sends each chunk to JS
// via evaluateJavaScript with base64-encoded JSON, and awaits acknowledgment
// before sending the next chunk.
//
// Requirements addressed:
//   - FNDX-01: Import pipeline from adapter to JS runtime
//   - FNDX-05: 200-card chunked dispatch prevents WKWebView memory issues
//
// CRITICAL: @MainActor because evaluateJavaScript requires main thread.
// CRITICAL: Base64 encoding avoids JSON escaping issues in evaluateJavaScript.
// CRITICAL: Sequential chunk dispatch — one chunk in flight at a time.

private let logger = Logger(subsystem: "works.isometry.app", category: "ImportCoordinator")

@MainActor
class NativeImportCoordinator: ObservableObject {

    // MARK: - Properties

    /// Weak reference to the WKWebView for evaluateJavaScript calls.
    weak var webView: WKWebView?

    /// Published flag prevents concurrent imports.
    @Published var isImporting: Bool = false

    /// Pending continuation for chunk acknowledgment from JS.
    private var pendingChunkContinuation: CheckedContinuation<Bool, Never>?

    /// Chunk size for bridge transport.
    private static let chunkSize = 200

    // MARK: - Import Pipeline

    /// Run an import from a NativeImportAdapter.
    /// Accumulates all cards from the adapter's AsyncStream, slices into
    /// 200-card chunks, and sends each chunk sequentially with JS ack.
    func runImport(adapter: any NativeImportAdapter) async throws {
        guard !isImporting else {
            throw NativeImportError.importInProgress
        }

        isImporting = true
        defer { isImporting = false }

        logger.info("Starting import from \(adapter.sourceType)")

        // Accumulate all cards from the adapter's AsyncStream
        var allCards: [CanonicalCard] = []
        for await batch in adapter.fetchCards() {
            allCards.append(contentsOf: batch)
        }

        guard !allCards.isEmpty else {
            logger.info("No cards to import from \(adapter.sourceType)")
            return
        }

        logger.info("Accumulated \(allCards.count) cards — slicing into chunks")

        // Slice into 200-card chunks
        let chunks = stride(from: 0, to: allCards.count, by: Self.chunkSize).map { startIndex in
            Array(allCards[startIndex..<min(startIndex + Self.chunkSize, allCards.count)])
        }

        // Send each chunk sequentially, awaiting ack before next
        for (index, chunk) in chunks.enumerated() {
            let isLast = (index == chunks.count - 1)
            let success = await sendChunk(chunk, index: index, isLast: isLast)
            if !success {
                logger.error("Chunk \(index) failed — aborting import")
                throw NativeImportError.chunkFailed(index)
            }
            logger.info("Chunk \(index)/\(chunks.count - 1) acknowledged")
        }

        logger.info("Import complete: \(allCards.count) cards in \(chunks.count) chunks")
    }

    // MARK: - Chunk Dispatch

    /// Encode, base64-wrap, and send a single chunk to JS via evaluateJavaScript.
    /// Returns true if the chunk was acknowledged successfully.
    private func sendChunk(_ cards: [CanonicalCard], index: Int, isLast: Bool) async -> Bool {
        // JSON encode the cards array
        let encoder = JSONEncoder()
        guard let jsonData = try? encoder.encode(cards) else {
            logger.error("Failed to encode chunk \(index)")
            return false
        }

        // Base64 encode the JSON string to avoid escaping issues in evaluateJavaScript
        let base64String = jsonData.base64EncodedString()

        // Build the JS call — JS side will decode base64 → JSON → CanonicalCard[]
        let js = """
        window.__isometry.receive({
          type: 'native:import-chunk',
          payload: {
            chunkIndex: \(index),
            isLast: \(isLast ? "true" : "false"),
            cardsBase64: '\(base64String)'
          }
        });
        """

        // Use withCheckedContinuation to await JS ack
        let ackSuccess = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            pendingChunkContinuation = continuation

            // Dispatch the JS call
            do {
                webView?.evaluateJavaScript(js) { _, error in
                    if let error = error {
                        logger.error("evaluateJavaScript failed for chunk \(index): \(error.localizedDescription)")
                        // Resume continuation with failure if JS call itself failed
                        if let cont = self.pendingChunkContinuation {
                            self.pendingChunkContinuation = nil
                            cont.resume(returning: false)
                        }
                    }
                    // If no error, JS received the call — wait for explicit ack
                    // via receiveChunkAck()
                }
            }
        }

        return ackSuccess
    }

    // MARK: - Chunk Acknowledgment

    /// Called by BridgeManager when JS sends `native:import-chunk-ack`.
    /// Resumes the pending continuation to unblock the next chunk dispatch.
    func receiveChunkAck(success: Bool) {
        guard let continuation = pendingChunkContinuation else {
            logger.warning("Received chunk ack but no pending continuation")
            return
        }
        pendingChunkContinuation = nil
        continuation.resume(returning: success)
    }
}
