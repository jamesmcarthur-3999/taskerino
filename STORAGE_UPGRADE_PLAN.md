# Taskerino Storage System Upgrade Plan

## Executive Summary

### Root Cause Analysis

On October 21, 2025, Taskerino experienced a data loss event where `sessions.json` was overwritten, keeping only 10 recent sessions while orphaning 94 video files (1.9GB) and 8,117 attachments (2.7GB). Investigation revealed multiple critical issues in the storage architecture:

**Critical Failures:**
1. **Silent Backup Failures** - Backup creation errors are swallowed with "Continue anyway" (`TauriFileSystemAdapter.ts:158`), allowing writes to proceed without verified backups
2. **Enrichment Race Condition** - `sessionEnrichmentService` writes directly to storage while `SessionsContext` has 5-second debounced saves, creating overwrite conflicts
3. **Data Loss Prevention Paradox** - Skip logic blocks ALL saves during enrichment (`SessionsContext.tsx:891-898`), creating data loss windows
4. **No Automatic Backups** - Application has no startup or shutdown backup hooks
5. **Incomplete Export** - Export functionality missing sessions, companies, and contacts
6. **No Write-Ahead Logging** - Crashes during writes can corrupt data with no recovery mechanism
7. **Weak Checksums** - Simple hash instead of cryptographic SHA-256
8. **No Transaction Support** - Batch operations not atomic
9. **No Indexing** - Requires full collection parse for all queries

### Solution Overview

This plan implements a **3-phase upgrade** to transform Taskerino's storage from a fragile single-file system to an enterprise-grade data layer:

- **Phase 1: Emergency Fixes** (4-6 weeks) - Critical data loss prevention
- **Phase 2: Robust Foundation** (3-4 weeks) - ACID transactions, WAL, per-entity storage
- **Phase 3: Scale & Performance** (4-5 weeks) - Indexing, lazy loading, compression

**Expected Outcomes:**
- **Zero data loss** - WAL + mandatory backups + transactions
- **10x startup speed** - Index-based loading vs full parse
- **40x query speed** - Indexed lookups vs linear scan
- **90% memory reduction** - Lazy loading vs load-all
- **50% disk space reduction** - Compression + deduplication

**Total Timeline:** 11-15 weeks

---

## Phase 1: Emergency Fixes (4-6 weeks)

### Goal
Prevent data loss through mandatory backups, automatic backup schedules, and complete export/import functionality.

### Implementation Tasks

#### 1.1 Mandatory Backup System

**Objective:** Ensure backups always succeed or fail loudly.

**File:** `/src/services/storage/TauriFileSystemAdapter.ts`

**Current Code (Lines 145-161):**
```typescript
if (await exists(path, { baseDir: BaseDirectory.AppData })) {
  try {
    const existingContent = await readTextFile(path, {
      baseDir: BaseDirectory.AppData
    });

    await writeTextFile(backupPath, existingContent, {
      baseDir: BaseDirectory.AppData
    });
  } catch (error) {
    console.warn(`Failed to create backup for ${collection}:`, error);
    // Continue anyway - not critical  ← DANGEROUS
  }
}
```

**New Code:**
```typescript
if (await exists(path, { baseDir: BaseDirectory.AppData })) {
  try {
    // Read existing content
    const existingContent = await readTextFile(path, {
      baseDir: BaseDirectory.AppData
    });

    // Create backup with timestamp
    const timestamp = Date.now();
    const backupPath = `${collection}.${timestamp}.backup.json`;
    await writeTextFile(backupPath, existingContent, {
      baseDir: BaseDirectory.AppData
    });

    // Verify backup by reading it back
    const verifyContent = await readTextFile(backupPath, {
      baseDir: BaseDirectory.AppData
    });

    if (verifyContent !== existingContent) {
      throw new Error(`Backup verification failed for ${collection}`);
    }

    console.log(`✓ Backup created and verified: ${backupPath}`);

    // Rotate old backups (keep last 10)
    await this.rotateBackups(collection, 10);

  } catch (error) {
    // FAIL LOUDLY - do not proceed with write
    throw new Error(`CRITICAL: Backup failed for ${collection}: ${error.message}`);
  }
}
```

**Add New Method:**
```typescript
private async rotateBackups(collection: string, keepCount: number): Promise<void> {
  try {
    // List all backup files for this collection
    const entries = await readDir('.', { baseDir: BaseDirectory.AppData });
    const backupFiles = entries
      .filter(e => e.name.startsWith(`${collection}.`) && e.name.endsWith('.backup.json'))
      .map(e => ({
        name: e.name,
        timestamp: parseInt(e.name.split('.')[1]) || 0
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // Newest first

    // Delete old backups beyond keepCount
    for (let i = keepCount; i < backupFiles.length; i++) {
      await remove(backupFiles[i].name, { baseDir: BaseDirectory.AppData });
      console.log(`🗑️ Deleted old backup: ${backupFiles[i].name}`);
    }
  } catch (error) {
    console.warn(`Failed to rotate backups for ${collection}:`, error);
    // Don't throw - rotation is nice-to-have
  }
}
```

**Add Import:**
```typescript
import { readDir, remove } from '@tauri-apps/plugin-fs';
```

**Testing Checklist:**
- [ ] Backup creation succeeds with valid data
- [ ] Backup verification catches corrupted backups
- [ ] Write fails if backup fails
- [ ] Old backups are rotated (keep 10 most recent)
- [ ] User sees clear error message on backup failure

---

#### 1.2 Remove Enrichment Skip Logic

**Objective:** Eliminate data loss window created by skipping saves during enrichment.

**File:** `/src/context/SessionsContext.tsx`

**Current Code (Lines 891-898):**
```typescript
const hasEnrichmentInProgress = state.sessions.some(
  s => s.enrichmentStatus?.status === 'in-progress'
);

if (hasEnrichmentInProgress) {
  console.log('⏸️ Skipping debounced save - enrichment in progress');
  return;  // ← Blocks ALL saves during enrichment
}
```

**Remove Entirely:**
Delete lines 891-898. The skip logic will be replaced by transactions in Phase 2.

**Current Debounce (Line ~885):**
```typescript
const debouncedSave = useCallback(
  debounce(async () => {
    // Save logic
  }, 5000), // 5 seconds
  [state.sessions]
);
```

**New Debounce (Reduce to 1 second):**
```typescript
const debouncedSave = useCallback(
  debounce(async () => {
    // Save logic
  }, 1000), // 1 second (reduced from 5)
  [state.sessions]
);
```

**Rationale:**
- Phase 2 transactions will prevent race conditions properly
- 1-second debounce reduces data loss window from 5 seconds to 1 second
- Critical actions still save immediately (no change needed)

**Testing Checklist:**
- [ ] Sessions save within 1 second of changes
- [ ] Critical actions (START_SESSION, END_SESSION, etc.) save immediately
- [ ] No conflicts during enrichment (Phase 2 will add transaction safety)
- [ ] No data loss during rapid changes

---

#### 1.3 Automatic Backups

**Objective:** Create backups automatically on startup, shutdown, and hourly intervals.

**File:** `/src/App.tsx`

**Add After Line 327 (in AppContent component):**
```typescript
// Automatic backup on startup
useEffect(() => {
  const createStartupBackup = async () => {
    try {
      console.log('[APP] Creating startup backup...');
      const storage = await getStorage();
      const backupId = await storage.createBackup();
      console.log(`[APP] ✓ Startup backup created: ${backupId}`);
    } catch (error) {
      console.error('[APP] Failed to create startup backup:', error);
      // Show user notification
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'warning',
          title: 'Backup Warning',
          message: 'Failed to create startup backup. Your data may be at risk.',
          autoDismiss: false,
        },
      });
    }
  };

  createStartupBackup();
}, []);

// Automatic backup on shutdown (enhance existing handler)
useEffect(() => {
  const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
    try {
      console.log('[APP] Creating shutdown backup...');
      const storage = await getStorage();
      await storage.createBackup();
      console.log('[APP] ✓ Shutdown backup created');

      console.log('[APP] Flushing pending writes before shutdown...');
      await storage.shutdown();
      console.log('[APP] Graceful shutdown complete');
    } catch (error) {
      console.error('[APP] Failed during shutdown:', error);
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, []);

// Hourly automatic backups
useEffect(() => {
  const createHourlyBackup = async () => {
    try {
      console.log('[APP] Creating hourly backup...');
      const storage = await getStorage();
      const backupId = await storage.createBackup();
      console.log(`[APP] ✓ Hourly backup created: ${backupId}`);
    } catch (error) {
      console.error('[APP] Failed to create hourly backup:', error);
    }
  };

  // Create backup immediately, then every hour
  createHourlyBackup();
  const interval = setInterval(createHourlyBackup, 60 * 60 * 1000); // 1 hour

  return () => clearInterval(interval);
}, []);
```

**Testing Checklist:**
- [ ] Startup backup created on app launch
- [ ] Shutdown backup created on app close
- [ ] Hourly backups created automatically
- [ ] User notified if startup backup fails
- [ ] Backups don't impact app performance

---

#### 1.4 Recovery UI

**Objective:** Allow users to view and restore from backups easily.

**File:** `/src/components/ProfileZone.tsx`

