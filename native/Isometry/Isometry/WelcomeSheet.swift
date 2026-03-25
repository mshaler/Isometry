import SwiftUI

// ---------------------------------------------------------------------------
// WelcomeSheet — First-run welcome experience (WLCM-01)
// ---------------------------------------------------------------------------
// Presented on first launch via ContentView when hasSeenWelcome == false.
// .interactiveDismissDisabled(true) prevents swipe-to-dismiss.
// VoiceOver: app icon labeled, title marked as header.
//
// Layout (per 121-UI-SPEC.md):
//   48pt top inset → AppIcon 80×80 → 16pt gap → title+tagline →
//   24pt gap → Load Sample Data (borderedProminent) →
//   12pt gap → Start Empty (bordered) → 48pt bottom inset

struct WelcomeSheet: View {
    let onLoadSampleData: () -> Void
    let onStartEmpty: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Spacer()
                .frame(height: 48)  // 2xl top inset

            // App icon — 80×80pt with rounded rect clip
            appIconView
                .accessibilityLabel("Isometry app icon")

            Spacer()
                .frame(height: 16)  // md gap

            // App name
            Text("Isometry")
                .font(.title2)
                .fontWeight(.semibold)
                .accessibilityAddTraits(.isHeader)

            // Tagline
            Text("See everything, connected.")
                .font(.headline)
                .foregroundStyle(.secondary)

            Spacer()
                .frame(height: 24)  // lg gap

            // Primary CTA — borderedProminent, accent color, full width
            Button {
                onLoadSampleData()
            } label: {
                Text("Load Sample Data")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Spacer()
                .frame(height: 12)  // sm gap between buttons

            // Secondary CTA — bordered, full width
            Button {
                onStartEmpty()
            } label: {
                Text("Start Empty")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)

            Spacer()
                .frame(height: 48)  // 2xl bottom inset
        }
        .padding(.horizontal, 32)
        .interactiveDismissDisabled(true)  // No swipe-to-dismiss on first launch
    }

    // MARK: - App Icon

    /// Renders the app icon from the asset bundle.
    /// On iOS: UIImage(named:) can resolve AppIcon from the asset catalog.
    /// Falls back to an SF Symbol if the image is unavailable.
    @ViewBuilder
    private var appIconView: some View {
        #if os(iOS)
        if let uiImage = UIImage(named: "AppIcon") {
            Image(uiImage: uiImage)
                .resizable()
                .frame(width: 80, height: 80)
                .clipShape(RoundedRectangle(cornerRadius: 18))
        } else {
            fallbackIcon
        }
        #else
        if let nsImage = NSImage(named: "AppIcon") {
            Image(nsImage: nsImage)
                .resizable()
                .frame(width: 80, height: 80)
                .clipShape(RoundedRectangle(cornerRadius: 18))
        } else {
            fallbackIcon
        }
        #endif
    }

    private var fallbackIcon: some View {
        Image(systemName: "app.fill")
            .resizable()
            .frame(width: 80, height: 80)
            .foregroundStyle(Color.accentColor)
    }
}

// MARK: - Preview

#if DEBUG
#Preview {
    WelcomeSheet(
        onLoadSampleData: {},
        onStartEmpty: {}
    )
}
#endif
