import SwiftUI

/// Shell component for the notebook workflow - placeholder for terminal integration
/// This will host the native terminal interface with App Sandbox security constraints
public struct NotebookShellView: View {

    public init() {}

    public var body: some View {
        VStack(spacing: 12) {
            // Header
            HStack {
                Image(systemName: "terminal")
                    .foregroundStyle(.green)
                Text("Shell Component")
                    .font(.headline)
                    .foregroundStyle(.primary)
                Spacer()
                Image(systemName: "chevron.right.circle")
                    .foregroundStyle(.tertiary)
                    .font(.caption)
            }

            Divider()

            // Placeholder content with terminal theme
            VStack(spacing: 16) {
                Text("Terminal")
                    .font(.title2)
                    .foregroundStyle(.green)
                    .fontDesign(.monospaced)

                Text("This component will host the App Sandbox-compliant terminal with secure process execution and Claude Code API integration.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                // Security integration points
                VStack(alignment: .leading, spacing: 8) {
                    Text("Security Features:")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fontWeight(.medium)

                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: "shield.checkered")
                                .font(.caption2)
                                .foregroundStyle(.blue)
                            Text("App Sandbox NSTask/Process execution")
                                .font(.caption)
                        }

                        HStack {
                            Image(systemName: "link")
                                .font(.caption2)
                                .foregroundStyle(.purple)
                            Text("Claude Code API native integration")
                                .font(.caption)
                        }

                        HStack {
                            Image(systemName: "lock.shield")
                                .font(.caption2)
                                .foregroundStyle(.orange)
                            Text("Secure command history and context")
                                .font(.caption)
                        }

                        HStack {
                            Image(systemName: "checkmark.seal")
                                .font(.caption2)
                                .foregroundStyle(.green)
                            Text("App Store compliance validation")
                                .font(.caption)
                        }
                    }
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                }
                .padding(.top)

                // Terminal preview
                VStack(alignment: .leading, spacing: 4) {
                    Text("$ preview")
                        .font(.caption)
                        .fontDesign(.monospaced)
                        .foregroundStyle(.green)

                    Text("isometry@native:~/notebook$ _")
                        .font(.caption)
                        .fontDesign(.monospaced)
                        .foregroundStyle(.secondary)
                }
                .padding()
                .background(Color.black.opacity(0.9))
                .cornerRadius(6)
                .padding(.top)
            }

            Spacer()
        }
        .padding()
        .background {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.systemBackground))
                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(.separator), lineWidth: 0.5)
        }
    }
}

// MARK: - Preview

#Preview {
    NotebookShellView()
        .padding()
        .background(Color(.systemGroupedBackground))
}