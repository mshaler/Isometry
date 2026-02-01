#!/bin/bash

# ETL Test Data Setup Script
# Configures Git LFS, organizes test datasets, and sets up CI/CD download optimization

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DATA_DIR="test-data"
LFS_THRESHOLD_MB=1
MAX_DATASET_SIZE_MB=100
CLEANUP_DAYS=90

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "Not in a Git repository. Please run this script from the project root."
    fi
}

# Install Git LFS if not already installed
install_git_lfs() {
    log "Checking Git LFS installation..."

    if command -v git-lfs >/dev/null 2>&1; then
        success "Git LFS is already installed ($(git-lfs version | head -n1))"
        return 0
    fi

    log "Installing Git LFS..."

    # Detect operating system and install accordingly
    case "$(uname -s)" in
        Darwin*)
            if command -v brew >/dev/null 2>&1; then
                brew install git-lfs
            else
                error "Homebrew not found. Please install Git LFS manually: https://git-lfs.github.io/"
            fi
            ;;
        Linux*)
            if command -v apt-get >/dev/null 2>&1; then
                sudo apt-get update && sudo apt-get install -y git-lfs
            elif command -v yum >/dev/null 2>&1; then
                sudo yum install -y git-lfs
            elif command -v dnf >/dev/null 2>&1; then
                sudo dnf install -y git-lfs
            else
                error "Package manager not found. Please install Git LFS manually: https://git-lfs.github.io/"
            fi
            ;;
        CYGWIN*|MINGW*|MSYS*)
            error "Windows detected. Please install Git LFS manually: https://git-lfs.github.io/"
            ;;
        *)
            error "Unknown operating system. Please install Git LFS manually: https://git-lfs.github.io/"
            ;;
    esac

    success "Git LFS installed successfully"
}

# Initialize Git LFS in the repository
initialize_git_lfs() {
    log "Initializing Git LFS in repository..."

    # Install Git LFS hooks
    git lfs install

    success "Git LFS initialized"
}

# Configure Git LFS tracking for test data files
configure_lfs_tracking() {
    log "Configuring Git LFS tracking patterns..."

    # Create .gitattributes file if it doesn't exist
    if [ ! -f .gitattributes ]; then
        touch .gitattributes
    fi

    # Define LFS tracking patterns
    local patterns=(
        "$TEST_DATA_DIR/**/*.json filter=lfs diff=lfs merge=lfs -text"
        "$TEST_DATA_DIR/**/*.md filter=lfs diff=lfs merge=lfs -text"
        "$TEST_DATA_DIR/**/*.html filter=lfs diff=lfs merge=lfs -text"
        "$TEST_DATA_DIR/**/*.sqlite filter=lfs diff=lfs merge=lfs -text"
        "$TEST_DATA_DIR/**/*.db filter=lfs diff=lfs merge=lfs -text"
        "$TEST_DATA_DIR/**/*.docx filter=lfs diff=lfs merge=lfs -text"
        "$TEST_DATA_DIR/**/*.xlsx filter=lfs diff=lfs merge=lfs -text"
        "$TEST_DATA_DIR/**/*.pptx filter=lfs diff=lfs merge=lfs -text"
        "$TEST_DATA_DIR/**/*.csv filter=lfs diff=lfs merge=lfs -text"
        "$TEST_DATA_DIR/**/*.zip filter=lfs diff=lfs merge=lfs -text"
        "$TEST_DATA_DIR/**/*.tar.gz filter=lfs diff=lfs merge=lfs -text"
        "# Large test datasets"
        "$TEST_DATA_DIR/**/large-*.* filter=lfs diff=lfs merge=lfs -text"
        "$TEST_DATA_DIR/**/stress-*.* filter=lfs diff=lfs merge=lfs -text"
        "$TEST_DATA_DIR/**/performance-*.* filter=lfs diff=lfs merge=lfs -text"
    )

    # Add patterns to .gitattributes if not already present
    for pattern in "${patterns[@]}"; do
        if ! grep -Fq "$pattern" .gitattributes; then
            echo "$pattern" >> .gitattributes
            log "Added LFS tracking: $pattern"
        fi
    done

    success "Git LFS tracking patterns configured"
}

