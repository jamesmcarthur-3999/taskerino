# Ned AI Assistant - Implementation Plan

## Overview
Ned is the AI assistant for Taskerino, powered by Claude Sonnet. Users interact only with Ned, who uses a hidden Context Agent (Claude Haiku) for information retrieval.

## Architecture

```
User ↔ Ned (Sonnet) ↔ Context Agent (Haiku)
                    ↔ Tool Layer
                    ↔ Memory System
```

### Core Principles
1. **User sees only Ned** - Context Agent works invisibly in background
2. **Multi-turn agent conversations** - Ned and Agent can have back-and-forth discussions
3. **Rich interactive UI** - Tasks and notes displayed as interactive cards with IDs
4. **Per-tool permissions** - Granular control (e.g., allow create_task but not update_task)
5. **Memory persistence** - Ned remembers user preferences and context across sessions

## Phase 1: Foundation (Current)

### 1.1 Extend claudeService
**File**: `src/services/claudeService.ts`

**Add:**
- Tool calling support (Anthropic's tool use API)
- Streaming responses
- Thread management for conversations
- Error handling and retries

**Tool Call Flow:**
```typescript
1. User message → Ned
2. Ned decides to use tool
3. Tool execution (with permission check)
4. Result back to Ned
5. Ned formats response
6. Stream to user
```

### 1.2 Context Agent Service
**File**: `src/services/contextAgent.ts` (NEW)

**Purpose**: Search and filter notes/tasks using Claude Haiku

**Features:**
- Thread-based conversations (agent remembers context)
- Metadata-aware search (dates, tags, companies, contacts)
- Smart summarization for large result sets
- Returns structured data with IDs

**Example Agent Thread:**
```
Ned: "Find notes about NVIDIA from this year"
Agent: [searches] "Found 47 notes. Topics: earnings (12), GPU (8), partnerships (15)..."
Ned: "Focus on earnings"
Agent: [filters] "Found 12 earnings notes. Here are IDs and summaries..."
```

### 1.3 Ned Service
**File**: `src/services/nedService.ts` (NEW)

**Purpose**: Main conversation engine

**Features:**
- Conversation management (threads, history)
- Tool orchestration (call, execute, respond)
- Agent communication (hidden from user)
- Memory integration
- Permission checking

### 1.4 Tool Schemas
**File**: `src/services/nedTools.ts` (NEW)

**Read Tools (no permission):**
- `query_context_agent` - Search via Context Agent
- `get_current_datetime` - Date/time awareness
- `get_user_context` - Current app state
- `recall_memory` - Get relevant memories

**Write Tools (permission required):**
- `create_task`, `update_task`, `delete_task`, `complete_task`
- `create_note`, `update_note`, `delete_note`
- `add_tag`, `remove_tag`
- `link_items` - Connect notes/tasks
- `record_memory` - Store context

## Phase 2: Memory & Permissions

### 2.1 Memory System
**File**: `src/services/nedMemory.ts` (NEW)

**Storage:** LocalStorage/IndexedDB

**Memory Types:**
```typescript
- user_preference: "User prefers tasks grouped by project"
- interaction_outcome: "User completed 'Review Q4 earnings' on Jan 10"
- context_note: "User preparing NVIDIA partnership proposal, due Jan 17"
```

**Decay System:**
- Recent (0-30 days): score = 1.0
- Medium (30-90 days): score *= 0.5
- Old (90+ days): score *= 0.25
- Pruned when score < 0.1

### 2.2 Permission Management
**File**: `src/services/nedPermissions.ts` (NEW)

**Permission Levels:**
- `forever` - Always allow this tool
- `session` - Allow until app restart
- `always-ask` - Prompt every time

**Storage in User Preferences:**
```typescript
interface NedSettings {
  chattiness: 'concise' | 'balanced' | 'detailed';
  showThinking: boolean;
  permissions: ToolPermission[];
  sessionPermissions: ToolPermission[];
  tokenUsage: {
    total: number;
    thisMonth: number;
    estimatedCost: number;
  };
}
```

## Phase 3: Rich UI Components

### 3.1 Message Components
**File**: `src/components/ned/NedMessage.tsx` (NEW)

**Message Types:**
- Text (markdown)
- Task list (interactive cards)
- Note list (interactive cards)
- Tool execution status
- Permission requests
- Thinking indicator

### 3.2 Interactive Cards
**Files:**
- `src/components/ned/TaskCard.tsx` - Task with actions
- `src/components/ned/NoteCard.tsx` - Note with actions
- `src/components/ned/PermissionDialog.tsx` - First-time approval

### 3.3 AssistantZone Update
**File**: `src/components/AssistantZone.tsx`

**Replace current implementation with:**
- Ned conversation UI
- Message history
- Input with streaming support
- Rich message rendering

## Phase 4: Advanced Features

### 4.1 CMD+F Shortcut
- Quick access overlay from anywhere
- Floating Ned chat

### 4.2 Context-aware suggestions
- Ned suggests relevant actions
- Proactive task extraction

### 4.3 Agent workflows
- Multi-step autonomous agents
- BaileyBots integration (future)

## Implementation Status

### Week 1: Foundation ✅ (COMPLETED)
- [x] Define tool schemas - **src/services/nedTools.ts**
- [x] Build Context Agent service - **src/services/contextAgent.ts**
- [x] Create Ned service - **src/services/nedService.ts**
- [x] Build memory system - **src/services/nedMemory.ts**

**What's Working:**
- Tool definitions for all read/write operations
- Context Agent can search and filter notes/tasks with thread management
- Ned conversation engine with streaming + tool calling
- Memory storage with time decay and relevance scoring

**What's Built:**
```
nedTools.ts         - Tool schemas and types
contextAgent.ts     - Claude Haiku search service
nedService.ts       - Main Ned conversation engine
nedMemory.ts        - Memory persistence system
```

### Week 2: Integration & Execution - **NEXT**
- [ ] Tool executor functions (connect tools to app actions)
- [ ] Permission management UI
- [ ] Ned settings in ProfileZone
- [ ] Connect Context Agent to app state

### Week 3: Rich UI
- [ ] Message components
- [ ] Interactive cards (TaskCard, NoteCard)
- [ ] Permission dialogs
- [ ] Update AssistantZone

### Week 4: Polish
- [ ] Cost optimization
- [ ] Error handling
- [ ] CMD+F integration
- [ ] Performance tuning

## Technical Decisions

### Cost Control
- Context Agent (Haiku): ~$0.25/M input tokens (cheap, chatty)
- Ned (Sonnet): ~$3/M input tokens (expensive, precise)
- Strategy: Agent filters → minimal context to Ned

### Conversation Flow
1. User sends message
2. Ned decides if agent help needed
3. Ned ↔ Agent multi-turn (hidden)
4. Agent returns IDs + summaries
5. Ned formats rich response
6. Stream to user with interactive elements

### Error Recovery
- Tool fails → Ned explains to user
- Agent fails → Ned retries with clearer query
- Permission denied → Ned asks for approval
- Auto-retry (future): When system is stable

## Next Steps
1. Extend `claudeService.ts` with tool calling
2. Create `contextAgent.ts` service
3. Create `nedService.ts` service
4. Define all tools in `nedTools.ts`
5. Build memory system
6. Implement UI components

---
*Last updated: 2025-01-09*
*Current phase: Week 1 - Foundation*
