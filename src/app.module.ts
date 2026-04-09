import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from '@/users/users.module';
import { ProductsModule } from '@/products/products.module';
import { CategoriesModule } from '@/categories/categories.module';
import { CartModule } from '@/cart/cart.module';
import { OrdersModule } from '@/orders/orders.module';
import { PaymentsModule } from '@/payments/payments.module';
import { AppConfigModule } from '@/config/config.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReviewsModule } from '@/reviews/reviews.module';
import { AdminModule } from '@/admin/admin.module';



@Module({
  imports: [
    AppConfigModule,
    ScheduleModule.forRoot(),
    AuthModule,
    PrismaModule,
    RedisModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    ReviewsModule,
    AdminModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
