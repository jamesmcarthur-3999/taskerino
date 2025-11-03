# Taskerino User Guide

Welcome to Taskerino! This guide will help you get started and make the most of your AI-powered note-taking and task management tool.

## 🚀 Quick Start

### First-Time Setup

1. **Get a Claude API Key**
   - Visit [console.anthropic.com](https://console.anthropic.com/)
   - Sign up or log in
   - Go to API Keys section
   - Create a new key and copy it

2. **Launch Taskerino**
   ```bash
   cd ~/Documents/taskerino
   npm install
   npm run dev
   ```
   - Open `http://localhost:5173` in your browser

3. **Add Your API Key**
   - Click the **Profile** icon in the navigation island (bottom right)
   - Paste your API key in the field
   - Click **Save**
   - You're ready to go!

## 🧭 Navigation

Taskerino has **5 main zones**. Use the floating navigation island (bottom center) to switch between them:

| Icon | Zone | Purpose |
|------|------|---------|
| 📝 | **Capture** | Quick note entry - the default zone |
| ✅ | **Tasks** | View and manage all your tasks |
| 📚 | **Library** | Browse notes organized by topic |
| 🤖 | **Assistant** | Chat with Ned, your AI helper |
| ⚙️ | **Profile** | Settings and configuration |

## 📝 Capturing Notes

The **Capture Zone** is your main workspace.

### How to Capture

1. Type or paste anything into the frosted glass text box:
   - Meeting notes
   - Call transcripts
   - Random thoughts
   - Email summaries
   - Todo lists

2. Press **Enter** or click **Capture** to process

3. Watch the AI work in real-time:
   - Detects topics (companies, people, projects)
   - Creates or merges notes intelligently
   - Extracts actionable tasks
   - Generates summaries

### Example

```
Had a call with Sarah from Acme Corp. They want to upgrade to
Enterprise tier by Q2. Main concern is pricing vs competitors.
Need to send them a quote by Friday and schedule a technical
deep-dive with their CTO next week.
```

**What Happens:**
- Creates a note under "Acme Corp" topic
- Extracts 2 tasks:
  - "Send Enterprise pricing quote to Acme Corp" (High priority, due Friday)
  - "Schedule technical deep-dive with Acme CTO" (Medium priority)
- Shows you a summary and asks what to do next

## ✅ Managing Tasks

The **Tasks Zone** shows all your todos with powerful features.

### Task Views

- **List View** - Simple stacked cards (default)
- **Table View** - Spreadsheet-style with columns
- **Kanban Board** - Organized by status

### Interactive Task Cards

Hover over any task card to see action buttons:

#### Quick Actions
- **Click the circle** → Mark done/undone
- **Click the flag icon** → Cycle priority (Low → Medium → High → Urgent)
- **Click the due date** → Quick reschedule (Today / Tomorrow / Next Week)
- **Click subtask progress** → Expand and toggle individual subtasks
- **Click "From note"** → See the source note that created this task
- **Click "Ask Ned" (speech bubble)** → Get help with this task

#### Filters
Use the toolbar to filter tasks by:
- **Status**: Todo, In Progress, Blocked, Done
- **Priority**: Low, Medium, High, Urgent
- **Topic**: Any company, person, or project
- **Tags**: AI-extracted or custom tags

### Creating Tasks Manually

While AI extracts most tasks automatically, you can also:
1. Click the **+** button in the Tasks zone
2. Fill in title, priority, due date, description
3. Optionally link to a topic or note
4. Click **Create Task**

## 📚 Browsing Your Library

The **Library Zone** organizes all your notes by topic.

### Organization

Notes are grouped by **topics**:
- **Companies** (blue) - Organizations you work with
- **People** (green) - Individuals you interact with
- **Projects** (purple) - Work streams or initiatives
- **Other** (gray) - Everything else

### Enhanced Note Cards

Each note card shows:
- **Summary** - AI-generated headline
- **Entity chips** - Linked companies (blue) and people (green)
- **Smart highlights** - Important dates (blue) and action keywords (orange)
- **Key Insights** - Expandable callout with bullet points
- **Related Tasks** - Tasks created from this note
- **Updates Timeline** - History of changes
- **Tags** - Auto-extracted topics and keywords

### Note Actions

Hover over a note card for actions:
- **Ask Ned** → Chat about this note
- **View** → Open in sidebar for full details
- **Edit** → Modify content
- **Delete** → Remove note

### Filtering & Sorting

- Click **topic pills** to filter by specific company/person/project
- Use **sort dropdown**:
  - Recent (default)
  - Oldest first
  - Alphabetical
  - Most notes

## 🤖 Chat with Ned

The **Assistant Zone** is where you talk to Ned, your AI helper.

### What Ned Can Do

Ned has access to **all your notes and tasks** and can:
- Answer questions about your work
- Find specific information
- Create and update tasks
- Summarize topics or meetings
- Suggest next actions
- Explain connections between items

### How to Chat

1. Navigate to **Assistant** zone
2. Type your question naturally
3. Watch Ned's status:
   - "Thinking..." → Processing your query
   - "Searching your notes..." → Looking through your data
   - "Creating task..." → Making changes
   - "Responding..." → Writing the answer

### Example Questions

- "What did Acme Corp say about pricing?"
- "Show me all high-priority tasks"
- "What meetings did I have last week?"
- "Create a task to follow up with Sarah tomorrow"
- "Summarize all notes about Project Phoenix"
- "Which companies haven't I talked to in 2 weeks?"

### Interactive Results

When Ned shows tasks or notes:
- **Full cards display** with all interactive features
- **Click "Ask Ned" on any card** → Continue conversation about that item
- **Make changes inline** → Toggle priority, complete subtasks, etc.
- **View source** → Jump to the full note or task details

### Conversation Features

- **Persistent context** → Ned remembers your conversation as you navigate
- **Clear chat** → Click the refresh icon (top right) to start fresh
- **Permission system** → Ned will ask before making destructive changes
- **Smart status** → See exactly what Ned is doing in real-time

## ⚙️ Settings & Configuration

Access settings from the **Profile** zone.

### API Key Management
- **Add/Update**: Paste your Claude API key
- **Remove**: Clear to disconnect (data stays local)

### AI Behavior

Configure how the AI processes your inputs:

- **System Instructions**: Custom instructions for the AI (e.g., "Always extract due dates", "Prefer project names over company names")
- **Auto-merge Notes**: When ON, similar notes merge automatically
- **Auto-extract Tasks**: When ON, AI pulls out action items
- **Learning System**: AI learns from your corrections over time

### Learning System

The AI learns your preferences:
- **Confirmations** → When you keep AI suggestions
- **Modifications** → When you change AI decisions
- **Rejections** → When you delete AI suggestions

Over time, Ned gets better at:
- Inferring due dates
- Assigning priority levels
- Detecting topics
- Merging notes
- Extracting tasks

### Ned Settings

Customize Ned's personality:
- **Chattiness**: Concise / Balanced / Detailed
- **Show Thinking**: See Ned's thought process
- **Permissions**: Control what Ned can do (Forever / Session / Always Ask)

### Data Management

- **Export Data** → Download all notes, tasks, topics as JSON
- **Import Data** → Restore from previous export
- **Clear All Data** → Fresh start (cannot undo!)

## 🎯 Pro Tips

### Efficient Workflows

1. **Quick Capture Everything**
   - Don't overthink categories
   - Just dump info into Capture
   - Let AI organize it

2. **Review Weekly**
   - Ask Ned: "What topics haven't I updated this week?"
   - Bulk-complete old tasks
   - Clear irrelevant notes

3. **Use Ask Ned Everywhere**
   - See a confusing task? Click "Ask Ned"
   - Forgot context of a note? Click "Ask Ned"
   - Need to prioritize? Ask Ned to help

4. **Let the AI Learn**
   - Don't immediately delete AI suggestions
   - Modify them instead (the AI learns from edits)
   - Over time, accuracy improves dramatically

### Keyboard Shortcuts

- **⌘/Ctrl + Enter** → Submit in any input field
- **Click navigation icons** → Switch zones quickly
- **Hover for actions** → All cards reveal actions on hover

### Mobile Usage

While Taskerino isn't a native mobile app yet:
- Works in mobile browsers
- Responsive design adapts to small screens
- All features available
- Install as PWA (bookmark on home screen)

## 🆘 Troubleshooting

### AI Not Responding

1. **Check API key**:
   - Profile → Verify key is entered correctly
   - Check Anthropic console for credits

2. **Check browser console**:
   - Right-click → Inspect → Console tab
   - Look for error messages

3. **Clear and retry**:
   - Refresh the page
   - Try a simpler query first

### Tasks Not Extracting

- Make sure **Auto-extract Tasks** is ON in settings
- Use action verbs in your notes: "Need to", "Schedule", "Send", "Follow up"
- Be explicit about timeframes: "by Friday", "next week", "tomorrow"

### Notes Merging Too Aggressively

- Turn **Auto-merge Notes** OFF in settings
- AI will create separate notes instead
- You can manually merge later

### Performance Issues

- Browser localStorage has limits (~5-10MB)
- Export data periodically
- Clear old/irrelevant notes
- Consider clearing completed tasks older than 30 days

### Lost Data

- Data is stored locally in browser
- **Export regularly** as backup
- Clearing browser data will wipe everything
- Private/Incognito mode doesn't persist

## 🎉 Getting the Most Out of Taskerino

### Best Practices

1. **Capture First, Organize Never**
   - Trust the AI to file things correctly
   - Don't manually categorize

2. **Talk to Ned Often**
   - Ned is your second brain
   - Use it to recall details, find patterns, spot gaps

3. **Review, Don't Refile**
   - Weekly review of tasks/notes
   - Complete, delete, or defer—don't reorganize

4. **Let AI Learn**
   - The more you use it, the smarter it gets
   - Corrections teach the system your preferences

### Common Patterns

**After Meetings:**
```
Meeting with [Person] at [Company]
- Discussed: [topics]
- Decisions made: [outcomes]
- Next steps: [actions]
```

**Call Notes:**
```
Call with [Person]: [Summary]
Main points:
- [point 1]
- [point 2]
Action items:
- [ ] [task 1]
- [ ] [task 2]
```

**Random Thoughts:**
```
Idea: [what you're thinking]
Context: [why it matters]
Next: [what to do about it]
```

## 🔐 Privacy & Security

- **100% Local Data** - Everything stored in your browser
- **No Cloud Sync** - Data never leaves your computer (except API calls to Claude)
- **API Key Security** - Stored locally, never transmitted except to Anthropic
- **No Analytics** - We don't track anything
- **Open Source** - Inspect the code yourself

---

**Questions?** Check the main README.md or ask Ned! 😊

**Made with ❤️ for people who think fast and don't want tools to slow them down.**
