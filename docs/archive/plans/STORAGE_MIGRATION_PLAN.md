# Storage Migration Plan: localStorage → File System

## Problem Statement

**Current Issue**: localStorage has a 5-10MB limit, which is insufficient for long-term usage of Taskerino. With sessions, screenshots, notes, tasks, and conversation history, users will hit this limit within months.

**Goal**: Migrate to Tauri file system storage for unlimited, reliable data persistence.

---

## Proposed Architecture

### File System Structure
```
AppData/
├── taskerino/
│   ├── db/
│   │   ├── state.json              # Main app state (lightweight index)
│   │   ├── companies.json          # All companies
│   │   ├── contacts.json           # All contacts
│   │   ├── topics.json             # All topics
│   │   ├── notes.json              # All notes
│   │   ├── tasks.json              # All tasks
│   │   ├── sessions.json           # Session metadata (no screenshots)
│   │   ├── learnings.json          # Learning data
│   │   ├── settings.json           # User settings
│   │   └── ned-conversations.json  # Ned chat history
│   │
│   ├── attachments/                # Large binary data
│   │   ├── {id}.dat                # Screenshot base64 data
│   │   └── {id}.meta.json          # Screenshot metadata
│   │
│   └── backups/                    # Automatic backups
│       ├── {timestamp}-full.zip    # Daily full backups
│       └── latest.zip              # Latest backup
```

### Storage Strategy

#### 1. **Indexed File Storage** (Primary)
- Each entity type gets its own JSON file
- Fast read/write for specific entity types
- Efficient partial updates
- Easy to back up and version

#### 2. **localStorage** (Cache Only)
- Store only UI state and temporary data
- Recent items cache (last 50 notes, 50 tasks)
- Active session ID and basic preferences
- No critical data - can be cleared anytime

#### 3. **Attachments** (Separate Binary Storage)
- Already implemented for screenshots
- Keep separate from JSON data
- Compression applied before storage

---

## Migration Strategy

### Phase 1: Storage Service Layer (1-2 hours)
Create `src/services/fileStorage.ts`:
- Abstract storage interface
- Read/write operations for each entity type
- Automatic migration from localStorage
- Error handling and recovery

### Phase 2: Data Migration (30 mins)
- Detect existing localStorage data on first launch
- Automatically migrate to file system
- Keep localStorage backup until confirmed
- Clear localStorage after successful migration

### Phase 3: Update AppContext (1 hour)
- Replace localStorage save/load with file system calls
- Implement debounced saves (avoid writing on every change)
- Add in-memory cache for performance

### Phase 4: Backup System (1 hour)
- Daily automatic backups to `backups/` directory
- Keep last 7 days of backups
- Export/import functionality for user-initiated backups

---

## Technical Implementation

### StorageService Interface
```typescript
interface StorageService {
  // Core operations
  save<T>(collection: string, data: T): Promise<void>;
  load<T>(collection: string): Promise<T | null>;

  // Entity-specific operations
  saveCompanies(companies: Company[]): Promise<void>;
  loadCompanies(): Promise<Company[]>;
  saveNotes(notes: Note[]): Promise<void>;
  loadNotes(): Promise<Note[]>;
  // ... (one for each entity type)

  // Batch operations
  saveAll(state: AppState): Promise<void>;
  loadAll(): Promise<AppState>;

  // Migration
  migrateFromLocalStorage(): Promise<void>;

  // Backup
  createBackup(): Promise<string>;
  restoreBackup(path: string): Promise<void>;
}
```

### Performance Optimizations

1. **Debounced Saves**
   - Don't save immediately on every state change
   - Batch saves every 2-3 seconds
   - Ensure save on app close

2. **In-Memory Cache**
   - Keep full state in memory
   - Only write to disk periodically
   - Read from memory after initial load

3. **Partial Updates**
   - Only write changed collections
   - Track dirty flags for each entity type
   - Reduce unnecessary I/O

