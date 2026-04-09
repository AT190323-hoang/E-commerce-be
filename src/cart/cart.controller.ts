import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CartService } from './cart.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { Role } from '@/common/enums/role.enum';
import { ValidationErrorResponseDto } from '@/common/dto/validation-error-response.dto';
import { HttpErrorResponseDto } from '@/common/dto/http-error-response.dto';

interface RequestUser {
  sub: string;
  role: Role;
}

@ApiTags('Cart')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('carts')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({ summary: 'Add item to cart' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @Post(':userId/items')
  addItem(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: AddCartItemDto,
    @Req() req: Request,
  ) {
    this.cartService.validateOwnerOrAdmin(req.user as RequestUser, userId);
    return this.cartService.addItem(userId, dto);
  }

  @ApiOperation({ summary: 'Get user cart' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @Get(':userId')
  getCart(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Req() req: Request,
  ) {
    this.cartService.validateOwnerOrAdmin(req.user as RequestUser, userId);
    return this.cartService.getCart(userId);
  }

  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @Patch(':userId/items/:itemId')
  updateItem(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: Request,
  ) {
    this.cartService.validateOwnerOrAdmin(req.user as RequestUser, userId);
    return this.cartService.updateItem(userId, itemId, dto);
  }

  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @Delete(':userId/items/:itemId')
  removeItem(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Req() req: Request,
  ) {
    this.cartService.validateOwnerOrAdmin(req.user as RequestUser, userId);
    return this.cartService.removeItem(userId, itemId);
  }

  @ApiOperation({ summary: 'Clear cart items' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @Delete(':userId')
  clearCart(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Req() req: Request,
  ) {
    this.cartService.validateOwnerOrAdmin(req.user as RequestUser, userId);
    return this.cartService.clearCart(userId);
  }
}
