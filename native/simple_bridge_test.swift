#!/usr/bin/env swift

import WebKit
import Foundation

// Simple test to verify WKWebView message handler setup
class BridgeTest: NSObject, WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        print("✅ RECEIVED MESSAGE FROM JS: \(message.name)")
        print("📦 Message body: \(message.body)")
    }

    func testMessageHandlerSetup() {
        print("🧪 Testing WebKit message handler setup...")

        let configuration = WKWebViewConfiguration()
        let userContentController = WKUserContentController()

        // Register handler
        userContentController.add(self, name: "testHandler")
        print("✅ Registered 'testHandler' message handler")

        configuration.userContentController = userContentController

        // Test script to verify handlers
        let testScript = WKUserScript(
            source: """
                console.log('Testing message handlers...');
                console.log('window.webkit exists:', !!window.webkit);
                console.log('messageHandlers exists:', !!window.webkit?.messageHandlers);
                if (window.webkit?.messageHandlers) {
                    console.log('Available handlers:', Object.keys(window.webkit.messageHandlers));

                    // Test sending message
                    if (window.webkit.messageHandlers.testHandler) {
                        console.log('Sending test message...');
                        window.webkit.messageHandlers.testHandler.postMessage({
                            test: 'Hello from JavaScript!',
                            timestamp: Date.now()
                        });
                    }
                } else {
                    console.log('❌ No message handlers available');
                }
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )

        userContentController.addUserScript(testScript)
        print("✅ Added test script")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        print("✅ Created WebView")

        // Load a simple test page
        let htmlContent = """
            <html>
            <head><title>Bridge Test</title></head>
            <body>
                <h1>WebKit Bridge Test</h1>
                <script>
                    console.log('HTML page loaded');
                    setTimeout(() => {
                        console.log('Delayed script running...');
                        if (window.webkit?.messageHandlers?.testHandler) {
                            console.log('Sending delayed message...');
                            window.webkit.messageHandlers.testHandler.postMessage({
                                test: 'Delayed message from HTML',
                                timestamp: Date.now()
                            });
                        }
                    }, 1000);
                </script>
            </body>
            </html>
        """

        webView.loadHTMLString(htmlContent, baseURL: nil)
        print("✅ Loaded test HTML")

        // Keep alive for a bit to receive messages
        print("⏰ Waiting for messages...")
        RunLoop.main.run(until: Date(timeIntervalSinceNow: 3))
        print("🏁 Test complete")
    }
}

// Run the test
let test = BridgeTest()
test.testMessageHandlerSetup()