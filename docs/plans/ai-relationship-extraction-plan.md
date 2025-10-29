# AI Relationship Extraction + Canvas Integration
## Implementation Plan v1.0

**Created**: 2025-10-26
**Status**: Planning Phase
**Estimated Duration**: 7-8 weeks
**Estimated Cost Impact**: +$0.05 per session enrichment

---

## 📋 Executive Summary

Transform session enrichment to automatically detect companies, people, tasks, and notes using AI, then visualize these relationships in a new Canvas module that becomes the default session view.

### Key Objectives
1. AI detects and creates company/contact entities during enrichment
2. AI links to existing tasks/notes when mentioned
3. New Relationship canvas module displays connections
4. Canvas becomes default view (replaces summary when available)
5. User-created tasks/notes auto-establish relationships

### Success Metrics
- AI entity detection accuracy >80%
- Relationship module visible in canvas for enriched sessions
- Canvas is default view when relationships exist
- Zero breaking changes to existing enrichment pipeline
- User-created entities auto-linked to session

---

## 🏗️ Architecture Overview

### Current System
```
Session Recording → 10-Stage Enrichment → Summary Page
                    (AI adds category/tags only)
```

### New System
```
Session Recording → 10-Stage Enrichment → Canvas (default)
                    ├─ Stage 6.3: AI Relationship Extraction
                    ├─ Stage 6.5: Canvas Generation (with Relationship Module)
                    └─ Bidirectional: User creates → Auto-link
                                     ↓
                    Summary Page (fallback only)
```

### Data Flow
```
Session Content (screenshots, audio, video)
  ↓
AI Analysis (Claude Sonnet 4.5)
  ↓
Entity Detection (companies, people, tasks, notes)
  ↓
RelationshipManager (atomic transactions, bidirectional sync)
  ↓
Canvas Module (visual display)
  ↓
User Interaction (create/edit) → Relationship Update
```

---

## 🎯 Implementation Phases

### Phase 1: AI Relationship Extraction Stage
**Duration**: Week 1-2
**Owner**: Agent 1 (Backend Services)
**Files Modified**: 1
**Dependencies**: None

### Phase 2: Relationship Canvas Module
**Duration**: Week 3-4
**Owner**: Agent 2 (Canvas/UI)
**Files Modified**: 3-4
**Dependencies**: None (parallel with Phase 1)

### Phase 2.5: Bidirectional Relationship Creation
**Duration**: Week 4-5
**Owner**: Agent 3 (Integration)
**Files Modified**: 4-5
**Dependencies**: Phase 1 + Phase 2

### Phase 3: Canvas Generation Logic Update
**Duration**: Week 5-6
**Owner**: Agent 1 (Backend Services)
**Files Modified**: 1
**Dependencies**: Phase 1 + Phase 2

### Phase 4: Default View Logic Change
**Duration**: Week 6-7
**Owner**: Agent 2 (Canvas/UI)
**Files Modified**: 1
**Dependencies**: Phase 3

### Phase 5: Integration Testing & Polish
**Duration**: Week 7-8
**Owner**: Agent 4 (QA/Testing)
**Files Modified**: Test files
**Dependencies**: All phases

---

## 👥 Agent Assignments

### Agent 1: Backend Services (Enrichment Pipeline)
**Responsibilities**:
- Implement Stage 6.3 relationship extraction
- Update Stage 6.5 canvas generation to include relationship module
- Ensure RelationshipManager integration is atomic
- Add error handling and rollback logic

**Skills Required**:
- TypeScript/Node.js
- Claude API integration
- SessionEnrichmentService architecture
- RelationshipManager API

**Files to Modify**:
- `/src/services/sessionEnrichmentService.ts`

**Deliverables**:
1. Stage 6.3 implementation with AI prompt
2. Entity matching algorithms (fuzzy match for companies/people)
3. Integration with RelationshipManager
4. Cost/performance metrics logging

---

### Agent 2: Canvas/UI (Module Development)
**Responsibilities**:
- Create RelationshipModule component with 4 variants
- Register module in canvas registry
- Update SessionDetailView default view logic
- Implement responsive layouts for relationship display

**Skills Required**:
- React/TypeScript
- Framer Motion animations
- CSS Grid layout system
- Design system integration

**Files to Modify**:
- `/src/components/morphing-canvas/modules/RelationshipModule.tsx` (NEW)
- `/src/components/morphing-canvas/registry/index.ts`
- `/src/components/morphing-canvas/types/module.ts`
- `/src/components/SessionDetailView.tsx`

**Deliverables**:
1. RelationshipModule with variants: graph, list, cards, timeline
2. Module registration and type definitions
3. Default view logic (canvas > summary)
4. Responsive design for all screen sizes

---

### Agent 3: Integration (Bidirectional Flows)
**Responsibilities**:
- Implement auto-linking when tasks/notes created from canvas
- Add real-time relationship updates to RelationshipModule
- Update QuickActions module to emit relationship events
- Handle edge cases (duplicates, cascading deletes)

**Skills Required**:
- React hooks (useEffect, custom hooks)
- Event-driven architecture
- RelationshipManager API
- Context management

**Files to Modify**:
- `/src/components/morphing-canvas/MorphingCanvas.tsx`
- `/src/components/morphing-canvas/modules/QuickActionsModule.tsx`
- `/src/components/morphing-canvas/modules/RelationshipModule.tsx`
- `/src/hooks/useRelationshipManager.ts` (if needed)

**Deliverables**:
1. Canvas-level action handlers for create-task/create-note
2. Real-time relationship subscription in RelationshipModule
3. Event bubbling architecture from modules → canvas
4. Edge case handling documentation

---

### Agent 4: QA/Testing (Quality Assurance)
**Responsibilities**:
- Write unit tests for Stage 6.3 extraction logic
- Write integration tests for RelationshipModule
- Test bidirectional relationship creation flows
- Performance testing (enrichment time, canvas render)
- Regression testing (ensure no breaks in existing features)

**Skills Required**:
- Vitest/Jest
- React Testing Library
- Integration testing patterns
- Performance profiling

**Files to Create/Modify**:
- `/src/services/__tests__/sessionEnrichmentService.relationship.test.ts` (NEW)
- `/src/components/morphing-canvas/modules/__tests__/RelationshipModule.test.tsx` (NEW)
- `/src/components/__tests__/SessionDetailView.integration.test.tsx` (NEW)

**Deliverables**:
1. Unit tests with >80% coverage for new code
2. Integration tests for end-to-end flows
3. Performance benchmarks (before/after)
4. Regression test suite results

---

## 📝 Detailed Implementation Instructions

### PHASE 1: AI Relationship Extraction Stage

**Agent**: Agent 1 (Backend Services)
**Duration**: Week 1-2
**Priority**: HIGH (blocks Phase 3)

#### Files to Modify

##### 1. `/src/services/sessionEnrichmentService.ts`

**Step 1.1: Add TypeScript Interfaces**

