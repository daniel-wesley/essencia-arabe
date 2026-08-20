import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Coupon } from './entities/coupon.entity';
import { CartService, CartItem } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';

export interface CreateOrderDto {
  userId: string;
  shippingAddressId: string;
  paymentMethod: 'pix' | 'credit_card' | 'boleto';
  couponCode?: string;
  loyaltyPointsToUse?: number;
  notes?: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    private readonly cartService: CartService,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    const cart = await this.cartService.getCart(dto.userId);

    if (cart.items.length === 0) {
      throw new BadRequestException('Carrinho vazio.');
    }

    // Validar cupom
    let discount = 0;
    let couponId: string | null = null;
    if (dto.couponCode) {
      const coupon = await this.validateCoupon(dto.couponCode, cart.subtotal);
      discount = this.calculateDiscount(coupon, cart.subtotal);
      couponId = coupon.id;
    }

    // Calcular frete (simplificado - integração real com API dos Correios)
    const shippingCost = this.calculateShipping(cart.items);

    // Calcular pontos de fidelidade
    let pointsToUse = dto.loyaltyPointsToUse || 0;
    const pointsDiscount = pointsToUse * 0.01; // 1 ponto = R$ 0,01
    discount += pointsDiscount;

    const total = Math.max(cart.subtotal - discount + shippingCost, 0);

    // Criar pedido em transação
    const order = await this.dataSource.transaction(async (manager) => {
      // Criar pedido
      const order = manager.create(Order, {
        userId: dto.userId,
        subtotal: cart.subtotal,
        discount,
        shippingCost,
        total,
        couponId,
        shippingAddressId: dto.shippingAddressId,
        paymentMethod: dto.paymentMethod,
        loyaltyPointsUsed: pointsToUse,
        loyaltyPointsEarned: Math.floor(total * 0.1), // 10% do valor em pontos
        notes: dto.notes,
      });
      await manager.save(order);

      // Criar itens do pedido
      for (const item of cart.items) {
        const orderItem = manager.create(OrderItem, {
          orderId: order.id,
          variantId: item.variantId,
          productName: item.productName,
          variantSku: item.sku,
          sizeMl: item.sizeMl,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          totalPrice: item.unitPrice * item.quantity,
        });
        await manager.save(orderItem);

        // Confirmar reserva de estoque (decrementar estoque real)
        await this.inventoryService.confirmReservation(
          item.variantId,
          item.quantity,
          dto.userId,
        );
      }

      // Atualizar uso do cupom
      if (couponId) {
        await manager
          .createQueryBuilder()
          .update(Coupon)
          .set({ currentUses: () => 'current_uses + 1' })
          .where('id = :id', { id: couponId })
          .execute();
      }

      // Atualizar pontos de fidelidade do usuário
      if (pointsToUse > 0 || order.loyaltyPointsEarned > 0) {
        await manager
          .createQueryBuilder()
          .update('users')
          .set({
            loyaltyPoints: () =>
              `loyalty_points - ${pointsToUse} + ${order.loyaltyPointsEarned}`,
          })
          .where('id = :id', { id: dto.userId })
          .execute();
      }

      return order;
    });

    // Limpar carrinho
    await this.cartService.clearCart(dto.userId);

    this.logger.log(`Pedido criado: ${order.id} - Total: R$ ${order.total}`);

    return this.findById(order.id);
  }

  async findById(id: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items', 'items.variant', 'shippingAddress', 'coupon'],
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado.');
    }

    return order;
  }

  async findByUser(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Order[]; total: number }> {
    const [data, total] = await this.orderRepo.findAndCount({
      where: { userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async updateStatus(orderId: string, status: string): Promise<Order> {
    const order = await this.findById(orderId);

    const validTransitions: Record<string, string[]> = {
      pending: ['approved', 'cancelled'],
      approved: ['processing', 'cancelled'],
      processing: ['separating'],
      separating: ['shipped'],
      shipped: ['delivered'],
      delivered: ['refunded'],
    };

    if (!validTransitions[order.status]?.includes(status)) {
      throw new BadRequestException(
        `Transição de status inválida: ${order.status} -> ${status}`,
      );
    }

    await this.orderRepo.update(orderId, {
      status,
      ...(status === 'shipped' && { shippedAt: new Date() }),
      ...(status === 'delivered' && { deliveredAt: new Date() }),
    });

    return this.findById(orderId);
  }

  async cancelOrder(orderId: string, userId: string): Promise<Order> {
    const order = await this.findById(orderId);

    if (order.userId !== userId) {
      throw new BadRequestException('Não autorizado.');
    }

    if (!['pending', 'approved'].includes(order.status)) {
      throw new BadRequestException(
        'Pedido não pode ser cancelado neste status.',
      );
    }

    // Liberar estoque
    for (const item of order.items) {
      await this.inventoryService.releaseReservation(
        item.variantId,
        item.quantity,
        userId,
      );
    }

    // Estornar pontos de fidelidade
    if (order.loyaltyPointsUsed > 0) {
      await this.dataSource
        .createQueryBuilder()
        .update('users')
        .set({
          loyaltyPoints: () => `loyalty_points + ${order.loyaltyPointsUsed}`,
        })
        .where('id = :id', { id: userId })
        .execute();
    }

    return this.updateStatus(orderId, 'cancelled');
  }

  private async validateCoupon(code: string, orderValue: number): Promise<Coupon> {
    const coupon = await this.couponRepo.findOne({
      where: { code, isActive: true },
    });

    if (!coupon) {
      throw new BadRequestException('Cupom inválido.');
    }

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new BadRequestException('Cupom expirado.');
    }

    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      throw new BadRequestException('Cupom atingiu limite de uso.');
    }

    if (orderValue < coupon.minOrderValue) {
      throw new BadRequestException(
        `Pedido mínimo para este cupom: R$ ${coupon.minOrderValue}`,
      );
    }

    return coupon;
  }

  private calculateDiscount(coupon: Coupon, subtotal: number): number {
    if (coupon.discountType === 'percentage') {
      return subtotal * (coupon.discountValue / 100);
    }
    return Math.min(coupon.discountValue, subtotal);
  }

  private calculateShipping(items: CartItem[]): number {
    // Simples: frete fixo baseado na quantidade de itens
    const baseShipping = 15.0;
    const perItemShipping = 5.0;
    return baseShipping + items.length * perItemShipping;
  }
}
