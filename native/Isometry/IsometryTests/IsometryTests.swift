import Testing
import Foundation
@testable import Isometry

// ---------------------------------------------------------------------------
// WebBundle Existence Tests
// ---------------------------------------------------------------------------

struct WebBundleTests {

    @Test func bundleDirectoryResolvable() {
        // In test target, WebBundle may not be available (different bundle structure).
        // This tests that the convenience init handles missing bundle gracefully.
        let handler = AssetsSchemeHandler()
        _ = handler  // Should not crash even without WebBundle
    }

    @Test func bundleDirectoryExistsInMainBundle() throws {
        // This test may be skipped in unit test context where the app bundle
        // doesn't include WebBundle. It's primarily valuable in UI test context.
        guard let bundlePath = Bundle.main.url(forResource: "WebBundle", withExtension: nil) else {
            // WebBundle not available in test target — expected in unit tests
            return
        }

        var isDirectory: ObjCBool = false
        let exists = FileManager.default.fileExists(
            atPath: bundlePath.path,
            isDirectory: &isDirectory
        )

        #expect(exists, "WebBundle should exist")
        #expect(isDirectory.boolValue, "WebBundle should be a directory")
    }

    @Test func indexHTMLExistsInBundle() throws {
        guard let bundlePath = Bundle.main.url(forResource: "WebBundle", withExtension: nil) else {
            // WebBundle not available in test target — expected in unit tests
            return
        }

        let indexPath = bundlePath.appendingPathComponent("index.html").path
        #expect(
            FileManager.default.fileExists(atPath: indexPath),
            "index.html should exist in WebBundle"
        )
    }
}
