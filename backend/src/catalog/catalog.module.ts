import { Body, ConflictException, Controller, Get, Injectable, Module, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { PrismaService } from '../prisma/prisma.service';
import { PurchaseRequestsModule } from '../purchase-requests/purchase-requests.module';
import { ReplenishmentService } from '../purchase-requests/replenishment.service';

export class CreateItemDto {
  @IsString() @MinLength(2) sku!: string;
  @IsString() @MinLength(2) name!: string;
  @IsString() categoryId!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsInt() @Min(0) minStock?: number;
  @IsOptional() @IsInt() @Min(0) reorderQty?: number;
  @IsOptional() @IsBoolean() isCustody?: boolean;
}
export class UpdateItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsInt() @Min(0) minStock?: number;
  @IsOptional() @IsInt() @Min(0) reorderQty?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() isCustody?: boolean;
}
export class CreateSupplierDto {
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @Matches(/^\d{15}$/, { message: 'الرقم الضريبي 15 رقماً' }) vatNumber?: string;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService, private readonly replenishment: ReplenishmentService) {}

  categories() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }
  branches() {
    return this.prisma.branch.findMany({ orderBy: { name: 'asc' } });
  }
  sections() {
    return this.prisma.section.findMany({ orderBy: { name: 'asc' } });
  }
  departments() {
    return this.prisma.department.findMany({ orderBy: { name: 'asc' } });
  }
  suppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: 'asc' } });
  }
  createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }
  items() {
    return this.prisma.item.findMany({ orderBy: { name: 'asc' }, include: { category: true } });
  }
  /** الباركود الفارغ = بلا قيمة (حتى لا يتعارض الفهرس الفريد). */
  private async assertBarcodeFree(barcode: string | null | undefined, exceptId?: string) {
    if (!barcode) return;
    const dup = await this.prisma.item.findUnique({ where: { barcode } });
    if (dup && dup.id !== exceptId) throw new ConflictException('الباركود مستخدم لصنف آخر');
  }
  async createItem(dto: CreateItemDto) {
    const exists = await this.prisma.item.findUnique({ where: { sku: dto.sku } });
    if (exists) throw new ConflictException('رقم الصنف مستخدم مسبقاً');
    const data = { ...dto, description: dto.description?.trim() || null, barcode: dto.barcode?.trim() || null };
    await this.assertBarcodeFree(data.barcode);
    const item = await this.prisma.item.create({ data, include: { category: true } });
    await this.replenishment.safeSync(); // صنف جديد برصيد صفر وحد أدنى > 0 يحتاج طلب شراء
    return item;
  }
  async updateItem(id: string, dto: UpdateItemDto) {
    const data = {
      ...dto,
      description: dto.description === undefined ? undefined : dto.description.trim() || null,
      barcode: dto.barcode === undefined ? undefined : dto.barcode.trim() || null,
    };
    await this.assertBarcodeFree(data.barcode, id);
    const item = await this.prisma.item.update({ where: { id }, data, include: { category: true } });
    await this.replenishment.safeSync(); // تغيير الحد الأدنى قد يجعل الصنف تحته فوراً
    return item;
  }
}

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CatalogController {
  constructor(private readonly svc: CatalogService) {}

  @Get('categories') categories() { return this.svc.categories(); }
  @Get('branches') branches() { return this.svc.branches(); }
  @Get('sections') sections() { return this.svc.sections(); }
  @Get('departments') departments() { return this.svc.departments(); }
  @Get('items') items() { return this.svc.items(); }
  @Get('suppliers') @Roles(Role.WAREHOUSE_KEEPER) suppliers() { return this.svc.suppliers(); }

  @Post('items') @Roles(Role.WAREHOUSE_KEEPER)
  createItem(@Body() dto: CreateItemDto) { return this.svc.createItem(dto); }

  @Patch('items/:id') @Roles(Role.WAREHOUSE_KEEPER)
  updateItem(@Param('id') id: string, @Body() dto: UpdateItemDto) { return this.svc.updateItem(id, dto); }

  @Post('suppliers') @Roles(Role.WAREHOUSE_KEEPER)
  createSupplier(@Body() dto: CreateSupplierDto) { return this.svc.createSupplier(dto); }
}

@Module({ imports: [PurchaseRequestsModule], controllers: [CatalogController], providers: [CatalogService] })
export class CatalogModule {}
