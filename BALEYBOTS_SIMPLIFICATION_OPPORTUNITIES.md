# Baleybots Simplification Opportunities

## Executive Summary

After migrating Ned to baleybots alpha 20, we have **2,052+ lines of legacy code** that can be removed, plus **4 additional services** that could be simplified using baleybots.

---

## 🗑️ Code That Can Be Removed (2,052+ lines)

### 1. **Old NedChat Component** (813 lines)
**File**: `src/components/ned/NedChat.tsx`

**Status**: ✅ Replaced by `NedChatSimplified.tsx`

**Still used by**:
- `src/components/AssistantZone.tsx` (line 8)

**Action**: 
1. Update `AssistantZone.tsx` to use `NedChatSimplified`
2. Delete `NedChat.tsx`

```typescript
// In AssistantZone.tsx, change:
import { NedChat } from './ned/NedChat';
// To:
import { NedChatSimplified as NedChat } from './ned/NedChatSimplified';
```

---

### 2. **Old NedService** (804 lines)
**File**: `src/services/nedService.ts`

**What it does**: 
- Manual Tauri event streaming
- Complex message conversion
- Tool call orchestration
- Multi-turn conversation management

**Status**: ✅ Replaced by baleybots `useChat` hook

**Still used by**:
- `src/components/ned/NedChat.tsx` (line 18)
- `src/App.tsx` (only for API key initialization)

**Action**:
1. Keep ONLY the API key initialization logic
2. Remove all the streaming/conversation code
3. Move to simplified service or inline in `useTauriApiKey` hook

**Can remove**:
- `NedService` class (650+ lines)
- `executeStreamingTurn()` method
- `buildClaudeMessages()` conversion logic
- `sendMessage()` generator
- All Tauri event streaming code

**Keep**:
- `setApiKey()` method (move to hook)
- `hasApiKey()` method (move to hook)

---

### 3. **Old Tool Definitions** (435 lines)
**File**: `src/services/nedTools.ts`

**What it does**:
- Defines tools in Claude's format (not Zod)
- Provides `TOOL_DESCRIPTIONS` object
- Splits into `READ_TOOLS` and `WRITE_TOOLS`

**Status**: ✅ Replaced by `src/services/nedToolsZod.ts`

**Still used by**:
- `src/services/nedService.ts` (line 26)
- `src/components/ned/NedChat.tsx` (line 24 - TOOL_DESCRIPTIONS only)

**Action**:
1. Move `TOOL_DESCRIPTIONS` to `nedToolsZod.ts`
2. Delete `nedTools.ts`

---

## ♻️ Code That Could Be Simplified with Baleybots

### 4. **Context Agent** (~390 lines → ~100 lines estimated)
**File**: `src/services/contextAgent.ts`

**Current approach**:
- Manual Claude Haiku API calls via Tauri
- Manual thread management (Map of threads)
- Manual message history tracking
- Manual system prompt building

**Could use baleybots**:
```typescript
import { useChat } from '@baleybots/react';

// Thread-based conversations with automatic history
const { messages, sendMessage } = useChat({
  apiKey,
  systemPrompt: buildSystemPrompt(),
  model: 'claude-3-5-haiku-20241022',
  // No tools needed - just search
});
```

**Benefits**:
- Automatic message history
- No manual thread management
- Simpler API
- ~290 lines saved

**Trade-off**: 
- Currently uses Tauri backend for API calls (might want to keep that for security)
- Uses prompt caching for efficiency (baleybots supports this)

---

### 5. **Sessions Query Agent** (~416 lines → ~120 lines estimated)
**File**: `src/services/sessionsQueryAgent.ts`

**Current approach**:
- Manual Claude Haiku API calls via Tauri
- Manual thread management
- Manual message history
- Custom response parsing

**Could use baleybots**:
```typescript
const { messages, sendMessage } = useChat({
  apiKey,
  systemPrompt: buildSystemPrompt(),
  model: 'claude-3-5-haiku-20241022',
});
```

**Benefits**:
- Automatic thread management
- Simpler code
- ~296 lines saved

---

### 6. **Sessions Agent Service** (~926 lines → ~200 lines estimated)
**File**: `src/services/sessionsAgentService.ts`

**Current approach**:
- Complex streaming with Tauri events
- Manual tool calling
- Custom message management

**Could use baleybots**:
```typescript
const { messages, sendMessage } = useChat({
  apiKey,
  systemPrompt: buildSystemPrompt(),
  model: 'claude-3-5-haiku-20241022',
  tools: sessionAnalysisTools,
});
```

**Benefits**:
- Native streaming support
- Native tool calling
- ~726 lines saved

---

## 📊 Total Potential Savings

