import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from './product.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, (product) => product.reviews)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.reviews)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  rating: number;

  @Column({ nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ nullable: true })
  longevityRating: number;

  @Column({ nullable: true })
  sillageRating: number;

  @Column({ default: false })
  isVerifiedPurchase: boolean;

  @Column({ default: false })
  isApproved: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
