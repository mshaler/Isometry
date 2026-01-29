import WebKit
import Foundation
import OSLog

/// Coordinates WebView bridge communication between React prototype and native services
/// Manages MessageHandlers, navigation delegation, and bridge initialization
public class WebViewBridge: NSObject {
    // MARK: - Properties

    public let databaseHandler: DatabaseMessageHandler
    public let fileSystemHandler: FileSystemMessageHandler
    public let pafvHandler: PAFVMessageHandler
    public let filterHandler: FilterBridgeHandler

    private weak var database: IsometryDatabase?
    private weak var superGridViewModel: SuperGridViewModel?
    private let logger = Logger(subsystem: "IsometryWebView", category: "Bridge")

    // MARK: - Initialization

    public init(database: IsometryDatabase? = nil, superGridViewModel: SuperGridViewModel? = nil) {
        // Create handlers
        self.databaseHandler = DatabaseMessageHandler(database: database)
        self.fileSystemHandler = FileSystemMessageHandler()
        self.pafvHandler = PAFVMessageHandler(viewModel: superGridViewModel)
        self.filterHandler = FilterBridgeHandler(database: database)
        self.database = database
        self.superGridViewModel = superGridViewModel

        super.init()
    }

    /// Connect to database after initialization
    public func connectToDatabase(_ database: IsometryDatabase) async {
        self.database = database
        // Update handlers with real database
        await self.databaseHandler.setDatabase(database)
        await self.filterHandler.setDatabase(database)
    }

    // MARK: - Bridge Initialization Script

