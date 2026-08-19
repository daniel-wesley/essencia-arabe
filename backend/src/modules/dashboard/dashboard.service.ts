import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { Inventory } from '../inventory/entities/inventory.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
  ) {}

  async getMetrics() {
    const [totalOrders, totalRevenue, totalUsers, lowStockProducts] =
      await Promise.all([
        this.orderRepo.count({ where: { status: 'delivered' } }),
        this.orderRepo
          .createQueryBuilder('o')
          .select('SUM(o.total)', 'total')
          .where('o.status IN (:...statuses)', {
            statuses: ['approved', 'processing', 'separating', 'shipped', 'delivered'],
          })
          .getRawOne(),
        this.userRepo.count(),
        this.inventoryRepo
          .createQueryBuilder('inv')
          .innerJoin('inv.variant', 'v')
          .innerJoin('v.product', 'p')
          .where('inv.quantity - inv.reserved <= inv.minStock')
          .getCount(),
      ]);

    const topProducts = await this.orderRepo
      .createQueryBuilder('o')
      .innerJoin('o.items', 'item')
      .select('item.productName', 'name')
      .addSelect('SUM(item.quantity)', 'totalSold')
      .addSelect('SUM(item.totalPrice)', 'totalRevenue')
      .where('o.status != :status', { status: 'cancelled' })
      .groupBy('item.productName')
      .orderBy('totalSold', 'DESC')
      .limit(10)
      .getRawMany();

    const recentOrders = await this.orderRepo
      .createQueryBuilder('o')
      .innerJoinAndSelect('o.user', 'user')
      .leftJoinAndSelect('o.items', 'items')
      .orderBy('o.createdAt', 'DESC')
      .take(5)
      .getMany();

    return {
      summary: {
        totalOrders,
        totalRevenue: parseFloat(totalRevenue?.total || '0'),
        totalUsers,
        lowStockProducts,
        averageTicket:
          totalOrders > 0
            ? parseFloat(totalRevenue?.total || '0') / totalOrders
            : 0,
      },
      topProducts,
      recentOrders,
    };
  }

  async getLowStockProducts() {
    return this.inventoryRepo
      .createQueryBuilder('inv')
      .innerJoinAndSelect('inv.variant', 'variant')
      .innerJoinAndSelect('variant.product', 'product')
      .innerJoinAndSelect('product.brand', 'brand')
      .where('inv.quantity - inv.reserved <= inv.minStock')
      .orderBy('inv.quantity', 'ASC')
      .getMany();
  }
}
