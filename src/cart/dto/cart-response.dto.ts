import { ApiProperty } from '@nestjs/swagger';

class CartProductDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Wireless Mouse' })
  name: string;

  @ApiProperty({ example: 29.99 })
  price: number;

  @ApiProperty({ example: 'https://cdn.example.com/products/mouse.jpg', nullable: true })
  imageUrl: string | null;
}

class CartItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ type: CartProductDto })
  product: CartProductDto;
}

export class CartResponseDto {
  @ApiProperty({ format: 'uuid', nullable: true })
  id: string | null;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ type: CartItemDto, isArray: true })
  items: CartItemDto[];

  @ApiProperty({ example: 3 })
  totalItems: number;

  @ApiProperty({ example: 89.97 })
  totalAmount: number;
}
