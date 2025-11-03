/**
 * Companies & Contacts Migration Script
 *
 * Standalone migration script that migrates legacy company/contact arrays to the new
 * unified relationship system.
 *
 * Migrates:
 * - task.companyIds[] → TASK_COMPANY relationships
 * - task.contactIds[] → TASK_CONTACT relationships
 * - note.companyIds[] → NOTE_COMPANY relationships (already handled by migrate-relationships.ts)
 * - note.contactIds[] → NOTE_CONTACT relationships (already handled by migrate-relationships.ts)
 * - session.companyIds[] → SESSION_COMPANY relationships (if exists)
 * - session.contactIds[] → SESSION_CONTACT relationships (if exists)
 *
 * Usage:
 *   npx tsx scripts/migrate-companies-contacts.ts --dry-run  # Preview changes
 *   npx tsx scripts/migrate-companies-contacts.ts            # Run migration
 *   npx tsx scripts/migrate-companies-contacts.ts --verbose  # Detailed logging
 */

import { readFile, writeFile, copyFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';

// Storage path
const STORAGE_PATH = join(homedir(), 'Library', 'Application Support', 'com.taskerino.app', 'db');
const BACKUP_PATH = join(homedir(), 'Library', 'Application Support', 'com.taskerino.app', 'backups');

// Command line args
const isDryRun = process.argv.includes('--dry-run');
const isVerbose = process.argv.includes('--verbose');

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
  companyIds?: string[];
  contactIds?: string[];
  relationships?: Relationship[];
  relationshipVersion?: number;
  createdAt?: string;
  [key: string]: any;
}

interface Note {
  id: string;
  companyIds?: string[];
  contactIds?: string[];
  relationships?: Relationship[];
  relationshipVersion?: number;
  timestamp?: string;
  [key: string]: any;
}

interface Session {
  id: string;
  companyIds?: string[];
  contactIds?: string[];
  relationships?: Relationship[];
  relationshipVersion?: number;
  startTime?: string;
  [key: string]: any;
}

interface Company {
  id: string;
  name: string;
  [key: string]: any;
}

interface Contact {
  id: string;
  name: string;
  [key: string]: any;
}

interface MigrationProgress {
  phase: string;
  current: number;
  total: number;
  percentage: number;
}

interface MigrationResult {
  success: boolean;
  tasksProcessed: number;
  notesProcessed: number;
  sessionsProcessed: number;
  relationshipsCreated: number;
  errors: Array<{ entity: string; error: string }>;
  duration: number;
}

interface MigrationStats {
  taskCompany: number;
  taskContact: number;
  noteCompany: number;
  noteContact: number;
  sessionCompany: number;
  sessionContact: number;
  orphaned: number;
  migrated: number;
}

// Helper to generate IDs
function generateId(): string {
  return randomBytes(16).toString('hex');
}

