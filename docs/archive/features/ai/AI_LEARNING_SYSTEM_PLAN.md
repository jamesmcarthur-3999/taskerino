# 🧠 AI Learning System - Comprehensive Plan

**Date:** October 2, 2025
**Status:** Planning Phase

---

## 📋 Executive Summary

Build an intelligent learning system that:
1. **Tracks user corrections** to AI output (tasks, notes, topics)
2. **Builds personalized learnings** that improve over time
3. **Applies learnings** to future AI processing
4. **Uses reinforcement** - observations → patterns → rules (not one-shot)
5. **Provides UI** for users to view/manage learnings

---

## 🎯 Core Requirements

### 1. Enhanced AI Task Creation
**Current State:**
- Tasks only have: `title`, `priority`
- No due dates, descriptions, tags, or subtasks from AI

**Target State:**
- AI should infer:
  - **Due dates** from temporal context ("next week", "by Friday", "urgent")
  - **Descriptions** from relevant details
  - **Tags** from content themes
  - **Priority** from urgency indicators
  - **Subtasks** from multi-step actions

**Example:**
```
Input: "Follow up with John about the pricing proposal by end of week,
need to send updated deck and schedule follow-up call"

Current Output:
- Task: "Follow up with John about pricing proposal" (priority: medium)

Target Output:
- Task: "Follow up with John about pricing proposal"
  - Due: Friday (end of this week)
  - Priority: High (urgency + decision-point)
  - Description: "Send updated pricing deck and schedule follow-up call"
  - Tags: ["pricing", "follow-up", "sales"]
  - Subtasks:
    - [ ] Send updated pricing deck
    - [ ] Schedule follow-up call
  - AI Context: Extracted from note about pricing discussion
```

### 2. Editable Results Screen
**Requirements:**
- After AI processing, show results BEFORE final save
- Allow editing:
  - Task title, due date, priority, description, tags
  - Task removal (delete unwanted tasks)
  - Topic associations
- "Save All" or "Save Selected" actions
- Track what user changed for learning

### 3. Learning System Architecture

#### Data Model
```typescript
interface Learning {
  id: string;
  category: LearningCategory;
  pattern: string;           // What pattern was observed
  action: string;            // What AI should do
  strength: number;          // 0-100: observation → pattern → rule
  evidence: LearningEvidence[];
  createdAt: string;
  lastReinforced: string;
  timesApplied: number;      // How many times used
  timesConfirmed: number;    // How many times user confirmed
  timesRejected: number;     // How many times user rejected
  status: 'active' | 'experimental' | 'deprecated';
}

interface LearningEvidence {
  id: string;
  timestamp: string;
  context: string;           // What triggered this
  userAction: 'confirm' | 'modify' | 'reject' | 'ignore';
  details?: {
    before?: any;            // What AI did
    after?: any;             // What user changed it to
  };
}

type LearningCategory =
  | 'task-creation'          // How to create tasks
  | 'task-timing'            // Due date inference
  | 'task-priority'          // Priority assignment
  | 'topic-detection'        // Topic matching
  | 'note-merging'           // When to merge
  | 'tagging'                // Tag patterns
  | 'formatting';            // Content formatting

interface UserLearnings {
  userId: string;            // For future multi-user support
  learnings: Learning[];
  stats: {
    totalLearnings: number;
    activeRules: number;
    experimentalPatterns: number;
    observations: number;
  };
}
```

#### Reinforcement Algorithm

**Strength Levels:**
- **0-20: Observation** (1-5 instances)
  - Just noticed, not confident yet
  - AI will *mention* this in reasoning but won't strongly apply
  - Label: "🔬 Observing"

- **21-60: Pattern** (6-15 instances)
  - Clear pattern emerging, moderately confident
  - AI will *consider* this but not override other signals
  - Label: "📊 Pattern Detected"

- **61-100: Rule** (16+ instances)
  - Strong evidence, high confidence
  - AI will *strongly apply* this
  - Label: "✅ Active Rule"

**Strength Calculation:**
```typescript
strength = Math.min(100,
  (timesConfirmed * 8) - (timesRejected * 15) + (timesApplied * 2)
)

// Decay over time if not reinforced
if (daysSinceLastReinforced > 30) {
  strength -= (daysSinceLastReinforced - 30) * 0.5
}
```

