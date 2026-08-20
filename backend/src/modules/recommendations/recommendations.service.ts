import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Product } from '../products/entities/product.entity';
import { RecommendationsLog } from './entities/recommendations-log.entity';
import { UserPreferences } from './entities/user-preferences.entity';

interface RecommendationResult {
  productId: string;
  score: number;
  reason: string;
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(RecommendationsLog)
    private readonly logRepo: Repository<RecommendationsLog>,
    @InjectRepository(UserPreferences)
    private readonly prefsRepo: Repository<UserPreferences>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async getPersonalizedRecommendations(
    userId: string,
    limit: number = 10,
  ): Promise<RecommendationResult[]> {
    const cacheKey = `recommendations:personalized:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [profileResults, collaborativeResults] = await Promise.all([
      this.getProfileBasedRecommendations(userId, limit),
      this.getCollaborativeRecommendations(userId, limit),
    ]);

    const merged = this.mergeAndScore(profileResults, collaborativeResults, limit);

    const results = await Promise.all(
      merged.map(async (r) => ({
        ...r,
        product: await this.productRepo.findOne({
          where: { id: r.productId, isActive: true },
        }),
      })),
    );

    const filtered = results.filter((r) => r.product).map(({ product, ...rest }) => rest);

    await this.redis.setex(cacheKey, 1800, JSON.stringify(filtered));
    return filtered;
  }

  private async getProfileBasedRecommendations(
    userId: string,
    limit: number,
  ): Promise<RecommendationResult[]> {
    const prefs = await this.prefsRepo.findOne({ where: { userId } });
    if (!prefs) return [];

    const query = this.productRepo.createQueryBuilder('p').where('p.isActive = true');

    if (prefs.preferredFamilies?.length > 0) {
      query.andWhere('p.olfactoryFamily IN (:...families)', {
        families: prefs.preferredFamilies,
      });
    }

    if (prefs.preferredSeasons?.length > 0) {
      query.andWhere('p.seasons ?| ARRAY[:...seasons]', {
        seasons: prefs.preferredSeasons,
      });
    }

    if (prefs.preferredConcentrations?.length > 0) {
      query.andWhere('p.concentration IN (:...concentrations)', {
        concentrations: prefs.preferredConcentrations,
      });
    }

    const products = await query.take(limit * 2).getMany();

    return products.map((p) => ({
      productId: p.id,
      score: this.calculateProfileScore(p, prefs),
      reason: 'based_on_profile',
    }));
  }

  private calculateProfileScore(product: Product, prefs: any): number {
    let score = 0;

    if (prefs.preferredFamilies?.includes(product.olfactoryFamily)) score += 0.4;
    if (prefs.preferredConcentrations?.includes(product.concentration)) score += 0.2;
    if (prefs.preferredSeasons?.some((s) => product.seasons?.includes(s))) score += 0.2;
    if (prefs.preferredBrands?.includes(product.brandId)) score += 0.1;
    score += product.ratingAvg / 5 * 0.1;

    return Math.min(score, 1);
  }

  private async getCollaborativeRecommendations(
    userId: string,
    limit: number,
  ): Promise<RecommendationResult[]> {
    const purchasedProductIds = await this.logRepo
      .createQueryBuilder('log')
      .select('log.sourceProductId')
      .where('log.userId = :userId AND log.wasPurchased = true', { userId })
      .getMany();

    if (purchasedProductIds.length === 0) return [];

    const sourceIds = purchasedProductIds.map((p) => p.sourceProductId);

    const coPurchased = await this.logRepo
      .createQueryBuilder('log')
      .select('log.recommendedProductId', 'productId')
      .addSelect('COUNT(*)', 'count')
      .where('log.sourceProductId IN (:...sourceIds)', { sourceIds })
      .andWhere('log.wasPurchased = true')
      .andWhere('log.recommendedProductId NOT IN (:...sourceIds)', { sourceIds })
      .groupBy('log.recommendedProductId')
      .orderBy('count', 'DESC')
      .take(limit)
      .getRawMany();

    const maxCount = Math.max(...coPurchased.map((c) => parseInt(c.count)), 1);

    return coPurchased.map((cp) => ({
      productId: cp.productId,
      score: parseInt(cp.count) / maxCount,
      reason: 'collaborative_filtering',
    }));
  }

  private mergeAndScore(
    profile: RecommendationResult[],
    collaborative: RecommendationResult[],
    limit: number,
  ): RecommendationResult[] {
    const scoreMap = new Map<string, RecommendationResult>();

    for (const rec of profile) {
      const existing = scoreMap.get(rec.productId);
      const newScore = existing
        ? existing.score * 0.6 + rec.score * 0.4
        : rec.score * 0.6;
      scoreMap.set(rec.productId, { ...rec, score: newScore });
    }

    for (const rec of collaborative) {
      const existing = scoreMap.get(rec.productId);
      const newScore = existing
        ? existing.score * 0.6 + rec.score * 0.4
        : rec.score * 0.4;
      scoreMap.set(rec.productId, { ...rec, score: newScore });
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getComplementaryRecommendations(
    productId: string,
    limit: number = 5,
  ): Promise<RecommendationResult[]> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['brand', 'category'],
    });
    if (!product) return [];

    const complementary = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.brand', 'brand')
      .where('p.isActive = true')
      .andWhere('p.id != :productId', { productId })
      .andWhere(
        `(p.olfactoryFamily = :family OR p.brandId = :brandId)`,
        { family: product.olfactoryFamily, brandId: product.brandId },
      )
      .take(limit)
      .getMany();

    return complementary.map((p) => ({
      productId: p.id,
      score: p.brandId === product.brandId ? 0.8 : 0.5,
      reason: 'complementary',
    }));
  }

  async trackRecommendation(
    userId: string | null,
    sessionId: string,
    recommendationType: string,
    sourceProductId: string,
    recommendedProductId: string,
  ): Promise<void> {
    const log = this.logRepo.create({
      userId,
      sessionId,
      recommendationType,
      sourceProductId,
      recommendedProductId,
    });
    await this.logRepo.save(log);
  }

  async markClicked(logId: string): Promise<void> {
    await this.logRepo.update(logId, { wasClicked: true });
  }

  async markPurchased(logId: string): Promise<void> {
    await this.logRepo.update(logId, { wasPurchased: true });
  }

  async getTrendingProducts(limit: number = 10): Promise<string[]> {
    const cached = await this.redis.get('recommendations:trending');
    if (cached) return JSON.parse(cached);

    const trending = await this.logRepo
      .createQueryBuilder('log')
      .select('log.recommendedProductId', 'productId')
      .addSelect('COUNT(*)', 'count')
      .where('log.wasPurchased = true')
      .andWhere('log.createdAt > NOW() - INTERVAL \'30 days\'')
      .groupBy('log.recommendedProductId')
      .orderBy('count', 'DESC')
      .take(limit)
      .getRawMany();

    const ids = trending.map((t) => t.productId);
    await this.redis.setex('recommendations:trending', 3600, JSON.stringify(ids));
    return ids;
  }
}
