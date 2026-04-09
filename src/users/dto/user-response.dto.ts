import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@/common/enums/role.enum';
import { UserProfileDto } from './user-profile.dto';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ enum: Role, example: Role.USER })
  role: Role;

  @ApiProperty({ example: '2026-03-31T10:21:36.042Z' })
  createdAt: Date;

  @ApiPropertyOptional({ type: UserProfileDto, nullable: true })
  profile: UserProfileDto | null;
}
