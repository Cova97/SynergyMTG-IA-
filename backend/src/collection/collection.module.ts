import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { CollectionController } from './collection.controller';
import { CollectionService } from './collection.service';

@Module({
  imports: [CardsModule],
  controllers: [CollectionController],
  providers: [CollectionService],
  exports: [CollectionService], // DecksModule y AnalysisModule lo necesitan
})
export class CollectionModule {}
