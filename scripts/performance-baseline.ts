#!/usr/bin/env tsx
/**
 * Performance Baseline Script
 *
 * Runs performance tests and generates a baseline report.
 * This script should be run at the end of each phase to track
 * performance improvements over time.
 *
 * Usage:
 *   npx tsx scripts/performance-baseline.ts
 */

import { writeFile } from 'fs/promises';
import { perfMonitor } from '../src/utils/performance';
import { getStorage, resetStorage } from '../src/services/storage';
import type { Session } from '../src/types';

// ============================================================================
// Test Data Generators
// ============================================================================

function createMockSession(overrides?: Partial<Session>): Session {
  const now = new Date().toISOString();
  return {
    id: `session-${Date.now()}-${Math.random()}`,
    name: 'Test Session',
    description: 'A test session for performance testing',
    startTime: now,
    status: 'completed',
    category: 'Development',
    subCategory: 'Testing',
    totalDuration: 3600000,
    screenshots: [],
    audioSegments: [],
    tags: ['test', 'performance'],
    ...overrides,
  };
}

function createMockSessions(count: number): Session[] {
  return Array.from({ length: count }, (_, i) =>
    createMockSession({
      name: `Test Session ${i + 1}`,
      startTime: new Date(Date.now() - i * 3600000).toISOString(),
    })
  );
}

// ============================================================================
// Test Scenarios
// ============================================================================

async function testSessionLoad() {
  console.log('\n📊 Testing session load performance...\n');

  const storage = await getStorage();

  // Test 1: Empty load
  perfMonitor.clearMetric('baseline-empty-load');
  for (let i = 0; i < 5; i++) {
    const end = perfMonitor.start('baseline-empty-load');
    await storage.load<Session[]>('sessions');
    end();
  }

  // Test 2: Load with 10 sessions
  const sessions10 = createMockSessions(10);
  await storage.save('sessions', sessions10);

  perfMonitor.clearMetric('baseline-load-10');
  for (let i = 0; i < 5; i++) {
    const end = perfMonitor.start('baseline-load-10');
    await storage.load<Session[]>('sessions');
    end();
  }

  // Test 3: Load with 100 sessions
  const sessions100 = createMockSessions(100);
  await storage.save('sessions', sessions100);

  perfMonitor.clearMetric('baseline-load-100');
  for (let i = 0; i < 5; i++) {
    const end = perfMonitor.start('baseline-load-100');
    await storage.load<Session[]>('sessions');
    end();
  }

  console.log('✅ Session load tests complete');
}

async function testStorageOperations() {
  console.log('\n💾 Testing storage operations...\n');

  const storage = await getStorage();

  // Test 1: Single save
  perfMonitor.clearMetric('baseline-save-single');
  for (let i = 0; i < 10; i++) {
    const session = createMockSession();
    const end = perfMonitor.start('baseline-save-single');
    await storage.save('test-session', session);
    end();
  }

  // Test 2: Batch save (10 sessions)
  perfMonitor.clearMetric('baseline-save-10');
  for (let i = 0; i < 5; i++) {
    const sessions = createMockSessions(10);
    const end = perfMonitor.start('baseline-save-10');
    await storage.save('test-sessions', sessions);
    end();
  }

  // Test 3: Batch save (100 sessions)
  perfMonitor.clearMetric('baseline-save-100');
  for (let i = 0; i < 3; i++) {
    const sessions = createMockSessions(100);
    const end = perfMonitor.start('baseline-save-100');
    await storage.save('test-sessions', sessions);
    end();
  }

  console.log('✅ Storage operation tests complete');
}

async function testFilteringAndSorting() {
  console.log('\n🔍 Testing filtering and sorting...\n');

  const sessions = createMockSessions(100);

  // Test 1: Filter by search query
  perfMonitor.clearMetric('baseline-filter-search');
  for (let i = 0; i < 100; i++) {
    const query = 'session 5';
    const end = perfMonitor.start('baseline-filter-search');
    sessions.filter(s =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.description?.toLowerCase().includes(query.toLowerCase())
    );
    end();
  }

  // Test 2: Sort by date
  perfMonitor.clearMetric('baseline-sort-date');
  for (let i = 0; i < 100; i++) {
    const end = perfMonitor.start('baseline-sort-date');
    [...sessions].sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    end();
  }

  // Test 3: Filter + Sort
  perfMonitor.clearMetric('baseline-filter-sort');
  for (let i = 0; i < 100; i++) {
    const end = perfMonitor.start('baseline-filter-sort');
    const filtered = sessions.filter(s => s.category === 'Development');
    [...filtered].sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    end();
  }

  console.log('✅ Filtering and sorting tests complete');
}

