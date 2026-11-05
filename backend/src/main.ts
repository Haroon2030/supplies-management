import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DbUnavailableFilter } from './common/db-unavailable.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','), credentials: true });
  app.useGlobalFilters(new DbUnavailableFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // وثائق Swagger تكشف كل المسارات: تُعطَّل في الإنتاج إلا بـ ENABLE_SWAGGER=1
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === '1') {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Procurement API').setVersion('1.0').addBearerAuth().build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }

  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
