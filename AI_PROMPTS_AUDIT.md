# AI Prompts Audit - Entity & Relationship Format

**Date:** 2025-11-01
**Purpose:** Identify all AI services that need prompt updates for the new relationship-based data model

---

## Executive Summary

**Services Audited:** 8 AI services
**Need Updates:** 2 services ⚠️
**Already Correct:** 1 service ✅
**Don't Create Entities:** 5 services ℹ️

### Critical Finding
**noteEnrichmentService** uses the OLD format for entity creation - needs updating to match claudeService's new format.

---

## Services That CREATE Entities

### 1. ✅ claudeService.ts - **FIXED**

**Status:** ✅ Updated in Week 2
**Location:** `/src/services/claudeService.ts`
**What It Does:** Main capture processing - analyzes user input, creates notes/tasks/entities
**Return Format:** NEW format (AIProcessResult)

```typescript
{
  notes: [{ id, content, summary, tags, source, sentiment, keyPoints }],
  tasks: [{ id, title, priority, dueDate, description, tags, suggestedSubtasks }],
  relationships: [
    { from: { type, id }, to: { type, id/name }, relationType, metadata }
  ],
  newEntities: {
    topics: [{ name, type, confidence }],
    companies: [{ name, confidence }],
    contacts: [{ name, confidence }]
  }
}
```

**Entity Creation:**
- ✅ Creates topics (subjects/projects)
- ✅ Creates companies (organizations)
- ✅ Creates contacts (people)
- ✅ Creates relationships between all entities

**Prompt Quality:**
- ✅ Clear entity creation rules
- ✅ Examples show proper usage
- ✅ Distinguishes topics vs contacts vs companies

**Next Steps:** None - already correct

---

### 2. ⚠️ noteEnrichmentService.ts - **NEEDS UPDATE**

**Status:** ⚠️ Uses OLD format
**Location:** `/src/services/noteEnrichmentService.ts`
**What It Does:** Enriches existing notes with AI-generated metadata, tags, and entity relationships
**Current Return Format:** OLD format (mixed)

```typescript
{
  suggestedTitle: string,
  suggestedTags: string[],
  suggestedSummary: string,
  keyTopics: string[],
  sentiment: string,
  relatedNoteIds: string[],
  // OLD FORMAT - Uses ID arrays instead of relationships
  suggestedCompanyIds: string[],
  suggestedContactIds: string[],
  suggestedTopicIds: string[],
  // OLD FORMAT - Separate arrays instead of newEntities
  newCompanies: [{ name, description? }],
  newContacts: [{ name, email?, role? }],
  newTopics: [{ name, description? }]
}
```

**Problems:**
1. ❌ Uses `suggestedCompanyIds` instead of creating relationships
2. ❌ Uses `suggestedContactIds` instead of creating relationships
3. ❌ Uses `suggestedTopicIds` instead of creating relationships
4. ❌ Returns `newCompanies` as flat array instead of `newEntities.companies`
5. ❌ Returns `newContacts` as flat array instead of `newEntities.contacts`
6. ❌ Returns `newTopics` as flat array instead of `newEntities.topics`
7. ❌ NO `relationships` array - can't specify which note links to which entity

**Entity Creation:**
- ⚠️ Can suggest companies (but uses old ID format)
- ⚠️ Can suggest contacts (but uses old ID format)
- ⚠️ Can suggest topics (but uses old ID format)
- ❌ Cannot create relationships

**Prompt Location:** Lines 280-320
**Used By:** Note enrichment feature (manual note enhancement)

**Recommended Fix:**

**Option A: Update to match AIProcessResult format**
```typescript
{
  suggestedTitle: string,
  suggestedTags: string[],
  suggestedSummary: string,
  sentiment: string,
  relatedNoteIds: string[],
  // NEW FORMAT
  relationships: [
    { from: { type: "note", id: "enriched-note-id" }, to: { type, id/name }, relationType, metadata }
  ],
  newEntities: {
    topics: [{ name, type, confidence }],
    companies: [{ name, confidence }],
    contacts: [{ name, confidence }]
  }
}
```

