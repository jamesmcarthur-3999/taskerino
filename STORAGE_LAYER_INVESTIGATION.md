# TASKERINO STORAGE LAYER INVESTIGATION REPORT

**Prepared:** November 1, 2025
**Thoroughness Level:** Very Thorough (Complete Analysis)
**Scope:** Storage implementation for relationships, tags, topics, companies, and contacts

---

## EXECUTIVE SUMMARY

The Taskerino storage layer uses a **dual-adapter pattern** with sophisticated collection-based persistence:

- **Persistence Mechanism:** File-based (Tauri desktop) + IndexedDB (web browser)
- **Relationships:** Stored **embedded within entities** (not separately), in a `relationships[]` array
- **Tags:** Stored as **string arrays** (`tags?: string[]`) directly on Task/Note entities
- **Topics/Companies/Contacts:** Stored as **separate collections** + linked via ID arrays

**KEY FINDING:** Relationships are **NOT** stored in a separate "relationships" collection. Instead, each entity (Note, Task, Session) carries its own relationships array.

---

## 1. STORAGE ADAPTERS (File-Based & IndexedDB)

### 1.1 Dual-Adapter Pattern (`src/services/storage/index.ts`)

**Location:** `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/index.ts`

**Detection Logic (Lines 27-48):**
```typescript
export function isTauriApp(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Primary: Check for Tauri global
  if ('__TAURI__' in window) return true;
  
  // Fallback: Check for Tauri internals (dev mode)
  if ('__TAURI_INTERNALS__' in window) return true;
  
  // Backup: Check user agent
  if (navigator.userAgent.includes('Tauri')) return true;
  
  return false;
}
```

**Adapter Selection (Lines 59-95):**
```typescript
export async function createStorageAdapter(): Promise<StorageAdapter> {
  const isTauri = isTauriApp();
  
  if (isTauri) {
    // Attempt TauriFileSystemAdapter (desktop)
    const tauriAdapter = new TauriFileSystemAdapter();
    if (await tauriAdapter.isAvailable()) {
      console.log('✅ Using Tauri file system storage (unlimited)');
      return tauriAdapter;
    }
  }
  
  // Fallback to IndexedDB (web)
  console.log('Using IndexedDB storage (100s of MB)');
  return new IndexedDBAdapter();
}
```

### 1.2 File System Storage (Tauri)

**Location:** `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/TauriFileSystemAdapter.ts`

**Key Data Structure (Lines 23-35):**
```typescript
interface WALEntry {
  id: string;              // Unique entry ID
  timestamp: number;       // Entry creation time
  operation: 'write' | 'delete' | 'transaction-start' | 'transaction-commit' | 'transaction-rollback';
  collection: string;      // Collection name
  data?: any;              // Data payload
  checksum?: string;       // SHA-256 for integrity verification
  transactionId?: string;  // Transaction grouping
}
```

**File Format (Lines 223-229):**
```typescript
const dataWithMeta = {
  version: 1,
  checksum: "...",           // SHA-256 hash
  timestamp: Date.now(),
  compressed: true/false,
  data: compressedData       // Gzip-compressed JSON or raw JSON
};
```

**Storage Location:** `BaseDirectory.AppData` (Tauri app data directory)

### 1.3 IndexedDB Storage (Web)

**Location:** `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/IndexedDBAdapter.ts`

**Database Structure (Lines 345-350):**
```typescript
export class IndexedDBAdapter extends StorageAdapter {
  private readonly DB_NAME = 'taskerino-db';
  private readonly DB_VERSION = 1;
  private readonly COLLECTIONS_STORE = 'collections';  // Main data store
  private readonly BACKUPS_STORE = 'backups';          // Backup storage
}
```

**Stored Object Schema (Lines 15-20):**
```typescript
interface StoredCollection {
  name: string;              // Collection name (e.g., "notes", "sessions")
  data: any;                 // Compressed or raw data
  timestamp: number;         // Persistence timestamp
  checksum?: string;         // Optional checksum
}
```

**Data Compression:**
- JSON compression: Gzip via `compressData()` function
- Fallback: Uncompressed JSON if compression fails
- **50-70% storage reduction** achieved through compression

