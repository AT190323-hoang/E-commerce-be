import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateProductImageDto {
  @ApiProperty({ example: 'https://cdn.example.com/products/mouse-v2.jpg' })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;
}
