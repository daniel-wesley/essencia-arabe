import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CartService, Cart } from './cart.service';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Request() req): Promise<Cart> {
    return this.cartService.getCart(req.user.id);
  }

  @Post('items')
  async addItem(
    @Request() req,
    @Body() body: { variantId: string; quantity?: number },
  ): Promise<Cart> {
    return this.cartService.addItem(
      req.user.id,
      body.variantId,
      body.quantity || 1,
    );
  }

  @Post('items/:variantId')
  async updateItemQuantity(
    @Request() req,
    @Param('variantId') variantId: string,
    @Body() body: { quantity: number },
  ): Promise<Cart> {
    return this.cartService.updateItemQuantity(
      req.user.id,
      variantId,
      body.quantity,
    );
  }

  @Post('items/:variantId/remove')
  @HttpCode(HttpStatus.OK)
  async removeItem(
    @Request() req,
    @Param('variantId') variantId: string,
  ): Promise<Cart> {
    return this.cartService.removeItem(req.user.id, variantId);
  }

  @Post('clear')
  @HttpCode(HttpStatus.OK)
  async clearCart(@Request() req): Promise<void> {
    return this.cartService.clearCart(req.user.id);
  }
}
