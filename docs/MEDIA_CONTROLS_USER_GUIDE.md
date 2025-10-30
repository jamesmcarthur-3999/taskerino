# Media Controls User Guide

**Taskerino Advanced Media Controls**
Version 2.0 - Complete guide to audio and video recording features

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Audio Recording](#audio-recording)
4. [Video Recording](#video-recording)
5. [Picture-in-Picture (PiP) Mode](#picture-in-picture-pip-mode)
6. [Device Management](#device-management)
7. [Troubleshooting](#troubleshooting)
8. [macOS Permissions](#macos-permissions)
9. [FAQ](#faq)
10. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Overview

Taskerino's Media Controls provide comprehensive audio and video recording capabilities for your work sessions. Record high-quality screen captures, microphone input, system audio, and webcam feeds with full control over devices, quality, and composition.

### Key Features

- **Dual-Source Audio**: Record microphone and system audio simultaneously with real-time mixing
- **Multi-Display Recording**: Capture one or multiple displays at once
- **Picture-in-Picture**: Overlay your webcam on screen recordings with customizable position and size
- **Hot-Swapping**: Change devices mid-recording without stopping your session
- **Quality Presets**: From 720p/15fps to 4K/30fps with file size estimates
- **Adaptive Screenshots**: AI-driven screenshot intervals based on activity

---

## Getting Started

### Prerequisites

**Required:**
- macOS 12.3+ (for ScreenCaptureKit support)
- Apple Silicon Mac (M1, M2, M3) or Intel Mac
- Screen Recording permission enabled
- Microphone permission enabled (for audio recording)
- Camera permission enabled (for webcam recording)

**Recommended:**
- At least 8GB RAM
- 10GB+ free disk space for recordings
- External microphone for better audio quality

### First-Time Setup

1. **Grant Permissions**
   On first launch, Taskerino will request permissions:
   - **Screen Recording**: Required for video capture and screenshots
   - **Microphone**: Required for audio recording
   - **Camera**: Required for webcam/PiP features
   - **Accessibility**: Required for activity monitoring (optional)

2. **Test Your Devices**
   Before your first recording:
   - Navigate to Sessions zone
   - Click "Start Session"
   - Use the "Test Audio" button to verify microphone levels
   - Select your preferred webcam and test the preview

3. **Choose Quality Settings**
   Select a quality preset based on your needs:
   - **Low (720p, 15fps)**: 0.5-1 GB/hour - Best for long sessions
   - **Medium (1080p, 15fps)**: 1-2 GB/hour - Recommended default
   - **High (1080p, 30fps)**: 2-4 GB/hour - Smooth motion
   - **Ultra (4K, 30fps)**: 4-8 GB/hour - Maximum quality

---

## Audio Recording

### Microphone Recording

**Setup:**
1. Enable "Audio Recording" toggle in the Sessions top bar
2. Click the dropdown arrow next to the Audio toggle
3. Select your preferred microphone from the device list

**Tips:**
- Use a dedicated external microphone for better quality
- Position mic 6-12 inches from your mouth
- Use a pop filter to reduce plosives
- Test audio levels before long recordings

### System Audio Recording

**What is System Audio?**
System audio captures all sounds playing on your Mac - music, video calls, browser audio, notification sounds, etc.

**Setup:**
1. Open the Start Session modal
2. Enable "Audio Recording"
3. Check "System Audio" under Audio Sources
4. Select your system audio output device

**How it Works:**
On macOS, Taskerino uses ScreenCaptureKit to capture system audio without requiring additional software like BlackHole or Loopback.

### Dual-Source Recording (Mic + System Audio)

**The Balance Slider:**
When both microphone and system audio are enabled, use the balance slider to mix the sources:

```
0% ←────────── 50% ──────────→ 100%
(Mic only)   (Equal mix)   (System only)
```

**Use Cases:**
- **0-25%**: Commentary over music (emphasize your voice)
- **50%**: Equal mix for recording calls/meetings
- **75-100%**: Capture app audio with minimal mic bleed

**Real-Time Adjustment:**
The balance can be changed during recording via Device Settings panel without restarting the session.

### Audio Level Meters

Visual level meters show real-time audio input:
- **Green bars**: Healthy audio levels
- **Yellow bars**: Approaching peak
- **Red bars**: Clipping detected (reduce volume)

Aim for green bars that peak around 70-80% for optimal quality.

---

## Video Recording

### Display Recording

**Single Display:**
1. Enable "Video Recording" toggle
2. In the Start Session modal, ensure "Record specific window instead" is unchecked
3. Select your display from the multi-select grid
4. Click Start Recording

**Multiple Displays:**
1. In the Start Session modal, select multiple displays from the grid
2. All selected displays will be captured simultaneously
3. Videos are saved as separate files per display

**Display Identification:**
- **Primary display**: Marked with a star ⭐
- **Resolution labels**: Show native resolution (e.g., 1920×1080)
- **Live previews**: Thumbnails update every 5 seconds

### Window-Specific Recording

**When to Use:**
- Recording a specific app (e.g., coding demo in VS Code)
- Hiding desktop clutter from recordings
- Focusing viewer attention on one application

**Setup:**
1. Enable "Video Recording"
2. Check "Record specific window instead"
3. Select the window from the dropdown
4. Window must be visible and not minimized during recording

**Limitations:**
- Window switching will not be captured
- Minimizing the window may pause recording
- Some system windows cannot be captured

### Webcam-Only Recording

**Use Cases:**
- Recording yourself for video messages
- Creating talking-head videos
- Video journaling without screen content

**Setup:**
1. Enable "Video Recording"
2. Select your webcam device
3. Set webcam mode to "Standalone"
4. Choose your resolution and frame rate

---

## Picture-in-Picture (PiP) Mode

### What is PiP?

Picture-in-Picture overlays your webcam feed on your screen recording, creating professional-looking tutorial and presentation videos.

### PiP Configuration

**Position (4 options):**
```
┌─────────────────────┐
│ TL              TR  │  TL = Top Left
│                     │  TR = Top Right
│                     │  BL = Bottom Left
│ BL              BR  │  BR = Bottom Right
└─────────────────────┘
```

**Size Presets:**
- **Small**: 160×120 pixels (10% of screen) - Subtle presence
- **Medium**: 320×240 pixels (20% of screen) - Balanced (recommended)
- **Large**: 480×360 pixels (30% of screen) - Prominent

**Customization:**
- **Border Radius**: Rounded corners (default: 8px)
- **Margin**: Distance from screen edges (default: 20px)
- **Aspect Ratio**: Always preserved (no stretching)

### PiP Performance

**Optimizations:**
- GPU-accelerated via Metal (M1/M2/M3)
- Real-time composition at 60fps
- Memory usage: <50MB during active composition
- No performance impact on M1+ Macs

**Quality Tips:**
- Use good lighting for webcam (front-facing light source)
- Solid background reduces compression artifacts
- Position PiP where it doesn't cover important UI

### Changing PiP Mid-Recording

1. Expand "Device Settings" panel during active session
2. Use the Webcam Mode Selector to change:
   - Position (4 corners)
   - Size (S/M/L)
   - Mode (Off/PiP/Standalone)
3. Changes apply instantly without restarting

---

## Device Management

### Enumerating Devices

Taskerino automatically detects:
- **Audio Inputs**: Built-in mic, USB mics, audio interfaces, AirPods
- **Audio Outputs**: Built-in speakers, external speakers, headphones
- **Displays**: Built-in display, external monitors
- **Webcams**: FaceTime HD camera, external USB webcams
- **Windows**: All capturable application windows

**Refresh Devices:**
- Devices are re-enumerated each time you open the Start Session modal
- Newly connected devices appear immediately

### Hot-Swapping Devices

**What is Hot-Swapping?**
Change audio or video devices during an active recording without stopping the session.

**How to Hot-Swap:**
1. During active session, expand "Device Settings" panel
2. Select new device from dropdown
3. Recording continues seamlessly with new device

**Use Cases:**
- Microphone battery died → Switch to backup mic
- Better lighting in another room → Change webcam
- External monitor connected → Switch display source

**Limitations:**
- Brief audio gap (<100ms) during audio device switch
- Video switch may cause 1-frame stutter
- Hot-swapping is not available during enrichment processing

### Device Disconnection Handling

**Automatic Fallback:**
If a device is disconnected during recording:
1. Taskerino detects the disconnection
2. Automatically switches to default device
3. Warning indicator appears in Device Settings panel
4. Recording continues without data loss

**Manual Override:**
You can manually select a different device to override the fallback.

---

## Troubleshooting

### No Audio Recorded

**Symptoms:** Recording completes but audio file is silent or missing.

**Solutions:**
1. Check macOS Microphone permission:
   - System Settings → Privacy & Security → Microphone
   - Ensure Taskerino is checked
2. Verify device selection:
   - Open Start Session modal → Check selected audio device
   - Try selecting a different device
3. Test audio levels:
   - Use "Test Audio" button before recording
   - Ensure level meters show green bars when speaking
4. Check volume:
   - Increase microphone input volume in System Settings → Sound
   - Verify mic isn't muted (hardware switch on some mics)

### System Audio Not Capturing

**Symptoms:** System audio checkbox present but no audio captured.

**Solutions:**
1. macOS 12.3+ required:
   - Check macOS version: Apple menu → About This Mac
   - Update macOS if needed
2. Screen Recording permission:
   - System Settings → Privacy & Security → Screen Recording
   - Enable Taskerino
3. Audio output device:
   - Ensure system audio device is selected
   - Try selecting "Built-in Output" if using external speakers
4. App-specific audio:
   - Some DRM-protected apps (Netflix, Apple Music) may block capture
   - Try capturing from unprotected sources (YouTube, Spotify web)

### Video Recording Fails to Start

**Symptoms:** Click Start but video recording never begins, or immediate error.

**Solutions:**
1. Screen Recording permission:
   - System Settings → Privacy & Security → Screen Recording
   - Ensure Taskerino is enabled
   - **Important:** Restart Taskerino after granting permission
2. Display selection:
   - Ensure at least one display is selected in multi-select
   - Try selecting only the primary display
3. Window selection:
   - If recording window, ensure window is visible (not minimized)
   - Try recording display instead of window
4. Disk space:
   - Check available disk space (need 1-10GB depending on quality)
   - Free up space if running low
5. Performance:
   - Close other video-heavy apps (video editors, games)
   - Reduce quality preset to Medium or Low

### Webcam Not Showing / PiP Black Screen

**Symptoms:** Webcam dropdown empty, or PiP overlay shows black rectangle.

**Solutions:**
1. Camera permission:
   - System Settings → Privacy & Security → Camera
   - Enable Taskerino
2. Camera in use:
   - Close other apps using camera (Zoom, FaceTime, Photo Booth)
   - Disconnect and reconnect external webcam
3. Device enumeration:
   - Close and reopen Start Session modal to refresh devices
4. macOS bug workaround:
   - Restart Taskerino app
   - Restart Mac if persistent

### Poor Video Performance / Dropped Frames

**Symptoms:** Video playback is choppy, or recording stutters.

**Solutions:**
1. Reduce quality preset:
   - Use Medium (1080p/15fps) instead of Ultra (4K/30fps)
   - Lower frame rate reduces CPU/GPU load
2. Close background apps:
   - Quit video editors, games, and other GPU-intensive apps
3. Disable PiP if not needed:
   - Webcam overlay adds GPU load
4. Use single display:
   - Multi-display recording is more demanding
5. Check thermal throttling:
   - Ensure Mac has adequate cooling
   - On M1 Air (fanless), performance may reduce during long recordings
6. Update macOS:
   - Ensure latest macOS and Taskerino version

### Audio/Video Out of Sync

**Symptoms:** Audio lags or leads video during playback.

**Solutions:**
1. This is rare in Taskerino due to frame synchronization
2. If occurs:
   - Restart the app
   - Use a single audio source (mic or system, not both)
   - Report the issue with session details

---

## macOS Permissions

### Required Permissions

Taskerino requires the following macOS permissions:

#### Screen Recording
**Why?** Capture screenshots and video of your screen.

**How to Grant:**
1. System Settings → Privacy & Security → Screen Recording
2. Toggle on Taskerino
3. **Restart Taskerino** after granting

**Troubleshooting:**
- If permission is already granted but not working, try:
  1. Toggle it OFF, then back ON
  2. Restart Taskerino
  3. Restart Mac if issue persists

#### Microphone
**Why?** Record audio from your microphone.

**How to Grant:**
1. System Settings → Privacy & Security → Microphone
2. Toggle on Taskerino

#### Camera
**Why?** Access webcam for PiP and standalone recording.

**How to Grant:**
1. System Settings → Privacy & Security → Camera
2. Toggle on Taskerino

#### Accessibility (Optional)
**Why?** Monitor activity metrics for adaptive screenshot scheduling.

**How to Grant:**
1. System Settings → Privacy & Security → Accessibility
2. Click the + button
3. Navigate to Applications and select Taskerino
4. Click Open, then toggle on

**Note:** This is OPTIONAL. Without it, adaptive screenshots use fallback timing.

### Permission Denied Error

**If Taskerino cannot request permissions:**
1. Quit Taskerino completely
2. Open System Settings → Privacy & Security
3. Manually add Taskerino to each required permission
4. Restart Taskerino

**Corporate Macs:**
If your Mac is managed by an organization, IT may restrict permission changes. Contact your IT admin.

---

## FAQ

### Q: Can I record just audio without video or screenshots?

**A:** Yes! Disable both "Screenshots" and "Video Recording", keep only "Audio Recording" enabled. This creates audio-only sessions perfect for journaling or meeting notes.

---

### Q: How much disk space do recordings use?

**A:** It depends on quality and session length:

| Quality Preset | Resolution | FPS | Storage per Hour |
|----------------|------------|-----|------------------|
| Low            | 720p       | 15  | 0.5 - 1 GB       |
| Medium         | 1080p      | 15  | 1 - 2 GB         |
| High           | 1080p      | 30  | 2 - 4 GB         |
| Ultra          | 4K         | 30  | 4 - 8 GB         |

**Screenshots:** ~200KB each, ~30 per hour with adaptive mode

**Audio:** ~10MB per hour (16kHz mono WAV)

---

### Q: Can I edit recordings after the session ends?

**A:** Recordings are stored as standard files:
- **Video**: H.264/H.265 MP4 files
- **Audio**: WAV files (uncompressed)
- **Screenshots**: PNG files

You can edit them with any video/audio editor (Final Cut Pro, Adobe Premiere, Audacity, etc.).

---

### Q: Does recording impact my Mac's performance?

**A:** Minimal impact on Apple Silicon (M1/M2/M3):
- **CPU**: <15% during full recording (screen + audio + PiP)
- **GPU**: <20% during PiP composition
- **Memory**: ~200MB for active session
- **Battery**: ~25% drain per hour on M1 MacBook Pro

Intel Macs may experience higher CPU/GPU usage.

---

### Q: Can I record multiple sessions simultaneously?

**A:** No, only one active session at a time. You must end the current session before starting a new one.

---

### Q: What happens if I close Taskerino during a recording?

**A:** The app prompts to save your session. If you force-quit:
- Recordings up to that point are saved
- Session is marked as incomplete
- You can resume editing/reviewing the partial session

---

### Q: Can I use Bluetooth headphones for audio recording?

**A:** Yes, but be aware:
- **Bluetooth mic quality**: Lower than wired mics due to compression
- **Latency**: May introduce slight audio delay
- **Recommendation**: Use wired mic for best quality, Bluetooth headphones for monitoring

---

### Q: Does Taskerino support 4K webcams?

**A:** Yes, if your webcam supports 4K. However:
- PiP overlay is resized to Small/Medium/Large presets
- Recording standalone webcam can capture full 4K
- Higher resolution = larger file sizes

---

### Q: Can I record in portrait mode?

**A:** Taskerino always records in the native display orientation. For portrait content:
1. Rotate your external display to portrait
2. Record the rotated display
3. Or rotate video in post-processing

---

### Q: How do I reduce file sizes?

**A:**
1. Use Lower quality presets (Low or Medium)
2. Reduce frame rate (15fps vs 30fps)
3. Use H.265 codec (smaller than H.264, but less compatible)
4. Disable PiP if not needed
5. Use adaptive screenshots instead of fixed intervals
6. Compress videos after recording with Handbrake or similar

---

### Q: Are my recordings private?

**A:** Yes, 100% local:
- All recordings stored on your Mac's file system
- No cloud upload (unless you enable session enrichment with OpenAI)
- Audio transcription is local-only by default
- See Privacy settings for AI enrichment options

---

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ + 1` | Navigate to Capture Zone |
| `⌘ + 2` | Navigate to Tasks Zone |
| `⌘ + 3` | Navigate to Library Zone |
| `⌘ + 4` | Navigate to Sessions Zone |
| `⌘ + 5` | Navigate to Assistant Zone |
| `⌘ + ,` | Open Settings (Profile Zone) |
| `⌘ + K` | Open Command Palette |
| `⌘ + J` | Toggle Ned AI Assistant |
| `⌘ + /` | Show Keyboard Shortcuts Help |

### Sessions Zone Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Start/Stop Session (when in Sessions zone) |
| `P` | Pause/Resume Active Session |
| `D` | Open Device Settings (during active session) |
| `Esc` | Close modals/panels |

### Media Control Shortcuts (Planned)

**Note:** The following shortcuts were planned in Stage 8 but are not yet implemented. They will be added in a future update.

| Shortcut | Action (Planned) |
|----------|------------------|
| `⌘ + R` | Start Recording (Quick Start) |
| `⌘ + E` | End Recording (Stop Session) |
| `⌘ + D` | Open Device Settings |
| `⌘ + Shift + A` | Toggle Audio Recording |
| `⌘ + Shift + V` | Toggle Video Recording |

### Modal Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Confirm action (when modal focused) |
| `Esc` | Cancel / Close modal |
| `Tab` | Navigate between form fields |
| `←` `→` | Adjust sliders (when focused) |

---

## Tips & Best Practices

### For High-Quality Recordings

1. **Audio:**
   - Use external USB mic over built-in
   - Record in quiet environment
   - Speak 6-12 inches from mic
   - Test levels before long recordings

2. **Video:**
   - Close unnecessary applications
   - Use Medium preset for 1-2 hour sessions
   - Enable PiP only when you'll be on camera
   - Clean up desktop before recording

3. **Performance:**
   - Plug in power adapter (don't record on battery)
   - Close Chrome/Safari tabs you don't need
   - Disable notifications during recording
   - Use single display if multi-monitor not required

### For Long Sessions (2+ hours)

1. Check available disk space (10GB+ recommended)
2. Use Medium or Low quality preset
3. Test recording for 5 minutes first
4. Monitor battery if unplugged
5. Consider splitting into multiple shorter sessions

### For Tutorials/Demos

1. Enable PiP at bottom-right, Medium size
2. Use High quality preset (1080p/30fps)
3. Clean up desktop and hide personal info
4. Rehearse key demo steps before recording
5. Use system audio to capture app sounds

### For Meetings/Calls

1. Enable both mic and system audio
2. Set balance to 50% (equal mix)
3. Use adaptive screenshots to catch key moments
4. Record window-specific if call is in dedicated app
5. Consider audio-only mode to save disk space

---

## Getting Help

### Support Resources

- **Documentation**: `/docs` folder in Taskerino repository
- **GitHub Issues**: Report bugs and request features
- **Discord Community**: Join for live help (link in README)
- **Email Support**: support@taskerino.app

### Reporting Bugs

When reporting media control issues, include:
1. macOS version
2. Mac model (M1/M2/M3 or Intel)
3. Taskerino version
4. Steps to reproduce
5. Error messages (if any)
6. System log (Console app → Taskerino)

---

## What's Next?

**Upcoming Features:**
- Cloud backup for recordings
- Live streaming to YouTube/Twitch
- Multi-track audio editing
- AI-powered video editing suggestions
- Team collaboration on recordings
- Mobile app for remote control

Stay tuned for updates!

---

**Last Updated:** 2025-01-23
**Taskerino Version:** 2.0
**Platform:** macOS 12.3+ (Apple Silicon & Intel)
