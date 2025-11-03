# Changes Summary: Related Tasks/Notes Context Integration

## Overview

Enhanced `buildFlexibleSummaryPrompt()` in `/Users/jamesmcarthur/Documents/taskerino/src/utils/sessionSynthesis.ts` to include existing related tasks and notes context, enabling AI to avoid duplicates and suggest intelligent links.

## Files Modified

### 1. `/Users/jamesmcarthur/Documents/taskerino/src/utils/sessionSynthesis.ts`

**Function Modified**: `buildFlexibleSummaryPrompt()` (lines 494-657)

## Changes Made

### 1. Added Related Items Section (Lines 549-606)

**Location**: After `audioInsightsSection`, before the main prompt return statement

```typescript
// Build related items section
const relatedItemsSection = context?.relatedContext ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXISTING RELATED WORK (Context-Aware Intelligence)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**IMPORTANT:** The following ${context.relatedContext.tasks.length} tasks and ${context.relatedContext.notes.length} notes
already exist in the system and are potentially related to this session's work:

${context.relatedContext.tasks.length > 0 ? `
**EXISTING TASKS (${context.relatedContext.tasks.length}):**
${context.relatedContext.tasks.map((t: any, idx: number) => `
${idx + 1}. [ID: ${t.id}] ${t.title}
   Status: ${t.status} | Priority: ${t.priority}${t.dueDate ? ` | Due: ${new Date(t.dueDate).toLocaleDateString()}` : ''}
   ${t.description ? `Description: ${t.description.substring(0, 200)}...` : 'No description'}
   ${t.tags?.length ? `Tags: ${t.tags.join(', ')}` : ''}
   ${t.sourceSessionId ? `(From session ${t.sourceSessionId})` : '(Standalone task)'}
`).join('\n')}
` : 'No related tasks found.'}

${context.relatedContext.notes.length > 0 ? `
**EXISTING NOTES (${context.relatedContext.notes.length}):**
${context.relatedContext.notes.map((n: any, idx: number) => `
${idx + 1}. [ID: ${n.id}] ${n.summary.substring(0, 150)}...
   Tags: ${n.tags.join(', ')} | Created: ${new Date(n.timestamp).toLocaleDateString()}
   Content: ${n.content.substring(0, 250).replace(/\n/g, ' ')}...
   ${n.sourceSessionId ? `(From session ${n.sourceSessionId})` : '(Standalone note)'}
`).join('\n')}
` : 'No related notes found.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL CONTEXT-AWARE INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **USE THE related-context SECTION TYPE**:
   - If you found tasks/notes above that are DIRECTLY relevant to this session's work, include a "related-context" section
   - Explain HOW each task/note relates to this session
   - Only include items with clear, direct connections (not vague similarities)

2. **AVOID DUPLICATE RECOMMENDATIONS**:
   - DO NOT suggest tasks in next-steps that duplicate existing tasks above
   - If work is already captured in an existing task, reference it instead of creating a new one
   - Use duplicatePrevention field to show what you almost suggested but found existing

3. **INTELLIGENT LINKING**:
   - If this session worked on an in-progress task, link it in related-context
   - If this session referenced a note for context/research, link it
   - If this session completed an existing task, mark it in achievements and link it

4. **FILL GENUINE GAPS**:
   - Only recommend NEW tasks in next-steps for:
     * Follow-up work not yet captured in any existing task
     * Newly discovered requirements
     * Complementary work (tests, documentation, etc.)
   - Be conservative - fewer, high-quality suggestions are better than many duplicates

` : '';
```

**Features**:
- Conditionally renders only if `context.relatedContext` exists
- Displays existing tasks with ID, title, status, priority, due date, description, tags, and source session
- Displays existing notes with ID, summary, tags, creation date, content preview, and source session
- Provides clear instructions for AI on how to use this information
- Emphasizes duplicate prevention and intelligent linking

### 2. Updated Prompt Template (Line 631)

**Before**:
```typescript
}).join('\n\n')}${videoChaptersSection}${audioInsightsSection}
```

**After**:
```typescript
}).join('\n\n')}

**Enrichment Data:**
${videoChaptersSection}${audioInsightsSection}${relatedItemsSection}
```

**Change**: Restructured to group all enrichment data (video chapters, audio insights, related context) under a clear "Enrichment Data" heading.

### 3. Added Related-Context Section Type (Lines 663-667)

Added to the "Available Section Types" list:

```
15. **task-breakdown** - Subtask breakdown (use for complex implementation sessions)
16. **related-context** - Links to existing tasks/notes (use when related work exists)
    - Include: relatedTasks (with relevance explanation), relatedNotes (with relevance)
    - Include: duplicatePrevention (tasks you almost suggested but found existing)
    - ONLY use if you found DIRECTLY relevant existing items above
    - If no related items exist, skip this section entirely
