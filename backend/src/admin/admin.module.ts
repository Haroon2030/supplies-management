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
export class UpdateBranchDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() city?: string;
}
export class UpdateDepartmentDto {
  @IsString() @MinLength(2) name!: string;
}
export class CreateBranchDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() city?: string;
}
export class SectionDto {
  @IsString() @MinLength(2) name!: string;
}
export class CreateDepartmentDto {
  @IsString() @MinLength(2) name!: string;
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

  /** الموظف والمدير يلزمهما إدارة وفرع (مستقلان عن بعضهما)، وأمين المستودع يلزمه فرع. */
  private async checkPlacement(role: Role, departmentId?: string | null, branchId?: string | null) {
    if (role === Role.ADMIN) return;
    if (!branchId) throw new BadRequestException('اختر الفرع');
    if (role === Role.WAREHOUSE_KEEPER) return;
    if (!departmentId) throw new BadRequestException('اختر الإدارة');
    if (!(await this.prisma.department.findUnique({ where: { id: departmentId } }))) throw new BadRequestException('الإدارة غير موجودة');
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

  private async assertBranchFree(name?: string, code?: string | null, exceptId?: string) {
    if (name) {
      const d = await this.prisma.branch.findUnique({ where: { name } });
      if (d && d.id !== exceptId) throw new ConflictException('اسم الفرع مستخدم');
    }
    if (code) {
      const d = await this.prisma.branch.findUnique({ where: { code } });
      if (d && d.id !== exceptId) throw new ConflictException('رقم الفرع مستخدم');
    }
  }

  async createBranch(dto: CreateBranchDto) {
    const code = dto.code?.trim() || null;
    await this.assertBranchFree(dto.name, code);
    return this.prisma.branch.create({ data: { name: dto.name, city: dto.city || null, code } });
  }

  async updateBranch(id: string, dto: UpdateBranchDto) {
    const code = dto.code === undefined ? undefined : dto.code.trim() || null;
    await this.assertBranchFree(dto.name, code, id);
    return this.prisma.branch.update({ where: { id }, data: { name: dto.name, city: dto.city, code } });
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto) {
    const name = dto.name.trim();
    const dup = await this.prisma.department.findUnique({ where: { name } });
    if (dup && dup.id !== id) throw new ConflictException('اسم الإدارة مستخدم');
    return this.prisma.department.update({ where: { id }, data: { name } });
  }

  async createSection(dto: SectionDto) {
    const name = dto.name.trim();
    if (await this.prisma.section.findUnique({ where: { name } })) throw new ConflictException('اسم القسم مستخدم');
    return this.prisma.section.create({ data: { name } });
  }

  async updateSection(id: string, dto: SectionDto) {
    const name = dto.name.trim();
    const dup = await this.prisma.section.findUnique({ where: { name } });
    if (dup && dup.id !== id) throw new ConflictException('اسم القسم مستخدم');
    return this.prisma.section.update({ where: { id }, data: { name } });
  }

  async createDepartment(dto: CreateDepartmentDto) {
    const name = dto.name.trim();
    if (await this.prisma.department.findUnique({ where: { name } })) throw new ConflictException('اسم الإدارة مستخدم');
    return this.prisma.department.create({ data: { name } });
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
  @Patch('branches/:id') updateBranch(@Param('id') id: string, @Body() dto: UpdateBranchDto) { return this.svc.updateBranch(id, dto); }
  @Patch('departments/:id') updateDepartment(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) { return this.svc.updateDepartment(id, dto); }
  @Post('sections') createSection(@Body() dto: SectionDto) { return this.svc.createSection(dto); }
  @Patch('sections/:id') updateSection(@Param('id') id: string, @Body() dto: SectionDto) { return this.svc.updateSection(id, dto); }
  @Post('departments') createDepartment(@Body() dto: CreateDepartmentDto) { return this.svc.createDepartment(dto); }
}

@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
