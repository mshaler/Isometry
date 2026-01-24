# Shell Configuration Fix

## 🚨 The Problem

You're seeing this error:
```
/Users/mshaler/.zshrc: line 16: autoload: command not found
```

**What's happening:**
- You're running **bash** as your shell
- But `.zshrc` is a **zsh** configuration file
- The `autoload` command only exists in zsh, not bash

## ✅ Quick Fix

### Step 1: Check Your Default Shell

```bash
echo $SHELL
```

If it shows `/bin/bash`, you need to switch to zsh.

### Step 2: Change to Zsh

```bash
chsh -s /bin/zsh
```

Enter your password when prompted.

### Step 3: Restart Terminal

Close and reopen your terminal, or run:
```bash
exec zsh
```

### Step 4: Verify It Worked

```bash
echo $SHELL
# Should show: /bin/zsh

nvm --version
# Should show version number, not "command not found"
```

---

## 🔍 Why This Happened

After your Time Machine restore, your default shell may have been reset to bash. macOS uses zsh as the default shell (since macOS Catalina), and our cleaned `.zshrc` is written for zsh.

---

## 📝 Alternative: Manual Setup

If you want to stay on bash, you would need to:
1. Rename `.zshrc` to `.bashrc`
2. Convert all zsh-specific syntax to bash
3. Update `.bash_profile` instead of `.zprofile`

**But we recommend just switching to zsh** - it's the macOS default and most modern setups use it.

---

## ✅ After Fixing

Once you've switched to zsh and restarted your terminal:

```bash
# Test that everything works
nvm --version
node --version
npm --version

# Re-run the setup script if it didn't complete
cd ~/Developer/Projects/Isometry
./setup-dev-environment.sh
```

---

## 🎯 Quick Command Summary

```bash
# Fix the shell issue
chsh -s /bin/zsh
# Enter password
# Close and reopen terminal

# Verify
echo $SHELL  # Should be /bin/zsh
nvm --version  # Should work now

# Continue with setup
cd ~/Developer/Projects/Isometry
./setup-dev-environment.sh
```
