import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ProductQueryDto {
  @ApiPropertyOptional({ example: 'wireless' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Alias of categoryId' })
  @IsOptional()
  @IsUUID()
  category?: string;

  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @IsNumberString()
  minPrice?: string;

  @ApiPropertyOptional({ example: '1000' })
  @IsOptional()
  @IsNumberString()
  maxPrice?: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ example: '10' })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @IsNumberString()
  offset?: string;

  @ApiPropertyOptional({
    enum: ['createdAt_desc', 'createdAt_asc', 'price_desc', 'price_asc', 'name_desc', 'name_asc'],
    example: 'price_asc',
  })
  @IsOptional()
  @IsIn(['createdAt_desc', 'createdAt_asc', 'price_desc', 'price_asc', 'name_desc', 'name_asc'])
  sort?:
    | 'createdAt_desc'
    | 'createdAt_asc'
    | 'price_desc'
    | 'price_asc'
    | 'name_desc'
    | 'name_asc';

  @ApiPropertyOptional({ enum: ['createdAt', 'price', 'name'], example: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'price', 'name'])
  sortBy?: 'createdAt' | 'price' | 'name';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
