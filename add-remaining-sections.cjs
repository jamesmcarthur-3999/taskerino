const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/types.ts');
let content = fs.readFileSync(filePath, 'utf8');

const moreSections = [
  {
    pattern: /^export interface LearningHighlightsSection extends BaseSummarySection \{$/m,
    doc: `/**
 * Learning Highlights Section - New knowledge gained during session
 *
 * Used when AI detects educational content, skill development, or discoveries.
 * Common in learning, research, and exploratory sessions.
 *
 * FIELDS:
 * - learnings: Array of insights with categorization
 * - topic: What area the learning relates to
 * - insight: The actual knowledge gained
 * - category: Type of learning (technical, process, tool, domain, other)
 *
 * RENDERING:
 * - emphasis: Usually 'medium' to highlight growth
 * - position: Often mid-summary after achievements
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: 'learning-highlights',
 *   title: 'What I Learned',
 *   emphasis: 'medium',
 *   data: {
 *     learnings: [{
 *       topic: 'React Context',
 *       insight: 'Context re-renders all consumers. Use split contexts.',
 *       category: 'technical'
 *     }]
 *   }
 * }
 * \`\`\`
 */
export interface LearningHighlightsSection extends BaseSummarySection {`
  },
  {
    pattern: /^export interface CreativeSolutionsSection extends BaseSummarySection \{$/m,
    doc: `/**
 * Creative Solutions Section - Innovative problem-solving approaches
 *
 * Used when AI detects novel solutions, clever workarounds, or unconventional approaches.
 * Common in creative, optimization, and problem-solving sessions.
 *
 * FIELDS:
 * - solutions: Array of problem-solution pairs
 * - problem: The challenge that needed solving
 * - solution: The creative approach taken
 * - approach: Methodology or reasoning behind solution
 *
 * RENDERING:
 * - emphasis: Usually 'high' to showcase ingenuity
 * - position: Often highlighted early in summary
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: 'creative-solutions',
 *   title: 'Clever Solutions',
 *   emphasis: 'high',
 *   data: {
 *     solutions: [{
 *       problem: 'Need to cache without LRU library overhead',
 *       solution: 'Built custom Map-based LRU with O(1) operations',
 *       approach: 'Used doubly-linked list pattern'
 *     }]
 *   }
 * }
 * \`\`\`
 */
export interface CreativeSolutionsSection extends BaseSummarySection {`
  },
  {
    pattern: /^export interface CollaborationSection extends BaseSummarySection \{$/m,
    doc: `/**
 * Collaboration Wins Section - Team interactions and shared achievements
 *
 * Used when AI detects pair programming, meetings, code reviews, or team discussions.
 * Common in collaborative, meeting, and code review sessions.
 *
 * FIELDS:
 * - collaborations: Array of team interactions
 * - participants: Who was involved
 * - outcome: Result of the collaboration
 *
 * RENDERING:
 * - emphasis: Usually 'medium' for team context
 * - position: Often mid-summary after individual work
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: 'collaboration-wins',
 *   title: 'Team Wins',
 *   emphasis: 'medium',
 *   data: {
 *     collaborations: [{
 *       title: 'Architecture review with Sarah',
 *       description: 'Discussed database schema migration strategy',
 *       participants: ['Sarah Chen', 'You'],
 *       outcome: 'Agreed on phased migration with feature flags'
 *     }]
 *   }
 * }
 * \`\`\`
 */
export interface CollaborationSection extends BaseSummarySection {`
  },
  {
    pattern: /^export interface TechnicalDiscoveriesSection extends BaseSummarySection \{$/m,
    doc: `/**
 * Technical Discoveries Section - Technology-specific findings and insights
 *
 * Used when AI detects exploration of new APIs, frameworks, or technical patterns.
 * Common in research, prototyping, and learning sessions.
 *
 * FIELDS:
 * - discoveries: Array of technical findings
 * - technology: Specific tool/framework/API explored
 * - finding: What was discovered about it
 *
 * RENDERING:
 * - emphasis: Usually 'medium' for technical context
 * - position: Often grouped with learning highlights
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: 'technical-discoveries',
 *   title: 'Technical Findings',
 *   emphasis: 'medium',
 *   data: {
 *     discoveries: [{
 *       title: 'IndexedDB transaction performance',
 *       technology: 'IndexedDB API',
 *       finding: 'Single transaction for 100 writes is 20x faster than 100 individual transactions'
 *     }]
 *   }
 * }
 * \`\`\`
 */
export interface TechnicalDiscoveriesSection extends BaseSummarySection {`
  },
  {
    pattern: /^export interface TimelineSection extends BaseSummarySection \{$/m,
    doc: `/**
 * Timeline Section - Chronological flow of session events
 *
 * Used when AI wants to emphasize temporal progression and session arc.
 * Common in long sessions with distinct phases or when chronology matters.
 *
 * FIELDS:
 * - events: Chronological list of key moments
 * - type: Event classification (start, milestone, blocker, breakthrough, end)
 * - narrative: Optional story-like description of session flow
 *
 * RENDERING:
 * - emphasis: Usually 'low' or 'medium' (provides context, not highlights)
 * - position: Often early for orientation, or late for retrospective
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: 'timeline',
 *   title: 'Session Flow',
 *   emphasis: 'low',
 *   data: {
 *     events: [
 *       {
 *         time: '2025-10-26T09:00:00Z',
 *         title: 'Started debugging',
 *         type: 'start'
 *       },
 *       {
 *         time: '2025-10-26T11:30:00Z',
 *         title: 'Found root cause',
 *         type: 'breakthrough'
 *       }
 *     ]
 *   }
 * }
 * \`\`\`
 */
export interface TimelineSection extends BaseSummarySection {`
  },
  {
    pattern: /^export interface FlowStateSection extends BaseSummarySection \{$/m,
    doc: `/**
 * Flow State Section - Deep work and concentration analysis
 *
 * Used when AI detects sustained focus periods and work rhythm patterns.
 * Common in deep-work, coding, and creative sessions with minimal interruptions.
 *
 * FIELDS:
 * - flowPeriods: Distinct periods of focused work
 * - quality: Depth of focus (deep/moderate/shallow)
 * - totalFlowTime: Sum of all flow periods
 * - flowPercentage: Proportion of session spent in flow
 *
 * RENDERING:
 * - emphasis: Usually 'medium' for productivity context
 * - position: Often late in summary as meta-analysis
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: 'flow-states',
 *   title: 'Focus Analysis',
 *   emphasis: 'medium',
 *   data: {
 *     flowPeriods: [{
 *       startTime: '2025-10-26T09:00:00Z',
 *       endTime: '2025-10-26T11:30:00Z',
 *       duration: 150,
 *       activity: 'Implementing authentication logic',
 *       quality: 'deep'
 *     }],
 *     totalFlowTime: 150,
 *     flowPercentage: 75
 *   }
 * }
 * \`\`\`
 */
export interface FlowStateSection extends BaseSummarySection {`
  },
  {
    pattern: /^export interface EmotionalJourneySection extends BaseSummarySection \{$/m,
    doc: `/**
 * Emotional Journey Section - Emotional arc throughout session
 *
 * Used when AI detects emotional patterns in audio/transcription or activity shifts.
 * Common in sessions with audio recording enabled and significant mood changes.
 *
 * FIELDS:
 * - journey: Emotional checkpoints throughout session
 * - emotion: Detected feeling (frustrated, excited, focused, confused, etc.)
 * - overallSentiment: Summary of entire session's emotional tone
 * - narrative: Story-like description of emotional progression
 *
 * RENDERING:
 * - emphasis: Usually 'low' or 'medium' (adds human context)
 * - position: Often late in summary as reflection
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: 'emotional-journey',
 *   title: 'How It Felt',
 *   emphasis: 'low',
 *   data: {
 *     journey: [
 *       {
 *         timestamp: '2025-10-26T09:00:00Z',
 *         emotion: 'focused',
 *         description: 'Deep concentration on problem'
 *       },
 *       {
 *         timestamp: '2025-10-26T10:30:00Z',
 *         emotion: 'frustrated',
 *         description: 'Hitting unexpected errors'
 *       }
 *     ],
 *     overallSentiment: 'positive'
 *   }
 * }
 * \`\`\`
 */
export interface EmotionalJourneySection extends BaseSummarySection {`
  },
  {
    pattern: /^export interface ProblemSolvingSection extends BaseSummarySection \{$/m,
    doc: `/**
 * Problem Solving Journey Section - Step-by-step debugging or problem resolution
 *
 * Used when AI detects methodical troubleshooting, systematic debugging, or multi-step solutions.
 * Common in troubleshooting, debugging, and complex problem-solving sessions.
 *
 * FIELDS:
 * - problem: The challenge being addressed
 * - approach: Ordered steps taken to solve it
 * - resolution: Final outcome or solution
 * - lessonsLearned: Key takeaways from the process
 *
 * RENDERING:
 * - emphasis: Usually 'high' for narrative-driven sessions
 * - position: Often early as main story arc
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: 'problem-solving-journey',
 *   title: 'Debugging Journey',
 *   emphasis: 'high',
 *   data: {
 *     problem: 'Memory leak causing browser crashes after 30 minutes',
 *     approach: [
 *       {
 *         step: 1,
 *         action: 'Used Chrome DevTools heap snapshots',
 *         outcome: 'Found growing array of event listeners'
 *       },
 *       {
 *         step: 2,
 *         action: 'Traced listener registration',
 *         outcome: 'Discovered missing cleanup in useEffect'
 *       }
 *     ],
 *     resolution: 'Fixed by adding proper effect cleanup',
 *     lessonsLearned: ['Always clean up observers in useEffect']
 *   }
 * }
 * \`\`\`
 */
export interface ProblemSolvingSection extends BaseSummarySection {`
  },
  {
    pattern: /^export interface FocusAreasSection extends BaseSummarySection \{$/m,
    doc: `/**
 * Focus Areas Section - Time allocation across different activities
 *
 * Used when AI wants to show how time was distributed across work areas.
 * Common in mixed sessions with multiple distinct activities.
 *
 * FIELDS:
 * - areas: Different work domains/activities
 * - duration: Minutes spent on each area
 * - percentage: Proportion of total session time
 * - activities: Specific tasks within each area
 *
 * RENDERING:
 * - emphasis: Usually 'low' or 'medium' (provides context)
 * - position: Often late in summary as time analysis
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: 'focus-areas',
 *   title: 'Time Breakdown',
 *   emphasis: 'low',
 *   data: {
 *     areas: [
 *       {
 *         area: 'Backend Development',
 *         duration: 90,
 *         percentage: 60,
 *         activities: ['API endpoints', 'Database queries', 'Testing']
 *       },
 *       {
 *         area: 'Code Review',
 *         duration: 30,
 *         percentage: 20
 *       }
 *     ]
 *   }
 * }
 * \`\`\`
 */
export interface FocusAreasSection extends BaseSummarySection {`
  },
  {
    pattern: /^export interface RecommendedTasksSection extends BaseSummarySection \{$/m,
    doc: `/**
 * Recommended Tasks Section - AI-extracted action items
 *
 * Used when AI detects TODO comments, unfinished work, or natural next steps.
 * Common in all session types - AI suggests follow-up actions.
 *
 * FIELDS:
 * - tasks: Suggested tasks with priority and context
 * - priority: Urgency level based on session context
 * - context: Why this task matters or where it came from
 * - estimatedDuration: AI's guess at time needed
 * - category: Type of task (bug, feature, refactor, etc.)
 *
 * RENDERING:
 * - emphasis: Usually 'medium' or 'high' (actionable next steps)
 * - position: Often late in summary (after reviewing what was done)
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: 'recommended-tasks',
 *   title: 'Next Steps',
 *   emphasis: 'medium',
 *   data: {
 *     tasks: [
 *       {
 *         title: 'Add error handling to auth flow',
 *         priority: 'high',
 *         context: 'Left TODO comment during implementation',
 *         estimatedDuration: 30,
 *         category: 'bug'
 *       }
 *     ]
 *   }
 * }
 * \`\`\`
 */
export interface RecommendedTasksSection extends BaseSummarySection {`
  },
  {
    pattern: /^export interface KeyInsightsSection extends BaseSummarySection \{$/m,
    doc: `/**
 * Key Insights Section - Important observations and realizations
 *
 * Used when AI detects significant learnings, patterns, or meta-observations.
 * Common in reflective, analytical, and discovery sessions.
 *
 * FIELDS:
 * - insights: Array of notable observations
 * - importance: Significance level of the insight
 * - category: Type of insight (performance, architecture, UX, etc.)
 *
 * RENDERING:
 * - emphasis: Usually 'medium' or 'high' based on importance
 * - position: Often mid-summary after concrete work
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: 'key-insights',
 *   title: 'Key Insights',
 *   emphasis: 'medium',
 *   data: {
 *     insights: [
 *       {
 *         insight: 'Our current architecture makes real-time features difficult',
 *         timestamp: '2025-10-26T14:00:00Z',
 *         importance: 'major',
 *         category: 'architecture'
 *       }
 *     ]
 *   }
 * }
 * \`\`\`
 */
export interface KeyInsightsSection extends BaseSummarySection {`
  },
  {
    pattern: /^export interface TaskBreakdownSection extends BaseSummarySection \{$/m,
    doc: `/**
 * Task Breakdown Section - Hierarchical task decomposition
 *
 * Used when AI detects a main task being broken down into subtasks.
 * Common in planning, project kickoff, and complex implementation sessions.
 *
 * FIELDS:
 * - mainTask: The overarching goal
 * - subtasks: Component tasks with status tracking
 * - progress: Overall completion percentage
 * - totalEstimatedTime: Sum of subtask estimates
 * - dependencies: Subtask ordering constraints
 *
 * RENDERING:
 * - emphasis: Usually 'medium' for project planning context
 * - position: Often early for planning sessions, late for retrospectives
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: 'task-breakdown',
 *   title: 'Implementation Plan',
 *   emphasis: 'medium',
 *   data: {
 *     mainTask: 'Implement user authentication',
 *     description: 'OAuth 2.0 with JWT tokens',
 *     subtasks: [
 *       {
 *         id: 'auth-1',
 *         title: 'Set up OAuth provider',
 *         status: 'done',
 *         estimatedDuration: 30
 *       },
 *       {
 *         id: 'auth-2',
 *         title: 'Implement token validation',
 *         status: 'in-progress',
 *         estimatedDuration: 60,
 *         dependencies: ['auth-1']
 *       }
 *     ],
 *     progress: 33,
 *     totalEstimatedTime: 135
 *   }
 * }
 * \`\`\`
 */
export interface TaskBreakdownSection extends BaseSummarySection {`
  }
];

let count = 0;
for (const {pattern, doc} of moreSections) {
  if (content.match(pattern)) {
    content = content.replace(pattern, doc);
    count++;
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`✓ Added ${count} more JSDoc comments (Total summary sections: ${count + 3}/15)`);
