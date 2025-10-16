/**
 * Utility to clean HTML tags from existing notes in the database
 *
 * This script finds all notes that contain HTML tags and strips them,
 * preserving the text content but removing the HTML formatting.
 *
 * Run this from the browser console:
 * import { cleanAllNotesHtml } from './utils/cleanNotesHtml';
 * await cleanAllNotesHtml();
 */

import { stripHtmlTags } from './helpers';
import { getStorage } from '../services/storage';
import type { Note } from '../types';

/**
 * Check if a string contains HTML tags
 */
function containsHtmlTags(text: string): boolean {
  if (!text) return false;

  // Check for common HTML tags
  const htmlTagPattern = /<[^>]+>/;
  return htmlTagPattern.test(text);
}

/**
 * Clean HTML from all notes in the database
 * Returns the number of notes that were cleaned
 */
export async function cleanAllNotesHtml(): Promise<{
  totalNotes: number;
  cleanedNotes: number;
  cleanedNoteIds: string[];
}> {
  const storage = await getStorage();
  const notes = await storage.load<Note[]>('notes') || [];

  const cleanedNoteIds: string[] = [];
  let cleanedCount = 0;

  console.log(`🔍 Scanning ${notes.length} notes for HTML tags...`);

  // Find and clean notes with HTML tags
  const updatedNotes = notes.map(note => {
    if (containsHtmlTags(note.content)) {
      console.log(`🧹 Found HTML in note ${note.id}:`, note.content.substring(0, 100));

      const cleanedContent = stripHtmlTags(note.content);
      cleanedNoteIds.push(note.id);
      cleanedCount++;

      console.log(`✨ Cleaned to:`, cleanedContent.substring(0, 100));

      return {
        ...note,
        content: cleanedContent,
        summary: cleanedContent.substring(0, 100) + (cleanedContent.length > 100 ? '...' : ''),
        lastUpdated: new Date().toISOString(),
      };
    }
    return note;
  });

  // Save updated notes back to storage
  if (cleanedCount > 0) {
    await storage.save('notes', updatedNotes);
    console.log(`✅ Cleaned ${cleanedCount} notes with HTML tags`);
  } else {
    console.log(`✅ No notes with HTML tags found`);
  }

  return {
    totalNotes: notes.length,
    cleanedNotes: cleanedCount,
    cleanedNoteIds,
  };
}

/**
 * Preview notes that would be cleaned (dry run)
 */
export async function previewNotesWithHtml(): Promise<Array<{
  id: string;
  summary: string;
  originalContent: string;
  cleanedContent: string;
}>> {
  const storage = await getStorage();
  const notes = await storage.load<Note[]>('notes') || [];

  const notesWithHtml = notes
    .filter(note => containsHtmlTags(note.content))
    .map(note => ({
      id: note.id,
      summary: note.summary,
      originalContent: note.content,
      cleanedContent: stripHtmlTags(note.content),
    }));

  console.log(`Found ${notesWithHtml.length} notes with HTML tags:`);
  notesWithHtml.forEach(note => {
    console.log(`\n📝 Note ${note.id}:`);
    console.log(`  Original: ${note.originalContent.substring(0, 150)}`);
    console.log(`  Cleaned:  ${note.cleanedContent.substring(0, 150)}`);
  });

  return notesWithHtml;
}