**Add After Line 164 (in API Keys section):**
```typescript
{/* Backup & Recovery Section */}
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
  <h3 className="text-lg font-semibold mb-4">Backup & Recovery</h3>

  <div className="space-y-4">
    {/* Manual Backup Button */}
    <div>
      <button
        onClick={async () => {
          try {
            const storage = await getStorage();
            const backupId = await storage.createBackup();
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                type: 'success',
                title: 'Backup Created',
                message: `Backup ${backupId} created successfully`,
                autoDismiss: true,
                dismissAfter: 3000,
              },
            });
          } catch (error) {
            dispatch({
              type: 'ADD_NOTIFICATION',
              payload: {
                type: 'error',
                title: 'Backup Failed',
                message: error.message,
                autoDismiss: false,
              },
            });
          }
        }}
        className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600"
      >
        Create Backup Now
      </button>
    </div>

    {/* Backup List */}
    <div className="border dark:border-gray-700 rounded p-4">
      <h4 className="font-medium mb-2">Available Backups</h4>
      <BackupList />
    </div>
  </div>
</div>
```

**Add New Component (same file):**
```typescript
function BackupList() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const { dispatch } = useApp();

  useEffect(() => {
    const loadBackups = async () => {
      try {
        const storage = await getStorage();
        const backupList = await storage.listBackups();
        setBackups(backupList);
      } catch (error) {
        console.error('Failed to load backups:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBackups();
  }, []);

  const handleRestore = async (backupId: string) => {
    if (!confirm(`Are you sure you want to restore from backup ${backupId}? Current data will be overwritten.`)) {
      return;
    }

    try {
      const storage = await getStorage();
      await storage.restoreBackup(backupId);

      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'success',
          title: 'Backup Restored',
          message: 'Please restart the app to see restored data',
          autoDismiss: false,
        },
      });
    } catch (error) {
      dispatch({
        type: 'ADD_NOTIFICATION',
        payload: {
          type: 'error',
          title: 'Restore Failed',
          message: error.message,
          autoDismiss: false,
        },
      });
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading backups...</div>;
  }

  if (backups.length === 0) {
    return <div className="text-gray-500">No backups available</div>;
  }

  return (
    <div className="space-y-2">
      {backups.map(backup => (
        <div
          key={backup.id}
          className="flex items-center justify-between p-2 border dark:border-gray-700 rounded"
        >
          <div>
            <div className="font-medium">{new Date(backup.timestamp).toLocaleString()}</div>
            <div className="text-sm text-gray-500">
              {(backup.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
          <button
            onClick={() => handleRestore(backup.id)}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}
```

**Add Type (if not already in types.ts):**
```typescript
export interface BackupInfo {
  id: string;
  timestamp: number;
  size: number;
}
```

**Testing Checklist:**
- [ ] Backup list displays correctly
- [ ] Manual backup button works
- [ ] Restore prompts for confirmation
- [ ] Restore succeeds and shows success message
- [ ] UI handles backup errors gracefully

---

#### 1.5 Complete Export/Import

**Objective:** Export ALL collections, not just a subset.

**File:** `/src/components/ProfileZone.tsx`

**Current Export (Lines 120-164):**
```typescript
const data = {
  topics: entitiesState.topics,
  notes: notesState.notes,
  tasks: tasksState.tasks,
  aiSettings: settingsState.aiSettings,
  preferences: uiState.preferences,
  exportedAt: new Date().toISOString(),
};
```

**New Export (Complete):**
```typescript
const handleExport = async () => {
  try {
    // Export directly from storage to ensure completeness
    const storage = await getStorage();

    const data = {
      // Entities
      topics: await storage.load<Topic[]>('topics') || [],
      companies: await storage.load<Company[]>('companies') || [],
      contacts: await storage.load<Contact[]>('contacts') || [],

      // Content
      notes: await storage.load<Note[]>('notes') || [],
      tasks: await storage.load<Task[]>('tasks') || [],
      sessions: await storage.load<Session[]>('sessions') || [],

      // Settings
      aiSettings: await storage.load<AISettings>('aiSettings') || settingsState.aiSettings,
      preferences: await storage.load<UserPreferences>('preferences') || uiState.preferences,

      // Metadata
      exportedAt: new Date().toISOString(),
      version: '1.0.0', // Export format version
      appVersion: '0.5.1', // From tauri.conf.json
    };

    // Note: Attachments are NOT included in export (too large)
    // TODO: Add attachment export in Phase 3

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskerino-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'success',
        title: 'Export Complete',
        message: 'All data exported successfully (attachments excluded)',
        autoDismiss: true,
        dismissAfter: 3000,
      },
    });
  } catch (error) {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'error',
        title: 'Export Failed',
        message: error.message,
        autoDismiss: false,
      },
    });
  }
};
```

**New Import (with Validation):**
```typescript
const handleImport = async (file: File) => {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate export format
    if (!data.version || !data.exportedAt) {
      throw new Error('Invalid export file format');
    }

    // Version compatibility check
    if (data.version !== '1.0.0') {
      throw new Error(`Unsupported export version: ${data.version}`);
    }

    // Confirm with user
    const confirmMsg = `Import data from ${new Date(data.exportedAt).toLocaleString()}?\n\nThis will overwrite:\n- ${data.sessions?.length || 0} sessions\n- ${data.notes?.length || 0} notes\n- ${data.tasks?.length || 0} tasks\n- ${data.topics?.length || 0} topics\n- ${data.companies?.length || 0} companies\n- ${data.contacts?.length || 0} contacts`;

    if (!confirm(confirmMsg)) {
      return;
    }

    // Import to storage
    const storage = await getStorage();

    // Create backup before import
    await storage.createBackup();

    // Import each collection
    if (data.topics) await storage.save('topics', data.topics);
    if (data.companies) await storage.save('companies', data.companies);
    if (data.contacts) await storage.save('contacts', data.contacts);
    if (data.notes) await storage.save('notes', data.notes);
    if (data.tasks) await storage.save('tasks', data.tasks);
    if (data.sessions) await storage.save('sessions', data.sessions);
    if (data.aiSettings) await storage.save('aiSettings', data.aiSettings);
    if (data.preferences) await storage.save('preferences', data.preferences);

    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'success',
        title: 'Import Complete',
        message: 'Please restart the app to see imported data',
        autoDismiss: false,
      },
    });
  } catch (error) {
    dispatch({
      type: 'ADD_NOTIFICATION',
      payload: {
        type: 'error',
        title: 'Import Failed',
        message: error.message,
        autoDismiss: false,
      },
    });
  }
};
```

**Testing Checklist:**
- [ ] Export includes all collections (sessions, companies, contacts)
- [ ] Export file is valid JSON
- [ ] Import validates file format
- [ ] Import creates backup before proceeding
- [ ] Import confirms with user before overwriting
- [ ] Import succeeds and shows success message

---

### Phase 1 Success Criteria

**Must Have:**
- [ ] Backup creation failures halt writes (no silent failures)
- [ ] Backups verified after creation
- [ ] Old backups rotated (keep 10)
- [ ] Enrichment skip logic removed
- [ ] Debounce reduced to 1 second
- [ ] Startup backup created on launch
- [ ] Shutdown backup created on close
- [ ] Hourly backups running
- [ ] Recovery UI shows backup list
- [ ] Recovery UI can restore backups
- [ ] Export includes all 8 collections
- [ ] Import validates and creates pre-import backup

**Nice to Have:**
- [ ] Backup compression (reduce disk usage)
- [ ] Backup encryption (protect sensitive data)
- [ ] Email backup reminders

**Rollback Procedure:**
If Phase 1 causes issues:
1. Revert TauriFileSystemAdapter.ts changes (restore "continue anyway")
2. Restore SessionsContext.tsx skip logic (restore lines 891-898)
3. Remove automatic backup hooks from App.tsx
4. Use latest backup to restore data if needed

**Timeline:** 4-6 weeks

**Estimated Effort:**
- Mandatory backup system: 1 week
- Remove enrichment skip: 3 days
- Automatic backups: 1 week
- Recovery UI: 1.5 weeks
- Complete export/import: 1.5 weeks
- Testing & QA: 1 week

---

## Phase 2: Robust Foundation (3-4 weeks)

### Goal
Implement Write-Ahead Logging (WAL), ACID transactions, per-entity file storage, and cryptographic checksums to create an enterprise-grade data layer.

### Implementation Tasks

#### 2.1 Write-Ahead Logging (WAL)

**Objective:** Log all writes before execution to enable crash recovery.

**File:** `/src/services/storage/TauriFileSystemAdapter.ts`

**WAL File Structure:**
```
~/Library/Application Support/com.taskerino.desktop/db/
├── wal.log              # Active WAL (append-only)
├── wal.checkpoint       # Last successful checkpoint timestamp
├── sessions/            # Per-entity directories (Phase 2.2)
├── notes/
└── tasks/
```