# Create test data directory structure
create_directory_structure() {
    log "Creating test data directory structure..."

    local directories=(
        "$TEST_DATA_DIR"
        "$TEST_DATA_DIR/json"
        "$TEST_DATA_DIR/json/simple"
        "$TEST_DATA_DIR/json/moderate"
        "$TEST_DATA_DIR/json/complex"
        "$TEST_DATA_DIR/json/stress"
        "$TEST_DATA_DIR/json/edge-cases"
        "$TEST_DATA_DIR/markdown"
        "$TEST_DATA_DIR/markdown/simple"
        "$TEST_DATA_DIR/markdown/moderate"
        "$TEST_DATA_DIR/markdown/complex"
        "$TEST_DATA_DIR/markdown/stress"
        "$TEST_DATA_DIR/markdown/edge-cases"
        "$TEST_DATA_DIR/html"
        "$TEST_DATA_DIR/html/simple"
        "$TEST_DATA_DIR/html/moderate"
        "$TEST_DATA_DIR/html/complex"
        "$TEST_DATA_DIR/html/stress"
        "$TEST_DATA_DIR/html/edge-cases"
        "$TEST_DATA_DIR/sqlite"
        "$TEST_DATA_DIR/sqlite/simple"
        "$TEST_DATA_DIR/sqlite/moderate"
        "$TEST_DATA_DIR/sqlite/complex"
        "$TEST_DATA_DIR/sqlite/stress"
        "$TEST_DATA_DIR/sqlite/edge-cases"
        "$TEST_DATA_DIR/office"
        "$TEST_DATA_DIR/office/simple"
        "$TEST_DATA_DIR/office/moderate"
        "$TEST_DATA_DIR/office/complex"
        "$TEST_DATA_DIR/office/stress"
        "$TEST_DATA_DIR/office/edge-cases"
        "$TEST_DATA_DIR/csv"
        "$TEST_DATA_DIR/csv/simple"
        "$TEST_DATA_DIR/csv/moderate"
        "$TEST_DATA_DIR/csv/complex"
        "$TEST_DATA_DIR/csv/stress"
        "$TEST_DATA_DIR/csv/edge-cases"
        "$TEST_DATA_DIR/regression"
        "$TEST_DATA_DIR/regression/issue-001"
        "$TEST_DATA_DIR/regression/issue-002"
        "$TEST_DATA_DIR/regression/issue-003"
        "$TEST_DATA_DIR/benchmarks"
        "$TEST_DATA_DIR/benchmarks/standard"
        "$TEST_DATA_DIR/benchmarks/performance"
        "$TEST_DATA_DIR/production-samples"
        "$TEST_DATA_DIR/production-samples/anonymized"
        "$TEST_DATA_DIR/user-submitted"
        "$TEST_DATA_DIR/downloads"
        "$TEST_DATA_DIR/downloads/ci"
        "$TEST_DATA_DIR/downloads/cache"
    )

    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log "Created directory: $dir"
        fi
    done

    success "Directory structure created"
}

