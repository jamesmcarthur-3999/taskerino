# 🧠 Ned Intelligence & Conversation Design

## 🔴 Critical Problems (Current State)

### Problem 1: No Conversation Memory
**Issue:** Ned doesn't remember what was just discussed

**Example:**
```
User: "Show me tasks about NVIDIA"
Ned: [searches, shows 5 tasks]

User: "What about the high priority ones?"
Ned: [searches AGAIN, returns different 5 tasks, doesn't filter previous results]
```

**Why This Happens:**
- Context Agent is called fresh each time
- Previous results are not stored anywhere accessible to Ned
- Ned has no way to reference "the tasks I just showed you"
- Claude's conversation context doesn't include the actual task data

---

### Problem 2: Context Agent Has No Memory
**Issue:** Each search is independent and stateless

**What We Have:**
- `agent_thread_id` parameter (unused properly)
- Haiku searches notes/tasks fresh each time
- No understanding of "refine previous search"

**What We Need:**
- Agent threads that remember previous queries
- Ability to filter/refine without re-searching
- Metadata about why results were chosen

---

### Problem 3: Ned Doesn't Interpret Results
**Issue:** Ned just dumps whatever the agent returns

**Current Flow:**
1. User asks question
2. Ned calls context_agent
3. Agent returns 20 tasks
4. Ned shows all 20
5. User asks follow-up
6. Ned calls context_agent AGAIN
7. Agent returns different 20 tasks
8. User is confused

**What Should Happen:**
1. User asks question
2. Ned searches and STORES results
3. Agent returns 20 tasks
4. Ned filters/sorts based on question
5. Ned shows TOP 5 most relevant
6. User asks follow-up ("high priority ones")
7. Ned FILTERS stored results, no new search
8. Shows filtered subset with explanation

---

### Problem 4: No Result Caching
**Issue:** Same search hits API every time

**Problems:**
- Expensive ($$$)
- Slow
- Inconsistent results
- Can't reference previous results

---

## ✅ Solution Architecture

### 1. Conversation Context System

**Add to NedService:**
```typescript
interface ConversationContext {
  lastSearch: {
    query: string;
    results: {
      tasks: Task[];
      notes: Note[];
    };
    timestamp: string;
    thread_id: string;
  } | null;

  referencedItems: {
    tasks: Set<string>; // IDs of tasks mentioned
    notes: Set<string>; // IDs of notes mentioned
    topics: Set<string>; // Topic IDs
  };
}
```

**Store in conversation:**
- Each conversation maintains its context
- Results from searches are stored
- Ned can reference "the tasks I just showed you"

---

### 2. New Tool: filter_previous_results

**Purpose:** Let Ned filter already-retrieved results instead of re-searching

**Schema:**
```typescript
{
  name: 'filter_previous_results',
  description: 'Filter the tasks/notes from the previous search based on new criteria. Use this instead of searching again when the user asks a follow-up question about the same topic.',
  input_schema: {
    type: 'object',
    properties: {
      filter_type: {
        type: 'string',
        enum: ['priority', 'status', 'due_date', 'tag', 'keyword'],
      },
      filter_value: {
        type: 'string',
        description: 'The value to filter by (e.g., "high", "urgent", "today", "NVIDIA")',
      },
      sort_by: {
        type: 'string',
        enum: ['priority', 'due_date', 'created_date', 'relevance'],
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default: 5)',
      },
    },
    required: ['filter_type', 'filter_value'],
  },
}
```

**When to Use:**
- User asks follow-up about same topic
- User wants to refine/narrow previous results
- User asks about specific subset

---

### 3. Enhanced Context Agent

**Current:**
- Searches all notes/tasks
- Returns top N
- No explanation of ranking

**Enhanced:**
```typescript
interface ContextAgentResult {
  notes: Note[];
  tasks: Task[];
  summary: string;
  suggestions: string[];
  thread_id: string;

  // NEW:
  ranking_explanation: string; // "Ranked by relevance to 'NVIDIA' + recency"
  total_found: number; // "Found 47 tasks, showing top 20"
  filters_applied: string[]; // ["keyword:NVIDIA", "status:active"]
}
```

**Improvements:**
1. Return ranking explanation
2. Return total count
3. Support filter parameters
4. Use thread memory better
5. Consistent ranking algorithm

---

### 4. Smarter System Prompt

**Current Issues:**
- Tells Ned to use tools
- Doesn't explain WHEN to use which tool
- No guidance on follow-ups

**New Prompt Structure:**

```
**Decision Tree for User Queries:**

1. **Is this a follow-up about previous results?**
   - Keywords: "those", "these", "the ones", "from that", "what about"
   - Action: Use filter_previous_results on stored results
   - Example: "What about the high priority ones?" → Filter previous results by priority:high

2. **Is this a NEW search topic?**
   - Different subject/company/keyword than last query
   - Action: Use query_context_agent
   - Store results for future filtering

3. **Is this asking for clarification?**
   - "Which one", "tell me more", "what does that mean"
   - Action: Look at referencedItems, provide details
   - May need to use get_user_context

4. **Is this a write operation?**
   - "Create task", "delete that", "mark as done"
   - Action: Use appropriate write tool
   - Reference referencedItems for "that task"

**Critical Rules:**
- NEVER re-search when filtering would work
- ALWAYS explain what you're doing ("Filtering the NVIDIA tasks for high priority ones...")
- ALWAYS explain if results changed ("Now showing 3 instead of 5 because...")
```

---

### 5. Result Storage in NedChat

**Current:**
- NedChat displays cards
- Cards disappear when scrolled away
- No persistent storage

