# Migration Scripts

This directory contains data migration scripts for schema changes.

## Audio Schema Migration

**Script:** `migrate-audio-schema.ts`

### What it does

Migrates existing sessions from the old dual-mode audio architecture to the new simplified audio recording + one-time review architecture.

**Old Schema:**
- `audioMode: 'off' | 'transcription' | 'description'`
- User chose mode during recording
- Different API calls based on mode

**New Schema:**
- `audioRecording: boolean` - Simple on/off toggle
- `audioReviewCompleted: boolean` - Tracks if comprehensive GPT-4o review has been done
- Always uses Whisper-1 during recording
- One-time GPT-4o-audio-preview review when user opens completed session

### Migration Logic

For each session:

1. **Derive audioRecording from audioMode:**
   - `audioMode === 'off'` → `audioRecording: false`
   - `audioMode === 'transcription'` → `audioRecording: true`
   - `audioMode === 'description'` → `audioRecording: true`

2. **Initialize audioReviewCompleted:**
   - `false` if session has audio segments and is completed (ready for review)
   - `true` otherwise (no audio or not completed - skip review flow)

3. **Remove deprecated fields:**
   - Deletes `audioMode` field

### How to run

#### Option 1: Browser Console (Recommended for development)

1. Open the app in development mode:
   ```bash
   npm run dev
   ```

2. Open browser console (F12)

3. Run the migration:
   ```javascript
   await migrateAudioSchema()
   ```

4. Review the output - you'll see:
   - Each session being migrated
   - Statistics summary
   - Any errors encountered

#### Option 2: Direct execution (Node.js)

```bash
npx tsx scripts/migrate-audio-schema.ts
```

Note: This requires the storage system to be available in Node.js context. Browser console execution is preferred.

### Migration Output

The script provides detailed logging:

```
🔄 Starting audio schema migration...

✅ Storage initialized
📊 Found 10 sessions to migrate

📝 Deep Work Session 2024-01-15 | audioMode: transcription → audioRecording: ✅ | reviewable: 🔍
❌ Quick Notes                  | audioMode: off          → audioRecording: ❌ | reviewable: ➖
🎙️  Meeting with Client         | audioMode: description  → audioRecording: ✅ | reviewable: 🔍

✅ Migrated sessions saved to storage

============================================================
📋 MIGRATION SUMMARY
============================================================
Total sessions:           10
Already migrated:         0
Newly migrated:           10

Audio Mode Distribution (legacy):
  • Audio OFF:            4
  • Transcription mode:   3
  • Description mode:     3

New Schema:
  • Sessions with audio:  6
  • Sessions without:     4

✅ No errors encountered

============================================================

Migration complete! 🎉

What changed:
  • audioMode (string) → audioRecording (boolean)
  • audioReviewCompleted (boolean) initialized for all sessions
  • Sessions with audio segments are now reviewable

Next steps:
  1. Test the app to ensure sessions load correctly
  2. Open a completed session with audio to test review flow
  3. Verify audio playback still works for old sessions
============================================================
```

### Safety Features

- **Idempotent:** Can be run multiple times safely - already migrated sessions are skipped
- **Error Handling:** Individual session errors don't stop the entire migration
- **Detailed Logging:** Every session migration is logged for verification
- **Statistics:** Complete summary of what was changed

### After Migration

1. **Test session loading:** Verify all sessions load correctly in the UI
2. **Test audio review:** Open a completed session with audio - should show "Review Audio" banner
3. **Test audio playback:** Verify existing audio segments still play correctly
4. **Verify new sessions:** Start a new session with audio recording enabled

### Rollback

If you need to rollback:

1. The old `audioMode` field is removed during migration
2. To restore, you would need to:
   - Restore from backup (if available)
   - Or manually add `audioMode` back based on `audioRecording` value

**Recommendation:** Test thoroughly in development before running on production data.

### Support

If you encounter issues:

1. Check the migration output for specific error messages
2. Verify storage is accessible
3. Check that all sessions have valid structure
4. Look for console errors in browser DevTools

### Related Files

- `/src/types.ts` - Session interface with new schema
- `/src/services/audioReviewService.ts` - Handles one-time audio review
- `/src/components/AudioReviewStatusBanner.tsx` - UI for triggering review
- `/src/utils/sessionTemplates.ts` - Updated templates
- `/src/utils/lastSessionSettings.ts` - Updated settings persistence