---

## 2. ENTITY STORAGE: HOW NOTES, TASKS, SESSIONS ARE SAVED

### 2.1 Collection-Based Storage Model

Each entity type is stored in its own collection:

```
├── notes          → Note[]
├── tasks          → Task[]
├── sessions       → Session[]  (chunked: /sessions-chunked)
├── companies      → Company[]
├── contacts       → Contact[]
└── topics         → Topic[]
```

**Save Pattern (All Collections):**

1. **NotesContext** (`src/context/NotesContext.tsx`, Lines 129-144):
```typescript
// Save to storage on change (debounced 5 seconds)
useEffect(() => {
  saveTimeoutRef.current = setTimeout(async () => {
    const storage = await getStorage();
    await storage.save('notes', state.notes);  // Entire array
    console.log('Notes saved to storage');
  }, 5000);
}, [hasLoaded, state.notes]);
```

2. **TasksContext** (`src/context/TasksContext.tsx`, Lines 162-185):
```typescript
// Same debounced save pattern
await storage.save('tasks', state.tasks);
```

3. **EntitiesContext** (`src/context/EntitiesContext.tsx`, Lines 186-213):
```typescript
// Save companies, contacts, topics in parallel
await Promise.all([
  storage.save('companies', state.companies),
  storage.save('contacts', state.contacts),
  storage.save('topics', state.topics),
]);
```

### 2.2 Load Pattern

**NotesContext Load (Lines 102-119):**
```typescript
async function loadNotes() {
  const storage = await getStorage();
  const notes = await storage.load<Note[]>('notes');
  
  if (Array.isArray(notes)) {
    dispatch({ type: 'LOAD_NOTES', payload: notes });
  }
}
```

**EntitiesContext Load (Lines 158-184):**
```typescript
const [companies, contacts, topics] = await Promise.all([
  storage.load<Company[]>('companies'),
  storage.load<Contact[]>('contacts'),
  storage.load<Topic[]>('topics'),
]);
```

---

## 3. RELATIONSHIPS: EMBEDDED VS SEPARATE STORAGE

### 3.1 Relationship Storage Model

**CRITICAL FINDING:** Relationships are **NOT** stored in a separate collection!

Instead, each entity carries its own **`relationships[]` array**:

**RelationshipManager Index Building (Lines 180-211):**
```typescript
// Load relationships from each entity collection
async buildRelationshipIndex(): Promise<RelationshipIndex> {
  const allRelationships: Relationship[] = [];
  
  // Entity types that CAN have relationships
  const entityCollections = ['tasks', 'notes', 'sessions', 'topics', 'companies', 'contacts'];
  
  // Load relationships from EACH entity collection
  for (const collection of entityCollections) {
    const entities = await this.storage!.load<EntityWithRelationships[]>(collection);
    
    if (entities && Array.isArray(entities)) {
      entities.forEach(entity => {
        // Extract relationships from each entity
        if (entity.relationships && Array.isArray(entity.relationships)) {
          allRelationships.push(...entity.relationships);
        }
      });
    }
  }
  
  // Remove duplicates (bidirectional relationships stored on both entities)
  const uniqueRelationships = new Map<string, Relationship>();
  allRelationships.forEach(rel => {
    uniqueRelationships.set(rel.id, rel);
  });
  
  return new RelationshipIndex(Array.from(uniqueRelationships.values()));
}
```

**Data Structure (Lines 76-252 in types/relationships.ts):**
```typescript
export interface Relationship {
  id: string;                 // Unique relationship ID
  type: RelationshipType;     // e.g., 'task-note', 'note-topic'
  sourceType: EntityType;     // e.g., 'task'
  sourceId: string;           // e.g., 'task-123'
  targetType: EntityType;     // e.g., 'note'
  targetId: string;           // e.g., 'note-456'
  metadata: RelationshipMetadata;  // Source, confidence, reasoning, createdAt
  canonical: boolean;         // True for primary direction (bidirectional)
}

export interface RelationshipMetadata {
  source: 'ai' | 'manual' | 'migration' | 'system';
  confidence?: number;        // 0-1 for AI relationships
  reasoning?: string;         // Why AI created this
  createdAt: string;          // ISO 8601 timestamp
  createdBy?: string;         // User ID
  extra?: Record<string, unknown>;  // Custom metadata
}
```

