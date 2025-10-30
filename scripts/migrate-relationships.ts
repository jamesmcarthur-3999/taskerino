/**
 * Relationship Migration Script
 *
 * Standalone migration script that migrates legacy relationship fields to the new
 * unified relationship system.
 *
 * Usage:
 *   npx tsx scripts/migrate-relationships.ts --dry-run  # Preview changes
 *   npx tsx scripts/migrate-relationships.ts            # Run migration
 */

import { readFile, writeFile, copyFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';

// Storage path
const STORAGE_PATH = join(homedir(), 'Library', 'Application Support', 'com.taskerino.app', 'db');

// Command line args
const isDryRun = process.argv.includes('--dry-run');

// Types (inline to avoid import issues)
interface Relationship {
  id: string;
  type: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, any>;
  canonical?: boolean;
}

interface Task {
  id: string;
  noteId?: string;
  sourceNoteId?: string;
  sourceSessionId?: string;
  relationships?: Relationship[];
  relationshipVersion?: number;
  createdAt?: string;
  [key: string]: any;
}

interface Note {
  id: string;
  topicId?: string;
  topicIds?: string[];
  companyIds?: string[];
  contactIds?: string[];
  parentNoteId?: string;
  sourceSessionId?: string;
  relationships?: Relationship[];
  relationshipVersion?: number;
  timestamp?: string;
  [key: string]: any;
}

interface Session {
  id: string;
  extractedTaskIds?: string[];
  extractedNoteIds?: string[];
  relationships?: Relationship[];
  relationshipVersion?: number;
  startTime?: string;
  [key: string]: any;
}

// Helper to generate IDs
function generateId(): string {
  return randomBytes(16).toString('hex');
}

// Helper to create relationship
function createRelationship(params: {
  type: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  createdAt?: string;
}): Relationship {
  return {
    id: generateId(),
    type: params.type,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    targetType: params.targetType,
    targetId: params.targetId,
    metadata: {
      source: 'migration',
      createdAt: params.createdAt || new Date().toISOString(),
    },
    canonical: true,
  };
}

// Load data from storage
async function loadData<T>(filename: string): Promise<T | null> {
  try {
    const path = join(STORAGE_PATH, filename);
    const content = await readFile(path, 'utf-8');
    const parsed = JSON.parse(content);

    // Handle metadata wrapper format
    if (parsed.version !== undefined && parsed.data !== undefined) {
      return parsed.data as T;
    }
    return parsed as T;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw error;
  }
}

// Save data to storage
async function saveData<T>(filename: string, data: T): Promise<void> {
  const path = join(STORAGE_PATH, filename);

  // Wrap in metadata format
  const wrapped = {
    version: 1,
    timestamp: Date.now(),
    data,
  };

  await writeFile(path, JSON.stringify(wrapped, null, 2), 'utf-8');
}

// Create backup
async function createBackup(filename: string): Promise<string> {
  const backupId = `backup-${Date.now()}`;
  const srcPath = join(STORAGE_PATH, filename);
  const backupPath = join(STORAGE_PATH, `${filename}.${backupId}`);

  try {
    await copyFile(srcPath, backupPath);
    return backupPath;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return ''; // File doesn't exist, no backup needed
    }
    throw error;
  }
}

// Migrate tasks
function migrateTasks(tasks: Task[], noteIds: Set<string>, sessionIds: Set<string>) {
  const stats = {
    migrated: 0,
    taskNote: 0,
    taskSession: 0,
    orphaned: 0,
  };

  for (const task of tasks) {
    // Skip if already migrated
    if (task.relationshipVersion === 1) continue;

    const relationships: Relationship[] = [];

    // Migrate noteId
    if (task.noteId) {
      if (noteIds.has(task.noteId)) {
        relationships.push(
          createRelationship({
            type: 'TASK_NOTE',
            sourceType: 'TASK',
            sourceId: task.id,
            targetType: 'NOTE',
            targetId: task.noteId,
            createdAt: task.createdAt,
          })
        );
        stats.taskNote++;
      } else {
        stats.orphaned++;
      }
    }

    // Migrate sourceNoteId (if different from noteId)
    if (task.sourceNoteId && task.sourceNoteId !== task.noteId) {
      if (noteIds.has(task.sourceNoteId)) {
        relationships.push(
          createRelationship({
            type: 'TASK_NOTE',
            sourceType: 'TASK',
            sourceId: task.id,
            targetType: 'NOTE',
            targetId: task.sourceNoteId,
            createdAt: task.createdAt,
          })
        );
        stats.taskNote++;
      } else {
        stats.orphaned++;
      }
    }

    // Migrate sourceSessionId
    if (task.sourceSessionId) {
      if (sessionIds.has(task.sourceSessionId)) {
        relationships.push(
          createRelationship({
            type: 'TASK_SESSION',
            sourceType: 'TASK',
            sourceId: task.id,
            targetType: 'SESSION',
            targetId: task.sourceSessionId,
            createdAt: task.createdAt,
          })
        );
        stats.taskSession++;
      } else {
        stats.orphaned++;
      }
    }

    if (relationships.length > 0 || task.relationshipVersion !== 1) {
      task.relationships = relationships;
      task.relationshipVersion = 1;
      stats.migrated++;
    }
  }

  return stats;
}

