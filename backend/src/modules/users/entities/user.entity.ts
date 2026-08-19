import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Order } from '../../orders/entities/order.entity';
import { Review } from '../../products/entities/review.entity';
import { Address } from './address.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column()
  passwordHash: string;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  cpf: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'date', nullable: true })
  birthDate: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender: string;

  @Column({ type: 'varchar', length: 20, default: 'customer' })
  role: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ default: 0 })
  loyaltyPoints: number;

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Review, (review) => review.user)
  reviews: Review[];

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