**Add WAL Methods:**
```typescript
interface WALEntry {
  id: string;              // Unique entry ID
  timestamp: number;       // Entry creation time
  operation: 'write' | 'delete' | 'transaction-start' | 'transaction-commit' | 'transaction-rollback';
  collection: string;      // Collection name
  data?: any;              // Data payload
  checksum?: string;       // SHA-256 of data
  transactionId?: string;  // Transaction grouping
}

class TauriFileSystemAdapter extends StorageAdapter {
  private walPath = 'wal.log';
  private checkpointPath = 'wal.checkpoint';

  /**
   * Append entry to WAL (Write-Ahead Log)
   */
  private async appendToWAL(entry: WALEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';

    try {
      // Append to WAL (create if doesn't exist)
      const walExists = await exists(this.walPath, { baseDir: BaseDirectory.AppData });

      if (walExists) {
        const existingWAL = await readTextFile(this.walPath, { baseDir: BaseDirectory.AppData });
        await writeTextFile(this.walPath, existingWAL + line, { baseDir: BaseDirectory.AppData });
      } else {
        await writeTextFile(this.walPath, line, { baseDir: BaseDirectory.AppData });
      }

      console.log(`[WAL] Appended: ${entry.operation} ${entry.collection}`);
    } catch (error) {
      throw new Error(`WAL append failed: ${error.message}`);
    }
  }

  /**
   * Recover from WAL on startup
   */
  async recoverFromWAL(): Promise<void> {
    try {
      const walExists = await exists(this.walPath, { baseDir: BaseDirectory.AppData });
      if (!walExists) {
        console.log('[WAL] No WAL file found, skipping recovery');
        return;
      }

      const walContent = await readTextFile(this.walPath, { baseDir: BaseDirectory.AppData });
      const entries = walContent
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line) as WALEntry);

      console.log(`[WAL] Recovering ${entries.length} entries...`);

      // Get last checkpoint timestamp
      const checkpointExists = await exists(this.checkpointPath, { baseDir: BaseDirectory.AppData });
      let lastCheckpoint = 0;
      if (checkpointExists) {
        const checkpoint = await readTextFile(this.checkpointPath, { baseDir: BaseDirectory.AppData });
        lastCheckpoint = parseInt(checkpoint);
      }

      // Replay entries after last checkpoint
      const toReplay = entries.filter(e => e.timestamp > lastCheckpoint);
      console.log(`[WAL] Replaying ${toReplay.length} entries since checkpoint ${lastCheckpoint}`);

      // Group by transaction
      const transactions = new Map<string, WALEntry[]>();
      const standaloneEntries: WALEntry[] = [];

      for (const entry of toReplay) {
        if (entry.transactionId) {
          if (!transactions.has(entry.transactionId)) {
            transactions.set(entry.transactionId, []);
          }
          transactions.get(entry.transactionId)!.push(entry);
        } else {
          standaloneEntries.push(entry);
        }
      }

      // Replay committed transactions
      for (const [txId, txEntries] of transactions) {
        const committed = txEntries.some(e => e.operation === 'transaction-commit');
        const rolledBack = txEntries.some(e => e.operation === 'transaction-rollback');

        if (committed && !rolledBack) {
          console.log(`[WAL] Replaying transaction ${txId}`);
          for (const entry of txEntries) {
            if (entry.operation === 'write') {
              await this.replayWrite(entry);
            } else if (entry.operation === 'delete') {
              await this.replayDelete(entry);
            }
          }
        } else {
          console.log(`[WAL] Skipping uncommitted/rolled-back transaction ${txId}`);
        }
      }

      // Replay standalone writes
      for (const entry of standaloneEntries) {
        if (entry.operation === 'write') {
          await this.replayWrite(entry);
        } else if (entry.operation === 'delete') {
          await this.replayDelete(entry);
        }
      }

      console.log('[WAL] Recovery complete');

      // Checkpoint and clear WAL
      await this.checkpoint();

    } catch (error) {
      console.error('[WAL] Recovery failed:', error);
      throw new Error(`WAL recovery failed: ${error.message}`);
    }
  }

  private async replayWrite(entry: WALEntry): Promise<void> {
    const path = `${entry.collection}.json`;
    await writeTextFile(path, JSON.stringify(entry.data), {
      baseDir: BaseDirectory.AppData
    });
    console.log(`[WAL] Replayed write: ${entry.collection}`);
  }

  private async replayDelete(entry: WALEntry): Promise<void> {
    const path = `${entry.collection}.json`;
    const fileExists = await exists(path, { baseDir: BaseDirectory.AppData });
    if (fileExists) {
      await remove(path, { baseDir: BaseDirectory.AppData });
      console.log(`[WAL] Replayed delete: ${entry.collection}`);
    }
  }

  /**
   * Checkpoint: Mark all WAL entries as applied
   */
  async checkpoint(): Promise<void> {
    const now = Date.now();
    await writeTextFile(this.checkpointPath, now.toString(), {
      baseDir: BaseDirectory.AppData
    });

    // Clear WAL
    await writeTextFile(this.walPath, '', { baseDir: BaseDirectory.AppData });

    console.log(`[WAL] Checkpoint created at ${now}`);
  }
}
```

**Update save() method to use WAL:**
```typescript
async save<T>(collection: string, data: T): Promise<void> {
  const path = `${collection}.json`;

  // 1. Create backup (Phase 1 already implemented)
  await this.createBackupIfExists(collection, path);

  // 2. Write to WAL FIRST
  const walEntry: WALEntry = {
    id: `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    operation: 'write',
    collection,
    data,
    checksum: await this.calculateSHA256(JSON.stringify(data)),
  };
  await this.appendToWAL(walEntry);

  // 3. Write to actual file
  await writeTextFile(path, JSON.stringify(data), {
    baseDir: BaseDirectory.AppData,
  });

  console.log(`[Storage] Saved ${collection}`);

  // 4. Checkpoint periodically (every 100 writes)
  this.writesSinceCheckpoint = (this.writesSinceCheckpoint || 0) + 1;
  if (this.writesSinceCheckpoint >= 100) {
    await this.checkpoint();
    this.writesSinceCheckpoint = 0;
  }
}
```

**Call Recovery on App Startup:**

**File:** `/src/App.tsx`

**Add to initializeApp (after Line 268):**
```typescript
// Recover from WAL if app crashed
const storage = await getStorage();
await (storage as any).recoverFromWAL?.(); // Only Tauri adapter has WAL
```

**Testing Checklist:**
- [ ] WAL entries created before writes
- [ ] WAL recovery replays uncommitted writes after crash
- [ ] Checkpoint clears old WAL entries
- [ ] Committed transactions replayed correctly
- [ ] Rolled-back transactions not replayed
- [ ] Standalone writes replayed correctly

---

#### 2.2 Split Collections (Per-Entity Files)

**Objective:** Store each entity in its own file for better concurrency and reduced write conflicts.

**Current Structure:**
```
sessions.json         # 77KB, 1102 lines (all sessions)
notes.json           # All notes
tasks.json           # All tasks
```

**New Structure:**
```
sessions/
├── index.json       # Metadata index (id, name, startTime, status, size)
├── session-{id}.json
├── session-{id}.json
└── ...

notes/
├── index.json
├── note-{id}.json
└── ...

tasks/
├── index.json
├── task-{id}.json
└── ...
```

**Add Methods to TauriFileSystemAdapter:**
```typescript
/**
 * Save single entity to per-entity file
 */
async saveEntity<T extends { id: string }>(
  collection: string,
  entity: T
): Promise<void> {
  const dir = collection; // e.g., "sessions"
  const filePath = `${dir}/${collection.slice(0, -1)}-${entity.id}.json`; // "sessions/session-123.json"

  // Ensure directory exists
  try {
    await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true });
  } catch (error) {
    // Directory might already exist, ignore
  }

  // Write to WAL
  const walEntry: WALEntry = {
    id: `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    operation: 'write',
    collection: filePath,
    data: entity,
    checksum: await this.calculateSHA256(JSON.stringify(entity)),
  };
  await this.appendToWAL(walEntry);

  // Write entity file
  await writeTextFile(filePath, JSON.stringify(entity), {
    baseDir: BaseDirectory.AppData,
  });

  // Update index
  await this.updateIndex(collection, entity);

  console.log(`[Storage] Saved entity ${collection}/${entity.id}`);
}

/**
 * Load single entity
 */
async loadEntity<T>(collection: string, id: string): Promise<T | null> {
  const filePath = `${collection}/${collection.slice(0, -1)}-${id}.json`;

  try {
    const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });
    if (!fileExists) return null;

    const content = await readTextFile(filePath, { baseDir: BaseDirectory.AppData });
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load entity ${collection}/${id}:`, error);
    return null;
  }
}

/**
 * Update index with entity metadata
 */
private async updateIndex<T extends { id: string }>(
  collection: string,
  entity: T
): Promise<void> {
  const indexPath = `${collection}/index.json`;

  // Load existing index
  let index: any[] = [];
  try {
    const indexExists = await exists(indexPath, { baseDir: BaseDirectory.AppData });
    if (indexExists) {
      const content = await readTextFile(indexPath, { baseDir: BaseDirectory.AppData });
      index = JSON.parse(content);
    }
  } catch (error) {
    console.warn('Failed to load index, creating new:', error);
  }

  // Extract metadata (id, timestamps, status, size)
  const metadata: any = { id: entity.id };

  // Add collection-specific metadata
  if (collection === 'sessions' && 'startTime' in entity) {
    metadata.startTime = (entity as any).startTime;
    metadata.endTime = (entity as any).endTime;
    metadata.status = (entity as any).status;
    metadata.name = (entity as any).name;
  } else if (collection === 'notes' && 'content' in entity) {
    metadata.createdAt = (entity as any).createdAt;
    metadata.title = (entity as any).content.substring(0, 50); // First 50 chars
  } else if (collection === 'tasks' && 'title' in entity) {
    metadata.title = (entity as any).title;
    metadata.status = (entity as any).status;
    metadata.priority = (entity as any).priority;
  }

  // Update or add metadata
  const existingIndex = index.findIndex(i => i.id === entity.id);
  if (existingIndex >= 0) {
    index[existingIndex] = metadata;
  } else {
    index.push(metadata);
  }

  // Write index
  await writeTextFile(indexPath, JSON.stringify(index), {
    baseDir: BaseDirectory.AppData,
  });
}

/**
 * Load all entities (uses index for fast lookup)
 */