// Migrate notes
function migrateNotes(notes: Note[], sessionIds: Set<string>) {
  const stats = {
    migrated: 0,
    noteTopic: 0,
    noteCompany: 0,
    noteContact: 0,
    noteParent: 0,
    noteSession: 0,
    orphaned: 0,
  };

  for (const note of notes) {
    // Skip if already migrated
    if (note.relationshipVersion === 1) continue;

    const relationships: Relationship[] = [];

    // Migrate topicId/topicIds
    const topicIds = note.topicIds || (note.topicId ? [note.topicId] : []);
    for (const topicId of topicIds) {
      relationships.push(
        createRelationship({
          type: 'NOTE_TOPIC',
          sourceType: 'NOTE',
          sourceId: note.id,
          targetType: 'TOPIC',
          targetId: topicId,
          createdAt: note.timestamp,
        })
      );
      stats.noteTopic++;
    }

    // Migrate companyIds
    for (const companyId of note.companyIds || []) {
      relationships.push(
        createRelationship({
          type: 'NOTE_COMPANY',
          sourceType: 'NOTE',
          sourceId: note.id,
          targetType: 'COMPANY',
          targetId: companyId,
          createdAt: note.timestamp,
        })
      );
      stats.noteCompany++;
    }

    // Migrate contactIds
    for (const contactId of note.contactIds || []) {
      relationships.push(
        createRelationship({
          type: 'NOTE_CONTACT',
          sourceType: 'NOTE',
          sourceId: note.id,
          targetType: 'CONTACT',
          targetId: contactId,
          createdAt: note.timestamp,
        })
      );
      stats.noteContact++;
    }

    // Migrate parentNoteId
    if (note.parentNoteId) {
      relationships.push(
        createRelationship({
          type: 'NOTE_PARENT',
          sourceType: 'NOTE',
          sourceId: note.id,
          targetType: 'NOTE',
          targetId: note.parentNoteId,
          createdAt: note.timestamp,
        })
      );
      stats.noteParent++;
    }

    // Migrate sourceSessionId
    if (note.sourceSessionId) {
      if (sessionIds.has(note.sourceSessionId)) {
        relationships.push(
          createRelationship({
            type: 'NOTE_SESSION',
            sourceType: 'NOTE',
            sourceId: note.id,
            targetType: 'SESSION',
            targetId: note.sourceSessionId,
            createdAt: note.timestamp,
          })
        );
        stats.noteSession++;
      } else {
        stats.orphaned++;
      }
    }

    note.relationships = relationships;
    note.relationshipVersion = 1;
    if (relationships.length > 0) {
      stats.migrated++;
    }
  }

  return stats;
}

// Migrate sessions
function migrateSessions(sessions: Session[], taskIds: Set<string>, noteIds: Set<string>) {
  const stats = {
    migrated: 0,
    taskSession: 0,
    noteSession: 0,
    orphaned: 0,
  };

  for (const session of sessions) {
    // Skip if already migrated
    if (session.relationshipVersion === 1) continue;

    const relationships: Relationship[] = [];

    // Migrate extractedTaskIds
    for (const taskId of session.extractedTaskIds || []) {
      if (taskIds.has(taskId)) {
        relationships.push(
          createRelationship({
            type: 'TASK_SESSION',
            sourceType: 'SESSION',
            sourceId: session.id,
            targetType: 'TASK',
            targetId: taskId,
            createdAt: session.startTime,
          })
        );
        stats.taskSession++;
      } else {
        stats.orphaned++;
      }
    }

    // Migrate extractedNoteIds
    for (const noteId of session.extractedNoteIds || []) {
      if (noteIds.has(noteId)) {
        relationships.push(
          createRelationship({
            type: 'NOTE_SESSION',
            sourceType: 'SESSION',
            sourceId: session.id,
            targetType: 'NOTE',
            targetId: noteId,
            createdAt: session.startTime,
          })
        );
        stats.noteSession++;
      } else {
        stats.orphaned++;
      }
    }

    session.relationships = relationships;
    session.relationshipVersion = 1;
    if (relationships.length > 0) {
      stats.migrated++;
    }
  }

  return stats;
}

