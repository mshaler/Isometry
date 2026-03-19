import SwiftUI
import WebKit

struct WebViewContainer {
    let webView: WKWebView
}

#if os(macOS)
extension WebViewContainer: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
        // Unregister native macOS drag types so HTML5 DnD events
        // (dragstart/dragover/drop) reach the web content unintercepted.
        // Without this, macOS intercepts drag gestures for native file drops,
        // preventing in-page DnD (e.g., Projection Explorer chip reorder).
        webView.unregisterDraggedTypes()
        return webView
    }
    func updateNSView(_ webView: WKWebView, context: Context) {}
}
#else
extension WebViewContainer: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ webView: WKWebView, context: Context) {}
}
#endif
