# Architectural Decision Log

This document records all significant architectural and design decisions made during the Relationship System Rebuild project.

---

## Decision 001: Use Unified Relationship Array

**Date:** 2025-10-24
**Status:** Accepted

**Context:** Currently, relationships are stored in separate fields (`noteId`, `sourceNoteId`, `sourceSessionId`, `extractedTaskIds[]`, etc.) leading to inconsistency and complexity.

**Decision:** Implement a unified `relationships: Relationship[]` array on all entity types. Each relationship is a first-class object with type, metadata, and bidirectional references.

**Rationale:**
- Single source of truth for all relationships
- Easier to query and manage
- Supports arbitrary relationship types without schema changes
- Rich metadata (confidence, reasoning, timestamps)
- Extensible for future entity types

**Consequences:**
- **Positive:**
  - Consistent API across all relationship types
  - Easy to add new relationship types
  - Better support for querying and filtering
  - Metadata enables AI quality tracking
- **Negative:**
  - Requires migration from legacy fields
  - Slightly larger storage footprint
  - Breaking change (mitigated by backward compatibility)
- **Neutral:**
  - Different query patterns (array lookups vs direct field access)

**Alternatives Considered:**
1. **Separate join table** - Rejected: Overkill for client-side storage, adds complexity
2. **Keep legacy fields** - Rejected: Perpetuates inconsistency and technical debt
3. **Use Map<string, string>** - Rejected: Loses type safety and metadata

**Related Decisions:** None (foundational decision)

---

## Decision 002: Automatic Bidirectional Sync

**Date:** 2025-10-24
**Status:** Accepted

**Context:** User wants relationships to be automatically maintained on both sides (e.g., adding Task→Note also creates Note→Task).

**Decision:** Implement automatic bidirectional synchronization at the service layer. When a relationship is created/removed, both entities are updated atomically in a single transaction.

**Rationale:**
- User expectation: adding a relationship should "just work"
- Prevents inconsistency from manual updates
- Simplifies application code (no need to remember to update both sides)
- Atomic transactions ensure consistency

**Consequences:**
- **Positive:**
  - Guaranteed consistency
  - Simpler application code
  - Better user experience
- **Negative:**
  - More complex service layer implementation
  - Performance overhead (2 writes instead of 1)
  - Transaction required for atomicity
- **Neutral:**
  - Storage size slightly larger (relationships stored twice)

**Alternatives Considered:**
1. **Manual bidirectional** - Rejected: Error-prone, easy to forget, causes bugs
2. **Query-based reverse** - Rejected: Performance issues, complex queries
3. **Hybrid (some bidirectional, some not)** - Rejected: Confusing, inconsistent

**Related Decisions:** Decision 001 (Unified Relationship Array)

---

## Decision 003: Transaction-Based Updates

**Date:** 2025-10-24
**Status:** Accepted

**Context:** Need to ensure data integrity when updating multiple entities atomically (e.g., creating bidirectional relationships).

**Decision:** Implement ACID transactions in both storage adapters (IndexedDB and Tauri FS) with support for commit, rollback, and savepoints.

**Rationale:**
- Prevents partial updates on failure
- Essential for bidirectional relationships
- Supports complex multi-entity operations
- Standard database practice

**Consequences:**
- **Positive:**
  - Data integrity guaranteed
  - No orphaned or inconsistent relationships
  - Can rollback on error
- **Negative:**
  - Implementation complexity (especially for file-based storage)
  - Performance overhead (transaction coordination)
- **Neutral:**
  - Requires careful error handling

**Alternatives Considered:**
1. **Best-effort updates** - Rejected: Risk of data corruption
2. **Event sourcing** - Rejected: Over-engineering for this use case
3. **Compensating transactions** - Rejected: Complex, error-prone

**Related Decisions:** Decision 002 (Automatic Bidirectional Sync)

---

## Decision 004: Backward-Compatible Migration

**Date:** 2025-10-24
**Status:** Accepted

**Context:** User has critical requirement to preserve all existing data. Cannot afford data loss.

**Decision:** Implement comprehensive migration service with:
- Pre-migration validation
- Dry-run mode
- Detailed migration report
- Rollback capability
- Keep legacy fields for 1-2 versions

**Rationale:**
- User requirement: "backward compatibility critical"
- Builds user confidence
- Allows gradual transition
- Minimizes risk

**Consequences:**
- **Positive:**
  - Zero data loss
  - User trust maintained
  - Can test before committing
- **Negative:**
  - Temporary code duplication (legacy + new)
  - Migration complexity
  - Larger codebase during transition
- **Neutral:**
  - Need to remove legacy fields eventually

**Alternatives Considered:**
1. **Immediate cutover** - Rejected: Too risky, no rollback
2. **Parallel systems** - Rejected: Too complex, doubles code
3. **Manual migration** - Rejected: User burden, error-prone

**Related Decisions:** Decision 001 (Unified Relationship Array)

---

## Decision 005: Inline Pills + Modal UI Pattern

**Date:** 2025-10-24
**Status:** Accepted

**Context:** Need UI pattern for displaying and managing relationships. User specified preference for "inline pills + modal" pattern.

**Decision:** Implement relationship display as inline colored pills (similar to tags) with a modal dialog for detailed management (search, bulk operations, etc.).

**Rationale:**
- User preference stated in requirements
- Familiar pattern (similar to tags, labels)
- Compact inline display
- Full-featured modal for power users
- Mobile-friendly

**Consequences:**
- **Positive:**
  - Intuitive, familiar UX
  - Space-efficient
  - Scales well with many relationships
- **Negative:**
  - Modal adds interaction step for management
  - Requires two components (pills + modal)
- **Neutral:**
  - Need keyboard shortcuts for power users

**Alternatives Considered:**
1. **Sidebar panel** - Rejected: User preference was inline pills
2. **Dedicated tab** - Rejected: Hides relationships, extra navigation
3. **Contextual dropdowns** - Rejected: Doesn't scale with many items

**Related Decisions:** None

---

## Template for New Decisions

```markdown
## Decision [Number]: [Title]

**Date:** YYYY-MM-DD
**Status:** Accepted / Rejected / Superseded

**Context:** [Why was this decision needed?]

**Decision:** [What did we decide?]

**Rationale:** [Why did we make this decision?]

**Consequences:**
- **Positive:** [Benefits]
- **Negative:** [Trade-offs]
- **Neutral:** [Other impacts]

**Alternatives Considered:**
1. [Alternative 1] - Rejected because [reason]
2. [Alternative 2] - Rejected because [reason]

**Related Decisions:** [Links to related decisions]
```

---

**End of Decisions Log**