**Option B: Keep specialized format, add relationships**
```typescript
{
  // Keep existing fields
  suggestedTitle: string,
  suggestedTags: string[],
  suggestedSummary: string,
  sentiment: string,
  relatedNoteIds: string[],
  // ADD relationships array
  relationships: [
    { from: { type: "note", id: "enriched-note-id" }, to: { type, id/name }, relationType, metadata }
  ],
  // KEEP new entities but ensure they're created via AIIntegrationService
  newCompanies: [{ name, confidence }],
  newContacts: [{ name, confidence }],
  newTopics: [{ name, type, confidence }]
}
```

**Recommendation:** Option B - keeps backward compatibility while adding relationships

**Impact:** Medium
- Used by manual note enrichment feature
- Less critical than claudeService (used less frequently)
- But important for consistency

**Priority:** Medium (Week 3-4)

---

## Services That ANALYZE But Don't Create Entities

### 3. ℹ️ sessionsAgentService.ts - **NO UPDATE NEEDED**

**Status:** ℹ️ Analysis only
**Location:** `/src/services/sessionsAgentService.ts`
**What It Does:** Real-time screenshot analysis during active sessions

**Return Format:** Analysis data only
```typescript
{
  summary: string,
  detectedActivity: string,
  extractedText: string,
  keyElements: string[],
  suggestedActions: string[],
  contextDelta: string,
  confidence: number,
  curiosity: number,
  curiosityReason: string,
  progressIndicators: {
    achievements: string[],
    blockers: string[],
    insights: string[]
  }
}
```

**Entity Creation:** ❌ None - pure analysis
**Next Steps:** None - working as designed

---

### 4. ℹ️ sessionEnrichmentService.ts - **NO UPDATE NEEDED**

