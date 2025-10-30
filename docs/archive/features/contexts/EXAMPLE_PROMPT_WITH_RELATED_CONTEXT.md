# Example: buildFlexibleSummaryPrompt with Related Context

This document shows what the AI prompt looks like when `context.relatedContext` is provided with existing tasks and notes.

## Sample Input Data

```typescript
const context = {
  relatedContext: {
    tasks: [
      {
        id: "task_abc123",
        title: "Implement OAuth authentication flow",
        status: "in-progress",
        priority: "high",
        dueDate: "2025-10-25",
        description: "Build complete OAuth 2.0 flow with refresh tokens and error handling",
        tags: ["auth", "backend", "security"],
        sourceSessionId: "session_xyz789"
      },
      {
        id: "task_def456",
        title: "Write comprehensive auth tests",
        status: "todo",
        priority: "medium",
        description: "Unit and integration tests for authentication system",
        tags: ["testing", "auth"]
      }
    ],
    notes: [
      {
        id: "note_ghi789",
        summary: "Research on OAuth 2.0 libraries and best practices",
        content: "Compared Passport.js, Auth0, and NextAuth. NextAuth seems best for our use case due to TypeScript support and simplified configuration. Key considerations: token refresh, session management, and social providers.",
        tags: ["research", "auth", "oauth"],
        timestamp: "2025-10-18T10:30:00Z",
        sourceSessionId: "session_research_001"
      }
    ]
  },
  videoChapters: [],
  audioInsights: null
};
```

## Generated Prompt Section

When the above context is provided, the prompt will include this section between the screenshot timeline and the analysis process:

```
**Enrichment Data:**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXISTING RELATED WORK (Context-Aware Intelligence)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**IMPORTANT:** The following 2 tasks and 1 notes
already exist in the system and are potentially related to this session's work:


**EXISTING TASKS (2):**

1. [ID: task_abc123] Implement OAuth authentication flow
   Status: in-progress | Priority: high | Due: 10/25/2025
   Description: Build complete OAuth 2.0 flow with refresh tokens and error handling
   Tags: auth, backend, security
   (From session session_xyz789)

2. [ID: task_def456] Write comprehensive auth tests
   Status: todo | Priority: medium
   Description: Unit and integration tests for authentication system
   Tags: testing, auth
   (Standalone task)



**EXISTING NOTES (1):**

1. [ID: note_ghi789] Research on OAuth 2.0 libraries and best practices...
   Tags: research, auth, oauth | Created: 10/18/2025
   Content: Compared Passport.js, Auth0, and NextAuth. NextAuth seems best for our use case due to TypeScript support and simplified configuration. Key considerations: token refresh, session management, and social providers....
   (From session session_research_001)


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

```

## Updated Section Types List

The available section types now includes:

```
15. **task-breakdown** - Subtask breakdown (use for complex implementation sessions)
16. **related-context** - Links to existing tasks/notes (use when related work exists)
    - Include: relatedTasks (with relevance explanation), relatedNotes (with relevance)
    - Include: duplicatePrevention (tasks you almost suggested but found existing)
    - ONLY use if you found DIRECTLY relevant existing items above
    - If no related items exist, skip this section entirely
```

## Expected AI Response Example

Given a session working on OAuth implementation, the AI should generate:

```json
{
  "schemaVersion": "2.0",
  "narrative": "Spent 2 hours implementing the OAuth callback handler and token refresh logic. Built upon previous research (note_ghi789) to integrate NextAuth.js. Successfully implemented the authorization flow but encountered issues with token persistence. This session advanced the in-progress OAuth task (task_abc123) significantly.",
  "sessionType": "deep-work",
  "primaryTheme": "OAuth authentication implementation",
  "emphasis": "achievement-focused",
  "reasoning": "Chose achievements to highlight progress, related-context to link existing work, and blockers to capture token persistence issues. Avoided suggesting duplicate testing tasks since task_def456 already exists.",
  "confidence": 0.92,
  "sections": [
    {
      "type": "achievements",
      "title": "Implementation Progress",
      "emphasis": "high",
      "position": 1,
      "icon": "trophy",
      "colorTheme": "success",
      "data": {
        "achievements": [
          {
            "title": "Implemented OAuth callback handler",
            "timestamp": "2025-10-20T14:30:00Z",
            "screenshotIds": ["ss_3", "ss_4"],
            "impact": "major"
          },
          {
            "title": "Built token refresh mechanism",
            "timestamp": "2025-10-20T15:15:00Z",
            "screenshotIds": ["ss_7"],
            "impact": "major"
          }
        ],
        "summary": "Major progress on OAuth implementation"
      }
    },
    {
      "type": "related-context",
      "title": "Connected Work",
      "emphasis": "medium",
      "position": 2,
      "icon": "link",
      "colorTheme": "info",
      "data": {
        "relatedTasks": [
          {
            "taskId": "task_abc123",
            "taskTitle": "Implement OAuth authentication flow",
            "relevance": "This session directly worked on implementing the callback and token refresh portions of this task",
            "relationship": "worked-on"
          }
        ],
        "relatedNotes": [
          {
            "noteId": "note_ghi789",
            "noteSummary": "Research on OAuth 2.0 libraries and best practices",
            "relevance": "Used this research to guide NextAuth.js integration decisions",
            "relationship": "built-upon"
          }
        ],
        "duplicatePrevention": [
          {
            "almostSuggested": "Write tests for OAuth flow",
            "existingTask": "Write comprehensive auth tests (task_def456)",
            "reasoning": "Testing task already exists with comprehensive scope"
          },
          {
            "almostSuggested": "Research OAuth libraries",
            "existingTask": "Research already completed in note_ghi789",
            "reasoning": "Research phase complete, no need to duplicate"
          }
        ]
      }
    },
    {
      "type": "blockers",
      "title": "Challenges",
      "emphasis": "medium",
      "position": 3,
      "icon": "alert-circle",
      "colorTheme": "warning",
      "data": {
        "blockers": [
          {
            "title": "Token persistence failing in development environment",
            "timestamp": "2025-10-20T15:45:00Z",
            "screenshotIds": ["ss_9", "ss_10"],
            "severity": "medium",
            "status": "unresolved"
          }
        ],
        "summary": "One technical blocker needs resolution"
      }
    },
    {
      "type": "recommended-tasks",
      "title": "Next Steps",
      "emphasis": "low",
      "position": 4,
      "icon": "check-square",
      "colorTheme": "neutral",
      "data": {
        "tasks": [
          {
            "title": "Debug token persistence in development",
            "priority": "high",
            "description": "Investigate why tokens aren't persisting between requests in dev mode",
            "estimatedTime": "1-2 hours"
          },
          {
            "title": "Add OAuth state validation",
            "priority": "medium",
            "description": "Implement CSRF protection using state parameter",
            "estimatedTime": "30 minutes"
          }
        ],
        "summary": "2 new tasks identified - both complement existing work without duplication"
      }
    }
  ]
}
```

## Key Benefits

1. **Duplicate Prevention**: AI sees `task_def456` exists for testing, so doesn't suggest "Write OAuth tests"
2. **Intelligent Linking**: AI links to `task_abc123` as "worked-on" to show session progress
3. **Context Awareness**: AI references `note_ghi789` to show research was used
4. **Transparency**: `duplicatePrevention` field shows AI considered duplicates and avoided them
5. **Gap Filling**: New tasks focus on NEW work (debugging, state validation) not covered by existing items

## Without Related Context

If `context.relatedContext` is not provided, the entire "EXISTING RELATED WORK" section is omitted, and the AI works as before - suggesting tasks without checking for duplicates.