### 3.2 Bidirectional Relationship Handling

**Example: Task ↔ Note Relationship**

When creating a task-note relationship:

1. **Canonical relationship** stored on Task:
```typescript
{
  id: 'rel-abc123',
  type: 'task-note',
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note',
  targetId: 'note-456',
  canonical: true,  // Primary direction
  metadata: { source: 'ai', confidence: 0.95 }
}
```

2. **Reverse relationship** stored on Note:
```typescript
{
  id: 'rel-def456',  // Different ID
  type: 'task-note',
  sourceType: 'note',
  sourceId: 'note-456',
  targetType: 'task',
  targetId: 'task-123',
  canonical: false,  // Non-canonical direction
  metadata: { source: 'ai', confidence: 0.95 }
}
```

**Both are saved to storage during commit:**

RelationshipManager.addRelationship (Lines 346-362):
```typescript
// Step 7: Add relationship to source entity
await this.addToEntity(txId, sourceType, sourceId, relationship);

// Step 8: If bidirectional, add reverse to target entity
if (config.bidirectional) {
  reverseRelationship = {
    ...relationship,
    id: nanoid(),
    sourceType: targetType,
    sourceId: targetId,
    targetType: sourceType,
    targetId: sourceId,
    canonical: false,
  };
  
  await this.addToEntity(txId, targetType, targetId, reverseRelationship);
}

// Step 9: Commit transaction (ACID)
await this.storage!.commitPhase24Transaction(txId);
```

### 3.3 Where Relationships Are Persisted

**Entity Persistence Flow:**

1. **In-Memory State:** Each Note/Task/Session entity has `relationships: Relationship[]`
2. **Context Save:** When Notes/TasksContext saves, the entire entity array is persisted:
```typescript
// NotesContext.tsx saves the entire notes array
await storage.save('notes', state.notes);
// state.notes = Note[] where each Note contains relationships: Relationship[]
```

3. **Storage Format:**
```json
{
  "version": 1,
  "checksum": "abc123...",
  "timestamp": 1730459000,
  "compressed": true,
  "data": "H4sIAAAA..."  // Gzipped JSON
}
```

4. **When Decompressed:**
```typescript
const notes: Note[] = [
  {
    id: "note-123",
    title: "...",
    content: "...",
    topicIds: ["topic-1"],      // Direct topic references
    companyIds: ["company-1"],  // Direct company references
    relationships: [
      {
        id: "rel-1",
        type: "note-topic",
        sourceType: "note",
        sourceId: "note-123",
        targetType: "topic",
        targetId: "topic-1",
        canonical: true,
        metadata: { source: "manual", createdAt: "2025-11-01T..." }
      },
      {
        id: "rel-2",
        type: "note-company",
        sourceType: "note",
        sourceId: "note-123",
        targetType: "company",
        targetId: "company-1",
        canonical: true,
        metadata: { source: "ai", confidence: 0.92, createdAt: "..." }
      }
    ]
  }
]
```

---

## 4. TAGS: ARRAY-BASED STORAGE

### 4.1 Tag Storage on Tasks

**Task Interface (src/types.ts):**
```typescript
export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  status: TaskStatus;
  tags?: string[];              // <-- TAGS HERE (array of strings)
  topicId?: string;             // @deprecated (use relationships)
  noteId?: string;              // @deprecated (use relationships)
  sourceSessionId?: string;     // @deprecated (use relationships)
  // ... other fields
}
```

**Saved to Storage:**
```typescript
await storage.save('tasks', state.tasks);
```

**Example Persisted Task:**
```json
{
  "id": "task-456",
  "title": "Fix login bug",
  "tags": [
    "backend",
    "security",
    "authentication"
  ],
  "relationships": [
    {
      "id": "rel-x",
      "type": "task-topic",
      "sourceId": "task-456",
      "targetId": "topic-1",
      "canonical": true,
      "metadata": { "source": "ai" }
    }
  ]
}
```

