# Storage Full Handling - Integration Guide

**For**: Developers integrating Fix #4C into the storage layer
**Created**: 2025-10-27
**Status**: Ready for integration

---

## Quick Start

### 1. Import the Service

```typescript
import { checkDiskSpace, checkDiskSpaceForData, estimateDataSize } from '@/services/diskSpaceService';
import { StorageFullError } from '@/types/storage';
```

### 2. Before Any Storage Write

```typescript
async function saveSession(session: Session): Promise<void> {
  // Check disk space before write
  await checkDiskSpaceForData(session);

  // Proceed with save (will not fail silently)
  await storage.save('session', session);
}
```

### 3. Handle Errors

```typescript
try {
  await saveSession(session);
} catch (error) {
  if (error instanceof StorageFullError) {
    toast.error(error.message, {
      duration: 10000,
      action: {
        label: 'Free Space',
        onClick: () => invoke('open_storage_location'),
      },
    });
  } else {
    throw error;
  }
}
```

---

## Integration Points

### Priority 1: TauriFileSystemAdapter

**File**: `src/services/storage/TauriFileSystemAdapter.ts`

**Lines to Modify**: ~100-150 (save method)

```typescript
import { checkDiskSpaceForData } from '../diskSpaceService';

export class TauriFileSystemAdapter implements StorageAdapter {
  // ... existing code ...

  async save<T>(key: string, value: T): Promise<void> {
    // ✅ ADD: Check disk space before write
    await checkDiskSpaceForData(value);

    // Existing code (unchanged)
    const filePath = this.getFilePath(key);
    const json = JSON.stringify(value);
    await writeTextFile(filePath, json, { baseDir: BaseDirectory.AppData });
  }

  // In transaction commit
  private async commit(): Promise<void> {
    // ✅ ADD: Estimate total transaction size
    const totalSize = this.operations.reduce((sum, op) => {
      return sum + (op.value ? estimateDataSize(op.value) : 0);
    }, 0);

    // ✅ ADD: Check space before committing
    await checkDiskSpace(totalSize);

    // Existing commit logic (unchanged)
    // ...
  }
}
```

**Testing**:
```bash
# 1. Run TypeScript type check
npm run type-check

# 2. Run storage tests
npm run test -- TauriFileSystemAdapter

# 3. Manual test with simulated full disk
# (Create large file to fill disk to <100 MB free)
```

---

### Priority 2: ChunkedSessionStorage

**File**: `src/services/storage/ChunkedSessionStorage.ts`

**Lines to Modify**: ~200-250 (chunk save methods)

```typescript
import { checkDiskSpaceForData } from './diskSpaceService';

export class ChunkedSessionStorage {
  // ... existing code ...

  async saveMetadata(sessionId: string, metadata: SessionMetadata): Promise<void> {
    // ✅ ADD: Check disk space before chunk write
    await checkDiskSpaceForData(metadata);

    // Existing code (unchanged)
    await this.caStorage.saveAttachment({
      id: `${sessionId}/metadata.json`,
      data: metadata,
      // ...
    });
  }

  async appendScreenshot(sessionId: string, screenshot: SessionScreenshot): Promise<void> {
    // ✅ ADD: Estimate screenshot size (typically 100-500 KB compressed)
    const estimatedSize = screenshot.base64?.length
      ? screenshot.base64.length * 0.75  // base64 overhead
      : 300 * 1024;  // 300 KB default estimate

    await checkDiskSpace(estimatedSize);

    // Existing code (unchanged)
    // ...
  }
}
```

**Testing**:
```typescript
// Unit test example
describe('ChunkedSessionStorage disk space handling', () => {
  it('should check disk space before saving metadata', async () => {
    const checkSpy = vi.spyOn(diskSpaceService, 'checkDiskSpaceForData');

    await storage.saveMetadata(sessionId, metadata);

    expect(checkSpy).toHaveBeenCalledWith(metadata);
  });

  it('should throw StorageFullError when disk is full', async () => {
    vi.spyOn(diskSpaceService, 'checkDiskSpace')
      .mockRejectedValue(new StorageFullError(50, 200, '/path'));

    await expect(
      storage.appendScreenshot(sessionId, screenshot)
    ).rejects.toThrow(StorageFullError);
  });
});
```

---

### Priority 3: WAV Audio Encoder (Rust)

**File**: `src-tauri/src/audio/sinks/wav_encoder.rs`

**Lines to Modify**: ~70-90 (constructor)

