import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CustodyModule } from './custody/custody.module';
import { InventoryModule } from './inventory/inventory.module';
import { InvoicesModule } from './invoices/invoices.module';
import { SuppliesModule } from './supplies/supplies.module';
import { PrismaModule } from './prisma/prisma.service';
import { PurchaseRequestsModule } from './purchase-requests/purchase-requests.module';
import { ReportsModule } from './reports/reports.module';
import { RequestsModule } from './requests/requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AdminModule,
    CatalogModule,
    InventoryModule,
    InvoicesModule,
    SuppliesModule,
    CustodyModule,
    RequestsModule,
    PurchaseRequestsModule,
    ReportsModule,
  ],
})
export class AppModule {}