### 4.2 Tag Storage on Notes

**Note Interface (src/types.ts):**
```typescript
export interface Note {
  id: string;
  title: string;
  content: string;
  tags?: string[];              // <-- TAGS HERE
  topicIds?: string[];           // <-- TOPIC IDs (legacy)
  companyIds?: string[];         // <-- COMPANY IDs (legacy)
  contactIds?: string[];         // <-- CONTACT IDs (legacy)
  relationships?: Relationship[]; // <-- UNIFIED RELATIONSHIPS
  // ... other fields
}
```

**Tag vs Relationship Distinction:**

| Feature | Tags | Relationships |
|---------|------|---------------|
| Storage | `tags: string[]` | `relationships: Relationship[]` |
| Purpose | General categorization | Semantic links to entities |
| Example | `["urgent", "api"]` | `{ type: 'note-topic', targetId: 'topic-1' }` |
| Persistence | Direct array | Array with metadata |
| Relationship | None (flat tags) | Bidirectional with config |

---

## 5. TOPICS, COMPANIES, CONTACTS: SEPARATE COLLECTIONS

### 5.1 Topic Storage

**Interface (src/types.ts):**
```typescript
export interface Topic {
  id: string;
  name: string;
  description?: string;
  noteCount: number;
  createdAt: string;
  lastUpdated: string;
  relationships?: Relationship[];  // Topics can also have relationships
}
```

**Storage (EntitiesContext Lines 162-166):**
```typescript
const topics = await storage.load<Topic[]>('topics');
```

**Save (EntitiesContext Lines 200):**
```typescript
await storage.save('topics', state.topics);
```

**When Note Links to Topic:**

1. **Legacy (deprecated):** `note.topicIds = ["topic-1"]`
2. **New (Phase 2.0):** `note.relationships = [{ type: 'note-topic', targetId: 'topic-1' }]`

### 5.2 Company Storage

**Interface (src/types.ts):**
```typescript
export interface Company {
  id: string;
  name: string;
  noteCount: number;
  createdAt: string;
  lastUpdated: string;
  profile?: Record<string, any>;
  relationships?: Relationship[];
}
```

**Storage Pattern:** Same as topics
```typescript
await storage.save('companies', state.companies);
```

**Cross-Linking Example:**

When a Note links to a Company:

1. **On Note:**
```typescript
{
  id: "note-123",
  companyIds: ["company-1"],  // Legacy array
  relationships: [
    {
      type: "note-company",
      targetId: "company-1",
      canonical: true
    }
  ]
}
```

2. **On Company:** Company does NOT store note references
```typescript
{
  id: "company-1",
  name: "Acme Corp",
  noteCount: 5,  // Counter updated when notes added/removed
  relationships: [
    {
      type: "note-company",
      sourceId: "note-123",  // REVERSE direction
      canonical: false
    }
  ]
}
```

### 5.3 Contact Storage

**Interface (src/types.ts):**
```typescript
export interface Contact {
  id: string;
  name: string;
  noteCount: number;
  createdAt: string;
  lastUpdated: string;
  profile?: Record<string, any>;
  relationships?: Relationship[];
}
```

**Storage:** Identical to Companies/Topics

---

## 6. TRANSACTION SUPPORT: ACID GUARANTEES

### 6.1 Tauri File System Transactions

**Location:** `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/TauriFileSystemAdapter.ts` (Lines 97-335)

**Transaction Pattern:**
1. Begin transaction
2. Write to temporary directory
3. Capture previous values for rollback
4. Atomic move to final location
5. On error: restore from backup

