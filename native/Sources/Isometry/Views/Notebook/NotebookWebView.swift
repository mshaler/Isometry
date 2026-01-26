import SwiftUI

/// Integration point for WebView-based notebook within the native app structure
/// Replaces shell view with React prototype running in WKWebView
public struct NotebookWebViewContainer: View {
    @EnvironmentObject private var appState: AppState
    @State private var webViewBridge: WebViewBridge?

    public init() {}

    public var body: some View {
        Group {
            if let bridge = webViewBridge {
                NotebookWebView()
                    .environmentObject(WebViewBridgeEnvironment(bridge: bridge))
            } else {
                loadingView
            }
        }
        .onAppear {
            initializeBridge()
        }
        .navigationTitle("Notebook (Web)")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.2)

            VStack(spacing: 8) {
                Text("Initializing WebView Bridge")
                    .font(.headline)

                Text("Connecting to native database...")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.background.secondary)
    }

    private func initializeBridge() {
        Task {
            // Get database from app state
            let database = await appState.database

            // Create bridge with database connection
            let bridge = WebViewBridge()
            await bridge.connectToDatabase(database)

            await MainActor.run {
                self.webViewBridge = bridge
            }
        }
    }
}

/// Environment object to pass WebView bridge down to child views
public class WebViewBridgeEnvironment: ObservableObject {
    public let bridge: WebViewBridge

    public init(bridge: WebViewBridge) {
        self.bridge = bridge
    }
}

// MARK: - Preview

#Preview {
    NavigationView {
        NotebookWebViewContainer()
            .environmentObject(AppState.preview)
    }
}