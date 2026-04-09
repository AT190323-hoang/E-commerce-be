import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumberString, IsOptional } from 'class-validator';

export class RevenueStatsQueryDto {
  @ApiPropertyOptional({
    enum: ['daily', 'monthly'],
    default: 'daily',
  })
  @IsOptional()
  @IsIn(['daily', 'monthly'])
  period?: 'daily' | 'monthly';

  @ApiPropertyOptional({
    description: 'Lookback days for daily mode',
    example: '30',
  })
  @IsOptional()
  @IsNumberString()
  days?: string;

  @ApiPropertyOptional({
    description: 'Lookback months for monthly mode',
    example: '12',
  })
  @IsOptional()
  @IsNumberString()
  months?: string;
}
