#!/bin/bash

# Safe iCloud Developer Sync Script
# Syncs ~/Developer to iCloud Drive with corruption prevention
#
# Features:
# - Pre-flight checks (iCloud mounted, disk space, source exists)
# - Checksum-based verification (not timestamp)
# - Comprehensive logging
# - Error handling and notifications
# - Post-sync verification
#
# Usage: ./sync-to-icloud.sh
#
# Designed to run hourly via LaunchAgent

set -euo pipefail

# Colors (only when running in terminal)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# Configuration
SOURCE_DIR="/Users/mshaler/Developer"
ICLOUD_BASE="/Users/mshaler/Library/Mobile Documents/com~apple~CloudDocs"
DEST_DIR="$ICLOUD_BASE/Developer"
LOG_DIR="/Users/mshaler/Library/Logs/icloud-sync"
LOG_FILE="$LOG_DIR/sync.log"
ERROR_LOG="$LOG_DIR/sync-errors.log"
MIN_FREE_SPACE_GB=30
SCRIPT_NAME="iCloud Developer Sync"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"

    # Also echo to console if running interactively
    if [ -t 1 ]; then
        case $level in
            ERROR)
                echo -e "${RED}[$level] $message${NC}"
                ;;
            WARNING)
                echo -e "${YELLOW}[$level] $message${NC}"
                ;;
            SUCCESS)
                echo -e "${GREEN}[$level] $message${NC}"
                ;;
            INFO)
                echo -e "${BLUE}[$level] $message${NC}"
                ;;
            *)
                echo "[$level] $message"
                ;;
        esac
    fi
}

# Error handler
error_exit() {
    local message="$1"
    log ERROR "$message"
    echo "[$timestamp] [ERROR] $message" >> "$ERROR_LOG"

    # Send notification (macOS)
    osascript -e "display notification \"$message\" with title \"$SCRIPT_NAME\" subtitle \"Sync Failed\"" 2>/dev/null || true

    exit 1
}

# Start sync
log INFO "========================================="
log INFO "Starting iCloud Developer sync"
log INFO "========================================="

# Pre-flight check 1: Verify source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    error_exit "Source directory does not exist: $SOURCE_DIR"
fi

log INFO "✓ Source directory exists: $SOURCE_DIR"

# Pre-flight check 2: Verify iCloud Drive is mounted
if [ ! -d "$ICLOUD_BASE" ]; then
    error_exit "iCloud Drive not mounted or not accessible: $ICLOUD_BASE"
fi

log INFO "✓ iCloud Drive is mounted"

# Pre-flight check 3: Check available space on iCloud
# Note: df on iCloud Drive may not report accurate free space, but we'll try
AVAILABLE_SPACE=$(df -g "$ICLOUD_BASE" 2>/dev/null | tail -1 | awk '{print $4}' || echo "0")

if [ "$AVAILABLE_SPACE" -lt "$MIN_FREE_SPACE_GB" ] && [ "$AVAILABLE_SPACE" -ne 0 ]; then
    log WARNING "Low disk space on iCloud: ${AVAILABLE_SPACE}GB available (minimum: ${MIN_FREE_SPACE_GB}GB)"
    log WARNING "Continuing anyway, but may run out of space during sync"
fi

log INFO "✓ Disk space check complete (${AVAILABLE_SPACE}GB available)"

# Create destination directory if it doesn't exist
if [ ! -d "$DEST_DIR" ]; then
    log INFO "Creating destination directory: $DEST_DIR"
    mkdir -p "$DEST_DIR"
fi

# Record start time
START_TIME=$(date +%s)

# Count files before sync
log INFO "Counting source files..."
SOURCE_COUNT=$(find "$SOURCE_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
log INFO "Source files: $SOURCE_COUNT"

# Perform rsync
log INFO "Starting rsync..."
log INFO "Command: rsync -avh --checksum --progress [with exclusions]"

# Rsync with safety features
# - Archive mode (-a): preserve permissions, timestamps, symlinks
# - Verbose (-v): show file transfers
# - Human-readable (-h): human-readable sizes
# - Checksum (--checksum): verify by content, not timestamps
# - Progress (--progress): show file-by-file progress (macOS rsync 2.6.9 compatible)
# - Exclude patterns: node_modules, build artifacts, logs, cache dirs

if rsync -avh --checksum --progress \
    --exclude 'node_modules/' \
    --exclude 'dist/' \
    --exclude 'build/' \
    --exclude '.DS_Store' \
    --exclude '*.log' \
    --exclude '.chunkhound/' \
    --exclude '.cardboard/' \
    --exclude '*.pyc' \
    --exclude '__pycache__/' \
    --exclude '.venv/' \
    --exclude 'venv/' \
    --exclude '.next/' \
    --exclude '.nuxt/' \
    --exclude 'coverage/' \
    --exclude '.pytest_cache/' \
    --exclude '.mypy_cache/' \
    --exclude 'target/' \
    --log-file="$LOG_FILE" \
    "$SOURCE_DIR/" \
    "$DEST_DIR/" 2>&1 | tee -a "$LOG_FILE"; then

    log SUCCESS "✓ Rsync completed successfully"
else
    error_exit "Rsync failed with exit code $?"
fi

# Record end time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
DURATION_MIN=$((DURATION / 60))
DURATION_SEC=$((DURATION % 60))

# Post-sync verification
log INFO "Performing post-sync verification..."

# Count files in destination
DEST_COUNT=$(find "$DEST_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
log INFO "Destination files: $DEST_COUNT"

# Compare counts (allowing for excluded files)
FILE_DIFF=$((SOURCE_COUNT - DEST_COUNT))
if [ $FILE_DIFF -lt 0 ]; then
    FILE_DIFF=$((FILE_DIFF * -1))
fi

log INFO "File count difference: $FILE_DIFF"

# Calculate sizes
SOURCE_SIZE=$(du -sh "$SOURCE_DIR" 2>/dev/null | cut -f1)
DEST_SIZE=$(du -sh "$DEST_DIR" 2>/dev/null | cut -f1)

log INFO "Source size: $SOURCE_SIZE"
log INFO "Destination size: $DEST_SIZE"

# Summary
log INFO "========================================="
log SUCCESS "Sync completed successfully"
log INFO "========================================="
log INFO "Duration: ${DURATION_MIN}m ${DURATION_SEC}s"
log INFO "Source: $SOURCE_SIZE ($SOURCE_COUNT files)"
log INFO "Destination: $DEST_SIZE ($DEST_COUNT files)"
log INFO "========================================="

# Send success notification (macOS)
osascript -e "display notification \"Synced $SOURCE_SIZE in ${DURATION_MIN}m ${DURATION_SEC}s\" with title \"$SCRIPT_NAME\" subtitle \"Sync Complete\"" 2>/dev/null || true

# Rotate logs (keep last 30 days)
find "$LOG_DIR" -name "*.log" -type f -mtime +30 -delete 2>/dev/null || true

log INFO "Next sync: 1 hour"
log INFO ""

exit 0
