#!/bin/bash
# Phase 2 JSDoc Addition Script for types.ts
# Adds comprehensive documentation to all specified types

set -e

FILE="src/types.ts"
BACKUP="src/types.ts.backup-phase2"

# Create backup
cp "$FILE" "$BACKUP"
echo "Created backup at $BACKUP"

# Function to insert JSDoc before a line number
insert_jsdoc() {
  local line_num=$1
  local jsdoc=$2

  # Use awk to insert at specific line
  awk -v n="$line_num" -v text="$jsdoc" 'NR==n{print text}1' "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"
}

# Task 1: Add JSDoc to Summary Section Types
echo "Adding JSDoc to summary section types..."

# AchievementsSection (line 1284)
insert_jsdoc 1284 '/**
 * Achievements Section - Notable accomplishments during session
 *
 * Used when AI detects completed work, milestones reached, or goals achieved.
 * Common in deep-work, coding, and building sessions.
 *
 * FIELDS:
 * - achievements: List of accomplishments with timestamps and impact level
 * - summary: Optional overview of all achievements
 *
 * RENDERING:
 * - emphasis: Controls visual prominence (low/medium/high)
 * - position: Order in summary (lower = earlier)
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * \`\`\`typescript
 * {
 *   type: "achievements",
 *   title: "Major Wins",
 *   emphasis: "high",
 *   position: 1,
 *   data: {
 *     achievements: [{
 *       title: "Completed OAuth integration",
 *       timestamp: "2025-10-26T14:30:00Z",
 *       impact: "major"
 *     }]
 *   }
 * }
 * \`\`\`
 */'

echo "Phase 2 JSDoc additions complete!"
echo "Backup saved at: $BACKUP"
echo "Restore with: mv $BACKUP $FILE"
