import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Module,
  Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';

export class CreateUserDto {
  @IsString() @Matches(/^[A-Za-z0-9._-]{1,32}$/, { message: 'رقم المستخدم: أحرف إنجليزية أو أرقام فقط (حتى 32)' }) username!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(3) fullName!: string;
  @IsString() @MinLength(8, { message: 'كلمة المرور 8 أحرف على الأقل' }) password!: string;
  @IsEnum(Role) role!: Role;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() branchId?: string;
}
export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(3) fullName?: string;
  @IsOptional() @IsString() @MinLength(8, { message: 'كلمة المرور 8 أحرف على الأقل' }) password?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
export class CreateBranchDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() city?: string;
}
export class CreateDepartmentDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() branchId!: string;
}

const USER_SELECT = {
  id: true, email: true, username: true, fullName: true, role: true, active: true, createdAt: true,
  department: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  users() {
    return this.prisma.user.findMany({ orderBy: [{ role: 'asc' }, { fullName: 'asc' }], select: USER_SELECT });
  }

  /** الموظف والمدير يلزمهما إدارة وفرع (والإدارة تتبع الفرع)، وأمين المستودع يلزمه فرع. */
  private async checkPlacement(role: Role, departmentId?: string | null, branchId?: string | null) {
    if (role === Role.ADMIN) return;
    if (!branchId) throw new BadRequestException('اختر الفرع');
    if (role === Role.WAREHOUSE_KEEPER) return;
    if (!departmentId) throw new BadRequestException('اختر الإدارة');
    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept || dept.branchId !== branchId) throw new BadRequestException('الإدارة المختارة لا تتبع هذا الفرع');
  }

  async createUser(dto: CreateUserDto) {
    await this.checkPlacement(dto.role, dto.departmentId, dto.branchId);
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('البريد الإلكتروني مستخدم');
    if (await this.prisma.user.findUnique({ where: { username: dto.username } })) throw new ConflictException('رقم المستخدم مستخدم');
    return this.prisma.user.create({
      data: {
        email, username: dto.username, fullName: dto.fullName, role: dto.role, passwordHash: await bcrypt.hash(dto.password, 10),
        departmentId: dto.role === Role.EMPLOYEE || dto.role === Role.DEPT_MANAGER ? dto.departmentId : null,
        branchId: dto.role === Role.ADMIN ? null : dto.branchId,
      },
      select: USER_SELECT,
    });
  }

  async updateUser(actor: AuthUser, id: string, dto: UpdateUserDto) {
    const cur = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (id === actor.id && (dto.active === false || (dto.role && dto.role !== Role.ADMIN))) {
      throw new ForbiddenException('لا يمكنك إيقاف حسابك أو خفض صلاحيتك');
    }
    const role = dto.role ?? cur.role;
    const branchId = dto.branchId ?? cur.branchId;
    const departmentId = dto.departmentId ?? cur.departmentId;
    await this.checkPlacement(role, departmentId, branchId);
    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName, active: dto.active, role,
        departmentId: role === Role.EMPLOYEE || role === Role.DEPT_MANAGER ? departmentId : null,
        branchId: role === Role.ADMIN ? null : branchId,
        ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
      },
      select: USER_SELECT,
    });
  }

  async createBranch(dto: CreateBranchDto) {
    if (await this.prisma.branch.findUnique({ where: { name: dto.name } })) throw new ConflictException('اسم الفرع مستخدم');
    return this.prisma.branch.create({ data: dto });
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const dup = await this.prisma.department.findUnique({ where: { branchId_name: { branchId: dto.branchId, name: dto.name } } });
    if (dup) throw new ConflictException('الإدارة موجودة في هذا الفرع');
    return this.prisma.department.create({ data: dto });
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService) {}
  @Get('users') users() { return this.svc.users(); }
  @Post('users') createUser(@Body() dto: CreateUserDto) { return this.svc.createUser(dto); }
  @Patch('users/:id') updateUser(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.svc.updateUser(u, id, dto);
  }
  @Post('branches') createBranch(@Body() dto: CreateBranchDto) { return this.svc.createBranch(dto); }
  @Post('departments') createDepartment(@Body() dto: CreateDepartmentDto) { return this.svc.createDepartment(dto); }
}

@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
