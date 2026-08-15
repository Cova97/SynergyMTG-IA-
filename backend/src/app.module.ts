import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CardsModule } from './cards/cards.module';
import { CollectionModule } from './collection/collection.module';
import { DecksModule } from './decks/decks.module';
import { AnalysisModule } from './analysis/analysis.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // lee .env, ej. NVIDIA_API_KEY
    CardsModule,
    CollectionModule,
    DecksModule,
    AnalysisModule,
    PrismaModule,
  ],
})
export class AppModule {}