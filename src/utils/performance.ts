/**
 * Performance Monitoring Utility
 *
 * Provides tools for measuring and tracking performance metrics
 * across the application. Used to establish baselines and track
 * improvements over time.
 */

export interface PerformanceStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private enabled: boolean = true;

  /**
   * Mark the start of an operation and return a function to mark the end
   *
   * @example
   * const end = perfMonitor.start('session-load');
   * await loadSession();
   * end(); // Records duration
   */
  start(label: string): () => void {
    if (!this.enabled) {
      return () => {};
    }

    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.record(label, duration);
    };
  }

  /**
   * Record a metric value
   */
  record(label: string, value: number): void {
    if (!this.enabled) return;

    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(value);
  }

  /**
   * Get statistics for a specific metric
   */
  getStats(label: string): PerformanceStats | null {
    const values = this.metrics.get(label);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Get all metrics as an exportable object
   */
  export(): Record<string, PerformanceStats | null> {
    const result: Record<string, PerformanceStats | null> = {};
    for (const [label, _] of this.metrics) {
      result[label] = this.getStats(label);
    }
    return result;
  }

  /**
   * Get all raw values for a metric (for debugging)
   */
  getRawValues(label: string): number[] {
    return [...(this.metrics.get(label) || [])];
  }

  /**
   * Get all metric labels
   */
  getLabels(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Clear a specific metric
   */
  clearMetric(label: string): void {
    this.metrics.delete(label);
  }

  /**
   * Enable or disable monitoring (useful for production)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Log all current stats to console
   */
  logStats(): void {
    const stats = this.export();
    console.log('Performance Metrics:');
    for (const [label, stat] of Object.entries(stats)) {
      if (stat) {
        console.log(`  ${label}:`, {
          avg: `${stat.avg.toFixed(2)}ms`,
          p95: `${stat.p95.toFixed(2)}ms`,
          count: stat.count,
        });
      }
    }
  }

  /**
   * Format stats for human-readable output
   */
  formatStats(label: string): string {
    const stats = this.getStats(label);
    if (!stats) return `No data for ${label}`;

    return [
      `${label}:`,
      `  Count: ${stats.count}`,
      `  Min: ${stats.min.toFixed(2)}ms`,
      `  Max: ${stats.max.toFixed(2)}ms`,
      `  Avg: ${stats.avg.toFixed(2)}ms`,
      `  P50: ${stats.p50.toFixed(2)}ms`,
      `  P95: ${stats.p95.toFixed(2)}ms`,
      `  P99: ${stats.p99.toFixed(2)}ms`,
    ].join('\n');
  }
}

/**
 * Singleton instance for global performance monitoring
 */
export const perfMonitor = new PerformanceMonitor();

/**
 * Utility to measure async function execution time
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const end = perfMonitor.start(label);
  try {
    return await fn();
  } finally {
    end();
  }
}

/**
 * Utility to measure sync function execution time
 */
export function measureSync<T>(
  label: string,
  fn: () => T
): T {
  const end = perfMonitor.start(label);
  try {
    return fn();
  } finally {
    end();
  }
}

/**
 * Check if a metric meets a target threshold
 */
export function checkTarget(
  label: string,
  targetMs: number,
  metric: 'avg' | 'p50' | 'p95' | 'p99' = 'p95'
): { met: boolean; actual: number; target: number } {
  const stats = perfMonitor.getStats(label);
  if (!stats) {
    return { met: false, actual: 0, target: targetMs };
  }

  const actual = stats[metric];
  return { met: actual <= targetMs, actual, target: targetMs };
}
