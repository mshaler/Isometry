import WebKit
import Foundation
import OSLog

/// Coordinates WebView bridge communication between React prototype and native services
/// Manages MessageHandlers, navigation delegation, and bridge initialization
/// Enhanced with optimization layer integration for performance monitoring and reliability
public class WebViewBridge: NSObject {
    // MARK: - Properties

    public let databaseHandler: DatabaseMessageHandler
    public let fileSystemHandler: FileSystemMessageHandler
    public let pafvHandler: PAFVMessageHandler
    public let filterHandler: FilterBridgeHandler
    public let d3canvasHandler: D3CanvasMessageHandler
    public let d3renderingHandler: D3RenderingMessageHandler
    public let cloudKitHandler: CloudKitMessageHandler
    public let liveDataHandler: LiveDataMessageHandler

    // Live data notification bridge
    private var changeNotificationBridge: ChangeNotificationBridge?

    private weak var database: IsometryDatabase?
    private weak var superGridViewModel: SuperGridViewModel?
    private let logger = BridgeLogger(subsystem: "IsometryWebView", category: "Bridge")

    // Optimization layer components
    private let performanceMonitor: BridgeOptimizationMonitor
    private let messageBatcher: MessageBatcher?
    private let binarySerializer: BinarySerializer?
    private let queryPaginator: QueryPaginator?
    private let circuitBreaker: CircuitBreaker?

    // Feature flags for optimization layer
    private var optimizationsEnabled = OptimizationConfig(
        messageBatching: true,
        binaryCompression: true,
        queryPagination: true,
        circuitBreaker: true,
        performanceMonitoring: true
    )

    private struct OptimizationConfig {
        let messageBatching: Bool
        let binaryCompression: Bool
        let queryPagination: Bool
        let circuitBreaker: Bool
        let performanceMonitoring: Bool
    }

    // MARK: - Initialization

    public init(
        database: IsometryDatabase? = nil,
        superGridViewModel: SuperGridViewModel? = nil,
        appState: AppState? = nil
    ) {
        // Create handlers
        self.databaseHandler = DatabaseMessageHandler(database: database)
        self.fileSystemHandler = FileSystemMessageHandler()
        self.pafvHandler = PAFVMessageHandler(viewModel: superGridViewModel)
        self.filterHandler = FilterBridgeHandler(database: database)
        self.d3canvasHandler = D3CanvasMessageHandler()
        self.d3renderingHandler = D3RenderingMessageHandler()
        self.cloudKitHandler = CloudKitMessageHandler(appState: appState)
        self.liveDataHandler = LiveDataMessageHandler(database: database)
        self.database = database
        self.superGridViewModel = superGridViewModel

        // Initialize optimization layer components
        self.performanceMonitor = BridgeOptimizationMonitor()

        // Initialize optimization components if enabled
        if optimizationsEnabled.messageBatching {
            self.messageBatcher = MessageBatcher()
        } else {
            self.messageBatcher = nil
        }

        if optimizationsEnabled.binaryCompression {
            self.binarySerializer = BinarySerializer()
        } else {
            self.binarySerializer = nil
        }

        if optimizationsEnabled.queryPagination {
            self.queryPaginator = QueryPaginator()
        } else {
            self.queryPaginator = nil
        }

        if optimizationsEnabled.circuitBreaker {
            self.circuitBreaker = CircuitBreaker()
        } else {
            self.circuitBreaker = nil
        }

        super.init()

        // Configure performance monitoring
        if optimizationsEnabled.performanceMonitoring {
            Task { @MainActor in
                self.performanceMonitor.updateComponentMetrics(
                    messageBatcher: self.messageBatcher,
                    binarySerializer: self.binarySerializer,
                    queryPaginator: self.queryPaginator,
                    circuitBreaker: self.circuitBreaker
                )
            }
        }

        logger.info("WebViewBridge initialized with optimization layer")
    }

    /// Set up ChangeNotificationBridge with WebView for live data notifications
    @MainActor
    public func setupLiveDataBridge(with webView: WKWebView) {
        guard let database = database else {
            logger.warning("Cannot setup live data bridge without database")
            return
        }

        changeNotificationBridge = ChangeNotificationBridge(
            database: database,
            webView: webView,
            messageBatcher: messageBatcher,
            binarySerializer: binarySerializer
        )

        logger.info("Live data bridge configured for real-time change notifications")
    }

    /// Connect to database after initialization
    public func connectToDatabase(_ database: IsometryDatabase) async {
        self.database = database
        // Update handlers with real database
        await self.databaseHandler.setDatabase(database)
        await self.filterHandler.setDatabase(database)
        await self.liveDataHandler.setDatabase(database)
    }

