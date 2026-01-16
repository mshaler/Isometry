#!/bin/bash

# ============================================================================
# Launch Isometry in VS Code with Claude Code
# ============================================================================
# Opens VS Code in the Isometry project directory and configures workspace
# settings for optimal Claude Code integration.
#
# Usage:
#   ./launch-vscode.sh [project-path]
#
# Default: ~/Developer/Projects/Isometry
# ============================================================================

set -e

DEFAULT_PROJECT_PATH="$HOME/Developer/Projects/Isometry"
PROJECT_PATH="${1:-$DEFAULT_PROJECT_PATH}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}  Launching Isometry in VS Code${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check if project exists
if [ ! -d "$PROJECT_PATH" ]; then
    echo -e "${RED}Error: Project not found at $PROJECT_PATH${NC}"
    echo "Run setup-isometry.sh first to create the project."
    exit 1
fi

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo -e "${RED}Error: VS Code CLI not found${NC}"
    echo ""
    echo "Install the 'code' command:"
    echo "  1. Open VS Code"
    echo "  2. Cmd+Shift+P → 'Shell Command: Install code command in PATH'"
    exit 1
fi

echo -e "${YELLOW}Creating VS Code workspace settings...${NC}"

# Create .vscode directory
mkdir -p "$PROJECT_PATH/.vscode"

# Create settings.json
cat > "$PROJECT_PATH/.vscode/settings.json" << 'SETTINGS_EOF'
{
  // Editor
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "editor.rulers": [100],
  
  // TypeScript
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  
  // Files
  "files.exclude": {
    "node_modules": true,
    "dist": true,
    ".git": true
  },
  "files.associations": {
    "*.css": "tailwindcss"
  },
  
  // Search
  "search.exclude": {
    "node_modules": true,
    "dist": true,
    "*.lock": true
  },
  
  // Tailwind CSS
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "tailwindCSS.experimental.classRegex": [
    ["className\\s*=\\s*['\"]([^'\"]*)['\"]", "([^'\"\\s]*)"]
  ],
  
  // Terminal - Claude Code works best from integrated terminal
  "terminal.integrated.defaultProfile.osx": "zsh",
  "terminal.integrated.cwd": "${workspaceFolder}",
  
  // ESLint
  "eslint.validate": ["javascript", "typescript", "typescriptreact"],
  
  // Path aliases
  "path-intellisense.mappings": {
    "@": "${workspaceFolder}/src"
  }
}
SETTINGS_EOF

echo "  ✓ Created .vscode/settings.json"

# Create extensions.json (recommended extensions)
cat > "$PROJECT_PATH/.vscode/extensions.json" << 'EXT_EOF'
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "christian-kohler.path-intellisense",
    "formulahendry.auto-rename-tag",
    "streetsidesoftware.code-spell-checker"
  ]
}
EXT_EOF

echo "  ✓ Created .vscode/extensions.json"

# Create launch.json for debugging
cat > "$PROJECT_PATH/.vscode/launch.json" << 'LAUNCH_EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src"
    }
  ]
}
EXT_EOF

echo "  ✓ Created .vscode/launch.json"

# Create tasks.json
cat > "$PROJECT_PATH/.vscode/tasks.json" << 'TASKS_EOF'
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev",
      "type": "npm",
      "script": "dev",
      "problemMatcher": [],
      "isBackground": true,
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "build",
      "type": "npm",
      "script": "build",
      "problemMatcher": ["$tsc"]
    },
    {
      "label": "test",
      "type": "npm",
      "script": "test",
      "problemMatcher": []
    },
    {
      "label": "Claude Code",
      "type": "shell",
      "command": "claude",
      "options": {
        "cwd": "${workspaceFolder}"
      },
      "presentation": {
        "reveal": "always",
        "panel": "dedicated",
        "focus": true
      },
      "problemMatcher": []
    }
  ]
}
TASKS_EOF

echo "  ✓ Created .vscode/tasks.json"

echo ""
echo -e "${YELLOW}Opening VS Code...${NC}"

# Open VS Code in the project directory
code "$PROJECT_PATH"

echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}  VS Code Launched!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "Project opened: ${BLUE}$PROJECT_PATH${NC}"
echo ""
echo -e "${YELLOW}To start Claude Code:${NC}"
echo ""
echo "  Option 1: Open integrated terminal (Ctrl+\`) and run:"
echo -e "           ${BLUE}claude${NC}"
echo ""
echo "  Option 2: Run task 'Claude Code':"
echo -e "           ${BLUE}Cmd+Shift+P → Tasks: Run Task → Claude Code${NC}"
echo ""
echo -e "${YELLOW}First prompt for Claude Code:${NC}"
echo -e "${BLUE}\"Read design/isometry-ui-handoff/FIGMA-HANDOFF.md and start Phase 1\"${NC}"
echo ""
echo -e "${YELLOW}Recommended: Install suggested extensions${NC}"
echo -e "${BLUE}Cmd+Shift+P → Extensions: Show Recommended Extensions${NC}"
echo ""
