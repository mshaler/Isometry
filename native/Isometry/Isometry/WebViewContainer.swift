import SwiftUI
import WebKit

struct WebViewContainer {
    let webView: WKWebView
}

#if os(macOS)

// ---------------------------------------------------------------------------
// DnD-safe WKWebView subclass for macOS
// ---------------------------------------------------------------------------
// WKWebView registers for native macOS drag types (NSFilenamesPboardType etc.)
// which intercepts HTML5 DnD events (dragstart/dragover/drop) before they reach
// web content. Calling unregisterDraggedTypes() in makeNSView is insufficient
// because WKWebView re-registers types when it loads content.
//
// This subclass overrides the NSDraggingDestination methods to reject all native
// drag operations, forcing drag events through to the HTML5 DnD layer.
// ---------------------------------------------------------------------------
class IsometryWebView: WKWebView {
    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        return []  // Reject native drag — let HTML5 DnD handle it
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        return []  // Reject native drag — let HTML5 DnD handle it
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        return false  // Reject native drop — let HTML5 DnD handle it
    }
}

extension WebViewContainer: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
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