Add after existing interfaces (around line 50):

```typescript
interface RelationshipExtractionResult {
  companies: ExtractedCompany[];
  people: ExtractedPerson[];
  tasks: LinkedTask[];
  notes: LinkedNote[];
  metadata: {
    extractionTime: number;
    confidence: number;
    tokensUsed: number;
    cost: number;
  };
}

interface ExtractedCompany {
  name: string;
  matchedId: string | null;  // Existing company ID if matched
  confidence: number;  // 0-1
  reasoning: string;
  mentions: number;  // How many times mentioned in session
}

interface ExtractedPerson {
  name: string;
  email?: string;
  matchedId: string | null;  // Existing contact ID if matched
  confidence: number;
  reasoning: string;
  mentions: number;
}

interface LinkedTask {
  title: string;
  matchedId: string | null;  // Only set if existing task found
  confidence: number;
}

interface LinkedNote {
  title: string;
  matchedId: string | null;  // Only set if existing note found
  confidence: number;
}
```

**Step 1.2: Add Relationship Extraction Method**

Add new method after `stage6_audioTranscriptionEnrichment` (around line 600):

```typescript
/**
 * Stage 6.3: Relationship Extraction
 *
 * Uses AI to detect companies, people, and links to existing tasks/notes.
 * This runs AFTER summary generation (Stage 6) to use summary context.
 *
 * Cost: ~$0.05 per session (Claude Sonnet 4.5)
 * Time: ~2-3 seconds
 */
private async stage6_3_relationshipExtraction(
  session: Session,
  summary: SessionSummary
): Promise<RelationshipExtractionResult> {
  const startTime = Date.now();

  console.log('📊 [Stage 6.3] Starting relationship extraction...');

  // Gather all text content from session
  const screenshotText = session.screenshots
    ?.map(s => s.extractedText)
    .filter(Boolean)
    .join('\n\n') || '';

  const audioText = session.audioTranscription?.enrichedTranscription ||
                    session.audioTranscription?.transcription || '';

  const videoContext = session.videoAnalysis?.chapters
    ?.map(c => `${c.title}: ${c.summary}`)
    .join('\n') || '';

  // Get existing entities for matching
  const existingCompanies = await this.getExistingCompanies();
  const existingPeople = await this.getExistingContacts();
  const existingTasks = await this.getExistingTasks();
  const existingNotes = await this.getExistingNotes();

  // Build AI prompt
  const prompt = `
You are analyzing a work session to extract relationship information.

SESSION SUMMARY:
Title: ${summary.title}
Category: ${summary.category} / ${summary.subCategory}
Summary: ${summary.summary}
Tags: ${summary.tags.join(', ')}

SESSION CONTENT:
Screenshots (OCR):
${screenshotText.substring(0, 3000)}

Audio Transcription:
${audioText.substring(0, 3000)}

Video Chapters:
${videoContext}

EXISTING ENTITIES (for matching):

Companies (${existingCompanies.length}):
${existingCompanies.map(c => `- "${c.name}" (ID: ${c.id})`).join('\n')}

People (${existingPeople.length}):
${existingPeople.map(p => `- "${p.name}" ${p.email ? `<${p.email}>` : ''} (ID: ${p.id})`).join('\n')}

Tasks (${existingTasks.length}):
${existingTasks.map(t => `- "${t.title}" (ID: ${t.id})`).join('\n')}

Notes (${existingNotes.length}):
${existingNotes.map(n => `- "${n.title}" (ID: ${n.id})`).join('\n')}

INSTRUCTIONS:

1. **Companies**: Identify companies mentioned in the session. Match against existing companies using fuzzy matching (handle variations like "Google" vs "Google Inc"). If no match, mark as new (matchedId: null). Provide confidence score (0-1) and reasoning.

2. **People**: Identify people/contacts mentioned. Match by name or email. If ambiguous, prefer higher confidence match. If no match, mark as new.

3. **Tasks**: Identify existing tasks that are referenced (by title). ONLY link if a task exists - NEVER create new tasks. Use fuzzy matching for titles.

4. **Notes**: Identify existing notes that are referenced. ONLY link if a note exists - NEVER create new notes.

MATCHING RULES:
- Confidence >0.8: Strong match (exact or very close)
- Confidence 0.5-0.8: Moderate match (similar but not exact)
- Confidence <0.5: Weak match (possibly related but unsure)
- Only include entities with confidence >0.5

Return JSON in this exact format:
{
  "companies": [
    {
      "name": "Acme Corp",
      "matchedId": "company-123",
      "confidence": 0.95,
      "reasoning": "Exact match with existing company",
      "mentions": 3
    }
  ],
  "people": [
    {
      "name": "Jane Smith",
      "email": "jane@acme.com",
      "matchedId": "contact-456",
      "confidence": 0.90,
      "reasoning": "Name and email match existing contact",
      "mentions": 2
    }
  ],
  "tasks": [
    {
      "title": "Update API documentation",
      "matchedId": "task-789",
      "confidence": 0.85
    }
  ],
  "notes": [
    {
      "title": "Meeting notes with client",
      "matchedId": "note-101",
      "confidence": 0.80
    }
  ]
}

