# Agent Execution Guide
## AI Relationship Extraction + Canvas Integration

**Plan Reference**: `/docs/plans/ai-relationship-extraction-plan.md`
**Created**: 2025-10-26

---

## 🎯 Quick Reference

| Agent | Primary Role | Files to Modify | Duration | Dependencies |
|-------|--------------|-----------------|----------|--------------|
| Agent 1 | Backend/Enrichment | 1 file (sessionEnrichmentService.ts) | Week 1-2, 5-6 | None (Phase 1), Phase 1+2 (Phase 3) |
| Agent 2 | Canvas/UI | 4 files | Week 3-4, 6-7 | None (Phase 2), Phase 3 (Phase 4) |
| Agent 3 | Integration | 5 files | Week 4-5 | Phase 1 + Phase 2 |
| Agent 4 | QA/Testing | Test files | Week 7-8 | All phases |

---

## 👤 AGENT 1: Backend Services (Enrichment Pipeline)

### Mission
Implement AI-powered relationship extraction as Stage 6.3 in the enrichment pipeline, then update canvas generation to include the relationship module.

### Skills Required
- TypeScript/Node.js proficiency
- Experience with Claude API
- Understanding of async/await patterns
- Knowledge of SessionEnrichmentService architecture
- Familiarity with RelationshipManager

### Phases Assigned
- **Phase 1**: Relationship Extraction Stage (Week 1-2) - SOLO
- **Phase 3**: Canvas Generation Update (Week 5-6) - After Phase 1+2 complete

---

### PHASE 1 INSTRUCTIONS: Relationship Extraction Stage

**Goal**: Add Stage 6.3 to `sessionEnrichmentService.ts` that uses Claude to detect companies, people, and links to existing tasks/notes.

