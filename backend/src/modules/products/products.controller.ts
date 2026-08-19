import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ProductsService, ProductFilters } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@Query() filters: ProductFilters) {
    return this.productsService.findAll(filters);
  }

  @Get('brands')
  async getBrands() {
    return this.productsService.getBrands();
  }

  @Get('categories')
  async getCategories() {
    return this.productsService.getCategories();
  }

  @Get('notes')
  async getOlfactoryNotes() {
    return this.productsService.getOlfactoryNotes();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}