If no entities found in a category, return empty array.
`.trim();

  // Call Claude Sonnet 4.5
  const response = await this.callAI({
    model: 'claude-sonnet-4-5-20250929',
    messages: [{
      role: 'user',
      content: prompt,
    }],
    max_tokens: 2000,
    temperature: 0.3,  // Lower for more consistent extraction
  });

  // Parse response
  const extracted = JSON.parse(response.content[0].text);

  // Create relationships via RelationshipManager
  await this.createRelationshipsFromExtraction(session.id, extracted);

  const extractionTime = Date.now() - startTime;

  console.log(`✅ [Stage 6.3] Extracted ${extracted.companies.length} companies, ${extracted.people.length} people, ${extracted.tasks.length} tasks, ${extracted.notes.length} notes (${extractionTime}ms)`);

  return {
    ...extracted,
    metadata: {
      extractionTime,
      confidence: this.calculateAverageConfidence(extracted),
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      cost: this.calculateCost(response.usage, 'claude-sonnet-4-5'),
    },
  };
}

/**
 * Helper: Get existing companies for matching
 */
private async getExistingCompanies(): Promise<Array<{id: string, name: string}>> {
  // TODO: Implement based on your company storage
  // For now, return empty array
  return [];
}

/**
 * Helper: Get existing contacts for matching
 */
private async getExistingContacts(): Promise<Array<{id: string, name: string, email?: string}>> {
  // TODO: Implement based on your contact storage
  return [];
}

/**
 * Helper: Get existing tasks for matching
 */
private async getExistingTasks(): Promise<Array<{id: string, title: string}>> {
  // TODO: Implement based on your task storage
  return [];
}

/**
 * Helper: Get existing notes for matching
 */
private async getExistingNotes(): Promise<Array<{id: string, title: string}>> {
  // TODO: Implement based on your note storage
  return [];
}

/**
 * Helper: Create relationships from extraction results
 */
private async createRelationshipsFromExtraction(
  sessionId: string,
  extracted: Omit<RelationshipExtractionResult, 'metadata'>
): Promise<void> {
  const relationshipManager = await getRelationshipManager();

  // Create or link companies
  for (const company of extracted.companies) {
    let companyId = company.matchedId;

    if (!companyId) {
      // Create new company
      const newCompany = await this.createCompany({ name: company.name });
      companyId = newCompany.id;
      console.log(`  ✨ Created new company: ${company.name} (${companyId})`);
    }

    // Establish relationship
    await relationshipManager.addRelationship({
      sourceType: EntityType.SESSION,
      sourceId: sessionId,
      targetType: EntityType.COMPANY,
      targetId: companyId,
      type: RelationshipType.SESSION_COMPANY,
      metadata: {
        source: 'ai',
        confidence: company.confidence,
        reasoning: company.reasoning,
        mentions: company.mentions,
        createdAt: new Date().toISOString(),
      },
    });
  }

  // Create or link people
  for (const person of extracted.people) {
    let personId = person.matchedId;

    if (!personId) {
      // Create new contact
      const newContact = await this.createContact({
        name: person.name,
        email: person.email,
      });
      personId = newContact.id;
      console.log(`  ✨ Created new contact: ${person.name} (${personId})`);
    }

    await relationshipManager.addRelationship({
      sourceType: EntityType.SESSION,
      sourceId: sessionId,
      targetType: EntityType.CONTACT,
      targetId: personId,
      type: RelationshipType.SESSION_CONTACT,
      metadata: {
        source: 'ai',
        confidence: person.confidence,
        reasoning: person.reasoning,
        mentions: person.mentions,
        createdAt: new Date().toISOString(),
      },
    });
  }

  // Link existing tasks (do NOT create new ones)
  for (const task of extracted.tasks) {
    if (task.matchedId) {
      await relationshipManager.addRelationship({
        sourceType: EntityType.SESSION,
        sourceId: sessionId,
        targetType: EntityType.TASK,
        targetId: task.matchedId,
        type: RelationshipType.SESSION_TASK,
        metadata: {
          source: 'ai',
          confidence: task.confidence,
          createdAt: new Date().toISOString(),
        },
      });
    }
  }

  // Link existing notes (do NOT create new ones)
  for (const note of extracted.notes) {
    if (note.matchedId) {
      await relationshipManager.addRelationship({
        sourceType: EntityType.SESSION,
        sourceId: sessionId,
        targetType: EntityType.NOTE,
        targetId: note.matchedId,
        type: RelationshipType.SESSION_NOTE,
        metadata: {
          source: 'ai',
          confidence: note.confidence,
          createdAt: new Date().toISOString(),
        },
      });
    }
  }
}

/**
 * Helper: Calculate average confidence across all extractions
 */
private calculateAverageConfidence(extracted: Omit<RelationshipExtractionResult, 'metadata'>): number {
  const allItems = [
    ...extracted.companies,
    ...extracted.people,
    ...extracted.tasks,
    ...extracted.notes,
  ];

  if (allItems.length === 0) return 0;

  const total = allItems.reduce((sum, item) => sum + item.confidence, 0);
  return total / allItems.length;
}

/**
 * Helper: Create company (stub - implement based on your storage)
 */
private async createCompany(data: { name: string }): Promise<{ id: string, name: string }> {
  // TODO: Implement company creation
  const id = `company-${Date.now()}`;
  return { id, ...data };
}

/**
 * Helper: Create contact (stub - implement based on your storage)
 */
private async createContact(data: { name: string, email?: string }): Promise<{ id: string, name: string, email?: string }> {
  // TODO: Implement contact creation
  const id = `contact-${Date.now()}`;
  return { id, ...data };
}
```

**Step 1.3: Integrate into Main Enrichment Flow**

Update the `enrichSession` method (around line 300) to call Stage 6.3:

```typescript
// After Stage 6 (summary generation) - around line 670
console.log('[Stage 6] ✅ Summary generated');

// NEW: Stage 6.3 - Relationship Extraction
console.log('[Stage 6.3] 📊 Extracting relationships...');
const relationships = await this.stage6_3_relationshipExtraction(session, summary);
console.log('[Stage 6.3] ✅ Relationships extracted');

// Store relationships in enriched data
enrichedData.relationships = relationships;

// Continue to Stage 6.5 (canvas generation)
console.log('[Stage 6.5] 🎨 Generating canvas...');
```

**Step 1.4: Update EnrichedData Type**

Update the `EnrichedData` interface to include relationships (around line 80):

```typescript
interface EnrichedData {
  summary?: SessionSummary;
  relationships?: RelationshipExtractionResult;  // NEW
  canvasConfig?: CanvasConfig;
  // ... existing fields
}
```

#### Testing Criteria

**Unit Tests**:
- [ ] Extraction works with minimal session data
- [ ] Extraction handles sessions with no entities
- [ ] Fuzzy matching correctly identifies existing companies
- [ ] Fuzzy matching correctly identifies existing contacts
- [ ] Task/note linking only links existing entities (never creates)
- [ ] Confidence scoring is reasonable (0-1 range)
- [ ] RelationshipManager integration creates bidirectional links
- [ ] Error handling when AI returns malformed JSON

**Integration Tests**:
- [ ] Full enrichment pipeline completes with Stage 6.3
- [ ] Relationships are persisted to storage
- [ ] Incremental enrichment doesn't re-extract relationships
- [ ] Cost tracking is accurate

**Performance**:
- [ ] Stage 6.3 completes in <5 seconds for typical session
- [ ] Total enrichment time increase is acceptable (<20%)

#### Success Criteria

✅ Stage 6.3 successfully extracts companies/people
✅ Existing entities are matched with >80% accuracy
✅ New entities are created when no match found
✅ Tasks/notes are linked but never created
✅ Relationships are stored in RelationshipManager
✅ No breaking changes to existing enrichment stages

---

### PHASE 2: Relationship Canvas Module

**Agent**: Agent 2 (Canvas/UI)
**Duration**: Week 3-4
**Priority**: HIGH (parallel with Phase 1)

#### Files to Create/Modify

##### 1. `/src/components/morphing-canvas/modules/RelationshipModule.tsx` (NEW)

Create a new canvas module with 4 variants: cards, list, graph, timeline.

