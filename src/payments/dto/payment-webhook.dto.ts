import { ApiProperty } from '@nestjs/swagger';

export class VnpayIpnQueryDto {
	@ApiProperty({ example: '2.1.0' })
	vnp_Version: string;

	@ApiProperty({ example: 'pay' })
	vnp_Command: string;

	@ApiProperty({ example: 'VNPAYCODE' })
	vnp_TmnCode: string;

	@ApiProperty({ example: 'VNP_8c4efb9f6f9d4f9e9ef6f2f58b9f6a21' })
	vnp_TxnRef: string;

	@ApiProperty({ example: '12995000' })
	vnp_Amount: string;

	@ApiProperty({ example: '00' })
	vnp_ResponseCode: string;

	@ApiProperty({ example: '00' })
	vnp_TransactionStatus: string;

	@ApiProperty({ example: '20260401102536' })
	vnp_PayDate: string;

	@ApiProperty({ example: '3f43e7610b3f...' })
	vnp_SecureHash: string;
}
