import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Sin esto, el navegador bloquea las peticiones del frontend
  // (localhost:3000) hacia el backend (localhost:3001) — son origenes
  // distintos, y por default Nest no permite peticiones cross-origin.
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3002',
  });

  // Valida automaticamente los DTOs (class-validator) en cada
  // request, y rechaza campos que no esten declarados en el DTO.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
