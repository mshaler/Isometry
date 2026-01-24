# MacPorts Platform Mismatch Fix

## 🚨 The Problem

You're seeing this error:
```
Error: Current platform "darwin 25" does not match expected platform "darwin 24"
Error: Please run 'sudo port migrate' or follow the migration instructions
```

**What happened:**
- Your Time Machine backup was from macOS 14.x (darwin 24)
- You're now running macOS 15.2 (darwin 25)
- MacPorts binaries are tied to the OS version they were installed on
- MacPorts is completely broken and unusable

## ✅ Recommended Solution: Remove MacPorts

Since MacPorts is broken and conflicts with Homebrew anyway, the cleanest solution is to **remove it entirely**.

### Why Remove It?

1. **It's broken** - Can't be used in current state
2. **Conflicts with Homebrew** - Both install packages to system locations
3. **Homebrew is better for most users** - Larger community, more packages
4. **You're already using Homebrew** - Node, npm, etc. all from Homebrew

### How to Remove

Run the setup script - it will detect the broken MacPorts and safely remove it:

```bash
cd ~/Developer/Projects/Isometry
chmod +x setup-dev-environment.sh
./setup-dev-environment.sh
```

When prompted "Do you want to remove MacPorts?", answer **`y`**

The script will:
1. Skip trying to uninstall packages (since MacPorts is broken)
2. Remove all MacPorts directories
3. Clean MacPorts from your `.zprofile`
4. Leave Homebrew untouched

---

## 🔄 Alternative: Migrate MacPorts (Advanced)

If you **actively need MacPorts** packages, you can try migrating:

### Step 1: Check What You Have Installed

Since `port installed` doesn't work, check manually:
```bash
ls /opt/local/var/macports/registry/registry.db
```

If this file exists, MacPorts has a record of installed packages.

### Step 2: Reinstall MacPorts

1. **Uninstall current MacPorts:**
   ```bash
   sudo rm -rf /opt/local
   sudo rm -rf /Applications/DarwinPorts
   sudo rm -rf /Applications/MacPorts
   sudo rm -rf ~/.macports
   ```

2. **Download new MacPorts for macOS 15:**
   - Go to: https://www.macports.org/install.php
   - Download the package for macOS 15 Sequoia
   - Install it

3. **Restore packages:**
   ```bash
   sudo port selfupdate
   # Then manually reinstall packages you need
   ```

### Step 3: Fix PATH Conflicts

Edit `~/.zprofile`:
```bash
nano ~/.zprofile
```

Move MacPorts PATH **after** Homebrew:
```bash
# Good order:
eval "$(/opt/homebrew/bin/brew shellenv)"  # Homebrew first
export PATH="/opt/local/bin:/opt/local/sbin:$PATH"  # MacPorts after
```

---

## 🤔 Which Should You Choose?

### Remove MacPorts if:
- ✅ You don't know what packages you have installed
- ✅ You primarily use Homebrew
- ✅ You want the simplest solution
- ✅ You don't need MacPorts-specific packages

### Migrate MacPorts if:
- ✅ You know you need specific MacPorts packages
- ✅ You're willing to manually reinstall packages
- ✅ You understand the Homebrew/MacPorts conflicts

---

## 📝 Current Status

Based on your `.zprofile`, MacPorts was added on **2025-07-23** (relatively recent).

Check what you might have installed:
```bash
# Check if MacPorts installed anything
ls -la /opt/local/bin/ | head -20
ls -la /opt/local/lib/ | head -20
```

If those directories are empty or minimal, **removing is the best choice**.

---

## 🚀 Quick Decision Guide

**Run this to see what MacPorts installed:**
```bash
ls /opt/local/bin/ /opt/local/lib/ 2>/dev/null | wc -l
```

- **0-10 files**: Remove MacPorts (nothing important)
- **10+ files**: Check what they are, decide if you need them

**Most users should just remove it and use Homebrew exclusively.**

---

Ready to proceed? Run the setup script:
```bash
cd ~/Developer/Projects/Isometry
./setup-dev-environment.sh
```
