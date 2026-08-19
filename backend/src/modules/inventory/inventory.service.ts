import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inventory } from './entities/inventory.entity';

const RESERVATION_TTL = 900; // 15 minutos em segundos
const LOCK_TIMEOUT = 5000; // 5 segundos timeout para lock

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Reserva estoque para um item no carrinho com lock distribuído via Redis.
   * Usa optimistic locking com Redis SETNX para evitar condição de corrida.
   */
  async reserveStock(
    variantId: string,
    quantity: number,
    userId: string,
  ): Promise<{ success: boolean; reservedUntil: Date }> {
    const lockKey = `lock:inventory:${variantId}`;
    const reservationKey = `reservation:${userId}:${variantId}`;

    // Verificar se já existe reserva ativa
    const existingReservation = await this.redis.get(reservationKey);
    if (existingReservation) {
      const reservation = JSON.parse(existingReservation);
      return {
        success: true,
        reservedUntil: new Date(reservation.reservedUntil),
      };
    }

    // Adquirir lock distribuído
    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      throw new ConflictException(
        'Estoque sendo processado por outro usuário. Tente novamente.',
      );
    }

    try {
      // Usar transação SQL com SELECT FOR UPDATE para garantir consistência
      const result = await this.dataSource.transaction(async (manager) => {
        const inventory = await manager
          .createQueryBuilder(Inventory, 'inv')
          .setLock('pessimistic_write')
          .where('inv.variant_id = :variantId', { variantId })
          .getOne();

        if (!inventory) {
          throw new BadRequestException('Variante de produto não encontrada.');
        }

        const available = inventory.quantity - inventory.reserved;
        if (available < quantity) {
          throw new BadRequestException(
            `Estoque insuficiente. Disponível: ${available} unidades.`,
          );
        }

        // Reservar estoque
        inventory.reserved += quantity;
        await manager.save(inventory);

        return inventory;
      });

      // Criar reserva no Redis com TTL de 15 minutos
      const reservedUntil = new Date(Date.now() + RESERVATION_TTL * 1000);
      await this.redis.setex(
        reservationKey,
        RESERVATION_TTL,
        JSON.stringify({
          variantId,
          quantity,
          reservedUntil: reservedUntil.toISOString(),
        }),
      );

      // Registrar no Redis para liberação automática via expiração
      await this.redis.setex(
        `reservation:ttl:${userId}:${variantId}`,
        RESERVATION_TTL,
        'pending',
      );

      this.logger.log(
        `Estoque reservado: ${quantity}x variante ${variantId} para usuário ${userId}`,
      );

      return { success: true, reservedUntil };
    } catch (error) {
      this.logger.error(`Falha ao reservar estoque: ${error.message}`);
      throw error;
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Libera a reserva de estoque quando o usuário remove item do carrinho.
   */
  async releaseReservation(
    variantId: string,
    quantity: number,
    userId: string,
  ): Promise<void> {
    const lockKey = `lock:inventory:${variantId}`;
    const reservationKey = `reservation:${userId}:${variantId}`;

    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      this.logger.warn(
        `Não foi possível adquirir lock para liberar reserva: ${variantId}`,
      );
      return;
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .update(Inventory)
          .set({ reserved: () => `GREATEST(reserved - ${quantity}, 0)` })
          .where('variant_id = :variantId', { variantId })
          .execute();
      });

      await this.redis.del(reservationKey);
      await this.redis.del(`reservation:ttl:${userId}:${variantId}`);

      this.logger.log(
        `Reserva liberada: ${quantity}x variante ${variantId} do usuário ${userId}`,
      );
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Confirma a reserva (converte reserva em venda) - chamado ao finalizar pedido.
   */
  async confirmReservation(
    variantId: string,
    quantity: number,
    userId: string,
  ): Promise<void> {
    const lockKey = `lock:inventory:${variantId}`;

    const lockAcquired = await this.acquireLock(lockKey);
    if (!lockAcquired) {
      throw new ConflictException(
        'Estoque sendo processado. Tente novamente.',
      );
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const inventory = await manager
          .createQueryBuilder(Inventory, 'inv')
          .setLock('pessimistic_write')
          .where('inv.variant_id = :variantId', { variantId })
          .getOne();

        if (!inventory) {
          throw new BadRequestException('Inventário não encontrado.');
        }

        if (inventory.reserved < quantity) {
          throw new BadRequestException('Reserva de estoque insuficiente.');
        }

        inventory.quantity -= quantity;
        inventory.reserved -= quantity;
        await manager.save(inventory);
      });

      // Limpar chaves de reserva do Redis
      await this.redis.del(`reservation:${userId}:${variantId}`);
      await this.redis.del(`reservation:ttl:${userId}:${variantId}`);

      this.logger.log(
        `Reserva confirmada: ${quantity}x variante ${variantId} (estoque decrementado)`,
      );
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Libera reservas expiradas (chamada periodicamente via cron).
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseExpiredReservations(): Promise<void> {
    this.logger.debug('Verificando reservas expiradas...');

    const pattern = 'reservation:ttl:*:*';
    const keys = await this.redis.keys(pattern);

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl <= 0) {
        // Reserva expirou, liberar estoque
        const parts = key.split(':');
        const userId = parts[2];
        const variantId = parts[3];

        const reservationKey = `reservation:${userId}:${variantId}`;
        const reservationData = await this.redis.get(reservationKey);

        if (reservationData) {
          const { quantity } = JSON.parse(reservationData);
          await this.releaseReservation(variantId, quantity, userId);
          this.logger.log(
            `Reserva expirada liberada: ${quantity}x variante ${variantId}`,
          );
        }
      }
    }
  }

  /**
   * Obtém estoque disponível de uma variante.
   */
  async getAvailableStock(variantId: string): Promise<number> {
    const inventory = await this.inventoryRepo.findOne({
      where: { variantId },
    });
    if (!inventory) return 0;
    return inventory.quantity - inventory.reserved;
  }

  /**
   * Obtém estoque de múltiplas variantes.
   */
  async getBulkStock(variantIds: string[]): Promise<Map<string, number>> {
    const inventories = await this.inventoryRepo
      .createQueryBuilder('inv')
      .where('inv.variant_id IN (:...ids)', { ids: variantIds })
      .getMany();

    const stockMap = new Map<string, number>();
    for (const inv of inventories) {
      stockMap.set(inv.variantId, inv.quantity - inv.reserved);
    }
    return stockMap;
  }

  /**
   * Repõe estoque de uma variante.
   */
  async restock(
    variantId: string,
    quantity: number,
    batchNumber: string,
    fabricationDate: string,
    expirationDate: string,
  ): Promise<void> {
    await this.inventoryRepo
      .createQueryBuilder()
      .update(Inventory)
      .set({
        quantity: () => `quantity + ${quantity}`,
        batchNumber,
        fabricationDate,
        expirationDate,
        lastRestockAt: new Date(),
      })
      .where('variant_id = :variantId', { variantId })
      .execute();

    this.logger.log(
      `Estoque reposto: +${quantity} unidades da variante ${variantId}`,
    );
  }

  private async acquireLock(key: string): Promise<boolean> {
    const result = await this.redis.set(
      key,
      'locked',
      'PX',
      LOCK_TIMEOUT,
      'NX',
    );
    return result === 'OK';
  }

  private async releaseLock(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
