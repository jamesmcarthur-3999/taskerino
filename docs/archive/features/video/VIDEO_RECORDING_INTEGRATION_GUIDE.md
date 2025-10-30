# Video Recording Integration Guide

## Status: Backend Complete ✅ | Frontend Integration In Progress

## What's Complete

### Phase 1-2: Rust/Swift Backend ✅
- ✅ Swift ScreenRecorder module with ScreenCaptureKit
- ✅ C bridging header for FFI
- ✅ Rust FFI bridge in `video_recording.rs`
- ✅ Tauri commands registered in `lib.rs`
- ✅ Compilation verified (builds successfully)

### Phase 3: TypeScript Services ✅
- ✅ `videoRecordingService.ts` - Main API wrapper
- ✅ `videoStorageService.ts` - Storage & file management

## What's Remaining

### Phase 4: UI Integration (In Progress)

#### File: `src/components/SessionsZone.tsx`

**Required Changes:**

1. **Add Imports** (lines 3-8)
   ```typescript
   // Add Video icon to line 3:
   import { ..., Video } from 'lucide-react';

   // Add after line 7:
   import { videoRecordingService } from '../services/videoRecordingService';
   import { videoStorageService } from '../services/videoStorageService';
   ```

2. **Add Video Recording State** (around line 380-390)
   ```typescript
   // Add similar to audio recording logic:

   // Handle video recording based on videoRecording setting
   if (activeSession.videoRecording) {
     console.log('🎬 [SESSIONS ZONE] Starting video recording');
     videoRecordingService.startRecording(activeSession)
       .catch(error => {
         console.error('❌ [SESSIONS ZONE] Failed to start video recording:', error);
         // Don't throw - video failure shouldn't stop the session
       });
   }
   ```

3. **Add Stop Video Logic** (in stop/complete session handlers)
   ```typescript
   // When stopping session, add after audio stop:
   if (videoRecordingService.getActiveSessionId()) {
     const sessionVideo = await videoRecordingService.stopRecording();
     if (sessionVideo) {
       // Create attachment for video
       const attachment = await videoStorageService.createVideoAttachment(
         sessionVideo.fullVideoAttachmentId,
         session.id
       );

       // Update session with video data
       sessionVideo.fullVideoAttachmentId = attachment.id;
       dispatch({
         type: 'UPDATE_SESSION',
         payload: {
           ...session,
           video: sessionVideo
         }
       });
     }
   }
   ```

4. **Add Video Toggle Buttons** (3 locations)

   **Location 1: Settings Controls** (line ~966)
   ```typescript
   <ToggleButton
     icon={Mic}
     label="Audio"
     active={currentSettings.audioRecording}
     onChange={updateAudio}
     size="sm"
   />

   {/* ADD THIS: */}
   <ToggleButton
     icon={Video}
     label="Video"
     active={currentSettings.videoRecording || false}
     onChange={(enabled) => {
       // Update session video recording setting
       if (activeSession) {
         dispatch({
           type: 'UPDATE_SESSION',
           payload: { ...activeSession, videoRecording: enabled }
         });
         saveLastSessionSettings({ videoRecording: enabled });
       }
     }}
     size="sm"
   />
   ```

   **Location 2: Inline Settings During Session** (line ~2281)
   ```typescript
   <ToggleButton
     icon={Mic}
     label="Audio"
     active={session.audioRecording}
     onChange={handleAudioToggle}
     disabled={isPaused}
     size="sm"
   />

   {/* ADD THIS: */}
   <ToggleButton
     icon={Video}
     label="Video"
     active={session.videoRecording || false}
     onChange={handleVideoToggle}
     disabled={isPaused}
     size="sm"
   />
   ```

   **Location 3: Pre-Start Settings** (line ~2542)
   ```typescript
   <ToggleButton
     icon={Mic}
     label="Audio"
     active={lastSettings.audioRecording}
     onChange={(enabled) => saveLastSessionSettings({ audioRecording: enabled })}
     size="sm"
   />

   {/* ADD THIS: */}
   <ToggleButton
     icon={Video}
     label="Video"
     active={lastSettings.videoRecording || false}
     onChange={(enabled) => saveLastSessionSettings({ videoRecording: enabled })}
     size="sm"
   />
   ```