    /// Connect AppState for CloudKit sync operations after initialization
    @MainActor
    public func connectToAppState(_ appState: AppState) {
        cloudKitHandler.setAppState(appState)
    }

    // MARK: - Optimization Layer API

    /// Get performance metrics from monitoring
    @MainActor
    public func getPerformanceMetrics() -> BridgeOptimizationMonitor.BridgeMetrics {
        return performanceMonitor.metrics
    }

    /// Get performance monitor instance
    public func getPerformanceMonitor() -> BridgeOptimizationMonitor {
        return performanceMonitor
    }

    /// Record bridge operation for performance monitoring
    public func recordBridgeOperation(
        operation: String,
        latency: Double? = nil,
        success: Bool? = nil,
        payloadSize: Double? = nil,
        compressionRatio: Double? = nil,
        queueSize: Int? = nil
    ) {
        Task { @MainActor in
            performanceMonitor.recordBridgeOperation(
                operation: operation,
                latency: latency,
                success: success,
                payloadSize: payloadSize,
                compressionRatio: compressionRatio,
                queueSize: queueSize
            )
        }
    }

    /// Configure optimization features (for testing/gradual rollout)
    public func configureOptimizations(
        messageBatching: Bool? = nil,
        binaryCompression: Bool? = nil,
        queryPagination: Bool? = nil,
        circuitBreaker: Bool? = nil,
        performanceMonitoring: Bool? = nil
    ) {
        let newConfig = OptimizationConfig(
            messageBatching: messageBatching ?? optimizationsEnabled.messageBatching,
            binaryCompression: binaryCompression ?? optimizationsEnabled.binaryCompression,
            queryPagination: queryPagination ?? optimizationsEnabled.queryPagination,
            circuitBreaker: circuitBreaker ?? optimizationsEnabled.circuitBreaker,
            performanceMonitoring: performanceMonitoring ?? optimizationsEnabled.performanceMonitoring
        )

        optimizationsEnabled = newConfig
        logger.info("Optimization configuration updated: batching=\(newConfig.messageBatching), compression=\(newConfig.binaryCompression), pagination=\(newConfig.queryPagination), circuitBreaker=\(newConfig.circuitBreaker), monitoring=\(newConfig.performanceMonitoring)")
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

                    // D3 Canvas rendering bridge
                    d3canvas: {
                        renderCommands: function(commands) {
                            return window._isometryBridge.sendMessage('d3canvas', 'renderCommands', { commands });
                        },
                        updateViewport: function(viewport) {
                            return window._isometryBridge.sendMessage('d3canvas', 'updateViewport', { viewport });
                        }
                    },

                    // D3 rendering optimization bridge
                    d3rendering: {
                        optimizeViewport: function(params) {
                            return window._isometryBridge.sendMessage('d3rendering', 'optimizeViewport', params);
                        },
                        updateLOD: function(params) {
                            return window._isometryBridge.sendMessage('d3rendering', 'updateLOD', params);
                        },
                        manageMemory: function(params) {
                            return window._isometryBridge.sendMessage('d3rendering', 'manageMemory', params);
                        },
                        getBenchmarkResults: function(params) {
                            return window._isometryBridge.sendMessage('d3rendering', 'getBenchmarkResults', params);
                        }
                    },

                    // CloudKit sync bridge
                    cloudkit: {
                        sync: function(params) {
                            return window._isometryBridge.sendMessage('cloudkit', 'sync', params);
                        },
                        getStatus: function(params) {
                            return window._isometryBridge.sendMessage('cloudkit', 'getStatus', params);
                        }
                    },

                    // Live data notifications bridge
                    liveData: {
                        startObservation: function(observationId, sql, params, correlationId) {
                            return window._isometryBridge.sendMessage('liveData', 'startObservation', {
                                observationId: observationId,
                                sql: sql,
                                params: params || [],
                                correlationId: correlationId
                            });
                        },
                        stopObservation: function(observationId, correlationId) {
                            return window._isometryBridge.sendMessage('liveData', 'stopObservation', {
                                observationId: observationId,
                                correlationId: correlationId
                            });
                        },
                        getStatistics: function() {
                            return window._isometryBridge.sendMessage('liveData', 'getStatistics', {});
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

                    // D3 Canvas operations for native rendering
                    d3canvas: {
                        renderCommands: function(params) {
                            return window._isometryBridge.sendMessage('d3canvas', 'renderCommands', params);
                        },

                        canvasUpdate: function(params) {
                            return window._isometryBridge.sendMessage('d3canvas', 'canvasUpdate', params);
                        },

                        getCapabilities: function() {
                            return window._isometryBridge.sendMessage('d3canvas', 'getCapabilities', {});
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
                    diagnostic.tests.has_d3canvas = !!window.webkit?.messageHandlers?.d3canvas;
                    diagnostic.tests.has_d3rendering = !!window.webkit?.messageHandlers?.d3rendering;
                    diagnostic.tests.has_cloudkit = !!window.webkit?.messageHandlers?.cloudkit;

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
        let startTime = DispatchTime.now()
        let handlerName = message.name
        logger.debug("Received WebView message for handler: \(handlerName)")

        // Extract operation details for performance monitoring
        let operationName = extractOperationName(from: message)
        let payloadSize = calculatePayloadSize(from: message)

        var success = true
        defer {
            // Record performance metrics after message handling
            if optimizationsEnabled.performanceMonitoring {
                let endTime = DispatchTime.now()
                let latencyMs = Double(endTime.uptimeNanoseconds - startTime.uptimeNanoseconds) / 1_000_000

                recordBridgeOperation(
                    operation: "\(handlerName).\(operationName)",
                    latency: latencyMs,
                    success: success,
                    payloadSize: payloadSize
                )
            }
        }

        switch handlerName {
        case "database":
            do {
                databaseHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)
            } catch {
                success = false
                throw error
            }

        case "filesystem":
            do {
                fileSystemHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)
            } catch {
                success = false
                throw error
            }

        case "pafv":
            do {
                pafvHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)
            } catch {
                success = false
                throw error
            }

        case "filters":
            do {
                filterHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)
            } catch {
                success = false
                throw error
            }

        case "d3canvas":
            do {
                d3canvasHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)
            } catch {
                success = false
                throw error
            }

        case "d3rendering":
            do {
                d3renderingHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)
            } catch {
                success = false
                throw error
            }

