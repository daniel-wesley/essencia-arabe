import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@Request() req) {
    return this.usersService.findById(req.user.id);
  }

  @Patch('me')
  async updateProfile(@Request() req, @Body() data: any) {
    return this.usersService.update(req.user.id, data);
  }

  @Get('me/addresses')
  async getAddresses(@Request() req) {
    return this.usersService.getAddresses(req.user.id);
  }

  @Post('me/addresses')
  async addAddress(@Request() req, @Body() addressData: any) {
    return this.usersService.addAddress(req.user.id, addressData);
  }

  @Delete('me/addresses/:addressId')
  async deleteAddress(
    @Request() req,
    @Param('addressId') addressId: string,
  ) {
    return this.usersService.deleteAddress(req.user.id, addressId);
  }
}
