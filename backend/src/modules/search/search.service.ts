import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Product } from '../products/entities/product.entity';

export interface SearchResult {
  products: Product[];
  total: number;
  suggestions: string[];
  filters: {
    brands: string[];
    families: string[];
    concentrations: string[];
  };
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async search(
    query: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<SearchResult> {
    // Expandir query com sinônimos
    const expandedQuery = await this.expandWithSynonyms(query);

    // Buscar produtos com full-text search
    const [products, total] = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.variants', 'variants')
      .where('p.isActive = true')
      .andWhere(
        `(
          p.name ILIKE :query
          OR brand.name ILIKE :query
          OR p.description ILIKE :query
          OR p.olfactory_family ILIKE :query
          OR p.name ILIKE :expanded
          OR brand.name ILIKE :expanded
        )`,
        {
          query: `%${query}%`,
          expanded: `%${expandedQuery}%`,
        },
      )
      .orderBy('p.ratingAvg', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Gerar sugestões
    const suggestions = await this.getSuggestions(query);

    // Obter filtros disponíveis
    const filters = await this.getAvailableFilters(query);

    return {
      products,
      total,
      suggestions,
      filters,
    };
  }

  private async expandWithSynonyms(query: string): Promise<string> {
    const synonyms: Record<string, string[]> = {
      amadeirado: ['cedro', 'sândalo', 'vetiver', 'cedro', 'patchouli'],
      floral: ['rosa', 'jasmim', 'lírio', 'peônia', 'flor'],
      oriental: ['baunilha', 'âmbar', 'resina', 'benjoim'],
      citrico: ['limão', 'laranja', 'bergamota', 'grafinha'],
      aquatico: ['marinho', 'aqqua', 'fresco'],
      doce: ['baunilha', 'caramelo', 'chocolate', 'mel'],
      fresco: ['verde', 'aquático', 'cítrico'],
      masculino: ['homme', 'men', 'masculino'],
      feminino: ['femme', 'women', 'feminino'],
    };

    const lowerQuery = query.toLowerCase();
    const expandedTerms: string[] = [];

    for (const [key, syns] of Object.entries(synonyms)) {
      if (lowerQuery.includes(key)) {
        expandedTerms.push(...syns);
      }
    }

    return expandedTerms.length > 0 ? expandedTerms.join(' | ') : query;
  }

  private async getSuggestions(query: string): Promise<string[]> {
    const cacheKey = `search:suggestions:${query}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const suggestions = await this.productRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.name')
      .where('p.name ILIKE :query', { query: `${query}%` })
      .take(5)
      .getMany();

    const result = suggestions.map((s) => s.name);
    await this.redis.setex(cacheKey, 300, JSON.stringify(result));
    return result;
  }

  private async getAvailableFilters(
    query: string,
  ): Promise<{ brands: string[]; families: string[]; concentrations: string[] }> {
    const cacheKey = `search:filters:${query}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const brands = await this.productRepo
      .createQueryBuilder('p')
      .leftJoin('p.brand', 'brand')
      .select('DISTINCT brand.name')
      .where('p.name ILIKE :query', { query: `%${query}%` })
      .getRawMany();

    const families = await this.productRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.olfactoryFamily')
      .where('p.name ILIKE :query', { query: `%${query}%` })
      .getRawMany();

    const concentrations = await this.productRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.concentration')
      .where('p.name ILIKE :query', { query: `%${query}%` })
      .getRawMany();

    const result = {
      brands: brands.map((b) => b.brand_name).filter(Boolean),
      families: families.map((f) => f.olfactoryFamily).filter(Boolean),
      concentrations: concentrations.map((c) => c.concentration).filter(Boolean),
    };

    await this.redis.setex(cacheKey, 300, JSON.stringify(result));
    return result;
  }
}
