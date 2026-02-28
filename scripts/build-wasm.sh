#!/bin/bash
set -euo pipefail

# Build custom sql.js WASM with FTS5 enabled
# Uses the sql.js repository's own Docker-based build process
# Emscripten version pinned to 5.0.0 (per sql.js .devcontainer/Dockerfile)
#
# Build order:
#   1. Docker (preferred, isolated environment)
#   2. Local emcc (if Docker not available)
#   3. Prints instructions if neither available

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/.build/sql.js"
OUTPUT_DIR="$PROJECT_ROOT/src/assets"

echo "=== Custom sql.js FTS5 Build ==="
echo "Build dir: $BUILD_DIR"
echo "Output dir: $OUTPUT_DIR"

# Clone sql.js if not already present
if [ ! -d "$BUILD_DIR" ]; then
    echo "Cloning sql.js..."
    mkdir -p "$(dirname "$BUILD_DIR")"
    git clone --depth 1 https://github.com/sql-js/sql.js.git "$BUILD_DIR"
fi

cd "$BUILD_DIR"

# Modify Makefile to enable FTS5
# The default CFLAGS include FTS3 but NOT FTS5
echo "Patching Makefile for FTS5..."
if grep -q "SQLITE_ENABLE_FTS5" Makefile; then
    echo "FTS5 already enabled in Makefile"
else
    sed -i.bak 's/-DSQLITE_ENABLE_FTS3_PARENTHESIS/-DSQLITE_ENABLE_FTS3_PARENTHESIS -DSQLITE_ENABLE_FTS5/' Makefile
    echo "FTS5 flag added to Makefile CFLAGS"
fi

BUILD_SUCCESS=0

# Attempt Docker build (preferred — isolated, uses pinned Emscripten 5.0.0)
if command -v docker &>/dev/null; then
    echo "Attempting Docker build with emscripten/emsdk:5.0.0..."
    npm install
    docker run --rm -v "$BUILD_DIR":/src -w /src emscripten/emsdk:5.0.0 \
        bash -c "make dist/sql-wasm.js"
    BUILD_SUCCESS=1
    echo "Docker build succeeded!"
fi

# Fallback: local emcc (e.g., installed via Homebrew)
if [ "$BUILD_SUCCESS" -eq 0 ] && command -v emcc &>/dev/null; then
    echo "Docker not found. Attempting local emcc build..."
    echo "  emcc version: $(emcc --version 2>&1 | head -1)"
    npm install

    # macOS lacks sha3sum; pre-extract SQLite amalgamation if not already done
    SQLITE_DIR="sqlite-src/sqlite-amalgamation-3490100"
    if [ ! -f "$SQLITE_DIR/sqlite3.c" ]; then
        echo "Downloading SQLite amalgamation..."
        mkdir -p cache
        curl -LsSf 'https://sqlite.org/2025/sqlite-amalgamation-3490100.zip' \
            -o cache/sqlite-amalgamation-3490100.zip
        curl -LsSf 'https://www.sqlite.org/contrib/download/extension-functions.c?get=25' \
            -o cache/extension-functions.c
        mkdir -p "$SQLITE_DIR"
        unzip -o cache/sqlite-amalgamation-3490100.zip -d sqlite-src/
        cp cache/extension-functions.c "$SQLITE_DIR/extension-functions.c"
    fi
    # Touch to satisfy make dependency check (sha3sum not available on macOS)
    touch "$SQLITE_DIR"

    make dist/sql-wasm.js
    BUILD_SUCCESS=1
    echo "Local emcc build succeeded!"
fi

if [ "$BUILD_SUCCESS" -eq 0 ]; then
    echo "ERROR: No build tool available (Docker or local emcc required)."
    echo ""
    echo "Option 1 — Install Docker:"
    echo "  https://www.docker.com/products/docker-desktop/"
    echo "  Then run: bash $SCRIPT_DIR/build-wasm.sh"
    echo ""
    echo "Option 2 — Install Emscripten locally:"
    echo "  brew install emscripten   # macOS Homebrew"
    echo "  # or via emsdk:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk && ./emsdk install 5.0.0 && ./emsdk activate 5.0.0"
    echo "  source emsdk_env.sh"
    echo "  Then run: bash $SCRIPT_DIR/build-wasm.sh"
    exit 1
fi

# Copy artifacts to project
mkdir -p "$OUTPUT_DIR"
cp "$BUILD_DIR/dist/sql-wasm.wasm" "$OUTPUT_DIR/sql-wasm-fts5.wasm"
cp "$BUILD_DIR/dist/sql-wasm.js" "$OUTPUT_DIR/sql-wasm-fts5.js"

echo ""
echo "=== Build Complete ==="
echo "Artifacts:"
echo "  $OUTPUT_DIR/sql-wasm-fts5.wasm ($(du -h "$OUTPUT_DIR/sql-wasm-fts5.wasm" | cut -f1))"
echo "  $OUTPUT_DIR/sql-wasm-fts5.js"
echo ""
echo "Verify FTS5: node -e \""
echo "  const initSqlJs = require('sql.js');"
echo "  const fs = require('fs');"
echo "  initSqlJs({ wasmBinary: fs.readFileSync('$OUTPUT_DIR/sql-wasm-fts5.wasm') }).then(SQL => {"
echo "    const db = new SQL.Database();"
echo "    const r = db.exec(\\\"SELECT compile_options FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'\\\");"
echo "    console.log('FTS5 present:', r.length > 0 && r[0].values.length > 0);"
echo "    db.close();"
echo "  });"
echo "\""