    /// JavaScript code injected at document start to set up the bridge interface
    public var bridgeInitializationScript: String {
        return """
            (function() {
                console.log('Initializing Isometry WebView Bridge...');

                // Verify webkit messageHandlers are available
                if (!window.webkit || !window.webkit.messageHandlers) {
                    console.error('WebKit messageHandlers not available - bridge setup failed');
                    return;
                }

                console.log('WebKit messageHandlers available:', Object.keys(window.webkit.messageHandlers));

                // Create bridge namespace
                window._isometryBridge = {
                    pendingRequests: new Map(),
                    requestId: 0,

                    // Generate unique request ID
                    generateRequestId: function() {
                        return 'req_' + (++this.requestId) + '_' + Date.now();
                    },

                    // Send message to native handler
                    sendMessage: function(handler, method, params) {
                        return new Promise((resolve, reject) => {
                            const requestId = this.generateRequestId();

                            // Store promise callbacks
                            this.pendingRequests.set(requestId, { resolve, reject });

                            // Send message to native
                            const message = {
                                id: requestId,
                                method: method,
                                params: params || {}
                            };

                            try {
                                window.webkit.messageHandlers[handler].postMessage(message);
                            } catch (error) {
                                this.pendingRequests.delete(requestId);
                                reject(new Error('Failed to send message: ' + error.message));
                            }

                            // Timeout after 30 seconds
                            setTimeout(() => {
                                if (this.pendingRequests.has(requestId)) {
                                    this.pendingRequests.delete(requestId);
                                    reject(new Error('Request timeout'));
                                }
                            }, 30000);
                        });
                    },

                    // Handle response from native
                    handleResponse: function(response) {
                        const { id, success, result, error } = response;
                        const pending = this.pendingRequests.get(id);

                        if (!pending) {
                            console.warn('Received response for unknown request:', id);
                            return;
                        }

                        this.pendingRequests.delete(id);

                        if (success) {
                            pending.resolve(result);
                        } else {
                            pending.reject(new Error(error || 'Unknown error'));
                        }
                    },

                    // Database operations
                    database: {
                        execute: function(sql, params) {
                            return window._isometryBridge.sendMessage('database', 'execute', { sql, params });
                        },

                        getNodes: function(options = {}) {
                            return window._isometryBridge.sendMessage('database', 'getNodes', options);
                        },

                        createNode: function(node) {
                            return window._isometryBridge.sendMessage('database', 'createNode', { node });
                        },

                        updateNode: function(node) {
                            return window._isometryBridge.sendMessage('database', 'updateNode', { node });
                        },

                        deleteNode: function(id) {
                            return window._isometryBridge.sendMessage('database', 'deleteNode', { id });
                        },

                        search: function(query, options = {}) {
                            return window._isometryBridge.sendMessage('database', 'search',
                                { query, ...options });
                        },

                        getGraph: function(options = {}) {
                            return window._isometryBridge.sendMessage('database', 'getGraph', options);
                        },

                        reset: function() {
                            return window._isometryBridge.sendMessage('database', 'reset', {});
                        }
                    },

                    // File system operations
                    filesystem: {
                        readFile: function(path) {
                            return window._isometryBridge.sendMessage('filesystem', 'readFile', { path });
                        },

                        writeFile: function(path, content) {
                            return window._isometryBridge.sendMessage('filesystem', 'writeFile',
                                { path, content });
                        },

                        deleteFile: function(path) {
                            return window._isometryBridge.sendMessage('filesystem', 'deleteFile', { path });
                        },

                        listFiles: function(path) {
                            return window._isometryBridge.sendMessage('filesystem', 'listFiles', { path });
                        },

                        fileExists: function(path) {
                            return window._isometryBridge.sendMessage('filesystem', 'fileExists', { path });
                        }
                    },

                    // PAFV bridge operations
                    pafv: {
                        updateAxisMapping: function(mappings, viewMode, sequenceId) {
                            return window._isometryBridge.sendMessage('pafv', 'updateAxisMapping', {
                                mappings,
                                viewMode,
                                sequenceId
                            });
                        },

                        updateViewport: function(zoomLevel, panOffsetX, panOffsetY, sequenceId) {
                            return window._isometryBridge.sendMessage('pafv', 'updateViewport', {
                                zoomLevel,
                                panOffsetX,
                                panOffsetY,
                                sequenceId
                            });
                        },

                        syncCoordinates: function(coordinates, sequenceId) {
                            return window._isometryBridge.sendMessage('pafv', 'syncCoordinates', {
                                coordinates,
                                sequenceId
                            });
                        }
                    },

                    // Filter operations for LATCH filtering
                    filters: {
                        executeFilter: function(sql, params, limit, offset, sequenceId) {
                            return window._isometryBridge.sendMessage('filters', 'executeFilter', {
                                sql,
                                params: params || [],
                                limit: limit || 1000,
                                offset: offset || 0,
                                sequenceId
                            });
                        },

                        getFilterStatistics: function() {
                            return window._isometryBridge.sendMessage('filters', 'getFilterStatistics', {});
                        },

                        cancelPendingRequests: function() {
                            return window._isometryBridge.sendMessage('filters', 'cancelPendingRequests', {});
                        }
                    },

                    // Environment detection
                    environment: {
                        isNative: true,
                        platform: '\(platformString)',
                        version: '\(bundleVersion)',
                        transport: 'webview-bridge'
                    }
                };

                // Legacy compatibility - expose database directly for existing React code
                window.isometryDatabase = window._isometryBridge.database;
                window.isometryFilesystem = window._isometryBridge.filesystem;

                // Signal that bridge is ready
                window.dispatchEvent(new CustomEvent('isometry-bridge-ready'));

                console.log('✅ Isometry WebView Bridge initialized successfully');
                console.log('✅ Available message handlers:', Object.keys(window.webkit.messageHandlers));
                console.log('✅ Bridge environment:', window._isometryBridge.environment);

                // Automated diagnostic system - writes results to file for Claude to monitor
                setTimeout(() => {
                    const diagnostic = {
                        timestamp: new Date().toISOString(),
                        tests: {},
                        summary: { passed: 0, failed: 0, errors: [] }
                    };

                    console.log('🔬 STARTING AUTOMATED DIAGNOSTIC...');

                    // Test 1: WebKit availability
                    diagnostic.tests.webkit_exists = !!window.webkit;
                    diagnostic.tests.messageHandlers_exists = !!(window.webkit?.messageHandlers);
                    diagnostic.tests.available_handlers = Object.keys(window.webkit?.messageHandlers || {});

                    // Test 2: Direct message handler test
                    if (window.webkit?.messageHandlers?.database) {
                        try {
                            window.webkit.messageHandlers.database.postMessage({
                                id: 'auto-diagnostic-' + Date.now(),
                                method: 'ping',
                                params: {}
                            });
                            diagnostic.tests.direct_message_sent = true;
                            diagnostic.summary.passed++;
                        } catch (error) {
                            diagnostic.tests.direct_message_sent = false;
                            diagnostic.tests.direct_message_error = error.toString();
                            diagnostic.summary.failed++;
                            diagnostic.summary.errors.push('Direct message failed: ' + error.toString());
                        }
                    } else {
                        diagnostic.tests.direct_message_sent = false;
                        diagnostic.tests.direct_message_error = 'Database handler not available';
                        diagnostic.summary.failed++;
                        diagnostic.summary.errors.push('Database handler not available');
                    }

                    // Test 3: Bridge wrapper test
                    if (window._isometryBridge) {
                        diagnostic.tests.bridge_wrapper_exists = true;
                        try {
                            window._isometryBridge.sendMessage('database', 'ping', {})
                                .then(result => {
                                    diagnostic.tests.bridge_wrapper_success = true;
                                    diagnostic.tests.bridge_wrapper_result = result;
                                    diagnostic.summary.passed++;
                                    writeDiagnosticResults(diagnostic);
                                })
                                .catch(error => {
                                    diagnostic.tests.bridge_wrapper_success = false;
                                    diagnostic.tests.bridge_wrapper_error = error.toString();
                                    diagnostic.summary.failed++;
                                    diagnostic.summary.errors.push('Bridge wrapper failed: ' + error.toString());
                                    writeDiagnosticResults(diagnostic);
                                });
                        } catch (error) {
                            diagnostic.tests.bridge_wrapper_success = false;
                            diagnostic.tests.bridge_wrapper_error = error.toString();
                            diagnostic.summary.failed++;
                            diagnostic.summary.errors.push('Bridge wrapper exception: ' + error.toString());
                            writeDiagnosticResults(diagnostic);
                        }
                    } else {
                        diagnostic.tests.bridge_wrapper_exists = false;
                        diagnostic.summary.failed++;
                        diagnostic.summary.errors.push('Bridge wrapper not available');
                        writeDiagnosticResults(diagnostic);
                    }

                    function writeDiagnosticResults(results) {
                        // Try to write diagnostic results using filesystem bridge
                        const diagnosticData = JSON.stringify(results, null, 2);
                        const filePath = '/tmp/isometry_bridge_diagnostic.json';

                        if (window._isometryBridge?.filesystem) {
                            window._isometryBridge.filesystem.writeFile(filePath, diagnosticData)
                                .then(() => console.log('✅ Diagnostic written to:', filePath))
                                .catch(error => console.log('❌ Failed to write diagnostic:', error));
                        }

                        // Also try to send diagnostic via database bridge
                        if (window._isometryBridge?.database) {
                            window._isometryBridge.database.execute(
                                'CREATE TABLE IF NOT EXISTS diagnostic_log (id INTEGER PRIMARY KEY, timestamp TEXT, data TEXT)',
                                []
                            ).then(() => {
                                return window._isometryBridge.database.execute(
                                    'INSERT INTO diagnostic_log (timestamp, data) VALUES (?, ?)',
                                    [results.timestamp, diagnosticData]
                                );
                            }).then(() => {
                                console.log('✅ Diagnostic logged to database');
                            }).catch(error => {
                                console.log('❌ Failed to log diagnostic to database:', error);
                            });
                        }

                        console.log('🔬 DIAGNOSTIC COMPLETE:', results);
                    }

                    // Initial write for sync tests
                    setTimeout(() => writeDiagnosticResults(diagnostic), 100);
                }, 3000);

                // Add global test function for debugging
                window.testBridge = function() {
                    console.log('🧪 Testing bridge communication...');
                    console.log('🧪 Message handlers available:', Object.keys(window.webkit.messageHandlers));

                    // Test direct message handler call
                    try {
                        window.webkit.messageHandlers.database.postMessage({
                            id: 'test-' + Date.now(),
                            method: 'ping',
                            params: {}
                        });
                        console.log('✅ Direct message sent to database handler');
                    } catch (error) {
                        console.error('❌ Direct message failed:', error);
                    }

                    // Test bridge wrapper
                    try {
                        window._isometryBridge.sendMessage('database', 'ping', {}).then(result => {
                            console.log('✅ Bridge wrapper success:', result);
                        }).catch(error => {
                            console.error('❌ Bridge wrapper failed:', error);
                        });
                    } catch (error) {
                        console.error('❌ Bridge wrapper exception:', error);
                    }
                };
            })();
        """
    }

