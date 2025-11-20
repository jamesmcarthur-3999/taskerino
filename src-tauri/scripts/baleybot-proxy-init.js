#!/usr/bin/env node
/**
 * Baleybot Proxy Handler
 * 
 * This script is kept for backward compatibility during migration.
 * The client now uses TauriTransportClient which emits Tauri events.
 * Rust bridges those events to this handler via stdin/stdout.
 * 
 * Note: This handler uses createHandlers (not createBaleybotProxy) because
 * we're using stdin/stdout communication pattern, not direct Tauri transport.
 * The TauriTransportClient on the client side handles Tauri events.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve node_modules path
const projectRoot = join(__dirname, '..', '..');
const nodeModulesPath = join(projectRoot, 'node_modules');

// Import baleybots handlers
let createHandlers, createLogger;

try {
  // Import from proxy-server package
  const proxyServerPath = join(nodeModulesPath, '@baleybots', 'proxy-server', 'dist', 'esm', 'index.js');
  const proxyServerUrl = new URL(`file://${proxyServerPath}`).href;
  const proxyServerModule = await import(proxyServerUrl);
  createHandlers = proxyServerModule.createHandlers;
  createLogger = proxyServerModule.createLogger;
} catch (e) {
  // Fallback: try direct import
  try {
    const proxyServerModule = await import('@baleybots/proxy-server');
    createHandlers = proxyServerModule.createHandlers;
    createLogger = proxyServerModule.createLogger;
  } catch (e2) {
    // Last resort: try CommonJS
    try {
      const require = createRequire(import.meta.url);
      const proxyServerModule = require(join(nodeModulesPath, '@baleybots', 'proxy-server', 'dist', 'cjs', 'index.js'));
      createHandlers = proxyServerModule.createHandlers;
      createLogger = proxyServerModule.createLogger;
    } catch (e3) {
      console.error('Failed to load baleybots proxy-server:', e3);
      process.exit(1);
    }
  }
}

// Get API keys from environment (passed from Rust)
const apiKeys = {
  anthropic: process.env.ANTHROPIC_API_KEY || '',
  openai: process.env.OPENAI_API_KEY || '',
  google: process.env.GOOGLE_API_KEY || '',
  ollama: process.env.OLLAMA_API_KEY || '',
};

// Create handlers using baleybots
const handlers = createHandlers({
  apiKeys,
  logger: createLogger('errors'),
  basePath: '/api',
});

// Extract provider from path (e.g., /api/anthropic/messages → anthropic)
function extractProvider(path) {
  const match = path.match(/^\/api\/([^\/]+)\//);
  return match ? match[1] : null;
}

// Handle a proxy request (same as before)
async function handleProxyRequest(request) {
  const { requestId, method, path, headers, body, query } = request;
  
  try {
    // Extract provider from path
    const provider = extractProvider(path);
    console.log('[baleybot-proxy-init] Request received:', { requestId, path, extractedProvider: provider });
    if (!provider) {
      throw new Error(`Invalid path: ${path}. Expected /api/{provider}/...`);
    }
    
    // Convert Tauri event → Request object
    const url = new URL(`http://localhost${path}`);
    Object.entries(query || {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    
    const webRequest = new Request(url.toString(), {
      method,
      headers: new Headers(headers),
      body: body || null,
    });
    
    // Call the appropriate handler
    let response;
    console.log('[baleybot-proxy-init] Calling handler for provider:', provider);
    console.log('[baleybot-proxy-init] API keys available:', {
      anthropic: apiKeys.anthropic ? `${apiKeys.anthropic.substring(0, 10)}...` : 'empty',
      openai: apiKeys.openai ? `${apiKeys.openai.substring(0, 10)}...` : 'empty',
    });
    
    if (provider === 'anthropic') {
      response = await handlers.anthropic(webRequest);
    } else if (provider === 'openai') {
      response = await handlers.openai(webRequest);
    } else if (provider === 'google') {
      response = await handlers.google(webRequest);
    } else if (provider === 'ollama') {
      response = await handlers.ollama(webRequest);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
    
    // Stream response back via stdout (same format as before)
    if (response.body instanceof ReadableStream) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // Emit final event with done flag
            process.stdout.write(JSON.stringify({
              type: 'response',
              requestId,
              status: response.status,
              headers: Object.fromEntries(response.headers),
              body: null,
              done: true,
            }) + '\n');
            break;
          }
          
          // Emit chunk event
          const chunk = decoder.decode(value, { stream: true });
          process.stdout.write(JSON.stringify({
            type: 'response',
            requestId,
            status: response.status,
            headers: Object.fromEntries(response.headers),
            body: chunk,
            done: false,
          }) + '\n');
        }
      } catch (error) {
        // Emit error event
        process.stdout.write(JSON.stringify({
          type: 'response',
          requestId,
          status: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: error instanceof Error ? error.message : 'Streaming error'
          }),
          done: true,
        }) + '\n');
      } finally {
        reader.releaseLock();
      }
    } else {
      // Non-streaming response
      const responseBody = await response.text();
      process.stdout.write(JSON.stringify({
        type: 'response',
        requestId,
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: responseBody,
        done: true,
      }) + '\n');
    }
  } catch (error) {
    // Emit error response
    process.stdout.write(JSON.stringify({
      type: 'response',
      requestId,
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      done: true,
    }) + '\n');
  }
}

// Read requests from stdin (one JSON line per request)
let inputBuffer = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  inputBuffer += chunk;
  
  // Try to parse complete JSON objects (one per line)
  const lines = inputBuffer.split('\n');
  inputBuffer = lines.pop() || ''; // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const request = JSON.parse(line);
        if (request.type === 'request') {
          handleProxyRequest(request).catch((error) => {
            console.error('Error handling request:', error);
          });
        }
      } catch (error) {
        console.error('Failed to parse request:', error);
      }
    }
  }
});

process.stdin.on('end', () => {
  if (inputBuffer.trim()) {
    try {
      const request = JSON.parse(inputBuffer);
      if (request.type === 'request') {
        handleProxyRequest(request).catch((error) => {
          console.error('Error handling request:', error);
        });
      }
    } catch (error) {
      console.error('Failed to parse request:', error);
    }
  }
});

// Keep process alive
process.stdin.resume();