**Code Example (Lines 139-176):**
```typescript
async commit(): Promise<void> {
  // Step 0: Check disk space BEFORE starting
  try {
    const totalSize = this.operations.reduce((sum, op) => {
      if (op.type === 'save' && op.value) {
        return sum + estimateDataSize(op.value);
      }
      return sum;
    }, 0);
    
    await checkDiskSpaceForData({ size: totalSize });
  } catch (error) {
    if (error instanceof StorageFullError) {
      toast.error('Storage Full - Transaction Failed');
    }
    throw error;
  }
  
  // Step 1: Capture previous values for rollback
  await this.capturePreviousValues();
  
  // Step 2: Write all changes to temp directory first
  const tempDir = `${this.basePath}/tx-temp-${Date.now()}`;
  // ... write to temp ...
  
  // Step 3: Move to final locations atomically
  // ... move from temp to final ...
}
```

### 6.2 IndexedDB Transactions

**Location:** `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/IndexedDBAdapter.ts` (Lines 88-343)

**Native IDBTransaction Usage (Lines 206-240):**
```typescript
async commit(): Promise<void> {
  // Use native IndexedDB transaction for atomicity
  const tx = this.db.transaction([this.COLLECTIONS_STORE], 'readwrite');
  const store = tx.objectStore(this.COLLECTIONS_STORE);
  
  // Queue all operations
  for (const op of preparedOps) {
    if (op.type === 'save' && op.record) {
      store.put(op.record);
    } else if (op.type === 'delete') {
      store.delete(op.key);
    }
  }
  
  // Wait for transaction to complete
  tx.oncomplete = () => {
    console.log(`✓ Transaction committed: ${this.operations.length} operations`);
    resolve();
  };
  
  tx.onerror = () => {
    console.error('Transaction failed');
    reject(new Error(`Transaction failed: ${tx.error}`));
  };
}
```

---

## 7. MIGRATION SCRIPTS: DATA TRANSFORMATION

### 7.1 localStorage to New Storage

**Location:** `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/migration.ts` (Lines 48-150)

**Collections Migrated:**
```typescript
console.log('📊 Found data to migrate:', {
  companies: oldState.companies?.length || 0,
  contacts: oldState.contacts?.length || 0,
  topics: oldState.topics?.length || 0,
  notes: oldState.notes?.length || 0,
  tasks: oldState.tasks?.length || 0,
  sessions: oldState.sessions?.length || 0
});

// Each collection saved individually
await storage.save('companies', oldState.companies);
await storage.save('contacts', oldState.contacts);
await storage.save('topics', oldState.topics);
await storage.save('notes', oldState.notes);
await storage.save('tasks', oldState.tasks);
await storage.save('sessions', oldState.sessions);
```

### 7.2 Relationship Migrations

**Migration Scripts Available:**
- `/Users/jamesmcarthur/Documents/taskerino/scripts/migrate-relationships.ts`
- `/Users/jamesmcarthur/Documents/taskerino/scripts/migrate-companies-contacts.ts`
- `/Users/jamesmcarthur/Documents/taskerino/scripts/migrate-audio-schema.ts`

**Note:** These are not built-in migrations but provided as utilities for developers.

---

## 8. IDENTIFIED GAPS & PERSISTENCE ISSUES

### 8.1 Gap: Relationships Collection

**Issue:** There is NO dedicated 'relationships' collection in storage!

**Problem:**
- Relationships are embedded in entities
- On startup, RelationshipManager rebuilds index by scanning all entities
- This is O(n) operation (scans notes, tasks, sessions, topics, companies, contacts)

**Current Implementation (RelationshipManager.init()):**
```typescript
async init(): Promise<void> {
  this.storage = await getStorage();
  this.index = await this.buildRelationshipIndex();  // <-- Rebuilds from entities
}
```

**Better Approach (Not Implemented):**
Could maintain a separate 'relationships' collection for O(1) lookups.

### 8.2 Gap: Relationship Persistence in RelationshipContext

**Location:** `/Users/jamesmcarthur/Documents/taskerino/src/context/RelationshipContext.tsx` (Lines 40-250)

**Issue:** RelationshipContext provides UI for relationships but doesn't directly save them!

**How It Works:**
1. RelationshipContext calls `relationshipManager.addRelationship()`
2. relationshipManager calls `addToEntity()` which modifies the entity in storage
3. The entity (note/task) is saved by NotesContext/TasksContext

