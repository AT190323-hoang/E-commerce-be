import { ApiProperty } from '@nestjs/swagger';

export class ValidationErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: ['email must be an email', 'password must be longer than or equal to 6 characters'],
    isArray: true,
  })
  message: string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}
