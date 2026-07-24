import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Dev-only auth: every request is the single dev user.
 * Replace with a Supabase JWT guard when real auth lands — the
 * CurrentUser decorator and req.user shape stay the same.
 */
@Injectable()
export class DevUserGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    req.user = { id: 'dev-user' };
    return true;
  }
}
