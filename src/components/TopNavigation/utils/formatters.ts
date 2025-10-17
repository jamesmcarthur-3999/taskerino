/**
 * Formatting Utilities
 *
 * Helper functions for formatting time, dates, and other display values
 */

/**
 * Format elapsed time for session display
 */
export function formatElapsedTime(startTime: string): string {
  const start = new Date(startTime).getTime();
  const now = new Date().getTime();
  const diff = now - start;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format relative time for notifications
 */
export function formatRelativeTime(timestamp: string): string {
  const now = new Date().getTime();
  const then = new Date(timestamp).getTime();
  const diff = now - then;

  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}