**Status Transitions:**
- `active`: Strength > 60, actively applied
- `experimental`: Strength 20-60, monitored
- `deprecated`: Strength < 20 and not reinforced in 60 days

---

## 🔄 Learning Categories & Examples

### 1. Task Creation Patterns
**Pattern:** User always adds descriptions to AI tasks
**Learning:**
```json
{
  "category": "task-creation",
  "pattern": "User adds descriptions from note context",
  "action": "Include relevant note excerpt as task description",
  "strength": 75,
  "evidence": [15 instances of user adding descriptions]
}
```

### 2. Task Timing
**Pattern:** "End of week" always means Friday
**Learning:**
```json
{
  "category": "task-timing",
  "pattern": "end of week|EOW → Friday",
  "action": "Set due date to upcoming Friday",
  "strength": 85,
  "evidence": [22 instances confirmed]
}
```

**Pattern:** User changes "urgent" tasks to have same-day due dates
**Learning:**
```json
{
  "category": "task-timing",
  "pattern": "urgent|ASAP → today",
  "action": "Set due date to today when urgency indicated",
  "strength": 65
}
```

### 3. Task Priority
**Pattern:** "Follow up" tasks always high priority for this user
**Learning:**
```json
{
  "category": "task-priority",
  "pattern": "follow up|follow-up → high priority",
  "action": "Set priority to 'high' for follow-up tasks",
  "strength": 55
}
```

### 4. Topic Detection
**Pattern:** "John" always refers to "John Smith" person topic
**Learning:**
```json
{
  "category": "topic-detection",
  "pattern": "John → John Smith (person)",
  "action": "Associate with existing 'John Smith' topic",
  "strength": 90
}
```

### 5. Note Merging Preferences
**Pattern:** User splits weekly meeting notes
**Learning:**
```json
{
  "category": "note-merging",
  "pattern": "weekly meeting → separate notes",
  "action": "Don't merge notes tagged 'weekly-meeting'",
  "strength": 70
}
```

### 6. Tagging Patterns
**Pattern:** Customer calls always get #customer tag
**Learning:**
```json
{
  "category": "tagging",
  "pattern": "customer call → #customer tag",
  "action": "Add 'customer' tag to call notes with customers",
  "strength": 80
}
```

---

## 🎨 User Interface Design

### 1. Editable Results Screen (CaptureZone)

**After AI Processing:**
```
┌─────────────────────────────────────────────────────────┐
│  ✨ AI Processing Complete                              │
│                                                          │
│  📝 Created 1 note • 🎯 Extracted 3 tasks               │
│                                                          │
│  Review and edit before saving:                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  🎯 TASKS                                [Edit All]     │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✓ Send pricing proposal to Sarah               │   │
│  │   📅 Friday • 🔴 High • #pricing #sales         │   │
│  │   [✏️ Edit] [🗑️ Remove]                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✓ Schedule follow-up call                       │   │
│  │   📅 Next Week • 🟡 Medium • #follow-up         │   │
│  │   [✏️ Edit] [🗑️ Remove]                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
│  📋 NOTES                                                │
│  Note created for: Acme Corp                            │
│  "Discussion about pricing and next steps..."           │
│  [View Details]                                          │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  [← Back to Edit]    [💾 Save All]    [✅ Save Selected]│
└─────────────────────────────────────────────────────────┘
```

**Task Edit Modal:**
```
┌─────────────────────────────────────────────┐
│  ✏️ Edit Task                          [×]  │
├─────────────────────────────────────────────┤
│  Title:                                     │
│  [Send pricing proposal to Sarah        ]  │
│                                             │
│  Due Date:         Priority:               │
│  [📅 Oct 4, 2025]  [🔴 High ▾]            │
│                                             │
│  Description:                               │
│  [Include updated numbers from Q3...    ]  │
│                                             │
│  Tags:                                      │
│  [#pricing] [#sales] [+ Add tag]           │
│                                             │
│  Subtasks:                                  │
│  ☐ Update pricing spreadsheet              │
│  ☐ Get approval from manager                │
│  [+ Add subtask]                            │
│                                             │
│  🤖 AI suggested due date: Friday          │
│     (from "by end of week")                │
│                                             │
├─────────────────────────────────────────────┤
│          [Cancel]  [Save Changes]           │
└─────────────────────────────────────────────┘
```

