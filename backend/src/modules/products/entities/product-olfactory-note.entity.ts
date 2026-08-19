import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { OlfactoryNote } from './olfactory-note.entity';

@Entity('product_olfactory_notes')
export class ProductOlfactoryNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId: string;

  @ManyToOne(() => Product, (product) => product.olfactoryNotes)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  noteId: string;

  @ManyToOne(() => OlfactoryNote)
  @JoinColumn({ name: 'noteId' })
  note: OlfactoryNote;

  @Column({ type: 'varchar', length: 20 })
  noteType: string; // topo, coracao, fundo
}