    private var platformString: String {
        #if os(iOS)
        return "iOS"
        #else
        return "macOS"
        #endif
    }

    private var bundleVersion: String {
        return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    }

    // MARK: - Message Handling

    /// Handle incoming message from WebView
    public func handleMessage(_ message: WKScriptMessage) async {
        let handlerName = message.name
        logger.debug("Received WebView message for handler: \(handlerName)")

        switch handlerName {
        case "database":
            databaseHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)

        case "filesystem":
            fileSystemHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)

        case "pafv":
            pafvHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)

        case "filters":
            filterHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)

        default:
            logger.warning("Unknown message handler: \(handlerName)")
            await sendError(
                to: message.webView,
                error: "Unknown message handler: \(handlerName)",
                requestId: extractRequestId(from: message)
            )
        }
    }

    private func extractRequestId(from message: WKScriptMessage) -> String? {
        guard let messageBody = message.body as? [String: Any],
              let requestId = messageBody["id"] as? String else {
            return nil
        }
        return requestId
    }

    @MainActor
    private func sendError(to webView: WKWebView?, error: String, requestId: String?) async {
        guard let webView = webView else { return }

        let response: [String: Any] = [
            "id": requestId ?? "",
            "success": false,
            "error": error
        ]

        do {
            let responseData = try JSONSerialization.data(withJSONObject: response)
            let responseString = String(data: responseData, encoding: .utf8) ?? "{}"

            let script = "window._isometryBridge?.handleResponse(\(responseString))"

            webView.evaluateJavaScript(script) { [weak self] _, error in
                if let error = error {
                    self?.logger.error("Failed to send bridge error: \(error)")
                }
            }
        } catch {
            logger.error("Failed to serialize bridge error response: \(error)")
        }
    }

    // MARK: - Development & Debugging

    /// Inject development tools and debugging helpers
    public func injectDevelopmentTools(into webView: WKWebView) {
        #if DEBUG
        let devScript = """
            window._isometryBridge.debug = {
                logMessages: true,
                showPerformance: true,

                // Log all bridge calls for debugging
                originalSendMessage: window._isometryBridge.sendMessage,

                init: function() {
                    const self = this;
                    window._isometryBridge.sendMessage = function(handler, method, params) {
                        if (self.logMessages) {
                            console.log('[Bridge]', handler + '.' + method, params);
                        }

                        const start = performance.now();
                        return self.originalSendMessage.call(window._isometryBridge, handler, method, params)
                            .then(result => {
                                if (self.showPerformance) {
                                    const duration = performance.now() - start;
                                    console.log('[Bridge Performance]', handler + '.' + method, duration + 'ms');
                                }
                                return result;
                            });
                    };
                }
            };

            window._isometryBridge.debug.init();
            console.log('WebView bridge debugging enabled');
        """

        webView.evaluateJavaScript(devScript) { _, error in
            if let error = error {
                self.logger.debug("Failed to inject dev tools: \(error)")
            }
        }
        #endif
    }
}

