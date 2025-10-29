# GitHub Actions CI/CD Workflows

This directory contains three automated workflows for building, testing, and releasing Taskerino.

## Workflows Overview

### 1. Build Workflow (`build.yml`)

**Triggers**: Push to `main` or `develop`, or pull requests targeting these branches

**Purpose**: Validates code quality and ensures the app builds successfully

**Steps**:
1. Type checking with TypeScript (`npm run type-check`)
2. Linting with ESLint (`npm run lint`)
3. Frontend build with Vite (`npm run build`)
4. Tauri app build (`npm run tauri:build`)
5. Upload build artifacts (7-day retention)

**Artifacts**: Build outputs in `src-tauri/target/release/bundle/`

### 2. Test Workflow (`test.yml`)

**Triggers**: Pull requests targeting `main` or `develop`

**Purpose**: Runs automated tests for both TypeScript and Rust code

**Steps**:
1. TypeScript tests with Vitest (`npm test -- --run`)
2. Rust tests with Cargo (`cargo test`)
3. Upload test results and coverage
4. Optional: Upload coverage to Codecov

**Artifacts**: Test results and coverage reports (7-day retention)

### 3. Release Workflow (`release.yml`)

**Triggers**: Push of version tags (e.g., `v1.0.0`)

**Purpose**: Creates signed, notarized releases for macOS

**Steps**:
1. Import Apple Developer code signing certificate
2. Build and sign the Tauri app
3. Notarize with Apple (required for macOS Gatekeeper)
4. Staple notarization ticket to DMG
5. Create GitHub release (draft mode)
6. Upload release artifacts (30-day retention)

**Artifacts**: Signed and notarized `.dmg` and `.app.tar.gz` files

## Required GitHub Secrets

To use these workflows, configure the following secrets in your GitHub repository (`Settings > Secrets and variables > Actions`):

### Code Signing Secrets (Release Workflow)

| Secret Name | Description | How to Obtain |
|------------|-------------|---------------|
| `CERTIFICATE_BASE64` | Base64-encoded Developer ID Application certificate (.p12) | Export from Keychain Access, convert with `base64 -i certificate.p12 -o -` |
| `CERTIFICATE_PASSWORD` | Password for the .p12 certificate | Set when exporting from Keychain |
| `APPLE_ID` | Your Apple Developer account email | From Apple Developer account |
| `APPLE_PASSWORD` | App-specific password for notarization | Generate at appleid.apple.com |
| `APPLE_TEAM_ID` | Your Apple Developer Team ID | Find in Apple Developer portal |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater private key (optional) | Generate with `tauri signer generate` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for Tauri updater key (optional) | Set when generating key |

### Optional Secrets

| Secret Name | Description |
|------------|-------------|
| `CODECOV_TOKEN` | Codecov.io upload token (for coverage reports) |

## Setting Up Apple Developer Credentials

### 1. Export Code Signing Certificate

1. Open **Keychain Access** on macOS
2. Find your **Developer ID Application** certificate (not "Mac Developer")
3. Right-click → **Export "Developer ID Application: Your Name"**
4. Save as `.p12` with a strong password
5. Convert to Base64:
   ```bash
   base64 -i certificate.p12 -o certificate.txt
   ```
6. Copy the contents of `certificate.txt` to `CERTIFICATE_BASE64` secret
7. Copy the password to `CERTIFICATE_PASSWORD` secret
8. **DELETE** the `.p12` and `.txt` files (never commit these!)

### 2. Generate App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Navigate to **Security > App-Specific Passwords**
4. Click **Generate an app-specific password**
5. Label it "GitHub Actions Notarization"
6. Copy the generated password to `APPLE_PASSWORD` secret

### 3. Find Your Team ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Membership**
3. Copy your **Team ID** (10 characters, e.g., `AB12CD3456`)
4. Paste into `APPLE_TEAM_ID` secret

### 4. (Optional) Generate Tauri Updater Key

If you want to use Tauri's built-in updater:

```bash
npm run tauri signer generate
```

