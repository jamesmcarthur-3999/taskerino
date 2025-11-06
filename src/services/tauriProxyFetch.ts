/**
 * Tauri Proxy Fetch Adapter
 * 
 * Intercepts fetch requests to proxy endpoints (/api/*) and converts them
 * to Tauri events. This allows proxy providers from @baleybots/core/proxy
 * to work seamlessly with Tauri without needing an HTTP server.
 */

import { emit, listen } from '@tauri-apps/api/event';

interface PendingRequest {
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
  chunks: string[];
  headers: Record<string, string>;
  status: number;
}

const pendingRequests = new Map<string, PendingRequest>();

let listener: (() => void) | null = null;

async function initListener() {
  if (listener) return;
  
  listener = await listen('baleybot-proxy-response', (event) => {
    const payload = event.payload as {
      requestId: string;
      status: number;
      headers: Record<string, string>;
      body: string | null;
      done: boolean;
    };
    
    const pending = pendingRequests.get(payload.requestId);
    if (!pending) return;
    
    // Accumulate chunks for streaming
    if (payload.body !== null) {
      pending.chunks.push(payload.body);
    }
    
    // Update headers and status from first chunk
    if (pending.chunks.length === 1) {
      pending.headers = payload.headers;
      pending.status = payload.status;
    }
    
    // If done, build final response
    if (payload.done) {
      pendingRequests.delete(payload.requestId);
      
      const fullBody = pending.chunks.join('');
      const response = new Response(fullBody || null, {
        status: pending.status,
        headers: new Headers(pending.headers),
      });
      
      pending.resolve(response);
    }
  });
}

/**
 * Custom fetch adapter that intercepts /api/* requests and routes them
 * through Tauri events instead of HTTP.
 */
export async function tauriProxyFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input : input.url;
  const urlString = typeof url === 'string' ? url : url.toString();
  
  // Only intercept proxy requests (same-origin routes like /api/anthropic/messages)
  if (!urlString.startsWith('/api/')) {
    return globalThis.fetch(input, init);
  }
  
  // Initialize listener on first use
  await initListener();
  
  // Generate unique request ID
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Parse URL
  const urlObj = new URL(urlString, 'http://localhost');
  const path = urlObj.pathname;
  const query: Record<string, string> = {};
  urlObj.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  
  // Extract headers
  const headers: Record<string, string> = {};
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
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
  
  // Extract body
  const body = init?.body 
    ? (typeof init.body === 'string' 
        ? init.body 
        : await new Response(init.body).text()) 
    : null;
  
  // Extract method
  const method = init?.method || 'POST';
  
  // Create pending request tracker
  const promise = new Promise<Response>((resolve, reject) => {
    pendingRequests.set(requestId, {
      resolve,
      reject,
      chunks: [],
      headers: {},
      status: 200,
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error('Proxy request timeout'));
      }
    }, 5 * 60 * 1000);
  });
  
  // Emit request via Tauri event
  await emit('baleybot-proxy-request', {
    requestId,
    method,
    path,
    headers,
    body,
    query,
  });
  
  return promise;
}

