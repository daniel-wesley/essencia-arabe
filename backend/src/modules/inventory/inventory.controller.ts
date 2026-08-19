import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock/:variantId')
  async getStock(@Param('variantId') variantId: string) {
    const available = await this.inventoryService.getAvailableStock(variantId);
    return { variantId, available };
  }

  @Get('stock/bulk')
  async getBulkStock(@Query('ids') ids: string) {
    const variantIds = ids.split(',');
    const stockMap = await this.inventoryService.getBulkStock(variantIds);
    return Object.fromEntries(stockMap);
  }
}