This generates a public/private key pair. Store the private key in `TAURI_SIGNING_PRIVATE_KEY` and its password in `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

## Testing Workflows Locally

### Test Build Workflow

```bash
# Install dependencies
npm install

# Run type check
npm run type-check

# Run linter
npm run lint

# Build frontend
npm run build

# Build Tauri app
npm run tauri:build
```

### Test Test Workflow

```bash
# Run TypeScript tests
npm test -- --run

# Run Rust tests
cd src-tauri && cargo test
```

### Test Release Workflow (Dry Run)

**Note**: You cannot fully test code signing/notarization locally without valid certificates.

```bash
# Build release (without signing)
npm run tauri:build

# Check output
ls -lh src-tauri/target/release/bundle/macos/
```

For full release testing, create a test tag in a fork:

```bash
git tag v0.0.1-test
git push origin v0.0.1-test
```

## Triggering Workflows

### Build Workflow

```bash
# Push to main or develop
git push origin main

# Or create a PR
git checkout -b feature/my-feature
git push origin feature/my-feature
# Open PR on GitHub
```

### Test Workflow

```bash
# Create a PR (triggers automatically)
gh pr create --title "My Feature" --body "Description"
```

### Release Workflow

```bash
# Tag a new version
git tag v1.0.0
git push origin v1.0.0

# The workflow creates a draft release
# Review it at: https://github.com/YOUR_USERNAME/taskerino/releases
```

## Workflow Status

Check workflow status at:
- `https://github.com/YOUR_USERNAME/taskerino/actions`

Or use GitHub CLI:

```bash
gh workflow list
gh run list --workflow=build.yml
gh run watch  # Watch latest run
```

## Troubleshooting

### Build Failures

**Problem**: Type check fails
- **Solution**: Run `npm run type-check` locally and fix TypeScript errors

**Problem**: Lint fails
- **Solution**: Run `npm run lint` locally and fix ESLint errors

**Problem**: Rust build fails
- **Solution**: Check Rust toolchain version (requires 1.77.2+)

### Test Failures

**Problem**: TypeScript tests fail
- **Solution**: Run `npm test` locally, check test output

**Problem**: Rust tests fail
- **Solution**: Run `cd src-tauri && cargo test` locally

### Release Failures

**Problem**: "No identity found" during code signing
- **Solution**: Verify `CERTIFICATE_BASE64` is correct, check keychain import step

**Problem**: Notarization fails with "Invalid credentials"
- **Solution**: Verify `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` are correct

**Problem**: Notarization succeeds but takes >30 minutes
- **Solution**: This is normal for first-time notarization. Subsequent builds are faster.

**Problem**: "Unable to find Developer ID Application certificate"
- **Solution**: Ensure you exported the **Developer ID Application** certificate (not "Mac Developer")

## Best Practices

1. **Always test locally** before pushing to `main`/`develop`
2. **Use draft releases** (default in workflow) to review before publishing
3. **Never commit certificates or secrets** to the repository
4. **Rotate app-specific passwords** annually
5. **Monitor workflow runs** for early failure detection
6. **Keep dependencies updated** (Node.js, Rust, actions)
7. **Run tests in PR reviews** before merging

## Security Notes

- All secrets are encrypted by GitHub and never exposed in logs
- Certificate files are deleted immediately after import
- Build artifacts are automatically deleted after retention period
- Use branch protection rules to require PR reviews and passing tests

## Cost Considerations

- GitHub Actions is free for public repositories
- For private repositories: 2000 minutes/month free (macOS uses 10x multiplier)
- Monitor usage at: `https://github.com/settings/billing`

## Further Reading

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Tauri Action Documentation](https://github.com/tauri-apps/tauri-action)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Code Signing Guide](https://tauri.app/v1/guides/distribution/sign-macos)

## Support

For issues with these workflows, check:
1. GitHub Actions logs (most detailed)
2. This README (common solutions)
3. Tauri Discord (community help)
4. GitHub Issues (bug reports)
