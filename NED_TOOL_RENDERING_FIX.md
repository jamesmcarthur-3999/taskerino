# NED Tool Rendering Fix

## Problem
Tools weren't rendering in the new NED UI because:

1. **Assistant messages with `tool_calls` were being filtered out** - The code at line 395-396 was skipping these messages entirely, so users couldn't see when tools were being called.

2. **Tool execution visualization was missing** - While tool *results* were being processed, the tool *calls themselves* weren't being shown to the user.

## Solution

### What Was Changed

#### 1. Added Tool Call Visualization (NedChatSimplified.tsx)
Added handling for assistant messages with `tool_calls` to show them as `tool-use` indicators:

```typescript
// For assistant messages with tool calls, show tool-use indicators
if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
  return {
    id: msg.id,
    role: 'assistant' as const,
    contents: msg.tool_calls.map((toolCall: any) => ({
      type: 'tool-use' as const,
      toolName: toolCall.function?.name || toolCall.name,
      toolStatus: 'pending' as const,
    })),
    timestamp: msg.timestamp?.toISOString() || new Date().toISOString(),
  };
}
```

#### 2. Cleaned Up Tool Definitions
Simplified tool setup to leverage baleybots' native Zod support:

```typescript
// Before: Manually specifying name, description, schema
baleybotTools[toolName] = {
  name: toolDef.name,
  description: toolDef.description,
  schema: toolDef.schema,
  function: async (args) => { ... }
};

// After: Let baleybots handle it with ZodToolDefinition format
baleybotTools[toolName] = {
  description: toolDef.description,
  schema: toolDef.schema, // Zod schema - baleybots handles this natively!
  function: async (args) => { ... }
};
```

## How Baleybots Tool Support Works

### UIChatMessage Format

Baleybots uses OpenAI's ChatMessage format as standard, with full support for tool calling:

```typescript
interface UIChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | any[];
  timestamp?: Date;
  
  // OpenAI tool calling fields
  tool_call_id?: string;  // For tool result messages
  tool_calls?: Array<{    // For assistant messages requesting tool calls
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;  // JSON string of arguments
    };
  }>;
}
```

### Tool Call Flow

1. **User sends message** → `role: 'user', content: "What tasks are due today?"`

2. **Assistant requests tool call** → 
   ```typescript
   {
     role: 'assistant',
     content: '',
     tool_calls: [{
       id: 'call_abc123',
       type: 'function',
       function: {
         name: 'query_context_agent',
         arguments: '{"query":"tasks due today"}'
       }
     }]
   }
   ```

3. **Tool executes and returns result** →
   ```typescript
   {
     role: 'tool',
     tool_call_id: 'call_abc123',
     content: '{"full_tasks":[...]}'  // JSON string or plain text
   }
   ```

4. **Assistant provides final response** → `role: 'assistant', content: "You have 3 tasks due today..."`

### Streaming Events

During streaming, baleybots emits these events:

- `tool_call_stream_start` - Tool call begins
- `tool_call_arguments_delta` - Streaming JSON arguments
- `tool_call_stream_complete` - Arguments finalized
- `tool_execution_start` - Tool function executing
- `tool_execution_output` - Tool result ready
- `text_delta` - Text response streaming

### Zod Schema Support

Baleybots accepts **ZodToolDefinition** format directly:

```typescript
import { z } from 'zod';

const tools = {
  create_task: {
    description: 'Create a new task',
    schema: z.object({
      title: z.string().describe('Task title'),
      priority: z.enum(['low', 'medium', 'high']).optional(),
    }),
    function: async (args) => {
      // args is type-safe based on the Zod schema!
      const { title, priority } = args;
      // ... execute tool
      return { success: true, taskId: '123' };
    }
  }
};
```

Key benefits:
- **Type safety**: Zod validates arguments before your function runs
- **Auto-generated JSON Schema**: Baleybots converts Zod → JSON Schema for the LLM
- **Runtime validation**: Invalid args are caught automatically
- **IDE autocomplete**: Full TypeScript support

### No Manual Conversion Needed!

❌ **Don't do this:**
```typescript
// Manually converting Zod to JSON Schema
const jsonSchema = zodToJsonSchema(myZodSchema);
```

✅ **Do this:**
```typescript
// Pass Zod schema directly - baleybots handles conversion
const tools = {
  myTool: {
    description: 'My tool',
    schema: myZodSchema,  // Just pass the Zod schema!
    function: async (args) => { ... }
  }
};
```

## Testing

To verify tools are rendering correctly:

1. **Open NED overlay** - Click the Ned button or press keyboard shortcut
2. **Ask a question that requires tools** - e.g., "What tasks are due this week?"
3. **Watch for tool indicators** - You should see:
   - Loading indicators when tools are called
   - Tool names displayed (e.g., "query context agent")
   - Results rendered as task cards, note cards, or session cards
4. **Check console logs** - Tool execution is logged:
   ```
   [NedChat] Executing tool: query_context_agent {...}
   [NedChat] Tool result for query_context_agent: {...}
   ```

## Related Files

- `src/components/ned/NedChatSimplified.tsx` - Main chat component using baleybots
- `src/components/ned/NedMessage.tsx` - Message rendering with tool-use support
- `src/services/nedToolsZod.ts` - Zod-based tool definitions
- `src/services/nedToolExecutor.ts` - Tool execution logic
- `@baleybots/react` - Hook providing tool support

## Key Takeaways

1. **Baleybots handles tool calling end-to-end** - Just provide `ZodToolDefinition` format
2. **UIChatMessage uses OpenAI format** - Standard tool_calls and tool role
3. **Tool visualization requires handling both** - Assistant messages with tool_calls AND tool role messages
4. **Zod schemas are first-class** - No manual JSON Schema conversion needed
5. **Streaming is built-in** - Tool calls, arguments, and results all stream automatically


