import SwiftUI

// ---------------------------------------------------------------------------
// PermissionSheetView — Inline SwiftUI Permission Sheet
// ---------------------------------------------------------------------------
// Explains WHY access is needed with trust-building copy before requesting
// system permission. Shown as a sheet from ContentView when permission
// is not yet determined.
//
// NOTE: In Phase 33, this view is built but NOT wired to real permission
// flows. MockAdapter always returns .granted. Real wiring happens in
// Phase 34+35.

struct PermissionSheetView: View {
    let sourceType: String
    let onGranted: () -> Void
    let onOpenSettings: () -> Void
    @Environment(\.dismiss) private var dismiss

    private var sourceName: String {
        switch sourceType {
        case "native_reminders": return "Reminders"
        case "native_calendar":  return "Calendar"
        case "native_notes":     return "Notes"
        default:                 return "Source"
        }
    }

    private var sourceIcon: String {
        switch sourceType {
        case "native_reminders": return "list.bullet"
        case "native_calendar":  return "calendar"
        case "native_notes":     return "note.text"
        default:                 return "questionmark.circle"
        }
    }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: sourceIcon)
                .font(.system(size: 48))
                .foregroundStyle(.tint)

            Text("Import from \(sourceName)")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Isometry will read your \(sourceName.lowercased()) to create cards you can organize and explore. Nothing is modified or deleted.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            VStack(spacing: 12) {
                Button {
                    dismiss()
                    onGranted()
                } label: {
                    Text("Grant Access")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                Button {
                    dismiss()
                    onOpenSettings()
                } label: {
                    Text("Open Settings")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)

                Button("Cancel", role: .cancel) {
                    dismiss()
                }
                .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 32)

            Spacer()
        }
        .padding()
    }
}