// Helper to log progress
function logProgress(message: string, verbose = false): void {
  if (verbose && !isVerbose) return;
  console.log(message);
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

// Create backup directory with timestamp
async function createBackupDirectory(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(BACKUP_PATH, `pre-companies-contacts-migration-${timestamp}`);

  await mkdir(backupDir, { recursive: true });
  return backupDir;
}

// Create backup
async function createBackup(filename: string, backupDir: string): Promise<string> {
  const srcPath = join(STORAGE_PATH, filename);
  const backupPath = join(backupDir, filename);

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

// Migrate task companies
async function migrateTaskCompanies(
  task: Task,
  companyIds: Set<string>,
  errors: Array<{ entity: string; error: string }>
): Promise<Relationship[]> {
  const relationships: Relationship[] = [];

  if (!task.companyIds || task.companyIds.length === 0) {
    return relationships;
  }

  for (const companyId of task.companyIds) {
    try {
      // Validate company exists
      if (!companyIds.has(companyId)) {
        errors.push({
          entity: `Task ${task.id}`,
          error: `Company ${companyId} does not exist`,
        });
        continue;
      }

      relationships.push(
        createRelationship({
          type: 'TASK_COMPANY',
          sourceType: 'TASK',
          sourceId: task.id,
          targetType: 'COMPANY',
          targetId: companyId,
          createdAt: task.createdAt,
        })
      );

      logProgress(`  ✓ Task ${task.id} → Company ${companyId}`, true);
    } catch (error: any) {
      errors.push({
        entity: `Task ${task.id}`,
        error: `Failed to create TASK_COMPANY relationship: ${error.message}`,
      });
    }
  }

  return relationships;
}

// Migrate task contacts
async function migrateTaskContacts(
  task: Task,
  contactIds: Set<string>,
  errors: Array<{ entity: string; error: string }>
): Promise<Relationship[]> {
  const relationships: Relationship[] = [];

  if (!task.contactIds || task.contactIds.length === 0) {
    return relationships;
  }

  for (const contactId of task.contactIds) {
    try {
      // Validate contact exists
      if (!contactIds.has(contactId)) {
        errors.push({
          entity: `Task ${task.id}`,
          error: `Contact ${contactId} does not exist`,
        });
        continue;
      }

      relationships.push(
        createRelationship({
          type: 'TASK_CONTACT',
          sourceType: 'TASK',
          sourceId: task.id,
          targetType: 'CONTACT',
          targetId: contactId,
          createdAt: task.createdAt,
        })
      );

      logProgress(`  ✓ Task ${task.id} → Contact ${contactId}`, true);
    } catch (error: any) {
      errors.push({
        entity: `Task ${task.id}`,
        error: `Failed to create TASK_CONTACT relationship: ${error.message}`,
      });
    }
  }

  return relationships;
}

// Migrate note companies
async function migrateNoteCompanies(
  note: Note,
  companyIds: Set<string>,
  errors: Array<{ entity: string; error: string }>
): Promise<Relationship[]> {
  const relationships: Relationship[] = [];

  if (!note.companyIds || note.companyIds.length === 0) {
    return relationships;
  }

  for (const companyId of note.companyIds) {
    try {
      // Validate company exists
      if (!companyIds.has(companyId)) {
        errors.push({
          entity: `Note ${note.id}`,
          error: `Company ${companyId} does not exist`,
        });
        continue;
      }

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

      logProgress(`  ✓ Note ${note.id} → Company ${companyId}`, true);
    } catch (error: any) {
      errors.push({
        entity: `Note ${note.id}`,
        error: `Failed to create NOTE_COMPANY relationship: ${error.message}`,
      });
    }
  }

  return relationships;
}

// Migrate note contacts
async function migrateNoteContacts(
  note: Note,
  contactIds: Set<string>,
  errors: Array<{ entity: string; error: string }>
): Promise<Relationship[]> {
  const relationships: Relationship[] = [];

  if (!note.contactIds || note.contactIds.length === 0) {
    return relationships;
  }

  for (const contactId of note.contactIds) {
    try {
      // Validate contact exists
      if (!contactIds.has(contactId)) {
        errors.push({
          entity: `Note ${note.id}`,
          error: `Contact ${contactId} does not exist`,
        });
        continue;
      }

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

      logProgress(`  ✓ Note ${note.id} → Contact ${contactId}`, true);
    } catch (error: any) {
      errors.push({
        entity: `Note ${note.id}`,
        error: `Failed to create NOTE_CONTACT relationship: ${error.message}`,
      });
    }
  }

  return relationships;
}

// Migrate session companies
async function migrateSessionCompanies(
  session: Session,
  companyIds: Set<string>,
  errors: Array<{ entity: string; error: string }>
): Promise<Relationship[]> {
  const relationships: Relationship[] = [];

  if (!session.companyIds || session.companyIds.length === 0) {
    return relationships;
  }

  for (const companyId of session.companyIds) {
    try {
      // Validate company exists
      if (!companyIds.has(companyId)) {
        errors.push({
          entity: `Session ${session.id}`,
          error: `Company ${companyId} does not exist`,
        });
        continue;
      }

      relationships.push(
        createRelationship({
          type: 'SESSION_COMPANY',
          sourceType: 'SESSION',
          sourceId: session.id,
          targetType: 'COMPANY',
          targetId: companyId,
          createdAt: session.startTime,
        })
      );

      logProgress(`  ✓ Session ${session.id} → Company ${companyId}`, true);
    } catch (error: any) {
      errors.push({
        entity: `Session ${session.id}`,
        error: `Failed to create SESSION_COMPANY relationship: ${error.message}`,
      });
    }
  }

  return relationships;
}

// Migrate session contacts
async function migrateSessionContacts(
  session: Session,
  contactIds: Set<string>,
  errors: Array<{ entity: string; error: string }>
): Promise<Relationship[]> {
  const relationships: Relationship[] = [];

  if (!session.contactIds || session.contactIds.length === 0) {
    return relationships;
  }

  for (const contactId of session.contactIds) {
    try {
      // Validate contact exists
      if (!contactIds.has(contactId)) {
        errors.push({
          entity: `Session ${session.id}`,
          error: `Contact ${contactId} does not exist`,
        });
        continue;
      }

      relationships.push(
        createRelationship({
          type: 'SESSION_CONTACT',
          sourceType: 'SESSION',
          sourceId: session.id,
          targetType: 'CONTACT',
          targetId: contactId,
          createdAt: session.startTime,
        })
      );

      logProgress(`  ✓ Session ${session.id} → Contact ${contactId}`, true);
    } catch (error: any) {
      errors.push({
        entity: `Session ${session.id}`,
        error: `Failed to create SESSION_CONTACT relationship: ${error.message}`,
      });
    }
  }

  return relationships;
}

// Migrate tasks
async function migrateTasks(
  tasks: Task[],
  companyIds: Set<string>,
  contactIds: Set<string>,
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    taskCompany: 0,
    taskContact: 0,
    noteCompany: 0,
    noteContact: 0,
    sessionCompany: 0,
    sessionContact: 0,
    orphaned: 0,
    migrated: 0,
  };
  const errors: Array<{ entity: string; error: string }> = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    // Progress callback
    if (onProgress) {
      onProgress({
        phase: 'tasks',
        current: i + 1,
        total: tasks.length,
        percentage: Math.round(((i + 1) / tasks.length) * 100),
      });
    }

    // Skip if already migrated
    if (task.relationshipVersion === 1) {
      logProgress(`  ⊘ Task ${task.id} already migrated (relationshipVersion=1)`, true);
      continue;
    }

    // Initialize relationships array if needed
    const existingRelationships = task.relationships || [];
    const newRelationships: Relationship[] = [];

    // Migrate companies
    const companyRels = await migrateTaskCompanies(task, companyIds, errors);
    newRelationships.push(...companyRels);
    stats.taskCompany += companyRels.length;

    // Migrate contacts
    const contactRels = await migrateTaskContacts(task, contactIds, errors);
    newRelationships.push(...contactRels);
    stats.taskContact += contactRels.length;

    // Update task if any relationships were created
    if (newRelationships.length > 0 || task.relationshipVersion !== 1) {
      task.relationships = [...existingRelationships, ...newRelationships];
      task.relationshipVersion = 1;
      stats.migrated++;
      logProgress(`  ✓ Migrated Task ${task.id} (${newRelationships.length} relationships)`, true);
    }
  }

  return stats;
}

