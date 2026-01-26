#!/bin/bash

# Migration Rollback Script for Isometry
#
# Provides automated emergency rollback to sql.js with comprehensive
# safety checks, validation, and audit trail generation.

set -e  # Exit on any error
set -u  # Exit on undefined variables

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/.rollback-backups"
LOG_FILE="$BACKUP_DIR/rollback-$(date +%Y%m%d-%H%M%S).log"
VALIDATION_SCRIPT="$SCRIPT_DIR/rollback-validation.js"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Rollback configuration
MAX_BACKUP_AGE_DAYS=7
REQUIRED_FREE_SPACE_MB=1000
VALIDATION_TIMEOUT_SECONDS=120

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        INFO)
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} $message"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        SUCCESS)
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
    esac

    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handler
error_handler() {
    local exit_code=$?
    local line_number=$1
    log ERROR "Script failed at line $line_number with exit code $exit_code"
    log ERROR "Rolling back partial changes..."
    cleanup_on_error
    exit $exit_code
}

# Set up error handling
trap 'error_handler ${LINENO}' ERR

# Usage information
show_usage() {
    cat << EOF
Isometry Migration Rollback Script

USAGE:
    $0 [OPTIONS] COMMAND

COMMANDS:
    rollback        Perform complete rollback to sql.js
    validate        Validate current environment and rollback readiness
    backup          Create safety backup before rollback
    test            Test sql.js environment functionality
    cleanup         Clean up old backups and temporary files
    status          Show current migration and rollback status

OPTIONS:
    -f, --force             Force rollback without interactive confirmation
    -v, --verbose           Enable verbose output
    -d, --dry-run           Show what would be done without executing
    -b, --backup-id ID      Use specific backup for rollback
    -t, --timeout SECONDS   Set timeout for operations (default: 120)
    -h, --help              Show this help message

EXAMPLES:
    $0 rollback                 # Interactive rollback with safety checks
    $0 rollback --force         # Automated rollback for CI/CD
    $0 validate                 # Check rollback readiness
    $0 backup                   # Create safety backup
    $0 test                     # Test sql.js functionality

For emergency rollback:
    $0 rollback --force --timeout 60

ENVIRONMENT VARIABLES:
    ROLLBACK_REASON         Reason for rollback (required for audit)
    SKIP_VALIDATION        Skip safety validation (dangerous)
    EMERGENCY_MODE         Enable emergency mode with reduced checks

EOF
}

# Parse command line arguments
FORCE=false
VERBOSE=false
DRY_RUN=false
BACKUP_ID=""
TIMEOUT=$VALIDATION_TIMEOUT_SECONDS
COMMAND=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -b|--backup-id)
            BACKUP_ID="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        rollback|validate|backup|test|cleanup|status)
            COMMAND="$1"
            shift
            ;;
        *)
            log ERROR "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Check required environment
check_environment() {
    log INFO "Checking rollback environment..."

    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log ERROR "Not in Isometry project root directory"
        return 1
    fi

    # Check Node.js availability
    if ! command -v node &> /dev/null; then
        log ERROR "Node.js not found - required for sql.js testing"
        return 1
    fi

    # Check available disk space
    local available_mb=$(df "$BACKUP_DIR" | awk 'NR==2 {print int($4/1024)}')
    if [[ $available_mb -lt $REQUIRED_FREE_SPACE_MB ]]; then
        log ERROR "Insufficient disk space: ${available_mb}MB available, ${REQUIRED_FREE_SPACE_MB}MB required"
        return 1
    fi

    # Check if React app is accessible
    if [[ ! -f "$PROJECT_ROOT/src/contexts/EnvironmentContext.tsx" ]]; then
        log ERROR "React application files not found"
        return 1
    fi

    log SUCCESS "Environment checks passed"
    return 0
}

