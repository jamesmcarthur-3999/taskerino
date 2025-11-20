/**
 * Custom Tauri Fetch Implementation with Streaming Support
 * 
 * Routes /api/* requests and direct provider API calls through Tauri events.
 * Returns a streaming Response so Baleybots can process chunks in real-time.
 */

import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function mapApiPathToProxyPath(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    if (hostname === 'api.openai.com') {
      if (pathname === '/v1/chat/completions' || pathname === '/v1/responses') {
        return '/api/openai/chat';
      }
    }
    
    if (hostname === 'api.anthropic.com') {
      if (pathname === '/v1/messages') {
        return '/api/anthropic/chat';
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

export async function tauriFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' 
    ? input 
    : input instanceof URL 
    ? input.toString()
    : input.url;
  
  const isProxyCall = url.includes('/api/');
  const mappedPath = mapApiPathToProxyPath(url);
  
  if (!isProxyCall && !mappedPath) {
    return globalThis.fetch(input, init);
  }
  
  const targetPath = mappedPath || (() => {
    try {
      const urlObj = new URL(url, 'http://localhost');
      return urlObj.pathname + urlObj.search;
    } catch {
      return null;
    }
  })();
  
  if (!targetPath) {
    return globalThis.fetch(input, init);
  }
  
  const method = init?.method || 'POST';
  console.log('[tauriFetch] Sending request:', { originalUrl: url, targetPath, method });
  const headers: Record<string, string> = {};
  
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = String(value);
      });
    } else if (Array.isArray(init.headers)) {
      for (const [key, value] of init.headers) {
        headers[key] = String(value);
      }
    } else {
      for (const [key, value] of Object.entries(init.headers)) {
        headers[key] = String(value);
      }
    }
  }

  let body = '';
  if (init?.body) {
    if (typeof init.body === 'string') {
      body = init.body;
    } else if (init.body instanceof ReadableStream) {
      const reader = init.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          body += decoder.decode(value, { stream: true });
        }
      }
      body += decoder.decode();
    } else {
      body = await new Response(init.body).text();
    }
  }

  const query: Record<string, string> = {};
  try {
    const urlObj = new URL(url, 'http://localhost');
    urlObj.searchParams.forEach((value, key) => {
      query[key] = value;
    });
  } catch {
    // Ignore
  }

  const requestId = generateRequestId();

  // Create a ReadableStream for streaming response chunks
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  let unlistenFn: UnlistenFn | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let finalStatus: number | null = null;
  let finalHeaders: Record<string, string> = {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    },
    cancel() {
      // Clean up on cancel
      if (unlistenFn) unlistenFn();
      if (timeoutId) clearTimeout(timeoutId);
    },
  });

  type TauriResponse = {
    requestId: string;
    status: number;
    headers: Record<string, string>;
    body: string | null;
    done: boolean;
  };

  // Set up listener for streaming chunks
  listen<TauriResponse>('baleybot-proxy-response', (event) => {
    const payload = event.payload;
    
    if (payload.requestId !== requestId) return;

    // Capture status and headers from first chunk
    if (finalStatus === null) {
      finalStatus = payload.status;
      finalHeaders = payload.headers || {};
    }

    // Emit chunk immediately if we have a controller
    if (streamController && payload.body) {
      const encoder = new TextEncoder();
      const chunk = encoder.encode(payload.body);
      streamController.enqueue(chunk);
    }

    // Close stream when done
    if (payload.done) {
      if (streamController) {
        streamController.close();
        streamController = null;
      }
      if (unlistenFn) unlistenFn();
      if (timeoutId) clearTimeout(timeoutId);
    }
  })
    .then((unlisten) => {
      unlistenFn = unlisten;

      timeoutId = setTimeout(() => {
        if (streamController) {
          streamController.error(new Error(`Request timeout: ${requestId}`));
          streamController = null;
        }
        if (unlistenFn) unlistenFn();
      }, 30000);

      // Emit request
      emit('baleybot-proxy-request', {
        requestId,
        method,
        path: targetPath,
        headers,
        body,
        query,
      }).catch((error) => {
        if (streamController) {
          streamController.error(new Error(`Failed to emit request: ${error}`));
          streamController = null;
        }
        if (unlistenFn) unlistenFn();
        if (timeoutId) clearTimeout(timeoutId);
      });
    })
    .catch((error) => {
      if (streamController) {
        streamController.error(new Error(`Failed to set up response listener: ${error}`));
        streamController = null;
      }
      if (timeoutId) clearTimeout(timeoutId);
    });

  // Return Response with streaming body
  // Baleybots will read this stream incrementally and call onToken for each parsed event
  return new Response(stream, {
    status: 200, // Status will be captured from first chunk
    headers: {
      'Content-Type': 'text/event-stream',
      ...finalHeaders,
    },
  });
}