**Status:** ℹ️ Orchestrator only
**Location:** `/src/services/sessionEnrichmentService.ts`
**What It Does:** Post-session enrichment orchestrator (calls other services, doesn't have own prompts)

**Prompts:** None - delegates to:
- audioReviewService (audio analysis)
- videoChapteringService (video analysis)
- Internal summary generation (uses session data, doesn't extract entities)

**Entity Creation:** ❌ None - links existing tasks/notes to session
**Next Steps:** None - working as designed

---

### 5. ℹ️ contextAgent.ts - **NO UPDATE NEEDED**

**Status:** ℹ️ Search/filter only
**Location:** `/src/services/contextAgent.ts`
**What It Does:** Search and filter notes/tasks/entities for Ned assistant

**Return Format:** Search results
```typescript
{
  notes: Note[],
  tasks: Task[],
  companies: Company[],
  contacts: Contact[],
  topics: Topic[],
  summary: string,
  suggestedFollowUps: string[]
}
```

**Entity Creation:** ❌ None - returns existing entities only
**Next Steps:** None - working as designed

---

### 6. ℹ️ sessionsQueryAgent.ts - **NO UPDATE NEEDED**

**Status:** ℹ️ Query only
**Location:** `/src/services/sessionsQueryAgent.ts`
**What It Does:** Query sessions for Ned assistant

**Entity Creation:** ❌ None - queries existing data
**Next Steps:** None - working as designed

---

### 7. ℹ️ nedService.ts - **NO UPDATE NEEDED**

**Status:** ℹ️ Chat orchestrator
**Location:** `/src/services/nedService.ts`
**What It Does:** Ned AI assistant - orchestrates tool execution

**Entity Creation:** ❌ None - calls tools, doesn't create entities directly
**Next Steps:** None - working as designed

**Note:** Ned DOES create entities, but via tool execution (calling claudeService or directly creating via contexts). The prompts are in the tools, not in nedService itself.

---

### 8. ℹ️ audioReviewService.ts - **NO UPDATE NEEDED**

**Status:** ℹ️ Analysis only
**Location:** `/src/services/audioReviewService.ts`
**What It Does:** Audio analysis via GPT-4o

**Entity Creation:** ❌ None - pure analysis
**Next Steps:** None - working as designed

---

## Summary Table

| Service | Creates Entities? | Format | Status | Priority |
|---------|------------------|--------|--------|----------|
| claudeService | ✅ Yes | NEW | ✅ Fixed | - |
| noteEnrichmentService | ⚠️ Yes (old format) | OLD | ⚠️ Needs update | Medium |
| sessionsAgentService | ❌ No | N/A | ✅ OK | - |
| sessionEnrichmentService | ❌ No | N/A | ✅ OK | - |
| contextAgent | ❌ No | N/A | ✅ OK | - |
| sessionsQueryAgent | ❌ No | N/A | ✅ OK | - |
| nedService | ❌ No (orchestrator) | N/A | ✅ OK | - |
| audioReviewService | ❌ No | N/A | ✅ OK | - |

---

## Recommendations

### Immediate (Week 2) - ✅ COMPLETED
1. ✅ Fix claudeService to return new AIProcessResult format
2. ✅ Update claudeService prompts with entity creation rules
3. ✅ Fix CaptureZone to save companies/contacts

### Medium Priority (Week 3-4)
1. ⚠️ **Update noteEnrichmentService**
   - Add `relationships` array to return format
   - Update prompt to create relationships instead of ID arrays
   - Ensure it uses newEntities format (or convert in code)
   - Test manual note enrichment feature

### Low Priority (Future)
1. Consider if sessionsAgentService should extract entities during sessions
   - Currently it just analyzes, doesn't create
   - Could be useful for real-time entity detection
   - But might be too noisy (lots of false positives)

---

## Testing Checklist

### When noteEnrichmentService is updated:

**Test Case 1: Enrich note with companies**
- Input: Note about "Met with Acme Corp team"
- Expected:
  - Creates company "Acme Corp" in newEntities.companies
  - Creates relationship: note → company
  - NOT old format: suggestedCompanyIds

**Test Case 2: Enrich note with contacts**
- Input: Note mentioning "Sarah from Marketing"
- Expected:
  - Creates contact "Sarah" in newEntities.contacts
  - Creates relationship: note → contact
  - NOT old format: suggestedContactIds

**Test Case 3: Enrich note with topics**
- Input: Note about "API integration challenges"
- Expected:
  - Creates topic "API Integration" in newEntities.topics
  - Creates relationship: note → topic
  - NOT old format: suggestedTopicIds

---

## File Locations

**Services to Update:**
- `/src/services/noteEnrichmentService.ts` - Lines 280-320 (prompt), Lines 326-371 (parser)

**Reference Implementations:**
- `/src/services/claudeService.ts` - Lines 150-210 (entity creation rules), Lines 1153-1202 (return format)
- `/src/services/AIIntegrationService.ts` - Lines 65-280 (processes new format correctly)

---

## Migration Path

**Phase 1: Week 2** ✅ COMPLETED
- Fix claudeService (main capture flow)
- Update CaptureZone
- Result: Main AI capture creates companies/contacts/relationships

**Phase 2: Week 3-4** ⚠️ PENDING
- Fix noteEnrichmentService (manual enrichment)
- Test note enrichment feature
- Result: Manual note enrichment also creates relationships

**Phase 3: Week 5+** 💭 FUTURE
- Consider real-time entity extraction in sessionsAgentService
- Evaluate impact and usefulness
- Result: Sessions could auto-detect entities in real-time

---

**Generated:** 2025-11-01
**Auditor:** Claude Code
**Files Analyzed:** 8 AI services
**Critical Issues:** 1 (noteEnrichmentService)
**Recommendations:** Update noteEnrichmentService in Week 3-4
