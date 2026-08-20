import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_preferences')
export class UserPreferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'jsonb', default: '[]' })
  preferredFamilies: string[];

  @Column({ type: 'jsonb', default: '[]' })
  preferredOccasions: string[];

  @Column({ type: 'jsonb', default: '[]' })
  preferredSeasons: string[];

  @Column({ type: 'jsonb', default: '[]' })
  preferredConcentrations: string[];

  @Column({ type: 'jsonb', default: '[]' })
  dislikedIngredients: string[];

  @Column({ type: 'jsonb', default: '[]' })
  preferredBrands: string[];

  @UpdateDateColumn()
  updatedAt: Date;
}