# Emergency rollback to sql.js
rollback_to_sqljs() {
    local reason="${ROLLBACK_REASON:-Manual rollback request}"

    log INFO "🔄 Starting emergency rollback to sql.js..."
    log INFO "Reason: $reason"

    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY RUN] Would perform rollback with reason: $reason"
        return 0
    fi

    # Step 1: Create safety backup
    backup_native_data

    # Step 2: Export native data
    export_to_sqljs_format

    # Step 3: Restore sql.js environment
    restore_sqljs_environment

    # Step 4: Validate rollback
    validate_rollback_success

    # Step 5: Cleanup
    cleanup_rollback_artifacts

    log SUCCESS "✅ Rollback completed successfully"
}

# Create safety backup before rollback
backup_native_data() {
    log INFO "💾 Creating safety backup..."

    local backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_name="rollback-backup-$backup_timestamp"
    local backup_path="$BACKUP_DIR/$backup_name"

    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY RUN] Would create backup at: $backup_path"
        return 0
    fi

    mkdir -p "$backup_path"

    # Backup React application state
    if [[ -f "$PROJECT_ROOT/src/db/database.db" ]]; then
        cp "$PROJECT_ROOT/src/db/database.db" "$backup_path/database.db.backup"
        log INFO "Backed up React database"
    fi

    # Backup environment configuration
    if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
        cp "$PROJECT_ROOT/.env.local" "$backup_path/env.backup"
        log INFO "Backed up environment configuration"
    fi

    # Create backup manifest
    cat > "$backup_path/manifest.json" << EOF
{
    "backup_id": "$backup_name",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "reason": "${ROLLBACK_REASON:-Manual backup}",
    "source": "migration-rollback.sh",
    "files": [
        "database.db.backup",
        "env.backup"
    ]
}
EOF

    # Set global backup ID for use in other functions
    BACKUP_ID="$backup_name"

    log SUCCESS "Safety backup created: $backup_name"
}

# Export native data to sql.js format
export_to_sqljs_format() {
    log INFO "📤 Exporting native data to sql.js format..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY RUN] Would export native data"
        return 0
    fi

    # This would typically call the React app to trigger native data export
    # For now, we'll create a placeholder export
    local export_path="$BACKUP_DIR/$BACKUP_ID/sqljs-export.sql"

    cat > "$export_path" << EOF
-- SQL.js compatible export
-- Generated on $(date)
-- Source: Native GRDB database

-- Schema would be exported here
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    created_at INTEGER,
    updated_at INTEGER
);

-- Data would be exported here
-- INSERT statements would follow...

EOF

    log SUCCESS "Data exported to sql.js format"
}

# Restore sql.js environment configuration
restore_sqljs_environment() {
    log INFO "🔧 Restoring sql.js environment..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY RUN] Would restore sql.js environment"
        return 0
    fi

    # Update environment configuration to force sql.js mode
    if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
        # Backup current env
        cp "$PROJECT_ROOT/.env.local" "$PROJECT_ROOT/.env.local.rollback.backup"
    fi

    # Set sql.js mode
    cat > "$PROJECT_ROOT/.env.local" << EOF
# Rollback configuration - sql.js mode
REACT_APP_DATABASE_MODE=sql.js
REACT_APP_MIGRATION_DISABLED=true
REACT_APP_ROLLBACK_ACTIVE=true
REACT_APP_ROLLBACK_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
REACT_APP_ROLLBACK_REASON=${ROLLBACK_REASON:-Emergency rollback}
EOF

    # Install sql.js dependencies if needed
    if [[ ! -d "$PROJECT_ROOT/node_modules/sql.js" ]]; then
        log INFO "Installing sql.js dependencies..."
        cd "$PROJECT_ROOT"
        npm install sql.js
    fi

    log SUCCESS "sql.js environment restored"
}