**Context**:
- You're working in a 10-stage enrichment pipeline
- Stage 6 generates summary (already exists)
- Your new Stage 6.3 runs AFTER Stage 6 (uses summary context)
- Stage 6.5 generates canvas (already exists, you'll update in Phase 3)

**File to Modify**: `/src/services/sessionEnrichmentService.ts`

**Step-by-Step Instructions**:

1. **Add TypeScript interfaces** (around line 50):
   - Copy interfaces from plan: `RelationshipExtractionResult`, `ExtractedCompany`, `ExtractedPerson`, `LinkedTask`, `LinkedNote`
   - Update `EnrichedData` interface to include `relationships?: RelationshipExtractionResult`

2. **Add helper methods for entity matching** (after line 600):
   ```typescript
   private async getExistingCompanies()
   private async getExistingContacts()
   private async getExistingTasks()
   private async getExistingNotes()
   ```
   - **Important**: These currently return empty arrays (stubs)
   - TODO for later: Connect to actual storage
   - Document clearly that these need implementation

3. **Add main extraction method** `stage6_3_relationshipExtraction()`:
   - Gather session content (screenshots, audio, video)
   - Get existing entities for matching
   - Build AI prompt (see plan for full prompt template)
   - Call Claude Sonnet 4.5 with `temperature: 0.3`
   - Parse JSON response
   - Call `createRelationshipsFromExtraction()`
   - Return result with metadata

4. **Add relationship creation method** `createRelationshipsFromExtraction()`:
   - For companies: Create new if no match, then establish SESSION_COMPANY relationship
   - For people: Create new if no match, then establish SESSION_CONTACT relationship
   - For tasks: Only link if exists (NEVER create), establish SESSION_TASK relationship
   - For notes: Only link if exists (NEVER create), establish SESSION_NOTE relationship
   - Use RelationshipManager for all relationship operations
   - Log each relationship created

5. **Add helper methods**:
   ```typescript
   private calculateAverageConfidence()
   private createCompany() // stub
   private createContact() // stub
   ```

6. **Integrate into enrichSession() flow** (around line 670):
   ```typescript
   // After Stage 6 completes
   console.log('[Stage 6.3] 📊 Extracting relationships...');
   const relationships = await this.stage6_3_relationshipExtraction(session, summary);
   enrichedData.relationships = relationships;
   console.log('[Stage 6.3] ✅ Relationships extracted');

   // Continue to Stage 6.5 (canvas)
   ```

**Testing Requirements**:
- Write unit tests for fuzzy matching logic
- Test with empty/minimal session data
- Test with sessions containing companies/people
- Verify relationships are created in RelationshipManager
- Verify no duplicate relationships created
- Test error handling (malformed AI response)

**Definition of Done**:
- [ ] Stage 6.3 method implemented and integrated
- [ ] AI prompt correctly extracts entities
- [ ] RelationshipManager integration working
- [ ] Unit tests pass with >80% coverage
- [ ] Integration tests pass (full enrichment completes)
- [ ] Console logs clearly show Stage 6.3 execution
- [ ] Documentation comments added to all methods

**Important Notes**:
- Keep `temperature: 0.3` for consistent extraction
- Use exact model: `claude-sonnet-4-5-20250929`
- Log extraction results clearly for debugging
- Handle AI errors gracefully (don't break enrichment)
- If Stage 6.3 fails, log error and continue to Stage 6.5

**Hand-off to Phase 3**:
Once complete, notify Agent 2 that relationship data is now available in `session.enrichedData.relationships`. Phase 3 will update Stage 6.5 to include this in canvas config.

---

### PHASE 3 INSTRUCTIONS: Canvas Generation Update

**Goal**: Update Stage 6.5 to always include RelationshipModule in canvas when relationships exist.

**Prerequisite**: Phase 1 complete, Phase 2 complete (RelationshipModule exists)

**File to Modify**: `/src/services/sessionEnrichmentService.ts`

**Step-by-Step Instructions**:

1. **Update `stage6_5_canvasGeneration()` signature**:
   ```typescript
   private async stage6_5_canvasGeneration(
     session: Session,
     relationships: RelationshipExtractionResult  // ADD THIS PARAMETER
   ): Promise<CanvasConfig>
   ```

2. **Add relationship module to canvas** (first module in array):
   ```typescript
   const modules: ModuleConfig[] = [];

   // Check if relationships exist
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

     console.log(`  ✅ Added RelationshipModule`);
   }

   // Continue with other modules (timeline, screenshots, etc.)
   ```

3. **Update hasCanvas logic**:
   ```typescript
   // Canvas requires minimum 3 modules
   const hasCanvas = modules.length >= 3;
   ```

4. **Update method call in enrichSession()**:
   ```typescript
   // Pass relationships to canvas generation
   const canvasConfig = await this.stage6_5_canvasGeneration(session, relationships);
   ```

**Testing Requirements**:
- Test canvas generation with relationships
- Test canvas generation without relationships
- Verify hasCanvas flag is correct
- Verify RelationshipModule data structure is correct

**Definition of Done**:
- [ ] RelationshipModule included when relationships exist
- [ ] Canvas generated correctly with relationship data
- [ ] hasCanvas logic accurate (≥3 modules)
- [ ] Tests pass
- [ ] No breaking changes to existing canvas modules

**Hand-off to Agent 2**:
Once complete, canvas configs will include relationship module. Agent 2 will update SessionDetailView to default to canvas view (Phase 4).

---

## 👤 AGENT 2: Canvas/UI (Module Development)

### Mission
Create the RelationshipModule component, register it in the canvas system, and update SessionDetailView to default to canvas when available.

### Skills Required
- React/TypeScript proficiency
- Framer Motion animations
- CSS Grid layouts
- Design system integration
- Module pattern understanding

### Phases Assigned
- **Phase 2**: Relationship Module (Week 3-4) - SOLO (parallel with Agent 1 Phase 1)
- **Phase 4**: Default View Change (Week 6-7) - After Phase 3 complete

---

### PHASE 2 INSTRUCTIONS: Relationship Canvas Module

**Goal**: Create a new canvas module that displays companies, people, tasks, and notes with 4 variants.

**Context**:
- Canvas modules are self-contained React components
- They receive data via props
- They emit actions upward via onAction callback
- They must be registered in `registry/index.ts`

**Files to Create/Modify**:
1. `/src/components/morphing-canvas/modules/RelationshipModule.tsx` (NEW - 450 lines)
2. `/src/components/morphing-canvas/registry/index.ts` (add module definition)
3. `/src/components/morphing-canvas/types/module.ts` (add types)

**Step-by-Step Instructions**:

#### Step 1: Create RelationshipModule.tsx

**Structure**:
```typescript
// Type definitions (lines 1-50)
interface RelationshipModuleData { ... }
interface RelatedCompany { ... }
// etc.

// Main component (lines 60-150)
export function RelationshipModule({ data, variant, config, onAction }) {
  // Real-time subscription to relationship changes
  // Loading/Error/Empty states
  // Variant rendering
}

// Variant: Cards (lines 160-280)
function RelationshipCards({ data, onAction }) {
  // 4 sections: Companies, People, Tasks, Notes
  // Each entity as a card with hover effects
}

// Variant: List (lines 290-350) - Stub for now
function RelationshipList() { ... }

// Variant: Graph (lines 360-420) - Stub for now
function RelationshipGraph() { ... }

// Variant: Timeline (lines 430-450) - Stub for now
function RelationshipTimeline() { ... }
```

**Key Features to Implement**:

1. **Real-time Updates**:
   ```typescript
   useEffect(() => {
     const unsubscribe = relationshipManager.on('relationship-added', async (event) => {
       if (event.sourceId === data.sessionId || event.targetId === data.sessionId) {
         const updated = await loadRelationships(data.sessionId);
         setLocalData(updated);
       }
     });
     return unsubscribe;
   }, [data.sessionId]);
   ```

2. **Loading State**:
   ```tsx
   if (isLoading) {
     return (
       <div className="flex items-center justify-center h-full">
         <Network size={48} className="animate-pulse" />
         <p>Loading relationships...</p>
       </div>
     );
   }
   ```

3. **Empty State**:
   ```tsx
   if (isEmpty) {
     return (
       <div className="flex items-center justify-center h-full">
         <Network size={48} className="text-gray-400" />
         <p>No relationships detected</p>
       </div>
     );
   }
   ```

4. **Cards Variant** (PRIORITY - implement this one fully):
   - 4 sections: Companies, People, Tasks, Notes
   - Each section has header with icon + count
   - Entities displayed as cards in grid (2 columns on desktop)
   - Click handler emits view-{entity} action
   - Show confidence score if source is 'ai'
   - Show mention count for companies/people
   - Use design system (getRadiusClass, COLOR_SCHEMES, TRANSITIONS)
   - Framer Motion hover effects (scale: 1.02)

5. **Other Variants** (stubs for now):
   - List: Return `<div>List variant - TBD</div>`
   - Graph: Return `<div>Graph variant - TBD</div>`
   - Timeline: Return `<div>Timeline variant - TBD</div>`

#### Step 2: Register in Canvas System

**File**: `/src/components/morphing-canvas/registry/index.ts`

Add to `moduleDefinitions` array:
```typescript
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
```

#### Step 3: Add Type Definitions

**File**: `/src/components/morphing-canvas/types/module.ts`

1. Add to `ModuleType` union:
   ```typescript
   export type ModuleType =
     | 'clock'
     | ... existing types ...
     | 'relationship';  // ADD THIS
   ```

2. Add to `ModuleData` union:
   ```typescript
   export type ModuleData =
     | ClockModuleData
     | ... existing types ...
     | RelationshipModuleData;  // ADD THIS
   ```

3. Add `RelationshipModuleData` interface if needed

**Testing Requirements**:
- Component renders with mock data
- Cards variant displays all 4 sections
- Empty state shows when no relationships
- Loading state shows while loading
- Click handlers emit correct actions
- Real-time updates work (mock RelationshipManager)
- Responsive layout (mobile, tablet, desktop)
- Design system styles applied

**Definition of Done**:
- [ ] RelationshipModule.tsx created (Cards variant fully implemented)
- [ ] Module registered in registry
- [ ] Types added to module.ts
- [ ] Unit tests pass
- [ ] Visual tests pass (Storybook/manual testing)
- [ ] No console errors
- [ ] Responsive on all screen sizes

---

### PHASE 4 INSTRUCTIONS: Default View Logic Change

**Goal**: Make canvas the default view in SessionDetailView when available, falling back to summary only when canvas doesn't exist.

**Prerequisite**: Phase 3 complete (canvas configs include relationships)

**File to Modify**: `/src/components/SessionDetailView.tsx`

**Step-by-Step Instructions**:

1. **Update initial mode state** (around line 74):
   ```typescript
   // OLD
   const [mode, setMode] = useState<ViewMode>('full');

   // NEW
   const [mode, setMode] = useState<ViewMode>(() => {
     const hasCanvas = session.enrichedData?.canvasConfig?.hasCanvas;
     return hasCanvas ? 'canvas' : 'full';
   });
   ```

2. **Add view tabs** (after session header, around line 150):
   ```tsx
   {/* View tabs - only show if canvas exists */}
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
         <Layout size={16} className="inline mr-2" />
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
         <FileText size={16} className="inline mr-2" />
         Summary
       </button>
     </div>
   )}
   ```

3. **Update content rendering**:
   ```tsx
   {/* Canvas view */}
   {mode === 'canvas' && session.enrichedData?.canvasConfig && (
     <MorphingCanvas
       config={session.enrichedData.canvasConfig}
       sessionId={session.id}
     />
   )}

   {/* Summary view */}
   {mode === 'full' && (
     <SessionSummaryView session={session} />
   )}
   ```

4. **Update MorphingCanvas import**:
   ```typescript
   import { MorphingCanvas } from './morphing-canvas/MorphingCanvas';
   ```

5. **Add icons import**:
   ```typescript
   import { Layout, FileText } from 'lucide-react';
   ```

**Testing Requirements**:
- Sessions with canvas default to canvas view
- Sessions without canvas default to summary view
- View tabs only show when canvas exists
- Tab switching works smoothly
- Canvas renders correctly
- Summary still works as before
- No visual regressions

**Definition of Done**:
- [ ] Canvas is default when available
- [ ] Summary is fallback when no canvas
- [ ] View tabs work correctly
- [ ] Tests pass
- [ ] No console errors
- [ ] Smooth animations

---

## 👤 AGENT 3: Integration (Bidirectional Flows)

### Mission
Implement auto-linking when tasks/notes are created from canvas, and ensure real-time relationship updates across modules.

### Skills Required
- React hooks (useEffect, custom hooks)
- Event-driven architecture
- RelationshipManager API
- Context management (Tasks, Notes)

### Phases Assigned
- **Phase 2.5**: Bidirectional Creation (Week 4-5) - After Phase 1 + Phase 2

---

### PHASE 2.5 INSTRUCTIONS: Bidirectional Relationship Creation

**Goal**: When users create tasks/notes from canvas, automatically establish relationships with the session.

**Prerequisite**: Phase 1 complete (relationships work), Phase 2 complete (RelationshipModule exists)

**Files to Modify**:
1. `/src/components/morphing-canvas/MorphingCanvas.tsx`
2. `/src/components/morphing-canvas/modules/QuickActionsModule.tsx`
3. `/src/components/morphing-canvas/modules/RelationshipModule.tsx` (already has real-time from Phase 2)
4. `/src/hooks/useRelationshipManager.ts` (create if doesn't exist)
5. `/src/hooks/useSessionRelationships.ts` (create new)

**Step-by-Step Instructions**:

#### Step 1: Update MorphingCanvas.tsx

**Goal**: Intercept create-task/create-note actions, create entity, establish relationship, refresh canvas.

**Changes**:

1. **Update props** to require sessionId:
   ```typescript
   interface MorphingCanvasProps {
     config: CanvasConfig;
     sessionId: string;  // NEW - Required for relationship context
     onAction?: (action: CanvasAction) => void;
   }
   ```

2. **Add hooks**:
   ```typescript
   const relationshipManager = useRelationshipManager();
   const { createTask } = useTasks();
   const { createNote } = useNotes();
   const [refreshKey, setRefreshKey] = useState(0);
   ```

3. **Add handleModuleAction function**:
   ```typescript
   const handleModuleAction = async (action: ModuleAction, module: ModuleConfig) => {
     switch (action.type) {
       case 'create-task': {
         // 1. Create task
         const newTask = await createTask({ ... });

         // 2. Establish relationship
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

         // 3. Refresh canvas to show new relationship
         setRefreshKey(prev => prev + 1);
         onAction?.({ type: 'task-created', taskId: newTask.id });
         break;
       }

       case 'create-note': {
         // Similar to create-task
       }

       case 'link-company': {
         // Link existing company to session
       }

       case 'link-person': {
         // Link existing person to session
       }
     }
   };
   ```

4. **Update module rendering** to pass action handler:
   ```tsx
   {config.modules.map((moduleConfig, index) => (
     <ModuleRenderer
       key={`${moduleConfig.type}-${index}-${refreshKey}`}
       config={moduleConfig}
       onAction={(action) => handleModuleAction(action, moduleConfig)}
     />
   ))}
   ```

**Error Handling**:
- Wrap all operations in try/catch
- Log errors clearly
- Emit error action to parent: `onAction?.({ type: 'error', error: 'message' })`
- Don't break canvas on errors

#### Step 2: Update QuickActionsModule.tsx

**Goal**: Emit create-task/create-note actions instead of directly creating.

**Changes**:

1. **Add state for modals**:
   ```typescript
   const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
   const [showCreateNoteModal, setShowCreateNoteModal] = useState(false);
   ```

2. **Add handler functions**:
   ```typescript
   const handleCreateTask = (taskData: { title: string; description: string }) => {
     onAction?.({
       type: 'create-task',
       payload: taskData,
     });
     setShowCreateTaskModal(false);
   };

   const handleCreateNote = (noteData: { title: string; content: string }) => {
     onAction?.({
       type: 'create-note',
       payload: noteData,
     });
     setShowCreateNoteModal(false);
   };
   ```

3. **Add buttons**:
   ```tsx
   <button onClick={() => setShowCreateTaskModal(true)}>
     <Plus size={16} /> Create Task from Session
   </button>

   <button onClick={() => setShowCreateNoteModal(true)}>
     <FileText size={16} /> Create Note from Session
   </button>
   ```

4. **Add modals** (use existing CreateTaskModal/CreateNoteModal components)

#### Step 3: Create useRelationshipManager Hook

**File**: `/src/hooks/useRelationshipManager.ts` (NEW)

```typescript
import { relationshipManager } from '../services/relationshipManager';

export function useRelationshipManager() {
  return relationshipManager;
}
```

Simple passthrough hook for now. Can add React-specific features later.

#### Step 4: Create useSessionRelationships Hook

**File**: `/src/hooks/useSessionRelationships.ts` (NEW)

```typescript
import { useEffect, useState } from 'react';
import { useRelationshipManager } from './useRelationshipManager';
import type { Relationship, EntityType } from '../types';

export function useSessionRelationships(sessionId: string) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const relationshipManager = useRelationshipManager();

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

This hook can be used in RelationshipModule to simplify real-time subscriptions.

#### Step 5: Update SessionDetailView

**Goal**: Pass sessionId to MorphingCanvas

```tsx
<MorphingCanvas
  config={session.enrichedData.canvasConfig}
  sessionId={session.id}  // ADD THIS
/>
```

**Testing Requirements**:
- Create task from canvas → Relationship appears in RelationshipModule
- Create note from canvas → Relationship appears in RelationshipModule
- Multiple quick creates work correctly
- Error handling works (network failure, etc.)
- Real-time updates work across modules
- No duplicate relationships created
- Relationships persist after page reload

**Definition of Done**:
- [ ] MorphingCanvas intercepts create actions
- [ ] Relationships auto-established on creation
- [ ] RelationshipModule updates in real-time
- [ ] QuickActionsModule emits correct actions
- [ ] Hooks created and working
- [ ] Tests pass
- [ ] No memory leaks from subscriptions

**Edge Cases to Handle**:
- Creating task when RelationshipManager unavailable → Show error
- Creating multiple tasks quickly → Queue operations
- Network failure during relationship creation → Retry or show error
- Session without relationship module → Still allow task/note creation

---

## 👤 AGENT 4: QA/Testing (Quality Assurance)

### Mission
Write comprehensive tests, run integration tests, perform E2E testing, and ensure no regressions.

### Skills Required
- Vitest/Jest
- React Testing Library
- Integration testing patterns
- Performance profiling
- Manual QA

### Phases Assigned
- **Phase 5**: Integration Testing & Polish (Week 7-8) - After all phases complete

---

### PHASE 5 INSTRUCTIONS: Integration Testing & Polish

**Goal**: Ensure the entire AI relationship extraction + canvas integration system works flawlessly end-to-end.

**Prerequisite**: All other phases complete

**Test Files to Create**:

```
/src/services/__tests__/
  ├─ sessionEnrichmentService.relationship.test.ts (Unit tests for Stage 6.3)
  ├─ relationshipExtraction.fuzzyMatch.test.ts (Fuzzy matching tests)
  └─ relationshipExtraction.performance.test.ts (Performance benchmarks)

/src/components/morphing-canvas/modules/__tests__/
  ├─ RelationshipModule.test.tsx (Component tests)
  ├─ RelationshipModule.realtime.test.tsx (Real-time update tests)
  └─ RelationshipModule.variants.test.tsx (Variant rendering tests)

/src/components/__tests__/
  ├─ SessionDetailView.canvasDefault.test.tsx (Default view tests)
  └─ MorphingCanvas.bidirectional.test.tsx (Bidirectional creation tests)

/e2e/ (if E2E framework exists)
  ├─ relationship-extraction.spec.ts
  ├─ canvas-default-view.spec.ts
  └─ manual-relationship-creation.spec.ts
```

**Test Scenarios**:

### 1. Unit Tests

#### sessionEnrichmentService.relationship.test.ts
```typescript
describe('Stage 6.3: Relationship Extraction', () => {
  test('extracts companies from session content', async () => {
    const session = createMockSession({
      screenshots: [{ extractedText: 'Meeting with Acme Corp' }],
    });
    const summary = createMockSummary();

    const result = await enrichmentService.stage6_3_relationshipExtraction(session, summary);

    expect(result.companies).toHaveLength(1);
    expect(result.companies[0].name).toBe('Acme Corp');
    expect(result.companies[0].confidence).toBeGreaterThan(0.5);
  });

  test('matches existing companies with fuzzy matching', async () => {
    // Setup: Create existing company "Google Inc"
    // Session mentions "Google"
    // Verify: Matched to existing, not created new
  });

  test('creates new company when no match found', async () => {
    // Setup: No existing companies
    // Session mentions "NewCorp"
    // Verify: New company created with correct ID
  });

  test('links existing tasks but never creates new ones', async () => {
    // Setup: Task "Update docs" exists
    // Session mentions "update docs"
    // Verify: Task linked, no new task created
  });

  test('handles sessions with no relationships gracefully', async () => {
    const session = createMockSession({ screenshots: [] });
    const result = await enrichmentService.stage6_3_relationshipExtraction(session, {});

    expect(result.companies).toHaveLength(0);
    expect(result.people).toHaveLength(0);
  });

  test('calculates confidence scores correctly', () => {
    // Test confidence scoring logic
  });

  test('handles AI errors gracefully', async () => {
    // Mock AI to return malformed JSON
    // Verify: Error caught, enrichment continues
  });
});
```

#### RelationshipModule.test.tsx
```typescript
describe('RelationshipModule', () => {
  test('renders with data', () => {
    const data = createMockRelationshipData({
      companies: [{ id: '1', name: 'Acme' }],
    });

    render(<RelationshipModule data={data} variant="cards" />);

    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  test('shows empty state when no relationships', () => {
    const data = createMockRelationshipData({});
    render(<RelationshipModule data={data} variant="cards" />);

    expect(screen.getByText('No relationships detected')).toBeInTheDocument();
  });

  test('emits view-company action on click', () => {
    const onAction = jest.fn();
    const data = createMockRelationshipData({
      companies: [{ id: '1', name: 'Acme' }],
    });

    render(<RelationshipModule data={data} variant="cards" onAction={onAction} />);

    fireEvent.click(screen.getByText('Acme'));

    expect(onAction).toHaveBeenCalledWith({
      type: 'view-company',
      companyId: '1',
    });
  });

  test('updates in real-time when relationship added', async () => {
    // Mock RelationshipManager event
    // Verify component updates without full re-render
  });
});
```

### 2. Integration Tests

#### SessionDetailView.canvasDefault.test.tsx
```typescript
describe('SessionDetailView - Canvas Default', () => {
  test('defaults to canvas when canvas exists', () => {
    const session = createMockSession({
      enrichedData: {
        canvasConfig: { hasCanvas: true, modules: [...] },
      },
    });

    render(<SessionDetailView session={session} />);

    expect(screen.getByText('Canvas')).toHaveClass('active');
    expect(screen.queryByText('Summary')).not.toHaveClass('active');
  });

  test('defaults to summary when no canvas', () => {
    const session = createMockSession({
      enrichedData: {
        canvasConfig: { hasCanvas: false },
      },
    });

    render(<SessionDetailView session={session} />);

    // No tabs shown
    expect(screen.queryByText('Canvas')).not.toBeInTheDocument();
    // Summary content shown
    expect(screen.getByText(/Summary/i)).toBeInTheDocument();
  });

  test('switches between canvas and summary', () => {
    const session = createMockSession({
      enrichedData: {
        canvasConfig: { hasCanvas: true, modules: [...] },
      },
    });

    render(<SessionDetailView session={session} />);

    // Initially canvas
    expect(screen.getByText('Canvas')).toHaveClass('active');

    // Click summary
    fireEvent.click(screen.getByText('Summary'));

    // Now summary active
    expect(screen.getByText('Summary')).toHaveClass('active');
  });
});
```

#### MorphingCanvas.bidirectional.test.tsx
```typescript
describe('MorphingCanvas - Bidirectional Creation', () => {
  test('creates task and establishes relationship', async () => {
    const sessionId = 'session-123';
    const createTask = jest.fn().mockResolvedValue({ id: 'task-456', title: 'New Task' });
    const addRelationship = jest.fn();

    // Mock contexts
    jest.spyOn(TasksContext, 'useTasks').mockReturnValue({ createTask });
    jest.spyOn(RelationshipManager, 'addRelationship').mockImplementation(addRelationship);

    const config = createMockCanvasConfig({
      modules: [{ type: 'quick-actions' }],
    });

    render(<MorphingCanvas config={config} sessionId={sessionId} />);

    // Trigger create task action
    const createButton = screen.getByText('Create Task from Session');
    fireEvent.click(createButton);

    // Fill modal
    const titleInput = screen.getByLabelText('Title');
    fireEvent.change(titleInput, { target: { value: 'New Task' } });
    fireEvent.click(screen.getByText('Create'));

    // Wait for async operations
    await waitFor(() => {
      expect(createTask).toHaveBeenCalled();
      expect(addRelationship).toHaveBeenCalledWith({
        sourceType: EntityType.SESSION,
        sourceId: sessionId,
        targetType: EntityType.TASK,
        targetId: 'task-456',
        type: RelationshipType.SESSION_TASK,
        metadata: expect.objectContaining({
          source: 'manual',
          createdFrom: 'canvas',
        }),
      });
    });
  });
});
```

### 3. E2E Tests

#### relationship-extraction.spec.ts
```typescript
test('AI extracts relationships from session', async ({ page }) => {
  // 1. Start session
  await page.goto('/sessions');
  await page.click('[data-testid="start-session"]');

  // 2. Record session with company mention
  await page.fill('[data-testid="notes"]', 'Meeting with Acme Corp about project');
  await page.screenshot({ path: 'screenshot.png' });

  // 3. End session
  await page.click('[data-testid="end-session"]');

  // 4. Wait for enrichment
  await page.waitForSelector('[data-testid="enrichment-complete"]', { timeout: 30000 });

  // 5. Open session detail
  await page.click('[data-testid="session-card"]:first-child');

  // 6. Verify canvas is default view
  await expect(page.locator('[data-testid="canvas-view"]')).toBeVisible();

  // 7. Verify relationship module shows Acme Corp
  await expect(page.locator('text=Acme Corp')).toBeVisible();
});
```

### 4. Performance Tests

#### relationshipExtraction.performance.test.ts
```typescript
describe('Performance', () => {
  test('Stage 6.3 completes in <5 seconds', async () => {
    const session = createLargeSession(); // 100 screenshots, 1hr audio
    const start = Date.now();

    await enrichmentService.stage6_3_relationshipExtraction(session, {});

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });

  test('Total enrichment time increase <40%', async () => {
    // Benchmark with and without Stage 6.3
  });

  test('Canvas renders in <1 second', async () => {
    // Measure canvas render time
  });

  test('Real-time updates trigger in <500ms', async () => {
    // Measure event propagation time
  });
});
```

### 5. Manual Testing Checklist

**Test Case 1: AI Extraction**
- [ ] Start session, visit company website
- [ ] Mention person's name in audio
- [ ] End session, wait for enrichment
- [ ] Verify company detected in canvas
- [ ] Verify person detected in canvas
- [ ] Verify confidence scores are reasonable

**Test Case 2: Manual Creation**
- [ ] Open enriched session
- [ ] Click "Create Task from Session"
- [ ] Fill in task details, save
- [ ] Verify task appears in RelationshipModule immediately
- [ ] Verify task persists after reload

**Test Case 3: Matching Existing**
- [ ] Create company "Google Inc" manually
- [ ] Start session, mention "Google"
- [ ] End session, enrich
- [ ] Verify AI matched to existing "Google Inc"
- [ ] Verify no duplicate created

**Test Case 4: Fallback to Summary**
- [ ] Create very short session (10 sec, no content)
- [ ] End session, enrich
- [ ] Verify summary shown (not canvas)
- [ ] Verify no errors

**Test Case 5: Performance**
- [ ] Create session with 100+ screenshots
- [ ] End session, enrich
- [ ] Verify enrichment completes in reasonable time
- [ ] Verify canvas renders smoothly
- [ ] Verify no UI lag

### 6. Regression Testing

**Existing Features to Verify**:
- [ ] Session recording still works
- [ ] Existing canvas modules (timeline, screenshots, etc.) still work
- [ ] Summary view unchanged when canvas unavailable
- [ ] Session deletion still works
- [ ] Session filtering/sorting still works
- [ ] Existing relationships (non-AI) still work
- [ ] Task creation from other views still works

**Definition of Done**:
- [ ] All unit tests pass (>80% coverage)
- [ ] All integration tests pass
- [ ] All E2E scenarios pass
- [ ] Performance benchmarks met
- [ ] Manual testing complete
- [ ] No regressions found
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Ready for staging deployment

---

## 🔄 Agent Coordination

### Communication Protocol

**Daily Standup** (async):
- What did you complete yesterday?
- What are you working on today?
- Any blockers?

**Phase Handoffs**:
- Agent 1 → Agent 3: "Phase 1 complete, relationship extraction working"
- Agent 2 → Agent 3: "Phase 2 complete, RelationshipModule ready"
- Agent 1 → Agent 2: "Phase 3 complete, canvas configs include relationships"
- Agent 2 → Agent 4: "Phase 4 complete, default view logic updated"
- Agents 1-3 → Agent 4: "All phases complete, ready for QA"

**Blocker Escalation**:
- If blocked >4 hours, escalate to project lead
- Document blocker clearly (what, why, potential solutions)

### Dependency Management

**Parallel Work (No Dependencies)**:
- Agent 1 Phase 1 + Agent 2 Phase 2 can run simultaneously
- No coordination needed

**Sequential Work (Hard Dependencies)**:
- Agent 3 Phase 2.5 REQUIRES Agent 1 Phase 1 + Agent 2 Phase 2 complete
- Agent 1 Phase 3 REQUIRES Agent 2 Phase 2 complete
- Agent 2 Phase 4 REQUIRES Agent 1 Phase 3 complete

**Suggested Schedule**:
```
Week 1-2: Agent 1 (Phase 1) + Agent 2 (Phase 2) - Parallel
Week 3-4: Agent 2 (Phase 2) continues
Week 4-5: Agent 3 (Phase 2.5) - After Phase 1+2 done
Week 5-6: Agent 1 (Phase 3) - After Phase 2 done
Week 6-7: Agent 2 (Phase 4) - After Phase 3 done
Week 7-8: Agent 4 (Phase 5) - After all phases done
```

---

## 📊 Progress Tracking

Use this checklist to track overall progress:

### Phase 1: AI Extraction (Agent 1)
- [ ] Interfaces defined
- [ ] Helper methods implemented
- [ ] Stage 6.3 method complete
- [ ] Integrated into enrichment flow
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Code reviewed
- [ ] Merged to feature branch

### Phase 2: Canvas Module (Agent 2)
- [ ] RelationshipModule.tsx created
- [ ] Cards variant implemented
- [ ] Module registered
- [ ] Types added
- [ ] Unit tests pass
- [ ] Visual tests pass
- [ ] Code reviewed
- [ ] Merged to feature branch

### Phase 2.5: Bidirectional (Agent 3)
- [ ] MorphingCanvas updated
- [ ] QuickActionsModule updated
- [ ] Hooks created
- [ ] SessionDetailView updated
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Code reviewed
- [ ] Merged to feature branch

### Phase 3: Canvas Logic (Agent 1)
- [ ] Stage 6.5 updated
- [ ] RelationshipModule included in configs
- [ ] hasCanvas logic correct
- [ ] Tests pass
- [ ] Code reviewed
- [ ] Merged to feature branch

### Phase 4: Default View (Agent 2)
- [ ] SessionDetailView updated
- [ ] View tabs added
- [ ] Default logic correct
- [ ] Tests pass
- [ ] Code reviewed
- [ ] Merged to feature branch

### Phase 5: QA (Agent 4)
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] E2E tests written
- [ ] Manual testing complete
- [ ] Performance benchmarks met
- [ ] Regression tests pass
- [ ] Documentation updated
- [ ] Ready for staging

---

**End of Agent Execution Guide**

Use this guide in conjunction with `/docs/plans/ai-relationship-extraction-plan.md` for full context.