#!/bin/bash

# CardBoard Repository Archive Script
# Archives all CardBoard-related repositories to compressed tar.gz files
# Creates manifest with checksums and metadata
#
# Usage: ./archive-cardboard.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECTS_DIR="/Users/mshaler/Developer/Projects"
ARCHIVE_DIR="/Users/mshaler/Developer/Archives/CardBoard-2026-01-23"
MANIFEST_FILE="$ARCHIVE_DIR/ARCHIVE-MANIFEST.md"
DATE_STAMP="2026-01-23"

# List of directories to archive (all CardBoard-related)
REPOS_TO_ARCHIVE=(
    "CardBoard"
    "CardBoard archive"
    "CardBoard-v3"
    "CardBoard-v3-charts"
    "CardBoard-v3-e2e"
    "CardBoard-v3-importer"
    "CardBoard-v3-integration"
    "CardBoard-v3-interactions"
    "CardBoard-v3-keyboard"
    "CardBoard-v3-knobs"
    "CardBoard-v3-menus"
    "CardBoard-v3-phase3-analytics"
    "CardBoard-v3-phase3-apple-notes"
    "CardBoard-v3-phase3-notebook"
    "CardBoard-v3-shell"
    "CardBoard-v3-sync"
    "CardBoard-v3-undo"
)

echo -e "${BLUE}=== CardBoard Repository Archival ===${NC}"
echo "Projects directory: $PROJECTS_DIR"
echo "Archive directory:  $ARCHIVE_DIR"
echo "Manifest file:      $MANIFEST_FILE"
echo ""

# Pre-flight checks
if [ ! -d "$PROJECTS_DIR" ]; then
    echo -e "${RED}Error: Projects directory not found: $PROJECTS_DIR${NC}"
    exit 1
fi

if [ ! -d "$ARCHIVE_DIR" ]; then
    echo -e "${RED}Error: Archive directory not found: $ARCHIVE_DIR${NC}"
    exit 1
fi

# Initialize manifest
{
    echo "# CardBoard Repository Archive Manifest"
    echo ""
    echo "**Date:** $DATE_STAMP"
    echo "**Archive Location:** \`$ARCHIVE_DIR\`"
    echo ""
    echo "## Overview"
    echo ""
    echo "This archive contains all legacy CardBoard repositories that pre-date the Isometry project."
    echo "All archives are compressed tar.gz files with full git history preserved."
    echo ""
    echo "## Revival Instructions"
    echo ""
    echo "\`\`\`bash"
    echo "# Extract to current directory"
    echo "tar -xzf CardBoard-v3-2026-01-23.tar.gz"
    echo ""
    echo "# Or extract to specific location"
    echo "tar -xzf CardBoard-v3-2026-01-23.tar.gz -C ~/Developer/Projects/"
    echo ""
    echo "# Verify extraction"
    echo "cd CardBoard-v3 && git log -1"
    echo "\`\`\`"
    echo ""
    echo "**Expected extraction time:** ~30 seconds for largest archives"
    echo ""
    echo "## Archived Repositories"
    echo ""
    echo "| Repository | Original Size | Compressed Size | Last Commit | SHA-256 Checksum |"
    echo "|------------|--------------|----------------|-------------|------------------|"
} > "$MANIFEST_FILE"

# Track totals
TOTAL_ORIGINAL_SIZE=0
TOTAL_COMPRESSED_SIZE=0
ARCHIVED_COUNT=0
FAILED_COUNT=0

# Function to convert size to bytes for summation
bytes_from_du() {
    local size_str=$1
    local bytes=0

    if [[ $size_str == *G ]]; then
        bytes=$(echo "$size_str" | sed 's/G//' | awk '{printf "%.0f", $1 * 1024 * 1024 * 1024}')
    elif [[ $size_str == *M ]]; then
        bytes=$(echo "$size_str" | sed 's/M//' | awk '{printf "%.0f", $1 * 1024 * 1024}')
    elif [[ $size_str == *K ]]; then
        bytes=$(echo "$size_str" | sed 's/K//' | awk '{printf "%.0f", $1 * 1024}')
    else
        bytes=$(echo "$size_str" | sed 's/B//')
    fi

    echo "$bytes"
}

