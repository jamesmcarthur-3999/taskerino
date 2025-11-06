import { invoke } from '@tauri-apps/api/core';

// Tauri fetch adapter for routing API calls through Tauri
// Use a closure to capture the original fetch before any patching
export const tauriFetchAdapter = (() => {
  // Capture original fetch at module load time
  const originalFetch = globalThis.fetch;
  
  return async function tauriFetchAdapter(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input : input.url;
    const urlString = typeof url === 'string' ? url : url.toString();
    // Use the captured original fetch, not globalThis.fetch
    if (!urlString.includes('api.anthropic.com')) return originalFetch(input, init);

    // Extract headers from init
    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [key, value] of init.headers) {
          headers[key] = value;
        }
      } else {
        // Plain object
        for (const [key, value] of Object.entries(init.headers)) {
          headers[key] = String(value);
        }
      }
    }

    // Extract method (default to POST for Anthropic API)
    const method = init?.method || 'POST';

    // Extract body as string
    const body = init?.body ? String(init.body) : null;

    try {
      // Forward request directly through Tauri proxy
      const responseText = await invoke<string>('proxy_http_request', {
        url: urlString,
        method,
        headers,
        body,
      });

      // Return response with raw text
      return new Response(responseText, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      // Return error response
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
})();

