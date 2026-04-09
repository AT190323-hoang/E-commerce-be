import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { PaymentsController } from './payments.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentsObservabilityController } from './payments-observability.controller';
import { PaymentsService } from './payments.service';
import { PaymentRetryProcessorService } from './payment-retry-processor.service';
import { PaymentMetricsService } from './payment-metrics.service';

@Module({
	imports: [PrismaModule],
	controllers: [
		PaymentsController,
		PaymentWebhookController,
		PaymentsObservabilityController,
	],
	providers: [PaymentsService, PaymentRetryProcessorService, PaymentMetricsService],
	exports: [PaymentsService],
})
export class PaymentsModule {}
