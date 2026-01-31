// src/bots/hooks/useBots.ts
import { useEffect, useState, useCallback } from 'react';
import { initializeBots, isBotsReady, updateApiKeys, type BotConfig } from '../config';

export interface UseBotsReturn {
  isReady: boolean;
  isInitializing: boolean;
  error: Error | null;
  updateKeys: (config: BotConfig) => Promise<void>;
  reinitialize: () => Promise<void>;
}

export function useBots(): UseBotsReturn {
  const [isReady, setIsReady] = useState(isBotsReady());
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const initialize = useCallback(async () => {
    if (isBotsReady()) {
      setIsReady(true);
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      await initializeBots();
      setIsReady(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to initialize bots'));
      setIsReady(false);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const updateKeys = useCallback(async (config: BotConfig) => {
    await updateApiKeys(config);
  }, []);

  return {
    isReady,
    isInitializing,
    error,
    updateKeys,
    reinitialize: initialize,
  };
}
