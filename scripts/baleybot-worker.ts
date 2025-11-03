/**
 * BaleyBots Worker Script
 *
 * Runs BaleyBots SDK in a Bun process for Ned chat.
 * Reads request from stdin (JSON), processes with BaleyBots, streams events to stdout.
 */

import { Baleybot, openai } from '@baleybots/core';
import type { StreamEvent } from '@baleybots/core';

// Type declaration for Bun runtime
declare const Bun: {
  env: {
    [key: string]: string | undefined;
  };
  stdin: {
    text(): Promise<string>;
  };
};

// Read request from stdin
const requestJson = await Bun.stdin.text();
const request = JSON.parse(requestJson) as {
  streamId: string;
  message: string;
  model: string;
  systemPrompt?: string;
  tools?: Record<string, any>;
  agentMode: boolean;
  maxToolIterations?: number;
  conversationHistory?: Array<{ role: string; content: string }>;
};

// Convert tools to stub functions that emit events instead of executing
// This allows agentMode: true to work properly while frontend handles execution
// Debug: Log to stdout so it can be captured
try {
  const toolsDebug = {
    hasTools: !!request.tools,
    toolsType: typeof request.tools,
    toolsIsNull: request.tools === null,
    toolsIsUndefined: request.tools === undefined,
    toolsValue: request.tools ? 'object' : request.tools,
    toolsKeys: request.tools && typeof request.tools === 'object' && request.tools !== null 
      ? Object.keys(request.tools) 
      : null,
  };
  console.log(JSON.stringify({
    streamId: request.streamId,
    type: 'debug',
    debug: { source: 'tools-check', data: toolsDebug },
  }));
} catch (e) {
  // Ignore debug errors
}

const stubTools: Record<string, any> = {};

// More defensive check - ensure tools is a non-null object
if (request.tools != null && typeof request.tools === 'object' && !Array.isArray(request.tools)) {
  try {
    // Double-check before any Object operations
    const tools = request.tools as Record<string, any>;
    if (tools == null) {
      throw new Error('Tools is null after type assertion');
    }
    
    console.log(JSON.stringify({
      streamId: request.streamId,
      type: 'debug',
      debug: { source: 'tools-processing-start', toolsCount: Object.keys(tools).length },
    }));
    
    // Safely get entries
    const entries = Object.entries(tools);
    
    for (const [toolName, toolDef] of entries) {
      // Debug: Log tool definition structure
      try {
        console.log(JSON.stringify({
          streamId: request.streamId,
          type: 'debug',
          debug: {
            source: 'tool-definition-check',
            toolName,
            hasName: !!toolDef?.name,
            hasDescription: !!toolDef?.description,
            hasParameters: !!toolDef?.parameters,
            parametersType: typeof toolDef?.parameters,
            parametersIsNull: toolDef?.parameters === null,
            parametersKeys: toolDef?.parameters && typeof toolDef?.parameters === 'object' && toolDef?.parameters !== null
              ? Object.keys(toolDef.parameters)
              : null,
          },
        }));
      } catch (e) {
        // Ignore debug errors
      }
      
      // Ensure toolDef has required structure
      if (!toolDef || typeof toolDef !== 'object') {
        console.log(JSON.stringify({
          streamId: request.streamId,
          type: 'debug',
          debug: { source: 'tool-skip', toolName, reason: 'invalid tool definition structure' },
        }));
        continue;
      }
      
      // Preserve the ToolDefinition structure but replace the function
      // The SDK expects: { name, description, parameters, function }
      stubTools[toolName] = {
        name: toolDef.name || toolName,
        description: toolDef.description || '',
        parameters: toolDef.parameters && typeof toolDef.parameters === 'object' && toolDef.parameters !== null
          ? toolDef.parameters
          : {},
        function: async (args: Record<string, any>) => {
          // The SDK already emits tool_call_stream_complete events via onToken callback
          // We just need to return a placeholder result - the frontend will execute the real tool
          // and feed results back in the next iteration
          return {
            success: true,
            message: 'Tool call emitted - awaiting frontend execution',
            _stub: true,
          };
        },
      };
    }
    
    console.log(JSON.stringify({
      streamId: request.streamId,
      type: 'debug',
      debug: { source: 'tools-processing-complete', stubToolsCount: Object.keys(stubTools).length },
    }));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify({
      streamId: request.streamId,
      type: 'error',
      error: {
        message: `Error processing tools: ${errorMsg}`,
      },
    }));
    throw error;
  }
} else {
  console.log(JSON.stringify({
    streamId: request.streamId,
    type: 'debug',
    debug: { source: 'tools-check-failed', reason: 'tools is null, undefined, or not an object' },
  }));
}

// Create Baleybot with stub tools and agentMode: true
// agentMode: true ensures tool calls work properly, but we use stubs
// so the frontend can intercept and execute the real tools

// Ensure stubTools is a valid object before passing to SDK
// Pass undefined if empty to avoid SDK issues
// NEVER pass null - only undefined or a valid object
const toolsForBot = Object.keys(stubTools).length > 0 && stubTools !== null 
  ? stubTools 
  : undefined;

console.log(JSON.stringify({
  streamId: request.streamId,
  type: 'debug',
  debug: { 
    source: 'bot-creation-start', 
    stubToolsCount: Object.keys(stubTools).length,
    toolsForBot: toolsForBot ? 'object' : 'undefined',
    stubToolsKeys: Object.keys(stubTools),
  },
}));

let bot;
try {
  // @ts-expect-error - agentMode and tools structure may not match type definitions exactly
  bot = Baleybot.create({
    name: 'ned',
    goal: request.systemPrompt || 'You are Ned, a helpful AI assistant for Taskerino.',
    model: openai(request.model || 'gpt-4.1', {
      apiKey: process.env.OPENAI_API_KEY!,
    }),
    tools: toolsForBot, // Pass undefined if empty instead of empty object
    maxToolIterations: request.maxToolIterations || 1,
    agentMode: true, // Enable agent mode so tool calls work properly
  });
  
  console.log(JSON.stringify({
    streamId: request.streamId,
    type: 'debug',
    debug: { source: 'bot-creation-success' },
  }));
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.log(JSON.stringify({
    streamId: request.streamId,
    type: 'error',
    error: {
      message: `Error creating bot: ${errorMsg}`,
    },
  }));
  throw error;
}

// Build conversation context from history
// Since BaleyBots process() takes a single input, we need to build context
let conversationContext = '';
if (request.conversationHistory && request.conversationHistory.length > 0) {
  // Build context from conversation history (excluding last message)
  const historyMessages = request.conversationHistory.slice(0, -1);
  conversationContext = historyMessages.map(msg => {
    return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`;
  }).join('\n\n');
}

// Combine context with current message
const fullMessage = conversationContext 
  ? `${conversationContext}\n\nUser: ${request.message}`
  : request.message;

// Process message with streaming - emit events to stdout (JSON lines)
try {
  await bot.process(fullMessage, {
    onToken: (_botName, event: StreamEvent) => {
      // Write JSON event to stdout (one per line)
      console.log(JSON.stringify({
        streamId: request.streamId,
        event,
      }));
    },
  });

  // Send completion event
  console.log(JSON.stringify({
    streamId: request.streamId,
    type: 'complete',
  }));
} catch (error) {
  // Send error event
  console.log(JSON.stringify({
    streamId: request.streamId,
    type: 'error',
    error: {
      message: error instanceof Error ? error.message : String(error),
    },
  }));
  process.exit(1);
}

