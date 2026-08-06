import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';

@Module({
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService], // otros modulos (Collection, Decks, Analysis) lo necesitan
})
export class CardsModule {}
