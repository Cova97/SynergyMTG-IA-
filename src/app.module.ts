import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CardsModule } from './cards/cards.module';
import { CollectionModule } from './collection/collection.module';
import { DecksModule } from './decks/decks.module';
import { AnalysisModule } from './analysis/analysis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // lee .env, ej. NVIDIA_API_KEY
    CardsModule,
    CollectionModule,
    DecksModule,
    AnalysisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}