import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';

export interface RegisterDto {
  email: string;
  password: string;
  fullName: string;
  cpf?: string;
  phone?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    loyaltyPoints: number;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email já cadastrado.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.userRepo.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      cpf: dto.cpf,
      phone: dto.phone,
    });

    await this.userRepo.save(user);

    return this.generateToken(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return this.generateToken(user);
  }

  async validateUser(userId: string): Promise<User> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  private generateToken(user: User): AuthResponse {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
      },
    };
  }
}
