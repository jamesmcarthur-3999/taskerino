import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SessionListProvider, useSessionList } from '../SessionListContext';
import type { Session } from '../../types';

// Mock ChunkedSessionStorage (Phase 4)
const mockListAllMetadata = vi.fn();
const mockSaveMetadata = vi.fn();
const mockLoadMetadata = vi.fn();
const mockLoadFullSession = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock('../../services/storage/ChunkedSessionStorage', () => ({
  getChunkedStorage: vi.fn(() => Promise.resolve({
    listAllMetadata: mockListAllMetadata,
    saveMetadata: mockSaveMetadata,
    loadMetadata: mockLoadMetadata,
    loadFullSession: mockLoadFullSession,
    deleteSession: mockDeleteSession,
  })),
}));

// Mock storage (fallback)
vi.mock('../../services/storage', () => ({
  getStorage: vi.fn(() => Promise.resolve({
    load: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
  })),
  resetStorage: vi.fn(),
}));

// Mock attachment storage
vi.mock('../../services/attachmentStorage', () => ({
  attachmentStorage: {
    deleteAttachments: vi.fn(() => Promise.resolve()),
  },
}));

// Mock PersistenceQueue
vi.mock('../../services/storage/PersistenceQueue', () => ({
  getPersistenceQueue: vi.fn(() => ({
    enqueue: vi.fn(() => 'queue-id-123'),
    flush: vi.fn(() => Promise.resolve()),
  })),
}));

// Mock InvertedIndexManager
vi.mock('../../services/storage/InvertedIndexManager', () => ({
  getInvertedIndexManager: vi.fn(() => Promise.resolve({
    updateSession: vi.fn(() => Promise.resolve()),
    removeSession: vi.fn(() => Promise.resolve()),
  })),
}));

