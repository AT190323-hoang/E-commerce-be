import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentRetryProcessorService {
  private readonly logger = new Logger(PaymentRetryProcessorService.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processRetryQueue() {
    const startedAt = Date.now();

    try {
      const result = await this.paymentsService.processPendingRetries();
      const durationMs = Date.now() - startedAt;

      if (result.processed > 0 || result.totalCandidates > 0) {
        this.logger.log(
          `IPN retry queue processed: ${result.processed}/${result.totalCandidates} in ${durationMs}ms`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`IPN retry processor failed: ${message}`);
    }
  }
}
