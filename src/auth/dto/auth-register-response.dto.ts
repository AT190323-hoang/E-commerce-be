import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@/common/enums/role.enum';

export class AuthRegisterResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  role: Role;
}
