/**
 * System Health Type Definitions
 * Ensures type safety between data producers and consumers
 */

export interface CircuitBreakerDetail {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successes: number;
}

export interface CircuitBreakersHealth {
  total: number;
  open: number;
  halfOpen: number;
  closed: number;
  details: CircuitBreakerDetail[];
}

export interface PerformanceOperation {
  name: string;
  avgMs: number;
  p95Ms: number;
}

export interface PerformanceHealth {
  totalOperations: number;
  slowOperations: number;
  operations: PerformanceOperation[];
}

export type HealthStatus = 'healthy' | 'degraded' | 'critical';

export interface SystemHealthReport {
  timestamp: number;
  health: HealthStatus;
  circuitBreakers: CircuitBreakersHealth;
  performance: PerformanceHealth;
}
