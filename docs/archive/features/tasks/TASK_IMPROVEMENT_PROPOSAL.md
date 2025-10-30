# Task Generation Improvement Proposal

## Current Issues (Based on User Test)

**Test Input:**
```
I need to follow up with NVIDIA on the allocated contract cost, and Microsoft 365 connector updates.
They also mentioned an issue with their Google connector in Productiv. Seems like we're investigating.
Need to provide an update via email my EOD tomorrow.
```

**Current Output:**
- ✅ 3 tasks correctly identified
- ❌ NO due dates
- ❌ NO descriptions
- ❌ NO source links
- ❌ Time context ignored ("EOD tomorrow")

## Root Causes

### 1. **Insufficient Date/Time Context**
- Currently passing: `2025-10-08` (just date)
- Need to pass: `2025-10-08T14:30:00` (date + time)
- AI can't infer "EOD tomorrow" without knowing current time
- Need explicit timezone and business hours context

### 2. **Prompt Not Explicit Enough**
- Prompt says "extract temporal context" but doesn't emphasize REQUIRED fields
- No examples showing what good task extraction looks like
- Missing emphasis on "EVERY task MUST have description"

### 3. **No Source Linking**
- Tasks not linked back to source note
- Critical for future agent capabilities
- Agent needs full context to execute task

### 4. **Missing Business Context**
- No understanding of "EOD" (End of Day)
- No concept of business hours (9am-6pm)
- No timezone awareness

---

## Proposed Solution

### Phase 1: Enhanced Date/Time Context (Immediate)

**1. Pass Rich Temporal Context**
```typescript
const now = new Date();
const temporalContext = {
  currentDateTime: now.toISOString(),
  currentDate: now.toISOString().split('T')[0],
  currentTime: now.toLocaleTimeString('en-US', { hour12: false }),
  dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  businessHours: '9:00 AM - 6:00 PM',
  endOfDay: '6:00 PM', // for "EOD" references
};
```

Add to prompt:
```
**TEMPORAL CONTEXT:**
Current Date & Time: Wednesday, October 8, 2025 at 2:30 PM EST
Timezone: America/New_York
Business Hours: 9:00 AM - 6:00 PM
End of Day (EOD): 6:00 PM today

**Date Inference Examples:**
- "EOD today" → 2025-10-08 (6:00 PM)
- "EOD tomorrow" → 2025-10-09 (6:00 PM)
- "by end of week" → 2025-10-11 (Friday 6:00 PM)
- "next Monday" → 2025-10-14 (9:00 AM)
- "in 2 weeks" → 2025-10-22
```

**2. Mandatory Task Fields**
Update JSON schema to make description REQUIRED:

```json
{
  "tasks": [
    {
      "title": "Follow up with NVIDIA on allocated contract cost",
      "priority": "high",
      "dueDate": "2025-10-09",  // REQUIRED if temporal context exists
      "dueTime": "18:00",        // NEW: specific time (24h format)
      "dueDateReasoning": "User said 'EOD tomorrow' which is 6PM on Oct 9th",
      "description": "NVIDIA mentioned contract cost allocation needs follow-up. Related to M365 connector updates discussion.", // REQUIRED
      "sourceNoteId": "note-abc123",  // NEW: Link back to source
      "sourceExcerpt": "I need to follow up with NVIDIA on the allocated contract cost...", // NEW: Exact quote
      "tags": ["nvidia", "contract", "follow-up"],
      "suggestedSubtasks": [
        "Review current contract allocation with finance",
        "Prepare cost breakdown document",
        "Schedule call with NVIDIA team"
      ],
      "relatedTo": "NVIDIA",
      "contextForAgent": "This task originated from a conversation about NVIDIA contract costs and connector updates. The user needs to follow up by end of business tomorrow (6PM). This is time-sensitive." // NEW: For future agents
    }
  ]
}
```

**3. Add Task Extraction Examples**
Add to prompt:
```
**TASK EXTRACTION EXAMPLES:**

Input: "Need to send proposal to Acme Corp by Friday"
Output:
{
  "title": "Send proposal to Acme Corp",
  "dueDate": "2025-10-11",
  "dueTime": "17:00",
  "dueDateReasoning": "User specified 'by Friday', current day is Wednesday Oct 8",
  "description": "User needs to send proposal to Acme Corp. Time-sensitive deadline.",
  "sourceExcerpt": "Need to send proposal to Acme Corp by Friday"
}

Input: "Follow up with Sarah about the pricing discussion"
Output:
{
  "title": "Follow up with Sarah about pricing discussion",
  "dueDate": null,
  "dueDateReasoning": "No temporal context provided",
  "description": "Follow up with Sarah regarding pricing discussion from previous conversation.",
  "sourceExcerpt": "Follow up with Sarah about the pricing discussion"
}
```

