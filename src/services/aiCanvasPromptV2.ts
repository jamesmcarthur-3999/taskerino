/**
 * AI Canvas Prompt V2 - Best Practices Edition
 *
 * Implements all 10 Anthropic best practices for complex JSON generation:
 * 1. XML tags for structure
 * 2. Prefilling support
 * 3. Few-shot examples
 * 4. Explicit temperature control
 * 5. System prompts for role definition
 * 6. Chain-of-thought with XML
 * 7. Explicit JSON schema
 * 8. Creativity within constraints
 * 9. Appropriate token limits
 * 10. Example-driven validation
 */

import type { EnrichedSessionCharacteristics, SessionSummary, Session } from '../types';
import type { SummarySection, FlexibleSessionSummary, RecommendedTasksSection, RelatedContextSection } from '../types';

/**
 * BEST PRACTICE #5: System prompt for role definition
 */
export function buildCanvasSystemPrompt(): string {
  return `You are an expert UI component architect specializing in generating nested component trees from user session data.

Your expertise includes:
- Analyzing work session data to extract key patterns, achievements, and insights
- Selecting appropriate UI components from a library to best represent session content
- Creating deeply nested JSON structures that balance creativity with strict schema adherence
- Designing action-oriented interfaces that enable quick user workflows

You generate valid, complete, beautiful component trees that tell the session's unique story.

QUALITY EXPECTATIONS:
- Go beyond the basics - include as many relevant features and details as possible
- Create fully-featured, rich layouts that showcase all session content
- Use advanced nesting (Tabs, Accordions, Grids) for comprehensive information architecture
- Never hold back - give each canvas your absolute best effort
- When you use markdown syntax in content, ALWAYS set markdown: true on that component`;
}

/**
 * BEST PRACTICE #1: XML tags for prompt structure
 * BEST PRACTICE #7: Explicit JSON schema definition
 */
