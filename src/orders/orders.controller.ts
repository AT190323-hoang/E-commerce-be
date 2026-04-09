import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrdersListResponseDto } from './dto/orders-list-response.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { ValidationErrorResponseDto } from '@/common/dto/validation-error-response.dto';
import { HttpErrorResponseDto } from '@/common/dto/http-error-response.dto';

interface RequestUser {
  sub: string;
  role: Role;
}

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Checkout current user cart to create an order' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Optional key to prevent duplicate checkout requests',
  })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @Post('checkout')
  checkout(
    @Req() req: Request,
    @Body() dto: CheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const user = req.user as RequestUser;
    return this.ordersService.checkout(user.sub, dto, idempotencyKey);
  }

  @ApiOperation({ summary: 'Get orders (admin sees all, user sees own)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOkResponse({ type: OrdersListResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @Get()
  findAll(@Req() req: Request, @Query() query: OrderQueryDto) {
    return this.ordersService.findAll(req.user as RequestUser, query);
  }

  @ApiOperation({ summary: 'Get order by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    return this.ordersService.findOne(id, req.user as RequestUser);
  }

  @ApiOperation({ summary: 'Update order status (Admin only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @Roles(Role.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto);
  }
}
