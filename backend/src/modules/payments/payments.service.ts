import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface PaymentData {
  orderId: string;
  amount: number;
  method: 'pix' | 'credit_card' | 'boleto';
  description: string;
  customer: {
    name: string;
    email: string;
    cpf?: string;
  };
  card?: {
    number: string;
    holderName: string;
    expirationMonth: string;
    expirationYear: string;
    cvv: string;
    installments: number;
  };
}

export interface PaymentResult {
  id: string;
  status: string;
  qrCode?: string;
  pixCopyPaste?: string;
  boletoUrl?: string;
  installments?: number;
  totalAmount?: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly gatewayUrl =
    process.env.PAYMENT_GATEWAY_URL || 'https://api.mercadopago.com/v1';

  async processPayment(data: PaymentData): Promise<PaymentResult> {
    this.logger.log(
      `Processando pagamento: Pedido #${data.orderId} - R$ ${data.amount}`,
    );

    switch (data.method) {
      case 'pix':
        return this.processPixPayment(data);
      case 'credit_card':
        return this.processCreditCardPayment(data);
      case 'boleto':
        return this.processBoletoPayment(data);
      default:
        throw new Error(`Método de pagamento não suportado: ${data.method}`);
    }
  }

  private async processPixPayment(data: PaymentData): Promise<PaymentResult> {
    // Simulação - integração real com gateway
    // Em produção, faria POST para API do Mercado Pago/PagSeguro
    this.logger.log('Gerando QR Code PIX...');

    return {
      id: `pix_${data.orderId}_${Date.now()}`,
      status: 'pending',
      qrCode: `00020126580014br.gov.bcb.pix0136${data.orderId}520400005303986540${data.amount.toFixed(2)}5802BR5913JANILLY6009SAO PAULO62070503***6304`,
      pixCopyPaste: `00020126580014br.gov.bcb.pix0136${data.orderId}520400005303986540${data.amount.toFixed(2)}5802BR5913JANILLY6009SAO PAULO62070503***6304`,
    };
  }

  private async processCreditCardPayment(
    data: PaymentData,
  ): Promise<PaymentResult> {
    this.logger.log(
      `Processando cartão de crédito: ${data.card?.installments}x`,
    );

    // Simulação - integração real
    return {
      id: `cc_${data.orderId}_${Date.now()}`,
      status: 'approved',
      installments: data.card?.installments || 1,
      totalAmount: data.amount,
    };
  }

  private async processBoletoPayment(
    data: PaymentData,
  ): Promise<PaymentResult> {
    this.logger.log('Gerando boleto bancário...');

    return {
      id: `boleto_${data.orderId}_${Date.now()}`,
      status: 'pending',
      boletoUrl: `https://boleto.example.com/${data.orderId}`,
    };
  }

  async checkPaymentStatus(paymentId: string): Promise<string> {
    // Simulação - consulta status no gateway
    this.logger.log(`Verificando status do pagamento: ${paymentId}`);
    return 'approved';
  }

  async refundPayment(paymentId: string, amount: number): Promise<void> {
    this.logger.log(
      `Processando estorno: ${paymentId} - R$ ${amount}`,
    );
  }
}