// Migrate notes
async function migrateNotes(
  notes: Note[],
  companyIds: Set<string>,
  contactIds: Set<string>,
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    taskCompany: 0,
    taskContact: 0,
    noteCompany: 0,
    noteContact: 0,
    sessionCompany: 0,
    sessionContact: 0,
    orphaned: 0,
    migrated: 0,
  };
  const errors: Array<{ entity: string; error: string }> = [];

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];

    // Progress callback
    if (onProgress) {
      onProgress({
        phase: 'notes',
        current: i + 1,
        total: notes.length,
        percentage: Math.round(((i + 1) / notes.length) * 100),
      });
    }

    // Skip if already migrated
    if (note.relationshipVersion === 1) {
      logProgress(`  ⊘ Note ${note.id} already migrated (relationshipVersion=1)`, true);
      continue;
    }

    // Initialize relationships array if needed
    const existingRelationships = note.relationships || [];
    const newRelationships: Relationship[] = [];

    // Migrate companies
    const companyRels = await migrateNoteCompanies(note, companyIds, errors);
    newRelationships.push(...companyRels);
    stats.noteCompany += companyRels.length;

    // Migrate contacts
    const contactRels = await migrateNoteContacts(note, contactIds, errors);
    newRelationships.push(...contactRels);
    stats.noteContact += contactRels.length;

    // Update note if any relationships were created
    if (newRelationships.length > 0 || note.relationshipVersion !== 1) {
      note.relationships = [...existingRelationships, ...newRelationships];
      note.relationshipVersion = 1;
      stats.migrated++;
      logProgress(`  ✓ Migrated Note ${note.id} (${newRelationships.length} relationships)`, true);
    }
  }

  return stats;
}

