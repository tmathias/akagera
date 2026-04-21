import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkService } from './clerk.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => Reflect.metadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly clerk: ClerkService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const request = ctx.switchToHttp().getRequest();
    const authHeader: string = request.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) throw new UnauthorizedException('Missing bearer token');

    const payload = await this.clerk.verifyToken(token);
    const user = await this.clerk.resolveUser(payload.sub);

    // Attach user + tenantId to request for downstream use
    request.user = user;
    request.tenantId = user.tenantId;

    return true;
  }
}
