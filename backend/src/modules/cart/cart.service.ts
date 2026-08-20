import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';

const CART_TTL = 900; // 15 minutos

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  brandName: string;
  sizeMl: number;
  sku: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string;
  reservedUntil: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  updatedAt: string;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectRedis()
    private readonly redis: Redis,
    private readonly inventoryService: InventoryService,
    private readonly productsService: ProductsService,
  ) {}

  private getCartKey(userId: string): string {
    return `cart:${userId}`;
  }

  private getItemKey(userId: string, variantId: string): string {
    return `cart:${userId}:${variantId}`;
  }

  async addItem(
    userId: string,
    variantId: string,
    quantity: number = 1,
  ): Promise<Cart> {
    const variant = await this.productsService.getVariantById(variantId);
    if (!variant) {
      throw new NotFoundException('Variante de produto não encontrada.');
    }

    const available = await this.inventoryService.getAvailableStock(variantId);
    if (available < quantity) {
      throw new BadRequestException(
        `Estoque insuficiente. Disponível: ${available}`,
      );
    }

    const existingItem = await this.redis.get(this.getItemKey(userId, variantId));
    if (existingItem) {
      const item: CartItem = JSON.parse(existingItem);
      const newQty = item.quantity + quantity;

      if (available < newQty) {
        throw new BadRequestException(
          `Estoque insuficiente para ${newQty} unidades. Disponível: ${available}`,
        );
      }

      item.quantity = newQty;
      await this.redis.setex(
        this.getItemKey(userId, variantId),
        CART_TTL,
        JSON.stringify(item),
      );
    } else {
      const reservation = await this.inventoryService.reserveStock(
        variantId,
        quantity,
        userId,
      );

      const product = await this.productsService.getProductById(variant.productId);
      const item: CartItem = {
        variantId,
        productId: variant.productId,
        productName: product.name,
        brandName: product.brand?.name || '',
        sizeMl: variant.sizeMl,
        sku: variant.sku,
        unitPrice: variant.promotionalPrice || variant.price,
        quantity,
        imageUrl: product.mainImageUrl,
        reservedUntil: reservation.reservedUntil.toISOString(),
      };

      await this.redis.setex(
        this.getItemKey(userId, variantId),
        CART_TTL,
        JSON.stringify(item),
      );
    }

    return this.getCart(userId);
  }

  async updateItemQuantity(
    userId: string,
    variantId: string,
    quantity: number,
  ): Promise<Cart> {
    if (quantity <= 0) {
      return this.removeItem(userId, variantId);
    }

    const itemData = await this.redis.get(this.getItemKey(userId, variantId));
    if (!itemData) {
      throw new NotFoundException('Item não encontrado no carrinho.');
    }

    const item: CartItem = JSON.parse(itemData);
    const diff = quantity - item.quantity;

    if (diff > 0) {
      const available = await this.inventoryService.getAvailableStock(variantId);
      if (available < diff) {
        throw new BadRequestException(
          `Estoque insuficiente. Disponível: ${available}`,
        );
      }
      await this.inventoryService.reserveStock(variantId, diff, userId);
    } else if (diff < 0) {
      await this.inventoryService.releaseReservation(
        variantId,
        Math.abs(diff),
        userId,
      );
    }

    item.quantity = quantity;
    await this.redis.setex(
      this.getItemKey(userId, variantId),
      CART_TTL,
      JSON.stringify(item),
    );

    return this.getCart(userId);
  }

  async removeItem(userId: string, variantId: string): Promise<Cart> {
    const itemData = await this.redis.get(this.getItemKey(userId, variantId));
    if (!itemData) {
      throw new NotFoundException('Item não encontrado no carrinho.');
    }

    const item: CartItem = JSON.parse(itemData);
    await this.inventoryService.releaseReservation(
      variantId,
      item.quantity,
      userId,
    );
    await this.redis.del(this.getItemKey(userId, variantId));

    return this.getCart(userId);
  }

  async getCart(userId: string): Promise<Cart> {
    const pattern = `cart:${userId}:*`;
    const keys = await this.redis.keys(pattern);

    const items: CartItem[] = [];
    for (const key of keys) {
      const itemData = await this.redis.get(key);
      if (itemData) {
        items.push(JSON.parse(itemData));
      }
    }

    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    return {
      items,
      subtotal,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      updatedAt: new Date().toISOString(),
    };
  }

  async clearCart(userId: string): Promise<void> {
    const pattern = `cart:${userId}:*`;
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      const itemData = await this.redis.get(key);
      if (itemData) {
        const item: CartItem = JSON.parse(itemData);
        await this.inventoryService.releaseReservation(
          item.variantId,
          item.quantity,
          userId,
        );
      }
      await this.redis.del(key);
    }
  }

  async getCartItemCount(userId: string): Promise<number> {
    const cart = await this.getCart(userId);
    return cart.itemCount;
  }
}
