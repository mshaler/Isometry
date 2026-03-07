import SwiftUI

// ---------------------------------------------------------------------------
// SyncStatusView -- Sync Status Toolbar Icon (SYNC-09)
// ---------------------------------------------------------------------------
// SwiftUI toolbar view showing 3-state sync status:
//   - idle: cloud checkmark (secondary color)
//   - syncing: animated cloud arrows (blue)
//   - error: cloud exclamation (red) with tap-to-show error popover
//
// Driven by SyncStatusPublisher (ObservableObject) updated by SyncManager.
// Native SwiftUI chrome per CONTEXT.md locked decision -- not JS-rendered.

struct SyncStatusView: View {
    @ObservedObject var statusPublisher: SyncStatusPublisher
    @State private var showingErrorPopover = false

    var body: some View {
        Button {
            if case .error = statusPublisher.status {
                showingErrorPopover = true
            }
        } label: {
            Group {
                switch statusPublisher.status {
                case .idle:
                    Image(systemName: "checkmark.icloud")
                        .foregroundStyle(.secondary)
                case .syncing:
                    Image(systemName: "arrow.triangle.2.circlepath.icloud")
                        .foregroundStyle(.blue)
                        .symbolEffect(.pulse, options: .repeating)
                case .error:
                    Image(systemName: "exclamationmark.icloud")
                        .foregroundStyle(.red)
                }
            }
        }
        .buttonStyle(.plain)
        .popover(isPresented: $showingErrorPopover) {
            if case .error(let message) = statusPublisher.status {
                Text(message)
                    .font(.caption)
                    .padding()
                    .frame(maxWidth: 250)
            }
        }
    }
}
