import { Module } from '@nestjs/common';
import { CardsModule } from '../cards/cards.module';
import { CollectionModule } from '../collection/collection.module';
import { DecksController } from './decks.controller';
import { DecksService } from './decks.service';

@Module({
  imports: [CardsModule, CollectionModule],
  controllers: [DecksController],
  providers: [DecksService],
  exports: [DecksService],
})
export class DecksModule {}
