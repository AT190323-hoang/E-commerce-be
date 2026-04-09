import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

class OrderItemProductDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Wireless Mouse' })
  name: string;

  @ApiProperty({ example: 'https://cdn.example.com/products/mouse.jpg', nullable: true })
  imageUrl: string | null;
}

class OrderItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 29.99 })
  price: number;

  @ApiProperty({ type: OrderItemProductDto })
  product: OrderItemProductDto;
}

export class OrderResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: 129.95 })
  totalPrice: number;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ example: '2026-03-31T10:25:36.042Z' })
  statusUpdatedAt: Date;

  @ApiProperty({ example: '123 Main Street, District 1' })
  shippingAddress: string;

  @ApiProperty({ example: '0901234567' })
  phone: string;

  @ApiProperty({ example: '2026-03-31T10:21:36.042Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-03-31T10:25:36.042Z' })
  updatedAt: Date;

  @ApiProperty({ type: OrderItemDto, isArray: true })
  items: OrderItemDto[];
}