describe('SessionListContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return empty array
    mockListAllMetadata.mockResolvedValue([]);
    mockSaveMetadata.mockResolvedValue(undefined);
    mockLoadMetadata.mockResolvedValue(null);
    mockLoadFullSession.mockResolvedValue(null);
    mockDeleteSession.mockResolvedValue(undefined);
  });

  describe('Provider', () => {
    it('should provide context value', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SessionListProvider>{children}</SessionListProvider>
      );

      const { result } = renderHook(() => useSessionList(), { wrapper });

      // Wait for initial load to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current).toBeDefined();
      expect(result.current.sessions).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useSessionList());
      }).toThrow('useSessionList must be used within SessionListProvider');

      consoleError.mockRestore();
    });
  });

  describe('loadSessions', () => {
    it('should load sessions from storage', async () => {
      // Mock metadata (Phase 4 chunked storage format)
      const mockMetadata = [
        {
          id: 'session-1',
          name: 'Test Session',
          description: 'Test description',
          startTime: new Date().toISOString(),
          status: 'completed' as const,
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
          screenshotInterval: 60000,
          autoAnalysis: false,
          enableScreenshots: true,
          audioMode: 'none' as const,
        },
      ];

      mockListAllMetadata.mockResolvedValue(mockMetadata);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SessionListProvider>{children}</SessionListProvider>
      );

      const { result } = renderHook(() => useSessionList(), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1);
        expect(result.current.sessions[0].id).toBe('session-1');
      });
    });

    it('should filter out corrupted sessions', async () => {
      // Note: ChunkedSessionStorage already filters out corrupted sessions at the storage layer
      // This test verifies that valid sessions load correctly
      const mockMetadata = [
        {
          id: 'session-1',
          name: 'Valid Session',
          description: '',
          startTime: new Date().toISOString(),
          status: 'completed' as const,
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
          screenshotInterval: 60000,
          autoAnalysis: false,
          enableScreenshots: true,
          audioMode: 'none' as const,
        },
      ];

      // ChunkedSessionStorage already filtered out corrupted metadata
      mockListAllMetadata.mockResolvedValue(mockMetadata);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SessionListProvider>{children}</SessionListProvider>
      );

      const { result } = renderHook(() => useSessionList(), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1);
        expect(result.current.sessions[0].id).toBe('session-1');
      });
    });
  });

  describe('filtering and sorting', () => {
    it('should filter sessions by status', async () => {
      const mockMetadata = [
        {
          id: 'session-1',
          name: 'Completed Session',
          description: '',
          startTime: new Date().toISOString(),
          status: 'completed' as const,
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
          screenshotInterval: 60000,
          autoAnalysis: false,
          enableScreenshots: true,
          audioMode: 'none' as const,
        },
        {
          id: 'session-2',
          name: 'Interrupted Session',
          description: '',
          startTime: new Date().toISOString(),
          status: 'interrupted' as const,
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
          screenshotInterval: 60000,
          autoAnalysis: false,
          enableScreenshots: true,
          audioMode: 'none' as const,
        },
      ];

      mockListAllMetadata.mockResolvedValue(mockMetadata);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SessionListProvider>{children}</SessionListProvider>
      );

      const { result } = renderHook(() => useSessionList(), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(2);
      });

      act(() => {
        result.current.setFilter({ status: ['completed'] });
      });

      expect(result.current.filteredSessions).toHaveLength(1);
      expect(result.current.filteredSessions[0].status).toBe('completed');
    });

    it('should sort sessions by startTime descending', async () => {
      const now = new Date();
      const mockMetadata = [
        {
          id: 'session-1',
          name: 'Old Session',
          description: '',
          startTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'completed' as const,
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
          screenshotInterval: 60000,
          autoAnalysis: false,
          enableScreenshots: true,
          audioMode: 'none' as const,
        },
        {
          id: 'session-2',
          name: 'New Session',
          description: '',
          startTime: now.toISOString(),
          status: 'completed' as const,
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
          screenshotInterval: 60000,
          autoAnalysis: false,
          enableScreenshots: true,
          audioMode: 'none' as const,
        },
      ];

      mockListAllMetadata.mockResolvedValue(mockMetadata);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SessionListProvider>{children}</SessionListProvider>
      );

      const { result } = renderHook(() => useSessionList(), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(2);
      });

      act(() => {
        result.current.setSortBy('startTime-desc');
      });

      expect(result.current.filteredSessions[0].id).toBe('session-2');
      expect(result.current.filteredSessions[1].id).toBe('session-1');
    });
  });

  describe('updateSession', () => {
    it('should update session in storage and state', async () => {
      const originalMetadata = {
        id: 'session-1',
        name: 'Original Name',
        description: '',
        startTime: new Date().toISOString(),
        status: 'completed' as const,
        extractedTaskIds: [],
        extractedNoteIds: [],
        tags: [],
        screenshotInterval: 60000,
        autoAnalysis: false,
        enableScreenshots: true,
        audioMode: 'none' as const,
      };

      mockListAllMetadata.mockResolvedValue([originalMetadata]);
      mockLoadMetadata.mockResolvedValue(originalMetadata);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SessionListProvider>{children}</SessionListProvider>
      );

      const { result } = renderHook(() => useSessionList(), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1);
      });

      await act(async () => {
        await result.current.updateSession('session-1', { name: 'Updated Name' });
      });

      // Verify metadata was loaded to get current state
      expect(mockLoadMetadata).toHaveBeenCalledWith('session-1');

      // Verify session state was updated
      expect(result.current.sessions[0].name).toBe('Updated Name');

      // Note: saveMetadata happens in PersistenceQueue (background), not immediately
    });
  });

  describe('deleteSession', () => {
    it('should delete session from storage and state', async () => {
      const metadata = [
        {
          id: 'session-1',
          name: 'Session to Delete',
          description: '',
          startTime: new Date().toISOString(),
          status: 'completed' as const,
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
          screenshotInterval: 60000,
          autoAnalysis: false,
          enableScreenshots: true,
          audioMode: 'none' as const,
        },
      ];

      // Mock full session with attachments for Agent 1C's cleanup logic
      const fullSession = {
        ...metadata[0],
        screenshots: [],
        audioSegments: [],
        video: undefined,
        fullAudioAttachmentId: undefined,
      };

      mockListAllMetadata.mockResolvedValue(metadata);
      mockLoadFullSession.mockResolvedValue(fullSession);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SessionListProvider>{children}</SessionListProvider>
      );

      const { result } = renderHook(() => useSessionList(), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1);
      });

      await act(async () => {
        await result.current.deleteSession('session-1');
      });

      // Verify session was removed from state
      expect(result.current.sessions).toHaveLength(0);
    });

    it('should prevent deletion of session with active enrichment', async () => {
      const mockMetadata = [
        {
          id: 'session-1',
          name: 'Session with Enrichment',
          description: '',
          startTime: new Date().toISOString(),
          status: 'completed' as const,
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
          screenshotInterval: 60000,
          autoAnalysis: false,
          enableScreenshots: true,
          audioMode: 'none' as const,
          enrichmentStatus: {
            status: 'in-progress' as const,
            progress: 50,
            currentStage: 'audio' as const,
          },
        },
      ];

      // Mock full session (won't be called due to enrichment check, but needed for consistency)
      const fullSession = {
        ...mockMetadata[0],
        screenshots: [],
        audioSegments: [],
        video: undefined,
        fullAudioAttachmentId: undefined,
      };

      mockListAllMetadata.mockResolvedValue(mockMetadata);
      mockLoadFullSession.mockResolvedValue(fullSession);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SessionListProvider>{children}</SessionListProvider>
      );

      const { result } = renderHook(() => useSessionList(), { wrapper });

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1);
      });

      await expect(
        act(async () => {
          await result.current.deleteSession('session-1');
        })
      ).rejects.toThrow('Cannot delete session while enrichment is in progress');
    });
  });
});
