import XCTest

final class IsometryUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        // Terminate any stale instance before launching — WKWebView can prevent
        // clean termination, causing XCUITest to wait 60s and fail.
        app.terminate()
        app.launch()
    }

    override func tearDownWithError() throws {
        app.terminate()
        app = nil
    }

    // MARK: - Launch Tests

    @MainActor
    func testAppLaunches() throws {
        // Verify app launches without crash
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 5))
    }

    @MainActor
    func testWebViewLoads() throws {
        // Give WebView time to load bundled content
        let webView = app.webViews.firstMatch
        let exists = webView.waitForExistence(timeout: 10)

        XCTAssertTrue(exists, "WebView should exist and load content")
    }

    // MARK: - Stability Tests

    @MainActor
    func testAppRemainsResponsiveAfterLaunch() throws {
        // Verify the app doesn't crash shortly after launch
        // (catches async initialization failures)
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 5))

        // Wait a few seconds for any async failures to surface
        sleep(3)

        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 2),
                      "App should remain responsive after async initialization")
    }

    @MainActor
    func testLaunchPerformance() throws {
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            XCUIApplication().launch()
        }
    }
}
