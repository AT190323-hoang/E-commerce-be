import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { ReviewsService } from './reviews.service';
import { ValidationErrorResponseDto } from '@/common/dto/validation-error-response.dto';
import { HttpErrorResponseDto } from '@/common/dto/http-error-response.dto';

interface RequestUser {
  sub: string;
}

@ApiTags('Reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiOperation({ summary: 'Create product review (only after order delivered)' })
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: ReviewResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @ApiForbiddenResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @UseGuards(JwtAuthGuard)
  @Post('reviews')
  create(@Req() req: Request, @Body() dto: CreateReviewDto) {
    const user = req.user as RequestUser;
    return this.reviewsService.create(user.sub, dto);
  }

  @ApiOperation({ summary: 'Get all reviews for a product' })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiOkResponse({ type: ReviewResponseDto, isArray: true })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  @Get('products/:productId/reviews')
  findByProduct(@Param('productId', new ParseUUIDPipe()) productId: string) {
    return this.reviewsService.findByProduct(productId);
  }
}