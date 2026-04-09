import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum, IsUUID } from 'class-validator';

export class BulkUpdateOrderStatusDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    example: [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  orderIds: string[];

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.SHIPPED })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