// Migrate sessions
async function migrateSessions(
  sessions: Session[],
  companyIds: Set<string>,
  contactIds: Set<string>,
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    taskCompany: 0,
    taskContact: 0,
    noteCompany: 0,
    noteContact: 0,
    sessionCompany: 0,
    sessionContact: 0,
    orphaned: 0,
    migrated: 0,
  };
  const errors: Array<{ entity: string; error: string }> = [];

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];

    // Progress callback
    if (onProgress) {
      onProgress({
        phase: 'sessions',
        current: i + 1,
        total: sessions.length,
        percentage: Math.round(((i + 1) / sessions.length) * 100),
      });
    }

    // Skip if already migrated
    if (session.relationshipVersion === 1) {
      logProgress(`  ⊘ Session ${session.id} already migrated (relationshipVersion=1)`, true);
      continue;
    }

    // Initialize relationships array if needed
    const existingRelationships = session.relationships || [];
    const newRelationships: Relationship[] = [];

    // Migrate companies
    const companyRels = await migrateSessionCompanies(session, companyIds, errors);
    newRelationships.push(...companyRels);
    stats.sessionCompany += companyRels.length;

    // Migrate contacts
    const contactRels = await migrateSessionContacts(session, contactIds, errors);
    newRelationships.push(...contactRels);
    stats.sessionContact += contactRels.length;

    // Update session if any relationships were created
    if (newRelationships.length > 0 || session.relationshipVersion !== 1) {
      session.relationships = [...existingRelationships, ...newRelationships];
      session.relationshipVersion = 1;
      stats.migrated++;
      logProgress(`  ✓ Migrated Session ${session.id} (${newRelationships.length} relationships)`, true);
    }
  }

  return stats;
}

