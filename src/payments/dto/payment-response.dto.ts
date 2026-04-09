import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class PaymentResponseDto {
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

	@ApiPropertyOptional({ example: 'VNP_8c4efb9f6f9d4f9e9ef6f2f58b9f6a21' })
	externalId: string | null;

	@ApiProperty({ example: '2026-04-01T10:21:36.042Z' })
	createdAt: Date;

	@ApiProperty({ example: '2026-04-01T10:25:36.042Z' })
	updatedAt: Date;
}
