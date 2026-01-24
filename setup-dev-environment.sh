#!/bin/bash
# =============================================================================
# Development Environment Setup Script
# Created: 2026-01-22
# =============================================================================

set -e  # Exit on error

echo "=================================="
echo "Development Environment Setup"
echo "=================================="
echo ""

# =============================================================================
# Task 1: Check and Remove MacPorts
# =============================================================================

echo "📦 Task 1: Checking MacPorts..."
echo ""

if command -v port &> /dev/null; then
    echo "⚠️  MacPorts is installed at: $(which port)"
    echo ""

    # Try to check installed packages, but handle platform mismatch
    echo "Checking installed packages..."
    PORT_OUTPUT=$(port installed 2>&1 | head -20)

    if echo "$PORT_OUTPUT" | grep -q "platform mismatch\|Failed to initialize"; then
        echo "❌ MacPorts is BROKEN (OS platform mismatch)"
        echo "   Your macOS was upgraded but MacPorts wasn't migrated."
        echo "   MacPorts needs to be removed and reinstalled if you need it."
        echo ""
        MACPORTS_BROKEN=true
    else
        echo "$PORT_OUTPUT"
        echo ""
    fi

    read -p "Do you want to remove MacPorts? (y/n) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Removing MacPorts..."

        # Skip uninstall if MacPorts is broken
        if [ "$MACPORTS_BROKEN" != "true" ]; then
            # Uninstall all ports first
            echo "Uninstalling all MacPorts packages..."
            sudo port -f uninstall installed || true
        else
            echo "Skipping package uninstall (MacPorts is broken)..."
        fi

        # Remove MacPorts itself
        echo "Removing MacPorts system..."
        sudo rm -rf /opt/local
        sudo rm -rf /Applications/DarwinPorts
        sudo rm -rf /Applications/MacPorts
        sudo rm -rf /Library/LaunchDaemons/org.macports.*
        sudo rm -rf /Library/Receipts/DarwinPorts*.pkg
        sudo rm -rf /Library/Receipts/MacPorts*.pkg
        sudo rm -rf /Library/StartupItems/DarwinPortsStartup
        sudo rm -rf /Library/Tcl/darwinports1.0
        sudo rm -rf /Library/Tcl/macports1.0
        sudo rm -rf ~/.macports

        echo "✅ MacPorts removed"

        # Clean up .zprofile
        echo "Cleaning MacPorts from .zprofile..."
        if [ -f ~/.zprofile ]; then
            # Backup first
            cp ~/.zprofile ~/.zprofile.backup-pre-macports-removal

            # Remove MacPorts lines
            sed -i.bak '/MacPorts Installer addition/,/Finished adapting.*MacPorts/d' ~/.zprofile
            sed -i.bak '/\/opt\/local/d' ~/.zprofile

            echo "✅ Cleaned .zprofile"
        fi
    else
        echo "⏭️  Skipping MacPorts removal"
        echo "⚠️  Note: MacPorts PATH conflicts with Homebrew"
        echo "   Consider commenting out MacPorts lines in ~/.zprofile"
    fi
else
    echo "✅ MacPorts not found (good!)"
fi

echo ""

# =============================================================================
# Task 2: Install Cleaned .zshrc
# =============================================================================

echo "📝 Task 2: Installing cleaned .zshrc..."
echo ""

if [ ! -f .zshrc.cleaned ]; then
    echo "❌ Error: .zshrc.cleaned not found in current directory"
    echo "   Please run this script from ~/Developer/Projects/Isometry"
    exit 1
fi

echo "Backing up current .zshrc..."
if [ -f ~/.zshrc ]; then
    cp ~/.zshrc ~/.zshrc.backup-before-install
    echo "✅ Backup created: ~/.zshrc.backup-before-install"
fi

echo "Installing cleaned .zshrc..."
cp .zshrc.cleaned ~/.zshrc
echo "✅ New .zshrc installed"
echo ""

# =============================================================================
# Task 3: Set Up SSH Keys
# =============================================================================

echo "🔐 Task 3: Setting up SSH keys for GitHub..."
echo ""

if [ -f ~/.ssh/id_ed25519 ]; then
    echo "⚠️  SSH key already exists at ~/.ssh/id_ed25519"
    read -p "Do you want to create a new key? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "⏭️  Using existing SSH key"
        SSH_KEY_EXISTS=true
    fi
fi

if [ "$SSH_KEY_EXISTS" != "true" ]; then
    echo "Generating new SSH key..."
    ssh-keygen -t ed25519 -C "mshaler@gmail.com" -f ~/.ssh/id_ed25519

    echo ""
    echo "✅ SSH key generated"
fi

# Start SSH agent and add key
echo ""
echo "Starting SSH agent and adding key..."
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

echo ""
echo "✅ SSH key added to agent"
echo ""

# Copy public key to clipboard
echo "📋 Copying public key to clipboard..."
pbcopy < ~/.ssh/id_ed25519.pub
echo "✅ Public key copied to clipboard!"
echo ""

# Display the key
echo "Your public key (also in clipboard):"
echo "-----------------------------------"
cat ~/.ssh/id_ed25519.pub
echo "-----------------------------------"
echo ""

