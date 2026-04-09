import { Controller, Get, Query } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiOkResponse,
	ApiOperation,
	ApiQuery,
	ApiTags,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { VnpayIpnResponseDto } from './dto/payment-webhook-response.dto';
import { HttpErrorResponseDto } from '@/common/dto/http-error-response.dto';

@ApiTags('Webhooks')
@Controller('webhooks/vnpay')
export class PaymentWebhookController {
	constructor(private readonly paymentsService: PaymentsService) {}

	@ApiOperation({ summary: 'VNPay IPN callback endpoint (server-to-server)' })
	@ApiQuery({ name: 'vnp_TxnRef', required: true })
	@ApiQuery({ name: 'vnp_Amount', required: true })
	@ApiQuery({ name: 'vnp_ResponseCode', required: true })
	@ApiQuery({ name: 'vnp_TransactionStatus', required: true })
	@ApiQuery({ name: 'vnp_SecureHash', required: true })
	@ApiOkResponse({ type: VnpayIpnResponseDto })
	@ApiBadRequestResponse({ type: HttpErrorResponseDto })
	@Get('ipn')
	handleVnpayIpn(@Query() query: Record<string, string | string[] | undefined>) {
		return this.paymentsService.handleVnpayIpn(query);
	}

	@ApiOperation({
		summary: 'VNPay return URL endpoint (for frontend redirect/result)',
	})
	@ApiOkResponse({
		schema: {
			type: 'object',
			properties: {
				code: { type: 'string', nullable: true, example: '00' },
				txnRef: {
					type: 'string',
					nullable: true,
					example: 'VNP_8c4efb9f6f9d4f9e9ef6f2f58b9f6a21',
				},
				amount: { type: 'number', nullable: true, example: 129950 },
				orderInfo: {
					type: 'string',
					nullable: true,
					example: 'Thanh toan don hang abc-def',
				},
				bankCode: { type: 'string', nullable: true, example: 'NCB' },
				transactionNo: { type: 'string', nullable: true, example: '14597344' },
				payDate: { type: 'string', nullable: true, example: '20260401102536' },
				message: { type: 'string', example: 'Payment successful' },
			},
		},
	})
	@Get('return')
	handleVnpayReturn(@Query() query: Record<string, string | string[] | undefined>) {
		return this.paymentsService.parseVnpayReturn(query);
	}
}
