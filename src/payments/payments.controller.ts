import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Req,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiBearerAuth,
	ApiForbiddenResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiParam,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Role } from '@/common/enums/role.enum';
import { PaymentsService } from './payments.service';
import { PaymentInitiateResponseDto } from './dto/payment-initiate-response.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { HttpErrorResponseDto } from '@/common/dto/http-error-response.dto';

interface RequestUser {
	sub: string;
	role: Role;
}

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
	constructor(private readonly paymentsService: PaymentsService) {}

	@ApiOperation({ summary: 'Initiate VNPay payment for an order' })
	@ApiParam({ name: 'orderId', format: 'uuid' })
	@ApiOkResponse({ type: PaymentInitiateResponseDto })
	@ApiBadRequestResponse({ type: HttpErrorResponseDto })
	@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
	@ApiForbiddenResponse({ type: HttpErrorResponseDto })
	@ApiNotFoundResponse({ type: HttpErrorResponseDto })
	@Post('initiate/:orderId')
	initiate(
		@Param('orderId', new ParseUUIDPipe()) orderId: string,
		@Req() req: Request,
	) {
		const forwardedIp = req.headers['x-forwarded-for'];
		const clientIp =
			typeof forwardedIp === 'string'
				? forwardedIp
				: req.socket.remoteAddress ?? '127.0.0.1';

		return this.paymentsService.initiate(
			orderId,
			req.user as RequestUser,
			clientIp,
		);
	}

	@ApiOperation({ summary: 'Get payment by id' })
	@ApiParam({ name: 'id', format: 'uuid' })
	@ApiOkResponse({ type: PaymentResponseDto })
	@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
	@ApiForbiddenResponse({ type: HttpErrorResponseDto })
	@ApiNotFoundResponse({ type: HttpErrorResponseDto })
	@Get(':id')
	findOne(
		@Param('id', new ParseUUIDPipe()) id: string,
		@Req() req: Request,
	) {
		return this.paymentsService.findOne(id, req.user as RequestUser);
	}
}
