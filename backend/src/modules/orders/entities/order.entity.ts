import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { OrderItem } from './order-item.entity';
import { Coupon } from './coupon.entity';
import { Address } from '../../users/entities/address.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  shippingCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ nullable: true })
  couponId: string;

  @ManyToOne(() => Coupon, { nullable: true })
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon;

  @Column({ nullable: true })
  shippingAddressId: string;

  @ManyToOne(() => Address, { nullable: true })
  @JoinColumn({ name: 'shippingAddressId' })
  shippingAddress: Address;

  @Column({ type: 'varchar', length: 30, nullable: true })
  paymentMethod: string;

  @Column({ nullable: true })
  paymentId: string;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  paymentStatus: string;

  @Column({ nullable: true })
  trackingCode: string;

  @Column({ nullable: true })
  shippingProvider: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: 0 })
  loyaltyPointsUsed: number;

  @Column({ default: 0 })
  loyaltyPointsEarned: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  shippedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;
}