# Archive each repository
for repo in "${REPOS_TO_ARCHIVE[@]}"; do
    REPO_PATH="$PROJECTS_DIR/$repo"

    if [ ! -d "$REPO_PATH" ]; then
        echo -e "${YELLOW}Warning: Repository not found, skipping: $repo${NC}"
        continue
    fi

    echo -e "${BLUE}Processing: $repo${NC}"

    # Get original size
    ORIGINAL_SIZE=$(du -sh "$REPO_PATH" 2>/dev/null | cut -f1)
    echo "  Original size: $ORIGINAL_SIZE"

    # Get last commit info
    LAST_COMMIT="N/A"
    if [ -d "$REPO_PATH/.git" ]; then
        LAST_COMMIT=$(/usr/bin/git -C "$REPO_PATH" log -1 --format='%ci' 2>/dev/null || echo "N/A")
    fi
    echo "  Last commit: $LAST_COMMIT"

    # Create archive name (sanitize spaces and special chars)
    ARCHIVE_NAME=$(echo "$repo" | sed 's/ /-/g')
    ARCHIVE_FILE="$ARCHIVE_DIR/${ARCHIVE_NAME}-${DATE_STAMP}.tar.gz"

    echo "  Creating archive: $(basename "$ARCHIVE_FILE")"

    # Create tar.gz archive (change to Projects dir to avoid full paths)
    if (cd "$PROJECTS_DIR" && tar -czf "$ARCHIVE_FILE" "$repo" 2>/dev/null); then
        echo -e "  ${GREEN}✓ Archive created${NC}"

        # Verify archive integrity
        echo "  Verifying archive integrity..."
        if tar -tzf "$ARCHIVE_FILE" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓ Archive verified${NC}"

            # Get compressed size
            COMPRESSED_SIZE=$(du -sh "$ARCHIVE_FILE" 2>/dev/null | cut -f1)
            echo "  Compressed size: $COMPRESSED_SIZE"

            # Calculate checksum
            echo "  Calculating SHA-256 checksum..."
            CHECKSUM=$(shasum -a 256 "$ARCHIVE_FILE" | cut -d' ' -f1)
            SHORT_CHECKSUM="${CHECKSUM:0:16}..."
            echo "  Checksum: $SHORT_CHECKSUM"

            # Update totals
            ORIGINAL_BYTES=$(bytes_from_du "$ORIGINAL_SIZE")
            COMPRESSED_BYTES=$(bytes_from_du "$COMPRESSED_SIZE")
            TOTAL_ORIGINAL_SIZE=$((TOTAL_ORIGINAL_SIZE + ORIGINAL_BYTES))
            TOTAL_COMPRESSED_SIZE=$((TOTAL_COMPRESSED_SIZE + COMPRESSED_BYTES))
            ARCHIVED_COUNT=$((ARCHIVED_COUNT + 1))

            # Add to manifest
            echo "| $repo | $ORIGINAL_SIZE | $COMPRESSED_SIZE | $LAST_COMMIT | \`$SHORT_CHECKSUM\` |" >> "$MANIFEST_FILE"

            echo -e "  ${GREEN}✓ Complete${NC}"
        else
            echo -e "  ${RED}✗ Archive verification failed${NC}"
            FAILED_COUNT=$((FAILED_COUNT + 1))
            rm -f "$ARCHIVE_FILE"
        fi
    else
        echo -e "  ${RED}✗ Archive creation failed${NC}"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi

    echo ""
done

# Calculate compression ratio
if [ $TOTAL_ORIGINAL_SIZE -gt 0 ]; then
    COMPRESSION_RATIO=$(awk "BEGIN {printf \"%.1f\", ($TOTAL_COMPRESSED_SIZE / $TOTAL_ORIGINAL_SIZE) * 100}")
else
    COMPRESSION_RATIO="N/A"
fi