// MARK: - WKNavigationDelegate

extension WebViewBridge: WKNavigationDelegate {
    public func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        logger.debug("WebView started loading")
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        logger.debug("WebView finished loading")

        // Inject development tools if in debug mode
        #if DEBUG
        injectDevelopmentTools(into: webView)
        #endif
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        logger.error("WebView navigation failed: \(error.localizedDescription)")
    }

    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        // Allow file:// URLs for local React app
        if url.isFileURL {
            decisionHandler(.allow)
            return
        }

        // Allow localhost for development server
        if url.host == "localhost" || url.host == "127.0.0.1" {
            logger.debug("Allowing localhost navigation to: \(url)")
            decisionHandler(.allow)
            return
        }

        // Block external navigation for security
        logger.warning("Blocked external navigation to: \(url)")
        decisionHandler(.cancel)
    }
}

// MARK: - WKUIDelegate

extension WebViewBridge: WKUIDelegate {
    public func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        logger.debug("JavaScript alert: \(message)")
        completionHandler()
    }

    public func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        logger.debug("JavaScript confirm: \(message)")
        completionHandler(true)
    }
}


// MARK: - Logger

/// Simple logging utility for WebView bridge
struct Logger {
    let subsystem: String
    let category: String

    func debug(_ message: String) {
        #if DEBUG
        print("[\(subsystem):\(category)] DEBUG: \(message)")
        #endif
    }

    func warning(_ message: String) {
        print("[\(subsystem):\(category)] WARNING: \(message)")
    }

    func error(_ message: String) {
        print("[\(subsystem):\(category)] ERROR: \(message)")
    }
}