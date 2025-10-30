# Code Signing Setup Guide

## Prerequisites

1. **Apple Developer Account** ($99/year)
2. **Xcode Command Line Tools** installed
3. **Keychain Access** application

## Step 1: Obtain Developer ID Certificate

1. Log in to [Apple Developer Portal](https://developer.apple.com)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **+** to create new certificate
4. Select **Developer ID Application**
5. Follow instructions to create Certificate Signing Request (CSR)
6. Download certificate and double-click to install in Keychain

## Step 2: Find Your Certificate Name

```bash
security find-identity -v -p codesigning
```

Look for: `"Developer ID Application: Your Name (TEAM_ID)"`

## Step 3: Update tauri.conf.json

Replace `YOUR_NAME` and `TEAM_ID` in `tauri.conf.json` with your actual values:

```json
{
  "signingIdentity": "Developer ID Application: John Doe (ABC123XYZ)"
}
```

## Step 4: Test Signing

```bash
npm run tauri:build
codesign -dv --verbose=4 src-tauri/target/release/bundle/macos/Taskerino.app
```

Expected output: `Signature=adhoc` or certificate name

## Step 5: Verify Gatekeeper

```bash
spctl --assess --verbose=4 src-tauri/target/release/bundle/macos/Taskerino.app
```

Expected: `accepted` (if signed with Developer ID)

## Step 6: Notarization (Optional, for Distribution)

```bash
xcrun notarytool submit src-tauri/target/release/bundle/macos/Taskerino.dmg \
  --apple-id YOUR_APPLE_ID \
  --password APP_SPECIFIC_PASSWORD \
  --team-id YOUR_TEAM_ID \
  --wait
```

**Note**: Requires app-specific password from Apple ID settings.

## Troubleshooting

### "No identity found"
- Ensure certificate installed in Keychain
- Run `security find-identity -v -p codesigning`

### "Signature invalid"
- Verify entitlements.plist exists
- Check certificate not expired

### Gatekeeper rejection
- Sign with Developer ID (not "Mac Development")
- Notarize for macOS 10.15+

## For CI/CD

Set GitHub secrets:
- `CERTIFICATE_BASE64`: Certificate exported as base64
- `CERTIFICATE_PASSWORD`: Certificate password
- `APPLE_ID`: Your Apple ID email
- `APPLE_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Team ID from Developer Portal