async loadAll<T>(collection: string): Promise<T[]> {
  const indexPath = `${collection}/index.json`;

  try {
    const indexExists = await exists(indexPath, { baseDir: BaseDirectory.AppData });
    if (!indexExists) return [];

    const content = await readTextFile(indexPath, { baseDir: BaseDirectory.AppData });
    const index = JSON.parse(content);

    // Load all entities in parallel
    const entities = await Promise.all(
      index.map((meta: any) => this.loadEntity<T>(collection, meta.id))
    );

    return entities.filter(e => e !== null) as T[];
  } catch (error) {
    console.error(`Failed to load all ${collection}:`, error);
    return [];
  }
}
```

**Migration Strategy:**

**File:** `/src/migrations/splitCollections.ts` (new file)

```typescript
import { getStorage } from '../services/storage';
import { BaseDirectory, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';

export async function migrateToPer EntityFiles() {
  console.log('[Migration] Starting per-entity file migration...');

  const storage = await getStorage();
  const collections = ['sessions', 'notes', 'tasks', 'topics', 'companies', 'contacts'];

  for (const collection of collections) {
    try {
      console.log(`[Migration] Migrating ${collection}...`);

      // Load old monolithic file
      const oldData = await storage.load<any[]>(collection);
      if (!oldData || oldData.length === 0) {
        console.log(`[Migration] ${collection} is empty, skipping`);
        continue;
      }

      // Create directory
      await mkdir(collection, { baseDir: BaseDirectory.AppData, recursive: true });

      // Save each entity
      for (const entity of oldData) {
        await (storage as any).saveEntity(collection, entity);
      }

      console.log(`[Migration] ✓ Migrated ${oldData.length} ${collection}`);

      // Backup old file
      const oldPath = `${collection}.json`;
      const backupPath = `${collection}.pre-migration.backup.json`;
      // (Use existing backup mechanism)

    } catch (error) {
      console.error(`[Migration] Failed to migrate ${collection}:`, error);
      throw error; // Halt migration on error
    }
  }

  console.log('[Migration] Per-entity file migration complete!');
}
```

**Call Migration on App Startup:**

**File:** `/src/App.tsx`

**Add to initializeApp (after WAL recovery):**
```typescript
// Check if migration needed
const needsMigration = !(await (storage as any).checkMigrationStatus?.());
if (needsMigration) {
  console.log('[APP] Running per-entity file migration...');
  const { migrateToPerEntityFiles } = await import('./migrations/splitCollections');
  await migrateToPerEntityFiles();
  await (storage as any).setMigrationStatus?.(true);
}
```

**Testing Checklist:**
- [ ] Migration creates per-entity files correctly
- [ ] Index files created with correct metadata
- [ ] Old monolithic files backed up
- [ ] loadAll() returns same data as before migration
- [ ] saveEntity() updates index correctly
- [ ] Performance improvement measurable (faster concurrent writes)

---

#### 2.3 SHA-256 Checksums

**Objective:** Replace simple hash with cryptographic SHA-256 for data integrity.

**Install Dependency:**
```bash
npm install --save-dev @noble/hashes
```

**File:** `/src/services/storage/TauriFileSystemAdapter.ts`

**Add Import:**
```typescript
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
```

**Add Method:**
```typescript
/**
 * Calculate SHA-256 checksum
 */
private async calculateSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(data);
  const hashBytes = sha256(dataBytes);
  return bytesToHex(hashBytes);
}
```

**Update save() to store checksum:**
```typescript
async save<T>(collection: string, data: T): Promise<void> {
  const jsonData = JSON.stringify(data);
  const checksum = await this.calculateSHA256(jsonData);

  // Save data
  const path = `${collection}.json`;
  await writeTextFile(path, jsonData, { baseDir: BaseDirectory.AppData });

  // Save checksum
  const checksumPath = `${collection}.checksum`;
  await writeTextFile(checksumPath, checksum, { baseDir: BaseDirectory.AppData });

  console.log(`[Storage] Saved ${collection} (SHA-256: ${checksum.substring(0, 8)}...)`);
}
```

**Update load() to verify checksum:**
```typescript
async load<T>(collection: string): Promise<T | null> {
  const path = `${collection}.json`;
  const checksumPath = `${collection}.checksum`;

  try {
    const fileExists = await exists(path, { baseDir: BaseDirectory.AppData });
    if (!fileExists) return null;

    // Read data and checksum
    const content = await readTextFile(path, { baseDir: BaseDirectory.AppData });

    const checksumExists = await exists(checksumPath, { baseDir: BaseDirectory.AppData });
    if (checksumExists) {
      const storedChecksum = await readTextFile(checksumPath, { baseDir: BaseDirectory.AppData });
      const actualChecksum = await this.calculateSHA256(content);

      if (storedChecksum !== actualChecksum) {
        throw new Error(`Checksum mismatch for ${collection}! Data may be corrupted.`);
      }

      console.log(`[Storage] Checksum verified for ${collection}`);
    } else {
      console.warn(`[Storage] No checksum found for ${collection}, skipping verification`);
    }

    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load ${collection}:`, error);
    return null;
  }
}
```

**Rust Implementation (for Tauri commands):**

**File:** `/src-tauri/Cargo.toml`

**Add Dependency:**
```toml
[dependencies]
sha2 = "0.10"
hex = "0.4"
```

**File:** `/src-tauri/src/session_storage.rs`

**Add:**
```rust
use sha2::{Sha256, Digest};

fn calculate_sha256(data: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}
```

**Testing Checklist:**
- [ ] SHA-256 checksum calculated correctly
- [ ] Checksum verified on load
- [ ] Corrupted data detected (manual corruption test)
- [ ] Error shown to user on checksum mismatch
- [ ] Performance impact minimal (<10ms per file)

---

#### 2.4 Transaction System

**Objective:** Group related operations into atomic units.

**File:** `/src/services/storage/StorageAdapter.ts`

**Add Transaction Interface:**
```typescript
export interface Transaction {
  id: string;
  operations: TransactionOperation[];
}

export interface TransactionOperation {
  type: 'write' | 'delete';
  collection: string;
  data?: any;
  entityId?: string;
}

export abstract class StorageAdapter {
  // ... existing methods ...

  abstract beginTransaction(): string; // Returns transaction ID
  abstract addOperation(txId: string, operation: TransactionOperation): void;
  abstract commitTransaction(txId: string): Promise<void>;
  abstract rollbackTransaction(txId: string): Promise<void>;
}
```

**File:** `/src/services/storage/TauriFileSystemAdapter.ts`

**Implement Transactions:**
```typescript
private transactions = new Map<string, Transaction>();

beginTransaction(): string {
  const txId = `tx-${Date.now()}-${Math.random()}`;
  this.transactions.set(txId, {
    id: txId,
    operations: [],
  });

  // Write to WAL
  const walEntry: WALEntry = {
    id: `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    operation: 'transaction-start',
    collection: '',
    transactionId: txId,
  };
  this.appendToWAL(walEntry).catch(console.error);

  console.log(`[Transaction] Started: ${txId}`);
  return txId;
}

addOperation(txId: string, operation: TransactionOperation): void {
  const tx = this.transactions.get(txId);
  if (!tx) {
    throw new Error(`Transaction ${txId} not found`);
  }

  tx.operations.push(operation);
  console.log(`[Transaction] Added operation to ${txId}: ${operation.type} ${operation.collection}`);
}

async commitTransaction(txId: string): Promise<void> {
  const tx = this.transactions.get(txId);
  if (!tx) {
    throw new Error(`Transaction ${txId} not found`);
  }

  console.log(`[Transaction] Committing ${txId} (${tx.operations.length} operations)...`);

  try {
    // Execute all operations
    for (const op of tx.operations) {
      // Write to WAL first
      const walEntry: WALEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        operation: op.type === 'write' ? 'write' : 'delete',
        collection: op.collection,
        data: op.data,
        checksum: op.data ? await this.calculateSHA256(JSON.stringify(op.data)) : undefined,
        transactionId: txId,
      };
      await this.appendToWAL(walEntry);

      // Execute operation
      if (op.type === 'write') {
        if (op.entityId) {
          await this.saveEntity(op.collection, { ...op.data, id: op.entityId });
        } else {
          await this.save(op.collection, op.data);
        }
      } else if (op.type === 'delete') {
        // Delete entity
        const path = `${op.collection}/${op.collection.slice(0, -1)}-${op.entityId}.json`;
        await remove(path, { baseDir: BaseDirectory.AppData });
      }
    }

    // Write commit to WAL
    const commitEntry: WALEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      operation: 'transaction-commit',
      collection: '',
      transactionId: txId,
    };
    await this.appendToWAL(commitEntry);

    console.log(`[Transaction] ✓ Committed ${txId}`);

    // Clean up
    this.transactions.delete(txId);

  } catch (error) {
    console.error(`[Transaction] Commit failed for ${txId}:`, error);
    await this.rollbackTransaction(txId);
    throw error;
  }
}

