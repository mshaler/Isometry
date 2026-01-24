#!/bin/bash

# iCloud Cleanup Analysis Script
# Analyzes differences between local Developer directory and iCloud backup
# Generates a report identifying stale data in iCloud
#
# Usage: ./analyze-icloud-sync.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paths
LOCAL_DIR="/Users/mshaler/Developer"
ICLOUD_DIR="/Users/mshaler/Library/Mobile Documents/com~apple~CloudDocs/Developer"
REPORT_FILE="/Users/mshaler/Developer/icloud-cleanup-report.txt"
TEMP_DIR="/tmp/icloud-analysis-$$"

echo -e "${BLUE}=== iCloud Cleanup Analysis ===${NC}"
echo "Local:  $LOCAL_DIR"
echo "iCloud: $ICLOUD_DIR"
echo "Report: $REPORT_FILE"
echo ""

# Pre-flight checks
if [ ! -d "$LOCAL_DIR" ]; then
    echo -e "${RED}Error: Local directory not found: $LOCAL_DIR${NC}"
    exit 1
fi

if [ ! -d "$ICLOUD_DIR" ]; then
    echo -e "${RED}Error: iCloud directory not found: $ICLOUD_DIR${NC}"
    echo "iCloud Drive may not be mounted or enabled."
    exit 1
fi

# Create temp directory
mkdir -p "$TEMP_DIR"
trap "rm -rf $TEMP_DIR" EXIT

echo -e "${YELLOW}Analyzing directory trees (this may take a few minutes)...${NC}"

# Generate file lists
echo "Scanning local directory..."
(cd "$LOCAL_DIR" && find . -type f -o -type d) | sort > "$TEMP_DIR/local_files.txt"

echo "Scanning iCloud directory..."
(cd "$ICLOUD_DIR" && find . -type f -o -type d) | sort > "$TEMP_DIR/icloud_files.txt"

# Find differences
echo "Computing differences..."
comm -13 "$TEMP_DIR/local_files.txt" "$TEMP_DIR/icloud_files.txt" > "$TEMP_DIR/only_in_icloud.txt"
comm -23 "$TEMP_DIR/local_files.txt" "$TEMP_DIR/icloud_files.txt" > "$TEMP_DIR/only_in_local.txt"
comm -12 "$TEMP_DIR/local_files.txt" "$TEMP_DIR/icloud_files.txt" > "$TEMP_DIR/in_both.txt"

# Count files
LOCAL_COUNT=$(wc -l < "$TEMP_DIR/local_files.txt" | tr -d ' ')
ICLOUD_COUNT=$(wc -l < "$TEMP_DIR/icloud_files.txt" | tr -d ' ')
ONLY_ICLOUD_COUNT=$(wc -l < "$TEMP_DIR/only_in_icloud.txt" | tr -d ' ')
ONLY_LOCAL_COUNT=$(wc -l < "$TEMP_DIR/only_in_local.txt" | tr -d ' ')
BOTH_COUNT=$(wc -l < "$TEMP_DIR/in_both.txt" | tr -d ' ')

# Calculate sizes
echo "Calculating directory sizes..."
LOCAL_SIZE=$(du -sh "$LOCAL_DIR" 2>/dev/null | cut -f1)
ICLOUD_SIZE=$(du -sh "$ICLOUD_DIR" 2>/dev/null | cut -f1)

