#!/bin/bash
# Pre-Release Validation Script for Taskerino
# Run this before building a production release

set -e  # Exit on any error

echo "🚀 Taskerino Pre-Release Validation"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print error
error() {
    echo -e "${RED}✗ ERROR: $1${NC}"
    ERRORS=$((ERRORS + 1))
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠ WARNING: $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

# Function to print success
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

echo "📋 Step 1: Version Consistency Check"
echo "------------------------------------"

# Extract versions from different files
PKG_VERSION=$(node -p "require('./package.json').version")
TAURI_VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")
CARGO_VERSION=$(grep '^version = ' src-tauri/Cargo.toml | head -1 | cut -d'"' -f2)

echo "  package.json: $PKG_VERSION"
echo "  tauri.conf.json: $TAURI_VERSION"
echo "  Cargo.toml: $CARGO_VERSION"

if [ "$PKG_VERSION" = "$TAURI_VERSION" ] && [ "$PKG_VERSION" = "$CARGO_VERSION" ]; then
    success "All versions match: $PKG_VERSION"
else
    error "Version mismatch detected!"
fi

# Check if version is not 0.0.0
if [ "$PKG_VERSION" = "0.0.0" ]; then
    error "Version is still 0.0.0 - please update to proper semantic version"
fi

echo ""
echo "📋 Step 2: Dependency Check"
echo "------------------------------------"

# Check for node_modules
if [ ! -d "node_modules" ]; then
    error "node_modules not found. Run: npm install"
else
    success "node_modules present"
fi

# Check for package-lock.json
if [ ! -f "package-lock.json" ]; then
    warning "package-lock.json not found - dependency versions not locked"
else
    success "package-lock.json present"
fi

echo ""
echo "📋 Step 3: Linting"
echo "------------------------------------"

if npm run lint --silent 2>&1 | grep -q "error"; then
    error "Linting errors found. Run: npm run lint"
else
    success "No linting errors"
fi

echo ""
echo "📋 Step 4: TypeScript Compilation"
echo "------------------------------------"

if npx tsc -b --noEmit 2>&1 | grep -q "error"; then
    error "TypeScript compilation errors found"
else
    success "TypeScript compiles without errors"
fi

echo ""
echo "📋 Step 5: Security Check"
echo "------------------------------------"

# Check for common security issues
if grep -r "sk-ant-api" src/ 2>/dev/null; then
    error "Potential hardcoded Claude API key found in source code!"
fi

if grep -r "sk-proj-" src/ 2>/dev/null; then
    error "Potential hardcoded OpenAI API key found in source code!"
fi

if [ ! -f ".env" ]; then
    warning ".env file not found (expected in development)"
else
    # Check if .env is in .gitignore
    if ! grep -q "^\.env$" .gitignore; then
        error ".env file exists but not in .gitignore!"
    fi
fi

success "No obvious security issues found"

echo ""
echo "📋 Step 6: Tauri Configuration"
echo "------------------------------------"

# Check for code signing identity
SIGNING_ID=$(node -p "require('./src-tauri/tauri.conf.json').bundle?.macOS?.signingIdentity || 'null'")
if [ "$SIGNING_ID" = "null" ]; then
    warning "Code signing identity not configured (macOS will show 'unidentified developer' warning)"
else
    success "Code signing configured: $SIGNING_ID"
fi

echo ""
echo "📋 Step 7: Build Artifacts Cleanup"
echo "------------------------------------"

# Clean old builds
if [ -d "dist" ]; then
    echo "  Removing old dist/ directory"
    rm -rf dist
fi

if [ -d "src-tauri/target/release" ]; then
    echo "  Removing old Rust release builds"
    rm -rf src-tauri/target/release
fi

success "Build directories cleaned"

echo ""
echo "📋 Step 8: Git Status Check"
echo "------------------------------------"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    warning "Uncommitted changes detected:"
    git status --short
    echo ""
    echo "  Consider committing or stashing changes before release"
else
    success "Working directory clean"
fi

# Check current branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "master" ]; then
    warning "Not on main/master branch (current: $BRANCH)"
else
    success "On release branch: $BRANCH"
fi

echo ""
echo "📋 Step 9: Documentation Check"
echo "------------------------------------"

# Check for critical documentation
if [ ! -f "README.md" ]; then
    error "README.md not found"
else
    success "README.md present"
fi

if [ ! -f "DEPLOYMENT.md" ]; then
    warning "DEPLOYMENT.md not found - deployment guide missing"
else
    success "DEPLOYMENT.md present"
fi

echo ""
echo "===================================="
echo "📊 Validation Summary"
echo "===================================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready to build.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run: npm run tauri:build"
    echo "  2. Sign and notarize the macOS app"
    echo "  3. Create GitHub release"
    echo "  4. Update user documentation"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found.${NC}"
    echo ""
    echo "You can proceed, but please review the warnings above."
    echo ""
    echo "Continue with build? [y/N]"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Proceeding with build..."
        exit 0
    else
        echo "Aborting."
        exit 1
    fi
else
    echo -e "${RED}✗ $ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
    echo ""
    echo "Please fix the errors above before proceeding with release."
    exit 1
fi
