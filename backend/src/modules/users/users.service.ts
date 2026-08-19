import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['addresses'],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return user;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepo.update(id, data);
    return this.findById(id);
  }

  async addAddress(
    userId: string,
    addressData: Partial<Address>,
  ): Promise<Address> {
    const address = this.addressRepo.create({
      ...addressData,
      userId,
    });
    return this.addressRepo.save(address);
  }

  async getAddresses(userId: string): Promise<Address[]> {
    return this.addressRepo.find({ where: { userId } });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    await this.addressRepo.delete({ id: addressId, userId });
  }
}
