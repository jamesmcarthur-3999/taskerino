# ⌨️ Keyboard Shortcuts Reference

## Navigation
| Shortcut | Action |
|----------|--------|
| `⌘1` | Go to Capture tab |
| `⌘2` | Go to Tasks tab |
| `⌘3` | Go to Library tab |
| `⌘4` | Go to Ask AI tab |
| `⌘,` | Open Profile & Settings |

## Quick Actions
| Shortcut | Action |
|----------|--------|
| `⌘K` | Open Command Palette (search everything) |
| `⌘N` | New Note (manual, from Library) |
| `⌘⇧N` | New Task (quick capture) |
| `⌘⇧R` | Toggle Reference Panel |
| `⌘F` | Focus search (in Tasks zone) |
| `⌘/` | Show keyboard shortcuts help |

## Command Palette (when open)
| Shortcut | Action |
|----------|--------|
| `↑` `↓` | Navigate results |
| `↵` | Select item |
| `⌘K` | Close palette |
| `ESC` | Close palette |

## Task Management (in Tasks zone)
| Shortcut | Action |
|----------|--------|
| `⌘N` | Quick add task |
| `⌘F` | Focus task search |
| `Space` | Toggle task completion (when focused) |

## Text Editing (in rich text editors)
| Shortcut | Action |
|----------|--------|
| `⌘B` | Bold |
| `⌘I` | Italic |
| `⌘U` | Underline |
| `⌘K` | Add link |
| `⌘⇧X` | Strikethrough |

## Capture Zone
| Shortcut | Action |
|----------|--------|
| `⌘↵` | Process & File (submit) |
| `⌘⇧↵` | Quick save (without AI processing) |
| `⌘⇧V` | Paste without formatting |

## To Be Implemented
| Shortcut | Action | Status |
|----------|--------|--------|
| `⌘⇧D` | Duplicate item | Planned |
| `⌘⇧K` | Clear all filters | Planned |
| `⌘⇧F` | Advanced search | Planned |
| `⌘⇧S` | Export selection | Planned |

---

## Implementation Notes

### Current Shortcuts (need to verify):
- Capture Zone has: `⌘+Enter` for submit
- Tasks Zone has: `⌘N` for quick add, `⌘F` for search focus
- These exist in current code

### New Shortcuts (need to implement):
All shortcuts in the "Quick Actions" and "To Be Implemented" sections need the global keyboard hook:

```typescript
// src/hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts() {
  const { dispatch } = useApp();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      if (isMod) {
        switch(e.key) {
          case '1':
            e.preventDefault();
            dispatch({ type: 'SET_ACTIVE_TAB', payload: 'capture' });
            break;
          // ... etc
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);
}
```

### Shortcut Help Modal
Create a `⌘/` shortcut that shows this reference in a modal:
- Categorized sections
- Searchable
- Printable
- Shows context-specific shortcuts (e.g., only show Task shortcuts when in Tasks tab)
