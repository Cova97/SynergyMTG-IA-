import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global() para no tener que importar PrismaModule en cada modulo
// que necesite la base de datos (Cards, Collection, Decks...).
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
