import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';

/** المستخدم الحالي كما يُحقن من JwtStrategy. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  departmentId: string | null;
  branchId: string | null;
}

export const ROLES_KEY = 'roles';
/** يقيّد المسار بأدوار محددة (يُطبَّق مع RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (user && (user.role === Role.ADMIN || roles.includes(user.role))) return true;
    throw new ForbiddenException('ليست لديك صلاحية لتنفيذ هذا الإجراء');
  }
}
