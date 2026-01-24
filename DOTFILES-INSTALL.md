# Dotfiles Installation & Git Authentication Setup

## ✅ What Was Done

1. **Backed up your current .zshrc** to `~/.zshrc.backup-2026-01-22`
2. **Created cleaned .zshrc** at `.zshrc.cleaned` (in this directory)
3. **Identified issues:**
   - Removed exposed GitHub tokens (lines 49-50)
   - Fixed duplicate nvm initialization
   - Fixed duplicate Cargo initialization
   - Removed MacPorts PATH conflict
   - Fixed syntax error in `cling()` function
   - Organized in logical sections with comments

## 📋 Installation Steps

### Step 1: Install the Cleaned .zshrc

```bash
# Copy the cleaned file to your home directory
cp .zshrc.cleaned ~/.zshrc

# Restart your shell or source the new config
exec zsh
# or
source ~/.zshrc
```

### Step 2: Optional - Clean Up .zprofile

Your `.zprofile` has a MacPorts PATH that conflicts with Homebrew. To fix:

```bash
# Edit your .zprofile
nano ~/.zprofile

# Remove or comment out these lines (around lines 11-18):
# export PATH="/opt/local/bin:/opt/local/sbin:$PATH"
# export MANPATH="/opt/local/share/man:$MANPATH"
```

**Save and exit** (Ctrl+X, then Y, then Enter in nano)

---

## 🔐 Git Authentication Setup

You have **NO SSH keys** and **NO credential helper** configured. Here's how to set up secure Git authentication:

### Option 1: SSH Keys (Recommended)

SSH keys are the most secure and convenient method for GitHub authentication.

#### Step 1: Generate SSH Key

```bash
# Generate ED25519 key (modern, secure)
ssh-keygen -t ed25519 -C "mshaler@gmail.com"

# When prompted:
# - File location: Press Enter (accepts default ~/.ssh/id_ed25519)
# - Passphrase: Enter a strong passphrase (optional but recommended)
```

#### Step 2: Add Key to SSH Agent

```bash
# Start the SSH agent
eval "$(ssh-agent -s)"

# Add your SSH key to the agent
ssh-add ~/.ssh/id_ed25519
```

#### Step 3: Copy Public Key

```bash
# Copy the public key to clipboard
pbcopy < ~/.ssh/id_ed25519.pub

# Or display it to copy manually:
cat ~/.ssh/id_ed25519.pub
```

#### Step 4: Add to GitHub

1. Go to https://github.com/settings/keys
2. Click **"New SSH key"**
3. Title: "MacBook Pro" (or whatever you want)
4. Key type: **Authentication Key**
5. Paste your public key
6. Click **"Add SSH key"**

#### Step 5: Test Connection

```bash
# Test SSH connection to GitHub
ssh -T git@github.com

# You should see:
# Hi mshaler! You've successfully authenticated...
```

#### Step 6: Configure Git to Use SSH

For existing repos using HTTPS, switch to SSH:

```bash
# In your project directory
cd ~/Developer/Projects/Isometry
git remote set-url origin git@github.com:USERNAME/REPO.git

# Or list current remote to see what needs changing:
git remote -v
```

---

### Option 2: GitHub CLI (Alternative)

If you prefer a simpler setup:

```bash
# Install GitHub CLI (if not already installed)
brew install gh

# Authenticate with GitHub
gh auth login

# Follow the prompts:
# - Account: GitHub.com
# - Protocol: HTTPS or SSH (your choice)
# - Authenticate: Browser (easiest)
```

The `gh` CLI will automatically configure git credentials.

---

### Option 3: Git Credential Helper + Personal Access Token (Not Recommended)

If you must use HTTPS with tokens:

```bash
# Configure credential helper to use macOS Keychain
git config --global credential.helper osxkeychain

# Next time you push, you'll be prompted for:
# - Username: mshaler
# - Password: [your new Personal Access Token]

# Create a new token at:
# https://github.com/settings/tokens/new
# Required scopes: repo, workflow
```

The token will be stored securely in macOS Keychain.

---

## 🔍 Verify Everything Works

```bash
# Check your shell config
which node
node --version
npm --version
nvm current

# Test Git authentication (after setting up SSH)
git ls-remote git@github.com:mshaler/Isometry.git

# Check your PATH
echo $PATH | tr ':' '\n' | nl
```

---

## 📝 What Changed

### Removed:
- ❌ Duplicate nvm initialization (was loaded twice)
- ❌ Duplicate Cargo env sourcing
- ❌ MacPorts PATH conflict with Homebrew
- ❌ **Exposed GitHub tokens** (CRITICAL)
- ❌ Syntax error in `cling()` function

### Fixed:
- ✅ Single nvm initialization
- ✅ Proper nvm auto-switch function
- ✅ Organized PATH additions
- ✅ Clear section organization
- ✅ Added comments and documentation

### Kept:
- ✅ All your custom aliases (fuz, tm, etc.)
- ✅ All your functions (cling)
- ✅ Conda initialization (you can comment out if not using)
- ✅ Rust/Cargo setup
- ✅ Bun runtime setup

---

## 🚨 Important Notes

1. **Token Security**: Never store tokens in shell config files again. Use:
   - macOS Keychain for credentials
   - SSH keys for authentication
   - Environment variables loaded from secure sources

2. **MacPorts vs Homebrew**: You have both installed. They conflict. Consider:
   - Removing MacPorts entirely if you don't use it
   - Or keeping it but removing from PATH in `.zprofile`

3. **Conda**: If you don't actively use Anaconda, comment out the conda section in `.zshrc` (lines 35-46)

---

## 💡 Recommended Next Steps

1. ✅ Install cleaned .zshrc
2. ✅ Set up SSH keys for GitHub
3. ✅ Test Git authentication
4. ⚠️ Consider removing MacPorts or fixing PATH conflicts
5. ⚠️ Review conda initialization (disable if unused)
6. ⚠️ Restart your terminal to apply all changes

---

## 📚 Additional Resources

- [GitHub SSH Documentation](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [Git Credential Storage](https://git-scm.com/book/en/v2/Git-Tools-Credential-Storage)