```typescript
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, User, CheckSquare, FileText, Network, List, LayoutGrid, Clock } from 'lucide-react';
import type { ModuleConfig, ModuleProps } from '../types/module';
import { getRadiusClass, TRANSITIONS, SHADOWS, COLOR_SCHEMES } from '../../../design-system/theme';
import { useTheme } from '../../../context/ThemeContext';
import { useRelationshipManager } from '../../../hooks/useRelationshipManager';
import { EntityType, RelationshipType } from '../../../types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface RelationshipModuleData {
  sessionId: string;
  companies: RelatedCompany[];
  people: RelatedPerson[];
  tasks: RelatedTask[];
  notes: RelatedNote[];
}

interface RelatedCompany {
  id: string;
  name: string;
  confidence?: number;
  source?: 'ai' | 'manual';
  mentions?: number;
}

interface RelatedPerson {
  id: string;
  name: string;
  email?: string;
  confidence?: number;
  source?: 'ai' | 'manual';
  mentions?: number;
}

interface RelatedTask {
  id: string;
  title: string;
  status?: string;
  confidence?: number;
}

interface RelatedNote {
  id: string;
  title: string;
  preview?: string;
  confidence?: number;
}

type RelationshipVariant = 'cards' | 'list' | 'graph' | 'timeline';

interface RelationshipModuleProps extends ModuleProps {
  data: RelationshipModuleData;
  variant?: RelationshipVariant;
  config?: ModuleConfig;
  onAction?: (action: RelationshipAction) => void;
}

type RelationshipAction =
  | { type: 'view-company'; companyId: string }
  | { type: 'view-person'; personId: string }
  | { type: 'view-task'; taskId: string }
  | { type: 'view-note'; noteId: string }
  | { type: 'remove-relationship'; entityType: EntityType; entityId: string }
  | { type: 'add-relationship'; entityType: EntityType };

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function RelationshipModule({
  data,
  variant = 'cards',
  config,
  onAction,
  isLoading = false,
  error = null,
}: RelationshipModuleProps) {
  const { colorScheme } = useTheme();
  const colors = COLOR_SCHEMES[colorScheme];
  const [localData, setLocalData] = useState(data);
  const relationshipManager = useRelationshipManager();

  // Real-time updates when relationships change
  useEffect(() => {
    if (!data.sessionId) return;

    const unsubscribe = relationshipManager.on('relationship-added', async (event) => {
      if (event.sourceId === data.sessionId || event.targetId === data.sessionId) {
        // Reload relationships for this session
        const updated = await loadRelationships(data.sessionId);
        setLocalData(updated);
      }
    });

    return unsubscribe;
  }, [data.sessionId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Network size={48} className={`text-${colors.focus} animate-pulse mx-auto`} />
          <p className="text-sm text-gray-600">Loading relationships...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // Empty state
  const isEmpty =
    localData.companies.length === 0 &&
    localData.people.length === 0 &&
    localData.tasks.length === 0 &&
    localData.notes.length === 0;

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Network size={48} className="text-gray-400 mx-auto" />
          <p className="text-sm text-gray-600">No relationships detected</p>
        </div>
      </div>
    );
  }

  // Render based on variant
  return (
    <div className="relationship-module h-full overflow-auto">
      {variant === 'cards' && <RelationshipCards data={localData} onAction={onAction} />}
      {variant === 'list' && <RelationshipList data={localData} onAction={onAction} />}
      {variant === 'graph' && <RelationshipGraph data={localData} onAction={onAction} />}
      {variant === 'timeline' && <RelationshipTimeline data={localData} onAction={onAction} />}
    </div>
  );
}

// ============================================================================
// VARIANT: CARDS
// ============================================================================

function RelationshipCards({ data, onAction }: { data: RelationshipModuleData; onAction?: (action: RelationshipAction) => void }) {
  const { colorScheme } = useTheme();
  const colors = COLOR_SCHEMES[colorScheme];

  return (
    <div className="p-4 space-y-4">
      {/* Companies Section */}
      {data.companies.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <Building2 size={14} />
            Companies ({data.companies.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.companies.map((company) => (
              <motion.div
                key={company.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => onAction?.({ type: 'view-company', companyId: company.id })}
                className={`p-3 ${getRadiusClass('element')} bg-white/60 backdrop-blur-md border border-white/50 cursor-pointer hover:border-${colors.focus}/50 ${TRANSITIONS.fast}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className={`text-${colors.focus}`} />
                    <span className="text-sm font-semibold text-gray-900">{company.name}</span>
                  </div>
                  {company.source === 'ai' && company.confidence && (
                    <span className="text-xs text-gray-500">{Math.round(company.confidence * 100)}%</span>
                  )}
                </div>
                {company.mentions && company.mentions > 1 && (
                  <p className="text-xs text-gray-500 mt-1">{company.mentions} mentions</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* People Section */}
      {data.people.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <User size={14} />
            People ({data.people.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.people.map((person) => (
              <motion.div
                key={person.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => onAction?.({ type: 'view-person', personId: person.id })}
                className={`p-3 ${getRadiusClass('element')} bg-white/60 backdrop-blur-md border border-white/50 cursor-pointer hover:border-${colors.focus}/50 ${TRANSITIONS.fast}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User size={16} className={`text-${colors.focus}`} />
                    <span className="text-sm font-semibold text-gray-900">{person.name}</span>
                  </div>
                  {person.source === 'ai' && person.confidence && (
                    <span className="text-xs text-gray-500">{Math.round(person.confidence * 100)}%</span>
                  )}
                </div>
                {person.email && (
                  <p className="text-xs text-gray-500 mt-1">{person.email}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks Section */}
      {data.tasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <CheckSquare size={14} />
            Tasks ({data.tasks.length})
          </h4>
          <div className="space-y-2">
            {data.tasks.map((task) => (
              <motion.div
                key={task.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => onAction?.({ type: 'view-task', taskId: task.id })}
                className={`p-3 ${getRadiusClass('element')} bg-white/60 backdrop-blur-md border border-white/50 cursor-pointer hover:border-${colors.focus}/50 ${TRANSITIONS.fast}`}
              >
                <div className="flex items-center gap-2">
                  <CheckSquare size={16} className={`text-${colors.focus}`} />
                  <span className="text-sm text-gray-900">{task.title}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Notes Section */}
      {data.notes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            <FileText size={14} />
            Notes ({data.notes.length})
          </h4>
          <div className="space-y-2">
            {data.notes.map((note) => (
              <motion.div
                key={note.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => onAction?.({ type: 'view-note', noteId: note.id })}
                className={`p-3 ${getRadiusClass('element')} bg-white/60 backdrop-blur-md border border-white/50 cursor-pointer hover:border-${colors.focus}/50 ${TRANSITIONS.fast}`}
              >
                <div className="flex items-center gap-2">
                  <FileText size={16} className={`text-${colors.focus}`} />
                  <span className="text-sm text-gray-900">{note.title}</span>
                </div>
                {note.preview && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{note.preview}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// VARIANT: LIST
// ============================================================================

function RelationshipList({ data, onAction }: { data: RelationshipModuleData; onAction?: (action: RelationshipAction) => void }) {
  // Similar to cards but more compact, single column
  return <div>List variant - TBD</div>;
}

// ============================================================================
// VARIANT: GRAPH
// ============================================================================

function RelationshipGraph({ data, onAction }: { data: RelationshipModuleData; onAction?: (action: RelationshipAction) => void }) {
  // Visual network diagram showing connections
  return <div>Graph variant - TBD</div>;
}

// ============================================================================
// VARIANT: TIMELINE
// ============================================================================

function RelationshipTimeline({ data, onAction }: { data: RelationshipModuleData; onAction?: (action: RelationshipAction) => void }) {
  // Chronological view of when relationships were established
  return <div>Timeline variant - TBD</div>;
}

// ============================================================================
// HELPERS
// ============================================================================

async function loadRelationships(sessionId: string): Promise<RelationshipModuleData> {
  // TODO: Implement based on RelationshipManager API
  return {
    sessionId,
    companies: [],
    people: [],
    tasks: [],
    notes: [],
  };
}
```

##### 2. `/src/components/morphing-canvas/registry/index.ts`

Add RelationshipModule to registry:

```typescript
import { RelationshipModule } from '../modules/RelationshipModule';

export const moduleDefinitions: ModuleDefinition[] = [
  // ... existing modules

  {
    type: 'relationship',
    component: RelationshipModule,
    displayName: 'Relationships',
    description: 'Shows companies, people, tasks, and notes related to this session',
    defaultConfig: {
      variant: 'cards',
      showConfidence: true,
      groupBy: 'type',
    },
    variants: ['cards', 'list', 'graph', 'timeline'],
    gridOptions: {
      minWidth: 6,
      minHeight: 4,
      defaultWidth: 12,
      defaultHeight: 6,
    },
  },
];
```

##### 3. `/src/components/morphing-canvas/types/module.ts`

Add type definitions for RelationshipModule:

```typescript
export type ModuleType =
  | 'clock'
  | 'quick-actions'
  | 'notes'
  | 'task'
  | 'timeline'
  | 'screenshot-gallery'
  | 'video-chapter-navigator'
  | 'code-changes'
  | 'relationship';  // NEW

// Add to module data union
export type ModuleData =
  | ClockModuleData
  | QuickActionsModuleData
  | NotesModuleData
  | TaskModuleData
  | TimelineModuleData
  | ScreenshotGalleryModuleData
  | VideoChapterNavigatorModuleData
  | CodeChangesModuleData
  | RelationshipModuleData;  // NEW
```

##### 4. `/src/components/SessionDetailView.tsx`

Update default view logic (around line 74):

```typescript
// OLD: Always show full summary
const [mode, setMode] = useState<ViewMode>('full');

// NEW: Show canvas if available, otherwise summary
const [mode, setMode] = useState<ViewMode>(() => {
  const hasCanvas = session.enrichedData?.canvasConfig?.hasCanvas;
  return hasCanvas ? 'canvas' : 'full';
});
```

Add view tabs when canvas exists:

```typescript
// Add after session header (around line 150)
{session.enrichedData?.canvasConfig?.hasCanvas && (
  <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-200">
    <button
      onClick={() => setMode('canvas')}
      className={`px-4 py-2 ${getRadiusClass('element')} text-sm font-semibold ${TRANSITIONS.fast} ${
        mode === 'canvas'
          ? `bg-gradient-to-r from-${colors.primary.from} to-${colors.primary.to} text-white`
          : 'bg-white/50 text-gray-700 hover:bg-white/70'
      }`}
    >
      Canvas
    </button>
    <button
      onClick={() => setMode('full')}
      className={`px-4 py-2 ${getRadiusClass('element')} text-sm font-semibold ${TRANSITIONS.fast} ${
        mode === 'full'
          ? `bg-gradient-to-r from-${colors.primary.from} to-${colors.primary.to} text-white`
          : 'bg-white/50 text-gray-700 hover:bg-white/70'
      }`}
    >
      Summary
    </button>
  </div>
)}

{/* Conditional rendering based on mode */}
{mode === 'canvas' && session.enrichedData?.canvasConfig && (
  <MorphingCanvas
    config={session.enrichedData.canvasConfig}
    sessionId={session.id}
  />
)}

{mode === 'full' && (
  <SessionSummaryView session={session} />
)}
```

#### Testing Criteria

**Unit Tests**:
- [ ] RelationshipModule renders with data
- [ ] Cards variant displays all entity types
- [ ] Empty state shows when no relationships
- [ ] Loading state displays correctly
- [ ] Error state displays correctly
- [ ] Click handlers emit correct actions

**Integration Tests**:
- [ ] Module is registered in canvas system
- [ ] Module receives data from canvas config
- [ ] Module renders in CSS grid layout
- [ ] Real-time updates work when relationships added
- [ ] SessionDetailView shows canvas when available
- [ ] SessionDetailView shows summary when no canvas
- [ ] View tabs work correctly

**Visual Tests**:
- [ ] Cards variant is responsive (mobile, tablet, desktop)
- [ ] Design system styles applied correctly
- [ ] Animations are smooth (60fps)
- [ ] Hover states work correctly
- [ ] Colors match theme

#### Success Criteria

✅ RelationshipModule component complete with 4 variants
✅ Module registered in canvas system
✅ SessionDetailView defaults to canvas when available
✅ View tabs allow switching between canvas/summary
✅ Real-time updates work when relationships change
✅ No visual regressions in existing canvas modules

---

### PHASE 2.5: Bidirectional Relationship Creation

**Agent**: Agent 3 (Integration)
**Duration**: Week 4-5
**Priority**: MEDIUM (depends on Phase 1 + 2)

#### Files to Modify

##### 1. `/src/components/morphing-canvas/MorphingCanvas.tsx`

Add action handler for create-task/create-note:

```typescript
interface MorphingCanvasProps {
  config: CanvasConfig;
  sessionId: string;  // NEW: Required for relationship context
  onAction?: (action: CanvasAction) => void;
}

export function MorphingCanvas({ config, sessionId, onAction }: MorphingCanvasProps) {
  const relationshipManager = useRelationshipManager();
  const { createTask } = useTasks();
  const { createNote } = useNotes();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleModuleAction = async (action: ModuleAction, module: ModuleConfig) => {
    console.log('[Canvas] Module action:', action.type, module.type);

    switch (action.type) {
      case 'create-task': {
        try {
          // Create task
          const newTask = await createTask({
            title: action.payload.title || 'Untitled Task',
            description: action.payload.description || '',
            status: 'todo',
            createdFrom: 'canvas',
          });

          console.log('[Canvas] Created task:', newTask.id);

          // ✅ AUTO-ESTABLISH RELATIONSHIP
          await relationshipManager.addRelationship({
            sourceType: EntityType.SESSION,
            sourceId: sessionId,
            targetType: EntityType.TASK,
            targetId: newTask.id,
            type: RelationshipType.SESSION_TASK,
            metadata: {
              source: 'manual',
              createdAt: new Date().toISOString(),
              createdFrom: 'canvas',
            },
          });

          console.log('[Canvas] ✅ Relationship established: session → task');

          // Trigger canvas refresh to show new relationship
          setRefreshKey(prev => prev + 1);
          onAction?.({ type: 'task-created', taskId: newTask.id });

        } catch (error) {
          console.error('[Canvas] Failed to create task:', error);
          onAction?.({ type: 'error', error: 'Failed to create task' });
        }
        break;
      }

      case 'create-note': {
        try {
          // Create note
          const newNote = await createNote({
            title: action.payload.title || 'Untitled Note',
            content: action.payload.content || '',
            createdFrom: 'canvas',
          });

          console.log('[Canvas] Created note:', newNote.id);

          // ✅ AUTO-ESTABLISH RELATIONSHIP
          await relationshipManager.addRelationship({
            sourceType: EntityType.SESSION,
            sourceId: sessionId,
            targetType: EntityType.NOTE,
            targetId: newNote.id,
            type: RelationshipType.SESSION_NOTE,
            metadata: {
              source: 'manual',
              createdAt: new Date().toISOString(),
              createdFrom: 'canvas',
            },
          });

          console.log('[Canvas] ✅ Relationship established: session → note');

          // Trigger canvas refresh
          setRefreshKey(prev => prev + 1);
          onAction?.({ type: 'note-created', noteId: newNote.id });

        } catch (error) {
          console.error('[Canvas] Failed to create note:', error);
          onAction?.({ type: 'error', error: 'Failed to create note' });
        }
        break;
      }

      case 'link-company': {
        // Handle linking existing company to session
        try {
          await relationshipManager.addRelationship({
            sourceType: EntityType.SESSION,
            sourceId: sessionId,
            targetType: EntityType.COMPANY,
            targetId: action.payload.companyId,
            type: RelationshipType.SESSION_COMPANY,
            metadata: {
              source: 'manual',
              createdAt: new Date().toISOString(),
              createdFrom: 'canvas',
            },
          });

          setRefreshKey(prev => prev + 1);
          onAction?.({ type: 'company-linked', companyId: action.payload.companyId });
        } catch (error) {
          console.error('[Canvas] Failed to link company:', error);
        }
        break;
      }

      case 'link-person': {
        // Handle linking existing person to session
        try {
          await relationshipManager.addRelationship({
            sourceType: EntityType.SESSION,
            sourceId: sessionId,
            targetType: EntityType.CONTACT,
            targetId: action.payload.personId,
            type: RelationshipType.SESSION_CONTACT,
            metadata: {
              source: 'manual',
              createdAt: new Date().toISOString(),
              createdFrom: 'canvas',
            },
          });

          setRefreshKey(prev => prev + 1);
          onAction?.({ type: 'person-linked', personId: action.payload.personId });
        } catch (error) {
          console.error('[Canvas] Failed to link person:', error);
        }
        break;
      }

      default:
        // Pass through to parent
        onAction?.(action);
    }
  };

  return (
    <div
      className="morphing-canvas"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gridTemplateRows: 'repeat(auto-fill, 80px)',
        gap: '16px',
      }}
    >
      {config.modules.map((moduleConfig, index) => (
        <ModuleRenderer
          key={`${moduleConfig.type}-${index}-${refreshKey}`}
          config={moduleConfig}
          onAction={(action) => handleModuleAction(action, moduleConfig)}
        />
      ))}
    </div>
  );
}
```

##### 2. `/src/components/morphing-canvas/modules/QuickActionsModule.tsx`

Update to emit create actions:

```typescript
export function QuickActionsModule({ sessionId, onAction }: QuickActionsModuleProps) {
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showCreateNoteModal, setShowCreateNoteModal] = useState(false);

  const handleCreateTask = (taskData: { title: string; description: string }) => {
    // Emit action to canvas (canvas will handle creation + relationship)
    onAction?.({
      type: 'create-task',
      payload: taskData,
    });
    setShowCreateTaskModal(false);
  };

  const handleCreateNote = (noteData: { title: string; content: string }) => {
    // Emit action to canvas (canvas will handle creation + relationship)
    onAction?.({
      type: 'create-note',
      payload: noteData,
    });
    setShowCreateNoteModal(false);
  };

  return (
    <div className="quick-actions-module p-4 space-y-3">
      <button
        onClick={() => setShowCreateTaskModal(true)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-white/60 rounded-lg hover:bg-white/80 transition"
      >
        <Plus size={16} />
        <span className="text-sm font-semibold">Create Task from Session</span>
      </button>

      <button
        onClick={() => setShowCreateNoteModal(true)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-white/60 rounded-lg hover:bg-white/80 transition"
      >
        <FileText size={16} />
        <span className="text-sm font-semibold">Create Note from Session</span>
      </button>

      {/* Modals */}
      {showCreateTaskModal && (
        <CreateTaskModal
          onSubmit={handleCreateTask}
          onClose={() => setShowCreateTaskModal(false)}
        />
      )}

      {showCreateNoteModal && (
        <CreateNoteModal
          onSubmit={handleCreateNote}
          onClose={() => setShowCreateNoteModal(false)}
        />
      )}
    </div>
  );
}
```

##### 3. `/src/components/morphing-canvas/modules/RelationshipModule.tsx`

Add real-time subscription (already included in Phase 2 code above).

##### 4. `/src/hooks/useRelationshipManager.ts` (create if doesn't exist)

```typescript
import { useEffect, useState } from 'react';
import { relationshipManager } from '../services/relationshipManager';
import type { Relationship, EntityType } from '../types';

export function useRelationshipManager() {
  return relationshipManager;
}

export function useSessionRelationships(sessionId: string) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRelationships();

    // Subscribe to changes
    const unsubscribe = relationshipManager.on('relationship-added', (event) => {
      if (event.sourceId === sessionId || event.targetId === sessionId) {
        loadRelationships();
      }
    });

    return unsubscribe;
  }, [sessionId]);

  const loadRelationships = async () => {
    setIsLoading(true);
    const rels = await relationshipManager.getRelationshipsForEntity(
      'session' as EntityType,
      sessionId
    );
    setRelationships(rels);
    setIsLoading(false);
  };

  return { relationships, isLoading, refresh: loadRelationships };
}
```

#### Testing Criteria

**Unit Tests**:
- [ ] Canvas emits create-task action correctly
- [ ] Canvas emits create-note action correctly
- [ ] Relationship is established after task creation
- [ ] Relationship is established after note creation
- [ ] Canvas refreshes after relationship added
- [ ] Error handling works when creation fails

**Integration Tests**:
- [ ] Create task from QuickActions → Relationship appears in RelationshipModule
- [ ] Create note from QuickActions → Relationship appears in RelationshipModule
- [ ] Real-time updates work across modules
- [ ] Duplicate relationships are prevented
- [ ] Relationships persist after page reload

**Edge Case Tests**:
- [ ] Creating task when RelationshipManager unavailable
- [ ] Creating multiple tasks/notes in quick succession
- [ ] Network failure during relationship creation
- [ ] Session without relationship module can still create tasks/notes

#### Success Criteria

✅ Tasks created from canvas auto-establish relationships
✅ Notes created from canvas auto-establish relationships
✅ RelationshipModule updates in real-time
✅ No duplicate relationships created
✅ Error handling is graceful (doesn't break UX)

---

### PHASE 3: Canvas Generation Logic Update

**Agent**: Agent 1 (Backend Services)
**Duration**: Week 5-6
**Priority**: MEDIUM (depends on Phase 1 + 2)

#### Files to Modify

##### 1. `/src/services/sessionEnrichmentService.ts`

Update Stage 6.5 to always include RelationshipModule when relationships exist:

```typescript
/**
 * Stage 6.5: Canvas Configuration Generation
 *
 * Updated to include RelationshipModule when relationships detected.
 */
private async stage6_5_canvasGeneration(
  session: Session,
  relationships: RelationshipExtractionResult
): Promise<CanvasConfig> {

  console.log('🎨 [Stage 6.5] Generating canvas configuration...');

  const modules: ModuleConfig[] = [];

  // ALWAYS include relationship module if relationships exist
  const hasRelationships =
    relationships.companies.length > 0 ||
    relationships.people.length > 0 ||
    relationships.tasks.length > 0 ||
    relationships.notes.length > 0;

  if (hasRelationships) {
    modules.push({
      type: 'relationship',
      variant: 'cards',
      gridArea: 'relationships',
      data: {
        sessionId: session.id,
        companies: relationships.companies,
        people: relationships.people,
        tasks: relationships.tasks,
        notes: relationships.notes,
      },
      config: {
        showConfidence: true,
        groupBy: 'type',
      },
    });

    console.log(`  ✅ Added RelationshipModule (${relationships.companies.length} companies, ${relationships.people.length} people, ${relationships.tasks.length} tasks, ${relationships.notes.length} notes)`);
  }

  // Add other modules based on session content

  // Timeline module (always include if session has duration)
  if (session.duration && session.duration > 0) {
    modules.push({
      type: 'timeline',
      variant: 'default',
      gridArea: 'timeline',
      data: {
        events: this.generateTimelineEvents(session),
      },
    });
  }

  // Screenshot gallery (if screenshots exist)
  if (session.screenshots && session.screenshots.length > 0) {
    modules.push({
      type: 'screenshot-gallery',
      variant: 'grid',
      gridArea: 'screenshots',
      data: {
        screenshots: session.screenshots,
      },
    });
  }

  // Video chapter navigator (if video exists)
  if (session.videoAnalysis?.chapters && session.videoAnalysis.chapters.length > 0) {
    modules.push({
      type: 'video-chapter-navigator',
      variant: 'default',
      gridArea: 'video',
      data: {
        chapters: session.videoAnalysis.chapters,
      },
    });
  }

  // QuickActions module (always include)
  modules.push({
    type: 'quick-actions',
    variant: 'default',
    gridArea: 'actions',
    data: {
      sessionId: session.id,
    },
  });

  // Determine if we have enough content for canvas
  // Minimum 3 modules required
  const hasCanvas = modules.length >= 3;

  console.log(`  🎨 Canvas has ${modules.length} modules (hasCanvas: ${hasCanvas})`);

  // Generate layout (12-column grid)
  const layout = this.generateCanvasLayout(modules);

  return {
    layout,
    modules,
    hasCanvas,
  };
}

/**
 * Generate CSS Grid layout based on modules
 */
private generateCanvasLayout(modules: ModuleConfig[]): string {
  // Simple auto layout for now
  // Future: AI-driven intelligent layout
  return 'auto';
}

/**
 * Generate timeline events from session data
 */
private generateTimelineEvents(session: Session): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Add screenshot events
  session.screenshots?.forEach(screenshot => {
    events.push({
      timestamp: screenshot.timestamp,
      type: 'screenshot',
      title: screenshot.detectedActivity || 'Screenshot captured',
      data: screenshot,
    });
  });

  // Add audio key moments
  session.audioTranscription?.keyMoments?.forEach(moment => {
    events.push({
      timestamp: moment.timestamp,
      type: 'audio-moment',
      title: moment.excerpt,
      data: moment,
    });
  });

  // Add video chapter markers
  session.videoAnalysis?.chapters?.forEach(chapter => {
    events.push({
      timestamp: chapter.startTime,
      type: 'chapter',
      title: chapter.title,
      data: chapter,
    });
  });

  // Sort chronologically
  return events.sort((a, b) => a.timestamp - b.timestamp);
}
```

#### Testing Criteria

**Unit Tests**:
- [ ] Canvas generation includes RelationshipModule when relationships exist
- [ ] Canvas generation omits RelationshipModule when no relationships
- [ ] hasCanvas flag is true when ≥3 modules
- [ ] hasCanvas flag is false when <3 modules
- [ ] Layout generation handles all module combinations

**Integration Tests**:
- [ ] Full enrichment creates canvas with relationship module
- [ ] Session with no relationships still creates canvas (if other modules present)
- [ ] Canvas config is valid and can be rendered by MorphingCanvas

#### Success Criteria

✅ RelationshipModule auto-included when relationships detected
✅ Canvas has minimum 3 modules to be considered "canvas-worthy"
✅ Layout generation works for all module combinations
✅ hasCanvas flag accurately reflects canvas availability

---

### PHASE 4: Default View Logic Change

**Agent**: Agent 2 (Canvas/UI)
**Duration**: Week 6-7
**Priority**: MEDIUM (depends on Phase 3)

(Already documented in Phase 2, step 4)

---

### PHASE 5: Integration Testing & Polish

**Agent**: Agent 4 (QA/Testing)
**Duration**: Week 7-8
**Priority**: HIGH (final phase)

#### Test Scenarios

##### End-to-End Flow 1: AI Extraction
1. Start session with screen recording
2. Visit company website (e.g., "Acme Corp")
3. Send email to person (e.g., "jane@acme.com")
4. End session
5. Wait for enrichment
6. Verify:
   - [ ] Company "Acme Corp" detected
   - [ ] Person "Jane" detected
   - [ ] Relationships appear in canvas
   - [ ] Canvas is default view

##### End-to-End Flow 2: Manual Creation
1. Open enriched session canvas
2. Click "Create Task from Session"
3. Enter task title "Follow up with Acme"
4. Save task
5. Verify:
   - [ ] Task created successfully
   - [ ] Relationship established automatically
   - [ ] Task appears in RelationshipModule immediately
   - [ ] Task persists after page reload

##### End-to-End Flow 3: Matching Existing Entities
1. Create company "Google Inc" manually
2. Start session
3. Mention "Google" in audio/screenshots
4. End session and enrich
5. Verify:
   - [ ] AI matches "Google" to "Google Inc" (fuzzy match)
   - [ ] No duplicate company created
   - [ ] Relationship links to existing company
   - [ ] Confidence score is reasonable (>0.8)

##### End-to-End Flow 4: Fallback to Summary
1. Create very short session (10 seconds, no screenshots)
2. End session and enrich
3. Verify:
   - [ ] No canvas generated (insufficient data)
   - [ ] SessionDetailView shows summary (not canvas)
   - [ ] No errors or broken UI

##### Performance Testing
- [ ] Enrichment time increase <20% (Stage 6.3 adds ~2-3 sec)
- [ ] Canvas renders in <1 second
- [ ] Real-time relationship updates trigger in <500ms
- [ ] No memory leaks from event subscriptions

##### Regression Testing
- [ ] Existing canvas modules still work
- [ ] Summary view unchanged
- [ ] Session recording unaffected
- [ ] Existing relationships (non-AI) still work
- [ ] Session deletion still works

##### Edge Cases
- [ ] Session with 100+ screenshots (performance)
- [ ] Session with no audio (extraction still works)
- [ ] Session with no video (extraction still works)
- [ ] Multiple sessions enriching simultaneously
- [ ] Network failure during enrichment
- [ ] Invalid JSON from AI (error handling)

#### Test Files to Create

```
/src/services/__tests__/
  ├─ sessionEnrichmentService.relationship.test.ts
  ├─ relationshipExtraction.fuzzyMatch.test.ts
  └─ relationshipExtraction.performance.test.ts

/src/components/morphing-canvas/modules/__tests__/
  ├─ RelationshipModule.test.tsx
  ├─ RelationshipModule.realtime.test.tsx
  └─ RelationshipModule.variants.test.tsx

/src/components/__tests__/
  ├─ SessionDetailView.canvasDefault.test.tsx
  └─ MorphingCanvas.bidirectional.test.tsx

/e2e/
  ├─ relationship-extraction.spec.ts
  ├─ canvas-default-view.spec.ts
  └─ manual-relationship-creation.spec.ts
```

#### Success Criteria

✅ All unit tests pass with >80% coverage
✅ All integration tests pass
✅ All E2E scenarios pass
✅ Performance benchmarks met
✅ No regressions in existing features
✅ Documentation updated (README, CHANGELOG)

---

## 📊 Cost & Performance Analysis

### Enrichment Cost Breakdown

| Stage | Model | Tokens | Cost | Time |
|-------|-------|--------|------|------|
| Summary (Stage 6) | Claude Sonnet 4.5 | ~3K | ~$0.08 | 3-5s |
| **Relationships (Stage 6.3)** | **Claude Sonnet 4.5** | **~2K** | **~$0.05** | **2-3s** |
| Canvas (Stage 6.5) | Internal | - | $0 | <1s |
| **Total (with Relationships)** | - | **~5K** | **~$0.13** | **5-9s** |

### Cache Hit Rate Impact

With IncrementalEnrichmentService:
- **First enrichment**: $0.13 (full cost)
- **Incremental updates**: $0.03-0.05 (70-90% savings)
- **No changes**: $0 (cache hit)

### Performance Impact

- **Enrichment time increase**: +30-40% (acceptable)
- **UI responsiveness**: No impact (enrichment runs in background)
- **Canvas render time**: <1s (no change)
- **Real-time updates**: <500ms (event-driven)

---

## 🚀 Deployment Plan

### Week 7: Staging Deployment

1. Merge all feature branches to `feature/ai-relationships`
2. Deploy to staging environment
3. Run full test suite
4. Manual QA with real sessions
5. Performance profiling
6. Cost monitoring (track actual AI costs)

### Week 8: Production Rollout

**Phase 1**: Feature flag (20% of users)
- Monitor for errors
- Track enrichment costs
- Gather user feedback

**Phase 2**: Feature flag (50% of users)
- Validate performance at scale
- Monitor relationship accuracy
- Adjust confidence thresholds if needed

**Phase 3**: Full rollout (100% of users)
- Enable by default
- Announce in release notes
- Monitor support tickets

---

## 📚 Documentation Updates Required

### User-Facing Docs

- [ ] "What's New in v2.0" blog post
- [ ] Canvas documentation (updated with Relationship module)
- [ ] Session enrichment explanation
- [ ] How to manually add/remove relationships

### Developer Docs

- [ ] SessionEnrichmentService Stage 6.3 documentation
- [ ] RelationshipModule API reference
- [ ] Canvas module development guide (updated)
- [ ] Migration guide for existing sessions

### Internal Docs

- [ ] Architecture decision record (ADR) for AI relationship extraction
- [ ] Cost monitoring dashboard setup
- [ ] Troubleshooting guide for relationship extraction issues

---

## 🔄 Rollback Plan

If critical issues discovered in production:

1. **Immediate**: Disable Stage 6.3 via feature flag
2. **Day 1**: Deploy hotfix to skip relationship extraction
3. **Day 2**: Investigate root cause, fix, redeploy to staging
4. **Day 3**: Gradual re-enable (10% → 50% → 100%)

**Rollback Triggers**:
- Enrichment failure rate >5%
- Enrichment time >20 seconds
- Cost per session >$0.20
- Canvas rendering errors >1%

---

## ✅ Final Checklist

### Phase 1 Complete
- [ ] Stage 6.3 implemented in sessionEnrichmentService.ts
- [ ] Entity matching algorithms working
- [ ] RelationshipManager integration complete
- [ ] Unit tests pass
- [ ] Integration tests pass

### Phase 2 Complete
- [ ] RelationshipModule component created
- [ ] Module registered in canvas system
- [ ] Cards variant implemented
- [ ] SessionDetailView defaults to canvas
- [ ] View tabs work correctly

### Phase 2.5 Complete
- [ ] MorphingCanvas handles create-task/create-note
- [ ] Relationships auto-established on creation
- [ ] Real-time updates working
- [ ] Edge cases handled

### Phase 3 Complete
- [ ] Canvas generation includes RelationshipModule
- [ ] hasCanvas logic correct
- [ ] Layout generation works

### Phase 4 Complete
- [ ] Canvas is default view when available
- [ ] Summary is fallback when no canvas
- [ ] View switching works

### Phase 5 Complete
- [ ] All E2E scenarios pass
- [ ] Performance benchmarks met
- [ ] No regressions
- [ ] Documentation updated

### Deployment Complete
- [ ] Staging deployment successful
- [ ] Production rollout (20% → 50% → 100%)
- [ ] Monitoring in place
- [ ] User feedback collected

---

## 🎯 Success Metrics (Post-Launch)

### Technical Metrics
- Relationship extraction accuracy: >80%
- Enrichment time increase: <40%
- Cost per session: <$0.15
- Canvas adoption rate: >60% of enriched sessions
- Error rate: <1%

### User Metrics
- User satisfaction (NPS): +10 points
- Time saved per session: -30% (fewer manual links)
- Canvas engagement: >70% of users interact with relationships
- Feature usage: >50% of users create tasks/notes from canvas

---

**End of Implementation Plan**

This plan is a living document. Update as implementation progresses and requirements evolve.