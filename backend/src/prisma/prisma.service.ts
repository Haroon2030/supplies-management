import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Prisma');

  /**
   * لا نُسقط الخادم إن تعذّر الاتصال عند الإقلاع (انقطاع مؤقت أو حد اتصالات الاستضافة):
   * الإسقاط يجعل المشغّل يعيد التشغيل فوراً ويستهلك اتصالات أكثر في حلقة.
   * Prisma يعيد الاتصال تلقائياً عند أول استعلام، وأي فشل يصل المستخدم كـ 503 مفهوم.
   */
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (e) {
      this.log.error(`تعذّر الاتصال بالقاعدة عند الإقلاع، سيُعاد عند أول طلب: ${(e as Error).message.split('\n').pop()}`);
    }
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
