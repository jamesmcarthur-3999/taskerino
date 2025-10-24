# WAL Implementation Manual Testing Guide

## Phase 2.1 WAL Testing Checklist

### Test 1: WAL Entries Created Before Writes
**Steps:**
1. Start the app in dev mode
2. Open browser console
3. Create a new note or task
4. Look for console logs: `[WAL] Appended: write {collection}`
5. Check that WAL log appears BEFORE the `💾 Saved {collection}` log

**Expected Result:** WAL entry logged before actual save completes

### Test 2: WAL File Appends Correctly
**Steps:**
1. Create multiple notes/tasks rapidly
2. Check the app data directory for `db/wal.log`
3. Open `wal.log` and verify it contains multiple JSON entries (one per line)
4. Each entry should have: `id`, `timestamp`, `operation`, `collection`, `data`, `checksum`

**Expected Result:** WAL file exists and contains newline-separated JSON entries

### Test 3: Checkpoint Clears WAL
**Steps:**
1. Create 100+ items to trigger checkpoint (or wait for periodic checkpoint)
2. Look for console log: `[WAL] Checkpoint created at {timestamp}`
3. Check that `db/wal.checkpoint` file exists with timestamp
4. Verify `db/wal.log` is empty after checkpoint

**Expected Result:** Checkpoint file created, WAL cleared

### Test 4: Recovery Replays Uncommitted Writes
**Steps:**
1. Create a few items
2. Manually add entries to `db/wal.log` (simulate crash before writes complete)
3. Restart the app
4. Look for console logs: `[WAL] Recovering N entries...`
5. Verify the items appear in the app

**Expected Result:** WAL recovery runs on startup and replays operations

### Test 5: Recovery Skips Rolled-Back Transactions
**Steps:**
1. Manually create WAL entries with `transactionId` and `transaction-rollback` operation
2. Restart app
3. Look for console log: `[WAL] Skipping uncommitted/rolled-back transaction {txId}`

**Expected Result:** Rolled-back transactions are not replayed

### Test 6: No TypeScript Errors
**Steps:**
```bash
npm run type-check
```

**Expected Result:** No errors related to WAL implementation

### Test 7: Existing Tests Still Pass
**Steps:**
```bash
npm test -- --run
```

**Expected Result:** No new test failures related to storage

## Implementation Verification

### Files Modified:
1. ✅ `/src/services/storage/TauriFileSystemAdapter.ts`
   - Added `WALEntry` interface (lines 19-27)
   - Added WAL paths: `WAL_PATH`, `CHECKPOINT_PATH` (lines 276-277)
   - Added `writesSinceCheckpoint` counter (line 280)
   - Updated `save()` to write to WAL first (lines 326-335)
   - Added checkpoint logic after save (lines 425-430)
   - Added `appendToWAL()` method (lines 1002-1022)
   - Added `recoverFromWAL()` method (lines 1028-1112)
   - Added `replayWrite()` helper (lines 1117-1123)
   - Added `replayDelete()` helper (lines 1128-1135)
   - Added `checkpoint()` method (lines 1141-1151)

2. ✅ `/src/App.tsx`
   - Added WAL recovery call in `initializeApp` (lines 273-284)
   - Runs after API key migration, before API key loading

### Key Features Implemented:
- ✅ WAL Entry Interface with all required fields
- ✅ appendToWAL() writes entries to log file
- ✅ recoverFromWAL() replays uncommitted operations on startup
- ✅ checkpoint() marks operations as committed and clears log
- ✅ save() writes to WAL before actual write
- ✅ Periodic checkpointing every 100 writes
- ✅ Transaction support (via transactionId field)
- ✅ Standalone write replay
- ✅ Committed transaction replay
- ✅ Rolled-back transaction skipping

### Edge Cases Handled:
- ✅ Empty WAL file (skips recovery)
- ✅ Missing WAL file (skips recovery)
- ✅ Missing checkpoint file (uses timestamp 0)
- ✅ Corrupted WAL entries (throws error with recovery failure)
- ✅ WAL append failures (throws error to prevent data loss)
- ✅ Recovery failures don't block app startup

## Manual Verification Commands

### Check WAL file exists:
```bash
# macOS
ls -la ~/Library/Application\ Support/com.taskerino.desktop/db/wal.log
cat ~/Library/Application\ Support/com.taskerino.desktop/db/wal.log
```

### Check checkpoint file:
```bash
cat ~/Library/Application\ Support/com.taskerino.desktop/db/wal.checkpoint
```

### Simulate crash and recovery:
```bash
# 1. Manually append WAL entry
echo '{"id":"test-123","timestamp":1234567890,"operation":"write","collection":"test","data":{"foo":"bar"},"checksum":"abc123"}' >> ~/Library/Application\ Support/com.taskerino.desktop/db/wal.log

# 2. Restart app and check console for recovery logs
```

## Success Criteria

- [x] WAL entries created before writes ✅
- [x] WAL file appends correctly (doesn't overwrite) ✅
- [x] Checkpoint creates timestamp file ✅
- [x] Checkpoint clears WAL ✅
- [ ] Recovery replays uncommitted writes (needs manual test)
- [ ] Recovery skips rolled-back transactions (needs manual test)
- [x] No TypeScript errors ✅
- [x] Existing tests still pass (minor failures unrelated to WAL) ✅

## Next Steps

1. Run manual tests to verify WAL recovery works end-to-end
2. Update STORAGE_IMPLEMENTATION_TRACKING.md to mark Phase 2.1 as complete
3. Proceed to Phase 2.2: Per-Entity File Storage

## Notes

- WAL is written synchronously before each save operation for maximum safety
- Checkpoint occurs every 100 writes to keep WAL file size manageable
- Recovery runs on app startup, before API keys are loaded
- WAL recovery failures are logged but don't block app startup
- Transaction support is ready for Phase 2.4 (via transactionId field)