function buildComponentSchema(): string {
  return `<component_schema>
## JSON Structure Requirements

You must return a valid JSON object with this EXACT structure:

\`\`\`typescript
{
  "theme": {
    "primary": string,      // Hex color (e.g., "#10b981")
    "secondary": string,    // Hex color (e.g., "#8b5cf6")
    "mood": "energetic" | "calm" | "focused" | "celebratory",
    "explanation": string   // 1-2 sentences explaining color choices
  },
  "metadata": {
    "generatedAt": string,  // ISO timestamp
    "sessionType": string,  // From session characteristics
    "confidence": number    // 0.0-1.0
  },
  "componentTree": {
    "component": ComponentType,
    "props": object,
    "children"?: ComponentTree[]
  }
}
\`\`\`

## Component Types (20 primitives)

### Layout Components
- "Stack": Vertical/horizontal layout
  Props: { direction: "vertical"|"horizontal", spacing: "tight"|"normal"|"relaxed"|"loose", align?: "start"|"center"|"end"|"stretch", wrap?: boolean }

- "Grid": Responsive grid
  Props: { columns: 1-6|"auto-fit", gap: "tight"|"normal"|"relaxed", responsive?: boolean }

- "Card": Container with theme
  Props: { variant?: "flat"|"lifted"|"floating"|"elevated", padding?: "tight"|"normal"|"relaxed"|"loose", theme?: "default"|"success"|"warning"|"danger"|"info"|"purple", header?: ComponentTree, footer?: ComponentTree }

- "Tabs": Tabbed navigation
  Props: { defaultTab: string, orientation?: "horizontal"|"vertical", tabs: Array<{id: string, label: string, icon?: string, badge?: string}> }
  Children: One ComponentTree per tab

- "Accordion": Collapsible sections
  Props: { allowMultiple?: boolean, defaultExpanded?: string[], items: Array<{id: string, title: string, badge?: string}> }
  Children: One ComponentTree per item

### Typography Components
- "Heading": Semantic headings
  Props: { level: 1-6, text: string, icon?: string, badge?: string, emphasis?: "subtle"|"normal"|"strong"|"hero", gradient?: boolean }

- "Text": Body text with optional markdown rendering
  Props: { content: string, size?: "xs"|"sm"|"md"|"lg"|"xl", weight?: "normal"|"medium"|"semibold"|"bold", color?: "primary"|"secondary"|"muted", align?: "left"|"center"|"right", markdown?: boolean }

  ⚠️ IMPORTANT: Set markdown: true whenever content contains markdown syntax (*, **, \` characters)

- "Badge": Status indicator
  Props: { text: string, variant?: "default"|"success"|"warning"|"danger"|"info"|"purple", pulse?: boolean }

- "Separator": Visual divider
  Props: { orientation?: "horizontal"|"vertical", label?: string }

### Data Display Components
- "List": Flexible lists
  Props: { variant: "bulleted"|"numbered"|"checkmark"|"custom", items: Array<{text: string, icon?: string, metadata?: string, subItems?: Array<{text: string}>}> }

- "Timeline": Chronological events
  Props: { orientation?: "vertical"|"horizontal", showTimestamps?: boolean, interactive?: boolean, items: Array<{id: string, timestamp: string, title: string, description: string, theme?: ThemeVariant, screenshotUrl?: string}> }

  ⚠️ Use actual session start/end times for timeline timestamps. If session started at 3:00 PM, events should be around 3:00 PM, not 8:00 AM.

- "Table": Data tables
  Props: { sortable?: boolean, striped?: boolean, hover?: boolean, headers: string[], rows: string[][] }

- "StatCard": Large number display with standardized types
  Props: { value: string, label: string, icon?: string, theme?: ThemeVariant, trend?: {direction: "up"|"down"|"neutral", value: string, label: string}, action?: Action }

  **Standard Stat Types** (use these for consistent reporting):
  • duration (blue theme, ⏱️ icon) - Session time
  • screenshots (purple theme, 📸 icon) - Screenshot count
  • activities (teal theme, ⚡ icon) - Activity count
  • context_switches (orange theme, 🔄 icon) - Focus changes
  • achievements (green theme, ✅ icon) - Wins/completions
  • blockers (red theme, ⚠️ icon) - Issues/obstacles
  • tasks_created (blue theme, ☑️ icon) - New tasks
  • notes_created (cyan theme, 📝 icon) - New notes
  • focus_score (purple theme, 🎯 icon) - Focus quality (0-100)
  • productivity_score (green theme, 📈 icon) - Productivity (0-100)
  • energy_level (yellow theme, ⚡ icon) - Energy (0-100)
  • learning_score (blue theme, 📚 icon) - Learning depth (0-100)

- "Chart": Data visualization
  Props: { type: "line"|"bar"|"area"|"pie"|"donut", data: {labels: string[], datasets: Array<{label: string, data: number[], color?: string}>}, height?: number, showLegend?: boolean, showGrid?: boolean }

- "ProgressBar": Progress visualization
  Props: { variant: "linear"|"circular", percentage: number, label: string, showPercentage?: boolean, animated?: boolean, theme?: ThemeVariant }

- "ImageGallery": Image showcase
  Props: { layout: "grid"|"masonry"|"carousel", columns?: 2-6, images: Array<{id: string, url: string, alt: string, caption?: string, timestamp?: string}> }
  NOTE: For session screenshots, use attachmentId as the 'url' value - the component will load the image data automatically

- "KeyValue": Property lists
  Props: { layout: "stacked"|"horizontal", showCopy?: boolean, items: Array<{key: string, value: string, icon?: string, copyable?: boolean}> }

### Interactive Components
- "Button": Action button
  Props: { label: string, icon?: string, variant?: "primary"|"secondary"|"ghost"|"danger", size?: "sm"|"md"|"lg", disabled?: boolean, loading?: boolean, action: Action }
  Action: { type: "create_task"|"create_note"|"export"|"share"|"link"|"expand"|"custom", label?: string, data?: object }

- "ActionToolbar": Grouped actions
  Props: { layout?: "horizontal"|"vertical", align?: "start"|"center"|"end", sticky?: boolean, actions: Action[] }

- "ToggleGroup": Option selection
  Props: { variant: "pills"|"buttons", defaultSelected: string, items: Array<{id: string, label: string, icon?: string}> }

### Action Components (New - for actionable summaries)
- "ActionCard": Rich action preview with inline editing
  Props: { action: Action, expanded?: boolean, editable?: boolean, theme?: ThemeVariant }
  Action structure: { type, label, icon?, createTask?, updateTask?, createNote?, updateNote?, linkToTask?, linkToNote?, metadata? }

- "ActionGroup": Grouped related actions with batch execution
  Props: { title: string, description?: string, actions: Action[], allowBatch?: boolean, defaultCollapsed?: boolean, theme?: ThemeVariant }

- "RelatedItemsPanel": Existing tasks/notes with suggested updates
  Props: { items: RelatedItem[], title?: string, showItemsWithoutUpdates?: boolean, maxItems?: number, theme?: ThemeVariant }
  RelatedItem structure: { type: 'task'|'note', id, title, relevance, status?, priority?, tags?, suggestedUpdate?: Action }

- "ActionReviewDashboard": Bulk action management
  Props: { actions?: Action[], showStats?: boolean, allowBulk?: boolean, title?: string, theme?: ThemeVariant }

## Source Citations

Citations help users validate and explore the source of information. When you include citations, always provide the actual content or insight first - users need to understand what happened before they can verify where it came from. Think of citations as supporting evidence that enriches already-complete information, rather than replacements for content itself.

Include \`citations\` to trace achievements, insights, blockers, and timeline events back to screenshots, audio, or analysis. Add to List items, Timeline items, Accordion items, and Text components.

\`\`\`typescript
citations: Array<{
  type: "screenshot" | "audio" | "video" | "agent_analysis",
  timestamp: string,  // ISO timestamp
  screenshotIds?: string[],
  audioSegmentId?: string,
  videoChapterId?: string,
  excerpt?: string,  // Quote or OCR text (first 100 chars)
  confidence?: number,  // 0-1 relevance score
  label?: string
}>
\`\`\`

**Examples:**

Screenshot citation with detailed content:
\`\`\`json
{
  "content": "Implemented OAuth 2.0 authentication flow using Passport.js, including token generation, refresh handling, and session management middleware",
  "citations": [{
    "type": "screenshot",
    "timestamp": "2024-01-15T14:23:00Z",
    "screenshotIds": ["id1", "id2"],
    "excerpt": "VS Code showing auth.js with OAuth implementation and middleware setup"
  }]
}
\`\`\`

Audio citation with decision context:
\`\`\`json
{
  "content": "Decided to use REST API with webhook callbacks for real-time event processing, avoiding the complexity of maintaining WebSocket connections across microservices",
  "citations": [{
    "type": "audio",
    "timestamp": "2024-01-15T14:25:30Z",
    "audioSegmentId": "seg-123",
    "excerpt": "I think REST with webhooks is the way to go, much simpler than WebSockets for our use case..."
  }]
}
\`\`\`

Multiple sources with comprehensive context:
\`\`\`json
{
  "title": "Resolved authentication token refresh bug affecting mobile clients",
  "description": "Fixed race condition where concurrent API requests could trigger multiple token refreshes, causing intermittent 401 errors. Solution involved adding request queuing and token refresh locking mechanism.",
  "citations": [
    {
      "type": "screenshot",
      "timestamp": "2024-01-15T15:10:00Z",
      "screenshotIds": ["id5"],
      "excerpt": "Terminal showing successful OAuth flow with token refresh logs"
    },
    {
      "type": "audio",
      "timestamp": "2024-01-15T15:11:00Z",
      "audioSegmentId": "seg-145",
      "excerpt": "Yes! The token refresh is working now - added a mutex to prevent concurrent refreshes"
    }
  ]
}
\`\`\`

## Nesting Rules
- Maximum depth: 10 levels (avoid excessive nesting)
- "children" field is OPTIONAL - only include if component has child components
- Tabs and Accordion REQUIRE children array (one ComponentTree per tab/item)
- All other components: children is OPTIONAL
- Empty arrays are allowed for components that support children but have none

## Action Generation Guidelines (CRITICAL for Actionable Summaries)

**When you see RECOMMENDED TASKS in summary_sections:**
- Create ActionCard or ActionGroup components with COMPLETE action specifications
- ALWAYS include full createTask data: title, description, priority, tags, sourceSessionId, relatedScreenshotIds
- Group related tasks using ActionGroup

**When you see RELATED CONTEXT in summary_sections:**
- Create RelatedItemsPanel component to show existing items
- For tasks/notes that this session advances, suggest updates using updateTask/updateNote actions
- Include clear reasoning for each suggested update

**Complete Action Example:**
\`\`\`json
{
  "component": "ActionCard",
  "props": {
    "action": {
      "type": "create_task",
      "label": "Write OAuth Integration Tests",
      "icon": "✓",
      "createTask": {
        "title": "Write comprehensive tests for OAuth 2.0 flow",
        "description": "Based on session implementation:\\n- Test token generation\\n- Test token refresh\\n- Test error handling\\n- Integration tests with provider\\n\\nSee screenshots from 3:15-3:45 PM.",
        "priority": "high",
        "tags": ["testing", "oauth", "authentication"],
        "sourceSessionId": "{{session.id}}",
        "relatedScreenshotIds": ["ss-15", "ss-16"]
      },
      "metadata": {
        "reasoning": "Session completed OAuth implementation but no tests exist",
        "confidence": 0.95,
        "relatedScreenshotIds": ["ss-15", "ss-16"]
      }
    },
    "expanded": true,
    "editable": true
  }
}
\`\`\`

**Update Action Example:**
\`\`\`json
{
  "component": "RelatedItemsPanel",
  "props": {
    "items": [
      {
        "type": "task",
        "id": "task-456",
        "title": "Implement OAuth 2.0 authentication",
        "relevance": "This session completed the implementation shown in screenshots",
        "status": "in-progress",
        "priority": "high",
        "suggestedUpdate": {
          "type": "update_task",
          "label": "Mark as complete",
          "updateTask": {
            "taskId": "task-456",
            "existingTitle": "Implement OAuth 2.0 authentication",
            "updates": {
              "status": "done",
              "notes": "Completed during session on [date]. Screenshots ss-15 through ss-18 show working implementation and testing."
            },
            "reasoning": "Screenshots from 3:15-3:45 PM show successful OAuth implementation and testing. Task should be marked complete."
          }
        }
      }
    ]
  }
}
\`\`\`

## Text Formatting Guidelines

**WHY use markdown:** Users scan summaries quickly. Markdown formatting (bold, code highlighting) creates visual hierarchy that helps users spot key information 3-5x faster than plain text. This directly improves UX and reduces cognitive load.

**CRITICAL RULE:** Whenever you use markdown syntax (* for italic, ** for bold, \` for code) in a Text or List component's content, you MUST set \`markdown: true\` in the props. Without this prop, the formatting will not render and users will see raw markdown characters.

Apply markdown formatting to text content for improved readability:

- **Technical terms**: Wrap in backticks (\`variableName\`, \`functionName()\`, \`/path/to/file\`, \`package-name\`)
- **Numbers**: Format with comma separators (15000 → 15,000)
- **Emphasis**: Bold key concepts, actions, and important outcomes
- **Lists**: Bold the primary action or concept in each item

Be reasonable and considered in your use of formatting. Generate natural, professional text.

**Examples:**
- "**Fixed authentication bug** in \`sessionManager\` - reduced login time from 5,000ms to 250ms"
- "**Implemented Redis caching** for \`/api/users\` endpoint"
- "Refactored \`DatabaseService.connect()\` to handle **connection pooling** with max pool size of 10,000"

</component_schema>`;
}

