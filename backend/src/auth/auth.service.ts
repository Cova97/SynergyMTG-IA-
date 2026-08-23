import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 10;

export interface AuthResult {
  accessToken: string;
  username: string;
  displayName: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(displayName: string, password: string): Promise<AuthResult> {
    const username = await this.generateUniqueUsername(displayName);
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: { username, displayName, passwordHash },
    });

    return this.buildAuthResult(user.id, user.username, user.displayName);
  }

  async login(username: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    return this.buildAuthResult(user.id, user.username, user.displayName);
  }

  /**
   * Genera un username a partir del nombre (ej. "Aldo Cova" -> "aldo"):
   * primera palabra, en minusculas, sin acentos ni caracteres raros.
   * Si ya existe, le agrega un numero (aldo2, aldo3...) hasta
   * encontrar uno libre.
   */
  private async generateUniqueUsername(displayName: string): Promise<string> {
    const firstWord = displayName.trim().split(/\s+/)[0] ?? '';
    const base = firstWord
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quita acentos (á -> a)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''); // solo letras y numeros

    if (!base) {
      throw new ConflictException('No se pudo generar un nombre de usuario a partir de ese nombre');
    }

    let candidate = base;
    let suffix = 1;

    // Se checa contra la base de datos hasta encontrar uno libre —
    // con pocos usuarios esto es rapido, no hace falta optimizar mas.
    while (await this.prisma.user.findUnique({ where: { username: candidate } })) {
      suffix += 1;
      candidate = `${base}${suffix}`;
    }

    return candidate;
  }

  private buildAuthResult(userId: string, username: string, displayName: string): AuthResult {
    const accessToken = this.jwtService.sign({ sub: userId, username });
    return { accessToken, username, displayName };
  }
}