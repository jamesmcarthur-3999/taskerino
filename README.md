# Taskerino - AI-Powered Notes & Tasks

A beautifully minimal note-taking and task management tool powered by Claude AI. Designed for people who want to capture thoughts quickly without the friction of manual organization.

## ✨ Core Philosophy

**Zero Friction. Maximum Intelligence.**

- No manual filing or categorization
- No confirmation dialogs or multi-step workflows
- Just capture your thoughts and let AI organize everything
- Beautiful, intentional UX that stays out of your way

## 🎯 Perfect For

Anyone who:
- Takes frequent notes throughout the day (meetings, calls, random thoughts)
- Wants AI to automatically organize and extract tasks
- Needs quick access to past conversations and context
- Values beautiful, minimal interfaces over feature-heavy CRMs

## 🚀 Key Features

### 📝 Universal Capture
The main interface is a **frosted glass capture box** on a beautiful gradient background. That's it.

- Type or paste anything (meeting notes, call transcripts, ideas)
- Press **⌘ + Enter** to process
- AI automatically:
  - Detects topics (people, companies, projects)
  - Creates or merges notes intelligently
  - Extracts actionable tasks
  - Generates summaries
- See real-time processing steps
- Get clear results with next actions

### ✅ Task Management
A dedicated tasks zone with powerful features:

- **Interactive task cards** with inline editing
- **Priority toggle** - Click to cycle Low → Medium → High → Urgent
- **Quick reschedule** - Today, Tomorrow, or Next Week options
- **Interactive subtasks** with visual progress bars
- **Status indicators** with color-coded borders
- **AI confidence badges** showing how tasks were created
- **Source note preview** to see context
- Kanban board, list, and table views
- Filter by status, priority, topic, or tags

### 📚 Library (Notes & Knowledge)
Your organized knowledge base with rich context:

- **Enhanced note cards** with smart features:
  - Entity chips showing linked companies and contacts
  - Smart highlights for dates and action keywords
  - Beautiful key insights callouts
  - Related tasks section
  - Updates timeline for note history
- **Topic-based organization** (companies, people, projects)
- **Card grid** with note previews, tags, and timestamps
- Sort by recent, alphabetical, or note count
- Delete notes or entire topics

### 📹 Sessions - Smart Work Session Recording
Capture your entire work session with comprehensive media controls:

**Recording Capabilities:**
- **Adaptive screenshot capture** - AI determines optimal intervals based on activity
- **Dual-source audio** - Record microphone and system audio simultaneously with real-time mixing
- **Multi-display video** - Capture one or multiple displays at once (macOS)
- **Picture-in-Picture** - Overlay your webcam on screen recordings with customizable position and size
- **Hot-swapping** - Change devices mid-recording without stopping your session
- **Quality presets** - From 720p/15fps to 4K/30fps with file size estimates

**Media Controls:**
- **Device selection** - Choose from all available microphones, displays, and webcams
- **Audio balance slider** - Mix microphone and system audio (0-100%)
- **Audio level meters** - Real-time visual feedback of input levels
- **PiP configuration** - 4 corner positions × 3 size presets (Small/Medium/Large)
- **Window-specific recording** - Capture individual application windows

**AI-Powered Features:**
- **Automatic enrichment** - Summary, insights, and key moments detection
- **Audio transcription** - Automatic speech-to-text with OpenAI Whisper
- **Video chaptering** - AI-generated chapter markers for easy navigation
- **Session timeline** - Interactive timeline with screenshots and key moments
- **Morphing Canvas** - Dynamic AI-generated review layouts
- **Cost controls** - Set maximum AI processing costs
- **Learning dashboard** - Track achievements, blockers, and progress

### 🤖 Ned - Your AI Assistant
Meet Ned, your conversational AI that knows everything about your work:

- **Natural conversation** - Chat like you're talking to a colleague
- **Contextual search** - Searches across all notes and tasks
- **Interactive cards** - View and manage tasks/notes directly in chat
- **Smart status updates** - See exactly what Ned is doing
- **Pulsing avatar** with smooth animations
- **Persistent conversations** - Context maintained across zones
- **Permission system** - Control what Ned can do
- **Ask about anything** - Click "Ask Ned" on any card for instant help

### ⚙️ Smart Settings
Configure everything AI does:

- API key management (Claude Sonnet 4.5)
- System instructions (customize AI behavior)
- Auto-merge similar notes (on/off)
- Auto-extract tasks (on/off)
- Topic creation sensitivity (conservative/balanced/aggressive)
- Data export/import/clear

## 🎨 Design Highlights

### Six-Zone Navigation
Navigate between zones using the floating navigation island:

1. **Capture** - Universal input for quick note capture
2. **Tasks** - Manage todos with interactive cards
3. **Library** - Browse notes and knowledge base
4. **Sessions** - Record and review work sessions with AI analysis
5. **Assistant** - Chat with Ned, your AI assistant
6. **Profile** - Settings and AI configuration

