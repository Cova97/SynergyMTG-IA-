import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { CollectionModule } from '../collection/collection.module';
import { DecksModule } from '../decks/decks.module';
import { AiModule } from './ai/ai.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [AiModule, CardsModule, CollectionModule, DecksModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