echo "🌐 Next steps:"
echo "   1. Open: https://github.com/settings/keys"
echo "   2. Click 'New SSH key'"
echo "   3. Title: 'MacBook Pro' (or whatever you want)"
echo "   4. Key type: 'Authentication Key'"
echo "   5. Paste your key (already in clipboard!)"
echo "   6. Click 'Add SSH key'"
echo ""

read -p "Press ENTER after you've added the key to GitHub..." -r
echo ""

# Test SSH connection
echo "🧪 Testing SSH connection to GitHub..."
ssh -T git@github.com || true
echo ""

# =============================================================================
# Task 4: Configure Git to Use SSH
# =============================================================================

echo "🔧 Task 4: Configuring Git to use SSH..."
echo ""

# Check current remote
if [ -d .git ]; then
    echo "Current Isometry repo remote:"
    git remote -v
    echo ""

    CURRENT_URL=$(git remote get-url origin 2>/dev/null || echo "")

    if [[ $CURRENT_URL == https://* ]]; then
        # Extract owner/repo from HTTPS URL
        REPO_PATH=$(echo "$CURRENT_URL" | sed -E 's|https://github.com/([^/]+/[^/]+)(\.git)?|\1|')
        SSH_URL="git@github.com:${REPO_PATH}.git"

        echo "Converting to SSH..."
        git remote set-url origin "$SSH_URL"
        echo "✅ Remote URL updated to: $SSH_URL"
    elif [[ $CURRENT_URL == git@github.com:* ]]; then
        echo "✅ Already using SSH"
    else
        echo "⚠️  Unknown remote URL format: $CURRENT_URL"
    fi

    echo ""
    echo "Updated remote:"
    git remote -v
else
    echo "ℹ️  Not in a git repository"
fi

echo ""

# Configure SSH to always use this key for GitHub
echo "Configuring SSH for GitHub..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh

if ! grep -q "github.com" ~/.ssh/config 2>/dev/null; then
    cat >> ~/.ssh/config << 'SSH_CONFIG'

# GitHub SSH Configuration
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519
    AddKeysToAgent yes
SSH_CONFIG

    chmod 600 ~/.ssh/config
    echo "✅ SSH config updated"
else
    echo "✅ SSH config already has GitHub entry"
fi

echo ""

# =============================================================================
# Task 5: Test Everything
# =============================================================================

echo "=================================="
echo "🧪 Task 5: Testing Configuration"
echo "=================================="
echo ""

echo "1️⃣ Checking shell configuration..."
echo "Default shell: $SHELL"

if [[ "$SHELL" != *"zsh"* ]]; then
    echo "⚠️  Your default shell is NOT zsh!"
    echo "   You should change it to zsh for the .zshrc to work."
    echo "   Run: chsh -s /bin/zsh"
    echo ""
fi

# Test tools without sourcing .zshrc (since we're in bash)
echo "Testing tools (will need to restart shell for .zshrc changes)..."
if command -v node &> /dev/null; then
    echo "Node.js: $(node --version)"
    echo "npm: $(npm --version)"
else
    echo "⚠️  Node.js not found in current PATH (restart shell after script completes)"
fi

if command -v nvm &> /dev/null; then
    echo "nvm: $(nvm --version)"
else
    echo "⚠️  nvm not loaded (restart shell to load from .zshrc)"
fi
echo ""

echo "2️⃣ Testing PATH..."
echo "First 10 PATH entries:"
echo "$PATH" | tr ':' '\n' | head -10 | nl
echo ""

echo "3️⃣ Testing Homebrew..."
which brew
brew --version | head -1
echo ""

echo "4️⃣ Testing Git..."
git --version
echo "Git user: $(git config user.name) <$(git config user.email)>"
echo ""

echo "5️⃣ Testing GitHub SSH..."
ssh -T git@github.com 2>&1 | grep -i "successfully authenticated" && echo "✅ GitHub SSH working!" || echo "⚠️  GitHub SSH not working - check key was added"
echo ""

# =============================================================================
# Summary
# =============================================================================

echo "=================================="
echo "✅ Setup Complete!"
echo "=================================="
echo ""
echo "What was done:"
echo "  ✅ MacPorts checked/removed (if requested)"
echo "  ✅ Cleaned .zshrc installed"
echo "  ✅ SSH keys generated and configured"
echo "  ✅ Git configured to use SSH"
echo "  ✅ All configurations tested"
echo ""
echo "🚨 IMPORTANT - Next steps:"
if [[ "$SHELL" != *"zsh"* ]]; then
    echo "  1. ⚠️  Change default shell to zsh: chsh -s /bin/zsh"
    echo "  2. Close and reopen your terminal"
else
    echo "  1. Restart your terminal (or run: exec zsh)"
fi
echo "  2. Verify nvm works: nvm --version"
echo "  3. Try pushing to GitHub to test SSH"
echo ""
echo "📁 Backups (if you need to revert):"
echo "  - ~/.zshrc.backup-before-install"
echo "  - ~/.zshrc.backup-2026-01-22"
echo ""
echo "🎉 Your development environment is ready!"
echo ""
