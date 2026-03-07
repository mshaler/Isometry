// GzipDecompressor.swift
// Gzip decompression utility using the system zlib C API.
//
// Apple Notes stores body content as gzip-compressed protobuf blobs in
// ZICNOTEDATA.ZDATA. The data uses gzip format (magic bytes 0x1F 0x8B),
// NOT raw zlib/deflate. Foundation's NSData.decompressed(using: .zlib)
// does NOT handle gzip headers -- we must use zlib's inflateInit2_ with
// MAX_WBITS + 32 for automatic gzip/zlib detection.
//
// Requirements addressed:
//   - BODY-01: Decompress ZDATA blobs for protobuf deserialization

import Foundation
import zlib

nonisolated enum GzipDecompressor: Sendable {
    enum GzipError: Error, Sendable {
        case decompressFailed(Int32)
        case emptyInput
    }

    /// Decompress gzip-compressed data using the system zlib C API.
    ///
    /// Uses `inflateInit2_` with `MAX_WBITS + 32` to enable automatic
    /// gzip header detection. Processes data in 16KB chunks.
    ///
    /// - Parameter data: Gzip-compressed bytes (e.g., from ZICNOTEDATA.ZDATA)
    /// - Returns: Decompressed raw bytes (protobuf data)
    /// - Throws: `GzipError.emptyInput` if data is empty,
    ///           `GzipError.decompressFailed` if decompression fails
    static func decompress(_ data: Data) throws -> Data {
        guard !data.isEmpty else { throw GzipError.emptyInput }

        var stream = z_stream()

        // MAX_WBITS + 32 enables automatic gzip/zlib header detection.
        // This is critical: ZDATA uses gzip format, not raw deflate.
        var status = inflateInit2_(
            &stream,
            MAX_WBITS + 32,
            ZLIB_VERSION,
            Int32(MemoryLayout<z_stream>.size)
        )
        guard status == Z_OK else { throw GzipError.decompressFailed(status) }

        var output = Data(capacity: data.count * 2)

        data.withUnsafeBytes { inputPtr in
            stream.next_in = UnsafeMutablePointer<Bytef>(
                mutating: inputPtr.bindMemory(to: Bytef.self).baseAddress!
            )
            stream.avail_in = uInt(data.count)

            let chunkSize = 16384
            repeat {
                var chunk = Data(count: chunkSize)
                chunk.withUnsafeMutableBytes { outputPtr in
                    stream.next_out = outputPtr.bindMemory(to: Bytef.self).baseAddress!
                    stream.avail_out = uInt(chunkSize)
                    status = inflate(&stream, Z_NO_FLUSH)
                }
                let bytesProduced = chunkSize - Int(stream.avail_out)
                output.append(chunk.prefix(bytesProduced))
            } while status == Z_OK
        }

        inflateEnd(&stream)
        guard status == Z_STREAM_END else { throw GzipError.decompressFailed(status) }
        return output
    }
}
