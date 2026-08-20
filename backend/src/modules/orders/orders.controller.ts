import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService, CreateOrderDto } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(@Request() req, @Body() dto: Omit<CreateOrderDto, 'userId'>) {
    return this.ordersService.createOrder({
      ...dto,
      userId: req.user.id,
    });
  }

  @Get()
  async findByUser(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.ordersService.findByUser(req.user.id, page, limit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Post(':id/cancel')
  async cancelOrder(@Request() req, @Param('id') id: string) {
    return this.ordersService.cancelOrder(id, req.user.id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.ordersService.updateStatus(id, status);
  }
}