# Create README files for documentation
create_documentation() {
    log "Creating documentation files..."

    # Main README
    cat > "$TEST_DATA_DIR/README.md" << 'EOF'
# ETL Test Data Repository

This directory contains test datasets for the Isometry ETL pipeline testing framework.

## Directory Structure

### By Format
- `json/` - JSON test data files
- `markdown/` - Markdown document test data
- `html/` - HTML document test data
- `sqlite/` - SQLite database test files
- `office/` - Office document test files (docx, xlsx, pptx)
- `csv/` - CSV data files

### By Complexity
Each format directory contains:
- `simple/` - Basic functionality tests (1KB-10KB)
- `moderate/` - Normal usage patterns (10KB-100KB)
- `complex/` - Advanced features (100KB-1MB)
- `stress/` - Maximum limits (1MB-10MB)
- `edge-cases/` - Pathological cases that might break

### By Purpose
- `regression/` - Test cases from fixed bugs
- `benchmarks/` - Standard benchmark datasets
- `production-samples/` - Anonymized production data
- `user-submitted/` - User-reported issue data

## Git LFS

Files larger than 1MB are tracked with Git LFS for efficient version control.
Large files are automatically detected and tracked based on .gitattributes patterns.

## Usage

### Adding New Test Data

```bash
# Add a new dataset
cp your-test-file.json test-data/json/moderate/
git add test-data/json/moderate/your-test-file.json
git commit -m "Add moderate complexity JSON test dataset"
```

### CI/CD Downloads

The `downloads/ci/` directory contains optimized dataset packages for CI/CD:
- Pre-selected datasets for fast CI testing
- Compressed packages to reduce download time
- Cached frequently-used datasets

### Cleanup

Run `./scripts/etl-test-data-setup.sh --cleanup` to remove old datasets
and optimize storage usage.

## Dataset Guidelines

### Naming Convention
- Format: `{complexity}-{feature}-{size}.{ext}`
- Examples:
  - `simple-basic-nodes-1kb.json`
  - `complex-unicode-edges-500kb.md`
  - `stress-large-hierarchy-5mb.sqlite`

### Size Limits
- Simple: 1KB - 10KB
- Moderate: 10KB - 100KB
- Complex: 100KB - 1MB
- Stress: 1MB - 10MB
- Maximum: 100MB (use sparingly)

### Content Requirements
- Include expected output in `{filename}-expected.json`
- Add metadata in `{filename}-metadata.json`
- Anonymize any production data
- Include special characteristics in filename

### Quality Standards
- All datasets must pass round-trip validation
- Include edge cases: Unicode, special characters, empty values
- Test boundary conditions: max sizes, empty files, malformed data
- Document any known issues or limitations

## Maintenance

This repository is automatically maintained:
- Monthly cleanup of datasets older than 90 days
- Automated validation of all datasets
- Performance regression detection
- Storage optimization

For more information, see the ETL testing documentation.
EOF

    # Format-specific READMEs
    local formats=("json" "markdown" "html" "sqlite" "office" "csv")

    for format in "${formats[@]}"; do
        cat > "$TEST_DATA_DIR/$format/README.md" << EOF
# $format Test Data

Test datasets for $format format import testing.

## Organization

- \`simple/\` - Basic $format files (1KB-10KB)
- \`moderate/\` - Normal $format usage (10KB-100KB)
- \`complex/\` - Advanced $format features (100KB-1MB)
- \`stress/\` - Large $format files (1MB-10MB)
- \`edge-cases/\` - Pathological $format cases

## Guidelines

Each test file should include:
1. The data file: \`filename.$format\`
2. Expected output: \`filename-expected.json\`
3. Metadata: \`filename-metadata.json\`

## Specific Considerations for $format

EOF

        case $format in
            json)
                cat >> "$TEST_DATA_DIR/$format/README.md" << 'EOF'
- Test nested objects and arrays
- Include Unicode characters and special symbols
- Test circular references (should fail gracefully)
- Include malformed JSON for error testing
- Test very large arrays and deep nesting
EOF
                ;;
            markdown)
                cat >> "$TEST_DATA_DIR/$format/README.md" << 'EOF'
- Test various Markdown syntax (headers, lists, links, images)
- Include frontmatter with different formats
- Test code blocks with syntax highlighting
- Include mathematical notation and special characters
- Test very long documents and complex hierarchies
EOF
                ;;
            html)
                cat >> "$TEST_DATA_DIR/$format/README.md" << 'EOF'
- Test well-formed and malformed HTML
- Include various HTML5 elements
- Test embedded scripts and styles (should be sanitized)
- Include special characters and entities
- Test very large documents with deep nesting
EOF
                ;;
            sqlite)
                cat >> "$TEST_DATA_DIR/$format/README.md" << 'EOF'
- Test various SQLite schema designs
- Include foreign key relationships
- Test indexes and constraints
- Include corrupted databases for error testing
- Test very large databases with many tables
EOF
                ;;
            office)
                cat >> "$TEST_DATA_DIR/$format/README.md" << 'EOF'
- Test Word documents (.docx) with complex formatting
- Test Excel spreadsheets (.xlsx) with formulas and charts
- Test PowerPoint presentations (.pptx) with multimedia
- Include password-protected documents for error testing
- Test very large documents with embedded objects
EOF
                ;;
            csv)
                cat >> "$TEST_DATA_DIR/$format/README.md" << 'EOF'
- Test various CSV dialects and encodings
- Include quoted fields and escape characters
- Test malformed CSV for error handling
- Include very large CSV files
- Test different delimiter and line ending styles
EOF
                ;;
        esac

        log "Created documentation for $format format"
    done

    success "Documentation created"
}

# Generate sample test datasets
generate_sample_datasets() {
    log "Generating sample test datasets..."

    # Simple JSON dataset
    cat > "$TEST_DATA_DIR/json/simple/simple-basic-nodes-1kb.json" << 'EOF'
{
  "nodes": [
    {
      "id": "node-1",
      "name": "Simple Node 1",
      "content": "This is a simple test node with basic content.",
      "created_at": "2024-01-01T10:00:00Z",
      "modified_at": "2024-01-01T10:00:00Z"
    },
    {
      "id": "node-2",
      "name": "Simple Node 2",
      "content": "Another simple test node for validation.",
      "created_at": "2024-01-01T10:01:00Z",
      "modified_at": "2024-01-01T10:01:00Z"
    }
  ],
  "metadata": {
    "format_version": "1.0",
    "created_by": "test-generator"
  }
}
EOF

    # Expected output for simple JSON
    cat > "$TEST_DATA_DIR/json/simple/simple-basic-nodes-1kb-expected.json" << 'EOF'
[
  {
    "id": "node-1",
    "name": "Simple Node 1",
    "content": "This is a simple test node with basic content.",
    "folder": null,
    "latitude": null,
    "longitude": null,
    "version": 1,
    "sortOrder": 0,
    "createdAt": "2024-01-01T10:00:00.000Z",
    "modifiedAt": "2024-01-01T10:00:00.000Z"
  },
  {
    "id": "node-2",
    "name": "Simple Node 2",
    "content": "Another simple test node for validation.",
    "folder": null,
    "latitude": null,
    "longitude": null,
    "version": 1,
    "sortOrder": 1,
    "createdAt": "2024-01-01T10:01:00.000Z",
    "modifiedAt": "2024-01-01T10:01:00.000Z"
  }
]
EOF

    # Metadata for simple JSON
    cat > "$TEST_DATA_DIR/json/simple/simple-basic-nodes-1kb-metadata.json" << 'EOF'
{
  "name": "Simple Basic Nodes",
  "description": "Basic JSON test with 2 simple nodes",
  "format": "json",
  "complexity": "simple",
  "size_bytes": 512,
  "node_count": 2,
  "special_characteristics": ["basic_structure", "minimal_content"],
  "validation_rules": [
    {"type": "exact_node_count", "value": 2},
    {"type": "required_fields", "value": ["id", "name", "content"]}
  ],
  "created_at": "2024-01-01T00:00:00Z",
  "source": "synthetic"
}
EOF

    # Simple Markdown dataset
    cat > "$TEST_DATA_DIR/markdown/simple/simple-document-2kb.md" << 'EOF'
---
title: Simple Test Document
author: Test Generator
date: 2024-01-01
tags: [test, simple, markdown]
---

# Simple Test Document

This is a simple markdown document for testing the markdown importer.

## Introduction

The document contains basic markdown elements:

- **Bold text**
- *Italic text*
- `Inline code`
- [Links](https://example.com)

## Lists

### Unordered List
- Item 1
- Item 2
- Item 3

### Ordered List
1. First item
2. Second item
3. Third item

## Code Block

```python
def hello_world():
    print("Hello, World!")
    return True
```

## Conclusion

This document tests basic markdown parsing functionality.
EOF

    # Edge case JSON with Unicode
    cat > "$TEST_DATA_DIR/json/edge-cases/unicode-special-chars-2kb.json" << 'EOF'
{
  "nodes": [
    {
      "id": "unicode-1",
      "name": "Unicode Test: 🌟✨🎯",
      "content": "Testing Unicode: αβγδε, 中文字符, العربية, עברית, русский",
      "created_at": "2024-01-01T10:00:00Z"
    },
    {
      "id": "emoji-2",
      "name": "Emoji Test 🏳️‍🌈👨‍💻📊",
      "content": "Complex emoji sequences: 👩‍👩‍👧‍👦 👨🏽‍💻 🏳️‍⚧️",
      "created_at": "2024-01-01T10:01:00Z"
    },
    {
      "id": "math-3",
      "name": "Mathematical Symbols ∑∫∇",
      "content": "Math: ∑(n=1 to ∞) 1/n² = π²/6, ∇²φ = 0, ∮ E⃗·dA⃗ = Q/ε₀",
      "created_at": "2024-01-01T10:02:00Z"
    },
    {
      "id": "special-4",
      "name": "Special Characters",
      "content": "Quotes: \"''"" Dashes: –—- Zero-width: \u200D\u2060\uFEFF",
      "created_at": "2024-01-01T10:03:00Z"
    }
  ]
}
EOF

    # Malformed JSON for error testing
    cat > "$TEST_DATA_DIR/json/edge-cases/malformed-json-1kb.json" << 'EOF'
{
  "nodes": [
    {
      "id": "node-1",
      "name": "Valid Node",
      "content": "This node is valid"
    },
    {
      "id": "node-2"
      "name": "Missing comma above",
      "content": "This should cause parsing error"
    }
    {
      "id": "node-3",
      "name": "Unterminated string,
      "content": "Missing quote above
    }
  ]
  "metadata": {
    "missing_comma": "above"
  }
EOF

    success "Sample datasets generated"
}

# Create CI/CD optimized dataset packages
create_ci_packages() {
    log "Creating CI/CD optimized dataset packages..."

    local ci_dir="$TEST_DATA_DIR/downloads/ci"

    # Create fast test package (small files only)
    local fast_files=(
        "$TEST_DATA_DIR/json/simple/simple-basic-nodes-1kb.json"
        "$TEST_DATA_DIR/markdown/simple/simple-document-2kb.md"
        "$TEST_DATA_DIR/json/edge-cases/unicode-special-chars-2kb.json"
    )

    tar -czf "$ci_dir/fast-test-package.tar.gz" "${fast_files[@]}" 2>/dev/null || true

    # Create metadata for CI packages
    cat > "$ci_dir/packages.json" << 'EOF'
{
  "packages": [
    {
      "name": "fast-test-package.tar.gz",
      "description": "Small datasets for quick CI testing",
      "file_count": 3,
      "total_size_bytes": 4096,
      "formats": ["json", "markdown"],
      "complexity_levels": ["simple", "edge-cases"],
      "download_time_estimate_seconds": 1,
      "recommended_for": ["PR_validation", "quick_smoke_tests"]
    }
  ],
  "usage": {
    "download": "wget https://github.com/mshaler/isometry/raw/main/test-data/downloads/ci/fast-test-package.tar.gz",
    "extract": "tar -xzf fast-test-package.tar.gz",
    "cleanup": "rm -rf test-data/"
  }
}
EOF

    success "CI/CD packages created"
}

# Setup download optimization for CI/CD
setup_download_optimization() {
    log "Setting up download optimization..."

    # Create download script for CI
    cat > "$TEST_DATA_DIR/downloads/download-for-ci.sh" << 'EOF'
#!/bin/bash
# CI/CD Test Data Download Script
# Downloads optimized test datasets for continuous integration

set -euo pipefail

PACKAGE=${1:-fast}
BASE_URL=${GITHUB_RAW_URL:-"https://github.com/mshaler/isometry/raw/main/test-data/downloads/ci"}

case "$PACKAGE" in
    fast)
        echo "Downloading fast test package..."
        wget -q "$BASE_URL/fast-test-package.tar.gz"
        tar -xzf fast-test-package.tar.gz
        echo "Fast test data ready (3 files, ~4KB)"
        ;;
    full)
        echo "Downloading full test package..."
        git lfs pull --include="test-data/**"
        echo "Full test data ready"
        ;;
    *)
        echo "Usage: $0 {fast|full}"
        echo "  fast: Small dataset for quick testing"
        echo "  full: Complete dataset with Git LFS"
        exit 1
        ;;
esac
EOF

    chmod +x "$TEST_DATA_DIR/downloads/download-for-ci.sh"

    # Create GitHub Actions cache optimization
    cat > "$TEST_DATA_DIR/downloads/.github-actions-cache.yml" << 'EOF'
# GitHub Actions cache configuration for test data
# Add this to your .github/workflows/test.yml

cache_config:
  test_data:
    key: "test-data-v1-{{ hashFiles('test-data/**/*.json', 'test-data/**/*.md') }}"
    paths:
      - "test-data/downloads/cache/"
    restore_keys:
      - "test-data-v1-"

  # For LFS files
  lfs_data:
    key: "lfs-data-v1-{{ hashFiles('.gitattributes') }}"
    paths:
      - ".git/lfs/"
    restore_keys:
      - "lfs-data-v1-"

optimization_tips:
  - Use sparse-checkout for CI to only download needed test data
  - Cache Git LFS objects between runs
  - Use fast-test-package for PR validation
  - Only pull full LFS data for release testing
EOF

    success "Download optimization configured"
}

# Cleanup old datasets
cleanup_old_datasets() {
    log "Cleaning up datasets older than $CLEANUP_DAYS days..."

    local cleaned_files=0
    local total_size_saved=0

    # Find and remove old temporary files
    find "$TEST_DATA_DIR" -name "*.tmp" -o -name "*.temp" -o -name ".DS_Store" -delete 2>/dev/null || true

    # Find large files older than cleanup threshold
    if [ -d "$TEST_DATA_DIR" ]; then
        while IFS= read -r -d '' file; do
            if [ -f "$file" ]; then
                local file_size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
                local file_age_days=$(( ($(date +%s) - $(stat -c%Y "$file" 2>/dev/null || stat -f%m "$file" 2>/dev/null || echo 0)) / 86400 ))

                # Remove files larger than 10MB and older than cleanup threshold
                if [ "$file_size" -gt 10485760 ] && [ "$file_age_days" -gt "$CLEANUP_DAYS" ]; then
                    log "Removing old large file: $(basename "$file") ($(( file_size / 1024 / 1024 ))MB, ${file_age_days}d old)"
                    rm "$file"
                    cleaned_files=$((cleaned_files + 1))
                    total_size_saved=$((total_size_saved + file_size))
                fi
            fi
        done < <(find "$TEST_DATA_DIR" -type f -print0 2>/dev/null)
    fi

    if [ "$cleaned_files" -gt 0 ]; then
        success "Cleaned up $cleaned_files files, saved $(( total_size_saved / 1024 / 1024 ))MB"
    else
        success "No cleanup needed"
    fi
}

# Validate repository structure
validate_repository() {
    log "Validating repository structure..."

    local errors=0

    # Check Git LFS installation
    if ! command -v git-lfs >/dev/null 2>&1; then
        error "Git LFS is not installed"
        errors=$((errors + 1))
    fi

    # Check .gitattributes exists
    if [ ! -f .gitattributes ]; then
        warning ".gitattributes file not found"
        errors=$((errors + 1))
    fi

    # Check test data directory structure
    local required_dirs=(
        "$TEST_DATA_DIR/json"
        "$TEST_DATA_DIR/markdown"
        "$TEST_DATA_DIR/html"
        "$TEST_DATA_DIR/sqlite"
        "$TEST_DATA_DIR/downloads/ci"
    )

    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            warning "Required directory missing: $dir"
            errors=$((errors + 1))
        fi
    done

    # Check for README files
    if [ ! -f "$TEST_DATA_DIR/README.md" ]; then
        warning "Main README.md missing in test data directory"
        errors=$((errors + 1))
    fi

    # Check CI download script
    if [ ! -x "$TEST_DATA_DIR/downloads/download-for-ci.sh" ]; then
        warning "CI download script missing or not executable"
        errors=$((errors + 1))
    fi

    if [ "$errors" -eq 0 ]; then
        success "Repository structure validation passed"
    else
        warning "Repository structure validation found $errors issues"
    fi

    return $errors
}

# Display usage information
show_usage() {
    cat << 'EOF'
ETL Test Data Setup Script

USAGE:
    ./scripts/etl-test-data-setup.sh [OPTIONS]

OPTIONS:
    --help, -h          Show this help message
    --cleanup           Clean up old datasets and optimize storage
    --validate          Validate repository structure
    --ci-only           Setup only CI/CD optimizations
    --generate-samples  Generate sample test datasets
    --force             Force reinstallation of Git LFS

EXAMPLES:
    # Full setup (recommended for new repositories)
    ./scripts/etl-test-data-setup.sh

    # Clean up old datasets
    ./scripts/etl-test-data-setup.sh --cleanup

    # Validate current setup
    ./scripts/etl-test-data-setup.sh --validate

    # Setup CI/CD optimizations only
    ./scripts/etl-test-data-setup.sh --ci-only

DESCRIPTION:
    This script sets up Git LFS for efficient test data management,
    creates organized directory structure, and optimizes for CI/CD usage.

    The script:
    1. Installs and configures Git LFS
    2. Creates organized test data directory structure
    3. Generates sample test datasets
    4. Sets up CI/CD download optimization
    5. Creates documentation and README files

    Test data is organized by format (JSON, Markdown, HTML, SQLite, Office)
    and complexity (simple, moderate, complex, stress, edge-cases).

    Files larger than 1MB are automatically tracked with Git LFS for
    efficient version control and faster CI/CD downloads.

EOF
}

# Main execution
main() {
    local do_cleanup=false
    local do_validate=false
    local ci_only=false
    local generate_samples=false
    local force_install=false

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_usage
                exit 0
                ;;
            --cleanup)
                do_cleanup=true
                shift
                ;;
            --validate)
                do_validate=true
                shift
                ;;
            --ci-only)
                ci_only=true
                shift
                ;;
            --generate-samples)
                generate_samples=true
                shift
                ;;
            --force)
                force_install=true
                shift
                ;;
            *)
                error "Unknown option: $1. Use --help for usage information."
                ;;
        esac
    done

    # Show header
    echo
    echo "🔧 ETL Test Data Setup for Isometry Project"
    echo "=============================================="
    echo

    # Check git repository
    check_git_repo

    # Handle specific operations
    if [ "$do_cleanup" = true ]; then
        cleanup_old_datasets
        exit 0
    fi

    if [ "$do_validate" = true ]; then
        validate_repository
        exit $?
    fi

    # Full setup process
    log "Starting ETL test data repository setup..."

    # Install and configure Git LFS
    if [ "$force_install" = true ] || ! command -v git-lfs >/dev/null 2>&1; then
        install_git_lfs
    fi

    initialize_git_lfs
    configure_lfs_tracking

    if [ "$ci_only" = false ]; then
        # Create directory structure and documentation
        create_directory_structure
        create_documentation

        # Generate sample datasets if requested or if this is initial setup
        if [ "$generate_samples" = true ] || [ ! -f "$TEST_DATA_DIR/json/simple/simple-basic-nodes-1kb.json" ]; then
            generate_sample_datasets
        fi
    fi

    # Setup CI/CD optimizations
    setup_download_optimization
    create_ci_packages

    # Final validation
    if validate_repository; then
        echo
        success "🎉 ETL test data repository setup completed successfully!"
        echo
        echo "Next steps:"
        echo "1. Commit the changes: git add . && git commit -m 'Setup ETL test data repository with Git LFS'"
        echo "2. Push to remote: git push"
        echo "3. Add test datasets to the appropriate directories"
        echo "4. Run regression tests: see native/Tests/IsometryTests/ETL/"
        echo
        echo "For CI/CD usage:"
        echo "- Fast tests: ./test-data/downloads/download-for-ci.sh fast"
        echo "- Full tests: ./test-data/downloads/download-for-ci.sh full"
        echo
    else
        warning "Setup completed with validation issues. Please review and fix before proceeding."
    fi
}

# Execute main function with all arguments
main "$@"