```rust
use crate::storage_utils::check_disk_space;

impl WavEncoderSink {
    pub fn new<P: AsRef<Path>>(path: P, format: AudioFormat) -> Result<Self, AudioError> {
        let path = path.as_ref().to_path_buf();

        // Existing path validation
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                return Err(AudioError::IoError(format!(
                    "Parent directory does not exist: {:?}",
                    parent
                )));
            }

            // ✅ ADD: Check disk space before creating WAV file
            // Estimate: 1 hour of 16kHz 16-bit audio = ~115 MB
            let estimated_size = match format.sample_rate {
                16000 => 120 * 1024 * 1024,  // 120 MB (1 hour at 16kHz)
                48000 => 350 * 1024 * 1024,  // 350 MB (1 hour at 48kHz)
                _ => 200 * 1024 * 1024,      // 200 MB (conservative default)
            };

            check_disk_space(parent, estimated_size)
                .map_err(|e| AudioError::IoError(format!("Insufficient disk space: {}", e)))?;
        }

        // Existing WavWriter creation (unchanged)
        let spec = WavSpec { /* ... */ };
        let writer = WavWriter::create(&path, spec)
            .map_err(|e| AudioError::IoError(format!("Failed to create WAV file: {}", e)))?;

        // ...
    }
}
```

**Testing**:
```bash
# Rust test
cargo test --lib wav_encoder

# Integration test with simulated full disk
cargo run --example audio_recording_test
```

---

## Error Handling Patterns

### Pattern 1: Silent Handling (Background Operations)

```typescript
// For non-critical background saves
async function autoSaveSession(session: Session): Promise<void> {
  try {
    await checkDiskSpaceForData(session);
    await storage.save('session', session);
  } catch (error) {
    if (error instanceof StorageFullError) {
      console.warn('Auto-save skipped: disk full');
      // Show non-intrusive notification
      showToast('warning', 'Low disk space. Save manually to ensure data is stored.');
    } else {
      throw error;  // Re-throw other errors
    }
  }
}
```

### Pattern 2: User Confirmation (Critical Operations)

```typescript
// For critical user-initiated saves
async function saveSessionWithConfirmation(session: Session): Promise<void> {
  try {
    await checkDiskSpaceForData(session);
    await storage.save('session', session);
    toast.success('Session saved successfully');
  } catch (error) {
    if (error instanceof StorageFullError) {
      // Show modal with options
      const action = await showModal({
        title: 'Disk Space Low',
        message: error.message,
        actions: [
          { label: 'Free Space', action: 'openStorage' },
          { label: 'Save Anyway', action: 'forceSave', danger: true },
          { label: 'Cancel', action: 'cancel' },
        ],
      });

      if (action === 'openStorage') {
        await invoke('open_storage_location');
      } else if (action === 'forceSave') {
        // Skip disk check and attempt save anyway (risky)
        await storage.save('session', session);
      }
    } else {
      throw error;
    }
  }
}
```

### Pattern 3: Batch Operations

```typescript
// For multiple writes in sequence
async function saveBatchSessions(sessions: Session[]): Promise<void> {
  // Calculate total size ONCE before starting
  const totalSize = sessions.reduce((sum, session) => {
    return sum + estimateDataSize(session);
  }, 0);

  // Check space for entire batch
  await checkDiskSpace(totalSize);

  // Proceed with all saves (space is guaranteed)
  for (const session of sessions) {
    await storage.save(`session-${session.id}`, session);
  }
}
```

---

## UI Notifications

### Toast Notification (Recommended)

```typescript
import { toast } from 'sonner';  // or your toast library
import { invoke } from '@tauri-apps/api/core';

function handleStorageFullError(error: StorageFullError) {
  toast.error(error.message, {
    duration: 10000,  // 10 seconds (longer for critical errors)
    action: {
      label: 'Free Space',
      onClick: async () => {
        await invoke('open_storage_location');
      },
    },
  });
}
```

### Modal Dialog (Critical Operations)

```typescript
import { Modal } from '@/components/Modal';

function StorageFullModal({ error, onClose }: Props) {
  return (
    <Modal open onClose={onClose}>
      <Modal.Title>Disk Space Low</Modal.Title>
      <Modal.Content>
        <p>{error.message}</p>
        <p className="mt-4">
          Available: <strong>{error.availableMB} MB</strong><br />
          Required: <strong>{error.requiredMB} MB</strong>
        </p>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => invoke('open_storage_location')}>
          Open Storage Location
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </Modal.Actions>
    </Modal>
  );
}
```

---

## Testing Checklist

### Unit Tests

- [ ] `checkDiskSpace()` called before storage writes
- [ ] `estimateDataSize()` returns reasonable estimates
- [ ] `StorageFullError` thrown when disk full
- [ ] Error messages are user-friendly (no technical jargon)

### Integration Tests

