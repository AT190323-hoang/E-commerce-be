import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  productId: string;

  @ApiProperty({ example: 4 })
  rating: number;

  @ApiPropertyOptional({ example: 'Shop dong goi can than', nullable: true })
  comment: string | null;

  @ApiProperty({ example: '2026-04-08T12:00:00.000Z' })
  createdAt: Date;
}