### 2. Learning Dashboard (Settings)

**Settings → AI Learnings Tab:**
```
┌───────────────────────────────────────────────────────────┐
│  🧠 AI Learnings                                          │
│                                                            │
│  Your AI learns from your edits and preferences           │
│                                                            │
│  📊 Stats                                                 │
│  ✅ 12 Active Rules • 🔬 8 Patterns • 👀 5 Observations  │
│                                                            │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  [All] [Task Creation] [Timing] [Priority] [Topics]       │
│                                                            │
│  ✅ Active Rules (12)                                     │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Task Timing                      Strength: ████ 85% │ │
│  │ "end of week" → Set due to Friday                   │ │
│  │ Applied 47 times • Confirmed 22x • Last: 2 days ago │ │
│  │ [View Evidence] [Edit] [Disable]                    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Topic Detection                  Strength: ████ 90% │ │
│  │ "John" → Associate with "John Smith" (person)       │ │
│  │ Applied 63 times • Confirmed 30x • Last: 1 day ago  │ │
│  │ [View Evidence] [Edit] [Disable]                    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                            │
│  📊 Emerging Patterns (8)                                 │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Task Priority                    Strength: ██░░ 55% │ │
│  │ "follow up" → Set priority to High                  │ │
│  │ Applied 18 times • Confirmed 9x • Last: 5 days ago  │ │
│  │ [Promote to Rule] [View Evidence] [Disable]         │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                            │
│  👀 Observations (5)                                      │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Tagging                          Strength: █░░░ 15% │ │
│  │ Customer calls → Add #customer tag                  │ │
│  │ Applied 4 times • Confirmed 2x • Last: 3 days ago   │ │
│  │ [Keep Observing] [Promote] [Dismiss]                │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                            │
├───────────────────────────────────────────────────────────┤
│  [+ Create Custom Rule] [Export Learnings] [Reset All]    │
└───────────────────────────────────────────────────────────┘
```

**Evidence Detail Modal:**
```
┌─────────────────────────────────────────────────┐
│  📊 Learning Evidence                      [×]  │
│                                                  │
│  Rule: "end of week" → Friday                   │
│  Category: Task Timing                          │
│  Strength: 85% (Active Rule)                    │
│                                                  │
├─────────────────────────────────────────────────┤
│  Recent Evidence (last 10):                     │
│                                                  │
│  ✅ Oct 1, 2025 - Confirmed                     │
│  Input: "Send report by end of week"            │
│  AI: Set due to Friday                          │
│  User: Kept Friday ✓                            │
│                                                  │
│  ✅ Sep 28, 2025 - Confirmed                    │
│  Input: "Follow up EOW"                         │
│  AI: Set due to Friday                          │
│  User: Kept Friday ✓                            │
│                                                  │
│  ❌ Sep 25, 2025 - Rejected                     │
│  Input: "Finish by end of week"                 │
│  AI: Set due to Friday                          │
│  User: Changed to Thursday                      │
│                                                  │
│  [Show All 47 Instances]                        │
│                                                  │
├─────────────────────────────────────────────────┤
│                          [Close]                │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Phase 1: Enhanced Task Creation (Week 1)

**1.1 Update AI Prompt**
```typescript
// Add to claudeService.ts prompt
For each task, provide:
{
  "title": "...",
  "priority": "low" | "medium" | "high" | "urgent",
  "dueDate": "YYYY-MM-DD" | null,  // NEW: Infer from temporal context
  "dueDateReasoning": "...",        // NEW: Explain why this date
  "description": "...",             // NEW: Relevant context
  "tags": ["..."],                  // NEW: Relevant tags
  "suggestedSubtasks": ["..."]      // NEW: Multi-step breakdown
}

