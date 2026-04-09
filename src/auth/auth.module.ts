import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '@/prisma/prisma.module';
import { StrategiesModule } from './strategies/strategies.module';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: 'secretKey',
      signOptions: { expiresIn: '15m' },
    }),
    StrategiesModule,
    PassportModule,
  ],
  providers: [AuthService, JwtStrategy, RolesGuard],
  controllers: [AuthController],
  exports: [RolesGuard],
})
export class AuthModule { }