        case "cloudkit":
            do {
                cloudKitHandler.userContentController(message.webView?.configuration.userContentController ?? WKUserContentController(), didReceive: message)
            } catch {
                success = false
                throw error
            }

        case "transaction":
            do {
                await handleTransactionMessage(message)
            } catch {
                success = false
                throw error
            }

        case "liveData":
            do {
                await handleLiveDataMessage(message)
            } catch {
                success = false
                throw error
            }

        default:
            success = false
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

    private func extractOperationName(from message: WKScriptMessage) -> String {
        guard let messageBody = message.body as? [String: Any],
              let method = messageBody["method"] as? String else {
            return "unknown"
        }
        return method
    }

    private func calculatePayloadSize(from message: WKScriptMessage) -> Double {
        do {
            let data = try JSONSerialization.data(withJSONObject: message.body)
            return Double(data.count)
        } catch {
            return 0.0
        }
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

    // MARK: - Live Data Message Handling

    /// Handle liveData-specific messages with correlation tracking
    private func handleLiveDataMessage(_ message: WKScriptMessage) async {
        guard let messageBody = message.body as? [String: Any],
              let method = messageBody["method"] as? String,
              let params = messageBody["params"] as? [String: Any],
              let requestId = messageBody["id"] as? String else {
            await sendError(
                to: message.webView,
                error: "Invalid liveData message format",
                requestId: extractRequestId(from: message)
            )
            return
        }

        // Extract correlation ID for tracking (SYNC-05)
        let correlationId = params["correlationId"] as? String ?? UUID().uuidString
        logger.info("Handling liveData message: \(method) (correlation: \(correlationId))")

        // Ensure ChangeNotificationBridge is available
        guard let changeNotificationBridge = changeNotificationBridge else {
            await sendError(
                to: message.webView,
                error: "Live data bridge not initialized",
                requestId: requestId
            )
            return
        }

        do {
            switch method {
            case "startObservation":
                guard let observationId = params["observationId"] as? String,
                      let sql = params["sql"] as? String else {
                    throw LiveDataBridgeError.missingParameters("observationId and sql required")
                }

                let paramsArray = params["params"] as? [Any] ?? []
                let actualObservationId = await changeNotificationBridge.startObservation(
                    sql: sql,
                    arguments: paramsArray
                )

                await sendResponse(
                    to: message.webView,
                    requestId: requestId,
                    result: [
                        "success": true,
                        "observationId": actualObservationId,
                        "correlationId": correlationId
                    ]
                )

            case "stopObservation":
                guard let observationId = params["observationId"] as? String else {
                    throw LiveDataBridgeError.missingParameters("observationId required")
                }

                await changeNotificationBridge.stopObservation(observationId: observationId)
                await sendResponse(
                    to: message.webView,
                    requestId: requestId,
                    result: [
                        "success": true,
                        "observationId": observationId,
                        "correlationId": correlationId
                    ]
                )

            case "getStatistics":
                let statistics = await changeNotificationBridge.getObservationStatistics()
                await sendResponse(
                    to: message.webView,
                    requestId: requestId,
                    result: [
                        "success": true,
                        "statistics": statistics,
                        "correlationId": correlationId
                    ]
                )

            default:
                throw LiveDataBridgeError.unknownMethod(method)
            }

        } catch {
            await sendError(
                to: message.webView,
                error: "LiveData error: \(error.localizedDescription)",
                requestId: requestId
            )
        }
    }

    // MARK: - Transaction Message Handling

    /// Handle transaction-specific messages
    private func handleTransactionMessage(_ message: WKScriptMessage) async {
        guard let messageBody = message.body as? [String: Any],
              let method = messageBody["method"] as? String,
              let params = messageBody["params"] as? [String: Any],
              let requestId = messageBody["id"] as? String else {
            await sendError(
                to: message.webView,
                error: "Invalid transaction message format",
                requestId: extractRequestId(from: message)
            )
            return
        }

        let correlationId = params["correlationId"] as? String
        os_log("Handling transaction message: %@ (correlation: %@)", log: logger.osLog, type: .info, method, correlationId ?? "none")

        do {
            switch method {
            case "beginTransaction":
                guard let correlationId = correlationId else {
                    throw TransactionBridgeError.missingCorrelationId
                }

                let transactionId = try await getTransactionBridge().beginTransaction(correlationId: correlationId)
                await sendResponse(
                    to: message.webView,
                    requestId: requestId,
                    result: ["transactionId": transactionId, "success": true]
                )

            case "commitTransaction":
                guard let transactionId = params["transactionId"] as? String else {
                    throw TransactionBridgeError.missingTransactionId
                }

                try await getTransactionBridge().commitTransaction(transactionId: transactionId)
                await sendResponse(
                    to: message.webView,
                    requestId: requestId,
                    result: ["success": true]
                )

            case "rollbackTransaction":
                guard let transactionId = params["transactionId"] as? String else {
                    throw TransactionBridgeError.missingTransactionId
                }

                try await getTransactionBridge().rollbackTransaction(transactionId: transactionId)
                await sendResponse(
                    to: message.webView,
                    requestId: requestId,
                    result: ["success": true]
                )

            default:
                throw TransactionBridgeError.unknownMethod(method)
            }

        } catch {
            await sendError(
                to: message.webView,
                error: "Transaction error: \(error.localizedDescription)",
                requestId: requestId
            )
        }
    }

    /// Get or create transaction bridge instance
    private func getTransactionBridge() async -> TransactionBridge {
        // This would be injected in production, but for now create a new instance
        guard let database = self.database else {
            fatalError("Database not available for transaction bridge")
        }
        return TransactionBridge(database: database)
    }

    /// Send successful response back to WebView
    @MainActor
    private func sendResponse(to webView: WKWebView?, requestId: String, result: [String: Any]) async {
        guard let webView = webView else { return }

        let response: [String: Any] = [
            "id": requestId,
            "success": true,
            "result": result
        ]

        do {
            let responseData = try JSONSerialization.data(withJSONObject: response)
            let responseString = String(data: responseData, encoding: .utf8) ?? "{}"

            let script = "window._isometryBridge?.handleResponse(\(responseString))"

            webView.evaluateJavaScript(script) { [weak self] _, error in
                if let error = error {
                    os_log("Failed to send response: %@", log: self?.logger.osLog ?? OSLog.default, type: .error, error.localizedDescription)
                }
            }
        } catch {
            os_log("Failed to serialize response: %@", log: logger.osLog, type: .error, error.localizedDescription)
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

// MARK: - Transaction Bridge Errors

public enum TransactionBridgeError: Error, LocalizedError {
    case missingCorrelationId
    case missingTransactionId
    case unknownMethod(String)

    public var errorDescription: String? {
        switch self {
        case .missingCorrelationId:
            return "Missing correlation ID in transaction request"
        case .missingTransactionId:
            return "Missing transaction ID in transaction request"
        case .unknownMethod(let method):
            return "Unknown transaction method: \(method)"
        }
    }
}

// MARK: - Live Data Bridge Errors

public enum WebViewBridgeError: Error, LocalizedError {
    case missingParameters(String)
    case bridgeNotInitialized
    case unknownMethod(String)

    public var errorDescription: String? {
        switch self {
        case .missingParameters(let details):
            return "Missing required parameters: \(details)"
        case .bridgeNotInitialized:
            return "Live data bridge not initialized"
        case .unknownMethod(let method):
            return "Unknown live data method: \(method)"
        }
    }
}

// MARK: - Logger

/// Simple logging utility for WebView bridge
struct BridgeLogger {
    let subsystem: String
    let category: String

    var osLog: OSLog {
        return OSLog(subsystem: subsystem, category: category)
    }

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