async rollbackTransaction(txId: string): Promise<void> {
  console.log(`[Transaction] Rolling back ${txId}...`);

  // Write rollback to WAL
  const rollbackEntry: WALEntry = {
    id: `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    operation: 'transaction-rollback',
    collection: '',
    transactionId: txId,
  };
  await this.appendToWAL(rollbackEntry);

  // Clean up
  this.transactions.delete(txId);

  console.log(`[Transaction] ✗ Rolled back ${txId}`);
}
```

**Usage Example (sessionEnrichmentService):**

**File:** `/src/services/sessionEnrichmentService.ts`

**Before (Lines 368-393):**
```typescript
const storage = await getStorage();
const sessions = await storage.load<Session[]>('sessions');
sessions[sessionIndex].enrichmentStatus = { status: 'in-progress', ... };
await storage.save('sessions', sessions);
```

**After (with Transactions):**
```typescript
const storage = await getStorage();

// Start transaction
const txId = storage.beginTransaction();

try {
  // Load session
  const session = await storage.loadEntity<Session>('sessions', sessionId);

  // Update enrichment status
  session.enrichmentStatus = { status: 'in-progress', ... };

  // Add to transaction
  storage.addOperation(txId, {
    type: 'write',
    collection: 'sessions',
    entityId: sessionId,
    data: session,
  });

  // Commit transaction
  await storage.commitTransaction(txId);

  console.log('[Enrichment] ✓ Transaction committed');

} catch (error) {
  // Rollback on error
  await storage.rollbackTransaction(txId);
  console.error('[Enrichment] ✗ Transaction rolled back:', error);
  throw error;
}
```

**Testing Checklist:**
- [ ] Transaction groups multiple operations
- [ ] Commit applies all operations atomically
- [ ] Rollback cancels all operations
- [ ] WAL records transaction boundaries
- [ ] Crash during transaction recovers correctly
- [ ] Enrichment conflicts resolved

---

### Phase 2 Success Criteria

**Must Have:**
- [ ] WAL implemented with recovery on startup
- [ ] Per-entity files for all collections
- [ ] Index files created and maintained
- [ ] SHA-256 checksums verified on every read
- [ ] Transaction API implemented
- [ ] sessionEnrichmentService uses transactions
- [ ] Migration from Phase 1 to Phase 2 succeeds
- [ ] All data intact after migration
- [ ] No enrichment race conditions

**Nice to Have:**
- [ ] WAL compression to reduce disk usage
- [ ] Parallel entity loading for faster startup
- [ ] Checksum caching to reduce computation

**Rollback Procedure:**
If Phase 2 causes issues:
1. Restore from pre-migration backup
2. Disable WAL recovery (skip recoverFromWAL call)
3. Revert to monolithic collection files
4. Remove transaction code from enrichment service

**Timeline:** 3-4 weeks

**Estimated Effort:**
- WAL implementation: 1.5 weeks
- Per-entity files + indexing: 1 week
- SHA-256 checksums: 3 days
- Transaction system: 1 week
- Migration + testing: 1 week

---

## Phase 3: Scale & Performance (4-5 weeks)

### Goal
Optimize for 10,000+ sessions with multi-level indexing, lazy loading, query engine, compression, and deduplication.

### Implementation Tasks

#### 3.1 Multi-Level Indexing

**Objective:** Fast queries without loading full data.

**Index Types:**
1. **Date Index** - Chronological queries (e.g., "sessions this month")
2. **Tag Index** - Topic/company/contact lookups
3. **Status Index** - Filter by status (completed/active/interrupted)
4. **Category Index** - Type-based queries (notes/tasks/sessions)
5. **Full-Text Index** - Search within content

**File:** `/src/services/storage/IndexingEngine.ts` (new file)

```typescript
export interface DateIndex {
  year: number;
  month: number;
  day?: number;
  entityIds: string[];
}

export interface TagIndex {
  tag: string; // topic/company/contact name
  entityIds: string[];
}

export interface StatusIndex {
  status: string;
  entityIds: string[];
}

export interface FullTextIndex {
  token: string; // Normalized word
  entityIds: string[];
}

export class IndexingEngine {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  /**
   * Build date index for collection
   */
  async buildDateIndex(collection: string, dateField: string): Promise<void> {
    console.log(`[Indexing] Building date index for ${collection}.${dateField}...`);

    const index = await this.storage.loadIndex(collection, 'date');
    const entities = await this.storage.loadAll(collection);

    const dateIndex: DateIndex[] = [];

    for (const entity of entities) {
      const date = new Date((entity as any)[dateField]);
      if (isNaN(date.getTime())) continue;

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();

      // Year-month-day index
      let entry = dateIndex.find(e => e.year === year && e.month === month && e.day === day);
      if (!entry) {
        entry = { year, month, day, entityIds: [] };
        dateIndex.push(entry);
      }
      entry.entityIds.push((entity as any).id);
    }

    // Save index
    await this.storage.saveIndex(collection, 'date', dateIndex);

    console.log(`[Indexing] ✓ Date index built: ${dateIndex.length} entries`);
  }

  /**
   * Build tag index for collection
   */
  async buildTagIndex(collection: string, tagFields: string[]): Promise<void> {
    console.log(`[Indexing] Building tag index for ${collection}...`);

    const entities = await this.storage.loadAll(collection);
    const tagIndex: TagIndex[] = [];

    for (const entity of entities) {
      for (const field of tagFields) {
        const tags = (entity as any)[field];
        if (!Array.isArray(tags)) continue;

        for (const tag of tags) {
          let entry = tagIndex.find(e => e.tag === tag);
          if (!entry) {
            entry = { tag, entityIds: [] };
            tagIndex.push(entry);
          }
          if (!entry.entityIds.includes((entity as any).id)) {
            entry.entityIds.push((entity as any).id);
          }
        }
      }
    }

    // Save index
    await this.storage.saveIndex(collection, 'tags', tagIndex);

    console.log(`[Indexing] ✓ Tag index built: ${tagIndex.length} tags`);
  }

  /**
   * Build status index
   */
  async buildStatusIndex(collection: string): Promise<void> {
    console.log(`[Indexing] Building status index for ${collection}...`);

    const entities = await this.storage.loadAll(collection);
    const statusIndex: StatusIndex[] = [];

    for (const entity of entities) {
      const status = (entity as any).status;
      if (!status) continue;

      let entry = statusIndex.find(e => e.status === status);
      if (!entry) {
        entry = { status, entityIds: [] };
        statusIndex.push(entry);
      }
      entry.entityIds.push((entity as any).id);
    }

    // Save index
    await this.storage.saveIndex(collection, 'status', statusIndex);

    console.log(`[Indexing] ✓ Status index built: ${statusIndex.length} statuses`);
  }

  /**
   * Build full-text index
   */
  async buildFullTextIndex(collection: string, textFields: string[]): Promise<void> {
    console.log(`[Indexing] Building full-text index for ${collection}...`);

    const entities = await this.storage.loadAll(collection);
    const fullTextIndex: FullTextIndex[] = [];

    for (const entity of entities) {
      for (const field of textFields) {
        const text = (entity as any)[field];
        if (typeof text !== 'string') continue;

        // Tokenize (simple whitespace split + lowercase)
        const tokens = text.toLowerCase().split(/\s+/).filter(t => t.length > 2);

        for (const token of tokens) {
          let entry = fullTextIndex.find(e => e.token === token);
          if (!entry) {
            entry = { token, entityIds: [] };
            fullTextIndex.push(entry);
          }
          if (!entry.entityIds.includes((entity as any).id)) {
            entry.entityIds.push((entity as any).id);
          }
        }
      }
    }

    // Save index
    await this.storage.saveIndex(collection, 'fulltext', fullTextIndex);

    console.log(`[Indexing] ✓ Full-text index built: ${fullTextIndex.length} tokens`);
  }

  /**
   * Rebuild all indexes for collection
   */
  async rebuildAllIndexes(collection: string): Promise<void> {
    console.log(`[Indexing] Rebuilding all indexes for ${collection}...`);

    if (collection === 'sessions') {
      await this.buildDateIndex('sessions', 'startTime');
      await this.buildTagIndex('sessions', ['topicIds', 'companyIds']);
      await this.buildStatusIndex('sessions');
      await this.buildFullTextIndex('sessions', ['name', 'description']);
    } else if (collection === 'notes') {
      await this.buildDateIndex('notes', 'createdAt');
      await this.buildTagIndex('notes', ['topicIds', 'companyIds', 'contactIds']);
      await this.buildFullTextIndex('notes', ['content']);
    } else if (collection === 'tasks') {
      await this.buildDateIndex('tasks', 'createdAt');
      await this.buildTagIndex('tasks', ['topicId']);
      await this.buildStatusIndex('tasks');
      await this.buildFullTextIndex('tasks', ['title', 'description']);
    }

    console.log(`[Indexing] ✓ All indexes rebuilt for ${collection}`);
  }
}
```

**Add Index Methods to StorageAdapter:**

**File:** `/src/services/storage/StorageAdapter.ts`

```typescript
abstract saveIndex(collection: string, indexType: string, data: any): Promise<void>;
abstract loadIndex(collection: string, indexType: string): Promise<any>;
```

**File:** `/src/services/storage/TauriFileSystemAdapter.ts`

```typescript
async saveIndex(collection: string, indexType: string, data: any): Promise<void> {
  const path = `${collection}/indexes/${indexType}.json`;

  // Ensure directory exists
  await mkdir(`${collection}/indexes`, { baseDir: BaseDirectory.AppData, recursive: true });

  await writeTextFile(path, JSON.stringify(data), {
    baseDir: BaseDirectory.AppData,
  });

  console.log(`[Storage] Saved ${collection} ${indexType} index`);
}

async loadIndex(collection: string, indexType: string): Promise<any> {
  const path = `${collection}/indexes/${indexType}.json`;

  const fileExists = await exists(path, { baseDir: BaseDirectory.AppData });
  if (!fileExists) return null;

  const content = await readTextFile(path, { baseDir: BaseDirectory.AppData });
  return JSON.parse(content);
}
```

**Testing Checklist:**
- [ ] Date index built correctly
- [ ] Tag index includes all tags
- [ ] Status index groups by status
- [ ] Full-text index tokenizes correctly
- [ ] Index updates when entities change
- [ ] Index queries faster than full scan (benchmark)

---

#### 3.2 Lazy Loading Architecture

**Objective:** Load only what's needed, when it's needed.

**Three-Tier Loading:**
1. **Tier 1: Indexes** - Load on startup (fast, <100KB)
2. **Tier 2: Metadata** - Load on demand (entity IDs, timestamps, titles)
3. **Tier 3: Full Data** - Load on view (complete entity with attachments)

**File:** `/src/services/storage/LazyLoader.ts` (new file)

```typescript
export class LazyLoader<T> {
  private storage: StorageAdapter;
  private collection: string;
  private cache = new Map<string, T>();
  private metadataCache = new Map<string, any>();

  constructor(storage: StorageAdapter, collection: string) {
    this.storage = storage;
    this.collection = collection;
  }

  /**
   * Load metadata only (fast)
   */
  async loadMetadata(ids: string[]): Promise<Map<string, any>> {
    const metadata = new Map<string, any>();

    // Check cache first
    const uncached = ids.filter(id => !this.metadataCache.has(id));

    if (uncached.length > 0) {
      // Load index to get metadata
      const index = await this.storage.loadIndex(this.collection, 'metadata');

      for (const id of uncached) {
        const meta = index?.find((m: any) => m.id === id);
        if (meta) {
          this.metadataCache.set(id, meta);
        }
      }
    }

    // Return from cache
    for (const id of ids) {
      const meta = this.metadataCache.get(id);
      if (meta) {
        metadata.set(id, meta);
      }
    }

    return metadata;
  }

  /**
   * Load full entity (lazy)
   */
  async loadEntity(id: string): Promise<T | null> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // Load from storage
    const entity = await this.storage.loadEntity<T>(this.collection, id);

    if (entity) {
      this.cache.set(id, entity);
    }

    return entity;
  }

  /**
   * Prefetch entities in background
   */
  async prefetch(ids: string[]): Promise<void> {
    // Load entities in parallel
    const promises = ids.map(id => this.loadEntity(id));
    await Promise.all(promises);

    console.log(`[LazyLoader] Prefetched ${ids.length} ${this.collection}`);
  }

  /**
   * Clear cache to free memory
   */
  clearCache(): void {
    this.cache.clear();
    this.metadataCache.clear();
  }
}
```

**Usage in SessionsContext:**

**File:** `/src/context/SessionsContext.tsx`

**Before:**
```typescript
const [sessions, setSessions] = useState<Session[]>([]);

useEffect(() => {
  const loadSessions = async () => {
    const storage = await getStorage();
    const loaded = await storage.load<Session[]>('sessions') || [];
    setSessions(loaded);
  };
  loadSessions();
}, []);
```

**After (with Lazy Loading):**
```typescript
const [sessionIds, setSessionIds] = useState<string[]>([]);
const [sessionMetadata, setSessionMetadata] = useState<Map<string, any>>(new Map());
const lazyLoader = useRef<LazyLoader<Session>>();

useEffect(() => {
  const initLazyLoader = async () => {
    const storage = await getStorage();
    lazyLoader.current = new LazyLoader<Session>(storage, 'sessions');

    // Load index (fast)
    const index = await storage.loadIndex('sessions', 'metadata');
    const ids = index?.map((m: any) => m.id) || [];
    setSessionIds(ids);

    // Load metadata (fast)
    const metadata = await lazyLoader.current.loadMetadata(ids);
    setSessionMetadata(metadata);

    // Prefetch first 10 sessions in background
    lazyLoader.current.prefetch(ids.slice(0, 10));
  };

  initLazyLoader();
}, []);

// Load full session on demand
const loadSession = async (id: string): Promise<Session | null> => {
  if (!lazyLoader.current) return null;
  return await lazyLoader.current.loadEntity(id);
};
```

**Testing Checklist:**
- [ ] Metadata loads < 100ms (vs 1s+ for full load)
- [ ] Full entities load on demand
- [ ] Prefetching works in background
- [ ] Cache reduces redundant loads
- [ ] Memory usage reduced by 90%

---

#### 3.3 Query Engine

**Objective:** SQL-like queries with optimal execution plans.

**File:** `/src/services/storage/QueryEngine.ts` (new file)

```typescript
export interface Query {
  collection: string;
  filters?: QueryFilter[];
  sort?: QuerySort;
  limit?: number;
  offset?: number;
}

export interface QueryFilter {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'contains';
  value: any;
}

export interface QuerySort {
  field: string;
  direction: 'asc' | 'desc';
}

export class QueryEngine {
  private storage: StorageAdapter;
  private indexing: IndexingEngine;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
    this.indexing = new IndexingEngine(storage);
  }

  /**
   * Execute query with optimal plan
   */
  async execute<T>(query: Query): Promise<T[]> {
    console.log('[Query] Executing:', JSON.stringify(query));

    // 1. Select optimal execution plan
    const plan = this.selectPlan(query);
    console.log('[Query] Plan:', plan.strategy);

    // 2. Get candidate IDs using indexes
    let candidateIds: string[] = [];

    if (plan.strategy === 'date-index') {
      candidateIds = await this.queryDateIndex(query);
    } else if (plan.strategy === 'tag-index') {
      candidateIds = await this.queryTagIndex(query);
    } else if (plan.strategy === 'status-index') {
      candidateIds = await this.queryStatusIndex(query);
    } else if (plan.strategy === 'fulltext-index') {
      candidateIds = await this.queryFullTextIndex(query);
    } else {
      // Fallback: load all IDs
      const index = await this.storage.loadIndex(query.collection, 'metadata');
      candidateIds = index?.map((m: any) => m.id) || [];
    }

    // 3. Apply remaining filters
    const entities: T[] = [];
    for (const id of candidateIds) {
      const entity = await this.storage.loadEntity<T>(query.collection, id);
      if (entity && this.matchesFilters(entity, query.filters || [])) {
        entities.push(entity);
      }
    }

    // 4. Sort
    if (query.sort) {
      entities.sort((a, b) => {
        const aVal = (a as any)[query.sort!.field];
        const bVal = (b as any)[query.sort!.field];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return query.sort!.direction === 'asc' ? cmp : -cmp;
      });
    }

    // 5. Limit & offset
    const start = query.offset || 0;
    const end = query.limit ? start + query.limit : undefined;
    const results = entities.slice(start, end);

    console.log(`[Query] ✓ Returned ${results.length} results (from ${candidateIds.length} candidates)`);

    return results;
  }

  /**
   * Select optimal query execution plan
   */
  private selectPlan(query: Query): { strategy: string } {
    // Check for date filters
    const dateFilter = query.filters?.find(f =>
      f.field.includes('Time') || f.field.includes('Date') || f.field.includes('At')
    );
    if (dateFilter) return { strategy: 'date-index' };

    // Check for tag filters
    const tagFilter = query.filters?.find(f =>
      f.field.includes('Id') && f.operator === 'in'
    );
    if (tagFilter) return { strategy: 'tag-index' };

    // Check for status filters
    const statusFilter = query.filters?.find(f => f.field === 'status');
    if (statusFilter) return { strategy: 'status-index' };

    // Check for text search
    const textFilter = query.filters?.find(f => f.operator === 'contains');
    if (textFilter) return { strategy: 'fulltext-index' };

    // Fallback: full scan
    return { strategy: 'full-scan' };
  }

  private async queryDateIndex(query: Query): Promise<string[]> {
    const dateFilter = query.filters?.find(f =>
      f.field.includes('Time') || f.field.includes('Date') || f.field.includes('At')
    );
    if (!dateFilter) return [];

    const dateIndex = await this.storage.loadIndex(query.collection, 'date');
    if (!dateIndex) return [];

    // Example: startTime >= 2025-01-01
    const targetDate = new Date(dateFilter.value);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();

    const results: string[] = [];
    for (const entry of dateIndex) {
      if (entry.year === year && entry.month === month && entry.day === day) {
        results.push(...entry.entityIds);
      }
    }

    return results;
  }

  private async queryTagIndex(query: Query): Promise<string[]> {
    const tagFilter = query.filters?.find(f =>
      f.field.includes('Id') && f.operator === 'in'
    );
    if (!tagFilter) return [];

    const tagIndex = await this.storage.loadIndex(query.collection, 'tags');
    if (!tagIndex) return [];

    const tag = tagFilter.value;
    const entry = tagIndex.find((e: any) => e.tag === tag);

    return entry?.entityIds || [];
  }

  private async queryStatusIndex(query: Query): Promise<string[]> {
    const statusFilter = query.filters?.find(f => f.field === 'status');
    if (!statusFilter) return [];

    const statusIndex = await this.storage.loadIndex(query.collection, 'status');
    if (!statusIndex) return [];

    const status = statusFilter.value;
    const entry = statusIndex.find((e: any) => e.status === status);

    return entry?.entityIds || [];
  }

  private async queryFullTextIndex(query: Query): Promise<string[]> {
    const textFilter = query.filters?.find(f => f.operator === 'contains');
    if (!textFilter) return [];

    const fullTextIndex = await this.storage.loadIndex(query.collection, 'fulltext');
    if (!fullTextIndex) return [];

    const searchTerm = textFilter.value.toLowerCase();
    const tokens = searchTerm.split(/\s+/);

    // Find entities containing ALL tokens (AND logic)
    const entitySets = tokens.map(token => {
      const entry = fullTextIndex.find((e: any) => e.token === token);
      return new Set(entry?.entityIds || []);
    });

    // Intersection of all sets
    const results = Array.from(entitySets[0]).filter(id =>
      entitySets.every(set => set.has(id))
    );

    return results;
  }

  private matchesFilters(entity: any, filters: QueryFilter[]): boolean {
    for (const filter of filters) {
      const value = entity[filter.field];

      switch (filter.operator) {
        case '=':
          if (value !== filter.value) return false;
          break;
        case '!=':
          if (value === filter.value) return false;
          break;
        case '>':
          if (!(value > filter.value)) return false;
          break;
        case '<':
          if (!(value < filter.value)) return false;
          break;
        case '>=':
          if (!(value >= filter.value)) return false;
          break;
        case '<=':
          if (!(value <= filter.value)) return false;
          break;
        case 'in':
          if (!Array.isArray(value) || !value.includes(filter.value)) return false;
          break;
        case 'contains':
          if (typeof value !== 'string' || !value.toLowerCase().includes(filter.value.toLowerCase())) return false;
          break;
      }
    }

    return true;
  }
}
```

**Usage Example:**

```typescript
const queryEngine = new QueryEngine(storage);

// Query: completed sessions from last 30 days
const results = await queryEngine.execute<Session>({
  collection: 'sessions',
  filters: [
    { field: 'status', operator: '=', value: 'completed' },
    { field: 'startTime', operator: '>=', value: Date.now() - 30 * 24 * 60 * 60 * 1000 }
  ],
  sort: { field: 'startTime', direction: 'desc' },
  limit: 20,
});
```

**Testing Checklist:**
- [ ] Date queries use date index (fast)
- [ ] Tag queries use tag index (fast)
- [ ] Status queries use status index (fast)
- [ ] Full-text queries use fulltext index (fast)
- [ ] Complex queries with multiple filters work correctly
- [ ] Sorting works correctly
- [ ] Limit & offset work correctly
- [ ] Performance: 40x faster than full scan (benchmark)

---

#### 3.4 Compression

**Objective:** Reduce disk usage by 60% with gzip compression.

**Install Dependency:**
```bash
npm install --save pako
```

**File:** `/src/services/storage/TauriFileSystemAdapter.ts`

**Add Import:**
```typescript
import pako from 'pako';
```

**Add Methods:**
```typescript
/**
 * Compress data with gzip
 */
private compress(data: string): Uint8Array {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  return pako.gzip(bytes);
}

/**
 * Decompress gzip data
 */
private decompress(compressed: Uint8Array): string {
  const decompressed = pako.ungzip(compressed);
  const decoder = new TextDecoder();
  return decoder.decode(decompressed);
}

/**
 * Save compressed entity
 */
async saveEntityCompressed<T extends { id: string }>(
  collection: string,
  entity: T
): Promise<void> {
  const dir = collection;
  const filePath = `${dir}/${collection.slice(0, -1)}-${entity.id}.json.gz`;

  // Compress data
  const jsonData = JSON.stringify(entity);
  const compressed = this.compress(jsonData);

  // Write compressed binary
  await writeBinaryFile(filePath, compressed, {
    baseDir: BaseDirectory.AppData,
  });

  console.log(`[Storage] Saved compressed entity ${collection}/${entity.id} (${compressed.length} bytes)`);
}

/**
 * Load compressed entity
 */
async loadEntityCompressed<T>(collection: string, id: string): Promise<T | null> {
  const filePath = `${collection}/${collection.slice(0, -1)}-${id}.json.gz`;

  try {
    const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });
    if (!fileExists) return null;

    // Read compressed binary
    const compressed = await readBinaryFile(filePath, { baseDir: BaseDirectory.AppData });

    // Decompress
    const jsonData = this.decompress(compressed);

    return JSON.parse(jsonData);
  } catch (error) {
    console.error(`Failed to load compressed entity ${collection}/${id}:`, error);
    return null;
  }
}
```

**Add Import:**
```typescript
import { writeBinaryFile, readBinaryFile } from '@tauri-apps/plugin-fs';
```

**Performance Metrics:**
- Uncompressed session: ~70KB
- Compressed session: ~25KB (64% reduction)
- Compression time: ~5ms
- Decompression time: ~3ms

**Testing Checklist:**
- [ ] Compression reduces file size by 60%
- [ ] Decompression returns original data
- [ ] Compression time < 10ms per entity
- [ ] All collections work with compression
- [ ] Migration from uncompressed to compressed succeeds

---

#### 3.5 Deduplication

**Objective:** Reduce attachment storage by 45% through hash-based deduplication.

**File:** `/src/services/attachmentStorage.ts`

**Add Deduplication Logic:**
```typescript
interface AttachmentRef {
  hash: string;       // SHA-256 of content
  count: number;      // Reference count
  filePath: string;   // Physical file path
}

class AttachmentStorage {
  private refs = new Map<string, AttachmentRef>(); // hash -> ref

  async createAttachment(params: {
    type: string;
    name: string;
    mimeType: string;
    size: number;
    base64: string;
  }): Promise<Attachment> {
    // Calculate hash of content
    const hash = await this.calculateSHA256(params.base64);

    // Check if already exists
    if (this.refs.has(hash)) {
      const ref = this.refs.get(hash)!;
      ref.count++;

      console.log(`[Attachment] Deduplicated: ${params.name} (hash: ${hash.substring(0, 8)}...)`);

      // Return attachment pointing to existing file
      return {
        id: `attachment-${Date.now()}`,
        type: params.type as any,
        name: params.name,
        mimeType: params.mimeType,
        size: params.size,
        hash, // Store hash for later lookup
        createdAt: Date.now(),
      };
    }

    // New file - save it
    const filePath = `attachments/${hash.substring(0, 2)}/${hash}`;
    await this.saveFile(filePath, params.base64);

    // Create reference
    this.refs.set(hash, {
      hash,
      count: 1,
      filePath,
    });

    console.log(`[Attachment] Created: ${params.name} (hash: ${hash.substring(0, 8)}...)`);

    return {
      id: `attachment-${Date.now()}`,
      type: params.type as any,
      name: params.name,
      mimeType: params.mimeType,
      size: params.size,
      hash,
      createdAt: Date.now(),
    };
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    // Load attachment to get hash
    const attachment = await this.loadAttachment(attachmentId);
    if (!attachment || !attachment.hash) return;

    // Decrement reference count
    const ref = this.refs.get(attachment.hash);
    if (!ref) return;

    ref.count--;

    // Delete physical file if no more references
    if (ref.count === 0) {
      await this.deleteFile(ref.filePath);
      this.refs.delete(attachment.hash);
      console.log(`[Attachment] Deleted physical file: ${ref.filePath}`);
    } else {
      console.log(`[Attachment] Decremented ref count: ${attachment.hash.substring(0, 8)}... (${ref.count} remaining)`);
    }
  }

  async loadAttachment(attachmentId: string): Promise<Attachment | null> {
    // Load attachment metadata
    const metadata = await this.loadMetadata(attachmentId);
    if (!metadata || !metadata.hash) return null;

    // Find physical file by hash
    const ref = this.refs.get(metadata.hash);
    if (!ref) return null;

    // Load file content
    const content = await this.loadFile(ref.filePath);

    return {
      ...metadata,
      data: content,
    };
  }

  /**
   * Rebuild references from disk
   */
  async rebuildRefs(): Promise<void> {
    console.log('[Attachment] Rebuilding reference counts...');

    this.refs.clear();

    // Scan all attachments
    const storage = await getStorage();
    const sessions = await storage.loadAll<Session>('sessions');
    const notes = await storage.loadAll<Note>('notes');
    const tasks = await storage.loadAll<Task>('tasks');

    const allAttachments: Attachment[] = [];

    // Collect all attachments
    for (const session of sessions) {
      if (session.screenshots) {
        for (const screenshot of session.screenshots) {
          if (screenshot.attachmentId) {
            const att = await this.loadMetadata(screenshot.attachmentId);
            if (att) allAttachments.push(att);
          }
        }
      }
      if (session.audioSegments) {
        for (const segment of session.audioSegments) {
          if (segment.attachmentId) {
            const att = await this.loadMetadata(segment.attachmentId);
            if (att) allAttachments.push(att);
          }
        }
      }
    }

    // Build refs
    for (const att of allAttachments) {
      if (!att.hash) continue;

      if (!this.refs.has(att.hash)) {
        this.refs.set(att.hash, {
          hash: att.hash,
          count: 1,
          filePath: `attachments/${att.hash.substring(0, 2)}/${att.hash}`,
        });
      } else {
        this.refs.get(att.hash)!.count++;
      }
    }

    console.log(`[Attachment] ✓ Rebuilt ${this.refs.size} references`);
  }
}
```

**Add Hash Field to Attachment Type:**

**File:** `/src/types.ts`

```typescript
export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document';
  name: string;
  mimeType: string;
  size: number;
  hash?: string; // SHA-256 hash for deduplication
  createdAt: number;
  data?: string; // base64 (loaded on demand)
}
```

**Testing Checklist:**
- [ ] Duplicate attachments deduplicated (same hash)
- [ ] Reference counting works correctly
- [ ] Physical file deleted when count reaches 0
- [ ] Rebuild refs recovers from corrupted state
- [ ] Disk space reduced by 45% (tested with real data)

---

### Phase 3 Success Criteria

**Must Have:**
- [ ] Date, tag, status, and full-text indexes built
- [ ] Lazy loading reduces startup time by 10x
- [ ] Query engine uses indexes for fast queries (40x improvement)
- [ ] Compression reduces disk usage by 60%
- [ ] Deduplication reduces attachment storage by 45%
- [ ] All features work with 10,000+ sessions

**Nice to Have:**
- [ ] Query caching for repeated queries
- [ ] Index auto-rebuild on entity changes
- [ ] Attachment previews (thumbnails)

**Rollback Procedure:**
If Phase 3 causes issues:
1. Disable indexing (load full data)
2. Disable lazy loading (load all at startup)
3. Disable compression (use plain JSON)
4. Disable deduplication (store full files)

**Timeline:** 4-5 weeks

**Estimated Effort:**
- Multi-level indexing: 1.5 weeks
- Lazy loading: 1 week
- Query engine: 1.5 weeks
- Compression: 3 days
- Deduplication: 1 week
- Testing & benchmarking: 1 week

---

## Implementation Timeline

### Week-by-Week Breakdown

#### **Phase 1: Emergency Fixes (Weeks 1-6)**

**Week 1:**
- [ ] Implement mandatory backup system (TauriFileSystemAdapter)
- [ ] Add backup rotation (keep 10)
- [ ] Test backup verification

**Week 2:**
- [ ] Remove enrichment skip logic (SessionsContext)
- [ ] Reduce debounce to 1 second
- [ ] Test rapid changes don't lose data

**Week 3:**
- [ ] Add startup backup hook (App.tsx)
- [ ] Add shutdown backup hook
- [ ] Add hourly backup interval
- [ ] Test automatic backups

**Week 4:**
- [ ] Build backup recovery UI (ProfileZone)
- [ ] Add backup list display
- [ ] Add restore functionality
- [ ] Test recovery from corrupted state

**Week 5:**
- [ ] Fix export to include all collections (ProfileZone)
- [ ] Add import validation
- [ ] Add pre-import backup
- [ ] Test export/import with real data

**Week 6:**
- [ ] Integration testing across all Phase 1 features
- [ ] Performance testing (ensure no regressions)
- [ ] User acceptance testing
- [ ] Bug fixes and polish

**Checkpoint:** All Phase 1 features working, no data loss observed in testing

---

#### **Phase 2: Robust Foundation (Weeks 7-10)**

**Week 7:**
- [ ] Implement WAL (Write-Ahead Logging)
- [ ] Add WAL recovery on startup
- [ ] Add checkpoint mechanism
- [ ] Test crash recovery

**Week 8:**
- [ ] Implement per-entity file storage
- [ ] Create index files for fast lookups
- [ ] Build migration from Phase 1 to Phase 2
- [ ] Test migration with real data

**Week 9:**
- [ ] Implement SHA-256 checksums (TypeScript + Rust)
- [ ] Add checksum verification on read
- [ ] Test corruption detection
- [ ] Implement transaction system (begin/commit/rollback)
- [ ] Test transactions with enrichment service

**Week 10:**
- [ ] Update sessionEnrichmentService to use transactions
- [ ] Integration testing across all Phase 2 features
- [ ] Performance testing (measure improvement)
- [ ] User acceptance testing

**Checkpoint:** ACID transactions working, no race conditions, all data migrated successfully

---

#### **Phase 3: Scale & Performance (Weeks 11-15)**

**Week 11:**
- [ ] Implement multi-level indexing (date, tag, status, fulltext)
- [ ] Test index building
- [ ] Benchmark query performance (vs Phase 2)

**Week 12:**
- [ ] Implement lazy loading (3-tier architecture)
- [ ] Add prefetching
- [ ] Test memory usage reduction
- [ ] Benchmark startup time (vs Phase 2)

**Week 13:**
- [ ] Implement query engine
- [ ] Add query optimization
- [ ] Test complex queries
- [ ] Benchmark query speed (vs Phase 2)

**Week 14:**
- [ ] Implement compression (pako gzip)
- [ ] Implement deduplication (hash-based)
- [ ] Test disk space reduction
- [ ] Migration to compressed format

**Week 15:**
- [ ] Integration testing across all Phase 3 features
- [ ] Performance benchmarking (10K+ sessions)
- [ ] User acceptance testing
- [ ] Documentation and cleanup

**Checkpoint:** 10,000+ sessions perform well, all performance targets met

---

## Testing Strategy

### Unit Tests

**Phase 1:**
- [ ] TauriFileSystemAdapter backup methods
- [ ] SessionsContext debounce behavior
- [ ] ProfileZone export/import logic

**Phase 2:**
- [ ] WAL append and recovery
- [ ] Per-entity file save/load
- [ ] SHA-256 checksum calculation
- [ ] Transaction commit/rollback

**Phase 3:**
- [ ] Index building (all types)
- [ ] Lazy loader caching
- [ ] Query engine optimization
- [ ] Compression/decompression
- [ ] Deduplication ref counting

### Integration Tests

**Phase 1:**
- [ ] Startup → backup created → shutdown → backup created
- [ ] Enrichment runs → no data loss
- [ ] Export → import → data intact

**Phase 2:**
- [ ] App crash → WAL recovery → data intact
- [ ] Concurrent writes → no conflicts (transactions)
- [ ] Migration → all data preserved

**Phase 3:**
- [ ] 10K sessions → startup < 1s
- [ ] Complex query → results < 50ms
- [ ] Compressed storage → 60% reduction

### Load Tests

**Phase 1:**
- [ ] 100 sessions with rapid changes
- [ ] Backup rotation with 1000+ backups

**Phase 2:**
- [ ] 1000 concurrent writes (transactions)
- [ ] WAL with 10K entries

**Phase 3:**
- [ ] 10,000 sessions (startup, query, lazy load)
- [ ] 100,000 attachments (deduplication)

### Chaos Tests

**All Phases:**
- [ ] App crash during write → recovery works
- [ ] Disk full → graceful error handling
- [ ] Corrupted file → checksum detects, backup restores
- [ ] Network interruption (if sync added later)

---

## Risk Assessment

### High Risk

1. **Data Loss During Migration (Phase 2)**
   - **Mitigation:** Mandatory backup before migration, rollback on failure
   - **Testing:** Test migration with production data copy

2. **Performance Regression (Phase 3)**
   - **Mitigation:** Benchmark before/after, feature flags to disable if needed
   - **Testing:** Load tests with 10K+ sessions

3. **Corrupted WAL (Phase 2)**
   - **Mitigation:** WAL checksum, recovery from last checkpoint
   - **Testing:** Chaos tests with simulated corruption

### Medium Risk

1. **Enrichment Race Conditions (Phase 1)**
   - **Mitigation:** Reduce debounce to 1s, Phase 2 transactions fix properly
   - **Testing:** Stress test enrichment + rapid changes

2. **Index Out of Sync (Phase 3)**
   - **Mitigation:** Auto-rebuild indexes on startup if stale
   - **Testing:** Modify entity without updating index, verify rebuild

3. **Attachment Deduplication Bugs (Phase 3)**
   - **Mitigation:** Reference counting with rebuild mechanism
   - **Testing:** Delete attachments in various orders, verify no orphans

### Low Risk

1. **Backup Rotation Too Aggressive (Phase 1)**
   - **Mitigation:** Configurable retention (default 10)
   - **Testing:** Verify old backups deleted correctly

2. **Compression Too Slow (Phase 3)**
   - **Mitigation:** Async compression, feature flag to disable
   - **Testing:** Benchmark compression time per entity

---

## Success Metrics

### Phase 1

- **Data Loss:** 0 incidents in testing
- **Backup Success Rate:** 100% (no silent failures)
- **Export Completeness:** All 8 collections included
- **Recovery Time:** < 30 seconds to restore from backup

### Phase 2

- **WAL Recovery:** 100% data recovery after crash
- **Transaction Conflicts:** 0 race conditions
- **Migration Success:** 100% data preserved
- **Checksum Detection:** 100% corrupted files caught

### Phase 3

- **Startup Time:** < 1 second with 10,000 sessions (10x improvement)
- **Query Speed:** < 50ms for complex queries (40x improvement)
- **Memory Usage:** < 100MB with 10,000 sessions (90% reduction)
- **Disk Usage:** 60% reduction with compression, 45% for attachments
- **Index Accuracy:** 100% query results match full scan

---

## Rollback Strategy

### Phase 1 Rollback

**If issues arise:**
1. Revert TauriFileSystemAdapter.ts (restore "continue anyway")
2. Restore SessionsContext.tsx skip logic
3. Remove automatic backup hooks from App.tsx
4. Use latest backup to restore data

**Estimated Rollback Time:** 1 hour

### Phase 2 Rollback

**If migration fails:**
1. Restore from pre-migration backup
2. Disable WAL recovery (comment out recoverFromWAL call)
3. Revert to monolithic collection files
4. Remove transaction code from enrichment service

**Estimated Rollback Time:** 2 hours

### Phase 3 Rollback

**If performance degrades:**
1. Disable indexing (load full data)
2. Disable lazy loading (load all at startup)
3. Disable compression (decompress all files)
4. Disable deduplication (restore full files)

**Estimated Rollback Time:** 3 hours

---

## Maintenance Plan

### After Phase 1

- **Daily:** Monitor backup creation logs
- **Weekly:** Verify backup rotation working
- **Monthly:** Test backup restore procedure

### After Phase 2

- **Daily:** Monitor WAL size and checkpoint frequency
- **Weekly:** Verify checksums across all collections
- **Monthly:** Test transaction rollback scenarios

### After Phase 3

- **Daily:** Monitor index freshness
- **Weekly:** Rebuild indexes to prevent drift
- **Monthly:** Benchmark performance to catch regressions

---

## Resources Required

### Development

- **Phase 1:** 1 developer, 6 weeks
- **Phase 2:** 1 developer, 4 weeks
- **Phase 3:** 1 developer, 5 weeks

**Total:** 1 developer, 15 weeks (3.75 months)

### Testing

- **QA Engineer:** Part-time, 3 weeks total (across all phases)
- **User Testing:** 5-10 beta users per phase

### Infrastructure

- **Test Devices:** macOS 12.3+ (2-3 machines)
- **Storage:** 50GB for test data

---

## Conclusion

This comprehensive 3-phase upgrade transforms Taskerino's storage from a fragile single-file system to an enterprise-grade data layer with:

- **Zero data loss** (mandatory backups, WAL, transactions)
- **10x startup speed** (lazy loading, indexing)
- **40x query speed** (optimized query engine)
- **90% memory reduction** (lazy loading)
- **50% disk reduction** (compression, deduplication)

The phased approach ensures:
- **Incremental value** (Phase 1 fixes critical issues immediately)
- **Low risk** (rollback mechanisms at each phase)
- **Measurable progress** (checkpoints and metrics)

**Total Timeline:** 11-15 weeks

**Next Steps:**
1. Review and approve plan
2. Allocate resources (developer, QA)
3. Begin Phase 1 implementation
4. Set up monitoring and metrics
5. Schedule checkpoint reviews

---

**Document Version:** 1.0
**Last Updated:** 2025-10-23
**Author:** Claude (Taskerino AI Assistant)
**Status:** Ready for Implementation
