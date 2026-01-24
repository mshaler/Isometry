# Quick Setup Guide - Run This Now!

## 🚀 One-Command Setup

I've created an automated script that will handle everything. Just run these commands in your terminal:

```bash
# Navigate to the project
cd ~/Developer/Projects/Isometry

# Make the script executable
chmod +x setup-dev-environment.sh

# Run the setup script
./setup-dev-environment.sh
```

## 📋 What the Script Does

The script will guide you through:

### 1. **MacPorts Check & Removal** (Interactive)
- Detects broken MacPorts (platform mismatch error)
- Safely removes MacPorts directories
- Cleans up MacPorts from `.zprofile`
- **Recommendation: Remove it** (it's broken and conflicts with Homebrew)
- See [MACPORTS-FIX.md](MACPORTS-FIX.md) for details

### 2. **Install Cleaned .zshrc** (Automatic)
- Backs up your current `.zshrc`
- Installs the cleaned configuration
- Removes duplicate initializations
- Fixes syntax errors

### 3. **SSH Key Setup** (Interactive)
- Generates ED25519 SSH key
- Adds it to SSH agent
- Copies public key to clipboard
- Guides you through adding to GitHub
- Tests the connection

### 4. **Git Configuration** (Automatic)
- Configures SSH for GitHub
- Converts Isometry repo to use SSH
- Sets up SSH config file

### 5. **Testing** (Automatic)
- Tests shell configuration
- Verifies Node.js/npm/nvm
- Checks PATH
- Tests Homebrew
- Verifies Git setup
- Tests GitHub SSH connection

## ⚡ Expected Prompts

You'll be asked:

1. **"Do you want to remove MacPorts?"**
   - Answer: `y` if you don't use it (recommended)
   - Answer: `n` if you need it

2. **"Enter passphrase for SSH key"** (appears twice)
   - You can press Enter for no passphrase (easier)
   - Or enter a passphrase for better security

3. **"Press ENTER after you've added the key to GitHub"**
   - Go to https://github.com/settings/keys
   - Click "New SSH key"
   - Paste (already in clipboard!)
   - Click "Add SSH key"
   - Come back and press Enter

## 🔍 What Gets Created/Modified

### Created:
- `~/.ssh/id_ed25519` - Your private SSH key
- `~/.ssh/id_ed25519.pub` - Your public SSH key
- `~/.ssh/config` - SSH configuration for GitHub

### Backed Up:
- `~/.zshrc.backup-before-install` - Latest backup
- `~/.zshrc.backup-2026-01-22` - Earlier backup
- `~/.zprofile.backup-pre-macports-removal` - If MacPorts removed

### Modified:
- `~/.zshrc` - Your shell configuration
- `~/.zprofile` - If MacPorts removed
- `.git/config` - In Isometry repo (SSH URL)

## ✅ After Running

```bash
# Restart your shell
exec zsh

# Test pushing to GitHub
cd ~/Developer/Projects/Isometry
git pull
git push  # Should work without password!
```

## 🆘 If Something Goes Wrong

All backups are saved. To revert:

```bash
# Restore old .zshrc
cp ~/.zshrc.backup-before-install ~/.zshrc

# Or
cp ~/.zshrc.backup-2026-01-22 ~/.zshrc

# Restart shell
exec zsh
```

## 📞 Manual Alternative

If you prefer to do it manually, see [DOTFILES-INSTALL.md](DOTFILES-INSTALL.md) for step-by-step instructions.

---

**Ready? Run the script now:**

```bash
cd ~/Developer/Projects/Isometry
chmod +x setup-dev-environment.sh
./setup-dev-environment.sh
```
