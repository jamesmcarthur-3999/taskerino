/**
 * Seed Session Tags and Categories
 *
 * This script adds initial tags and categories to existing sessions
 * to kickstart the automatic tagging system.
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

interface Session {
  id: string;
  name: string;
  description?: string;
  category?: string;
  subCategory?: string;
  tags?: string[];
  status: 'active' | 'paused' | 'completed';
  startTime: string;
  endTime?: string;
  summary?: {
    narrative?: string;
    achievements?: string[];
    blockers?: string[];
    recommendedTasks?: Array<{
      title: string;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      context?: string;
    }>;
    keyInsights?: Array<{
      insight: string;
      timestamp: string;
    }>;
  };
  [key: string]: any;
}

// Smart tag suggestions based on session content
function suggestTagsForSession(session: Session): {
  category?: string;
  subCategory?: string;
  tags: string[];
} {
  const name = session.name?.toLowerCase() || '';
  const description = session.description?.toLowerCase() || '';
  const summary = session.summary?.narrative?.toLowerCase() || '';
  const content = `${name} ${description} ${summary}`;

  const tags: string[] = [];
  let category: string | undefined;
  let subCategory: string | undefined;

  // Development-related patterns
  if (content.includes('bug') || content.includes('fix') || content.includes('debug')) {
    category = 'Deep Work';
    subCategory = 'Bug Fixes';
    tags.push('bug-fix', 'debugging');
  } else if (content.includes('feature') || content.includes('implement') || content.includes('build')) {
    category = 'Deep Work';
    subCategory = 'Feature Development';
    tags.push('feature', 'development');
  } else if (content.includes('refactor') || content.includes('cleanup') || content.includes('improve')) {
    category = 'Deep Work';
    subCategory = 'Refactoring';
    tags.push('refactoring', 'code-quality');
  } else if (content.includes('test') || content.includes('testing')) {
    category = 'Deep Work';
    subCategory = 'Testing';
    tags.push('testing', 'qa');
  } else if (content.includes('design') || content.includes('ui') || content.includes('ux')) {
    category = 'Creative Work';
    subCategory = 'UI/UX Design';
    tags.push('design', 'ui');
  }

  // Meeting patterns
  if (content.includes('meeting') || content.includes('standup') || content.includes('sync')) {
    category = 'Meetings';
    if (content.includes('standup') || content.includes('daily')) {
      subCategory = 'Daily Standup';
      tags.push('standup', 'team');
    } else if (content.includes('planning') || content.includes('sprint')) {
      subCategory = 'Planning';
      tags.push('planning', 'sprint');
    } else if (content.includes('client')) {
      subCategory = 'Client Meeting';
      tags.push('client', 'external');
    } else {
      subCategory = 'Team Meeting';
      tags.push('team', 'sync');
    }
  }

  // Research patterns
  if (content.includes('research') || content.includes('investigation') || content.includes('explore')) {
    category = 'Research';
    subCategory = 'Technical Research';
    tags.push('research', 'learning');
  }

  // Technology stack detection
  if (content.includes('react') || content.includes('component')) {
    tags.push('react', 'frontend');
  }
  if (content.includes('typescript') || content.includes('types')) {
    tags.push('typescript');
  }
  if (content.includes('api') || content.includes('endpoint')) {
    tags.push('api', 'backend');
  }
  if (content.includes('database') || content.includes('sql') || content.includes('query')) {
    tags.push('database');
  }
  if (content.includes('tauri')) {
    tags.push('tauri', 'desktop');
  }

  // Priority/urgency detection
  if (content.includes('urgent') || content.includes('critical') || content.includes('emergency')) {
    tags.push('urgent');
  }
  if (content.includes('important') || content.includes('high priority')) {
    tags.push('high-priority');
  }

  // Default fallback
  if (!category) {
    category = 'Deep Work';
    subCategory = 'General Development';
    tags.push('development');
  }

  // Remove duplicates
  const uniqueTags = Array.from(new Set(tags));

  return {
    category,
    subCategory,
    tags: uniqueTags.slice(0, 5), // Max 5 tags
  };
}

async function seedSessionTags() {
  try {
    console.log('🏷️  Seeding session tags and categories...\n');

    // Determine storage path (Tauri uses ~/Library/Application Support/com.taskerino.app)
    const storagePath = join(
      homedir(),
      'Library',
      'Application Support',
      'com.taskerino.app',
      'db',
      'sessions.json'
    );

    console.log(`📂 Reading sessions from: ${storagePath}`);

    // Read sessions
    let sessions: Session[];
    let metadata: any = null;
    try {
      const data = await readFile(storagePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Handle both old and new format (with metadata wrapper)
      if (parsed.version && parsed.data !== undefined) {
        // New format with metadata
        metadata = {
          version: parsed.version,
          checksum: parsed.checksum,
          timestamp: parsed.timestamp,
        };
        sessions = parsed.data;
      } else {
        // Old format without metadata
        sessions = parsed;
      }

      console.log(`✅ Found ${sessions.length} sessions\n`);
    } catch (error) {
      console.error('❌ Could not read sessions file. Make sure the app has been run at least once.');
      console.error(`   Path: ${storagePath}`);
      return;
    }

    // Track changes
    let updatedCount = 0;
    let skippedCount = 0;

    // Process each session
    for (const session of sessions) {
      // Skip if already has tags and category
      if (session.tags && session.tags.length > 0 && session.category) {
        console.log(`⏭️  Skipping "${session.name}" (already has tags and category)`);
        skippedCount++;
        continue;
      }

      // Suggest tags and categories
      const suggestions = suggestTagsForSession(session);

      // Apply suggestions (only if not already set)
      if (!session.category) {
        session.category = suggestions.category;
      }
      if (!session.subCategory) {
        session.subCategory = suggestions.subCategory;
      }
      if (!session.tags || session.tags.length === 0) {
        session.tags = suggestions.tags;
      }

      console.log(`✨ Updated "${session.name}"`);
      console.log(`   Category: ${session.category} > ${session.subCategory}`);
      console.log(`   Tags: ${session.tags.join(', ')}\n`);

      updatedCount++;
    }

    // Save back to storage, preserving metadata wrapper if it existed
    let outputData: string;
    if (metadata) {
      // Wrap in metadata (maintain the same format)
      const wrapped = {
        ...metadata,
        timestamp: Date.now(), // Update timestamp since we're modifying
        data: sessions,
      };
      outputData = JSON.stringify(wrapped, null, 2);
    } else {
      // No metadata wrapper
      outputData = JSON.stringify(sessions, null, 2);
    }

    await writeFile(storagePath, outputData, 'utf-8');

    console.log('\n✅ Seeding complete!');
    console.log(`   Updated: ${updatedCount} sessions`);
    console.log(`   Skipped: ${skippedCount} sessions (already tagged)`);
    console.log(`   Total: ${sessions.length} sessions\n`);
    console.log('🔄 Restart the app to see the changes.');

  } catch (error) {
    console.error('❌ Error seeding tags:', error);
    process.exit(1);
  }
}

// Run the seeder
seedSessionTags();
