import SwiftUI

/// Native overlay menu for command selection and navigation
public struct SlashCommandMenu: View {
    @ObservedObject var commandManager: SlashCommandManager
    let onSelectCommand: (SlashCommand) -> Void

    @Environment(\.colorScheme) private var colorScheme

    public init(
        commandManager: SlashCommandManager,
        onSelectCommand: @escaping (SlashCommand) -> Void
    ) {
        self.commandManager = commandManager
        self.onSelectCommand = onSelectCommand
    }

    public var body: some View {
        if commandManager.isMenuVisible {
            menuContent
                .position(commandManager.menuPosition)
                .animation(.easeInOut(duration: 0.2), value: commandManager.isMenuVisible)
        }
    }

    // MARK: - Menu Content

    private var menuContent: some View {
        VStack(spacing: 0) {
            // Header
            menuHeader

            // Command list
            ScrollView {
                LazyVStack(spacing: 2) {
                    if commandManager.filteredCommands.isEmpty {
                        emptyStateView
                    } else {
                        ForEach(Array(commandManager.filteredCommands.enumerated()), id: \.element.id) { index, command in
                            CommandRow(
                                command: command,
                                isSelected: index == commandManager.selectedIndex,
                                onTap: {
                                    commandManager.selectedIndex = index
                                    onSelectCommand(command)
                                }
                            )
                        }
                    }
                }
                .padding(.vertical, 4)
            }
            .frame(maxHeight: 300)

            // Footer
            menuFooter
        }
        .frame(width: 320)
        .background(menuBackgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(borderColor, lineWidth: 0.5)
        }
    }

    // MARK: - Header

    private var menuHeader: some View {
        HStack {
            HStack(spacing: 6) {
                Image(systemName: "command.circle.fill")
                    .font(.subheadline)
                    .foregroundStyle(Color.blue)

                Text("Commands")
                    .font(.subheadline)
                    .fontWeight(.semibold)

                if !commandManager.currentQuery.isEmpty {
                    Text("/ \(commandManager.currentQuery)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fontFamily(.monospaced)
                }
            }

            Spacer()

            Text("\(commandManager.filteredCommands.count)")
                .font(.caption)
                .fontWeight(.medium)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.secondary.opacity(0.1))
                .foregroundStyle(.secondary)
                .clipShape(Capsule())
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.background.secondary)
        .overlay(alignment: .bottom) {
            Divider()
        }
    }

    // MARK: - Footer

    private var menuFooter: some View {
        HStack(spacing: 16) {
            HStack(spacing: 4) {
                Image(systemName: "arrow.up.arrow.down")
                    .font(.caption2)

                Text("Navigate")
                    .font(.caption)
            }
            .foregroundStyle(.secondary)

            HStack(spacing: 4) {
                Image(systemName: "return")
                    .font(.caption2)

                Text("Select")
                    .font(.caption)
            }
            .foregroundStyle(.secondary)

            HStack(spacing: 4) {
                Image(systemName: "escape")
                    .font(.caption2)

                Text("Close")
                    .font(.caption)
            }
            .foregroundStyle(.secondary)

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(.background.tertiary)
        .overlay(alignment: .top) {
            Divider()
        }
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.title2)
                .foregroundStyle(.tertiary)

            Text("No commands found")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if !commandManager.currentQuery.isEmpty {
                Text("Try a different search term")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 20)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Computed Properties

    private var menuBackgroundColor: Color {
        colorScheme == .dark ? Color.black.opacity(0.9) : Color.white.opacity(0.95)
    }

    private var borderColor: Color {
        colorScheme == .dark ? Color.white.opacity(0.1) : Color.black.opacity(0.1)
    }
}

// MARK: - Command Row

private struct CommandRow: View {
    let command: SlashCommand
    let isSelected: Bool
    let onTap: () -> Void

    private var categoryColor: Color {
        switch command.category.color {
        case "blue": return .blue
        case "purple": return .purple
        case "green": return .green
        default: return .gray
        }
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Category icon
                Image(systemName: command.category.icon)
                    .font(.subheadline)
                    .foregroundStyle(categoryColor)
                    .frame(width: 20, height: 20)

                // Command info
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text(command.label)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundStyle(.primary)

                        Spacer()

                        if let shortcut = command.shortcut {
                            Text("/" + shortcut)
                                .font(.caption)
                                .fontFamily(.monospaced)
                                .fontWeight(.medium)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(categoryColor.opacity(0.1))
                                .foregroundStyle(categoryColor)
                                .clipShape(Capsule())
                        }
                    }

                    Text(command.description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }

                // Selection indicator
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.subheadline)
                        .foregroundStyle(Color.blue)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(isSelected ? selectionBackgroundColor : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(command.label) command")
        .accessibilityHint(command.description)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var selectionBackgroundColor: Color {
        Color.blue.opacity(0.1)
    }
}

// MARK: - Grouped Command Menu

/// Alternative menu layout with category grouping
public struct GroupedSlashCommandMenu: View {
    @ObservedObject var commandManager: SlashCommandManager
    let onSelectCommand: (SlashCommand) -> Void

    @Environment(\.colorScheme) private var colorScheme

