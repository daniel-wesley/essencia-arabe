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

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [newCursor, foundKeys] = await this.redis.scan(
        cursor, 'MATCH', pattern, 'COUNT', 100,
      );
      cursor = newCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');
    return keys;
  }

  async addItem(
    userId: string,
    variantId: string,
    quantity: number = 1,
  ): Promise<Cart> {
    const [variant, available] = await Promise.all([
      this.productsService.getVariantById(variantId),
      this.inventoryService.getAvailableStock(variantId),
    ]);

    if (!variant) {
      throw new NotFoundException('Variante de produto não encontrada.');
    }

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
      const [reservation, product] = await Promise.all([
        this.inventoryService.reserveStock(variantId, quantity, userId),
        this.productsService.getProductById(variant.productId),
      ]);

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
    const keys = await this.scanKeys(pattern);

    if (keys.length === 0) {
      return { items: [], subtotal: 0, itemCount: 0, updatedAt: new Date().toISOString() };
    }

    const values = await this.redis.mget(...keys);
    const items = values
      .filter((v): v is string => v !== null)
      .map(v => JSON.parse(v));

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
    const keys = await this.scanKeys(pattern);

    if (keys.length === 0) return;

    const reservationData = await Promise.all(
      keys.map(async (key) => {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      }),
    );

    await Promise.all(
      reservationData
        .filter((r): r is CartItem => r !== null)
        .map(r => this.inventoryService.releaseReservation(r.variantId, r.quantity, userId)),
    );

    const pipeline = this.redis.pipeline();
    keys.forEach(key => pipeline.del(key));
    await pipeline.exec();
  }

  async getCartItemCount(userId: string): Promise<number> {
    const cart = await this.getCart(userId);
    return cart.itemCount;
  }
}