4. **Lazy Loading**
   - Load essential data first (settings, recent items)
   - Lazy load historical data on demand
   - Paginate large collections (e.g., old sessions)

---

## Potential Issues & Solutions

### Issue 1: File Corruption
**Risk**: JSON file corruption due to interrupted writes

**Solutions**:
- Write to temporary file first, then rename (atomic operation)
- Keep previous version as `.backup` file
- Validate JSON structure before considering save successful
- Implement automatic recovery from `.backup` file

### Issue 2: Concurrent Access
**Risk**: Multiple writes happening simultaneously

**Solutions**:
- Implement write queue
- Use file locking (via Tauri)
- Serialize all writes through single service

### Issue 3: Migration Failures
**Risk**: Data loss during localStorage → file system migration

**Solutions**:
- Keep localStorage data intact until migration confirmed
- Write migration status flag
- Allow manual rollback if issues occur
- Extensive testing with real-world data

### Issue 4: Performance on Large Datasets
**Risk**: Slow load times with 1000s of notes/tasks

**Solutions**:
- Implement pagination for UI
- Lazy load old sessions
- Use indexing for fast lookups
- Consider SQLite for very large datasets (future enhancement)

### Issue 5: Backup Size
**Risk**: Backups become very large with many screenshots

**Solutions**:
- Exclude attachments from automatic backups (they're already on disk)
- Compress backup archives
- Allow user to configure backup retention
- Provide "lightweight backup" option (JSON only, no attachments)

---

## Data Integrity Measures

1. **Checksums**
   - Calculate checksum for each file
   - Verify on load
   - Detect corruption early

2. **Validation**
   - JSON schema validation on load
   - Type checking with TypeScript
   - Reject invalid data

3. **Versioning**
   - Track schema version in each file
   - Implement migration paths for schema changes
   - Support multiple versions during transition

4. **Automatic Backups**
   - Daily backups before any writes
   - Keep 7 days of history
   - One-click restore from backup

---

## Timeline

| Phase | Task | Duration | Priority |
|-------|------|----------|----------|
| 1 | Create FileStorageService | 1-2 hours | Critical |
| 2 | Implement migration logic | 30 mins | Critical |
| 3 | Update AppContext to use file storage | 1 hour | Critical |
| 4 | Add debouncing and caching | 30 mins | High |
| 5 | Implement backup system | 1 hour | High |
| 6 | Testing and validation | 1 hour | Critical |
| 7 | Error recovery implementation | 30 mins | High |

**Total estimated time**: 5-6 hours

---

## Success Criteria

✅ App works with 10GB+ of data without slowdown
✅ Zero data loss during migration
✅ Automatic backups prevent data loss
✅ localStorage usage < 1MB (cache only)
✅ Fast app startup (< 2 seconds)
✅ Handles power loss/crashes gracefully

---

## Future Enhancements (Optional)

1. **SQLite Database**
   - For very large datasets (10,000+ notes)
   - Full-text search capabilities
   - Complex queries and relationships
   - Better performance for large-scale operations

2. **Cloud Sync** (Optional)
   - Keep file system as primary storage
   - Optional cloud backup to Supabase/Firebase
   - Multi-device sync
   - Conflict resolution

3. **Compression**
   - Compress older sessions and notes
   - Reduce disk usage for inactive data
   - Decompress on demand

4. **Encryption**
   - Optional encryption at rest
   - User-provided password
   - Secure sensitive data

---

## Recommendation

**Start with Phase 1-3 immediately** - these are critical for long-term viability. The file system storage will give you unlimited space and is the correct architectural choice for a desktop app.

**localStorage should only cache UI state** - think of it as temporary RAM, not persistent storage.

This approach:
- ✅ Solves the 10MB limit problem
- ✅ Provides unlimited storage
- ✅ Enables automatic backups
- ✅ Maintains fast performance
- ✅ Easy to migrate existing data
- ✅ Sets foundation for future features (cloud sync, SQLite)

Would you like me to start implementing this plan?
