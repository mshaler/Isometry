import Testing
import Foundation
@testable import Isometry

// ---------------------------------------------------------------------------
// MIME Type Resolution Tests
// ---------------------------------------------------------------------------

struct MIMETypeTests {

    @Test func wasmReturnsApplicationWasm() {
        #expect(AssetsSchemeHandler.mimeType(for: "wasm") == "application/wasm")
    }

    @Test func htmlReturnsTextHTML() {
        let mime = AssetsSchemeHandler.mimeType(for: "html")
        #expect(mime.hasPrefix("text/html"))
    }

    @Test func jsReturnsTextJavaScript() {
        let mime = AssetsSchemeHandler.mimeType(for: "js")
        #expect(mime.hasPrefix("text/javascript"))
    }

    @Test func mjsReturnsTextJavaScript() {
        let mime = AssetsSchemeHandler.mimeType(for: "mjs")
        #expect(mime.hasPrefix("text/javascript"))
    }

    @Test func cssReturnsTextCSS() {
        let mime = AssetsSchemeHandler.mimeType(for: "css")
        #expect(mime.hasPrefix("text/css"))
    }

    @Test func jsonReturnsApplicationJSON() {
        let mime = AssetsSchemeHandler.mimeType(for: "json")
        #expect(mime.hasPrefix("application/json"))
    }

    @Test func svgReturnsImageSVG() {
        #expect(AssetsSchemeHandler.mimeType(for: "svg") == "image/svg+xml")
    }

    @Test func pngReturnsImagePNG() {
        #expect(AssetsSchemeHandler.mimeType(for: "png") == "image/png")
    }

    @Test func woff2ReturnsFontWoff2() {
        #expect(AssetsSchemeHandler.mimeType(for: "woff2") == "font/woff2")
    }

    @Test func unknownExtensionReturnsFallback() {
        // Extensions not in map should fall through to UTType or octet-stream
        let mime = AssetsSchemeHandler.mimeType(for: "xyz_unknown")
        #expect(mime == "application/octet-stream")
    }

    @Test func caseInsensitiveExtension() {
        // Extension matching should be case-insensitive
        #expect(AssetsSchemeHandler.mimeType(for: "HTML").hasPrefix("text/html"))
        #expect(AssetsSchemeHandler.mimeType(for: "WASM") == "application/wasm")
        #expect(AssetsSchemeHandler.mimeType(for: "Js").hasPrefix("text/javascript"))
    }

    @Test func mapExtensionReturnsJSON() {
        // .map files (source maps) should return application/json
        #expect(AssetsSchemeHandler.mimeType(for: "map") == "application/json")
    }
}

// ---------------------------------------------------------------------------
// Path Traversal Detection Tests
// ---------------------------------------------------------------------------

struct PathTraversalTests {

    /// Helper: mimics the path validation logic from AssetsSchemeHandler
    private func containsTraversal(_ path: String) -> Bool {
        let components = path
            .split(separator: "/")
            .map(String.init)
            .filter { !$0.isEmpty }
        return components.contains("..") || components.contains(".")
    }

    @Test func rejectsParentDirectoryTraversal() {
        #expect(containsTraversal("../secret.txt"))
        #expect(containsTraversal("foo/../../../etc/passwd"))
        #expect(containsTraversal("assets/../../Info.plist"))
    }

    @Test func rejectsCurrentDirectoryDot() {
        #expect(containsTraversal("./hidden"))
        #expect(containsTraversal("foo/./bar"))
    }

    @Test func rejectsMixedTraversal() {
        #expect(containsTraversal("foo/./bar/../../../secret"))
    }

    @Test func allowsSafePaths() {
        #expect(!containsTraversal("index.html"))
        #expect(!containsTraversal("assets/style.css"))
        #expect(!containsTraversal("js/app.bundle.js"))
        #expect(!containsTraversal("images/logo.png"))
        #expect(!containsTraversal("fonts/inter.woff2"))
    }

    @Test func allowsDotsInFilenames() {
        // Dots within filenames (not as standalone components) are fine
        #expect(!containsTraversal("app.bundle.js"))
        #expect(!containsTraversal("assets/style.min.css"))
        #expect(!containsTraversal(".gitkeep"))  // leading dot = hidden file, not "." component
    }

    @Test func allowsEmptyPathForRoot() {
        #expect(!containsTraversal(""))
    }
}

// ---------------------------------------------------------------------------
// Path Containment Tests
// ---------------------------------------------------------------------------

struct PathContainmentTests {

    @Test func validPathIsContained() {
        let bundleDir = URL(fileURLWithPath: "/app/WebBundle").standardizedFileURL
        let fileURL = bundleDir.appendingPathComponent("index.html").standardizedFileURL
        #expect(fileURL.path.hasPrefix(bundleDir.path + "/"))
    }

    @Test func nestedPathIsContained() {
        let bundleDir = URL(fileURLWithPath: "/app/WebBundle").standardizedFileURL
        let fileURL = bundleDir.appendingPathComponent("assets/style.css").standardizedFileURL
        #expect(fileURL.path.hasPrefix(bundleDir.path + "/"))
    }

    @Test func escapedPathIsNotContained() {
        let bundleDir = URL(fileURLWithPath: "/app/WebBundle").standardizedFileURL
        // Even if traversal components are filtered, verify the hasPrefix check would catch escapes
        let escapedURL = URL(fileURLWithPath: "/app/Info.plist").standardizedFileURL
        #expect(!escapedURL.path.hasPrefix(bundleDir.path + "/"))
    }

    @Test func bundleDirItselfIsNotServed() {
        let bundleDir = URL(fileURLWithPath: "/app/WebBundle").standardizedFileURL
        // The bundle dir itself should not match (we need the trailing /)
        #expect(!bundleDir.path.hasPrefix(bundleDir.path + "/"))
    }
}

// ---------------------------------------------------------------------------
// Initialization Tests
// ---------------------------------------------------------------------------

struct AssetsSchemeHandlerInitTests {

    @Test func initWithExplicitDir() {
        let dir = URL(fileURLWithPath: "/tmp/TestBundle")
        let handler = AssetsSchemeHandler(bundleDir: dir)
        // Should not crash — handler is created successfully
        _ = handler
    }

    @Test func convenienceInitDoesNotCrash() {
        // Convenience init resolves WebBundle from main bundle.
        // In test context WebBundle may not exist — falls back to temp dir.
        let handler = AssetsSchemeHandler()
        _ = handler
    }
}
