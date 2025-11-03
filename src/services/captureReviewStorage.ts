/**
 * Capture Review Storage Service
 *
 * Persists pending capture reviews so they can be resumed after app restart.
 * Reviews are stored with full AI context (conversation history, results, draft notes).
 *
 * Key operations:
 * - savePendingReview: Save completed processing job for later review
 * - loadPendingReviews: Load all pending reviews on app startup
 * - updateReviewStatus: Mark review as in-progress/completed/cancelled
 * - deletePendingReview: Remove review after save or cancel
 * - cleanupOldReviews: Auto-cleanup reviews older than 7 days
 */

import { getStorage } from './storage';
import type { PersistedReviewJob } from '../types/captureProcessing';

const STORAGE_KEY = 'capture-review-jobs';
const MAX_AGE_DAYS = 7;

/**
 * Save a pending review to storage
 * Called after AI processing completes and draft notes are created
 */
export async function savePendingReview(review: PersistedReviewJob): Promise<void> {
  try {
    const storage = await getStorage();
    const existing = await loadPendingReviews();

    // Update existing review or add new one (prevents duplicates)
    const existingIndex = existing.findIndex(r => r.id === review.id);
    const updated = existingIndex >= 0
      ? existing.map((r, i) => i === existingIndex ? review : r)
      : [...existing, review];

    await storage.save(STORAGE_KEY, updated);
    console.log(`[CaptureReviewStorage] ${existingIndex >= 0 ? 'Updated' : 'Saved'} pending review: ${review.id}`);
  } catch (error) {
    console.error('[CaptureReviewStorage] Failed to save pending review:', error);
    throw error;
  }
}

/**
 * Load all pending reviews from storage
 * Called on app startup to show "Resume Review" options
 */
export async function loadPendingReviews(): Promise<PersistedReviewJob[]> {
  try {
    const storage = await getStorage();
    const reviews = await storage.load<PersistedReviewJob[]>(STORAGE_KEY);

    if (!reviews) {
      return [];
    }

    // Filter out any invalid entries
    const validReviews = reviews.filter((r) =>
      r && r.id && r.result && r.draftNoteIds && r.status
    );

    // Sort by most recent first
    validReviews.sort((a, b) =>
      new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );

    return validReviews;
  } catch (error) {
    console.error('[CaptureReviewStorage] Failed to load pending reviews:', error);
    return [];
  }
}

/**
 * Update the status of a pending review
 * Used to mark review as in-progress when opened
 */
export async function updateReviewStatus(
  jobId: string,
  status: PersistedReviewJob['status']
): Promise<void> {
  try {
    const storage = await getStorage();
    const reviews = await loadPendingReviews();

    const updatedReviews = reviews.map((review) => {
      if (review.id === jobId) {
        return {
          ...review,
          status,
          lastModified: new Date().toISOString(),
        };
      }
      return review;
    });

    await storage.save(STORAGE_KEY, updatedReviews);
    console.log(`[CaptureReviewStorage] Updated review status: ${jobId} -> ${status}`);
  } catch (error) {
    console.error('[CaptureReviewStorage] Failed to update review status:', error);
    throw error;
  }
}

/**
 * Delete a pending review from storage
 * Called when user saves or cancels the review
 */
export async function deletePendingReview(jobId: string): Promise<void> {
  try {
    const storage = await getStorage();
    const reviews = await loadPendingReviews();

    const filteredReviews = reviews.filter((review) => review.id !== jobId);

    await storage.save(STORAGE_KEY, filteredReviews);
    console.log(`[CaptureReviewStorage] Deleted pending review: ${jobId}`);
  } catch (error) {
    console.error('[CaptureReviewStorage] Failed to delete pending review:', error);
    throw error;
  }
}

/**
 * Get a single pending review by ID
 */
export async function getPendingReview(jobId: string): Promise<PersistedReviewJob | null> {
  const reviews = await loadPendingReviews();
  return reviews.find((review) => review.id === jobId) || null;
}

/**
 * Get count of pending reviews
 * Useful for showing badge count in UI
 */
export async function getPendingReviewCount(): Promise<number> {
  const reviews = await loadPendingReviews();
  return reviews.filter((r) => r.status === 'pending_review').length;
}

/**
 * Cleanup reviews older than MAX_AGE_DAYS
 * Should be called on app startup or periodically
 */
export async function cleanupOldReviews(): Promise<number> {
  try {
    const storage = await getStorage();
    const reviews = await loadPendingReviews();

    const now = Date.now();
    const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    const { keep, remove } = reviews.reduce(
      (acc, review) => {
        const age = now - new Date(review.lastModified).getTime();
        if (age > maxAge) {
          acc.remove.push(review);
        } else {
          acc.keep.push(review);
        }
        return acc;
      },
      { keep: [] as PersistedReviewJob[], remove: [] as PersistedReviewJob[] }
    );

    if (remove.length > 0) {
      await storage.save(STORAGE_KEY, keep);
      console.log(`[CaptureReviewStorage] Cleaned up ${remove.length} old reviews`);
    }

    return remove.length;
  } catch (error) {
    console.error('[CaptureReviewStorage] Failed to cleanup old reviews:', error);
    return 0;
  }
}

/**
 * Clear all pending reviews
 * Used for manual cleanup or testing
 */
export async function clearAllPendingReviews(): Promise<void> {
  try {
    const storage = await getStorage();
    await storage.save(STORAGE_KEY, []);
    console.log('[CaptureReviewStorage] Cleared all pending reviews');
  } catch (error) {
    console.error('[CaptureReviewStorage] Failed to clear all reviews:', error);
    throw error;
  }
}

/**
 * Remove duplicate reviews (keeps the most recent version)
 * Called on app startup to clean up any duplicates from the bug
 */
export async function deduplicatePendingReviews(): Promise<number> {
  try {
    const storage = await getStorage();
    const reviews = await loadPendingReviews();

    // Group by ID and keep only the most recent
    const uniqueReviews = new Map<string, PersistedReviewJob>();
    for (const review of reviews) {
      const existing = uniqueReviews.get(review.id);
      if (!existing || new Date(review.lastModified) > new Date(existing.lastModified)) {
        uniqueReviews.set(review.id, review);
      }
    }

    const deduplicated = Array.from(uniqueReviews.values());
    const removedCount = reviews.length - deduplicated.length;

    if (removedCount > 0) {
      await storage.save(STORAGE_KEY, deduplicated);
      console.log(`[CaptureReviewStorage] Removed ${removedCount} duplicate reviews`);
    }

    return removedCount;
  } catch (error) {
    console.error('[CaptureReviewStorage] Failed to deduplicate reviews:', error);
    return 0;
  }
}