---

### Phase 2: Enhanced Source Linking (Next)

**1. Add Source Context to Tasks**
When creating tasks from a note:
- Store the note ID
- Store excerpt from note (exact text that triggered task)
- Store full note context for agent use

**2. Update Task Type**
```typescript
export interface Task {
  // ... existing fields

  // NEW: Source tracking
  sourceNoteId?: string;
  sourceExcerpt?: string;      // The exact text that triggered this task
  fullContext?: string;         // Full note content for context

  // NEW: Agent context
  contextForAgent?: string;     // AI-generated summary for future agents
  estimatedComplexity?: 'simple' | 'moderate' | 'complex';
  requiresHumanApproval?: boolean;
}
```

---

### Phase 3: Agent-Ready Tasks (Future)

**1. Task Complexity Analysis**
AI should assess:
- Can this be automated? (e.g., "Send email" = potentially yes, "Review contract" = no)
- What information is needed? (e.g., email address, contract document)
- What systems are involved? (e.g., Gmail, Slack, CRM)

**2. Task Decomposition**
For complex tasks, AI should:
- Break into atomic subtasks
- Identify dependencies
- Suggest execution order

Example:
```json
{
  "title": "Send proposal to Acme Corp by Friday",
  "subtasks": [
    {
      "title": "Gather Q3 pricing data",
      "estimatedTime": "30 minutes",
      "canAutomate": false,
      "requiredInfo": ["Access to financial dashboard"]
    },
    {
      "title": "Generate proposal PDF",
      "estimatedTime": "10 minutes",
      "canAutomate": true,
      "requiredInfo": ["Pricing data", "Proposal template"]
    },
    {
      "title": "Send email to Sarah@acme.com",
      "estimatedTime": "5 minutes",
      "canAutomate": true,
      "requiredInfo": ["Proposal PDF", "Email address"],
      "agentAction": "draft_email",
      "agentInstructions": "Draft professional email to Sarah at Acme Corp with proposal attached"
    }
  ]
}
```

---

## Implementation Plan

### Step 1: Fix Immediate Issues (30 min)
- [ ] Add rich temporal context to claudeService
- [ ] Make task description REQUIRED in prompt
- [ ] Add task extraction examples to prompt
- [ ] Add sourceNoteId tracking

### Step 2: Test & Validate (15 min)
- [ ] Test with user's example input
- [ ] Verify all 3 tasks get due dates
- [ ] Verify descriptions are populated
- [ ] Verify source linking works

### Step 3: Enhance ResultsReview (45 min)
- [ ] Make notes editable
- [ ] Add "Save Changes" button
- [ ] Add "Reprocess with AI" button
- [ ] Show source excerpts in task cards
- [ ] Add task complexity indicators

### Step 4: Future Agent Prep (Later)
- [ ] Add contextForAgent field
- [ ] Add task decomposition
- [ ] Add automation flags
- [ ] Design agent execution UI

---

## Expected Outcome

**After Fix - Same Test Input:**
```
Input: "I need to follow up with NVIDIA on the allocated contract cost, and Microsoft 365
connector updates. They also mentioned an issue with their Google connector in Productiv.
Seems like we're investigating. Need to provide an update via email my EOD tomorrow."
```

**Expected Tasks:**
```
✅ Task 1: Follow up with NVIDIA on allocated contract cost
   📅 Due: Oct 9, 2025 @ 6:00 PM
   📝 Description: NVIDIA contract cost allocation needs follow-up per discussion
   🔗 Source: "I need to follow up with NVIDIA on the allocated contract cost..."

✅ Task 2: Follow up with NVIDIA on Microsoft 365 connector updates
   📅 Due: Oct 9, 2025 @ 6:00 PM
   📝 Description: Follow up required on M365 connector updates discussed with NVIDIA
   🔗 Source: "Microsoft 365 connector updates"

✅ Task 3: Provide update via email on Google connector issue
   📅 Due: Oct 9, 2025 @ 6:00 PM (EOD tomorrow)
   📝 Description: Send email update about Google connector issue in Productiv (investigation ongoing)
   🔗 Source: "Need to provide an update via email my EOD tomorrow"
   🏷️ Tags: nvidia, email, productiv, connector
   📋 Subtasks:
      - Review current investigation status
      - Draft update email
      - Send to stakeholders
```

---

## Priority Order

1. **IMMEDIATE** (Step 1-2): Fix date/time context and make descriptions mandatory
2. **HIGH** (Step 3): Make notes editable in ResultsReview
3. **MEDIUM**: Add source linking UI
4. **LOW**: Agent preparation features

This sets up the foundation for future agent capabilities while solving immediate usability issues.