    public init(
        commandManager: SlashCommandManager,
        onSelectCommand: @escaping (SlashCommand) -> Void
    ) {
        self.commandManager = commandManager
        self.onSelectCommand = onSelectCommand
    }

    public var body: some View {
        if commandManager.isMenuVisible {
            VStack(spacing: 0) {
                // Header
                menuHeader

                // Grouped command list
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(CommandCategory.allCases, id: \.self) { category in
                            let commands = commandManager.commandsByCategory[category] ?? []
                            if !commands.isEmpty {
                                CategorySection(
                                    category: category,
                                    commands: commands,
                                    selectedIndex: commandManager.selectedIndex,
                                    onSelectCommand: onSelectCommand
                                )
                            }
                        }
                    }
                }
                .frame(maxHeight: 400)
            }
            .frame(width: 350)
            .background(menuBackgroundColor)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.2), radius: 8, x: 0, y: 4)
            .position(commandManager.menuPosition)
            .animation(.easeInOut(duration: 0.2), value: commandManager.isMenuVisible)
        }
    }

    private var menuHeader: some View {
        HStack {
            Image(systemName: "command.circle.fill")
                .foregroundStyle(Color.blue)

            Text("Commands")
                .fontWeight(.semibold)

            if !commandManager.currentQuery.isEmpty {
                Text("/ \(commandManager.currentQuery)")
                    .foregroundStyle(.secondary)
                    .fontFamily(.monospaced)
            }

            Spacer()

            Text("\(commandManager.filteredCommands.count)")
                .font(.caption)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(.secondary.opacity(0.1))
                .foregroundStyle(.secondary)
                .clipShape(Capsule())
        }
        .font(.subheadline)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.background.secondary)
    }

    private var menuBackgroundColor: Color {
        colorScheme == .dark ? Color.black.opacity(0.9) : Color.white.opacity(0.95)
    }
}

// MARK: - Category Section

private struct CategorySection: View {
    let category: CommandCategory
    let commands: [SlashCommand]
    let selectedIndex: Int
    let onSelectCommand: (SlashCommand) -> Void

    private var categoryColor: Color {
        switch category.color {
        case "blue": return .blue
        case "purple": return .purple
        case "green": return .green
        default: return .gray
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Category header
            HStack(spacing: 8) {
                Image(systemName: category.icon)
                    .font(.caption)
                    .foregroundStyle(categoryColor)

                Text(category.displayName)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .textCase(.uppercase)
                    .foregroundStyle(categoryColor)

                Rectangle()
                    .fill(categoryColor.opacity(0.3))
                    .frame(height: 1)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)

            // Commands in category
            ForEach(commands, id: \.id) { command in
                let isSelected = commands.firstIndex(of: command) == selectedIndex
                CommandRow(
                    command: command,
                    isSelected: isSelected,
                    onTap: {
                        onSelectCommand(command)
                    }
                )
            }
        }
    }
}

// MARK: - Compact Command Menu

/// Minimal command menu for limited space
public struct CompactSlashCommandMenu: View {
    @ObservedObject var commandManager: SlashCommandManager
    let onSelectCommand: (SlashCommand) -> Void

    public init(
        commandManager: SlashCommandManager,
        onSelectCommand: @escaping (SlashCommand) -> Void
    ) {
        self.commandManager = commandManager
        self.onSelectCommand = onSelectCommand
    }

    public var body: some View {
        if commandManager.isMenuVisible {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(commandManager.filteredCommands.prefix(8).enumerated()), id: \.element.id) { index, command in
                        CompactCommandButton(
                            command: command,
                            isSelected: index == commandManager.selectedIndex,
                            onTap: {
                                commandManager.selectedIndex = index
                                onSelectCommand(command)
                            }
                        )
                    }

                    if commandManager.filteredCommands.count > 8 {
                        Text("+\(commandManager.filteredCommands.count - 8)")
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(.secondary.opacity(0.1))
                            .foregroundStyle(.secondary)
                            .clipShape(Capsule())
                    }
                }
                .padding(.horizontal, 16)
            }
            .frame(height: 40)
            .background(.background.secondary)
            .clipShape(Capsule())
            .position(commandManager.menuPosition)
            .animation(.easeInOut(duration: 0.2), value: commandManager.isMenuVisible)
        }
    }
}

private struct CompactCommandButton: View {
    let command: SlashCommand
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 4) {
                Image(systemName: command.category.icon)
                    .font(.caption2)

                if let shortcut = command.shortcut {
                    Text(shortcut)
                        .font(.caption)
                        .fontWeight(.medium)
                } else {
                    Text(command.label)
                        .font(.caption)
                        .fontWeight(.medium)
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(isSelected ? Color.blue : .clear)
            .foregroundStyle(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview

#Preview {
    let commandManager = SlashCommandManager()
    commandManager.currentQuery = "mee"

    return VStack(spacing: 20) {
        SlashCommandMenu(commandManager: commandManager) { command in
            print("Selected command: \(command.label)")
        }

        CompactSlashCommandMenu(commandManager: commandManager) { command in
            print("Selected command: \(command.label)")
        }
    }
    .onAppear {
        commandManager.showMenu(at: CGPoint(x: 200, y: 100))
    }
}