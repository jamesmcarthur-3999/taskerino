# Taskerino v0.1.0 - Distribution Guide

## About Taskerino

Taskerino is a smart task and note management app with AI-powered features for macOS. It helps you capture, organize, and analyze your work sessions with automatic screenshots, audio recording, and intelligent task extraction.

## System Requirements

- **macOS**: 12.3 (Monterey) or later
- **Architecture**: Apple Silicon (M1/M2/M3) or Intel
- **Disk Space**: ~50 MB for app + space for session recordings

## Installation

### For End Users

1. **Download** the DMG file: `Taskerino_0.1.0_aarch64.dmg`

2. **Open** the DMG file by double-clicking it

3. **Drag** Taskerino.app to your Applications folder

4. **First Launch**:
   - Right-click on Taskerino.app in Applications
   - Select "Open" from the context menu
   - Click "Open" in the security dialog
   - (This is required for unsigned apps from outside the App Store)

5. **Grant Permissions** when prompted:
   - **Screen Recording**: Required for automatic screenshot capture during sessions
   - **Microphone**: Required for audio note recording and transcription

## First Run Setup

1. Launch Taskerino
2. You'll see a welcome flow guiding you through:
   - API key setup (OpenAI and/or Anthropic)
   - Feature overview
   - Settings configuration

3. API Keys are stored securely in your macOS Keychain

## Data Storage

All your data is stored locally on your Mac at:
```
~/Library/Application Support/com.taskerino.desktop/
```

This includes:
- `db/` - Task and session databases (JSON files)
- `attachments/` - Screenshots and files
- `videos/` - Session recordings
- `backups/` - Automatic backups
- `api_keys.json` - Encrypted API keys

## Features

- **Smart Task Management**: Create, organize, and track tasks
- **Session Recording**: Automatic screenshot and audio capture during work sessions
- **AI-Powered Analysis**: Intelligent task extraction from notes and recordings
- **Ned Assistant**: AI assistant that helps you review and analyze your work
- **Timeline View**: Visual timeline of all your activities
- **Search & Filter**: Powerful search across tasks, notes, and sessions

## Troubleshooting

### "App Can't Be Opened"
- Right-click the app and select "Open" (don't double-click)
- Go to System Settings > Privacy & Security and click "Open Anyway"

### Screen Recording Not Working
- Go to System Settings > Privacy & Security > Screen Recording
- Enable Taskerino in the list
- Restart the app

### Microphone Not Working
- Go to System Settings > Privacy & Security > Microphone
- Enable Taskerino in the list
- Restart the app

### App Crashes on Launch
- Check Console.app for error messages
- Delete app data: `~/Library/Application Support/com.taskerino.desktop/`
- Reinstall from DMG

## Uninstallation

1. Delete Taskerino.app from Applications folder
2. (Optional) Delete app data:
   ```bash
   rm -rf ~/Library/Application\ Support/com.taskerino.desktop/
   ```

## Privacy & Security

- **Local-First**: All data stored on your Mac, nothing sent to external servers (except API calls to OpenAI/Anthropic when you use AI features)
- **API Keys**: Stored encrypted in macOS Keychain
- **No Analytics**: We don't collect any usage data or telemetry
- **Open Permissions**: Only requests Screen Recording and Microphone access (only when you use those features)

## Support

For issues or questions:
- Email: support@taskerino.com (update this!)
- GitHub: https://github.com/yourusername/taskerino (update this!)

## Version History

### v0.1.0 (Initial Release)
- Smart task management
- Session recording with screenshots and audio
- AI-powered task extraction
- Ned AI assistant
- Timeline and analytics views

## License

MIT License - Copyright (c) 2025 James McArthur

## Credits

Built with:
- Tauri (Rust + TypeScript)
- React 19
- OpenAI API (GPT-4, Whisper)
- Anthropic Claude API
- TipTap Editor
