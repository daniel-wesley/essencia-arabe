import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Brand } from './brand.entity';
import { Category } from './category.entity';
import { Variant } from './variant.entity';
import { ProductOlfactoryNote } from './product-olfactory-note.entity';
import { Review } from './review.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  brandId: string;

  @ManyToOne(() => Brand, (brand) => brand.products)
  @JoinColumn({ name: 'brandId' })
  brand: Brand;

  @Column({ nullable: true })
  categoryId: string;

  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  concentration: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  olfactoryFamily: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  intensity: string;

  @Column({ type: 'jsonb', default: '[]' })
  occasions: string[];

  @Column({ type: 'jsonb', default: '[]' })
  seasons: string[];

  @Column({ nullable: true })
  mainImageUrl: string;

  @Column({ nullable: true })
  video360Url: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  ratingAvg: number;

  @Column({ default: 0 })
  ratingCount: number;

  @OneToMany(() => Variant, (variant) => variant.product)
  variants: Variant[];

  @OneToMany(
    () => ProductOlfactoryNote,
    (pon) => pon.product,
  )
  olfactoryNotes: ProductOlfactoryNote[];

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
