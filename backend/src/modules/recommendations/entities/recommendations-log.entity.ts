import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('recommendations_log')
export class RecommendationsLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  sessionId: string;

  @Column({ type: 'varchar', length: 30 })
  recommendationType: string; // profile, collaborative, complementary, trending, search

  @Column({ nullable: true })
  sourceProductId: string;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'sourceProductId' })
  sourceProduct: Product;

  @Column()
  recommendedProductId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'recommendedProductId' })
  recommendedProduct: Product;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  score: number;

  @Column({ default: false })
  wasClicked: boolean;

  @Column({ default: false })
  wasPurchased: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