# Generate report
{
    echo "========================================="
    echo "iCloud Cleanup Analysis Report"
    echo "Generated: $(date)"
    echo "========================================="
    echo ""
    echo "SUMMARY"
    echo "-------"
    echo "Local directory size:  $LOCAL_SIZE"
    echo "iCloud directory size: $ICLOUD_SIZE"
    echo ""
    echo "Total items in local:  $LOCAL_COUNT"
    echo "Total items in iCloud: $ICLOUD_COUNT"
    echo "Items in both:         $BOTH_COUNT"
    echo "Only in iCloud:        $ONLY_ICLOUD_COUNT (candidates for deletion)"
    echo "Only in local:         $ONLY_LOCAL_COUNT (will be synced)"
    echo ""

    if [ "$ONLY_ICLOUD_COUNT" -gt 0 ]; then
        echo "========================================="
        echo "FILES/DIRECTORIES ONLY IN ICLOUD"
        echo "========================================="
        echo ""
        echo "These items exist in iCloud but not locally."
        echo "They may be stale and can be deleted to free space."
        echo ""

        # Show top-level directories only in iCloud
        echo "Top-level directories only in iCloud:"
        grep -E '^\./[^/]+/?$' "$TEMP_DIR/only_in_icloud.txt" | sed 's/^\.//; s/\/$//' | head -50
        echo ""

        # Calculate size of stale Projects subdirectories
        echo "Detailed size analysis of iCloud Projects:"
        if [ -d "$ICLOUD_DIR/Projects" ]; then
            for dir in "$ICLOUD_DIR/Projects"/*; do
                if [ -d "$dir" ]; then
                    basename_dir=$(basename "$dir")
                    size=$(du -sh "$dir" 2>/dev/null | cut -f1)

                    # Check if this directory exists locally
                    if [ ! -d "$LOCAL_DIR/Projects/$basename_dir" ]; then
                        echo "  [STALE] $basename_dir: $size"
                    else
                        echo "  [CURRENT] $basename_dir: $size"
                    fi
                fi
            done
        fi
        echo ""
    fi

    if [ "$ONLY_LOCAL_COUNT" -gt 0 ]; then
        echo "========================================="
        echo "FILES/DIRECTORIES ONLY IN LOCAL"
        echo "========================================="
        echo ""
        echo "These items exist locally but not in iCloud."
        echo "They will be synced during the next rsync."
        echo ""

        # Show top-level directories only in local
        echo "Top-level directories only in local:"
        grep -E '^\./[^/]+/?$' "$TEMP_DIR/only_in_local.txt" | sed 's/^\.//; s/\/$//' | head -50
        echo ""

        # Show sample of files
        echo "Sample files (first 20):"
        grep -E '^\./.*[^/]$' "$TEMP_DIR/only_in_local.txt" | sed 's/^\.//' | head -20
        echo ""
    fi

    echo "========================================="
    echo "RECOMMENDATIONS"
    echo "========================================="
    echo ""

    if [ "$ONLY_ICLOUD_COUNT" -gt 100 ]; then
        echo "1. ICLOUD CLEANUP NEEDED"
        echo "   You have $ONLY_ICLOUD_COUNT items in iCloud that don't exist locally."
        echo "   This represents significant stale data."
        echo ""
        echo "   Options:"
        echo "   a) Manual cleanup: Review items listed above and delete from iCloud"
        echo "   b) Mirror approach: Delete iCloud Projects directory and let rsync rebuild it"
        echo ""
    fi

    if [ "$ONLY_LOCAL_COUNT" -gt 0 ]; then
        echo "2. SYNC WILL ADD NEW FILES"
        echo "   You have $ONLY_LOCAL_COUNT items locally that will be synced to iCloud."
        echo "   This is normal for new or modified files."
        echo ""
    fi

    echo "3. NEXT STEPS"
    echo "   - Review this report carefully"
    echo "   - Decide which iCloud items to delete"
    echo "   - Consider backing up any important iCloud-only items first"
    echo "   - Run rsync script after cleanup to establish baseline"
    echo ""

    echo "========================================="
    echo "DETAILED FILE LISTS"
    echo "========================================="
    echo ""
    echo "For complete file-by-file analysis, see temporary files:"
    echo "  Files only in iCloud: $TEMP_DIR/only_in_icloud.txt"
    echo "  Files only in local:  $TEMP_DIR/only_in_local.txt"
    echo "  Files in both:        $TEMP_DIR/in_both.txt"
    echo ""
    echo "These files will be deleted when you close this terminal."
    echo "========================================="

} > "$REPORT_FILE"

# Display summary to console
echo -e "${GREEN}Analysis complete!${NC}"
echo ""
echo "Summary:"
echo "  Local:  $LOCAL_SIZE ($LOCAL_COUNT items)"
echo "  iCloud: $ICLOUD_SIZE ($ICLOUD_COUNT items)"
echo ""
echo -e "${YELLOW}Only in iCloud: $ONLY_ICLOUD_COUNT items (candidates for deletion)${NC}"
echo -e "${BLUE}Only in local:  $ONLY_LOCAL_COUNT items (will be synced)${NC}"
echo ""
echo -e "Full report saved to: ${GREEN}$REPORT_FILE${NC}"
echo ""
echo "Temporary detailed lists available until you close this terminal:"
echo "  $TEMP_DIR/only_in_icloud.txt"
echo "  $TEMP_DIR/only_in_local.txt"
echo ""
echo -e "${YELLOW}Press Enter to view the report, or Ctrl+C to exit${NC}"
read -r

# Display report
less "$REPORT_FILE"
