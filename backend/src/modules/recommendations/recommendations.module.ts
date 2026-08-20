import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendationsLog } from './entities/recommendations-log.entity';
import { UserPreferences } from './entities/user-preferences.entity';
import { Product } from '../products/entities/product.entity';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RecommendationsLog,
      UserPreferences,
      Product,
    ]),
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