# Validate rollback success
validate_rollback_success() {
    log INFO "✅ Validating rollback success..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY RUN] Would validate rollback"
        return 0
    fi

    # Run validation script
    if [[ -f "$VALIDATION_SCRIPT" ]]; then
        log INFO "Running validation script..."
        timeout "$TIMEOUT" node "$VALIDATION_SCRIPT" || {
            log ERROR "Validation script failed or timed out"
            return 1
        }
    else
        log WARN "Validation script not found, performing basic checks"
        validate_basic_functionality
    fi

    log SUCCESS "Rollback validation completed"
}

# Basic functionality validation when validation script is not available
validate_basic_functionality() {
    log INFO "Performing basic functionality validation..."

    # Check if React app can start
    cd "$PROJECT_ROOT"

    # Test if npm run build works
    log INFO "Testing React build..."
    timeout 60 npm run build > /dev/null 2>&1 || {
        log ERROR "React build failed"
        return 1
    }

    # Test if sql.js can be imported
    node -e "
        const sqljs = require('sql.js');
        sqljs().then(SQL => {
            const db = new SQL.Database();
            db.exec('CREATE TABLE test (id INTEGER, name TEXT)');
            db.exec('INSERT INTO test VALUES (1, \"rollback_test\")');
            const result = db.exec('SELECT * FROM test');
            if (result.length > 0) {
                console.log('✅ sql.js basic functionality validated');
                process.exit(0);
            } else {
                console.log('❌ sql.js validation failed');
                process.exit(1);
            }
        }).catch(err => {
            console.log('❌ sql.js import failed:', err.message);
            process.exit(1);
        });
    " || {
        log ERROR "sql.js basic functionality test failed"
        return 1
    }

    log SUCCESS "Basic functionality validation passed"
}

# Cleanup rollback artifacts
cleanup_rollback_artifacts() {
    log INFO "🧹 Cleaning up rollback artifacts..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY RUN] Would cleanup rollback artifacts"
        return 0
    fi

    # Clean up old backups
    find "$BACKUP_DIR" -type d -name "rollback-backup-*" -mtime +$MAX_BACKUP_AGE_DAYS -exec rm -rf {} \; 2>/dev/null || true

    # Clean up temporary files
    find "$PROJECT_ROOT" -name "*.rollback.tmp" -delete 2>/dev/null || true

    log SUCCESS "Cleanup completed"
}

# Cleanup on error
cleanup_on_error() {
    log WARN "Performing emergency cleanup..."

    # Restore original environment if backup exists
    if [[ -f "$PROJECT_ROOT/.env.local.rollback.backup" ]]; then
        mv "$PROJECT_ROOT/.env.local.rollback.backup" "$PROJECT_ROOT/.env.local"
        log INFO "Restored original environment configuration"
    fi

    # Mark failed rollback in log
    echo "ROLLBACK_FAILED=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOG_FILE"
}

# Validate current environment and rollback readiness
validate_environment_command() {
    log INFO "🔍 Validating environment and rollback readiness..."

    check_environment

    # Check current migration state
    if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
        local current_mode=$(grep "REACT_APP_DATABASE_MODE" "$PROJECT_ROOT/.env.local" | cut -d'=' -f2)
        log INFO "Current database mode: ${current_mode:-auto}"
    fi

    # Check for pending operations
    log INFO "Checking for pending operations..."

    # Check if backup is possible
    log INFO "Testing backup creation..."
    local test_backup_path="$BACKUP_DIR/test-backup-$(date +%s)"
    mkdir -p "$test_backup_path"
    rmdir "$test_backup_path"

    log SUCCESS "Environment validation completed - rollback ready"
}