Temporal Context Rules:
- "today", "ASAP", "urgent" → today's date
- "tomorrow" → tomorrow's date
- "this week", "by Friday" → upcoming Friday
- "next week" → Monday of next week
- "end of month" → last day of current month
- "in 2 weeks" → 14 days from today
```

**1.2 Update AIProcessResult Type**
```typescript
// types.ts
tasks: {
  title: string;
  priority: Task['priority'];
  dueDate?: string;           // NEW
  dueDateReasoning?: string;  // NEW
  description?: string;       // NEW
  tags?: string[];            // NEW
  suggestedSubtasks?: string[]; // NEW
  topicId?: string;
  noteId?: string;
}[];
```

**1.3 Update saveResults in CaptureZone**
```typescript
const newTask = createTask(taskResult.title, {
  priority: taskResult.priority,
  dueDate: taskResult.dueDate,
  description: taskResult.description,
  tags: taskResult.tags,
  subtasks: taskResult.suggestedSubtasks?.map(title => ({
    id: generateId(),
    title,
    done: false,
    createdAt: new Date().toISOString()
  })),
  topicId: taskResult.topicId,
  noteId: primaryNote?.id,
  createdBy: 'ai',
  aiContext: {
    sourceNoteId: primaryNote?.id || '',
    extractedFrom: noteResult.content.substring(0, 100) + '...',
    confidence: 0.85,
    reasoning: taskResult.dueDateReasoning
  }
});
```

### Phase 2: Editable Results Screen (Week 1-2)

**2.1 Create ResultsReview Component**
```typescript
// components/ResultsReview.tsx
interface ResultsReviewProps {
  results: AIProcessResult;
  onSave: (editedResults: EditedResults) => void;
  onBack: () => void;
}

interface EditedResults {
  tasks: Task[];           // Edited tasks
  removedTaskIds: string[]; // Tasks user removed
  notes: Note[];
  topics: Topic[];
}
```

**2.2 Add to CaptureZone State**
```typescript
const [isReviewMode, setIsReviewMode] = useState(false);
const [pendingResults, setPendingResults] = useState<AIProcessResult | null>(null);
```

**2.3 Track Changes for Learning**
```typescript
const trackTaskEdit = (
  originalTask: AIGeneratedTask,
  editedTask: Task,
  action: 'confirm' | 'modify' | 'remove'
) => {
  const evidence: LearningEvidence = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    context: `Task: "${originalTask.title}"`,
    userAction: action,
    details: {
      before: originalTask,
      after: editedTask
    }
  };

  // Analyze what changed and update relevant learnings
  analyzeLearnings(evidence);
};
```

### Phase 3: Learning System Core (Week 2-3)

**3.1 Learning Service**
```typescript
// services/learningService.ts
export class LearningService {

  // Analyze evidence and update learnings
  analyzeLearnings(evidence: LearningEvidence): void {
    // Check for existing patterns
    // Create new observations
    // Update strength scores
    // Promote observations → patterns → rules
  }

  // Get applicable learnings for AI prompt
  getApplicableLearnings(
    category?: LearningCategory
  ): Learning[] {
    return this.learnings
      .filter(l => l.status === 'active' || l.status === 'experimental')
      .filter(l => !category || l.category === category)
      .sort((a, b) => b.strength - a.strength);
  }

  // Format learnings for AI prompt
  formatForPrompt(learnings: Learning[]): string {
    return learnings.map(l => {
      const label = l.strength > 60 ? 'RULE' :
                   l.strength > 20 ? 'PATTERN' : 'OBSERVATION';
      return `[${label} ${l.strength}%] ${l.pattern} → ${l.action}`;
    }).join('\n');
  }

  // Reinforce learning (when AI applies it correctly)
  reinforceLearning(learningId: string, confirmed: boolean): void {
    const learning = this.getLearning(learningId);
    if (!learning) return;

    learning.timesApplied++;
    if (confirmed) {
      learning.timesConfirmed++;
    } else {
      learning.timesRejected++;
    }

    learning.strength = this.calculateStrength(learning);
    learning.lastReinforced = new Date().toISOString();

    // Update status based on strength
    learning.status = learning.strength > 60 ? 'active' :
                     learning.strength > 20 ? 'experimental' :
                     learning.strength < 10 ? 'deprecated' : learning.status;

    this.save();
  }

