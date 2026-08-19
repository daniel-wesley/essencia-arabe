import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';

@Entity('variants')
export class Variant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, (product) => product.variants)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ unique: true })
  sku: string;

  @Column()
  sizeMl: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  promotionalPrice: number;

  @Column({ nullable: true })
  barcode: string;

  @Column({ nullable: true })
  weightGrams: number;

  @Column({ default: true })
  isActive: boolean;

  @OneToOne(() => Inventory, (inventory) => inventory.variant)
  inventory: Inventory;

  @CreateDateColumn()
  createdAt: Date;
}