# Convert bytes to human readable
human_readable() {
    local bytes=$1
    if [ $bytes -ge 1073741824 ]; then
        echo "$(awk "BEGIN {printf \"%.1f\", $bytes / 1073741824}")G"
    elif [ $bytes -ge 1048576 ]; then
        echo "$(awk "BEGIN {printf \"%.1f\", $bytes / 1048576}")M"
    elif [ $bytes -ge 1024 ]; then
        echo "$(awk "BEGIN {printf \"%.1f\", $bytes / 1024}")K"
    else
        echo "${bytes}B"
    fi
}

TOTAL_ORIGINAL_HR=$(human_readable $TOTAL_ORIGINAL_SIZE)
TOTAL_COMPRESSED_HR=$(human_readable $TOTAL_COMPRESSED_SIZE)

# Add summary to manifest
{
    echo ""
    echo "## Summary"
    echo ""
    echo "- **Total repositories archived:** $ARCHIVED_COUNT"
    echo "- **Failed archives:** $FAILED_COUNT"
    echo "- **Total original size:** $TOTAL_ORIGINAL_HR"
    echo "- **Total compressed size:** $TOTAL_COMPRESSED_HR"
    echo "- **Compression ratio:** ${COMPRESSION_RATIO}%"
    echo "- **Space saved:** $(human_readable $((TOTAL_ORIGINAL_SIZE - TOTAL_COMPRESSED_SIZE)))"
    echo ""
    echo "## Notes"
    echo ""
    echo "- Original repositories are **NOT deleted** - verify archives before removal"
    echo "- All archives include full git history"
    echo "- Checksums are SHA-256 (first 16 characters shown above)"
    echo "- To verify an archive: \`shasum -a 256 <archive-file>\`"
    echo "- To see full checksum: \`shasum -a 256 *.tar.gz > checksums.txt\`"
    echo ""
    echo "## Archive Verification"
    echo ""
    echo "Before deleting original repositories, verify archives:"
    echo ""
    echo "\`\`\`bash"
    echo "# Test extract to temp directory"
    echo "mkdir -p /tmp/archive-test"
    echo "tar -xzf CardBoard-v3-2026-01-23.tar.gz -C /tmp/archive-test"
    echo ""
    echo "# Compare with original"
    echo "diff -r CardBoard-v3 /tmp/archive-test/CardBoard-v3"
    echo ""
    echo "# If identical, safe to delete original"
    echo "rm -rf /tmp/archive-test"
    echo "\`\`\`"
    echo ""
    echo "## Deletion Command (after verification)"
    echo ""
    echo "\`\`\`bash"
    echo "# Review what will be deleted"
    echo "ls -lh ~/Developer/Projects/CardBoard*"
    echo ""
    echo "# Delete all CardBoard repos (use with caution!)"
    echo "cd ~/Developer/Projects"
    echo "rm -rf CardBoard CardBoard\\ archive CardBoard-v3*"
    echo "\`\`\`"
    echo ""
    echo "---"
    echo "*Archive created: $(date)*"
} >> "$MANIFEST_FILE"

# Print summary
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Archive Process Complete${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Results:"
echo "  Archived:      $ARCHIVED_COUNT repositories"
echo "  Failed:        $FAILED_COUNT repositories"
echo ""
echo "Size Summary:"
echo "  Original:      $TOTAL_ORIGINAL_HR"
echo "  Compressed:    $TOTAL_COMPRESSED_HR"
echo "  Compression:   ${COMPRESSION_RATIO}%"
echo "  Space saved:   $(human_readable $((TOTAL_ORIGINAL_SIZE - TOTAL_COMPRESSED_SIZE)))"
echo ""
echo -e "Manifest: ${GREEN}$MANIFEST_FILE${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Original repositories NOT deleted${NC}"
echo "Review the manifest and verify archives before removing originals."
echo ""
echo "To review manifest:"
echo "  cat $MANIFEST_FILE"
echo ""
echo "To verify an archive:"
echo "  tar -tzf $ARCHIVE_DIR/CardBoard-v3-${DATE_STAMP}.tar.gz | head"
echo ""