**New:**
```typescript
const [searchCache, setSearchCache] = useState<{
  [query: string]: {
    tasks: Task[];
    notes: Note[];
    timestamp: number;
  };
}>({});
```

**Benefits:**
- Ned can reference previous searches
- User can scroll back and see consistent results
- Fast filtering without API calls

---

### 6. Memory System Usage

**Current:** Barely used

**New Strategy:**

**Record These Memories:**
1. User preferences for filtering/sorting
   - "User prefers to see urgent tasks first"
   - "User often asks about NVIDIA"

2. Important context
   - "User is focused on Q4 deliverables"
   - "Tasks are usually for Ryan Wilson"

3. Successful interactions
   - "When user says 'those', they mean the last shown tasks"
   - "User prefers compact view for large lists"

**Use These Memories:**
- Personalize search ranking
- Better understand ambiguous queries
- Proactive suggestions

---

## 🔧 Implementation Plan

### Phase 1: Core Intelligence (DO FIRST)
1. **Add ConversationContext to NedService**
   - Store last search results
   - Track referenced items
   - Pass context to tool executor

2. **Create filter_previous_results tool**
   - Implement in NedToolExecutor
   - Add to tool definitions
   - Test with various filters

3. **Update System Prompt**
   - Decision tree for when to use tools
   - Examples of good vs bad decisions
   - Explain follow-up handling

4. **Enhance Tool Results**
   - Return ranking explanation
   - Return total count
   - Include filter metadata

### Phase 2: Context Agent Improvements
1. **Better Thread Usage**
   - Actually use thread_id properly
   - Agent remembers previous queries
   - Agent can refine vs re-search

2. **Ranking Transparency**
   - Explain why results were chosen
   - Show what filters were applied
   - Return confidence scores

3. **Filter Parameters**
   - Accept filter hints in query
   - Apply filters before returning
   - Return metadata about filtering

### Phase 3: Advanced Features
1. **Result Caching**
   - Cache in NedChat component
   - TTL of 5 minutes
   - Invalidate on data changes

2. **Memory Integration**
   - Record user preferences
   - Use memories for personalization
   - Learn from corrections

3. **Proactive Suggestions**
   - "Would you like to see overdue tasks too?"
   - "I noticed these are all from the same company"

---

## 📝 Example Conversations (How It Should Work)

### Example 1: Follow-up Filtering

```
User: "Show me tasks about NVIDIA"

Ned: Let me search for that...
[Calls query_context_agent with "NVIDIA"]
[Agent returns 12 tasks]
[Ned stores results in context]

Ned: "I found 12 tasks about NVIDIA. Most are from Q4 discussions."
[Shows top 5 tasks]

---

User: "What about the high priority ones?"

Ned: [Recognizes follow-up about previous results]
[Calls filter_previous_results with filter_type: "priority", filter_value: "high,urgent"]
[Filters the stored 12 tasks]

Ned: "From those NVIDIA tasks, 3 are high priority:"
[Shows 3 filtered tasks]
```

**Key Points:**
- Second query doesn't call context_agent
- Results are filtered from stored set
- Ned explains the filtering
- Results are consistent

---

### Example 2: Topic Change

```
User: "Show me notes about Pure Storage"

Ned: Let me search for that...
[Calls query_context_agent]

Ned: "I found 5 notes about Pure Storage, mostly from bi-weekly meetings."
[Shows 5 notes]

---

User: "What about Snowflake?"

Ned: [Recognizes NEW topic, not a follow-up]
[Calls query_context_agent with "Snowflake"]

Ned: "Let me search for Snowflake notes... I found 3 notes."
[Shows 3 notes]
```

**Key Points:**
- Topic changed, so new search is appropriate
- Ned explains it's searching
- Previous results are stored (can reference later)

---

### Example 3: Ambiguous Reference

```
User: "Show me tasks for next week"

Ned: [Searches for tasks due next week]
Ned: "I found 8 tasks due next week:"
[Shows tasks]

---

User: "Delete that one"

Ned: [Looks at referencedItems - no single task referenced]

Ned: "Which task would you like to delete? I'm showing 8 tasks. Could you tell me the title or click the delete button on the task?"

---

User: "The Microsoft one"

Ned: [Filters stored results for "Microsoft"]
[Finds 1 task: "Submit Microsoft proposal"]

Ned: "Got it - the 'Submit Microsoft proposal' task. Should I delete it?"
```

**Key Points:**
- Ned asks for clarification when ambiguous
- References stored results to disambiguate
- Confirms before destructive actions

---

## 🎯 Success Metrics

**Ned is "smart" when:**

1. **Follow-ups work naturally**
   - "Show me X" → "What about Y in those?" works correctly
   - No unnecessary re-searching
   - Results are consistent

2. **Ned explains itself**
   - "Filtering the previous results..."
   - "Now searching for..."
   - "I'm showing 3 out of 12 tasks because..."

3. **Ambiguity is handled**
   - Asks for clarification when needed
   - Uses context to disambiguate
   - References previous results

4. **Searches are efficient**
   - Only searches when needed
   - Filters when possible
   - Results are cached

5. **Memory is useful**
   - Learns user preferences
   - Personalizes results
   - Proactive suggestions

---

## 🚀 Quick Wins (Start Here)

1. **Store last search results in ConversationContext** ✅
2. **Add filter_previous_results tool** ✅
3. **Update system prompt with decision tree** ✅
4. **Test follow-up conversations** ✅
5. **Add ranking explanations to context agent** ✅

---

*Plan created: 2025-01-10*
*Priority: CRITICAL - Core functionality before UI polish*
