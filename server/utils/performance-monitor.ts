// Performance monitoring utility
import { logger } from './logger';

interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private timers: Map<string, number> = new Map();

  startTimer(operationId: string): void {
    this.timers.set(operationId, Date.now());
  }

  endTimer(operationId: string, operation: string, success: boolean = true, metadata?: Record<string, any>): number {
    const startTime = this.timers.get(operationId);
    if (!startTime) {
      logger.warn(`No timer found for operation: ${operationId}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operationId);

    const metric: PerformanceMetrics = {
      operation,
      duration,
      success,
      metadata,
    };

    this.metrics.push(metric);

    // Log slow operations
    if (duration > 1000) {
      logger.warn(`Slow operation detected: ${operation} took ${duration}ms`, metadata);
    }

    return duration;
  }

  getMetrics(operation?: string): PerformanceMetrics[] {
    if (operation) {
      return this.metrics.filter(m => m.operation === operation);
    }
    return [...this.metrics];
  }

  getAverageTime(operation: string): number {
    const operationMetrics = this.getMetrics(operation);
    if (operationMetrics.length === 0) return 0;

    const totalTime = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return Math.round(totalTime / operationMetrics.length);
  }

  getSuccessRate(operation: string): number {
    const operationMetrics = this.getMetrics(operation);
    if (operationMetrics.length === 0) return 100;

    const successfulOps = operationMetrics.filter(m => m.success).length;
    return Math.round((successfulOps / operationMetrics.length) * 100);
  }

  getSummary(): Record<string, any> {
    const operations = new Set(this.metrics.map(m => m.operation));
    const summary: Record<string, any> = {};

    operations.forEach(op => {
      summary[op] = {
        count: this.getMetrics(op).length,
        averageTime: this.getAverageTime(op),
        successRate: this.getSuccessRate(op),
      };
    });

    return summary;
  }

  reset(): void {
    this.metrics = [];
    this.timers.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();