**Code Flow:**
```typescript
// RelationshipContext line 228
const relationship = await relationshipManager.addRelationship(params);

// RelationshipManager line 347
await this.addToEntity(txId, sourceType, sourceId, relationship);
// This updates the entity's relationships array

// Then taskContext or noteContext saves:
await storage.save('tasks', state.tasks);  // Entity now has new relationship
```

**Implication:** If taskContext/noteContext fails to save, relationship is lost!

### 8.3 Gap: No Explicit Relationship Save

**Problem:** There's no explicit `save('relationships', ...)` call anywhere!

**Verification:**
```bash
grep -r "save\('relationships'" src/ || echo "NOT FOUND"
```

Relationships are saved **implicitly** as part of entity persistence.

### 8.4 Gap: No Update Notification Between Contexts

**Issue:** When RelationshipManager adds a relationship to an entity:
1. It updates storage directly
2. But the context (NotesContext/TasksContext) doesn't know about it
3. Next context save might not include this relationship if entity wasn't modified

**Better Pattern:**
Should dispatch to NotesContext/TasksContext after relationship added.

---

## 9. ACTUAL DATA STRUCTURES BEING PERSISTED

### 9.1 Note Example (What Gets Saved)

```json
{
  "id": "note-abc123",
  "title": "Authentication improvements",
  "content": "Need to implement OAuth2 for login",
  "tags": ["security", "authentication", "api"],
  "topicIds": ["topic-security"],
  "companyIds": ["company-acme"],
  "contactIds": ["contact-john"],
  "relationships": [
    {
      "id": "rel-1",
      "type": "note-topic",
      "sourceType": "note",
      "sourceId": "note-abc123",
      "targetType": "topic",
      "targetId": "topic-security",
      "metadata": {
        "source": "ai",
        "confidence": 0.92,
        "reasoning": "Note discusses security topic",
        "createdAt": "2025-11-01T10:30:00Z"
      },
      "canonical": true
    },
    {
      "id": "rel-2",
      "type": "note-company",
      "sourceType": "note",
      "sourceId": "note-abc123",
      "targetType": "company",
      "targetId": "company-acme",
      "metadata": {
        "source": "manual",
        "createdAt": "2025-11-01T10:35:00Z",
        "createdBy": "user-1"
      },
      "canonical": true
    }
  ],
  "createdAt": "2025-11-01T10:00:00Z",
  "timestamp": 1730459400000
}
```

### 9.2 Task Example

```json
{
  "id": "task-def456",
  "title": "Implement OAuth2",
  "description": "Add OAuth2 to login system",
  "priority": "high",
  "status": "in-progress",
  "tags": ["backend", "security"],
  "topicId": "topic-security",
  "relationships": [
    {
      "id": "rel-3",
      "type": "task-note",
      "sourceType": "task",
      "sourceId": "task-def456",
      "targetType": "note",
      "targetId": "note-abc123",
      "metadata": {
        "source": "ai",
        "confidence": 0.88,
        "reasoning": "Task extracted from note content",
        "createdAt": "2025-11-01T10:30:00Z"
      },
      "canonical": true
    },
    {
      "id": "rel-4",
      "type": "task-topic",
      "sourceType": "task",
      "sourceId": "task-def456",
      "targetType": "topic",
      "targetId": "topic-security",
      "metadata": {
        "source": "manual",
        "createdAt": "2025-11-01T10:32:00Z"
      },
      "canonical": true
    }
  ],
  "createdAt": "2025-11-01T10:30:00Z",
  "completedAt": null
}
```

### 9.3 Topic Example

```json
{
  "id": "topic-security",
  "name": "Security",
  "noteCount": 5,
  "relationships": [
    {
      "id": "rel-1-inverse",
      "type": "note-topic",
      "sourceType": "topic",
      "sourceId": "topic-security",
      "targetType": "note",
      "targetId": "note-abc123",
      "metadata": {
        "source": "ai",
        "confidence": 0.92,
        "createdAt": "2025-11-01T10:30:00Z"
      },
      "canonical": false
    }
  ],
  "createdAt": "2025-11-01T09:00:00Z",
  "lastUpdated": "2025-11-01T10:35:00Z"
}
```

