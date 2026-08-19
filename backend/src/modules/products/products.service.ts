import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Product } from './entities/product.entity';
import { Variant } from './entities/variant.entity';
import { Brand } from './entities/brand.entity';
import { Category } from './entities/category.entity';
import { OlfactoryNote } from './entities/olfactory-note.entity';

export interface ProductFilters {
  brand?: string[];
  olfactoryFamily?: string[];
  concentration?: string[];
  gender?: string[];
  occasions?: string[];
  seasons?: string[];
  intensity?: string[];
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Variant)
    private readonly variantRepo: Repository<Variant>,
    @InjectRepository(Brand)
    private readonly brandRepo: Repository<Brand>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(OlfactoryNote)
    private readonly noteRepo: Repository<OlfactoryNote>,
  ) {}

  async findAll(
    filters: ProductFilters,
  ): Promise<PaginatedResult<Product>> {
    const query = this.buildFilterQuery(filters);

    const page = filters.page || 1;
    const limit = filters.limit || 20;

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id, isActive: true },
      relations: [
        'brand',
        'category',
        'variants',
        'variants.inventory',
        'olfactoryNotes',
        'olfactoryNotes.note',
      ],
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }

    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { slug, isActive: true },
      relations: [
        'brand',
        'category',
        'variants',
        'variants.inventory',
        'olfactoryNotes',
        'olfactoryNotes.note',
      ],
    });

    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }

    return product;
  }

  async getVariantById(id: string): Promise<Variant> {
    return this.variantRepo.findOne({
      where: { id, isActive: true },
      relations: ['product', 'product.brand'],
    });
  }

  async getProductById(id: string): Promise<Product> {
    return this.productRepo.findOne({
      where: { id },
      relations: ['brand'],
    });
  }

  async getBrands(): Promise<Brand[]> {
    return this.brandRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getCategories(): Promise<Category[]> {
    return this.categoryRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
      relations: ['children'],
    });
  }

  async getOlfactoryNotes(): Promise<OlfactoryNote[]> {
    return this.noteRepo.find({
      order: { name: 'ASC' },
    });
  }

  private buildFilterQuery(
    filters: ProductFilters,
  ): SelectQueryBuilder<Product> {
    const query = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.variants', 'variants')
      .where('p.isActive = true');

    if (filters.search) {
      // Busca textual com suporte a sinônimos
      query.andWhere(
        `(p.name ILIKE :search OR brand.name ILIKE :search OR p.description ILIKE :search)`,
        { search: `%${filters.search}%` },
      );
    }

    if (filters.brand?.length > 0) {
      query.andWhere('brand.slug IN (:...brand)', { brand: filters.brand });
    }

    if (filters.olfactoryFamily?.length > 0) {
      query.andWhere('p.olfactoryFamily IN (:...family)', {
        family: filters.olfactoryFamily,
      });
    }

    if (filters.concentration?.length > 0) {
      query.andWhere('p.concentration IN (:...concentration)', {
        concentration: filters.concentration,
      });
    }

    if (filters.gender?.length > 0) {
      query.andWhere('p.gender IN (:...gender)', { gender: filters.gender });
    }

    if (filters.occasions?.length > 0) {
      query.andWhere('p.occasions ?| ARRAY[:...occasions]', {
        occasions: filters.occasions,
      });
    }

    if (filters.seasons?.length > 0) {
      query.andWhere('p.seasons ?| ARRAY[:...seasons]', {
        seasons: filters.seasons,
      });
    }

    if (filters.intensity?.length > 0) {
      query.andWhere('p.intensity IN (:...intensity)', {
        intensity: filters.intensity,
      });
    }

    if (filters.minPrice !== undefined) {
      query.andWhere(
        'EXISTS (SELECT 1 FROM variants v WHERE v.productId = p.id AND v.price >= :minPrice)',
        { minPrice: filters.minPrice },
      );
    }

    if (filters.maxPrice !== undefined) {
      query.andWhere(
        'EXISTS (SELECT 1 FROM variants v WHERE v.productId = p.id AND v.price <= :maxPrice)',
        { maxPrice: filters.maxPrice },
      );
    }

    // Sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    query.orderBy(`p.${sortBy}`, sortOrder);

    return query;
  }
}
