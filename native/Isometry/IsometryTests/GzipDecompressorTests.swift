import Testing
import Foundation
@testable import Isometry

// ---------------------------------------------------------------------------
// GzipDecompressor Tests
// ---------------------------------------------------------------------------
// Tests for zlib C API decompression. GzipDecompressor is the critical
// first step in Apple Notes body text extraction (ZDATA → protobuf).
// Failure here → silent fallback to ZSNIPPET (loss of full note content).

struct GzipDecompressorTests {

    // MARK: - Error handling

    @Test func decompressEmptyDataThrowsEmptyInput() {
        #expect(throws: GzipDecompressor.GzipError.self) {
            _ = try GzipDecompressor.decompress(Data())
        }
    }

    @Test func decompressInvalidDataThrowsDecompressFailed() {
        let garbage = Data([0x00, 0x01, 0x02, 0x03])
        #expect(throws: GzipDecompressor.GzipError.self) {
            _ = try GzipDecompressor.decompress(garbage)
        }
    }

    @Test func decompressTruncatedGzipThrows() {
        // Valid gzip magic bytes but truncated
        let truncated = Data([0x1F, 0x8B, 0x08, 0x00])
        #expect(throws: GzipDecompressor.GzipError.self) {
            _ = try GzipDecompressor.decompress(truncated)
        }
    }

    // MARK: - Valid gzip round-trip

    @Test func decompressValidGzipReturnsOriginalData() throws {
        // Create test data and compress it using Foundation
        let original = "Hello, World! This is a test of gzip decompression.".data(using: .utf8)!

        // Compress using the system gzip (via Process)
        // Instead, we'll use a known gzip-compressed payload
        // "Hello" compressed with gzip:
        let compressedHello: [UInt8] = [
            0x1F, 0x8B, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x03, 0xF3, 0x48, 0xCD, 0xC9, 0xC9, 0x07,
            0x00, 0x82, 0x89, 0xD1, 0xF7, 0x05, 0x00, 0x00,
            0x00
        ]
        let compressed = Data(compressedHello)

        let decompressed = try GzipDecompressor.decompress(compressed)
        let text = String(data: decompressed, encoding: .utf8)
        #expect(text == "Hello")
    }

    @Test func decompressPreservesDataIntegrity() throws {
        // Another known gzip payload: "test" compressed
        let compressedTest: [UInt8] = [
            0x1F, 0x8B, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x03, 0x2B, 0x49, 0x2D, 0x2E, 0x01, 0x00,
            0x0C, 0x7E, 0x7F, 0xD8, 0x04, 0x00, 0x00, 0x00
        ]
        let compressed = Data(compressedTest)

        let decompressed = try GzipDecompressor.decompress(compressed)
        let text = String(data: decompressed, encoding: .utf8)
        #expect(text == "test")
    }
}