### Glass Morphism UI
- Frosted glass effects with backdrop blur
- Gradient mesh backgrounds with subtle animations
- Clean, modern aesthetics
- Smooth transitions throughout

### Keyboard-First
- **⌘ + Enter**: Submit capture/query
- **↑/↓ arrows**: Navigate zones quickly
- Minimal mouse interaction needed

## 📦 Getting Started

### Prerequisites

**Required:**
- Node.js 18+ and npm
- Claude API key from [console.anthropic.com](https://console.anthropic.com/)
- Rust toolchain (for Tauri - install via [rustup.rs](https://rustup.rs/))

**Optional (for full session features):**
- OpenAI API key (for audio review feature)
- macOS 10.15+ (for video recording via ScreenCaptureKit)

**Platform-specific requirements:**
- **macOS**: Xcode Command Line Tools
- **Linux**: webkit2gtk, libappindicator, and other dependencies ([Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))
- **Windows**: Microsoft Visual Studio C++ Build Tools

### Installation

```bash
cd ~/Documents/taskerino
npm install
npm run tauri:dev
```

This will start the Tauri desktop app in development mode.

**For web-only mode (limited features):**
```bash
npm run dev
# Open http://localhost:5173
```

### First-Time Setup

1. App opens to the **Capture Zone**
2. Navigate to **Profile Zone** (bottom-right icon)
3. Enter your Claude API key and save
4. (Optional) Enter OpenAI API key for session audio review
5. Configure AI behavior and enrichment settings
6. Navigate back to **Capture Zone** and start capturing!

## 💡 Example Workflows

### Quick Note After a Meeting
```
Had a great call with Sarah at Acme Corp. They want to upgrade
to Enterprise tier by Q2. Main concern is pricing vs competitors.
Need to send them a quote by Friday and schedule a technical
deep-dive with their CTO next week.
```

**What happens:**
- AI detects topic: "Acme Corp" (company)
- Creates note with summary: "Enterprise upgrade discussion with pricing concerns"
- Extracts tasks:
  - "Send Enterprise pricing quote to Acme Corp" (high priority)
  - "Schedule technical deep-dive with Acme CTO" (medium priority)
- Shows you the results with options to view note or add another

### Asking the AI Assistant
Scroll up to Assistant and ask:
- "What did Acme Corp say about pricing?"
- "Which topics haven't I updated in 2 weeks?"
- "What are my high-priority tasks?"

AI searches across all notes and gives answers with sources.

## 🏗️ Technical Architecture

### Data Model
```
Topic (auto-detected)
├── name: "Acme Corp"
├── type: company | project | person | other
├── noteCount
└── lastUpdated

Note
├── topicId → Topic
├── content (markdown)
├── summary (AI-generated)
├── timestamp
├── tags (auto-extracted)
├── metadata (sentiment, keyPoints)
└── parentNoteId (for threading)

Task
├── title
├── priority (low/medium/high/urgent)
├── topicId → Topic (optional)
├── noteId → Note (optional)
├── done
└── dueDate (optional)
```

### AI Intelligence

**Topic Detection & Matching:**
- Fuzzy matching algorithm (exact → contains → word overlap)
- Confidence scoring with Jaccard similarity
- Auto-merge when confidence > 70%

**Note Merging:**
- Finds similar notes from last 7 days
- Uses keyword overlap algorithm (30% threshold)
- Merges automatically or creates new based on similarity

**Task Extraction:**
- Natural language parsing for actionable items
- Priority inference from context
- Links tasks to relevant topics/notes

### Tech Stack
- **Tauri v2** - Desktop app framework (Rust backend)
- **React 19** + TypeScript + Vite
- **Tailwind CSS v3** (glass morphism, animations)
- **Framer Motion** - Advanced animations and transitions
- **Claude AI** (Sonnet 4.5 & Haiku 4.5)
- **OpenAI** (GPT-4o Audio for session enrichment)
- **Tiptap** - Rich text editor
- **IndexedDB** (browser) + **Tauri File System** (desktop) for storage
- **Lucide React** for icons

### Project Structure
```
src/
├── components/
│   ├── TopNavigation/          # Modern navigation island system
│   ├── CaptureZone.tsx         # Universal capture interface
│   ├── TasksZone.tsx           # Task management with views
│   ├── LibraryZone.tsx         # Notes grid & topics
│   ├── SessionsZone.tsx        # Session recording & review
│   ├── AssistantZone.tsx       # Ned AI chat interface
│   ├── ProfileZone.tsx         # Settings & configuration
│   ├── morphing-canvas/        # Dynamic layout engine
│   ├── sessions/               # Session-specific components
│   ├── ned/                    # Ned assistant components
│   └── ui/                     # Radix UI primitives
├── context/
│   ├── SettingsContext.tsx     # User settings
│   ├── UIContext.tsx           # UI state
│   ├── NotesContext.tsx        # Note management
│   ├── TasksContext.tsx        # Task management
│   ├── SessionsContext.tsx     # Session lifecycle
│   ├── EnrichmentContext.tsx   # AI enrichment pipeline
│   └── [8 other contexts]      # Specialized state management
├── services/
│   ├── claudeService.ts        # Core AI processing
│   ├── sessionEnrichmentService.ts  # Session AI enrichment
│   ├── videoChapteringService.ts    # Video analysis
│   ├── contextAgent.ts         # Information retrieval agent
│   ├── storage/                # IndexedDB + Tauri adapters
│   └── [15+ other services]    # AI agents & utilities
├── types.ts                    # TypeScript definitions
├── design-system/              # Design tokens & theme
└── App.tsx                     # Entry point

src-tauri/
├── src/                        # Rust backend
│   ├── main.rs                 # Entry point
│   ├── claude_api.rs           # Streaming API client
│   ├── openai_api.rs           # OpenAI integration
│   ├── video_recording.rs      # Screen recording (macOS)
│   ├── audio_capture.rs        # Audio recording
│   └── [10+ other modules]     # Native capabilities
└── Cargo.toml                  # Rust dependencies
```

## 🔐 Privacy & Data

- **100% local** - Desktop app with native file system storage (or IndexedDB in browser mode)
- **API calls only to Anthropic Claude & OpenAI** - for AI processing only
- **No tracking, no analytics, no third-party servers**
- **Secure API key storage** - Uses Tauri's encrypted storage on desktop
- Export your data anytime (JSON format)
- All recordings and attachments stored locally
- Optional: Enable session enrichment features (incurs AI API costs)

## 🎯 What Makes This Different?

### vs. Notion
- **No folders/databases to set up** - AI does it automatically
- **Way faster** - optimized for quick capture
- **No learning curve** - just type and submit

### vs. Roam/Obsidian
- **AI-first** - topics, tags, and links auto-generated
- **Minimal UX** - no complex graph views or markup
- **Task extraction** - actionable items pulled out automatically

### vs. Traditional CRMs
- **Not a CRM** - lightweight note & task tracking
- **No manual data entry** - paste transcripts, get organized notes
- **Personal tool** - designed for individuals, not teams (yet)

## 🚧 Roadmap

**Completed ✅**
- Topic auto-detection with fuzzy matching
- Intelligent note merging
- Task extraction
- AI query interface
- Glass morphism UI
- Vertical zone navigation

**Next Up 🔜**
- Rich text editor (markdown support in capture)
- Task management view with filtering
- Note detail modal with full content
- Keyboard shortcuts (⌘+K command palette)
- Dark mode

**Future 🔮**
- Backend sync (PostgreSQL + auth)
- Mobile app (React Native)
- Email integration (auto-import conversations)
- Voice capture (transcribe & process)
- Team collaboration
- Chrome extension for quick capture

## 🐛 Troubleshooting

**Build errors:**
```bash
rm -rf node_modules dist
npm install
npm run build
```

**API key issues:**
- Get fresh key from [console.anthropic.com](https://console.anthropic.com/)
- Open Settings and re-enter
- Refresh page

**Notes not processing:**
- Check browser console for errors
- Verify API key is saved
- Ensure you have credits in Anthropic account

**Performance:**
- Clear old data: Settings → Clear All Data
- Browser localStorage has limits (~5-10MB)
- Export & clear periodically for best performance

## 📚 Documentation

**For Developers:**
- **[CLAUDE.md](CLAUDE.md)** - Comprehensive developer guide and AI agent instructions
- **[Documentation Index](docs/INDEX.md)** - Navigate all project documentation
- **[User Guide](docs/user-guides/USER_GUIDE.md)** - Complete user documentation
- **[API Reference](docs/developer/API_REFERENCE_GUIDE.md)** - API documentation
- **[Sessions Rewrite](docs/sessions-rewrite/)** - Sessions system architecture and progress

**For Contributors:**
- [Contributing Guide](CONTRIBUTING.md) - How to contribute
- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Keyboard Shortcuts](KEYBOARD_SHORTCUTS.md) - All shortcuts reference

## 📝 License

MIT - use and modify freely!

## 🙏 Acknowledgments

Built with:
- [Anthropic Claude](https://www.anthropic.com/) - The AI brain
- [Vite](https://vitejs.dev/) - Lightning-fast dev environment
- [Tailwind CSS](https://tailwindcss.com/) - Beautiful styling
- [Lucide Icons](https://lucide.dev/) - Clean iconography

---

**Made for people who think fast and don't want tools to slow them down.**
