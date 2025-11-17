/**
 * System Health Monitoring Utility
 * Provides easy access to circuit breaker and performance stats
 */

import { getAllCircuitBreakers } from './ErrorHandler';
import { getAllPerformanceStats, getSlowOperations, printPerformanceReport } from './performanceTiming';
import Logger from './Logger';
import type { SystemHealthReport, CircuitBreakerDetail, HealthStatus } from '../types/SystemHealth';

// Re-export types for convenience
export type { SystemHealthReport, CircuitBreakerDetail, HealthStatus };

/**
 * Get complete system health report
 */
export function getSystemHealth(): SystemHealthReport {
  const breakers = getAllCircuitBreakers();
  const perfStats = getAllPerformanceStats();
  const slowOps = getSlowOperations();

  // Circuit breaker stats
  let open = 0;
  let halfOpen = 0;
  let closed = 0;
  const breakerDetails: CircuitBreakerDetail[] = [];

  breakers.forEach((stats, name) => {
    if (stats.state === 'OPEN') open++;
    else if (stats.state === 'HALF_OPEN') halfOpen++;
    else closed++;

    breakerDetails.push({
      name,
      state: stats.state,
      failures: stats.failures,
      successes: stats.successes,
    });
  });

  // Performance stats
  const perfDetails = Object.entries(perfStats).map(([name, stats]) => ({
    name,
    avgMs: Math.round(stats.avg),
    p95Ms: Math.round(stats.p95),
  }));

  // Determine overall health
  let health: HealthStatus = 'healthy';
  if (open > 0 || slowOps.length > 3) {
    health = 'critical';
  } else if (halfOpen > 0 || slowOps.length > 0) {
    health = 'degraded';
  }

  return {
    timestamp: Date.now(),
    circuitBreakers: {
      total: breakers.size,
      open,
      halfOpen,
      closed,
      details: breakerDetails,
    },
    performance: {
      totalOperations: Object.keys(perfStats).length,
      slowOperations: slowOps.length,
      operations: perfDetails,
    },
    health,
  };
}

/**
 * Print system health to console
 */
export function printSystemHealth(): void {
  const health = getSystemHealth();

  console.log('\n🏥 System Health Report');
  console.log('━'.repeat(60));
  console.log(`Status: ${getHealthEmoji(health.health)} ${health.health.toUpperCase()}`);
  console.log(`Timestamp: ${new Date(health.timestamp).toLocaleString()}`);

  // Circuit Breakers
  console.log('\n🔌 Circuit Breakers:');
  console.log(`  Total: ${health.circuitBreakers.total}`);
  console.log(`  🟢 Closed: ${health.circuitBreakers.closed}`);
  console.log(`  🟡 Half-Open: ${health.circuitBreakers.halfOpen}`);
  console.log(`  🔴 Open: ${health.circuitBreakers.open}`);

  if (health.circuitBreakers.open > 0) {
    console.log('\n  ⚠️ Open Circuit Breakers:');
    health.circuitBreakers.details
      .filter(b => b.state === 'OPEN')
      .forEach(b => {
        console.log(`    - ${b.name} (${b.failures} failures)`);
      });
  }

  // Performance
  console.log('\n📊 Performance:');
  console.log(`  Total Operations: ${health.performance.totalOperations}`);
  console.log(`  Slow Operations: ${health.performance.slowOperations}`);

  if (health.performance.slowOperations > 0) {
    console.log('\n  ⚠️ Slow Operations:');
    health.performance.operations
      .filter(op => op.p95Ms > 3000)
      .slice(0, 5)
      .forEach(op => {
        console.log(`    - ${op.name}: Avg ${op.avgMs}ms, P95 ${op.p95Ms}ms`);
      });
  }

  console.log('\n' + '━'.repeat(60));

  // Recommendations
  if (health.health === 'critical') {
    console.log('\n⚠️ CRITICAL: Immediate attention required!');
    if (health.circuitBreakers.open > 0) {
      console.log('  - Open circuit breakers detected - check Firebase connection');
    }
    if (health.performance.slowOperations > 3) {
      console.log('  - Multiple slow operations - check network/queries');
    }
  } else if (health.health === 'degraded') {
    console.log('\n⚠️ WARNING: System is degraded');
    console.log('  - Monitor closely, may need intervention');
  } else {
    console.log('\n✅ System operating normally');
  }

  console.log('');
}

/**
 * Print full diagnostic report
 */
export function printFullDiagnostics(): void {
  printSystemHealth();
  console.log('\n📈 Detailed Performance Metrics:\n');
  printPerformanceReport();
}

/**
 * Check if system is healthy
 */
export function isSystemHealthy(): boolean {
  const health = getSystemHealth();
  return health.health === 'healthy';
}

/**
 * Get health emoji
 */
function getHealthEmoji(health: string): string {
  switch (health) {
    case 'healthy':
      return '✅';
    case 'degraded':
      return '⚠️';
    case 'critical':
      return '🔴';
    default:
      return '❓';
  }
}

/**
 * Log health warning if system is not healthy
 */
export function checkAndLogHealth(): void {
  const health = getSystemHealth();

  if (health.health !== 'healthy') {
    Logger.warn(
      `System health: ${health.health.toUpperCase()}`,
      {
        openBreakers: health.circuitBreakers.open,
        slowOps: health.performance.slowOperations,
      }
    );
  }
}

/**
 * Get health status as string
 */
export function getHealthStatus(): string {
  const health = getSystemHealth();
  return `${getHealthEmoji(health.health)} ${health.health} - ${health.circuitBreakers.open} open breakers, ${health.performance.slowOperations} slow ops`;
}
