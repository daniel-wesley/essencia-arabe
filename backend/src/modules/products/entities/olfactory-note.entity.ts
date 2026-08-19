import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('olfactory_notes')
export class OlfactoryNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 20 })
  type: string; // topo, coracao, fundo

  @Column({ nullable: true })
  family: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', default: '[]' })
  synonyms: string[];
}
