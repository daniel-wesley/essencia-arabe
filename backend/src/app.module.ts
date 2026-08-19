import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { CartModule } from './modules/cart/cart.module';
import { SearchModule } from './modules/search/search.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    // Database
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USER || 'janilly',
      password: process.env.DB_PASS || 'janilly_secret',
      database: process.env.DB_NAME || 'janilly_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      logging: process.env.NODE_ENV !== 'production',
    }),

    // Redis Cache
    CacheModule.register({
      isGlobal: true,
      store: 'redis',
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      ttl: 60 * 60, // 1 hora padrão
    }),

    // BullMQ
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      },
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Modules
    AuthModule,
    UsersModule,
    ProductsModule,
    OrdersModule,
    InventoryModule,
    RecommendationsModule,
    PaymentsModule,
    CartModule,
    SearchModule,
    NotificationsModule,
    DashboardModule,
  ],
})
export class AppModule {}
