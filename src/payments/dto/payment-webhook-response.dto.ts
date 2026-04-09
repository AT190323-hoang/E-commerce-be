import { ApiProperty } from '@nestjs/swagger';

export class VnpayIpnResponseDto {
	@ApiProperty({ example: '00' })
	RspCode: string;

	@ApiProperty({ example: 'Confirm Success' })
	Message: string;
}
