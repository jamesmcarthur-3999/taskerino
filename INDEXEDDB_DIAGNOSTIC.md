# IndexedDB Diagnostic & Data Recovery

**Created**: 2025-10-29
**Purpose**: Diagnose and recover session data from IndexedDB

---

## Problem Summary

Your sessions are stored in **IndexedDB** (browser storage) instead of the **file system**. This happened because the Tauri detection failed, causing the app to use IndexedDB adapter instead of TauriFileSystemAdapter.

**Impact**:
- Sessions stored in browser storage (limited ~100s of MB)
- Long audio sessions = huge data in IndexedDB
- Memory leak when loading all data into memory
- Sessions disappeared (possibly corrupted or hit size limits)

---

## Step 1: Check if Data Exists

**Open DevTools** (`Cmd + Option + I`) and run this script in the **Console** tab:

```javascript
// === DIAGNOSTIC SCRIPT ===
console.log('🔍 Checking IndexedDB for session data...');

(async () => {
  try {
    // Open IndexedDB
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('taskerino-storage');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    console.log('✅ IndexedDB opened:', db.name);
    console.log('📦 Object stores:', Array.from(db.objectStoreNames));

    // Check for session-index
    const tx = db.transaction(['keyval'], 'readonly');
    const store = tx.objectStore('keyval');

    const sessionIndexReq = store.get('session-index');
    const sessionsData = await new Promise((resolve, reject) => {
      sessionIndexReq.onsuccess = () => resolve(sessionIndexReq.result);
      sessionIndexReq.onerror = () => reject(sessionIndexReq.error);
    });

    if (sessionsData) {
      console.log('✅ Found session-index!');
      console.log('📊 Session IDs:', sessionsData);
      console.log(`📈 Total sessions: ${Array.isArray(sessionsData) ? sessionsData.length : 'Unknown'}`);

      // Try to load a few sessions
      if (Array.isArray(sessionsData) && sessionsData.length > 0) {
        console.log(`\n🔎 Checking first 3 sessions for data...`);

        for (let i = 0; i < Math.min(3, sessionsData.length); i++) {
          const sessionId = sessionsData[i];
          const metadataKey = `sessions/${sessionId}/metadata`;

          const metadataReq = store.get(metadataKey);
          const metadata = await new Promise((resolve, reject) => {
            metadataReq.onsuccess = () => resolve(metadataReq.result);
            metadataReq.onerror = () => reject(metadataReq.error);
          });

          if (metadata) {
            console.log(`\n✅ Session ${i + 1} (${sessionId}):`);
            console.log(`   Name: ${metadata.name || 'Unnamed'}`);
            console.log(`   Start: ${metadata.startTime || 'Unknown'}`);
            console.log(`   Duration: ${metadata.totalDuration ? (metadata.totalDuration / 1000 / 60).toFixed(1) + ' min' : 'Unknown'}`);
            console.log(`   Screenshots: ${metadata.chunks?.screenshots?.count || 0}`);
            console.log(`   Audio segments: ${metadata.chunks?.audioSegments?.count || 0}`);
          } else {
            console.log(`\n⚠️  Session ${i + 1} (${sessionId}): No metadata found`);
          }
        }
      }

      return { success: true, sessionCount: sessionsData.length, sessions: sessionsData };
    } else {
      console.log('❌ No session-index found in IndexedDB');
      return { success: false, message: 'No session data' };
    }

  } catch (error) {
    console.error('❌ Error checking IndexedDB:', error);
    return { success: false, error };
  }
})().then(result => {
  console.log('\n📊 Diagnostic Results:', result);

  if (result.success) {
    console.log(`\n✅ GOOD NEWS: Found ${result.sessionCount} sessions in IndexedDB!`);
    console.log('   Next step: Export this data to file system');
  } else {
    console.log('\n❌ BAD NEWS: No session data found in IndexedDB');
    console.log('   Sessions may have been lost or corrupted');
    console.log('   Check if video/audio files on disk can be used to reconstruct');
  }
});
```

---

## Step 2: Export Data (If Found)

If the diagnostic script found sessions, run this export script:

```javascript
// === EXPORT SCRIPT ===
console.log('📤 Exporting session data from IndexedDB...');

(async () => {
  try {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('taskerino-storage');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const tx = db.transaction(['keyval'], 'readonly');
    const store = tx.objectStore('keyval');

    // Get session index
    const sessionIndexReq = store.get('session-index');
    const sessionIds = await new Promise((resolve, reject) => {
      sessionIndexReq.onsuccess = () => resolve(sessionIndexReq.result);
      sessionIndexReq.onerror = () => reject(sessionIndexReq.error);
    });

    if (!Array.isArray(sessionIds)) {
      throw new Error('No session index found');
    }

    console.log(`📦 Exporting ${sessionIds.length} sessions...`);

    const exported = {
      exportDate: new Date().toISOString(),
      sessionCount: sessionIds.length,
      sessions: []
    };

    // Export each session
    for (const sessionId of sessionIds) {
      const metadataKey = `sessions/${sessionId}/metadata`;

      const metadataReq = store.get(metadataKey);
      const metadata = await new Promise((resolve, reject) => {
        metadataReq.onsuccess = () => resolve(metadataReq.result);
        metadataReq.onerror = () => reject(metadataReq.error);
      });

      if (metadata) {
        exported.sessions.push({
          id: sessionId,
          metadata: metadata
        });
        console.log(`✅ Exported session: ${metadata.name || sessionId}`);
      } else {
        console.warn(`⚠️  Skipped session (no metadata): ${sessionId}`);
      }
    }

    // Convert to JSON
    const json = JSON.stringify(exported, null, 2);

    // Create download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log(`\n✅ Export complete! Downloaded: sessions-backup-${Date.now()}.json`);
    console.log(`📊 Exported ${exported.sessions.length} sessions`);

    return exported;

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  }
})();
```

---

## Step 3: Verify Fixed Storage Adapter

After the bug fix, restart the app and check the console for:

```
[Storage] Detecting environment...
[Storage] window.__TAURI__: true  (or __TAURI_INTERNALS__)
[Storage] isTauriApp(): true
[Storage] Attempting to initialize TauriFileSystemAdapter...
[Storage] TauriFileSystemAdapter.isAvailable(): true
🖥️  ✅ Using Tauri file system storage (unlimited)
```

**If you still see `"🌐 Using IndexedDB storage"`**, the Tauri detection is still failing. Check:
1. Are you running `npm run tauri:dev` (not just `npm run dev`)?
2. Is the Tauri window actually opening (not just browser)?
3. Check the detailed logs from Step 3's console output

---

## Step 4: Import Data to File System

Once TauriFileSystemAdapter is working, import the exported data:

**Option A: Automatic Import (TODO - Migration Tool)**
- Run migration script that reads `sessions-backup-*.json`
- Creates file system structure
- Imports all metadata

**Option B: Manual Import**
- Place exported JSON in known location
- App checks for backup on startup
- Prompts user to import

---

## Recovery Status

| Item | Status |
|------|--------|
| Tauri Detection Bug | ✅ Fixed |
| Debug Logging | ✅ Added |
| Diagnostic Script | ✅ Ready |
| Export Script | ✅ Ready |
| Import Tool | ⏳ TODO |

---

## Next Steps

1. **Run diagnostic script** → Report if sessions found
2. **If found**: Run export script → Save backup JSON
3. **Restart app** → Verify using file system storage
4. **Import data** → Restore sessions from backup

---

**Questions?** Check console logs for detailed storage adapter initialization info.
