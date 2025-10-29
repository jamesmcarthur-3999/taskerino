#!/bin/bash

# FrameSynchronizer Stress Test Runner
# Compiles and runs all stress tests, collecting metrics

set -e

echo "========================================"
echo "FrameSynchronizer Stress Test Suite"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$SCRIPT_DIR/../.."

echo "Compiling test executable..."
echo ""

# Compile all source files + test files
swiftc -o "$SCRIPT_DIR/stress_tests" \
    -import-objc-header "$ROOT_DIR/ScreenRecorder.h" \
    "$ROOT_DIR/Core/RecordingSource.swift" \
    "$ROOT_DIR/Core/FrameSynchronizer.swift" \
    "$SCRIPT_DIR/FrameSyncLongRunTests.swift" \
    "$SCRIPT_DIR/FrameSync4SourceTests.swift" \
    "$SCRIPT_DIR/FrameSyncDropoutTests.swift" \
    "$SCRIPT_DIR/FrameSyncPerformanceTests.swift" \
    -framework XCTest \
    -framework CoreMedia \
    -framework CoreVideo \
    -framework Foundation \
    -target arm64-apple-macosx12.3 \
    -Xlinker -rpath -Xlinker @executable_path

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Compilation successful${NC}"
    echo ""
else
    echo -e "${RED}✗ Compilation failed${NC}"
    exit 1
fi

echo "Running stress tests..."
echo ""

# Run the tests
"$SCRIPT_DIR/stress_tests"

echo ""
echo "========================================"
echo "Stress Tests Complete"
echo "========================================"