| File | Current Lines | After Cleanup | Savings |
|------|---------------|---------------|---------|
| **Immediate Removal** | | | |
| `NedChat.tsx` | 813 | 0 | **-813** ✅ |
| `nedService.ts` | 804 | ~50 (API key only) | **-754** ✅ |
| `nedTools.ts` | 435 | 0 (merge to Zod) | **-435** ✅ |
| **Future Simplification** | | | |
| `contextAgent.ts` | 390 | ~100 | **-290** 🔄 |
| `sessionsQueryAgent.ts` | 416 | ~120 | **-296** 🔄 |
| `sessionsAgentService.ts` | 926 | ~200 | **-726** 🔄 |
| **TOTAL** | **3,784** | **470** | **-3,314 (-87%)** 🎉 |

---

## 🎯 Recommended Cleanup Order

### Phase 1: Remove Old Ned Code (Immediate - ~2,002 lines)

1. **Update AssistantZone.tsx to use NedChatSimplified**
```typescript
import { NedChatSimplified as NedChat } from './ned/NedChatSimplified';
```

2. **Delete NedChat.tsx** (813 lines)

3. **Slim down nedService.ts** (804 → 50 lines)
   - Keep only API key management
   - Move to `useTauriApiKey` hook or new `apiKeyService.ts`
   - Delete all streaming/conversation code

4. **Merge nedTools.ts into nedToolsZod.ts** (435 lines)
   - Move `TOOL_DESCRIPTIONS` constant
   - Update imports in NedChatSimplified
   - Delete nedTools.ts

**Result**: -2,002 lines, cleaner codebase ✅

---

### Phase 2: Simplify Context & Session Agents (Future - ~1,312 lines)

**Only do this if**:
- You want to standardize all AI interactions on baleybots
- You're comfortable with baleybots API stability
- You want to reduce custom code

**Benefits**:
- Single framework for all AI interactions
- Less custom streaming code
- Better type safety
- Easier maintenance

**Trade-offs**:
- Might lose some Tauri-specific optimizations
- Need to ensure prompt caching still works
- Migration effort required

---

## 🚀 Quick Start: Phase 1 Implementation

### Step 1: Update AssistantZone.tsx
```typescript
// File: src/components/AssistantZone.tsx
import React from 'react';
import { NedChatSimplified as NedChat } from './ned/NedChatSimplified';
import { BACKGROUND_GRADIENT } from '../design-system/theme';

export default function AssistantZone() {
  return (
    <div className={`h-full w-full ${BACKGROUND_GRADIENT.primary} overflow-hidden`}>
      <div className="h-full pt-20">
        <div className="h-full max-w-6xl mx-auto">
          <NedChat />
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Move TOOL_DESCRIPTIONS to nedToolsZod.ts
```typescript
// Add to src/services/nedToolsZod.ts
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  create_task: 'Create new tasks in your todo list',
  update_task: 'Modify existing tasks',
  complete_task: 'Mark tasks as completed',
  delete_task: 'Remove tasks from your todo list',
  create_note: 'Create new notes',
  update_note: 'Modify existing notes',
  delete_note: 'Remove notes',
  record_memory: 'Save information about your preferences and habits',
};
```

### Step 3: Delete Old Files
```bash
rm src/components/ned/NedChat.tsx
rm src/services/nedTools.ts
rm src/services/nedService.ts  # After moving API key logic
```

### Step 4: Update Imports
Search and replace across codebase:
- `nedTools` → `nedToolsZod`
- `NedChat` imports → `NedChatSimplified as NedChat`

---

## 🧪 Testing Checklist

Before deleting old code, verify:

- [ ] NedChatSimplified works in NedOverlay
- [ ] NedChatSimplified works in AssistantZone
- [ ] All tools execute correctly
- [ ] Permission dialogs work
- [ ] Streaming responses work
- [ ] Error handling works
- [ ] Clear conversation works
- [ ] API key management works

---

## 💡 Additional Opportunities

### 1. **Unify Tool Executor**
Currently `NedToolExecutor` is used by both old and new systems. After removing old code, can simplify it further.

### 2. **Consider: Inline Context Agent as Baleybots Tool**
Instead of a separate service, make Context Agent a baleybots tool that Ned calls:

```typescript
const contextAgentTool = {
  name: 'context_agent',
  description: '...',
  schema: z.object({ query: z.string() }),
  function: async ({ query }) => {
    // Use baleybots internally for agent
    const agent = createChat({...});
    return await agent.send(query);
  },
};
```

This would be a **meta-AI** pattern: AI using AI tools! 🤯

---

## 📝 Notes

- The old `nedService.ts` has valuable comments about the architecture - consider preserving in docs
- Tool executor logic is still needed - just the streaming layer is removed
- Permission system remains the same - just integrated with baleybots
- Memory system (`nedMemory.ts`) is still relevant and used

---

## 🎉 Summary

**Immediate gains** (Phase 1):
- ✅ Remove 2,002 lines of legacy code
- ✅ Single source of truth for tool definitions
- ✅ Cleaner, more maintainable codebase
- ✅ No loss of functionality

**Future potential** (Phase 2):
- 🔄 Remove additional 1,312 lines
- 🔄 Unify all AI interactions on baleybots
- 🔄 Reduce custom streaming code by 87%
- 🔄 Improve type safety across the board

**Total potential**: **-3,314 lines (-87%)** with baleybots! 🚀