5. **Add Toggle Handler** (add near handleAudioToggle)
   ```typescript
   const handleVideoToggle = async (enabled: boolean) => {
     if (!activeSession) return;

     try {
       if (enabled) {
         // Start video recording
         await videoRecordingService.startRecording(activeSession);
       } else {
         // Stop video recording
         const sessionVideo = await videoRecordingService.stopRecording();
         if (sessionVideo) {
           const attachment = await videoStorageService.createVideoAttachment(
             sessionVideo.fullVideoAttachmentId,
             activeSession.id
           );
           sessionVideo.fullVideoAttachmentId = attachment.id;

           dispatch({
             type: 'UPDATE_SESSION',
             payload: {
               ...activeSession,
               video: sessionVideo
             }
           });
         }
       }

       dispatch({
         type: 'UPDATE_SESSION',
         payload: { ...activeSession, videoRecording: enabled }
       });
     } catch (error) {
       console.error('❌ [SESSIONS ZONE] Failed to toggle video recording:', error);
     }
   };
   ```

#### File: `src/utils/lastSessionSettings.ts`

**Add videoRecording field:**
```typescript
export interface LastSessionSettings {
  screenshotInterval: number;
  enableScreenshots: boolean;
  audioRecording: boolean;
  videoRecording?: boolean; // ADD THIS
}
```

### Phase 5: Video Player Component (Not Started)

Create `src/components/VideoPlayer.tsx` with:
- Video playback using HTML5 `<video>` element
- Tauri asset protocol URL conversion
- Playback controls (play, pause, seek, volume)
- Timeline scrubbing
- Fullscreen support

### Phase 6: Review Tab Integration (Not Started)

Update `SessionReview` component to show video when available:
- Display video player alongside screenshots/audio
- Sync video timeline with screenshot timeline
- Show video thumbnail/preview

## Testing Checklist

### Backend Testing ✅
- [x] Rust/Swift compilation succeeds
- [x] No build errors or warnings (except unused code)

### Integration Testing ⏳
- [ ] Start session with video recording enabled
- [ ] Verify video file is created in app data directory
- [ ] Stop session and verify video is saved
- [ ] Check session object has `video` field populated
- [ ] Verify video attachment is created in storage

### UI Testing ⏳
- [ ] Video toggle button appears in all 3 locations
- [ ] Clicking toggle starts/stops recording
- [ ] Video indicator shows when recording
- [ ] Permission prompt appears if needed
- [ ] Error messages display clearly

### Video Playback Testing ⏳
- [ ] Video player displays in Review tab
- [ ] Video plays back correctly
- [ ] Seeking works properly
- [ ] Video syncs with screenshot timeline

## File Paths Reference

### Backend
- `src-tauri/src/video_recording.rs` - Rust FFI bridge
- `src-tauri/ScreenRecorder/ScreenRecorder.swift` - Swift ScreenCaptureKit implementation
- `src-tauri/ScreenRecorder/ScreenRecorder.h` - C header
- `src-tauri/build.rs` - Swift compilation
- `src-tauri/src/lib.rs` - Command registration

### Frontend
- `src/services/videoRecordingService.ts` - Video recording API
- `src/services/videoStorageService.ts` - Video storage/files
- `src/components/SessionsZone.tsx` - Main session UI
- `src/types.ts` - Type definitions (SessionVideo, etc.)

## Notes

### Video File Storage
- Videos are saved to: `{app_data_dir}/videos/session-{session_id}-{timestamp}.mp4`
- Format: H.264 MP4, 1280x720 @ 15fps
- File paths stored in Attachment entities
- No base64 encoding (files stay on disk)

### Permissions
- Uses same Screen Recording permission as screenshots
- Permission functions already exist in `src/utils/permissions.ts`
- macOS System Settings > Privacy & Security > Screen Recording

### Future Enhancements (Phase 2)
- Video chunking with AI topic detection
- Thumbnail generation
- Duration calculation (FFmpeg/AVFoundation)
- Video compression options
- Quality settings UI

## Quick Start for Testing

1. Complete UI integration in `SessionsZone.tsx` using guide above
2. Start a session with video recording enabled
3. Check terminal logs for "🎬 Starting screen recording"
4. Stop session and check logs for "✅ Screen recording stopped"
5. Verify video file exists at logged path
6. Check session object in Redux DevTools for `video` field

## Known Limitations

- Video metadata (duration, size) returns placeholder values
- Thumbnail generation not yet implemented
- Video player component not yet created
- Review tab integration not yet done

## Next Steps

1. **Immediate**: Complete SessionsZone.tsx integration (30 min)
2. **Short-term**: Create VideoPlayer component (1-2 hours)
3. **Medium-term**: Integrate into Review tab (1 hour)
4. **Long-term**: Implement video chunking with AI (Phase 2)
