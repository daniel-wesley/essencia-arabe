import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get('personalized')
  @UseGuards(JwtAuthGuard)
  async getPersonalized(
    @Request() req,
    @Query('limit') limit: number = 10,
  ) {
    return this.recommendationsService.getPersonalizedRecommendations(
      req.user.id,
      limit,
    );
  }

  @Get('complementary/:productId')
  async getComplementary(
    @Param('productId') productId: string,
    @Query('limit') limit: number = 5,
  ) {
    return this.recommendationsService.getComplementaryRecommendations(
      productId,
      limit,
    );
  }

  @Get('trending')
  async getTrending(@Query('limit') limit: number = 10) {
    return this.recommendationsService.getTrendingProducts(limit);
  }

  @Post('track')
  @UseGuards(JwtAuthGuard)
  async track(
    @Request() req,
    @Body() body: {
      recommendationType: string;
      sourceProductId: string;
      recommendedProductId: string;
      logId?: string;
    },
  ) {
    await this.recommendationsService.trackRecommendation(
      req.user.id,
      req.sessionID,
      body.recommendationType,
      body.sourceProductId,
      body.recommendedProductId,
    );
    return { success: true };
  }

  @Post('track/:logId/click')
  async trackClick(@Param('logId') logId: string) {
    await this.recommendationsService.markClicked(logId);
    return { success: true };
  }

  @Post('track/:logId/purchase')
  async trackPurchase(@Param('logId') logId: string) {
    await this.recommendationsService.markPurchased(logId);
    return { success: true };
  }
}
