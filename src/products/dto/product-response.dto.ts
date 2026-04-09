import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Wireless Mouse' })
  name: string;

  @ApiPropertyOptional({ example: 'Ergonomic wireless mouse' })
  description: string | null;

  @ApiProperty({ example: 29.99 })
  price: number;

  @ApiProperty({ example: 100 })
  stock: number;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/products/mouse.jpg' })
  imageUrl: string | null;

  @ApiProperty({ format: 'uuid' })
  categoryId: string;

  @ApiProperty({ example: '2026-03-31T10:21:36.042Z' })
  createdAt: Date;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiPropertyOptional({ example: 4.5, nullable: true })
  avgRating: number | null;
}