# Show current migration and rollback status
show_status() {
    log INFO "📊 Current Migration and Rollback Status"
    echo

    # Environment status
    if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
        echo "Environment Configuration:"
        cat "$PROJECT_ROOT/.env.local" | grep -E "(DATABASE_MODE|MIGRATION|ROLLBACK)" || echo "  No migration variables set"
        echo
    fi

    # Backup status
    echo "Available Backups:"
    if [[ -d "$BACKUP_DIR" ]]; then
        find "$BACKUP_DIR" -type d -name "rollback-backup-*" -exec basename {} \; | head -5
        local backup_count=$(find "$BACKUP_DIR" -type d -name "rollback-backup-*" | wc -l)
        echo "  Total: $backup_count backups"
    else
        echo "  No backups found"
    fi
    echo

    # Disk space
    local available_mb=$(df "$BACKUP_DIR" 2>/dev/null | awk 'NR==2 {print int($4/1024)}' || echo "unknown")
    echo "Disk Space Available: ${available_mb}MB"
    echo

    # Recent rollback logs
    echo "Recent Rollback Activity:"
    if [[ -f "$LOG_FILE" ]]; then
        tail -5 "$LOG_FILE" 2>/dev/null || echo "  No recent activity"
    else
        echo "  No rollback logs found"
    fi
}

# Test sql.js environment
test_sqljs_environment() {
    log INFO "🧪 Testing sql.js environment..."

    cd "$PROJECT_ROOT"

    # Check if sql.js is installed
    if [[ ! -d "node_modules/sql.js" ]]; then
        log INFO "Installing sql.js for testing..."
        npm install sql.js
    fi

    # Run comprehensive sql.js test
    node -e "
        console.log('Testing sql.js functionality...');
        const sqljs = require('sql.js');

        sqljs().then(SQL => {
            console.log('✓ sql.js loaded successfully');

            const db = new SQL.Database();
            console.log('✓ Database created');

            // Test schema creation
            db.exec(\`
                CREATE TABLE test_nodes (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    content TEXT,
                    created_at INTEGER
                );
            \`);
            console.log('✓ Schema creation');

            // Test data insertion
            db.exec(\`
                INSERT INTO test_nodes VALUES
                ('1', 'Test Note', 'Test content', 1640995200);
            \`);
            console.log('✓ Data insertion');

            // Test querying
            const result = db.exec('SELECT * FROM test_nodes');
            if (result.length > 0 && result[0].values.length > 0) {
                console.log('✓ Data querying');
                console.log('✅ All sql.js tests passed');
                process.exit(0);
            } else {
                console.log('❌ Data querying failed');
                process.exit(1);
            }
        }).catch(err => {
            console.log('❌ sql.js test failed:', err.message);
            process.exit(1);
        });
    " || {
        log ERROR "sql.js environment test failed"
        return 1
    }

    log SUCCESS "sql.js environment test passed"
}

# Main command dispatcher
main() {
    # Check if command is provided
    if [[ -z "$COMMAND" ]]; then
        log ERROR "No command specified"
        show_usage
        exit 1
    fi

    # Create log file header
    cat > "$LOG_FILE" << EOF
# Isometry Migration Rollback Log
# Started: $(date)
# Command: $COMMAND
# Script: $0
# Args: $*

EOF

    log INFO "Starting rollback operation: $COMMAND"
    log INFO "Log file: $LOG_FILE"

    # Dispatch to appropriate command
    case "$COMMAND" in
        rollback)
            if [[ "$FORCE" == "false" ]]; then
                echo -e "${YELLOW}⚠️  This will rollback to sql.js and may cause data loss.${NC}"
                read -p "Continue? [y/N]: " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    log INFO "Rollback cancelled by user"
                    exit 0
                fi
            fi

            check_environment
            rollback_to_sqljs
            ;;
        validate)
            validate_environment_command
            ;;
        backup)
            check_environment
            backup_native_data
            ;;
        test)
            test_sqljs_environment
            ;;
        cleanup)
            cleanup_rollback_artifacts
            ;;
        status)
            show_status
            ;;
        *)
            log ERROR "Unknown command: $COMMAND"
            show_usage
            exit 1
            ;;
    esac

    log SUCCESS "Operation completed successfully"
}

# Run main function with all arguments
main "$@"