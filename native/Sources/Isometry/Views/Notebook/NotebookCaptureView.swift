import SwiftUI

/// Capture component for the notebook workflow - placeholder for markdown editor integration
/// This will host the markdown editing interface with live preview capabilities
public struct NotebookCaptureView: View {

    public init() {}

    public var body: some View {
        VStack(spacing: 12) {
            // Header
            HStack {
                Image(systemName: "doc.text")
                    .foregroundStyle(.secondary)
                Text("Capture Component")
                    .font(.headline)
                    .foregroundStyle(.primary)
                Spacer()
                Image(systemName: "chevron.right.circle")
                    .foregroundStyle(.tertiary)
                    .font(.caption)
            }

            Divider()

            // Placeholder content
            VStack(spacing: 16) {
                Text("Markdown Editor")
                    .font(.title2)
                    .foregroundStyle(.secondary)

                Text("This component will host the native markdown editor with live preview, property management, and template integration.")
                    .font(.body)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                // Preview integration points
                VStack(alignment: .leading, spacing: 8) {
                    Text("Integration Points:")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fontWeight(.medium)

                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: "square.and.pencil")
                                .font(.caption2)
                                .foregroundStyle(.blue)
                            Text("NSTextView/UITextView markdown editor")
                                .font(.caption)
                        }

                        HStack {
                            Image(systemName: "eye")
                                .font(.caption2)
                                .foregroundStyle(.green)
                            Text("Live preview rendering")
                                .font(.caption)
                        }

                        HStack {
                            Image(systemName: "slider.horizontal.3")
                                .font(.caption2)
                                .foregroundStyle(.purple)
                            Text("Properties panel with CloudKit")
                                .font(.caption)
                        }

                        HStack {
                            Image(systemName: "command")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                            Text("Slash command system")
                                .font(.caption)
                        }
                    }
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                }
                .padding(.top)
            }

            Spacer()
        }
        .padding()
        .background {
            RoundedRectangle(cornerRadius: 8)
                .fill(.background)
                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(.separator, lineWidth: 0.5)
        }
    }
}

// MARK: - Preview

#Preview {
    NotebookCaptureView()
        .padding()
        .background(.background.secondary)
}