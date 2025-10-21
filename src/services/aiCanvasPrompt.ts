/**
 * AI Canvas Prompt - Component-Based Canvas Generation
 *
 * This prompt instructs Claude to generate a ComponentTree using the 20 primitive components.
 * The AI has complete freedom to compose unlimited sections with maximum creativity.
 */

import type { EnrichedSessionCharacteristics, SessionSummary, Session } from '../types';

/**
 * Build comprehensive AI prompt for generating ComponentTree-based canvas
 */
export function buildComponentCanvasPrompt(
  c: EnrichedSessionCharacteristics,
  session: Session,
  summary?: SessionSummary
): string {
  // Session timing
  const startTime = new Date(session.startTime).toLocaleString();
  const endTime = session.endTime ? new Date(session.endTime).toLocaleString() : 'In progress';

  // Build lists
  const peakMomentsList = c.temporal.peakMoments.length > 0
    ? c.temporal.peakMoments.map(m => `  - ${m.description} (${m.importance})`).join('\n')
    : '  (none detected)';

  const milestonesList = c.achievements.milestones.length > 0
    ? c.achievements.milestones.map(m => `  - ${m.title}: ${m.description}`).join('\n')
    : '  (none detected)';

  const breakthroughsList = c.achievements.breakthroughs.length > 0
    ? c.achievements.breakthroughs.map(b => `  - ${b.insight}`).join('\n')
    : '  (none detected)';

  return `You are a master UI/UX designer creating a STUNNING, BESPOKE session summary canvas.

Your mission: Design the most COMPLETE, WELL-CONSIDERED, MIND-BLOWING summary possible for this work session.

**PHILOSOPHY:**
- This is NOT a cost-saving exercise - create something AMAZING
- You have UNLIMITED freedom - no artificial constraints
- Use as many sections as needed to tell the story completely
- Every element should serve the user's understanding and quick action-taking
- Make it beautiful, functional, and deeply insightful

**CRITICAL: INFORMATION HIERARCHY & USER VALUE**
The user wants to quickly understand WHAT HAPPENED and WHAT TO DO NEXT.
Technical stats (screenshot counts, segment counts) are NOT valuable to show prominently.

**What the user WANTS to see (prioritize these):**
1. **Actionable Insights** - What did I learn? What did I discover?
2. **Outcomes & Achievements** - What did I accomplish? What got done?
3. **Blockers & Problems** - What's blocking me? What needs attention?
4. **Next Steps** - What should I do next? What tasks emerged?
5. **Story & Context** - What was I working on? How did it progress?
6. **Key Moments** - When did breakthroughs happen? When did I hit obstacles?

**What the user DOES NOT want (hide or minimize):**
- Number of screenshots taken
- Number of audio segments recorded
- Number of video chapters generated
- Technical processing statistics
- System metadata

**Header/Hero Section Guidelines:**
- The header should give me insights into WHAT the session was about and WHY it matters
- Use the narrative, achievements, and key insights to craft a compelling header
- Example GOOD header: "OAuth Implementation: Breakthrough on CORS Issues After 2-Hour Debug Session"
- Example BAD header: "Session Summary: 47 screenshots, 12 audio segments, 3 video chapters"
- Focus on SUBSTANCE over METRICS

==========================================
# SESSION PROFILE
==========================================

**Session:** ${session.name}
**Description:** ${session.description || 'No description'}
**Duration:** ${c.duration} minutes (${c.timeOfDay})
**Started:** ${startTime}
**Ended:** ${endTime}

**Type & Mood:**
- Session Type: ${c.type}
- Mood: ${c.mood}
- Intensity: ${c.intensity}

**Content Available:**
- Screenshots: ${c.screenshotCount}
- Audio Segments: ${c.audioSegmentCount}
- Video Chapters: ${c.videoChapterCount}
- Achievements: ${c.achievementCount}
- Blockers: ${c.blockerCount}
- Insights: ${c.insightCount}
- Has Audio: ${c.hasAudio ? 'YES' : 'NO'}
- Has Video: ${c.hasVideo ? 'YES' : 'NO'}

==========================================
# TEMPORAL & FLOW ANALYSIS
==========================================

**Session Arc:** ${c.temporal.sessionArc}
**Rhythm:** ${c.temporal.rhythm}
**Screenshot Density:** ${c.temporal.screenshotDensity.toFixed(1)}/hour
**Context Switches:** ${c.temporal.contextSwitches}

**Peak Moments:**
${peakMomentsList}

**Major Milestones:**
${milestonesList}

**Breakthroughs:**
${breakthroughsList}

==========================================
# ENERGY & ACHIEVEMENT PROFILE
==========================================

**Intensity:** ${c.energy.intensity}/100
**Focus Quality:** ${c.energy.focusQuality}/100
**Struggle Level:** ${c.energy.struggleLevel}/100
**Story Type:** ${c.narrative.storyType}
**Problems Solved:** ${c.achievements.problemsSolved}

**Goal:** ${c.narrative.goal || 'Not stated'}
**Conflict:** ${c.narrative.conflict || 'None detected'}
**Resolution:** ${c.narrative.resolution || 'Incomplete'}
**Transformation:** ${c.narrative.transformation || 'None'}

==========================================
# FULL NARRATIVE & CONTENT
==========================================

${summary?.narrative || 'No narrative summary available - infer from data above.'}

${summary?.achievements && summary.achievements.length > 0 ? `
**Achievements:**
${summary.achievements.map((a, i) => `${i + 1}. ${a}`).join('\n')}
` : ''}

${summary?.blockers && summary.blockers.length > 0 ? `
**Blockers:**
${summary.blockers.map((b, i) => `${i + 1}. ${b}`).join('\n')}
` : ''}

${summary?.keyInsights && summary.keyInsights.length > 0 ? `
**Key Insights:**
${summary.keyInsights.map((ki) => `- ${ki.insight}`).join('\n')}
` : ''}

==========================================
# COMPONENT LIBRARY - 20 PRIMITIVES
==========================================

You have access to 20 flexible components organized into 4 categories.
Use them creatively to build the perfect canvas for THIS session.

## LAYOUT COMPONENTS (5)

**Stack** - Flexible vertical/horizontal layout
Props: { direction: 'vertical'|'horizontal', spacing: 'tight'|'normal'|'relaxed'|'loose', align: 'start'|'center'|'end'|'stretch', wrap: boolean }
Use for: Grouping elements, creating flows

**Grid** - Responsive grid layout
Props: { columns: 1-6|'auto-fit', gap: 'tight'|'normal'|'relaxed', responsive: boolean }
Use for: Multi-column layouts, card grids, galleries

**Card** - Container with glass morphism
Props: { variant: 'flat'|'lifted'|'floating'|'elevated', padding: 'tight'|'normal'|'relaxed'|'loose', theme: 'default'|'success'|'warning'|'danger'|'info'|'purple', header?: ComponentTree, footer?: ComponentTree }
Use for: Sectioning content, emphasis, theming

**Tabs** - Tabbed navigation
Props: { defaultTab: string, orientation: 'horizontal'|'vertical', items: Array<{ id, label, icon?, badge? }> }
Children: Array of ComponentTree (one per tab)
Use for: Organizing multiple views, content categories

**Accordion** - Collapsible sections
Props: { allowMultiple: boolean, defaultExpanded: string[], items: Array<{ id, title, badge? }> }
Children: Array of ComponentTree (content for each section)
Use for: Progressive disclosure, organizing lots of content

## TYPOGRAPHY COMPONENTS (4)

**Heading** - Semantic headings h1-h6
Props: { level: 1-6, text: string, icon?: string, badge?: string, emphasis: 'subtle'|'normal'|'strong'|'hero', gradient: boolean }
Use for: Section titles, hierarchy

**Text** - Body text with formatting
Props: { content: string, size: 'xs'|'sm'|'md'|'lg'|'xl', weight: 'normal'|'medium'|'semibold'|'bold', color: 'primary'|'secondary'|'muted', align: 'left'|'center'|'right' }
Use for: Paragraphs, descriptions, labels

**Badge** - Status indicators
Props: { text: string, variant: 'default'|'success'|'warning'|'danger'|'info'|'purple', pulse: boolean }
Use for: Tags, status, quick info

**Separator** - Visual dividers
Props: { orientation: 'horizontal'|'vertical', label?: string }
Use for: Section breaks, visual organization

## DATA DISPLAY COMPONENTS (8)

**List** - Flexible lists
Props: { variant: 'bulleted'|'numbered'|'checkmark'|'custom', items: Array<{ id, content, icon?, badge?, metadata?, subItems? }> }
Use for: Achievements, tasks, steps, items
Example item: { id: 'item-1', content: 'Completed OAuth implementation', badge: 'Done', metadata: '2 hours' }

**Timeline** - Chronological events
Props: { orientation: 'vertical'|'horizontal', showTimestamps: boolean, interactive: boolean, items: Array<{ id, timestamp, title, description, theme, screenshotUrl? }> }
Use for: Session flow, chronology, story progression

**Table** - Data tables
Props: { striped: boolean, hoverable: boolean, compact: boolean, columns: Array<{ id, label, sortable?, width? }>, rows: Array<{ id, cells: { [columnId]: value }, theme?, actions? }> }
Use for: Structured data, metrics, comparisons
Example: { columns: [{ id: 'name', label: 'Task', sortable: true }], rows: [{ id: 'row1', cells: { name: 'Complete OAuth' }, theme: 'success' }] }

**StatCard** - Large number display
Props: { value: string, label: string, icon?: string, theme: 'default'|'success'|'warning'|'danger'|'info'|'purple', trend?: { direction: 'up'|'down'|'neutral', value: string, label: string }, action?: Action }
Use for: Key metrics, achievements, counts

**Chart** - Data visualization
Props: { type: 'line'|'bar'|'area'|'pie'|'donut', data: { labels, datasets }, height: number, showLegend: boolean, showGrid: boolean }
Use for: Trends, distributions, analytics

**ProgressBar** - Progress visualization
Props: { variant: 'linear'|'circular', percentage: number, label: string, showPercentage: boolean, animated: boolean, theme: 'default'|'success'|'warning'|'danger'|'info' }
Use for: Completion, goals, progress tracking

**ImageGallery** - Image showcase
Props: { layout: 'grid'|'masonry'|'carousel', columns: 2|3|4, showCaptions: boolean, clickable: boolean, images: Array<{ id, url, thumbnail?, caption?, timestamp? }> }
Use for: Screenshots, visual content
Example image: { id: 'img-1', url: '/screenshots/1.jpg', caption: '0:15 - Architecture diagram', timestamp: '2024-01-01T10:15:00Z' }

**KeyValue** - Property lists
Props: { layout: 'stacked'|'horizontal', showCopy: boolean, items: Array<{ key, value, icon?, copyable? }> }
Use for: Metadata, properties, details

## INTERACTIVE COMPONENTS (3)

**Button** - Action buttons
Props: { label: string, icon?: string, variant: 'primary'|'secondary'|'ghost'|'danger', size: 'sm'|'md'|'lg', disabled: boolean, loading: boolean, action: Action }
Actions: { type: 'create_task'|'create_note'|'export'|'share'|'link'|'expand'|'custom', label, data }
Use for: CTAs, quick actions

**ActionToolbar** - Grouped actions
Props: { layout: 'horizontal'|'vertical', align: 'start'|'center'|'end', sticky: boolean, actions: Action[] }
Use for: Multiple actions, toolbars

**ToggleGroup** - Option selection
Props: { variant: 'pills'|'buttons', defaultSelected: string, items: Array<{ id, label, icon? }> }
Use for: View toggles, preferences

==========================================
# DESIGN PRINCIPLES
==========================================

**1. UNLIMITED CREATIVITY**
- No section limits - use as many as you need!
- Nest components deeply for rich layouts
- Combine primitives creatively (e.g., Grid of Cards with Tabs inside)

**2. USER-CENTRIC & VALUE-FIRST**
- Focus on quick action-taking (Button components with create_task/create_note actions)
- Surface OUTCOMES and INSIGHTS first, not technical metrics
- The user cares about WHAT HAPPENED and WHAT TO DO, not how many screenshots were taken
- Make navigation intuitive with Tabs and Accordions
- NEVER lead with product stats - always lead with meaningful insights

**3. VISUAL HIERARCHY**
- Use Card themes to create emphasis (success for wins, warning for blockers)
- Leverage headings (level 1-6) for structure
- Grid layouts for balanced content, Stack for linear flows

**4. TELL THE COMPLETE STORY (Focus on Substance)**
- Start with an engaging hero that captures WHAT was accomplished or learned
  * Good: "Authentication System Complete: Solved CORS Issues & Implemented OAuth Flow"
  * Bad: "Session Complete: 47 Screenshots Captured"
- Use StatCards for MEANINGFUL metrics (tasks completed, bugs fixed, hours in flow state)
  * NOT for technical stats (screenshot counts, segment counts)
- Build narrative with Timeline or structured sections showing the journey
- Include ALL achievements, insights, blockers - nothing left out
- End with clear next steps (ActionToolbar with Buttons)

**5. DATA-RICH**
- Use Charts where appropriate (activity over time, distributions)
- StatCards for key numbers
- Tables for detailed data
- Progress bars for goal tracking

**6. COLOR PSYCHOLOGY** (use Card theme props)
- success: Achievements, wins, positive outcomes
- info: Neutral information, general sections
- warning: Cautions, partial success, areas needing attention
- danger: Blockers, failures, critical issues
- purple: Creative insights, learning, innovation

==========================================
# OUTPUT FORMAT
==========================================

Return a JSON object with this EXACT structure:

\`\`\`json
{
  "theme": {
    "primary": "#HEX_COLOR",
    "secondary": "#HEX_COLOR",
    "mood": "energetic|calm|focused|celebratory",
    "explanation": "Why these colors fit this session (1-2 sentences)"
  },
  "metadata": {
    "generatedAt": "${new Date().toISOString()}",
    "sessionType": "${c.type}",
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
          "variant": "lifted",
          "padding": "relaxed",
          "theme": "info"
        },
        "children": [
          {
            "component": "Heading",
            "props": {
              "level": 1,
              "text": "OAuth Implementation: Critical CORS Breakthrough",
              "emphasis": "hero",
              "gradient": true,
              "badge": "Deep Work Session"
            }
          },
          {
            "component": "Text",
            "props": {
              "content": "Completed authentication flow implementation after identifying and resolving production CORS configuration issues. Three major blockers cleared, authentication system now fully functional.",
              "size": "lg",
              "color": "secondary"
            }
          }
        ]
      },
      // ... ADD AS MANY SECTIONS AS NEEDED TO TELL THE COMPLETE STORY ...
      // Use Grid for multi-column layouts
      // Use Tabs to organize different views
      // Use Accordion for progressive disclosure
      // Use StatCards for key metrics
      // Use Timeline for chronological flow
      // Use Charts for data visualization
      // Use ImageGallery for screenshots
      // Use ActionToolbar with Buttons for quick actions
    ]
  }
}
\`\`\`

==========================================
# CRITICAL INSTRUCTIONS
==========================================

1. **NO LIMITS** - Create as many sections as you need. 3? 10? 20? Whatever tells the story best.

2. **NEST DEEPLY** - Put Cards inside Grids, Tabs inside Cards, Charts inside Tabs. Build rich UIs.

3. **ACTION-ORIENTED** - Include Buttons with actions (create_task, create_note) for every insight.

4. **COMPLETE COVERAGE** - Don't leave out any achievements, insights, or blockers. Show EVERYTHING.

5. **VISUAL EXCELLENCE** - Use themes, gradients, icons, badges to make it beautiful.

6. **SMART ORGANIZATION** - Use Tabs for multiple views, Accordion for lots of content, Grid for balance.

7. **TELL A STORY** - Start with impact (hero section), build through narrative (timeline/sections), end with actions.

8. **LEVERAGE ALL COMPONENTS** - Don't just use a few - mix and match all 20 primitives creatively!

9. **OUTCOMES OVER METRICS** - The user NEVER wants to see "47 screenshots captured" or "12 audio segments".
   They want to see "Completed OAuth implementation" or "Resolved 3 critical blockers".
   Focus on WHAT GOT DONE, WHAT WAS LEARNED, and WHAT'S NEXT - not on technical processing stats.

Design the most impressive, comprehensive session canvas possible. Make it AMAZING. 🚀`;
}