async function testStateUpdates() {
  console.log('\n🔄 Testing state update performance...\n');

  const storage = await getStorage();
  const sessions = createMockSessions(10);
  await storage.save('sessions', sessions);

  // Simulate 50 rapid state updates
  perfMonitor.clearMetric('baseline-state-update');
  const totalEnd = perfMonitor.start('baseline-state-updates-total');

  for (let i = 0; i < 50; i++) {
    const end = perfMonitor.start('baseline-state-update');

    // Read, modify, write
    const current = await storage.load<Session[]>('sessions') || [];
    current[0] = {
      ...current[0],
      description: `Updated ${i}`,
    };
    await storage.save('sessions', current);

    end();
  }

  totalEnd();

  console.log('✅ State update tests complete');
}

// ============================================================================
// Report Generation
// ============================================================================

interface BaselineReport {
  timestamp: string;
  phase: string;
  environment: {
    nodeVersion: string;
    platform: string;
  };
  metrics: Record<string, {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } | null>;
  targets: Record<string, {
    target: number;
    unit: string;
    met?: boolean;
    actual?: number;
  }>;
  summary: {
    totalTests: number;
    targetsMet: number;
    targetsTotal: number;
  };
}

function generateReport(): BaselineReport {
  const metrics = perfMonitor.export();

  const targets = {
    'baseline-empty-load': { target: 100, unit: 'ms' },
    'baseline-load-10': { target: 200, unit: 'ms' },
    'baseline-load-100': { target: 1000, unit: 'ms' },
    'baseline-save-single': { target: 50, unit: 'ms' },
    'baseline-save-10': { target: 100, unit: 'ms' },
    'baseline-save-100': { target: 500, unit: 'ms' },
    'baseline-filter-search': { target: 10, unit: 'ms' },
    'baseline-sort-date': { target: 10, unit: 'ms' },
    'baseline-filter-sort': { target: 20, unit: 'ms' },
    'baseline-state-update': { target: 50, unit: 'ms' },
  };

  // Check which targets were met
  let targetsMet = 0;
  const enrichedTargets: BaselineReport['targets'] = {};

  for (const [label, target] of Object.entries(targets)) {
    const stats = metrics[label];
    const actual = stats?.p95 || 0;
    const met = actual <= target.target;

    if (met) targetsMet++;

    enrichedTargets[label] = {
      ...target,
      met,
      actual,
    };
  }

  return {
    timestamp: new Date().toISOString(),
    phase: 'Phase 1 Baseline',
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
    },
    metrics,
    targets: enrichedTargets,
    summary: {
      totalTests: Object.keys(metrics).length,
      targetsMet,
      targetsTotal: Object.keys(targets).length,
    },
  };
}

async function saveReport(report: BaselineReport) {
  const jsonPath = 'docs/sessions-rewrite/PERFORMANCE_BASELINE.json';
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Baseline report saved to ${jsonPath}`);
}

function printReport(report: BaselineReport) {
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE BASELINE REPORT');
  console.log('='.repeat(80));

  console.log(`\nDate: ${new Date(report.timestamp).toLocaleString()}`);
  console.log(`Phase: ${report.phase}`);
  console.log(`Environment: ${report.environment.platform} (Node ${report.environment.nodeVersion})`);

  console.log('\n' + '-'.repeat(80));
  console.log('RESULTS');
  console.log('-'.repeat(80));

  for (const [label, target] of Object.entries(report.targets)) {
    const status = target.met ? '✅' : '❌';
    const actual = target.actual?.toFixed(2) || 'N/A';
    console.log(`${status} ${label}`);
    console.log(`   Target: ${target.target}${target.unit} | Actual (p95): ${actual}${target.unit}`);
  }

  console.log('\n' + '-'.repeat(80));
  console.log('SUMMARY');
  console.log('-'.repeat(80));

  const successRate = ((report.summary.targetsMet / report.summary.targetsTotal) * 100).toFixed(0);
  console.log(`Tests Run: ${report.summary.totalTests}`);
  console.log(`Targets Met: ${report.summary.targetsMet}/${report.summary.targetsTotal} (${successRate}%)`);

  console.log('\n' + '='.repeat(80));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🚀 Starting performance baseline tests...\n');

  try {
    // Clear any existing metrics
    perfMonitor.clear();

    // Run test scenarios
    await testSessionLoad();
    await testStorageOperations();
    await testFilteringAndSorting();
    await testStateUpdates();

    // Generate and save report
    const report = generateReport();
    await saveReport(report);
    printReport(report);

    // Exit with appropriate code
    const allTargetsMet = report.summary.targetsMet === report.summary.targetsTotal;
    process.exit(allTargetsMet ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Error running baseline tests:', error);
    process.exit(1);
  } finally {
    // Cleanup
    resetStorage();
  }
}

main();
