/**
 * usePersistedState - React hook for persisted state with background queue
 *
 * Drop-in replacement for useState that automatically persists changes
 * to storage using the PersistenceQueue (no UI blocking).
 *
 * @example
 * ```typescript
 * // Critical priority (immediate save)
 * const [sessions, setSessions] = usePersistedState<Session[]>(
 *   'sessions',
 *   [],
 *   'critical'
 * );
 *
 * // Normal priority (batched, default)
 * const [settings, setSettings] = usePersistedState(
 *   'settings',
 *   defaultSettings
 * );
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { getPersistenceQueue, type QueuePriority } from '@/services/storage/PersistenceQueue';

export function usePersistedState<T>(
  key: string,
  initialValue: T,
  priority: QueuePriority = 'normal'
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialValue);
  const queue = getPersistenceQueue();

  // Persist to queue whenever state changes
  useEffect(() => {
    queue.enqueue(key, state, priority);
  }, [key, state, priority, queue]);

  const setPersistedState = useCallback((value: T | ((prev: T) => T)) => {
    setState(value);
  }, []);

  return [state, setPersistedState];
}
