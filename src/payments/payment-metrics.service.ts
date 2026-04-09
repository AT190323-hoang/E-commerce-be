import { Injectable } from '@nestjs/common';

export interface PaymentMetricsSnapshot {
  totalReceived: number;
  totalSucceeded: number;
  totalFailed: number;
  totalDuplicate: number;
  averageProcessingTimeMs: number;
  totalProcessingTimeMs: number;
}

@Injectable()
export class PaymentMetricsService {
  private totalReceived = 0;
  private totalSucceeded = 0;
  private totalFailed = 0;
  private totalDuplicate = 0;
  private totalProcessedWithDuration = 0;
  private totalProcessingTimeMs = 0;

  recordReceived() {
    this.totalReceived += 1;
  }

  recordSucceeded(durationMs: number) {
    this.totalSucceeded += 1;
    this.totalProcessedWithDuration += 1;
    this.totalProcessingTimeMs += Math.max(0, durationMs);
  }

  recordFailed(durationMs: number) {
    this.totalFailed += 1;
    this.totalProcessedWithDuration += 1;
    this.totalProcessingTimeMs += Math.max(0, durationMs);
  }

  recordDuplicate() {
    this.totalDuplicate += 1;
  }

  getSnapshot(): PaymentMetricsSnapshot {
    const averageProcessingTimeMs =
      this.totalProcessedWithDuration === 0
        ? 0
        : Number(
            (this.totalProcessingTimeMs / this.totalProcessedWithDuration).toFixed(
              2,
            ),
          );

    return {
      totalReceived: this.totalReceived,
      totalSucceeded: this.totalSucceeded,
      totalFailed: this.totalFailed,
      totalDuplicate: this.totalDuplicate,
      averageProcessingTimeMs,
      totalProcessingTimeMs: this.totalProcessingTimeMs,
    };
  }

  isHealthy() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      metrics: this.getSnapshot(),
    };
  }
}