- [ ] TauriFileSystemAdapter checks space before save
- [ ] ChunkedSessionStorage checks space before chunks
- [ ] WAV encoder checks space before file creation
- [ ] Transactions check total batch size before commit

### Manual Tests

1. **Normal Operation** (✅ Expected: Success)
   - Start with >1 GB free space
   - Save session, screenshot, audio
   - Verify no errors

2. **Low Space Warning** (⚠️ Expected: Warning)
   - Reduce free space to 200 MB
   - Attempt 150 MB write
   - Verify warning displayed but write succeeds

3. **Insufficient Space** (❌ Expected: Error)
   - Reduce free space to <100 MB
   - Attempt any write
   - Verify error message displayed
   - Verify data not corrupted (no partial writes)

4. **Free Space Action** (✅ Expected: Opens File Manager)
   - Trigger storage full error
   - Click "Free Space" button
   - Verify Finder/Explorer opens to app data directory

### Simulation

**Create large file to fill disk** (macOS):

```bash
# Check current free space
df -h /

# Calculate size needed (leave ~50 MB free)
# If you have 10 GB free, create 9.95 GB file
dd if=/dev/zero of=/tmp/fillfile bs=1m count=9950

# Test app with <100 MB free
# Verify error messages appear

# Clean up
rm /tmp/fillfile
```

---

## Performance Considerations

### Overhead

- **Disk space check**: <1ms per call (native syscall)
- **Size estimation**: ~0.1ms per object (JSON.stringify)
- **Total overhead**: <2ms per write operation

### Optimization Strategies

1. **Batch Checks**: Check once for multiple writes
2. **Cache Results**: Cache disk space for 5 seconds (optional)
3. **Lazy Checking**: Only check for writes >1 MB

**Example (with caching)**:

```typescript
class DiskSpaceCache {
  private lastCheck: number = 0;
  private lastAvailable: number = 0;
  private readonly TTL = 5000; // 5 seconds

  async getAvailableSpace(): Promise<number> {
    const now = Date.now();
    if (now - this.lastCheck < this.TTL) {
      return this.lastAvailable;
    }

    const info = await getDiskSpaceInfo();
    this.lastCheck = now;
    this.lastAvailable = info.available;
    return info.available;
  }
}
```

---

## Rollback Plan

If issues occur, disable disk space checks:

### 1. Comment Out Checks

```typescript
// In TauriFileSystemAdapter.ts
async save<T>(key: string, value: T): Promise<void> {
  // TEMPORARILY DISABLED: await checkDiskSpaceForData(value);

  const filePath = this.getFilePath(key);
  const json = JSON.stringify(value);
  await writeTextFile(filePath, json, { baseDir: BaseDirectory.AppData });
}
```

### 2. Feature Flag (Better Approach)

```typescript
// In config.ts
export const FEATURES = {
  DISK_SPACE_CHECKING: import.meta.env.VITE_DISK_SPACE_CHECKING !== 'false',
};

// In storage adapter
if (FEATURES.DISK_SPACE_CHECKING) {
  await checkDiskSpaceForData(value);
}
```

**Disable via environment variable**:

```bash
VITE_DISK_SPACE_CHECKING=false npm run dev
```

---

## FAQ

### Q: What happens if the disk space check itself fails?

**A**: The check will throw an error, which should be handled like any other storage error. The write will not proceed.

### Q: Can I skip the disk space check for small writes?

**A**: Yes, you can add a threshold:

```typescript
async function saveWithThreshold<T>(key: string, value: T): Promise<void> {
  const estimatedSize = estimateDataSize(value);

  // Only check for writes > 1 MB
  if (estimatedSize > 1024 * 1024) {
    await checkDiskSpace(estimatedSize);
  }

  await storage.save(key, value);
}
```

### Q: What if the user has exactly 100 MB free?

**A**: The check will fail. The 100 MB threshold is a safety buffer to ensure the OS has enough space to function.

### Q: Can I change the 100 MB threshold?

**A**: Yes, but it requires modifying `MIN_FREE_SPACE` in `storage_utils.rs` and recompiling. Not recommended.

### Q: What about browser mode (not Tauri)?

**A**: The disk space checks are Tauri-only. In browser mode, IndexedDB handles quota management automatically (via QuotaExceededError).

---

## Support

For issues or questions:

1. Check this guide first
2. Review completion report: `/docs/FIX_4C_STORAGE_FULL_HANDLING_COMPLETE.md`
3. Check Rust module docs: `src-tauri/src/storage_utils.rs`
4. Check TypeScript service docs: `src/services/diskSpaceService.ts`

---

**Last Updated**: 2025-10-27
**Status**: Ready for integration
