import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Segurança
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.MOBILE_URL || 'http://localhost:8081',
    ],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Essencia Arabe API')
    .setDescription('API da Perfumaria Digital Essencia Arabe')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Essencia Arabe API running on port ${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
