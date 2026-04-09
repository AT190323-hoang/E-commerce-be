import {
  Body,
  Controller,
  Post,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthRegisterResponseDto } from './dto/auth-register-response.dto';
import { AuthTokensResponseDto } from './dto/auth-tokens-response.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { ValidationErrorResponseDto } from '@/common/dto/validation-error-response.dto';
import { HttpErrorResponseDto } from '@/common/dto/http-error-response.dto';
import type { Request } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ type: AuthRegisterResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Login and receive access/refresh tokens' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: 'Rotate refresh token and issue a new token pair' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ type: AuthTokensResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @ApiOperation({
    summary: 'Logout and revoke access token and/or refresh token',
  })
  @ApiHeader({
    name: 'Authorization',
    required: false,
    description: 'Optional bearer access token: Bearer <token>',
  })
  @ApiBody({ type: LogoutDto })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
  @Post('logout')
  logout(@Req() req: Request, @Body() dto: LogoutDto) {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    return this.authService.logout(accessToken, dto.refreshToken);
  }
}