import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Variant } from './entities/variant.entity';
import { Brand } from './entities/brand.entity';
import { Category } from './entities/category.entity';
import { OlfactoryNote } from './entities/olfactory-note.entity';
import { ProductOlfactoryNote } from './entities/product-olfactory-note.entity';
import { Review } from './entities/review.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      Variant,
      Brand,
      Category,
      OlfactoryNote,
      ProductOlfactoryNote,
      Review,
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
