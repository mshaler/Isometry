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

    // MARK: - Selective Alto Import (IMPT-02, IMPT-03, IMPT-04)

    /// Import selected alto-index directories one at a time with per-directory progress.
    /// Each directory creates its own import run in the catalog (IMPT-02).
    ///
    /// Progress messages sent to JS via sendAltoImportProgress():
    ///   - {dir, status: "started", index, total}               — before first chunk
    ///   - {dir, status: "complete", index, total, cardCount}   — after last chunk ack
    ///   - {dir, status: "error", index, total, error}          — on failure
    ///   - {status: "all-complete", totalCards}                 — after all directories done
    func runAltoImport(directories: [(name: String, cardType: String, path: String)]) async {
        guard !isImporting else {
            logger.warning("runAltoImport: import already in progress")
            return
        }
        isImporting = true
        defer { isImporting = false }

        var totalCardsImported = 0

        for (dirIndex, dir) in directories.enumerated() {
            // Notify JS: directory started (IMPT-04)
            sendAltoImportProgress(dir: dir.name, status: "started", index: dirIndex, total: directories.count, cardCount: 0, error: nil)

            // Fetch cards for this single directory (BEXL-01/02 enforced inside fetchCardsForDirectory)
            let cards = AltoIndexAdapter.fetchCardsForDirectory(dirPath: dir.path, cardType: dir.cardType, subdirName: dir.name)

            guard !cards.isEmpty else {
                // Directory had no parseable files — mark complete with 0 cards
                sendAltoImportProgress(dir: dir.name, status: "complete", index: dirIndex, total: directories.count, cardCount: 0, error: nil)
                continue
            }

            // Slice into chunks and send via existing chunk flow
            let chunks = stride(from: 0, to: cards.count, by: Self.chunkSize).map { startIndex in
                Array(cards[startIndex..<min(startIndex + Self.chunkSize, cards.count)])
            }

            var dirFailed = false
            for (chunkIdx, chunk) in chunks.enumerated() {
                let isLast = (chunkIdx == chunks.count - 1)
                // Pass sourceType so JS knows which directory this chunk belongs to (IMPT-03)
                let success = await sendChunk(chunk, index: chunkIdx, isLast: isLast, sourceType: "alto_index_\(dir.name)")
                if !success {
                    logger.error("Chunk \(chunkIdx) failed for directory \(dir.name)")
                    sendAltoImportProgress(dir: dir.name, status: "error", index: dirIndex, total: directories.count, cardCount: 0, error: "Chunk \(chunkIdx) failed")
                    dirFailed = true
                    break
                }
            }

            if !dirFailed {
                totalCardsImported += cards.count
                sendAltoImportProgress(dir: dir.name, status: "complete", index: dirIndex, total: directories.count, cardCount: cards.count, error: nil)
                logger.info("runAltoImport: \(dir.name) complete — \(cards.count) cards")
            }
        }

        // Notify JS: all directories complete (IMPT-04)
        sendAltoImportProgress(dir: "", status: "all-complete", index: directories.count, total: directories.count, cardCount: totalCardsImported, error: nil)
        logger.info("runAltoImport: all directories complete — \(totalCardsImported) total cards")
    }

    /// Send a per-directory progress event to JS (IMPT-04).
    private func sendAltoImportProgress(dir: String, status: String, index: Int, total: Int, cardCount: Int, error: String?) {
        let errorField = error.map { ", \"error\": \"\($0)\"" } ?? ""
        let js = """
        window.__isometry.receive({
          type: 'native:alto-import-progress',
          payload: {
            dir: '\(dir)',
            status: '\(status)',
            index: \(index),
            total: \(total),
            cardCount: \(cardCount)\(errorField)
          }
        });
        """
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    // MARK: - Chunk Dispatch

    /// Encode, base64-wrap, and send a single chunk to JS via evaluateJavaScript.
    /// Returns true if the chunk was acknowledged successfully.
    /// - Parameter sourceType: Optional source identifier included in the JS payload
    ///   so JS can associate the chunk with a specific directory (IMPT-03).
    private func sendChunk(_ cards: [CanonicalCard], index: Int, isLast: Bool, sourceType: String? = nil) async -> Bool {
        // JSON encode the cards array
        let encoder = JSONEncoder()
        guard let jsonData = try? encoder.encode(cards) else {
            logger.error("Failed to encode chunk \(index)")
            return false
        }

        // Base64 encode the JSON string to avoid escaping issues in evaluateJavaScript
        let base64String = jsonData.base64EncodedString()

        // Include sourceType field when provided so JS can partition cards by directory
        let sourceTypeField = sourceType.map { ", sourceType: '\($0)'" } ?? ""

        // Build the JS call — JS side will decode base64 → JSON → CanonicalCard[]
        let js = """
        window.__isometry.receive({
          type: 'native:import-chunk',
          payload: {
            chunkIndex: \(index),
            isLast: \(isLast ? "true" : "false"),
            cardsBase64: '\(base64String)'\(sourceTypeField)
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
