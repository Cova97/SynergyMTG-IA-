import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthenticatedRequest extends Request {
  user?: { sub: string; username: string };
}

/**
 * Protege una ruta exigiendo un JWT valido en el header Authorization
 * (Bearer <token>). Al pasar, deja el payload decodificado en
 * request.user — se lee comodamente con el decorador @CurrentUser().
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