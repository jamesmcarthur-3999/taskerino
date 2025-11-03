/**
 * Test Script for Session Query API
 *
 * Tests the Tauri session query commands to verify they work correctly.
 * This script should be run with the Tauri dev server running.
 *
 * Usage:
 *   node scripts/test-query-api.js
 *
 * Expected: All tests should pass with no errors
 */

const { invoke } = require('@tauri-apps/api/core');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(`ℹ ${message}`, 'cyan');
}

function section(message) {
  console.log();
  log(`━━━ ${message} ━━━`, 'yellow');
}

/**
 * Test query_active_session command
 */
async function testQueryActiveSession() {
  section('TEST: query_active_session');

  try {
    const session = await invoke('query_active_session');

    if (session === null) {
      info('No active session (expected if no session is running)');
      return true;
    }

    success('Active session found:');
    console.log(`  ID: ${session.id}`);
    console.log(`  Name: ${session.name || 'Untitled'}`);
    console.log(`  Status: ${session.status}`);
    console.log(`  Screenshots: ${session.screenshots?.length || 0}`);
    console.log(`  Audio segments: ${session.audioSegments?.length || 0}`);

    return true;
  } catch (err) {
    error(`Failed: ${err.message}`);
    return false;
  }
}

/**
 * Test query_sessions command with no filters
 */
async function testQuerySessionsNoFilters() {
  section('TEST: query_sessions (no filters)');

  try {
    const result = await invoke('query_sessions', {
      filters: {},
    });

    if (result.error) {
      error(`Query error: ${result.error}`);
      return false;
    }

    success(`Found ${result.total} sessions in ${result.elapsed_ms}ms`);

    if (result.sessions.length > 0) {
      info('Recent sessions:');
      result.sessions.slice(0, 5).forEach((session, i) => {
        console.log(
          `  ${i + 1}. ${session.name || 'Untitled'} (${session.status})`
        );
      });
    } else {
      info('No sessions found in database');
    }

    return true;
  } catch (err) {
    error(`Failed: ${err.message}`);
    return false;
  }
}

/**
 * Test query_sessions with filters
 */
async function testQuerySessionsWithFilters() {
  section('TEST: query_sessions (with filters)');

  try {
    // Test 1: Filter by status
    const completedSessions = await invoke('query_sessions', {
      filters: {
        status: 'completed',
        limit: 10,
      },
    });

    success(
      `Completed sessions: ${completedSessions.total} (${completedSessions.elapsed_ms}ms)`
    );

    // Test 2: Filter by keywords
    const keywordResults = await invoke('query_sessions', {
      filters: {
        keywords: ['test'],
        limit: 5,
      },
    });

    success(
      `Sessions matching 'test': ${keywordResults.total} (${keywordResults.elapsed_ms}ms)`
    );

    // Test 3: Filter by achievements
    const achievementResults = await invoke('query_sessions', {
      filters: {
        hasAchievements: true,
        limit: 5,
      },
    });

    success(
      `Sessions with achievements: ${achievementResults.total} (${achievementResults.elapsed_ms}ms)`
    );

    // Test 4: Filter by blockers
    const blockerResults = await invoke('query_sessions', {
      filters: {
        hasBlockers: true,
        limit: 5,
      },
    });

    success(
      `Sessions with blockers: ${blockerResults.total} (${blockerResults.elapsed_ms}ms)`
    );

    return true;
  } catch (err) {
    error(`Failed: ${err.message}`);
    return false;
  }
}

/**
 * Test get_session_by_id command
 */
async function testGetSessionById() {
  section('TEST: get_session_by_id');

  try {
    // First, get a session ID from query
    const result = await invoke('query_sessions', {
      filters: { limit: 1 },
    });

    if (result.sessions.length === 0) {
      info('No sessions available to test get_session_by_id');
      return true;
    }

    const sessionId = result.sessions[0].id;
    success(`Testing with session ID: ${sessionId}`);

    // Load full session detail
    const session = await invoke('get_session_by_id', {
      sessionId,
    });

    success('Session loaded successfully:');
    console.log(`  Name: ${session.name || 'Untitled'}`);
    console.log(`  Screenshots: ${session.screenshots?.length || 0}`);
    console.log(`  Audio segments: ${session.audioSegments?.length || 0}`);
    console.log(`  Tags: ${session.tags?.join(', ') || 'none'}`);

    return true;
  } catch (err) {
    error(`Failed: ${err.message}`);
    return false;
  }
}

/**
 * Test set_active_session_id command
 */
async function testSetActiveSessionId() {
  section('TEST: set_active_session_id');

  try {
    // Test setting active session
    await invoke('set_active_session_id', {
      sessionId: 'test-session-123',
    });
    success('Set active session ID: test-session-123');

    // Test clearing active session
    await invoke('set_active_session_id', {
      sessionId: null,
    });
    success('Cleared active session ID');

    return true;
  } catch (err) {
    error(`Failed: ${err.message}`);
    return false;
  }
}

/**
 * Test performance with large result set
 */
async function testPerformance() {
  section('TEST: Performance');

  try {
    const start = Date.now();

    const result = await invoke('query_sessions', {
      filters: { limit: 100 },
    });

    const clientElapsed = Date.now() - start;

    success(`Performance test:`);
    console.log(`  Server time: ${result.elapsed_ms}ms`);
    console.log(`  Client time: ${clientElapsed}ms`);
    console.log(`  Sessions returned: ${result.sessions.length}`);
    console.log(
      `  Throughput: ${(result.sessions.length / (clientElapsed / 1000)).toFixed(
        2
      )} sessions/sec`
    );

    return true;
  } catch (err) {
    error(`Failed: ${err.message}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  log('\n╔════════════════════════════════════════════╗', 'cyan');
  log('║   SESSION QUERY API - TEST SUITE          ║', 'cyan');
  log('╚════════════════════════════════════════════╝', 'cyan');

  const tests = [
    { name: 'query_active_session', fn: testQueryActiveSession },
    { name: 'query_sessions (no filters)', fn: testQuerySessionsNoFilters },
    { name: 'query_sessions (with filters)', fn: testQuerySessionsWithFilters },
    { name: 'get_session_by_id', fn: testGetSessionById },
    { name: 'set_active_session_id', fn: testSetActiveSessionId },
    { name: 'Performance', fn: testPerformance },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (err) {
      error(`Test '${test.name}' threw unexpected error: ${err.message}`);
      failed++;
    }
  }

  // Summary
  console.log();
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('SUMMARY', 'yellow');
  log(`  Passed: ${passed}/${tests.length}`, passed === tests.length ? 'green' : 'yellow');
  log(`  Failed: ${failed}/${tests.length}`, failed > 0 ? 'red' : 'dim');

  if (failed === 0) {
    log('\n✅ ALL TESTS PASSED', 'green');
  } else {
    log('\n❌ SOME TESTS FAILED', 'red');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((err) => {
  error(`Fatal error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
