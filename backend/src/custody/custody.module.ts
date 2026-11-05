import {
  Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';

export class SignCustodyDto {
  /** اسم المستلم كما يوقّع (إلزامي). */
  @IsString() @MinLength(3) @MaxLength(100) signerName!: string;
  /** رقم الهوية/الإقامة أو الرقم الوظيفي (اختياري). */
  @IsOptional() @IsString() @MaxLength(30) signerIdNo?: string;
  /** صورة التوقيع المرسوم على الشاشة (PNG)، اختيارية: يمكن التوقيع الورقي بعد الطباعة. */
  @IsOptional() @IsString() @MaxLength(90_000) @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, { message: 'صيغة التوقيع غير صالحة' })
  signature?: string;
}

const sum = (units: { unitCost: unknown }[]) => Math.round(units.reduce((s, u) => s + Number(u.unitCost) * 100, 0)) / 100;

@Injectable()
export class CustodyService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.custodyReceipt.findMany({
      orderBy: { number: 'desc' },
      take: 200,
      include: {
        custodian: { select: { fullName: true } },
        request: { select: { number: true, department: { select: { name: true } }, branch: { select: { name: true } } } },
        units: { select: { unitCost: true } },
      },
    });
    return rows.map(({ units, signature, ...r }) => ({ ...r, hasSignature: !!signature, unitsCount: units.length, total: sum(units) }));
  }

  /** أمين المستودع والمدير العام، أو المستلم نفسه. */
  async get(user: AuthUser, id: string) {
    const r = await this.prisma.custodyReceipt.findUnique({
      where: { id },
      include: {
        custodian: { select: { id: true, fullName: true, username: true } },
        issuedBy: { select: { fullName: true } },
        request: {
          select: {
            id: true, number: true, createdAt: true,
            department: { select: { name: true } }, branch: { select: { name: true } }, section: { select: { name: true } },
          },
        },
        units: { orderBy: { seq: 'asc' }, include: { item: { select: { name: true, sku: true, unit: true } } } },
      },
    });
    if (!r) throw new NotFoundException('السند غير موجود');
    const privileged = user.role === Role.ADMIN || user.role === Role.WAREHOUSE_KEEPER;
    if (!privileged && r.custodianId !== user.id) throw new ForbiddenException('ليست لديك صلاحية على هذا السند');
    const approval = await this.prisma.requestEvent.findFirst({
      where: { requestId: r.requestId, action: 'APPROVED' }, orderBy: { createdAt: 'desc' }, include: { actor: { select: { fullName: true } } },
    });
    return { ...r, approvedBy: approval?.actor.fullName ?? null, total: sum(r.units) };
  }

  /** التوقيع في الخطوة الأخيرة: يثبت السند ولا يُعدَّل بعده. */
  async sign(user: AuthUser, id: string, dto: SignCustodyDto) {
    const done = await this.prisma.custodyReceipt.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'SIGNED', signedAt: new Date(), signerName: dto.signerName.trim(),
        signerIdNo: dto.signerIdNo?.trim() || null, signature: dto.signature ?? null,
      },
    });
    if (done.count !== 1) {
      if (!(await this.prisma.custodyReceipt.count({ where: { id } }))) throw new NotFoundException('السند غير موجود');
      throw new ConflictException('السند موقَّع مسبقاً ولا يمكن تعديله');
    }
    return this.get(user, id);
  }
}

@ApiTags('custody')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('custody')
export class CustodyController {
  constructor(private readonly svc: CustodyService) {}
  @Get() @Roles(Role.WAREHOUSE_KEEPER) list() { return this.svc.list(); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.get(u, id); }
  @Post(':id/sign') @Roles(Role.WAREHOUSE_KEEPER)
  sign(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SignCustodyDto) { return this.svc.sign(u, id, dto); }
}

@Module({ controllers: [CustodyController], providers: [CustodyService] })
export class CustodyModule {}
