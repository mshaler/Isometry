#!/bin/bash

# Wrapper for native/Scripts/setup-production-certificates.sh
# Keeps historical path stable for automation and plan references.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

exec "$PROJECT_ROOT/native/Scripts/setup-production-certificates.sh" "$@"
