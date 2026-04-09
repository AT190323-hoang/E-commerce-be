import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  fullName: string | null;

  @ApiPropertyOptional({ example: '0123456789' })
  phone: string | null;

  @ApiPropertyOptional({ example: '123 Main Street' })
  address: string | null;
}
