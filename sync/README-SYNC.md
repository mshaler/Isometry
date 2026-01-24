# Developer Directory iCloud Sync

Automated hourly sync from `~/Developer` to iCloud Drive with corruption prevention and comprehensive logging.

## Overview

This system provides safe, automated backup of your Developer directory to iCloud Drive:

- **Frequency:** Every hour
- **Method:** rsync with checksum verification (not timestamps)
- **Safety:** Pre-flight checks, error handling, verification
- **Backup tier:** #3 (after Time Machine + BackBlaze + GitHub)

## Quick Start

### Manual Sync

Run a one-time sync:

```bash
~/Developer/scripts/sync-to-icloud.sh
```

### Enable Automatic Hourly Sync

```bash
# Load the LaunchAgent
launchctl load ~/Library/LaunchAgents/com.user.developer-sync.plist

# Verify it's running
launchctl list | grep developer-sync
```

### Disable Automatic Sync

```bash
# Unload the LaunchAgent
launchctl unload ~/Library/LaunchAgents/com.user.developer-sync.plist
```

## What Gets Synced

### Included
- All git repositories (including `.git` directories for full history)
- All source code files
- Project configurations
- Documentation
- Scripts and automation

### Excluded
- `node_modules/` (can be restored with `npm install`)
- `dist/`, `build/` (build artifacts)
- `.DS_Store` (macOS metadata)
- `*.log` files
- `.chunkhound/`, `.cardboard/` (local cache directories)
- `__pycache__/`, `.pytest_cache/`, `.mypy_cache/` (Python caches)
- `.venv/`, `venv/` (Python virtual environments)
- `.next/`, `.nuxt/` (Node.js framework build caches)
- `coverage/` (test coverage reports)
- `target/` (Rust build directory)

**Rationale:** Excluded items are either:
1. Regenerable from package.json/requirements.txt
2. Build artifacts that can be recreated
3. Temporary caches
4. OS-specific metadata

## Monitoring

### Check Sync Status

```bash
# View recent sync activity
tail -f ~/Library/Logs/icloud-sync/sync.log

# View last 50 lines
tail -n 50 ~/Library/Logs/icloud-sync/sync.log

# View errors only
cat ~/Library/Logs/icloud-sync/sync-errors.log
```

### Log Files

- **Main log:** `~/Library/Logs/icloud-sync/sync.log`
- **Error log:** `~/Library/Logs/icloud-sync/sync-errors.log`
- **LaunchAgent stdout:** `~/Library/Logs/icloud-sync/launchd.out`
- **LaunchAgent stderr:** `~/Library/Logs/icloud-sync/launchd.err`
- **Retention:** Logs older than 30 days are automatically deleted

### Success Indicators

After a successful sync, you should see:

```
[INFO] ✓ Source directory exists
[INFO] ✓ iCloud Drive is mounted
[INFO] ✓ Disk space check complete
[INFO] Starting rsync...
[SUCCESS] ✓ Rsync completed successfully
[SUCCESS] Sync completed successfully
```

Plus a macOS notification: "iCloud Developer Sync - Sync Complete"

### Failure Indicators

If sync fails, you'll see:

```
[ERROR] <error message>
```

Plus a macOS notification: "iCloud Developer Sync - Sync Failed"

Common failure reasons:
- iCloud Drive not mounted
- Network disconnected
- Insufficient disk space
- Source directory missing

## Safety Features

### Corruption Prevention

1. **Checksum verification:** Files are compared by content hash, not timestamps
2. **No --delete flag:** iCloud keeps extra files (safer, prevents accidental deletions)
3. **Pre-flight checks:** Verifies iCloud is mounted and accessible
4. **Disk space check:** Warns if less than 30GB free
5. **Error handling:** Stops on error, doesn't proceed with partial sync

### Verification

After each sync, the script:
- Counts files in source and destination
- Calculates total sizes
- Reports any discrepancies
- Logs everything for audit trail

### Rollback

If you need to restore from iCloud:

```bash
# Copy everything back to local
rsync -avh --checksum \
  "/Users/mshaler/Library/Mobile Documents/com~apple~CloudDocs/Developer/" \
  ~/Developer/

# Or just specific files/directories
rsync -avh --checksum \
  "/Users/mshaler/Library/Mobile Documents/com~apple~CloudDocs/Developer/Projects/Isometry/" \
  ~/Developer/Projects/Isometry/
```

## Troubleshooting

### Sync Not Running

```bash
# Check if LaunchAgent is loaded
launchctl list | grep developer-sync

# If not loaded, load it
launchctl load ~/Library/LaunchAgents/com.user.developer-sync.plist

# Check for errors in logs
cat ~/Library/Logs/icloud-sync/launchd.err
```

### Sync Taking Too Long

Normal sync times:
- **First sync:** 30-60 minutes (full 150GB)
- **Subsequent syncs:** 2-5 minutes (only changed files)

If sync is slow:
- Check network connection to iCloud
- Verify iCloud is not rate-limiting
- Check if many files were modified (forces full checksum comparison)

### iCloud Drive Full

```bash
# Check iCloud storage
df -h "/Users/mshaler/Library/Mobile Documents/com~apple~CloudDocs"

# If full, run cleanup analysis
~/Developer/scripts/analyze-icloud-sync.sh

# Review what can be deleted
cat ~/Developer/icloud-cleanup-report.txt
```

### Accidentally Deleted Local Files

If you deleted files locally and want to restore from iCloud:

