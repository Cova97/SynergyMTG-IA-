import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthenticatedRequest extends Request {
  user?: { sub: string; username: string };
}

/**
 * Aun NO esta conectado a ninguna ruta — se deja listo para cuando se
 * decida proteger /collection, /decks, /analysis con @UseGuards(JwtAuthGuard).
 * Al conectarlo, cada controller dejaria de recibir :userId por la URL
 * y lo tomaria de request.user.username en su lugar.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token de autenticacion');
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      request.user = this.jwtService.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }
}