import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class PaymentInitiateResponseDto {
	@ApiProperty({ format: 'uuid' })
	id: string;

	@ApiProperty({ format: 'uuid' })
	orderId: string;

	@ApiProperty({ enum: PaymentStatus, example: PaymentStatus.PENDING })
	status: PaymentStatus;

	@ApiProperty({ example: 129950 })
	amount: number;

	@ApiProperty({ example: 'VND' })
	currency: string;

	@ApiProperty({ example: 'vnpay' })
	method: string;

	@ApiProperty({ example: 'VNP_8c4efb9f6f9d4f9e9ef6f2f58b9f6a21' })
	externalId: string;

	@ApiProperty({
		example:
			'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=12995000&vnp_Command=pay...',
	})
	paymentUrl: string;
}