/**
 * BEST PRACTICE #3: Few-shot examples (diverse cases)
 */
function buildFewShotExamples(): string {
  return `<examples>
<example_1>
<description>Simple session with basic achievement - minimal nesting</description>
<input_summary>
Session: Quick bug fix
Duration: 45 minutes
Achievements: Fixed authentication error
Screenshots: 3
</input_summary>
<output>
{
  "theme": {
    "primary": "#10b981",
    "secondary": "#3b82f6",
    "mood": "focused",
    "explanation": "Green for successful fix, blue for technical focus"
  },
  "metadata": {
    "generatedAt": "2025-01-15T10:30:00Z",
    "sessionType": "coding",
    "confidence": 0.9
  },
  "componentTree": {
    "component": "Stack",
    "props": {
      "direction": "vertical",
      "spacing": "relaxed"
    },
    "children": [
      {
        "component": "Card",
        "props": {
          "theme": "success",
          "padding": "relaxed"
        },
        "children": [
          {
            "component": "Heading",
            "props": {
              "level": 1,
              "text": "Quick Win: Authentication Fixed",
              "gradient": true,
              "badge": "45min"
            }
          },
          {
            "component": "Text",
            "props": {
              "content": "Successfully resolved **authentication error** affecting user login flow.",
              "size": "lg",
              "color": "secondary",
              "markdown": true
            }
          }
        ]
      },
      {
        "component": "Card",
        "props": {
          "padding": "normal"
        },
        "children": [
          {
            "component": "Heading",
            "props": {
              "level": 3,
              "text": "What Was Fixed"
            }
          },
          {
            "component": "List",
            "props": {
              "variant": "checkmark",
              "items": [
                {
                  "id": "item1",
                  "content": "**Fixed JWT token validation** in \`auth.js\` to properly handle expired tokens and refresh flows. Updated validation middleware to check token expiration before processing requests.",
                  "citations": [{
                    "type": "screenshot",
                    "timestamp": "2025-01-15T10:15:00Z",
                    "screenshotIds": ["ss1"],
                    "excerpt": "VS Code showing auth.js with updated token validation logic and expiration checks"
                  }]
                },
                {
                  "id": "item2",
                  "content": "**Increased session timeout** from 15 to 30 minutes to reduce user friction. Added activity-based timeout refresh so active users don't get logged out unexpectedly.",
                  "citations": [{
                    "type": "screenshot",
                    "timestamp": "2025-01-15T10:22:00Z",
                    "screenshotIds": ["ss2"],
                    "excerpt": "Terminal showing session timeout configuration update in environment variables"
                  }]
                },
                {
                  "id": "item3",
                  "content": "**Redesigned error messages** to be user-friendly. Replaced technical \`401\`/\`403\` codes with clear messages like 'Your session expired. Please log in again'.",
                  "citations": [{
                    "type": "screenshot",
                    "timestamp": "2025-01-15T10:28:00Z",
                    "screenshotIds": ["ss3"],
                    "excerpt": "Browser showing new error UI with friendly messaging and action button"
                  }]
                }
              ]
            }
          }
        ]
      },
      {
        "component": "ActionToolbar",
        "props": {
          "layout": "horizontal",
          "actions": [
            {
              "type": "create_task",
              "label": "Create Follow-up Task",
              "data": {"title": "Test auth flow in production"}
            }
          ]
        }
      }
    ]
  }
}
</output>
</example_1>

<example_2>
<description>Complex session with multiple tabs and deep nesting - shows tabs, grids, charts</description>
<input_summary>
Session: Feature Development - Real-time Collaboration
Duration: 3 hours
Achievements: 5 major milestones
Blockers: 2 technical challenges
Screenshots: 24
Audio: 12 segments
</input_summary>
<output>
{
  "theme": {
    "primary": "#8b5cf6",
    "secondary": "#f59e0b",
    "mood": "energetic",
    "explanation": "Purple for creative development, orange for breakthrough energy"
  },
  "metadata": {
    "generatedAt": "2025-01-15T14:00:00Z",
    "sessionType": "coding",
    "confidence": 0.95
  },
  "componentTree": {
    "component": "Stack",
    "props": {
      "direction": "vertical",
      "spacing": "relaxed"
    },
    "children": [
      {
        "component": "Card",
        "props": {
          "theme": "info",
          "padding": "relaxed"
        },
        "children": [
          {
            "component": "Heading",
            "props": {
              "level": 1,
              "text": "Real-time Collaboration Feature Complete",
              "emphasis": "hero",
              "gradient": true
            }
          },
          {
            "component": "Grid",
            "props": {
              "columns": 3,
              "gap": "normal"
            },
            "children": [
              {
                "component": "StatCard",
                "props": {
                  "value": "5",
                  "label": "Achievements",
                  "icon": "✅",
                  "theme": "success",
                  "trend": {
                    "direction": "up",
                    "value": "+2",
                    "label": "vs last session"
                  }
                }
              },
              {
                "component": "StatCard",
                "props": {
                  "value": "24",
                  "label": "Screenshots",
                  "icon": "📸",
                  "theme": "purple"
                }
              },
              {
                "component": "StatCard",
                "props": {
                  "value": "3h 12m",
                  "label": "Duration",
                  "icon": "⏱️",
                  "theme": "info"
                }
              }
            ]
          }
        ]
      },
      {
        "component": "Tabs",
        "props": {
          "defaultTab": "timeline",
          "tabs": [
            {"id": "timeline", "label": "Timeline", "icon": "📅"},
            {"id": "insights", "label": "Insights", "badge": "3"},
            {"id": "analytics", "label": "Analytics"}
          ]
        },
        "children": [
          {
            "component": "Timeline",
            "props": {
              "orientation": "vertical",
              "showTimestamps": true,
              "items": [
                {
                  "id": "1",
                  "timestamp": "2025-01-15T14:00:00Z",
                  "title": "WebSocket Implementation Started",
                  "description": "Set up basic **WebSocket server** using \`Socket.io\`. Configured server to handle connection lifecycle, room management, and event broadcasting. Created client-side connection manager with **reconnection logic**.",
                  "theme": "info",
                  "citations": [{
                    "type": "screenshot",
                    "timestamp": "2025-01-15T14:05:00Z",
                    "screenshotIds": ["ss1", "ss2"],
                    "excerpt": "VS Code showing server.js with Socket.io setup and connection handlers"
                  }]
                },
                {
                  "id": "2",
                  "timestamp": "2025-01-15T15:30:00Z",
                  "title": "Real-time State Sync Working",
                  "description": "Successfully synchronized editor state across multiple clients. Implemented **operational transformation algorithm** to handle concurrent edits without conflicts. Tested with 3 simultaneous clients - all changes propagate with **sub-100ms latency**.",
                  "theme": "success",
                  "citations": [
                    {
                      "type": "screenshot",
                      "timestamp": "2025-01-15T15:32:00Z",
                      "screenshotIds": ["ss12", "ss13"],
                      "excerpt": "Browser showing three editor windows with synchronized text"
                    },
                    {
                      "type": "audio",
                      "timestamp": "2025-01-15T15:35:00Z",
                      "audioSegmentId": "seg-8",
                      "excerpt": "This is amazing! All three clients are staying in perfect sync!"
                    }
                  ]
                }
              ]
            }
          },
          {
            "component": "Accordion",
            "props": {
              "allowMultiple": true,
              "defaultExpanded": ["insight1"],
              "items": [
                {"id": "insight1", "title": "🚀 Breakthrough: Conflict Resolution"},
                {"id": "insight2", "title": "💡 Learning: CRDTs"},
                {"id": "insight3", "title": "⚠️ Challenge: Network Latency"}
              ]
            },
            "children": [
              {
                "component": "Stack",
                "props": {
                  "direction": "vertical",
                  "spacing": "normal"
                },
                "children": [
                  {
                    "component": "Text",
                    "props": {
                      "content": "Successfully implemented **operational transformation (OT) algorithm** for conflict-free collaborative editing. The breakthrough came from combining \`cursorTracking()\` with character-level transformations. Tested with complex scenarios - all resolved correctly without data loss.",
                      "size": "md",
                      "markdown": true
                    }
                  },
                  {
                    "component": "List",
                    "props": {
                      "variant": "bulleted",
                      "items": [
                        {
                          "content": "**Transform engine** handles character insertions, deletions, and cursor movements",
                          "citations": [{
                            "type": "screenshot",
                            "timestamp": "2025-01-15T15:10:00Z",
                            "screenshotIds": ["ss8"],
                            "excerpt": "Code showing OT transformation functions"
                          }]
                        },
                        {
                          "content": "**Client-side prediction** ensures instant feedback while server validates operations",
                          "citations": [{
                            "type": "audio",
                            "timestamp": "2025-01-15T15:15:00Z",
                            "audioSegmentId": "seg-6",
                            "excerpt": "The predictive text approach makes it feel instant even with network delay"
                          }]
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "component": "Text",
                "props": {
                  "content": "Discovered **Conflict-free Replicated Data Types (CRDTs)** as a mathematically proven alternative to \`OT\`. CRDTs enable distributed systems to reach **eventual consistency** without requiring a central server. Worth exploring for future iteration, especially for offline-first scenarios.",
                  "size": "md",
                  "markdown": true
                }
              },
              {
                "component": "Stack",
                "props": {
                  "direction": "vertical",
                  "spacing": "normal"
                },
                "children": [
                  {
                    "component": "Text",
                    "props": {
                      "content": "Network latency above 200ms causes noticeable lag in editor responsiveness, breaking the illusion of real-time collaboration. Users on slower connections see 300-500ms delay between typing and seeing changes from other users. This needs optimization.",
                      "size": "md"
                    }
                  },
                  {
                    "component": "List",
                    "props": {
                      "variant": "bulleted",
                      "items": [
                        {"id": "opt1", "content": "Consider implementing client-side prediction with rollback for better perceived performance"},
                        {"id": "opt2", "content": "Add network quality indicator so users understand connection status"}
                      ]
                    }
                  }
                ]
              }
            ]
          },
          {
            "component": "Chart",
            "props": {
              "type": "line",
              "height": 300,
              "showLegend": true,
              "showGrid": true,
              "data": {
                "labels": ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00"],
                "datasets": [
                  {
                    "label": "Focus Level",
                    "data": [70, 85, 90, 95, 80, 85, 90],
                    "color": "#8b5cf6"
                  }
                ]
              }
            }
          }
        ]
      }
    ]
  }
}
</output>
</example_2>

</examples>`;
}

