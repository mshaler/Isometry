# Developer Sync Automation

This directory contains automation scripts for syncing the Developer directory to iCloud and managing repository archives.

## ⚠️ Important: Symlink Setup

These scripts are designed to run from `~/Developer/scripts/` but are version controlled here for safety.

After cloning this repo, create symlinks:

```bash
# Create scripts directory if needed
mkdir -p ~/Developer/scripts

# Create symlinks (from repo to ~/Developer)
ln -sf ~/Developer/Projects/Isometry/sync/sync-to-icloud.sh ~/Developer/scripts/
ln -sf ~/Developer/Projects/Isometry/sync/archive-cardboard.sh ~/Developer/scripts/
ln -sf ~/Developer/Projects/Isometry/sync/analyze-icloud-sync.sh ~/Developer/scripts/

# Copy documentation to Developer root
cp ~/Developer/Projects/Isometry/sync/README-SYNC.md ~/Developer/
cp ~/Developer/Projects/Isometry/sync/SETUP-COMPLETE.md ~/Developer/
```

## LaunchAgent Setup

The LaunchAgent expects scripts at `~/Developer/scripts/sync-to-icloud.sh`.

After symlinking, load the LaunchAgent:

```bash
launchctl load ~/Library/LaunchAgents/com.user.developer-sync.plist
```

## Files

- **sync-to-icloud.sh** - Hourly iCloud sync with checksum verification
- **archive-cardboard.sh** - Compress legacy repositories
- **analyze-icloud-sync.sh** - Analyze iCloud vs local differences
- **README-SYNC.md** - Complete sync documentation
- **SETUP-COMPLETE.md** - Setup summary and next steps

## LaunchAgent

The LaunchAgent plist should be at:
- `~/Library/LaunchAgents/com.user.developer-sync.plist`

See SETUP-COMPLETE.md for full documentation.
