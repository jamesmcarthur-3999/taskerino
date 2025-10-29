import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useTauriApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const exists = await invoke<boolean>('has_openai_api_key');
        if (!isMounted) return;
        setHasApiKey(!!exists);
        if (exists) {
          const key = await invoke<string | null>('get_openai_api_key');
          if (!isMounted) return;
          setApiKey(key || null);
        } else {
          setApiKey(null);
        }
      } catch (e) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load API key');
        setApiKey(null);
        setHasApiKey(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  return { apiKey, hasApiKey, loading, error };
}