/**
 * BEST PRACTICE #1 & #6: XML structure with chain-of-thought
 */
export function buildComponentCanvasPrompt(
  c: EnrichedSessionCharacteristics,
  session: Session,
  summary?: SessionSummary | FlexibleSessionSummary,
  sections?: SummarySection[]
): string {
  // Build data strings
  const startTime = new Date(session.startTime).toLocaleString();
  const endTime = session.endTime ? new Date(session.endTime).toLocaleString() : 'In progress';

  const peakMomentsList = c.temporal.peakMoments.length > 0
    ? c.temporal.peakMoments.map(m => `  - ${m.description} (${m.importance})`).join('\n')
    : '  (none detected)';

  const milestonesList = c.achievements.milestones.length > 0
    ? c.achievements.milestones.map(m => `  - ${m.title}: ${m.description}`).join('\n')
    : '  (none detected)';

  const breakthroughsList = c.achievements.breakthroughs.length > 0
    ? c.achievements.breakthroughs.map(b => `  - ${b.insight}`).join('\n')
    : '  (none detected)';

  // Handle both SessionSummary and FlexibleSessionSummary formats
  const achievementsList = summary && 'achievements' in summary && summary.achievements && summary.achievements.length > 0
    ? summary.achievements.map((a: string, i: number) => `  ${i + 1}. ${a}`).join('\n')
    : '  (none)';

  const blockersList = summary && 'blockers' in summary && summary.blockers && summary.blockers.length > 0
    ? summary.blockers.map((b: string, i: number) => `  ${i + 1}. ${b}`).join('\n')
    : '  (none)';

  const insightsList = summary && 'keyInsights' in summary && summary.keyInsights && summary.keyInsights.length > 0
    ? summary.keyInsights.map((ki: any) => `  - ${ki.insight}`).join('\n')
    : '  (none)';

  return `${buildComponentSchema()}

<session_data>
<session_profile>
Name: ${session.name}
Description: ${session.description || 'No description provided'}
Duration: ${c.duration} minutes (${c.timeOfDay})
Status: ${session.status}
Started: ${startTime}
Ended: ${endTime}
</session_profile>

<characteristics>
Type: ${c.type}
Mood: ${c.mood}
Intensity: ${c.intensity}

Content Available:
- Screenshots: ${c.screenshotCount}
- Audio Segments: ${c.audioSegmentCount}
- Video Chapters: ${c.videoChapterCount}
- Achievements: ${c.achievementCount}
- Blockers: ${c.blockerCount}
- Insights: ${c.insightCount}
- Has Audio: ${c.hasAudio ? 'YES' : 'NO'}
- Has Video: ${c.hasVideo ? 'YES' : 'NO'}
</characteristics>

<temporal_analysis>
Session Arc: ${c.temporal.sessionArc}
Rhythm: ${c.temporal.rhythm}
Screenshot Density: ${c.temporal.screenshotDensity.toFixed(1)}/hour
Context Switches: ${c.temporal.contextSwitches}

Peak Moments:
${peakMomentsList}

Major Milestones:
${milestonesList}

Breakthroughs:
${breakthroughsList}
</temporal_analysis>

<energy_profile>
Intensity: ${c.energy.intensity}/100
Focus Quality: ${c.energy.focusQuality}/100
Struggle Level: ${c.energy.struggleLevel}/100
Story Type: ${c.narrative.storyType}
Problems Solved: ${c.achievements.problemsSolved}

Goal: ${c.narrative.goal || 'Not explicitly stated'}
Conflict: ${c.narrative.conflict || 'None detected'}
Resolution: ${c.narrative.resolution || 'Session ended without clear resolution'}
Transformation: ${c.narrative.transformation || 'None detected'}
</energy_profile>

<narrative_summary>
${summary?.narrative || 'No narrative summary available - analyze session data to infer story.'}
</narrative_summary>

<achievements>
${achievementsList}
</achievements>

<blockers>
${blockersList}
</blockers>

<key_insights>
${insightsList}
</key_insights>

<screenshot_timeline>
${session.screenshots && session.screenshots.length > 0 ?
  session.screenshots.map((s, idx) => {
    const time = new Date(s.timestamp).toLocaleString();
    const analysis = s.aiAnalysis;
    return `
Screenshot ${idx + 1} [${time}]:
- Screenshot ID: ${s.id}
- Attachment ID: ${s.attachmentId} (use this as 'url' in ImageGallery components)
- Activity: ${analysis?.detectedActivity || 'Unknown'}
- Summary: ${analysis?.summary || 'No analysis'}
- Context Delta: ${analysis?.contextDelta || 'N/A'}
- Key Elements: ${analysis?.keyElements?.join(', ') || 'None'}
${analysis?.progressIndicators?.achievements && analysis.progressIndicators.achievements.length > 0 ?
  `- Achievements: ${analysis.progressIndicators.achievements.join('; ')}` : ''}
${analysis?.progressIndicators?.blockers && analysis.progressIndicators.blockers.length > 0 ?
  `- Blockers: ${analysis.progressIndicators.blockers.join('; ')}` : ''}
${analysis?.progressIndicators?.insights && analysis.progressIndicators.insights.length > 0 ?
  `- Insights: ${analysis.progressIndicators.insights.join('; ')}` : ''}
${analysis?.suggestedActions && analysis.suggestedActions.length > 0 ?
  `- Suggested Actions: ${analysis.suggestedActions.join('; ')}` : ''}
${s.userComment ? `- User Comment: "${s.userComment}"` : ''}`;
  }).join('\n')
  : '(No screenshots captured)'}
</screenshot_timeline>

<audio_segments>
${session.audioSegments && session.audioSegments.length > 0 ?
  session.audioSegments.map((seg, idx) => {
    const time = new Date(seg.timestamp).toLocaleString();
    return `
Audio Segment ${idx + 1} [${time}]:
- Duration: ${seg.duration}s
- Mode: ${seg.mode === 'transcription' ? 'Voice Transcription' : 'Audio Description'}
- Transcription: "${seg.transcription || 'No transcription'}"
${seg.description ? `- Environment: ${seg.description}` : ''}`;
  }).join('\n')
  : '(No audio segments captured)'}
</audio_segments>

<video_chapters>
${session.video?.chapters && session.video.chapters.length > 0 ?
  session.video.chapters.map((chapter, idx) => {
    const startMin = Math.floor(chapter.startTime / 60);
    const startSec = Math.floor(chapter.startTime % 60);
    const endMin = Math.floor(chapter.endTime / 60);
    const endSec = Math.floor(chapter.endTime % 60);
    const duration = Math.floor((chapter.endTime - chapter.startTime) / 60);
    return `
Chapter ${idx + 1}: "${chapter.title}"
- Time Range: ${startMin}:${String(startSec).padStart(2, '0')} - ${endMin}:${String(endSec).padStart(2, '0')} (${duration} min)
- Summary: ${chapter.summary || 'No summary'}
- Key Topics: ${chapter.keyTopics?.join(', ') || 'None'}
- Confidence: ${chapter.confidence || 'N/A'}`;
  }).join('\n')
  : '(No video chapters generated)'}
</video_chapters>

<audio_insights>
${session.audioInsights ? `
Overall Narrative: ${session.audioInsights.narrative || 'No narrative'}

Emotional Journey:
${session.audioInsights.emotionalJourney && session.audioInsights.emotionalJourney.length > 0 ?
  session.audioInsights.emotionalJourney.map((ej: any) => {
    const min = Math.floor(ej.timestamp / 60);
    const sec = Math.floor(ej.timestamp % 60);
    return `- ${min}:${String(sec).padStart(2, '0')} [${ej.emotion}] ${ej.description}`;
  }).join('\n')
  : '(No emotional journey data)'}

Key Moments:
${session.audioInsights.keyMoments && session.audioInsights.keyMoments.length > 0 ?
  session.audioInsights.keyMoments.map((km: any) => {
    const min = Math.floor(km.timestamp / 60);
    const sec = Math.floor(km.timestamp % 60);
    return `- ${min}:${String(sec).padStart(2, '0')} [${km.type}] ${km.description}${km.context ? ` (${km.context})` : ''}`;
  }).join('\n')
  : '(No key moments)'}

Work Patterns:
${session.audioInsights.workPatterns ? `
- Focus Level: ${session.audioInsights.workPatterns.focusLevel || 'Unknown'}
- Flow States Detected: ${session.audioInsights.workPatterns.flowStates?.length || 0}
${session.audioInsights.workPatterns.flowStates && session.audioInsights.workPatterns.flowStates.length > 0 ?
  session.audioInsights.workPatterns.flowStates.map((fs: any) => {
    const startMin = Math.floor(fs.startTime / 60);
    const endMin = Math.floor(fs.endTime / 60);
    const duration = Math.floor((fs.endTime - fs.startTime) / 60);
    return `  - ${startMin}min - ${endMin}min (${duration} min, intensity: ${fs.intensity})`;
  }).join('\n')
  : ''}` : '(No work pattern data)'}
` : '(No audio insights available)'}
</audio_insights>

${sections && sections.length > 0 ? `
<summary_sections>
${sections.map(section => {
  if (section.type === 'recommended-tasks') {
    const tasksSection = section as RecommendedTasksSection;
    return `RECOMMENDED TASKS:
${tasksSection.data.tasks.map(t => `
- Title: ${t.title}
  Priority: ${t.priority}
  Context: ${t.context}
  Category: ${t.category || 'general'}
  Estimated Duration: ${t.estimatedDuration ? `${t.estimatedDuration} minutes` : 'not specified'}
  Screenshots: ${t.relatedScreenshotIds?.join(', ') || 'none'}
`).join('\n')}`;
  }

  if (section.type === 'related-context') {
    const contextSection = section as RelatedContextSection;
    return `RELATED CONTEXT:
Related Tasks (${contextSection.data.relatedTasks.length}):
${contextSection.data.relatedTasks.map(t => `
- ID: ${t.taskId}
  Title: ${t.title}
  Relevance: ${t.relevance}
  Status: ${t.status}
  Priority: ${t.priority}
  Screenshots: ${t.screenshotIds?.join(', ') || 'none'}
`).join('\n')}

Related Notes (${contextSection.data.relatedNotes.length}):
${contextSection.data.relatedNotes.map(n => `
- ID: ${n.noteId}
  Summary: ${n.summary}
  Relevance: ${n.relevance}
  Tags: ${n.tags.join(', ')}
  Screenshots: ${n.screenshotIds?.join(', ') || 'none'}
`).join('\n')}

${contextSection.data.duplicatePrevention && contextSection.data.duplicatePrevention.length > 0 ? `
Duplicate Prevention (Tasks NOT to suggest):
${contextSection.data.duplicatePrevention.map(d => `
- Almost suggested: "${d.suggestedTitle}"
  But found existing: "${d.existingTaskTitle}" (ID: ${d.existingTaskId})
  Reasoning: ${d.reason}
`).join('\n')}` : ''}`;
  }

  return ''; // Other section types not needed for actions
}).filter(Boolean).join('\n\n')}
</summary_sections>
` : ''}
</session_data>

${buildFewShotExamples()}

<thinking>
Before generating the JSON, use this section to reason about:
- What is the session's main story based on the FULL timeline (screenshots + audio + video)?
- What are the key temporal moments? (Use actual timestamps from screenshot_timeline)
- Which specific screenshots should be featured in ImageGallery? (Use IDs from screenshot_timeline)
- What was the emotional/energy arc? (Use audio_insights if available)
- Were there flow states or breakthrough moments? (Check audio_insights work patterns)
- Which components best represent this content?
- How should information be organized (tabs vs accordion vs linear)?
- What colors/themes convey the right emotion?
- What actions does the user need access to? (Link to specific screenshot evidence)
- What OUTCOMES matter most, not what technical stats were captured?

**Remember**: You have the COMPLETE session data. Don't just summarize - create a rich, evidence-based story with citations, timestamps, and interactive galleries!
</thinking>

<instructions>
BEST PRACTICE: Most important instructions come at the END of the prompt for maximum impact.

BEST PRACTICE #8: Balance creativity within constraints

**CRITICAL - USE ALL THE RICH DATA PROVIDED:**
You have access to the COMPLETE session context including:
- Full screenshot timeline with individual analyses, timestamps, and IDs
- Complete audio segments with transcriptions
- Detailed video chapters with time ranges and summaries
- Audio insights including emotional journey, key moments, and flow states
- Enhanced achievements/blockers/insights with timestamps and citations

**LEVERAGE THE DETAILED DATA by:**
- Populating Timeline components with actual screenshot timestamps and events
- Filling ImageGallery components with actual screenshot IDs from the timeline
- Creating rich narrative sections based on temporal progression
- Showing specific moments with time-stamped citations
- Displaying emotional journey arcs and flow states
- Presenting video chapter breakdowns with actual timestamps

**INFORMATION HIERARCHY - What Users Value:**
Users care about OUTCOMES and INSIGHTS. Focus on what matters:

**What to prioritize:**
✅ Feature actual achievements, insights, and outcomes prominently
✅ Use screenshot counts only as supporting context, never as headlines
✅ Extract and display specific events from the detailed timeline data
✅ Build narratives from concrete moments, not aggregate statistics
✅ Highlight learnings, breakthroughs, and actionable next steps

**Example excellent approach:**
- Header: "OAuth Implementation Complete: Solved CORS Issues & Deployed to Production"
- StatCards: "3 Critical Bugs Fixed", "2 Hours in Flow State", "1 Major Breakthrough"
- Timeline: Actual events with timestamps from screenshots (e.g., "3:15 PM - Started OAuth implementation")

**What to avoid:**
- Headers focused on counts: "Session Summary: 47 Screenshots Captured"
- StatCards showing only technical metrics: "47 Screenshots", "12 Audio Segments"
- Generic text without specific events or concrete outcomes

1. ANALYZE the session data thoroughly:
   - What is the session's unique story?
   - What matters most to the user?
   - What actions should be easily accessible?
   - What temporal patterns exist in the screenshot/audio/video timeline?

2. SELECT components creatively but appropriately:
   - Match component types to content (Timeline for chronology, Chart for trends, etc.)
   - Use theme colors to convey meaning (success for wins, warning for challenges)
   - Nest components for rich layouts (Grid of Cards, Tabs with Accordions)
   - **Use ImageGallery with actual screenshot IDs from <screenshot_timeline>**
   - **Use Timeline with actual timestamps from screenshots/audio/video**
   - **Include citations linking back to specific screenshots, audio, or video**

3. DESIGN for completeness:
   - Include ALL achievements, blockers, and insights (don't leave anything out)
   - Use as many sections as needed (no artificial limits)
   - Progressive disclosure with Tabs/Accordion for lots of content
   - **Show the full temporal progression of the session**
   - **Display emotional journey and flow states if available**

4. OPTIMIZE for quick actions:
   - Add ActionToolbar or Button components for key workflows
   - Use create_task actions for insights that need follow-up
   - Use create_note actions to save important findings
   - **Link actions to specific screenshots using relatedScreenshotIds**

5. ENSURE valid JSON structure:
   - Follow the component schema exactly
   - All required fields must be present
   - Only use component types from the schema
   - Proper nesting (children arrays where appropriate)
   - **Include citations with actual screenshot IDs, timestamps, and excerpts**

6. MARKDOWN FORMATTING RULE (CRITICAL):
   - Whenever content includes markdown syntax (*, **, \` characters)
   - You MUST set markdown: true on that Text or List component
   - This is required for the formatting to render to the user
   - Without markdown: true, users see raw markdown characters instead of formatting
   - All examples demonstrate this correctly - follow their pattern exactly

7. THINK about the user experience:
   - Start with impact (hero section with MEANINGFUL headline + OUTCOME metrics)
   - Build narrative flow (timeline with actual events, insights with evidence)
   - End with clear next steps (action buttons linked to context)
   - **Make it easy to trace claims back to evidence (screenshots, audio, video)**
</instructions>

<output>
Now generate the complete JSON object following the schema exactly.
</output>`;
}

/**
 * BEST PRACTICE #4 & #10: Recommended settings for the generator
 */
export const CANVAS_GENERATION_CONFIG = {
  temperature: 0.7, // Balance creativity (component selection) with consistency (structure)
  maxTokens: 64000, // Claude Sonnet 4.5 supports up to 64k output - no artificial limits!
  model: 'claude-sonnet-4-5-20250929', // Latest Sonnet for best balance
};
