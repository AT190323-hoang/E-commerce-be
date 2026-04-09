import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentMetricsService } from './payment-metrics.service';

@ApiTags('Payments Observability')
@Controller('payments')
export class PaymentsObservabilityController {
  constructor(private readonly paymentMetricsService: PaymentMetricsService) {}

  @ApiOperation({ summary: 'Get payment IPN metrics snapshot' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        totalReceived: { type: 'number', example: 10 },
        totalSucceeded: { type: 'number', example: 8 },
        totalFailed: { type: 'number', example: 1 },
        totalDuplicate: { type: 'number', example: 1 },
        averageProcessingTimeMs: { type: 'number', example: 14.25 },
        totalProcessingTimeMs: { type: 'number', example: 114 },
      },
    },
  })
  @Get('metrics')
  getMetrics() {
    return this.paymentMetricsService.getSnapshot();
  }

  @ApiOperation({ summary: 'Payment webhook health check' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-04-08T10:30:00.000Z' },
        metrics: { type: 'object' },
      },
    },
  })
  @Get('health')
  getHealth() {
    return this.paymentMetricsService.isHealthy();
  }
}