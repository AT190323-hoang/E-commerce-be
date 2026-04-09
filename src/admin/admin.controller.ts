import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { HttpErrorResponseDto } from '@/common/dto/http-error-response.dto';
import { ValidationErrorResponseDto } from '@/common/dto/validation-error-response.dto';
import { AdminService } from './admin.service';
import { RevenueStatsQueryDto } from './dto/revenue-stats-query.dto';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { BulkUpdateOrderStatusDto } from './dto/bulk-update-order-status.dto';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: 'Revenue stats grouped by daily/monthly periods' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        period: { type: 'string', example: 'daily' },
        points: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', example: '2026-04-08' },
              revenue: { type: 'number', example: 1240.5 },
              orders: { type: 'number', example: 12 },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @Get('stats/revenue')
  getRevenueStats(@Query() query: RevenueStatsQueryDto) {
    return this.adminService.getRevenueStats(query);
  }

  @ApiOperation({ summary: 'Order stats: count, paid count, avg and total value' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        totalOrders: { type: 'number', example: 120 },
        paidOrders: { type: 'number', example: 97 },
        totalOrderValue: { type: 'number', example: 245000 },
        averageOrderValue: { type: 'number', example: 2041.67 },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @Get('stats/orders')
  getOrderStats() {
    return this.adminService.getOrderStats();
  }

  @ApiOperation({ summary: 'Top selling products by quantity sold' })
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Wireless Mouse' },
          totalSold: { type: 'number', example: 245 },
          revenue: { type: 'number', example: 7347.55 },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @Get('products/top-selling')
  getTopSellingProducts() {
    return this.adminService.getTopSellingProducts();
  }

  @ApiOperation({ summary: 'List orders with admin filters and pagination' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object' } },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        total: { type: 'number', example: 120 },
        totalPages: { type: 'number', example: 6 },
      },
    },
  })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @Get('orders')
  listOrders(@Query() query: AdminOrdersQueryDto) {
    return this.adminService.listOrders(query);
  }

  @ApiOperation({ summary: 'Bulk update order status' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        updatedCount: { type: 'number', example: 3 },
        status: { type: 'string', example: 'SHIPPED' },
      },
    },
  })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @Patch('orders/bulk-status')
  bulkUpdateOrderStatus(@Body() dto: BulkUpdateOrderStatusDto) {
    return this.adminService.bulkUpdateOrderStatus(dto);
  }
}
