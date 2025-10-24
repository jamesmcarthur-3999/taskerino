import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { SessionListProvider, useSessionList } from '../SessionListContext';
import type { Session } from '../../types';

// Mock storage
vi.mock('../../services/storage', () => ({
  getStorage: vi.fn(() => Promise.resolve({
    load: vi.fn(() => Promise.resolve([])),
    save: vi.fn(() => Promise.resolve()),
  })),
}));

// Mock attachment storage
vi.mock('../../services/attachmentStorage', () => ({
  attachmentStorage: {
    deleteAttachments: vi.fn(() => Promise.resolve()),
  },
}));

describe('SessionListContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider', () => {
    it('should provide context value', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SessionListProvider>{children}</SessionListProvider>
      );

      const { result } = renderHook(() => useSessionList(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.sessions).toEqual([]);
      expect(result.current.loading).toBe(false);
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
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          name: 'Test Session',
          description: 'Test description',
          startTime: new Date().toISOString(),
          status: 'completed',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
        },
      ];

      const { getStorage } = await import('../../services/storage');
      vi.mocked(getStorage).mockResolvedValue({
        load: vi.fn(() => Promise.resolve(mockSessions)),
        save: vi.fn(() => Promise.resolve()),
      } as any);

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
      const mockSessions = [
        {
          id: 'session-1',
          name: 'Valid Session',
          description: '',
          startTime: new Date().toISOString(),
          status: 'completed',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
        },
        {
          id: null,  // Corrupted - no ID
          name: 'Invalid Session',
          startTime: new Date().toISOString(),
        },
        {
          id: 'session-3',
          name: '',  // Corrupted - no name
          startTime: new Date().toISOString(),
        },
      ];

      const { getStorage } = await import('../../services/storage');
      vi.mocked(getStorage).mockResolvedValue({
        load: vi.fn(() => Promise.resolve(mockSessions)),
        save: vi.fn(() => Promise.resolve()),
      } as any);

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
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          name: 'Completed Session',
          description: '',
          startTime: new Date().toISOString(),
          status: 'completed',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
        },
        {
          id: 'session-2',
          name: 'Interrupted Session',
          description: '',
          startTime: new Date().toISOString(),
          status: 'interrupted',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
        },
      ];

      const { getStorage } = await import('../../services/storage');
      vi.mocked(getStorage).mockResolvedValue({
        load: vi.fn(() => Promise.resolve(mockSessions)),
        save: vi.fn(() => Promise.resolve()),
      } as any);

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
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          name: 'Old Session',
          description: '',
          startTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'completed',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
        },
        {
          id: 'session-2',
          name: 'New Session',
          description: '',
          startTime: now.toISOString(),
          status: 'completed',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
        },
      ];

      const { getStorage } = await import('../../services/storage');
      vi.mocked(getStorage).mockResolvedValue({
        load: vi.fn(() => Promise.resolve(mockSessions)),
        save: vi.fn(() => Promise.resolve()),
      } as any);

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
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          name: 'Original Name',
          description: '',
          startTime: new Date().toISOString(),
          status: 'completed',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
        },
      ];

      const mockSave = vi.fn(() => Promise.resolve());
      const { getStorage } = await import('../../services/storage');
      vi.mocked(getStorage).mockResolvedValue({
        load: vi.fn(() => Promise.resolve(mockSessions)),
        save: mockSave,
      } as any);

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

      expect(mockSave).toHaveBeenCalled();
      expect(result.current.sessions[0].name).toBe('Updated Name');
    });
  });

  describe('deleteSession', () => {
    it('should delete session from storage and state', async () => {
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          name: 'Session to Delete',
          description: '',
          startTime: new Date().toISOString(),
          status: 'completed',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
        },
      ];

      const mockSave = vi.fn(() => Promise.resolve());
      const { getStorage } = await import('../../services/storage');
      vi.mocked(getStorage).mockResolvedValue({
        load: vi.fn(() => Promise.resolve(mockSessions)),
        save: mockSave,
      } as any);

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

      expect(mockSave).toHaveBeenCalled();
      expect(result.current.sessions).toHaveLength(0);
    });

    it('should prevent deletion of session with active enrichment', async () => {
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          name: 'Session with Enrichment',
          description: '',
          startTime: new Date().toISOString(),
          status: 'completed',
          screenshots: [],
          extractedTaskIds: [],
          extractedNoteIds: [],
          tags: [],
          enrichmentStatus: {
            status: 'in-progress',
            progress: 50,
            currentStage: 'audio',
          },
        },
      ];

      const { getStorage } = await import('../../services/storage');
      vi.mocked(getStorage).mockResolvedValue({
        load: vi.fn(() => Promise.resolve(mockSessions)),
        save: vi.fn(() => Promise.resolve()),
      } as any);

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
