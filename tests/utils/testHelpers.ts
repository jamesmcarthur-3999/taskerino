/**
 * Test Helper Utilities
 *
 * Provides common testing utilities for relationship tests:
 * - Event waiting utilities
 * - Assertion helpers
 * - Async helpers
 * - Transaction helpers
 */

import { expect } from 'vitest';
import type { EventBus } from '@/services/eventBus';
import type { Relationship } from '@/types/relationships';
import type { MockStorageAdapter } from '../mocks/mockStorage';

/**
 * Wait for an event to be emitted
 *
 * @param eventBus - EventBus instance
 * @param event - Event name to wait for
 * @param timeout - Timeout in milliseconds (default: 1000)
 * @returns Promise that resolves with the event data
 */
export async function waitForEvent(
  eventBus: EventBus,
  event: string,
  timeout = 1000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      eventBus.off(subscriptionId);
      reject(new Error(`Event "${event}" timeout after ${timeout}ms`));
    }, timeout);

    const subscriptionId = eventBus.on(event as any, (data) => {
      clearTimeout(timeoutId);
      eventBus.off(subscriptionId);
      resolve(data);
    });
  });
}

/**
 * Wait for multiple events to be emitted
 *
 * @param eventBus - EventBus instance
 * @param events - Array of event names to wait for
 * @param timeout - Timeout in milliseconds
 * @returns Promise that resolves with array of event data
 */
export async function waitForEvents(
  eventBus: EventBus,
  events: string[],
  timeout = 2000
): Promise<any[]> {
  const promises = events.map((event) => waitForEvent(eventBus, event, timeout));
  return Promise.all(promises);
}

/**
 * Assert that two relationships are equal (ignoring IDs)
 */
export function expectRelationshipEqual(
  actual: Relationship,
  expected: Partial<Relationship>
) {
  if (expected.type !== undefined) {
    expect(actual.type).toBe(expected.type);
  }
  if (expected.sourceType !== undefined) {
    expect(actual.sourceType).toBe(expected.sourceType);
  }
  if (expected.sourceId !== undefined) {
    expect(actual.sourceId).toBe(expected.sourceId);
  }
  if (expected.targetType !== undefined) {
    expect(actual.targetType).toBe(expected.targetType);
  }
  if (expected.targetId !== undefined) {
    expect(actual.targetId).toBe(expected.targetId);
  }
  if (expected.canonical !== undefined) {
    expect(actual.canonical).toBe(expected.canonical);
  }
  if (expected.metadata) {
    if (expected.metadata.source !== undefined) {
      expect(actual.metadata.source).toBe(expected.metadata.source);
    }
    if (expected.metadata.confidence !== undefined) {
      expect(actual.metadata.confidence).toBe(expected.metadata.confidence);
    }
    if (expected.metadata.reasoning !== undefined) {
      expect(actual.metadata.reasoning).toBe(expected.metadata.reasoning);
    }
  }
}

/**
 * Assert that a relationship exists in an array
 */
export function expectRelationshipInArray(
  relationships: Relationship[],
  expected: Partial<Relationship>
) {
  const found = relationships.find(
    (r) =>
      r.type === expected.type &&
      r.sourceId === expected.sourceId &&
      r.targetId === expected.targetId
  );

  expect(found).toBeDefined();
  if (found) {
    expectRelationshipEqual(found, expected);
  }
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function until it succeeds or times out
 *
 * @param fn - Async function to retry
 * @param options - Retry options
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delay?: number; timeout?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 100, timeout = 5000 } = options;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts || Date.now() - startTime > timeout) {
        throw error;
      }
      await sleep(delay);
    }
  }

  throw new Error('Retry failed: max attempts exceeded');
}

/**
 * Measure execution time of a function
 *
 * @param fn - Function to measure
 * @returns Execution time in milliseconds
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<number> {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
}

/**
 * Assert that a function executes within a time limit
 *
 * @param fn - Function to execute
 * @param maxTime - Maximum execution time in milliseconds
 */
export async function expectExecutionTime<T>(
  fn: () => Promise<T>,
  maxTime: number
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const elapsed = end - start;

  expect(elapsed).toBeLessThan(maxTime);
  return result;
}

/**
 * Create a spy that tracks all calls
 */
export function createCallTracker<T extends (...args: any[]) => any>() {
  const calls: Array<{ args: Parameters<T>; result?: ReturnType<T>; error?: Error }> = [];

  const spy = (...args: Parameters<T>) => {
    const call = { args };
    calls.push(call);
    return undefined as ReturnType<T>;
  };

  spy.calls = calls;
  spy.reset = () => {
    calls.length = 0;
  };
  spy.getCallCount = () => calls.length;
  spy.getCall = (index: number) => calls[index];
  spy.getLastCall = () => calls[calls.length - 1];

  return spy;
}

/**
 * Verify storage transaction cleanup
 */
export function expectNoActiveTransactions(storage: MockStorageAdapter) {
  expect(storage.getActiveTransactions()).toBe(0);
}

/**
 * Verify storage data snapshot matches expected
 */
export function expectStorageSnapshot(
  storage: MockStorageAdapter,
  collection: string,
  expected: any
) {
  const snapshot = storage.getDataSnapshot();
  const actual = snapshot.get(collection);
  expect(actual).toEqual(expected);
}

/**
 * Create a test entity with relationships array
 */
export function createEntityWithRelationships<T extends { id: string }>(
  base: T,
  relationships: Relationship[] = []
): T & { relationships: Relationship[] } {
  return {
    ...base,
    relationships,
  };
}

/**
 * Extract relationship IDs from an array
 */
export function extractRelationshipIds(relationships: Relationship[]): string[] {
  return relationships.map((r) => r.id);
}

/**
 * Group relationships by type
 */
export function groupRelationshipsByType(
  relationships: Relationship[]
): Map<string, Relationship[]> {
  const grouped = new Map<string, Relationship[]>();
  for (const rel of relationships) {
    const existing = grouped.get(rel.type) || [];
    existing.push(rel);
    grouped.set(rel.type, existing);
  }
  return grouped;
}

/**
 * Find relationship by source and target
 */
export function findRelationship(
  relationships: Relationship[],
  sourceId: string,
  targetId: string
): Relationship | undefined {
  return relationships.find(
    (r) =>
      (r.sourceId === sourceId && r.targetId === targetId) ||
      (r.sourceId === targetId && r.targetId === sourceId)
  );
}

/**
 * Assert that an error is thrown with a specific message
 */
export async function expectAsyncError(
  fn: () => Promise<any>,
  expectedMessage?: string | RegExp
): Promise<Error> {
  try {
    await fn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    if (error instanceof Error) {
      if (expectedMessage) {
        if (typeof expectedMessage === 'string') {
          expect(error.message).toContain(expectedMessage);
        } else {
          expect(error.message).toMatch(expectedMessage);
        }
      }
      return error;
    }
    throw error;
  }
}

/**
 * Batch execute async operations in parallel
 */
export async function batchExecute<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize = 10
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }

  return results;
}