// Main migration function
async function migrateCompaniesContactsToRelationships(options: {
  dryRun?: boolean;
  verbose?: boolean;
  onProgress?: (progress: MigrationProgress) => void;
}): Promise<MigrationResult> {
  const startTime = Date.now();
  const errors: Array<{ entity: string; error: string }> = [];

  try {
    console.log('\n=== Companies & Contacts Migration ===\n');
    console.log(`Mode: ${options.dryRun ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}\n`);

    // Load data
    console.log('Loading data...');
    const tasks = (await loadData<Task[]>('tasks.json')) || [];
    const notes = (await loadData<Note[]>('notes.json')) || [];
    const sessions = (await loadData<Session[]>('sessions.json')) || [];
    const companies = (await loadData<Company[]>('companies.json')) || [];
    const contacts = (await loadData<Contact[]>('contacts.json')) || [];

    console.log(`  Tasks: ${tasks.length}`);
    console.log(`  Notes: ${notes.length}`);
    console.log(`  Sessions: ${sessions.length}`);
    console.log(`  Companies: ${companies.length}`);
    console.log(`  Contacts: ${contacts.length}\n`);

    // Create ID sets for validation
    const companyIds = new Set(companies.map(c => c.id));
    const contactIds = new Set(contacts.map(c => c.id));

    // Count entities to migrate
    const tasksToMigrate = tasks.filter(t =>
      t.relationshipVersion !== 1 &&
      ((t.companyIds && t.companyIds.length > 0) || (t.contactIds && t.contactIds.length > 0))
    );
    const notesToMigrate = notes.filter(n =>
      n.relationshipVersion !== 1 &&
      ((n.companyIds && n.companyIds.length > 0) || (n.contactIds && n.contactIds.length > 0))
    );
    const sessionsToMigrate = sessions.filter(s =>
      s.relationshipVersion !== 1 &&
      ((s.companyIds && s.companyIds.length > 0) || (s.contactIds && s.contactIds.length > 0))
    );

    console.log('Entities to migrate:');
    console.log(`  Tasks: ${tasksToMigrate.length}`);
    console.log(`  Notes: ${notesToMigrate.length}`);
    console.log(`  Sessions: ${sessionsToMigrate.length}\n`);

    if (tasksToMigrate.length === 0 && notesToMigrate.length === 0 && sessionsToMigrate.length === 0) {
      console.log('✅ No entities to migrate (all already migrated or no legacy data)\n');
      return {
        success: true,
        tasksProcessed: 0,
        notesProcessed: 0,
        sessionsProcessed: 0,
        relationshipsCreated: 0,
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    // Create backup before live migration
    let backupDir = '';
    if (!options.dryRun) {
      console.log('Creating backups...');
      backupDir = await createBackupDirectory();
      if (tasks.length > 0) await createBackup('tasks.json', backupDir);
      if (notes.length > 0) await createBackup('notes.json', backupDir);
      if (sessions.length > 0) await createBackup('sessions.json', backupDir);
      console.log(`  Backups created in: ${backupDir}\n`);
    }

    // Migrate each collection
    console.log('Migrating relationships...\n');

    const taskStats = await migrateTasks(tasks, companyIds, contactIds, options.onProgress);
    const noteStats = await migrateNotes(notes, companyIds, contactIds, options.onProgress);
    const sessionStats = await migrateSessions(sessions, companyIds, contactIds, options.onProgress);

    // Calculate totals
    const totalRelationships =
      taskStats.taskCompany +
      taskStats.taskContact +
      noteStats.noteCompany +
      noteStats.noteContact +
      sessionStats.sessionCompany +
      sessionStats.sessionContact;

    // Print results
    console.log('\nResults:');
    console.log(`  Tasks migrated: ${taskStats.migrated}`);
    console.log(`    - Task→Company: ${taskStats.taskCompany}`);
    console.log(`    - Task→Contact: ${taskStats.taskContact}`);

    console.log(`  Notes migrated: ${noteStats.migrated}`);
    console.log(`    - Note→Company: ${noteStats.noteCompany}`);
    console.log(`    - Note→Contact: ${noteStats.noteContact}`);

    console.log(`  Sessions migrated: ${sessionStats.migrated}`);
    console.log(`    - Session→Company: ${sessionStats.sessionCompany}`);
    console.log(`    - Session→Contact: ${sessionStats.sessionContact}\n`);

    console.log(`Total relationships created: ${totalRelationships}`);

    if (errors.length > 0) {
      console.log(`\nErrors encountered: ${errors.length}`);
      const errorRate = (errors.length / (tasksToMigrate.length + notesToMigrate.length + sessionsToMigrate.length)) * 100;

      // Show first 10 errors
      console.log('\nFirst 10 errors:');
      errors.slice(0, 10).forEach(err => {
        console.log(`  - ${err.entity}: ${err.error}`);
      });

      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors`);
      }

      // Abort if >10% fail
      if (errorRate > 10) {
        console.log(`\n❌ Error rate too high (${errorRate.toFixed(1)}% > 10% threshold)`);
        console.log('Migration aborted. Please fix errors and retry.\n');

        return {
          success: false,
          tasksProcessed: 0,
          notesProcessed: 0,
          sessionsProcessed: 0,
          relationshipsCreated: 0,
          errors,
          duration: Date.now() - startTime,
        };
      }
    }

    // Save if not dry run
    if (!options.dryRun) {
      console.log('\nSaving migrated data...');
      if (tasks.length > 0) await saveData('tasks.json', tasks);
      if (notes.length > 0) await saveData('notes.json', notes);
      if (sessions.length > 0) await saveData('sessions.json', sessions);
      console.log('✅ Migration complete!\n');
      console.log(`Backups stored in: ${backupDir}\n`);
    } else {
      console.log('\n✅ Dry run complete (no changes made)');
      console.log('Run without --dry-run to apply changes\n');
    }

    return {
      success: true,
      tasksProcessed: taskStats.migrated,
      notesProcessed: noteStats.migrated,
      sessionsProcessed: sessionStats.migrated,
      relationshipsCreated: totalRelationships,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    return {
      success: false,
      tasksProcessed: 0,
      notesProcessed: 0,
      sessionsProcessed: 0,
      relationshipsCreated: 0,
      errors: [{ entity: 'Migration', error: error.message }],
      duration: Date.now() - startTime,
    };
  }
}

// Run migration
(async () => {
  const result = await migrateCompaniesContactsToRelationships({
    dryRun: isDryRun,
    verbose: isVerbose,
    onProgress: (progress) => {
      if (!isVerbose) {
        process.stdout.write(`\r  ${progress.phase}: ${progress.current}/${progress.total} (${progress.percentage}%)`);
      }
    },
  });

  if (!isVerbose && !isDryRun && result.success) {
    process.stdout.write('\n'); // New line after progress
  }

  if (!result.success) {
    process.exit(1);
  }

  // Print summary
  const durationSec = (result.duration / 1000).toFixed(2);
  console.log(`Duration: ${durationSec}s\n`);
})();
