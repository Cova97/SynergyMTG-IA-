import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CardsModule } from './cards/cards.module';
import { CollectionModule } from './collection/collection.module';
import { DecksModule } from './decks/decks.module';
import { AnalysisModule } from './analysis/analysis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // lee .env, ej. NVIDIA_API_KEY y DATABASE_URL
    PrismaModule,
    AuthModule,
    CardsModule,
    CollectionModule,
    DecksModule,
    AnalysisModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}