  private calculateStrength(learning: Learning): number {
    const baseStrength = (
      (learning.timesConfirmed * 8) -
      (learning.timesRejected * 15) +
      (learning.timesApplied * 2)
    );

    // Apply decay
    const daysSince = daysBetween(
      new Date(learning.lastReinforced),
      new Date()
    );
    const decay = daysSince > 30 ? (daysSince - 30) * 0.5 : 0;

    return Math.max(0, Math.min(100, baseStrength - decay));
  }
}
```

**3.2 Update AI Prompt with Learnings**
```typescript
// In claudeService.processInput()
const learningService = new LearningService();
const learnings = learningService.getApplicableLearnings();

const prompt = `${settings.systemInstructions}

**USER-SPECIFIC LEARNINGS:**
${learningService.formatForPrompt(learnings)}

**CRITICAL RULES:**
...rest of prompt
`;
```

**3.3 Add to AppState**
```typescript
// types.ts
export interface AppState {
  // ... existing fields
  learnings: UserLearnings;
}
```

### Phase 4: Learning UI (Week 3-4)

**4.1 Learning Dashboard Component**
```typescript
// components/LearningDashboard.tsx
export function LearningDashboard() {
  const { state } = useApp();
  const learningService = new LearningService(state.learnings);

  const activeRules = learnings.filter(l => l.strength > 60);
  const patterns = learnings.filter(l => l.strength > 20 && l.strength <= 60);
  const observations = learnings.filter(l => l.strength <= 20);

  // ... render UI
}
```

**4.2 Add to Settings Modal**
```typescript
// Add tab to SettingsModal.tsx
<Tab>AI Learnings</Tab>
<TabPanel>
  <LearningDashboard />
</TabPanel>
```

---

## 📈 Success Metrics

**Phase 1:**
- ✅ AI generates due dates with 80%+ accuracy
- ✅ AI provides descriptions for 90%+ tasks
- ✅ AI suggests relevant subtasks for multi-step tasks

**Phase 2:**
- ✅ Users can edit all task fields before saving
- ✅ Task removal works correctly
- ✅ Changes are tracked for learning

**Phase 3:**
- ✅ Learnings are created from user edits
- ✅ Strength scores update correctly
- ✅ AI applies learnings to future processing
- ✅ Observable improvement over 20+ captures

**Phase 4:**
- ✅ Users can view all learnings
- ✅ Users can edit/disable learnings
- ✅ Evidence is clearly displayed
- ✅ Export/import works

---

## 🚀 Implementation Timeline

**Week 1: Enhanced Task Creation + Review UI**
- Day 1-2: Update AI prompt for rich task creation
- Day 3-4: Build ResultsReview component
- Day 5: Testing and refinement

**Week 2: Learning System Core**
- Day 1-2: Build LearningService
- Day 3-4: Integration with AI processing
- Day 5: Evidence tracking and pattern detection

**Week 3: Learning Algorithms**
- Day 1-2: Reinforcement logic
- Day 3-4: Strength calculations and decay
- Day 5: Auto-promotion of patterns

**Week 4: Learning UI**
- Day 1-3: Learning Dashboard component
- Day 4: Evidence viewer
- Day 5: Testing and polish

---

## 🤔 Open Questions

1. **Multi-user support:** How to handle learnings when multiple users share data?
   - **Proposed:** Store learnings per userProfile.id, merge on export

2. **Privacy:** Should learnings be exportable/shareable?
   - **Proposed:** Yes, as JSON with anonymization option

3. **Conflict resolution:** What if a learning contradicts a new pattern?
   - **Proposed:** Strength-based - stronger learning wins, but track conflicts

4. **Learning limits:** Max number of learnings to prevent bloat?
   - **Proposed:** Auto-archive learnings not used in 90 days

5. **Manual rules:** Allow users to create rules without evidence?
   - **Proposed:** Yes, but mark as "manual" and require confirmation after 10 uses

---

## 🎯 Next Steps

1. **Review this plan** - Get user feedback
2. **Refine scope** - Adjust timeline if needed
3. **Begin Phase 1** - Enhanced task creation
4. **Iterate** - Build, test, refine

---

**Built with 🧠 for intelligent productivity**
