import { Module } from '@nestjs/common';
import { CollectionModule } from '../collection/collection.module';
import { DecksController } from './decks.controller';
import { DecksService } from './decks.service';

@Module({
  imports: [CollectionModule],
  controllers: [DecksController],
  providers: [DecksService],
  exports: [DecksService],
})
export class DecksModule {}
