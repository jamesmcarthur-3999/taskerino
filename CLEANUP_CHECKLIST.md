# Baleybots Migration Cleanup Checklist

**Goal**: Remove 2,052+ lines of legacy code now that Ned uses baleybots alpha 20

---

## ✅ Phase 1: Immediate Cleanup (Ready Now)

### 1. Update AssistantZone.tsx
- [ ] File: `src/components/AssistantZone.tsx`
- [ ] Change import from `NedChat` to `NedChatSimplified as NedChat`
- [ ] Test that full-page Ned works correctly

```diff
- import { NedChat } from './ned/NedChat';
+ import { NedChatSimplified as NedChat } from './ned/NedChatSimplified';
```

**Lines saved**: None yet, but unblocks next steps

---

### 2. Delete Old NedChat Component
- [ ] File: `src/components/ned/NedChat.tsx`
- [ ] Verify no other imports (should only be AssistantZone after step 1)
- [ ] Delete the file

```bash
rm src/components/ned/NedChat.tsx
```

**Lines saved**: -813 lines ✨

---

### 3. Merge Tool Descriptions to Zod
- [ ] File: `src/services/nedToolsZod.ts`
- [ ] Copy `TOOL_DESCRIPTIONS` constant from `nedTools.ts`
- [ ] Add export:

```typescript
// Add to nedToolsZod.ts
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  create_task: 'Create new tasks in your todo list',
  update_task: 'Modify existing tasks',
  complete_task: 'Mark tasks as completed',
  delete_task: 'Remove tasks from your todo list',
  create_note: 'Create new notes',
  update_note: 'Modify existing notes',
  delete_note: 'Remove notes',
  record_memory: 'Save information about your preferences and habits',
};
```

**Lines saved**: +10 lines (temporary)

---

### 4. Delete Old Tool Definitions
- [ ] File: `src/services/nedTools.ts`
- [ ] Verify TOOL_DESCRIPTIONS moved to Zod file
- [ ] Update import in NedChatSimplified if needed
- [ ] Delete the file

```bash
rm src/services/nedTools.ts
```

**Lines saved**: -435 lines ✨

---

### 5. Slim Down nedService.ts
- [ ] File: `src/services/nedService.ts`
- [ ] Extract API key management to `src/hooks/useTauriApiKey.ts` (already exists!)
- [ ] Check if anything else uses nedService
- [ ] Delete the entire file

```bash
# First, verify no imports:
grep -r "import.*nedService" src/

# If only in NedChat.tsx (which we're deleting), then:
rm src/services/nedService.ts
```

**Lines saved**: -804 lines ✨

---

## 📊 Phase 1 Results

| Task | Lines Removed |
|------|---------------|
| Delete NedChat.tsx | -813 |
| Delete nedTools.ts | -435 |
| Delete nedService.ts | -804 |
| **TOTAL** | **-2,052 lines** 🎉 |

**Percentage reduction**: 31% less code in Ned system

---

## 🧪 Testing Before Each Step

### Basic Functionality
- [ ] Ned opens in overlay (right sidebar)
- [ ] Ned opens in AssistantZone (full page)
- [ ] Can send messages
- [ ] Receives streaming responses
- [ ] Tool calls execute (try "show me my tasks")

### Permission System
- [ ] Write operations request permission
- [ ] Read operations don't request permission
- [ ] "Forever" option saves correctly
- [ ] "Session" option works

### Edge Cases
- [ ] Clear conversation works
- [ ] Error handling works (try with no API key)
- [ ] Multiple tool calls work
- [ ] Long messages render correctly

---

## ⏸️ Phase 2: Future Optimization (Optional)

These are larger refactors that could be done later:

### 6. Migrate Context Agent to Baleybots
- [ ] File: `src/services/contextAgent.ts`
- [ ] Refactor to use `useChat` hook
- [ ] Test search functionality
- [ ] Lines saved: ~290

### 7. Migrate Sessions Query Agent
- [ ] File: `src/services/sessionsQueryAgent.ts`
- [ ] Refactor to use `useChat` hook
- [ ] Test session search
- [ ] Lines saved: ~296

### 8. Migrate Sessions Agent Service
- [ ] File: `src/services/sessionsAgentService.ts`
- [ ] Refactor to use `useChat` with tools
- [ ] Test session analysis
- [ ] Lines saved: ~726

**Phase 2 Total**: -1,312 lines (87% total reduction with Phase 1)

---

## 🚨 Important Notes

### Before You Start
1. Commit current work to git
2. Create a backup branch
3. Run all tests to establish baseline

### After Each Step
1. Test the application
2. Fix any imports that break
3. Run linter: `bun run lint`
4. Commit the change

### If Something Breaks
1. Check the error message
2. Look for import statements
3. Verify file paths
4. Check the documentation in:
   - `BALEYBOTS_SIMPLIFICATION_OPPORTUNITIES.md`
   - `NED_SIMPLIFICATION_ALPHA17.md`

---

## 📝 Final Verification

After completing all Phase 1 steps:

- [ ] Run tests: `bun run test`
- [ ] Run linter: `bun run lint`
- [ ] Type check: `bun run type-check`
- [ ] Manual testing in both overlay and full page
- [ ] Check bundle size: `bun run build`
- [ ] Review git diff for unintended changes

---

## 🎉 Success Criteria

✅ All tests pass  
✅ No linter errors  
✅ No TypeScript errors  
✅ Ned works in both overlay and full page  
✅ All tools execute correctly  
✅ Permission system works  
✅ 2,052 lines removed from codebase  

---

## 📞 Need Help?

- Check `BALEYBOTS_ALPHA20_REVIEW.md` for detailed explanation
- Check `NED_SIMPLIFICATION_ALPHA17.md` for technical details
- Check `BALEYBOTS_SIMPLIFICATION_OPPORTUNITIES.md` for full analysis

---

**Status**: ⏳ Ready to start  
**Estimated Time**: 1-2 hours for Phase 1  
**Risk Level**: Low (old code still in git history)  
**Impact**: High (31% code reduction, cleaner architecture)

