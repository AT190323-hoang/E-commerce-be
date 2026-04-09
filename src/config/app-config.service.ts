import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  get apiUrl(): string {
    return this.configService.get<string>('API_URL', 'http://localhost:3000');
  }

  get databaseUrl(): string {
    return this.configService.get<string>('DATABASE_URL') || '';
  }

  // Redis config
  get redisHost(): string {
    return this.configService.get<string>('REDIS_HOST', 'localhost');
  }

  get redisPort(): number {
    return this.configService.get<number>('REDIS_PORT', 6379);
  }

  get redisDb(): number {
    return this.configService.get<number>('REDIS_DB', 0);
  }

  // JWT config
  get jwtAccessSecret(): string {
    return this.configService.get<string>('JWT_ACCESS_SECRET') || '';
  }

  get jwtRefreshSecret(): string {
    return this.configService.get<string>('JWT_REFRESH_SECRET') || '';
  }

  get jwtAccessExpiration(): string {
    return this.configService.get<string>('JWT_ACCESS_EXPIRATION', '900s');
  }

  get jwtRefreshExpiration(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRATION', '604800s');
  }

  // Bcrypt config
  get bcryptSalt(): number {
    return this.configService.get<number>('BCRYPT_SALT', 10);
  }

  // VNPay config
  get vnpayTmnCode(): string {
    return this.configService.get<string>('VNPAY_TMN_CODE') || '';
  }

  get vnpayHashSecret(): string {
    return this.configService.get<string>('VNPAY_HASH_SECRET') || '';
  }

  get vnpayApiUrl(): string {
    return this.configService.get<string>(
      'VNPAY_API_URL',
      'https://sandbox.vnpayment.vn',
    );
  }

  get vnpayReturnUrl(): string {
    return this.configService.get<string>('VNPAY_RETURN_URL') || '';
  }

  // File upload config
  get uploadPath(): string {
    return this.configService.get<string>('UPLOAD_PATH', './uploads');
  }

  get maxFileSize(): number {
    return this.configService.get<number>('MAX_FILE_SIZE', 5242880);
  }

  // Email config
  get smtpHost(): string {
    return this.configService.get<string>('SMTP_HOST') || '';
  }

  get smtpPort(): number {
    return this.configService.get<number>('SMTP_PORT', 587);
  }

  get smtpUser(): string {
    return this.configService.get<string>('SMTP_USER') || '';
  }

  get smtpPassword(): string {
    return this.configService.get<string>('SMTP_PASSWORD') || '';
  }

  get senderEmail(): string {
    return this.configService.get<string>('SENDER_EMAIL', 'noreply@ecommerce.local');
  }

  // Logging config
  get logLevel(): string {
    return this.configService.get<string>('LOG_LEVEL', 'debug');
  }

  // Feature flags
  get enablePaymentRetry(): boolean {
    return this.configService.get<boolean>('ENABLE_PAYMENT_RETRY', true);
  }

  get enableReconciliationJob(): boolean {
    return this.configService.get<boolean>('ENABLE_RECONCILIATION_JOB', false);
  }

  // Utility methods
  isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  isTest(): boolean {
    return this.nodeEnv === 'test';
  }
}