### 9.4 Company Example

```json
{
  "id": "company-acme",
  "name": "Acme Corporation",
  "noteCount": 3,
  "profile": {
    "industry": "Technology",
    "website": "https://acme.com"
  },
  "relationships": [
    {
      "id": "rel-2-inverse",
      "type": "note-company",
      "sourceType": "company",
      "sourceId": "company-acme",
      "targetType": "note",
      "targetId": "note-abc123",
      "metadata": {
        "source": "manual",
        "createdAt": "2025-11-01T10:35:00Z",
        "createdBy": "user-1"
      },
      "canonical": false
    }
  ],
  "createdAt": "2025-11-01T08:00:00Z",
  "lastUpdated": "2025-11-01T10:35:00Z"
}
```

---

## 10. COMPLETE STORAGE COLLECTIONS LIST

```typescript
// Collections actually stored:
const STORAGE_COLLECTIONS = {
  'notes': Note[],
  'tasks': Task[],
  'sessions': Session[],  // or /sessions-chunked for Phase 4
  'companies': Company[],
  'contacts': Contact[],
  'topics': Topic[],
  
  // Internal metadata:
  'migration-status': MigrationStatus,
  'settings': Settings,
  'active-session-id': string,
  
  // Indexes (Phase 4):
  '__index__sessions__fulltext': FullTextIndex,
  '__index__notes__date': DateIndex,
  // ... etc
};
```

---

## 11. SUMMARY TABLE: WHAT GETS SAVED AND WHERE

| Entity Type | Collection | Relationships Stored | Tags | References |
|-------------|-----------|-------------------|----|-----------|
| **Note** | `notes` | `relationships[]` on Note | `tags[]` on Note | `topicIds[]`, `companyIds[]`, `contactIds[]` |
| **Task** | `tasks` | `relationships[]` on Task | `tags[]` on Task | `topicId?`, implicit via relationships |
| **Session** | `sessions` | `relationships[]` on Session | None | `extractedTaskIds[]`, `extractedNoteIds[]` |
| **Topic** | `topics` | `relationships[]` on Topic | None | `noteCount` counter |
| **Company** | `companies` | `relationships[]` on Company | None | `noteCount` counter |
| **Contact** | `contacts` | `relationships[]` on Contact | None | `noteCount` counter |

---

## 12. KEY FILES & LINE NUMBERS

| Aspect | File | Lines |
|--------|------|-------|
| **Storage Adapter Selection** | `src/services/storage/index.ts` | 27-95 |
| **Tauri Storage Transactions** | `src/services/storage/TauriFileSystemAdapter.ts` | 97-335 |
| **IndexedDB Storage** | `src/services/storage/IndexedDBAdapter.ts` | 345-1300 |
| **Relationship Type Definitions** | `src/types/relationships.ts` | 1-648 |
| **Relationship Manager** | `src/services/relationshipManager.ts` | 1-600+ |
| **Relationship Context** | `src/context/RelationshipContext.tsx` | 1-400+ |
| **Notes Context (Save Pattern)** | `src/context/NotesContext.tsx` | 84-213 |
| **Tasks Context (Save Pattern)** | `src/context/TasksContext.tsx` | 128-185 |
| **Entities Context (Save Pattern)** | `src/context/EntitiesContext.tsx` | 152-213 |
| **Migration from localStorage** | `src/services/storage/migration.ts` | 48-150 |

---

## CONCLUSIONS

1. **Persistence Mechanism:** File-based (Tauri) + IndexedDB (web), with automatic compression

2. **Relationships:** Embedded in entities as `relationships[]` array, NOT separate collection

3. **Tags:** Simple string arrays (`tags: string[]`) on Task/Note entities

4. **Topics/Companies/Contacts:** Separate collections, linked via ID references AND relationships

5. **Transaction Support:** Full ACID guarantees via Tauri transactions and native IDBTransaction

6. **Gap:** No dedicated 'relationships' collection - relationships scatter across all entities

7. **Concern:** Relationship changes may not persist if entity context doesn't save

8. **Data Format:** Gzip-compressed JSON with checksums and metadata

