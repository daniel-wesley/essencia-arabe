import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Variant } from '../../products/entities/variant.entity';

@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  variantId: string;

  @OneToOne(() => Variant, (variant) => variant.inventory)
  @JoinColumn({ name: 'variantId' })
  variant: Variant;

  @Column({ default: 0 })
  quantity: number;

  @Column({ default: 0 })
  reserved: number;

  @Column({ default: 5 })
  minStock: number;

  @Column({ nullable: true })
  batchNumber: string;

  @Column({ type: 'date', nullable: true })
  fabricationDate: string;

  @Column({ type: 'date', nullable: true })
  expirationDate: string;

  @Column({ type: 'timestamp', nullable: true })
  lastRestockAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