```

### 4. Enhanced Selection Guidelines (Lines 669-678)

**Before**:
```typescript
**Selection Guidelines:**
- Choose 2-5 sections that BEST represent this session
- Don't force every session into the same template
- Emphasize what makes THIS session unique
- Use "emphasis: high" for the most important aspect
- Provide reasoning for your choices
```

**After**:
```typescript
**Important Section Selection Guidelines:**
- Choose 2-5 sections that BEST represent this session
- Don't force every session into the same template
- Emphasize what makes THIS session unique
- Use "emphasis: high" for the most important aspect
- Provide reasoning for your choices
- **CRITICAL**: If related tasks/notes exist, ALWAYS check them before suggesting new tasks
  * Use related-context section to link to existing relevant work
  * In recommended-tasks section, only suggest tasks NOT already covered by existing items
  * Show duplicate prevention reasoning to demonstrate you checked for overlaps
```

### 5. Added Related-Context Example to Output Format (Lines 720-752)

Added example section to the JSON output format showing proper structure:

```json
{
  "type": "related-context",
  "title": "Related Work",
  "emphasis": "medium",
  "position": 2,
  "icon": "link",
  "colorTheme": "info",
  "data": {
    "relatedTasks": [
      {
        "taskId": "task_123",
        "taskTitle": "Implement authentication system",
        "relevance": "This session worked on the OAuth flow, which is part of this larger task",
        "relationship": "worked-on|completed|referenced|blocked-by"
      }
    ],
    "relatedNotes": [
      {
        "noteId": "note_456",
        "noteSummary": "Research on OAuth libraries",
        "relevance": "Referenced this research during implementation",
        "relationship": "referenced|built-upon|updated"
      }
    ],
    "duplicatePrevention": [
      {
        "almostSuggested": "Write tests for OAuth flow",
        "existingTask": "Write comprehensive auth tests",
        "reasoning": "Almost suggested test task, but found existing task already covers this"
      }
    ]
  }
}
```

## Line-by-Line Change Summary

| Line Range | Change Description |
|------------|-------------------|
| 549-606 | Added `relatedItemsSection` constant with conditional rendering logic |
| 630-631 | Added "Enrichment Data" header and injected `relatedItemsSection` |
| 663-667 | Added `related-context` section type to available sections list |
| 669-678 | Enhanced selection guidelines with duplicate prevention emphasis |
| 720-752 | Added related-context example to JSON output format |

## Data Flow

1. **Input**: `context.relatedContext` object with `tasks` and `notes` arrays
2. **Processing**: Template literal builds formatted section if data exists
3. **Output**: Enhanced prompt with related work visibility for AI
4. **AI Response**: Returns sections including `related-context` type with links and duplicate prevention

## Expected Input Structure

```typescript
context: {
  relatedContext?: {
    tasks: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      dueDate?: string;
      description?: string;
      tags?: string[];
      sourceSessionId?: string;
    }>;
    notes: Array<{
      id: string;
      summary: string;
      content: string;
      tags: string[];
      timestamp: string;
      sourceSessionId?: string;
    }>;
  };
  // ... other context fields
}
```

## Expected AI Output Structure

```typescript
{
  sections: [
    // ... other sections
    {
      type: "related-context",
      title: string,
      emphasis: "low" | "medium" | "high",
      position: number,
      icon: string,
      colorTheme: string,
      data: {
        relatedTasks: Array<{
          taskId: string;
          taskTitle: string;
          relevance: string;
          relationship: "worked-on" | "completed" | "referenced" | "blocked-by";
        }>;
        relatedNotes: Array<{
          noteId: string;
          noteSummary: string;
          relevance: string;
          relationship: "referenced" | "built-upon" | "updated";
        }>;
        duplicatePrevention: Array<{
          almostSuggested: string;
          existingTask: string;
          reasoning: string;
        }>;
      }
    }
  ]
}
```

## Testing Checklist

- [x] TypeScript compilation passes (no errors in sessionSynthesis.ts)
- [ ] Test with empty `relatedContext` (section should not appear)
- [ ] Test with tasks but no notes
- [ ] Test with notes but no tasks
- [ ] Test with both tasks and notes
- [ ] Verify AI response includes `related-context` section
- [ ] Verify AI avoids duplicate task suggestions
- [ ] Verify `duplicatePrevention` field is populated
- [ ] Verify related items are properly linked

## Code Quality Verification

✅ **Follows existing prompt formatting style**
✅ **Uses existing template literal patterns**
✅ **Maintains professional tone**
✅ **Clear, actionable instructions**
✅ **Conditional rendering (only shows if relatedContext exists)**
✅ **Proper null/undefined handling** (`context?.relatedContext`)
✅ **TypeScript compilation successful**

## Example Files

- Full example with sample data: `/Users/jamesmcarthur/Documents/taskerino/EXAMPLE_PROMPT_WITH_RELATED_CONTEXT.md`
- This summary document: `/Users/jamesmcarthur/Documents/taskerino/CHANGES_SUMMARY_RELATED_CONTEXT.md`

## Next Steps

1. **Backend Integration**: Implement logic in `sessionEnrichmentService.ts` to populate `context.relatedContext` with relevant tasks/notes
2. **Frontend Rendering**: Create `RelatedContextSectionRenderer` component to display the related-context section
3. **Testing**: Add unit tests for the prompt generation with various related context scenarios
4. **User Testing**: Validate that duplicate prevention works in real sessions
