/**
 * Audio Schema Migration Script
 *
 * Migrates existing sessions to the new audio architecture:
 *
 * OLD SCHEMA:
 * - audioMode: 'off' | 'transcription' | 'description'
 * - User chose mode during recording
 *
 * NEW SCHEMA:
 * - audioRecording: boolean (simple on/off toggle)
 * - audioReviewCompleted: boolean (tracks if GPT-4o review has been done)
 * - Always uses Whisper-1 during recording
 * - One-time GPT-4o-audio-preview review when user opens summary
 *
 * This script:
 * 1. Loads all sessions from storage
 * 2. Derives audioRecording from legacy audioMode
 * 3. Initializes audioReviewCompleted = false
 * 4. Saves updated sessions
 * 5. Reports migration statistics
 */

import { getStorage } from '../src/services/storage';
import type { Session } from '../src/types';

interface MigrationStats {
  totalSessions: number;
  sessionsWithAudio: number;
  audioOffSessions: number;
  transcriptionSessions: number;
  descriptionSessions: number;
  alreadyMigrated: number;
  errors: Array<{ sessionId: string; error: string }>;
}

interface LegacySession extends Omit<Session, 'audioMode'> {
  audioMode?: 'off' | 'transcription' | 'description';
}

/**
 * Main migration function
 */
async function migrateAudioSchema(): Promise<MigrationStats> {
  console.log('🔄 Starting audio schema migration...\n');

  const stats: MigrationStats = {
    totalSessions: 0,
    sessionsWithAudio: 0,
    audioOffSessions: 0,
    transcriptionSessions: 0,
    descriptionSessions: 0,
    alreadyMigrated: 0,
    errors: [],
  };

  try {
    // Load storage
    const storage = await getStorage();
    console.log('✅ Storage initialized');

    // Load all sessions
    const sessions = await storage.load<LegacySession[]>('sessions');

    if (!sessions || !Array.isArray(sessions)) {
      console.log('ℹ️  No sessions found in storage. Nothing to migrate.');
      return stats;
    }

    stats.totalSessions = sessions.length;
    console.log(`📊 Found ${sessions.length} sessions to migrate\n`);

    // Migrate each session
    const migratedSessions = sessions.map((session, index) => {
      try {
        return migrateSession(session, stats);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stats.errors.push({
          sessionId: session.id,
          error: errorMessage,
        });
        console.error(`❌ Failed to migrate session ${session.id}:`, errorMessage);
        return session; // Return original session on error
      }
    });

    // Save migrated sessions
    await storage.save('sessions', migratedSessions);
    console.log('\n✅ Migrated sessions saved to storage');

    // Print summary
    printMigrationSummary(stats);

    return stats;

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Migrate a single session
 */
function migrateSession(session: LegacySession, stats: MigrationStats): Session {
  const migrated = { ...session } as Session;

  // Check if already migrated
  if (typeof session.audioRecording === 'boolean' &&
      typeof session.audioReviewCompleted === 'boolean' &&
      !session.audioMode) {
    stats.alreadyMigrated++;
    console.log(`⏭️  Session ${session.id} already migrated`);
    return migrated;
  }

  // Derive audioRecording from legacy audioMode
  const legacyMode = session.audioMode || 'off';

  switch (legacyMode) {
    case 'off':
      migrated.audioRecording = false;
      stats.audioOffSessions++;
      break;
    case 'transcription':
      migrated.audioRecording = true;
      stats.transcriptionSessions++;
      stats.sessionsWithAudio++;
      break;
    case 'description':
      migrated.audioRecording = true;
      stats.descriptionSessions++;
      stats.sessionsWithAudio++;
      break;
    default:
      // Fallback for unexpected values
      migrated.audioRecording = false;
      console.warn(`⚠️  Unexpected audioMode '${legacyMode}' for session ${session.id}, defaulting to false`);
  }

  // Initialize audioReviewCompleted
  // Only mark as reviewable if:
  // 1. Session has audio recording enabled
  // 2. Session has audio segments
  // 3. Session is completed
  const hasAudioSegments = session.audioSegments && session.audioSegments.length > 0;
  const isCompleted = session.status === 'completed';

  if (migrated.audioRecording && hasAudioSegments && isCompleted) {
    // Session has audio and is ready for review
    migrated.audioReviewCompleted = false;
  } else {
    // Session doesn't have audio or isn't completed - mark as completed to avoid review flow
    migrated.audioReviewCompleted = true;
  }

  // Remove deprecated audioMode field
  delete (migrated as any).audioMode;

  const mode = legacyMode === 'off' ? '❌' : legacyMode === 'transcription' ? '📝' : '🎙️';
  const recording = migrated.audioRecording ? '✅' : '❌';
  const reviewable = !migrated.audioReviewCompleted && hasAudioSegments ? '🔍' : '➖';

  console.log(
    `${mode} ${session.name.slice(0, 30).padEnd(30)} | ` +
    `audioMode: ${legacyMode.padEnd(13)} → ` +
    `audioRecording: ${recording} | ` +
    `reviewable: ${reviewable}`
  );

  return migrated;
}

/**
 * Print migration summary
 */
function printMigrationSummary(stats: MigrationStats): void {
  console.log('\n' + '='.repeat(60));
  console.log('📋 MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total sessions:           ${stats.totalSessions}`);
  console.log(`Already migrated:         ${stats.alreadyMigrated}`);
  console.log(`Newly migrated:           ${stats.totalSessions - stats.alreadyMigrated}`);
  console.log();
  console.log('Audio Mode Distribution (legacy):');
  console.log(`  • Audio OFF:            ${stats.audioOffSessions}`);
  console.log(`  • Transcription mode:   ${stats.transcriptionSessions}`);
  console.log(`  • Description mode:     ${stats.descriptionSessions}`);
  console.log();
  console.log('New Schema:');
  console.log(`  • Sessions with audio:  ${stats.sessionsWithAudio}`);
  console.log(`  • Sessions without:     ${stats.audioOffSessions}`);
  console.log();

  if (stats.errors.length > 0) {
    console.log('❌ Errors encountered:');
    stats.errors.forEach(({ sessionId, error }) => {
      console.log(`  • Session ${sessionId}: ${error}`);
    });
    console.log();
  } else {
    console.log('✅ No errors encountered');
    console.log();
  }

  console.log('='.repeat(60));
  console.log();
  console.log('Migration complete! 🎉');
  console.log();
  console.log('What changed:');
  console.log('  • audioMode (string) → audioRecording (boolean)');
  console.log('  • audioReviewCompleted (boolean) initialized for all sessions');
  console.log('  • Sessions with audio segments are now reviewable');
  console.log();
  console.log('Next steps:');
  console.log('  1. Test the app to ensure sessions load correctly');
  console.log('  2. Open a completed session with audio to test review flow');
  console.log('  3. Verify audio playback still works for old sessions');
  console.log('='.repeat(60));
}

/**
 * Run migration
 */
if (typeof window !== 'undefined') {
  // Browser environment - expose to window for manual execution
  (window as any).migrateAudioSchema = migrateAudioSchema;
  console.log('Migration script loaded. Run: migrateAudioSchema()');
} else {
  // Node environment - run directly
  migrateAudioSchema()
    .then(stats => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateAudioSchema, type MigrationStats };
