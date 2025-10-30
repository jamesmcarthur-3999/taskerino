import type { Session, SessionScreenshot } from '../types';

export interface ActivityBlock {
  id: string;
  activity: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  screenshotIds: string[];
  color: string;
}

// Activity category mappings for better grouping
export const ACTIVITY_CATEGORIES: Record<string, { name: string; color: string; keywords: string[] }> = {
  'Development': {
    name: 'Development',
    color: '#8B5CF6', // Purple
    keywords: ['coding', 'code', 'development', 'programming', 'developing', 'debugging', 'refactoring', 'implementing', 'building', 'writing code', 'software']
  },
  'Code Review': {
    name: 'Code Review',
    color: '#A78BFA', // Light Purple
    keywords: ['review', 'reviewing', 'pull request', 'pr review', 'code review', 'checking code']
  },
  'Communication': {
    name: 'Communication',
    color: '#3B82F6', // Blue
    keywords: ['email', 'slack', 'messaging', 'chat', 'communication', 'responding', 'replying', 'messages', 'inbox']
  },
  'Meetings': {
    name: 'Meetings',
    color: '#F59E0B', // Amber
    keywords: ['meeting', 'video call', 'zoom', 'conference', 'call', 'standup', 'sync', 'discussion']
  },
  'Documentation': {
    name: 'Documentation',
    color: '#10B981', // Green
    keywords: ['documentation', 'writing', 'docs', 'documenting', 'readme', 'wiki', 'notes', 'comments']
  },
  'Design': {
    name: 'Design',
    color: '#EC4899', // Pink
    keywords: ['design', 'designing', 'figma', 'sketch', 'ui', 'ux', 'mockup', 'prototype', 'wireframe']
  },
  'Research': {
    name: 'Research',
    color: '#06B6D4', // Cyan
    keywords: ['research', 'browsing', 'reading', 'learning', 'investigating', 'exploring', 'searching', 'studying', 'stackoverflow', 'documentation lookup']
  },
  'Testing': {
    name: 'Testing',
    color: '#14B8A6', // Teal
    keywords: ['testing', 'test', 'qa', 'debugging', 'bug', 'fix', 'troubleshooting', '验证']
  },
  'Planning': {
    name: 'Planning',
    color: '#6366F1', // Indigo
    keywords: ['planning', 'planning', 'organizing', 'task management', 'project management', 'roadmap', 'sprint']
  },
  'Admin': {
    name: 'Admin',
    color: '#6B7280', // Gray
    keywords: ['administrative', 'admin', 'filing', 'organizing', 'setup', 'configuration', 'settings']
  },
};

export const ACTIVITY_COLORS: Record<string, string> = {
  'Email': '#3B82F6',
  'Email management': '#3B82F6',
  'Coding': '#8B5CF6',
  'Code review': '#8B5CF6',
  'Development': '#8B5CF6',
  'Documentation': '#10B981',
  'Writing': '#10B981',
  'Meeting': '#F59E0B',
  'Video call': '#F59E0B',
  'Design': '#EC4899',
  'Research': '#06B6D4',
  'Browsing': '#06B6D4',
  'Planning': '#8B5CF6',
  'Testing': '#14B8A6',
  'Other': '#6B7280',
};

/**
 * Normalize activity name using intelligent keyword matching
 * This reduces fragmentation by grouping similar activities together
 */
export function normalizeActivity(rawActivity: string): { name: string; color: string } {
  // Handle empty, null, or "unknown" activities
  if (!rawActivity || rawActivity.trim() === '' || rawActivity.toLowerCase().includes('unknown')) {
    return { name: 'Other Work', color: '#6B7280' };
  }

  const lowerActivity = rawActivity.toLowerCase().trim();

  // Search through categories for keyword matches
  for (const category of Object.values(ACTIVITY_CATEGORIES)) {
    // Check if any keyword is found in the activity description
    const hasMatch = category.keywords.some(keyword =>
      lowerActivity.includes(keyword.toLowerCase())
    );

    if (hasMatch) {
      return { name: category.name, color: category.color };
    }
  }

  // If no category match found, keep original name but with default color
  // Capitalize first letter for consistency
  const capitalizedName = rawActivity.charAt(0).toUpperCase() + rawActivity.slice(1);
  return { name: capitalizedName, color: '#6B7280' };
}

/**
 * Group consecutive screenshots with the same activity into blocks
 * Now uses intelligent normalization to reduce fragmentation
 */
export function groupActivitiesIntoBlocks(
  screenshots: SessionScreenshot[],
  session: Session
): ActivityBlock[] {
  if (screenshots.length === 0) return [];

  const blocks: ActivityBlock[] = [];
  let currentBlock: ActivityBlock | null = null;

  screenshots.forEach((screenshot, index) => {
    const rawActivity = screenshot.aiAnalysis?.detectedActivity || '';

    // Normalize the activity to reduce fragmentation
    const { name: activity, color } = normalizeActivity(rawActivity);

    // Calculate duration for this screenshot (interval or time to next screenshot)
    let duration: number;
    if (index < screenshots.length - 1) {
      // Time to next screenshot
      const calculatedDuration = Math.floor(
        (new Date(screenshots[index + 1].timestamp).getTime() -
         new Date(screenshot.timestamp).getTime()) / 60000
      );
      // Ensure duration is positive and reasonable (max 24 hours)
      duration = Math.max(1, Math.min(calculatedDuration, 1440));
    } else {
      // Last screenshot - use session interval or default to 2 minutes
      duration = session.screenshotInterval || 2;
    }

    // If same normalized activity as current block, extend it
    if (currentBlock && currentBlock.activity === activity) {
      currentBlock.endTime = screenshot.timestamp;
      currentBlock.duration += duration;
      currentBlock.screenshotIds.push(screenshot.id);
    } else {
      // Start new block with normalized activity
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        id: `block-${blocks.length}`,
        activity,
        startTime: screenshot.timestamp,
        endTime: screenshot.timestamp,
        duration,
        screenshotIds: [screenshot.id],
        color,
      };
    }
  });

  // Push final block
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

/**
 * Calculate activity summary statistics
 */
export function calculateActivityStats(blocks: ActivityBlock[]): {
  totalDuration: number;
  activities: Array<{
    name: string;
    duration: number;
    percentage: number;
    color: string;
  }>;
} {
  const totalDuration = blocks.reduce((sum, block) => sum + block.duration, 0);

  // Group by activity name
  const activityMap = new Map<string, { duration: number; color: string }>();

  blocks.forEach(block => {
    const existing = activityMap.get(block.activity);
    if (existing) {
      existing.duration += block.duration;
    } else {
      activityMap.set(block.activity, {
        duration: block.duration,
        color: block.color,
      });
    }
  });

  // Convert to array and calculate percentages
  const activities = Array.from(activityMap.entries())
    .map(([name, data]) => ({
      name,
      duration: data.duration,
      percentage: totalDuration > 0 ? (data.duration / totalDuration) * 100 : 0,
      color: data.color,
    }))
    .sort((a, b) => b.duration - a.duration);

  return { totalDuration, activities };
}

/**
 * Format duration in a human-readable way
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Get time markers for timeline (hourly intervals)
 */
export function getTimeMarkers(session: Session): string[] {
  const startTime = new Date(session.startTime);
  const endTime = session.endTime ? new Date(session.endTime) : new Date();

  const markers: string[] = [];
  const current = new Date(startTime);

  // Round to next hour
  current.setMinutes(0, 0, 0);
  current.setHours(current.getHours() + 1);

  while (current <= endTime) {
    markers.push(current.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }));
    current.setHours(current.getHours() + 1);
  }

  return markers;
}
