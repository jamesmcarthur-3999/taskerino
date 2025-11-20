#!/usr/bin/env node
/**
 * Baleybots Bridge Script
 * 
 * Runs baleybots providers in Node.js and communicates via stdin/stdout.
 * Receives requests as JSON from stdin, calls provider methods,
 * and emits results/events as JSON lines to stdout.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve node_modules path (assuming this script is in src-tauri/scripts)
// Go up from src-tauri/scripts to root, then to node_modules
const projectRoot = join(__dirname, '..', '..');
const nodeModulesPath = join(projectRoot, 'node_modules');

// Use require for CommonJS modules if needed, or dynamic import for ESM
const require = createRequire(import.meta.url);

// Import baleybots providers from the providers submodule
let AnthropicProvider, OpenAIProvider, GoogleProvider, OllamaProvider;

try {
  // Import from providers submodule - this is where the Provider classes are exported
  const baleybotsProvidersPath = join(nodeModulesPath, '@baleybots', 'core', 'dist', 'esm', 'providers', 'index.js');
  const baleybotsProvidersUrl = new URL(`file://${baleybotsProvidersPath}`).href;
  const providersModule = await import(baleybotsProvidersUrl);
  AnthropicProvider = providersModule.AnthropicProvider;
  OpenAIProvider = providersModule.OpenAIProvider;
  GoogleProvider = providersModule.GoogleProvider;
  OllamaProvider = providersModule.OllamaProvider;
} catch (e) {
  // Fallback: try direct import from package name with providers path
  try {
    const providersModule = await import('@baleybots/core/providers');
    AnthropicProvider = providersModule.AnthropicProvider;
    OpenAIProvider = providersModule.OpenAIProvider;
    GoogleProvider = providersModule.GoogleProvider;
    OllamaProvider = providersModule.OllamaProvider;
  } catch (e2) {
    // Last resort: try require for CommonJS
    try {
      const providersModule = require(join(nodeModulesPath, '@baleybots', 'core', 'dist', 'cjs', 'providers', 'index.js'));
      AnthropicProvider = providersModule.AnthropicProvider;
      OpenAIProvider = providersModule.OpenAIProvider;
      GoogleProvider = providersModule.GoogleProvider;
      OllamaProvider = providersModule.OllamaProvider;
    } catch (e3) {
      console.error('Failed to load baleybots providers:', e3);
      console.error('Tried:', baleybotsProvidersPath, 'and', '@baleybots/core/providers');
      process.exit(1);
    }
  }
}

// Provider factory
function getProvider(providerType) {
  switch (providerType) {
    case 'anthropic':
      return new AnthropicProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'google':
      return new GoogleProvider();
    case 'ollama':
      return new OllamaProvider();
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

// Read request from stdin
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
        handleRequest(request).catch((error) => {
          emitError('Request handling failed', error);
        });
      } catch (error) {
        emitError('Failed to parse request', error);
      }
    }
  }
});

process.stdin.on('end', () => {
  if (inputBuffer.trim()) {
    try {
      const request = JSON.parse(inputBuffer);
      handleRequest(request).catch((error) => {
        emitError('Request handling failed', error);
      });
    } catch (error) {
      emitError('Failed to parse request', error);
    }
  }
});

async function handleRequest(request) {
  const { providerType, model, params, config } = request;
  
  try {
    const provider = getProvider(providerType);
    
    // Check if this is a streaming or non-streaming request
    // For now, always use streaming (chatCompletionStream)
    // The non-streaming command will also use this for simplicity
    
    // Call provider.chatCompletionStream() with onEvent callback
    await provider.chatCompletionStream(
      params,
      config,
      (event) => {
        // Log all event types for diagnostics
        if (event && event.type) {
          console.error(`[Bridge] Emitting event type: ${event.type}`);
          
          // Log full structure for non-text events to see what we're getting
          if (event.type !== 'text_delta') {
            console.error(`[Bridge] Non-text event structure: ${JSON.stringify(event, null, 2)}`);
          }
          
          // Log tool call events specifically with full structure
          if (event.type.includes && event.type.includes('tool_call')) {
            console.error(`[Bridge] Tool call event detected: ${event.type}`);
            console.error(`[Bridge] Tool call event JSON: ${JSON.stringify(event, null, 2)}`);
          }
          
          // Also check for content_block events that might contain tool calls
          if (event.type.includes && (event.type.includes('content_block') || event.type.includes('tool'))) {
            console.error(`[Bridge] Potential tool-related event: ${event.type}`);
            console.error(`[Bridge] Event structure: ${JSON.stringify(event, null, 2)}`);
          }
        } else {
          // Log events without type field for debugging
          console.error(`[Bridge] Event without type field: ${JSON.stringify(event, null, 2)}`);
        }
        
        // Emit event as JSON line to stdout
        process.stdout.write(JSON.stringify(event) + '\n');
      }
    );
    
    // Stream complete
    process.exit(0);
  } catch (error) {
    emitError('Provider error', error);
  }
}

function emitError(message, error) {
  const errorEvent = {
    type: 'error',
    error: {
      message: message,
      details: error?.message || String(error),
      stack: error?.stack,
    },
  };
  process.stdout.write(JSON.stringify(errorEvent) + '\n');
  process.exit(1);
}

