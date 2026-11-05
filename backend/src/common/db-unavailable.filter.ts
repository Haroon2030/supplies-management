import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * أخطاء الاتصال بقاعدة البيانات (انقطاع، أو تجاوز حد الاتصالات في الساعة عند الاستضافة)
 * تُعاد كـ 503 برسالة مفهومة بدل 500 عام، حتى لا يظنها المستخدم خطأ في بياناته.
 */
@Catch(Prisma.PrismaClientInitializationError, Prisma.PrismaClientKnownRequestError)
export class DbUnavailableFilter implements ExceptionFilter {
  private readonly log = new Logger('Database');
  /** P1001 لا يمكن الوصول · P1002 انتهت المهلة · P1008 مهلة العملية · P1017 أُغلق الاتصال · P2024 امتلأ المجمّع */
  private static readonly CONNECTION_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

  catch(e: Prisma.PrismaClientInitializationError | Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const isConnection =
      e instanceof Prisma.PrismaClientInitializationError || DbUnavailableFilter.CONNECTION_CODES.has(e.code);

    if (!isConnection) {
      // أخطاء الاستعلام الأخرى (تعارض فريد، سجل غير موجود...) تُعالجها الخدمات نفسها؛ هنا شبكة أمان فقط.
      this.log.error(e.message);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Internal server error' });
    }

    const hourlyLimit = /max_connections_per_hour/i.test(e.message);
    this.log.error(hourlyLimit ? 'تجاوز حد الاتصالات في الساعة عند مزوّد القاعدة' : e.message.split('\n').pop());
    return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: 503,
      error: 'Service Unavailable',
      message: hourlyLimit
        ? 'الخدمة مشغولة مؤقتاً (حد اتصالات القاعدة). أعد المحاولة بعد قليل.'
        : 'تعذر الاتصال بقاعدة البيانات مؤقتاً. أعد المحاولة بعد قليل.',
    });
  }
}
