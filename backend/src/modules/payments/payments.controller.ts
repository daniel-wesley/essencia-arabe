import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('process')
  async processPayment(
    @Body()
    body: {
      orderId: string;
      amount: number;
      method: 'pix' | 'credit_card' | 'boleto';
      card?: any;
    },
  ) {
    return this.paymentsService.processPayment({
      ...body,
      description: `Pedido Essencia Arabe #${body.orderId}`,
      customer: { name: '', email: '' }, // Preenchido pelo serviço
    });
  }

  @Get(':paymentId/status')
  async checkStatus(@Param('paymentId') paymentId: string) {
    const status = await this.paymentsService.checkPaymentStatus(paymentId);
    return { paymentId, status };
  }
}
