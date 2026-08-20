import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('email')
    private readonly emailQueue: Queue,
    @InjectQueue('invoice')
    private readonly invoiceQueue: Queue,
  ) {}

  async sendOrderConfirmation(order: any): Promise<void> {
    await this.emailQueue.add('order-confirmation', {
      to: order.user.email,
      subject: `Pedido #${order.id} Confirmado!`,
      template: 'order-confirmation',
      data: {
        userName: order.user.fullName,
        orderId: order.id,
        total: order.total,
        items: order.items,
      },
    });
    this.logger.log(`Email de confirmação agendado para ${order.user.email}`);
  }

  async sendShippingUpdate(order: any): Promise<void> {
    await this.emailQueue.add('shipping-update', {
      to: order.user.email,
      subject: `Pedido #${order.id} Enviado!`,
      template: 'shipping-update',
      data: {
        userName: order.user.fullName,
        orderId: order.id,
        trackingCode: order.trackingCode,
        shippingProvider: order.shippingProvider,
      },
    });
  }

  async generateInvoice(order: any): Promise<void> {
    await this.invoiceQueue.add('generate-invoice', {
      orderId: order.id,
      customerData: {
        name: order.user.fullName,
        cpf: order.user.cpf,
        address: order.shippingAddress,
      },
      items: order.items,
      total: order.total,
    });
  }
}