// Main migration function
async function migrate() {
  console.log('\n=== Relationship Migration ===\n');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}\n`);

  try {
    // Load data
    console.log('Loading data...');
    const tasks = (await loadData<Task[]>('tasks.json')) || [];
    const notes = (await loadData<Note[]>('notes.json')) || [];
    const sessions = (await loadData<Session[]>('sessions.json')) || [];

    console.log(`  Tasks: ${tasks.length}`);
    console.log(`  Notes: ${notes.length}`);
    console.log(`  Sessions: ${sessions.length}\n`);

    // Create ID sets for validation
    const taskIds = new Set(tasks.map(t => t.id));
    const noteIds = new Set(notes.map(n => n.id));
    const sessionIds = new Set(sessions.map(s => s.id));

    // Backup before live migration
    if (!isDryRun) {
      console.log('Creating backups...');
      if (tasks.length > 0) await createBackup('tasks.json');
      if (notes.length > 0) await createBackup('notes.json');
      if (sessions.length > 0) await createBackup('sessions.json');
      console.log('  Backups created\n');
    }

    // Migrate each collection
    console.log('Migrating relationships...\n');

    const taskStats = migrateTasks(tasks, noteIds, sessionIds);
    const noteStats = migrateNotes(notes, sessionIds);
    const sessionStats = migrateSessions(sessions, taskIds, noteIds);

    // Print results
    console.log('Results:');
    console.log(`  Tasks migrated: ${taskStats.migrated}`);
    console.log(`    - Task→Note: ${taskStats.taskNote}`);
    console.log(`    - Task→Session: ${taskStats.taskSession}`);
    console.log(`    - Orphaned: ${taskStats.orphaned}`);

    console.log(`  Notes migrated: ${noteStats.migrated}`);
    console.log(`    - Note→Topic: ${noteStats.noteTopic}`);
    console.log(`    - Note→Company: ${noteStats.noteCompany}`);
    console.log(`    - Note→Contact: ${noteStats.noteContact}`);
    console.log(`    - Note→Parent: ${noteStats.noteParent}`);
    console.log(`    - Note→Session: ${noteStats.noteSession}`);
    console.log(`    - Orphaned: ${noteStats.orphaned}`);

    console.log(`  Sessions migrated: ${sessionStats.migrated}`);
    console.log(`    - Task→Session: ${sessionStats.taskSession}`);
    console.log(`    - Note→Session: ${sessionStats.noteSession}`);
    console.log(`    - Orphaned: ${sessionStats.orphaned}\n`);

    const totalRels =
      taskStats.taskNote +
      taskStats.taskSession +
      noteStats.noteTopic +
      noteStats.noteCompany +
      noteStats.noteContact +
      noteStats.noteParent +
      noteStats.noteSession +
      sessionStats.taskSession +
      sessionStats.noteSession;

    console.log(`Total relationships created: ${totalRels}`);

    const totalOrphaned = taskStats.orphaned + noteStats.orphaned + sessionStats.orphaned;
    if (totalOrphaned > 0) {
      console.log(`Total orphaned references: ${totalOrphaned} (skipped)\n`);
    }

    // Save if not dry run
    if (!isDryRun) {
      console.log('\nSaving migrated data...');
      if (tasks.length > 0) await saveData('tasks.json', tasks);
      if (notes.length > 0) await saveData('notes.json', notes);
      if (sessions.length > 0) await saveData('sessions.json', sessions);
      console.log('✅ Migration complete!\n');
      console.log('Backups are stored in the same directory with .backup-* suffix');
    } else {
      console.log('\n✅ Dry run complete (no changes made)');
      console.log('Run without --dry-run to apply changes\n');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
