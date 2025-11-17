/**
 * Enhanced Performance Timing Utility for React Native
 * Tracks performance metrics with statistical analysis
 */

const timers: Record<string, number> = {};
const metrics: Map<string, number[]> = new Map();
const MAX_SAMPLES = 100; // Keep last 100 measurements
const SLOW_THRESHOLD = 3000; // Alert if operation takes > 3s
const ENABLE_DETAILED_LOGGING = false; // Set to true only when debugging

/**
 * Start timing an operation
 */
export const performanceTime = (label: string): void => {
  timers[label] = Date.now();
};

/**
 * End timing and record duration
 */
export const performanceTimeEnd = (label: string): void => {
  if (timers[label]) {
    const duration = Date.now() - timers[label];
    recordMetric(label, duration);
    delete timers[label];

    // Alert on slow operations
    if (duration > SLOW_THRESHOLD) {
      console.warn(`⚠️ Slow operation: ${label} took ${duration}ms`);
    } else if (__DEV__ && ENABLE_DETAILED_LOGGING) {
      console.log(`⏱️ ${label}: ${duration}ms`);
    }
  }
};

/**
 * Record a metric manually
 */
function recordMetric(label: string, duration: number): void {
  if (!metrics.has(label)) {
    metrics.set(label, []);
  }

  const samples = metrics.get(label)!;
  samples.push(duration);

  // Keep only last N samples
  if (samples.length > MAX_SAMPLES) {
    samples.shift();
  }
}

/**
 * Get statistics for a metric
 */
export interface PerformanceStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export function getPerformanceStats(label: string): PerformanceStats | null {
  const samples = metrics.get(label);
  if (!samples || samples.length === 0) {
    return null;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    count,
    avg: sum / count,
    min: sorted[0],
    max: sorted[count - 1],
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

/**
 * Get all performance metrics
 */
export function getAllPerformanceStats(): Record<string, PerformanceStats> {
  const allStats: Record<string, PerformanceStats> = {};

  metrics.forEach((_, label) => {
    const stats = getPerformanceStats(label);
    if (stats) {
      allStats[label] = stats;
    }
  });

  return allStats;
}

/**
 * Get slow operations
 */
export function getSlowOperations(threshold = SLOW_THRESHOLD): string[] {
  const slowOps: string[] = [];

  metrics.forEach((_, label) => {
    const stats = getPerformanceStats(label);
    if (stats && (stats.avg > threshold || stats.p95 > threshold)) {
      slowOps.push(label);
    }
  });

  return slowOps;
}

/**
 * Print performance report
 */
export function printPerformanceReport(): void {
  console.log('\n📊 Performance Report');
  console.log('━'.repeat(50));

  const allStats = getAllPerformanceStats();
  const slowOps = getSlowOperations();

  if (slowOps.length > 0) {
    console.log('\n⚠️ Slow Operations:');
    slowOps.forEach(label => {
      const stats = allStats[label];
      console.log(`  ${label}:`);
      console.log(`    Avg: ${stats.avg.toFixed(0)}ms`);
      console.log(`    P95: ${stats.p95.toFixed(0)}ms`);
    });
  }

  console.log('\nAll Metrics:');
  Object.entries(allStats).forEach(([label, stats]) => {
    console.log(`\n  ${label}:`);
    console.log(`    Count: ${stats.count}`);
    console.log(`    Avg: ${stats.avg.toFixed(2)}ms`);
    console.log(`    P50: ${stats.p50.toFixed(2)}ms`);
    console.log(`    P95: ${stats.p95.toFixed(2)}ms`);
    console.log(`    Min/Max: ${stats.min.toFixed(0)}ms / ${stats.max.toFixed(0)}ms`);
  });

  console.log('\n' + '━'.repeat(50) + '\n');
}

/**
 * Clear all metrics
 */
export function clearPerformanceMetrics(): void {
  metrics.clear();
  console.log('✅ Performance metrics cleared');
}

/**
 * Calculate percentile
 */
function percentile(sorted: number[], p: number): number {
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Simple performance logger
 */
export const performanceLog = (message: string): void => {
  if (__DEV__ && ENABLE_DETAILED_LOGGING) {
    console.log(message);
  }
};

/**
 * Measure async function performance
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  performanceTime(label);
  try {
    const result = await fn();
    performanceTimeEnd(label);
    return result;
  } catch (error) {
    performanceTimeEnd(label);
    throw error;
  }
}
