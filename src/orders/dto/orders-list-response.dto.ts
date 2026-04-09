import { ApiProperty } from '@nestjs/swagger';
import { OrderResponseDto } from './order-response.dto';

export class OrdersListResponseDto {
  @ApiProperty({ type: OrderResponseDto, isArray: true })
  items: OrderResponseDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 20 })
  total: number;

  @ApiProperty({ example: 2 })
  totalPages: number;
}
