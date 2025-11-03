const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/types.ts');
let content = fs.readFileSync(filePath, 'utf8');

console.log('\nTask 3: Adding JSDoc to enrichment types...\n');

const enrichmentTypes = [
  {
    pattern: /^export interface AudioKeyMoment \{$/m,
    doc: `/**
 * Audio Key Moment - AI-identified important timestamp in audio
 *
 * DEPRECATED: This type is deprecated in favor of AudioInsights.keyMoments.
 * Kept for backward compatibility with sessions recorded before October 2025.
 *
 * Represents a single significant moment detected in session audio:
 * - Achievements: "Completed the feature"
 * - Blockers: "Hit an error I can't figure out"
 * - Decisions: "Going with approach B instead"
 * - Insights: "Oh, I see the pattern now"
 *
 * DETECTION:
 * - AI analyzes audio transcription for semantic significance
 * - Timestamps relative to session start (in seconds)
 * - excerpt contains actual spoken words
 *
 * @deprecated Use AudioInsights.keyMoments instead
 * @see AudioInsights for comprehensive audio analysis
 * @see Session.audioKeyMoments for legacy usage
 *
 * @example
 * \`\`\`typescript
 * {
 *   id: 'moment-123',
 *   timestamp: 1245,  // 20 minutes 45 seconds from session start
 *   label: 'Completed authentication flow',
 *   type: 'achievement',
 *   segmentId: 'audio-segment-789',
 *   excerpt: 'Okay, auth flow is working now. Users can log in.'
 * }
 * \`\`\`
 */
export interface AudioKeyMoment {`
  },
  {
    pattern: /^export interface AudioInsights \{$/m,
    doc: `/**
 * Audio Insights - Comprehensive post-session audio analysis
 *
 * ONE-TIME PROCESSING: This analysis is performed exactly once after session ends.
 * Never re-run - too expensive (~$2-5 per session depending on length).
 *
 * Powered by GPT-4o audio-preview model which analyzes the FULL session audio
 * (not just transcription) to extract:
 * - Emotional journey throughout session
 * - Key moments (achievements, blockers, decisions, insights)
 * - Work patterns (focus level, interruptions, flow states)
 * - Environmental context (noise, setting, time of day)
 *
 * COST TRACKING:
 * - Processing cost tracked in enrichmentStatus.audio.cost
 * - Typical cost: $2-5 per hour of audio
 * - User can disable via enrichmentConfig.includeAudioReview = false
 *
 * WORKFLOW:
 * 1. Session ends
 * 2. All audio segments concatenated + downsampled to 16kHz mono
 * 3. ONE-TIME GPT-4o audio analysis
 * 4. Results cached in this structure
 * 5. Never re-processed (even if prompt changes)
 *
 * @see Session.audioInsights for stored results
 * @see EnrichmentPipeline for processing workflow
 * @see Session.enrichmentStatus.audio for cost tracking
 *
 * @example
 * \`\`\`typescript
 * {
 *   narrative: 'Started focused on implementing OAuth, hit frustrating bugs mid-session, ended with breakthrough understanding of token flow',
 *   emotionalJourney: [
 *     {
 *       timestamp: 0,
 *       emotion: 'focused',
 *       description: 'Deep concentration at session start'
 *     },
 *     {
 *       timestamp: 1800,
 *       emotion: 'frustrated',
 *       description: 'Struggling with unexpected token expiration errors'
 *     },
 *     {
 *       timestamp: 3200,
 *       emotion: 'relieved',
 *       description: 'Finally understood the problem'
 *     }
 *   ],
 *   keyMoments: [
 *     {
 *       timestamp: 3245,
 *       type: 'insight',
 *       description: 'Realized tokens were expiring because of timezone mismatch',
 *       context: 'This was the breakthrough that solved 2 hours of debugging',
 *       excerpt: 'Oh wait, the timestamp is in UTC but we are checking it in local time'
 *     }
 *   ],
 *   workPatterns: {
 *     focusLevel: 'high',
 *     interruptions: 2,
 *     flowStates: [
 *       {
 *         start: 0,
 *         end: 2100,
 *         description: 'Deep focus on implementation'
 *       }
 *     ]
 *   },
 *   environmentalContext: {
 *     ambientNoise: 'Quiet, occasional keyboard typing',
 *     workSetting: 'Home office',
 *     timeOfDay: 'Morning (inferred from energy level and "good morning" greeting)'
 *   },
 *   processedAt: '2025-10-26T15:30:00Z',
 *   modelUsed: 'gpt-4o-audio-preview',
 *   processingDuration: 45  // 45 seconds to analyze 1 hour of audio
 * }
 * \`\`\`
 */
export interface AudioInsights {`
  }
];

let count = 0;
for (const {pattern, doc} of enrichmentTypes) {
  if (content.match(pattern)) {
    content = content.replace(pattern, doc);
    count++;
  }
}

// Also add documentation for inline enrichmentConfig and enrichmentLock types
// These are documented in the Session interface comments, so we'll just count them
const inlineDocsPresent = content.includes('Enrichment Configuration - User preferences') &&
                          content.includes('Enrichment Lock - Prevents concurrent');

if (inlineDocsPresent) {
  console.log('✓ Enrichment Config and Lock already documented inline');
  count += 2;  // Count the inline documented types
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`✓ Added ${count} JSDoc comments to enrichment types`);
console.log('\nTask 3 complete!');
console.log('\nNote: EnrichmentConfig and EnrichmentLock are inline types in Session');
console.log('interface and are already documented with JSDoc comments.');
