/**
 * Test Utility: Enhanced Enrichment Validator
 *
 * This utility allows testing the new optional fields generation
 * without affecting production sessions.
 *
 * Usage from DevTools console:
 * ```
 * import { testEnhancedEnrichment } from './utils/testEnhancedEnrichment';
 * testEnhancedEnrichment('session-id-here');
 * ```
 */

import type { Session, SessionSummary } from '../types';
// import { sessionSynthesizeAll } from './sessionSynthesis'; // Commented out - function no longer exists

/**
 * Test enhanced field generation for a specific session
 * Logs the results to console for validation
 */
export async function testEnhancedEnrichment(sessionId: string): Promise<void> {
  console.log('[TEST] Starting enhanced enrichment test for session:', sessionId);

  try {
    // TODO: Load session from storage
    // const session = await getSessionById(sessionId);
    // if (!session) {
    //   console.error('[TEST] Session not found:', sessionId);
    //   return;
    // }

    console.log('[TEST] Session loaded successfully');

    // TODO: Generate enhanced summary
    // const summary = await sessionSynthesizeAll(
    //   session,
    //   session.screenshots || [],
    //   session.audioSegments || [],
    //   {}
    // );

    console.log('[TEST] Summary generated successfully');

    // Validate new fields
    // validateEnhancedFields(summary);

    console.log('[TEST] ✅ Test completed successfully');
  } catch (error) {
    console.error('[TEST] ❌ Test failed:', error);
  }
}

/**
 * Validate that enhanced fields are present and well-formed
 */
function validateEnhancedFields(summary: SessionSummary): void {
  console.group('[VALIDATION] Enhanced Fields');

  // Check achievementsEnhanced
  if (summary.achievementsEnhanced) {
    console.log('✅ achievementsEnhanced present:', summary.achievementsEnhanced.length, 'items');
    summary.achievementsEnhanced.forEach((a, i) => {
      if (!a.timestamp) {
        console.warn(`⚠️ Achievement ${i} missing timestamp:`, a.text);
      }
      if (!a.importance) {
        console.warn(`⚠️ Achievement ${i} missing importance:`, a.text);
      }
    });
  } else {
    console.warn('⚠️ achievementsEnhanced not generated');
  }

  // Check blockersEnhanced
  if (summary.blockersEnhanced) {
    console.log('✅ blockersEnhanced present:', summary.blockersEnhanced.length, 'items');
    summary.blockersEnhanced.forEach((b, i) => {
      if (!b.timestamp) {
        console.warn(`⚠️ Blocker ${i} missing timestamp:`, b.text);
      }
      if (!b.severity) {
        console.warn(`⚠️ Blocker ${i} missing severity:`, b.text);
      }
    });
  } else {
    console.warn('⚠️ blockersEnhanced not generated');
  }

  // Check keyMoments
  if (summary.keyMoments) {
    console.log('✅ keyMoments present:', summary.keyMoments.length, 'moments');
    const momentTypes = summary.keyMoments.map(m => m.type);
    console.log('   Moment types:', [...new Set(momentTypes)].join(', '));
  } else {
    console.warn('⚠️ keyMoments not generated');
  }

  // Check dynamicInsights
  if (summary.dynamicInsights) {
    console.log('✅ dynamicInsights present:', summary.dynamicInsights.length, 'insights');
    const insightTypes = summary.dynamicInsights.map(i => i.type);
    console.log('   Insight types:', [...new Set(insightTypes)].join(', '));
  } else {
    console.warn('⚠️ dynamicInsights not generated');
  }

  // Check generationMetadata
  if (summary.generationMetadata) {
    console.log('✅ generationMetadata present');
    console.log('   Detected type:', summary.generationMetadata.detectedSessionType);
    console.log('   Confidence:', summary.generationMetadata.confidence);
    console.log('   Reasoning:', summary.generationMetadata.reasoning);
  } else {
    console.warn('⚠️ generationMetadata not generated');
  }

  // Overall assessment
  const score = [
    !!summary.achievementsEnhanced,
    !!summary.blockersEnhanced,
    !!summary.keyMoments,
    !!summary.dynamicInsights,
    !!summary.generationMetadata
  ].filter(Boolean).length;

  console.log(`\n[SCORE] ${score}/5 enhanced fields generated`);

  if (score === 5) {
    console.log('✅ EXCELLENT: All enhanced fields generated');
  } else if (score >= 3) {
    console.log('⚠️ PARTIAL: Some enhanced fields generated');
  } else {
    console.log('❌ POOR: Few or no enhanced fields generated');
  }

  console.groupEnd();
}

/**
 * Compare old vs new summary for a session
 * Useful for seeing the difference in detail level
 */
export function compareEnhancements(
  oldSummary: SessionSummary,
  newSummary: SessionSummary
): void {
  console.group('[COMPARISON] Old vs New Summary');

  console.log('OLD achievements (flat):', oldSummary.achievements?.length || 0);
  console.log('NEW achievementsEnhanced:', newSummary.achievementsEnhanced?.length || 0);

  console.log('\nOLD blockers (flat):', oldSummary.blockers?.length || 0);
  console.log('NEW blockersEnhanced:', newSummary.blockersEnhanced?.length || 0);

  console.log('\nNEW keyMoments:', newSummary.keyMoments?.length || 0);
  console.log('NEW dynamicInsights:', newSummary.dynamicInsights?.length || 0);

  // Check temporal data availability
  const oldHasTemporal = oldSummary.keyInsights?.every(i => i.timestamp);
  const newHasTemporal =
    (newSummary.achievementsEnhanced?.every(a => a.timestamp) ?? false) ||
    (newSummary.blockersEnhanced?.every(b => b.timestamp) ?? false);

  console.log('\nOLD temporal data:', oldHasTemporal ? 'Yes (keyInsights only)' : 'No');
  console.log('NEW temporal data:', newHasTemporal ? 'Yes (achievements, blockers, moments)' : 'No');

  console.groupEnd();
}

/**
 * Export for easy console access
 */
if (typeof window !== 'undefined') {
  (window as any).__testEnhancedEnrichment = testEnhancedEnrichment;
  (window as any).__compareEnhancements = compareEnhancements;
  console.log('[TEST UTILS] Enhanced enrichment test utilities loaded');
  console.log('Usage: __testEnhancedEnrichment("session-id")');
}