```bash
# List what's in iCloud
ls -la "/Users/mshaler/Library/Mobile Documents/com~apple~CloudDocs/Developer/Projects"

# Copy back specific directory
rsync -avh --checksum \
  "/Users/mshaler/Library/Mobile Documents/com~apple~CloudDocs/Developer/Projects/SomeProject/" \
  ~/Developer/Projects/SomeProject/
```

### Verify Sync Integrity

```bash
# Run manual sync and watch output
~/Developer/scripts/sync-to-icloud.sh

# Check file counts match (allowing for excluded files)
find ~/Developer -type f | wc -l
find "/Users/mshaler/Library/Mobile Documents/com~apple~CloudDocs/Developer" -type f | wc -l
```

## Related Tools

### iCloud Cleanup Analysis

Analyzes differences between local and iCloud:

```bash
~/Developer/scripts/analyze-icloud-sync.sh
cat ~/Developer/icloud-cleanup-report.txt
```

Shows:
- Files only in iCloud (stale candidates)
- Files only in local (will be synced)
- Size comparisons
- Cleanup recommendations

### CardBoard Archive

Archived legacy repositories:

- **Location:** `~/Developer/Archives/CardBoard-2026-01-23/`
- **Manifest:** `~/Developer/Archives/CardBoard-2026-01-23/ARCHIVE-MANIFEST.md`

To restore an archive:

```bash
cd ~/Developer/Projects
tar -xzf ~/Developer/Archives/CardBoard-2026-01-23/CardBoard-v3-2026-01-23.tar.gz
```

## Advanced Configuration

### Change Sync Frequency

Edit the LaunchAgent plist:

```bash
# Open in editor
nano ~/Library/LaunchAgents/com.user.developer-sync.plist

# Change StartInterval (in seconds):
# 3600 = 1 hour
# 1800 = 30 minutes
# 7200 = 2 hours
# 86400 = 24 hours

# Reload after editing
launchctl unload ~/Library/LaunchAgents/com.user.developer-sync.plist
launchctl load ~/Library/LaunchAgents/com.user.developer-sync.plist
```

### Add More Exclusions

Edit the sync script:

```bash
nano ~/Developer/scripts/sync-to-icloud.sh

# Add new --exclude lines before the source/dest paths:
# --exclude 'your-pattern/' \
```

Common patterns:
- `*.tmp` (temporary files)
- `.idea/` (IDE settings)
- `.vscode/` (VS Code settings)
- `*.swp` (Vim swap files)

### Enable --delete Flag (Advanced)

**⚠️ Use with caution:** This makes iCloud mirror local exactly (deletes files not in local).

```bash
# Edit sync script
nano ~/Developer/scripts/sync-to-icloud.sh

# Add this flag to rsync command:
# --delete \

# Test with dry-run first:
rsync --dry-run --delete -avh --checksum \
  ~/Developer/ \
  "/Users/mshaler/Library/Mobile Documents/com~apple~CloudDocs/Developer/"
```

## File Structure

```
~/Developer/
├── scripts/
│   ├── analyze-icloud-sync.sh    # iCloud cleanup analysis
│   ├── archive-cardboard.sh      # Archive old repos
│   └── sync-to-icloud.sh         # Main sync script
├── Archives/
│   └── CardBoard-2026-01-23/     # Archived repositories
│       ├── *.tar.gz              # Compressed archives
│       └── ARCHIVE-MANIFEST.md   # Archive documentation
├── Projects/
│   ├── Isometry/                 # Active: spatial knowledge base
│   └── IsometryKB/               # Active: knowledge base repo
├── icloud-cleanup-report.txt     # Generated by analysis script
└── README-SYNC.md                # This file

~/Library/
├── LaunchAgents/
│   └── com.user.developer-sync.plist  # Hourly sync automation
└── Logs/
    └── icloud-sync/
        ├── sync.log              # Main sync log
        ├── sync-errors.log       # Error log
        ├── launchd.out          # LaunchAgent stdout
        └── launchd.err          # LaunchAgent stderr
```

## Migration from Previous Setup

The old `com.user.altosync` LaunchAgent has been replaced:

```bash
# Unload old agent (if still loaded)
launchctl unload ~/Library/LaunchAgents/com.user.altosync.plist

# Optionally remove old plist
rm ~/Library/LaunchAgents/com.user.altosync.plist

# Load new agent
launchctl load ~/Library/LaunchAgents/com.user.developer-sync.plist
```

## Support & Maintenance

### Regular Maintenance

- **Weekly:** Check `~/Library/Logs/icloud-sync/sync.log` for errors
- **Monthly:** Run `analyze-icloud-sync.sh` to check for bloat
- **Quarterly:** Review excluded patterns (are they still relevant?)

### Getting Help

1. Check logs first (see Monitoring section)
2. Run manual sync to see real-time output: `~/Developer/scripts/sync-to-icloud.sh`
3. Review this README for troubleshooting steps
4. Check iCloud Drive app status (System Settings → Apple ID → iCloud → iCloud Drive)

## Best Practices

1. **Don't edit files directly in iCloud Drive folder** - always work in `~/Developer`
2. **Verify sync before major deletions** - check that recent changes are in iCloud first
3. **Keep GitHub remotes updated** - iCloud is backup tier #3, not primary
4. **Monitor logs after system updates** - macOS updates can affect LaunchAgents
5. **Test restore procedure occasionally** - make sure you know how to get files back

---

**Last updated:** 2026-01-23
**Maintainer:** M. Shaler
**System:** macOS + iCloud Drive
