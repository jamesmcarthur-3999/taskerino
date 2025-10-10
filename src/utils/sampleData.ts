import type { Company, Contact, Topic, Note, Task } from '../types';
import { generateId } from './helpers';

/**
 * Generate sample data for first-time users
 * All sample data is marked with a special tag "sample-data" for easy removal
 */
export function generateSampleData() {
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Sample Companies
  const companies: Company[] = [
    {
      id: generateId(),
      name: 'Acme Corp',
      createdAt: yesterday,
      lastUpdated: now,
      noteCount: 1,
      profile: {
        industry: 'Technology',
        description: 'Sample company - Feel free to delete',
      },
    },
  ];

  // Sample Contacts
  const contacts: Contact[] = [
    {
      id: generateId(),
      name: 'John Doe',
      createdAt: yesterday,
      lastUpdated: now,
      noteCount: 1,
      profile: {
        role: 'Product Manager',
        companyId: companies[0].id,
      },
    },
  ];

  // Sample Topics
  const topics: Topic[] = [
    {
      id: generateId(),
      name: 'Product Ideas',
      createdAt: yesterday,
      lastUpdated: now,
      noteCount: 1,
    },
  ];

  // Sample Notes
  const notes: Note[] = [
    {
      id: generateId(),
      companyIds: [companies[0].id],
      contactIds: [contacts[0].id],
      content: `# Meeting with John from Acme Corp

Had a great discussion about their product roadmap. Key points:

- They're looking to integrate AI features into their platform
- Timeline is Q1 2025
- Budget approved for $100k initial phase
- John will send over technical requirements by Friday

**Next Steps:**
- Review technical docs when received
- Schedule follow-up demo
- Prepare proposal draft`,
      summary: 'Meeting with John from Acme Corp about AI integration project. Budget approved for $100k, timeline Q1 2025.',
      timestamp: yesterday,
      lastUpdated: now,
      source: 'call',
      tags: ['sample-data', 'meeting-notes', 'ai-integration'],
      metadata: {
        sentiment: 'positive',
        keyPoints: [
          'AI integration project approved',
          '$100k budget allocated',
          'Q1 2025 timeline',
        ],
      },
    },
    {
      id: generateId(),
      topicIds: [topics[0].id],
      content: `# Product Feature Idea: Smart Notes

What if we had AI automatically:
1. Summarize long notes
2. Extract action items
3. Link related conversations
4. Suggest follow-ups

This could save hours per week!

**Considerations:**
- Privacy concerns with AI processing
- Cost per API call
- User control over automation level`,
      summary: 'Idea for smart notes feature with AI auto-summarization, action extraction, and smart linking.',
      timestamp: now,
      lastUpdated: now,
      source: 'thought',
      tags: ['sample-data', 'product-idea', 'ai'],
      metadata: {
        sentiment: 'positive',
        keyPoints: [
          'AI auto-summarization',
          'Automatic action extraction',
          'Smart conversation linking',
        ],
      },
    },
  ];

  // Sample Tasks
  const tasks: Task[] = [
    {
      id: generateId(),
      title: 'Review Acme Corp technical requirements',
      description: 'John will send technical requirements by Friday. Review and prepare initial assessment.',
      done: false,
      priority: 'high',
      status: 'todo',
      dueDate: tomorrow,
      createdBy: 'ai',
      createdAt: yesterday,
      tags: ['sample-data', 'acme-corp'],
      sourceNoteId: notes[0].id,
      sourceExcerpt: 'John will send over technical requirements by Friday',
      contextForAgent: 'This task was extracted from a meeting note about Acme Corp AI integration project.',
    },
    {
      id: generateId(),
      title: 'Schedule follow-up demo with John',
      description: 'Set up a demo to showcase our AI capabilities for the Acme Corp project.',
      done: false,
      priority: 'medium',
      status: 'todo',
      dueDate: nextWeek,
      createdBy: 'ai',
      createdAt: yesterday,
      tags: ['sample-data', 'acme-corp', 'demo'],
      sourceNoteId: notes[0].id,
      sourceExcerpt: 'Schedule follow-up demo',
      contextForAgent: 'Follow-up task from Acme Corp meeting to demonstrate product capabilities.',
    },
    {
      id: generateId(),
      title: 'Try capturing a note',
      description: 'Go to the Capture tab and type or paste any text. AI will organize it for you!',
      done: false,
      priority: 'low',
      status: 'todo',
      createdBy: 'manual',
      createdAt: now,
      tags: ['sample-data', 'getting-started'],
    },
  ];

  return {
    companies,
    contacts,
    topics,
    notes,
    tasks,
  };
}

/**
 * Check if sample data exists by looking for the "sample-data" tag
 */
export function hasSampleData(state: { notes: Note[]; tasks: Task[] }): boolean {
  const hasSampleNotes = state.notes.some(note => note.tags?.includes('sample-data'));
  const hasSampleTasks = state.tasks.some(task => task.tags?.includes('sample-data'));
  return hasSampleNotes || hasSampleTasks;
}

/**
 * Remove all sample data from the app
 */
export function removeSampleData(state: {
  companies: Company[];
  contacts: Contact[];
  topics: Topic[];
  notes: Note[];
  tasks: Task[];
}) {
  // Get IDs of sample notes and tasks
  const sampleNoteIds = state.notes
    .filter(note => note.tags?.includes('sample-data'))
    .map(note => note.id);

  const sampleTaskIds = state.tasks
    .filter(task => task.tags?.includes('sample-data'))
    .map(task => task.id);

  // Get entity IDs linked to sample notes
  const sampleCompanyIds = new Set<string>();
  const sampleContactIds = new Set<string>();
  const sampleTopicIds = new Set<string>();

  state.notes
    .filter(note => note.tags?.includes('sample-data'))
    .forEach(note => {
      note.companyIds?.forEach(id => sampleCompanyIds.add(id));
      note.contactIds?.forEach(id => sampleContactIds.add(id));
      note.topicIds?.forEach(id => sampleTopicIds.add(id));
      if (note.topicId) sampleTopicIds.add(note.topicId);
    });

  return {
    companies: state.companies.filter(c => !sampleCompanyIds.has(c.id)),
    contacts: state.contacts.filter(c => !sampleContactIds.has(c.id)),
    topics: state.topics.filter(t => !sampleTopicIds.has(t.id)),
    notes: state.notes.filter(note => !sampleNoteIds.includes(note.id)),
    tasks: state.tasks.filter(task => !sampleTaskIds.includes(task.id)),
  };
}
