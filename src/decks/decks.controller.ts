import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DecksService } from './decks.service';
import { CreateDeckDto } from './dto/create-deck.dto';
import { AddCardToDeckDto } from './dto/add-card-to-deck.dto';

@Controller('decks')
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  /** POST /decks/:userId — body: { name, format } */
  @Post(':userId')
  createDeck(@Param('userId') userId: string, @Body() dto: CreateDeckDto) {
    return this.decksService.createDeck(userId, dto.name, dto.format);
  }

  /** GET /decks/user/:userId */
  @Get('user/:userId')
  listForUser(@Param('userId') userId: string) {
    return this.decksService.listDecksForUser(userId);
  }

  /** GET /decks/:deckId */
  @Get(':deckId')
  getDeck(@Param('deckId') deckId: string) {
    return this.decksService.getDeck(deckId);
  }

  /** POST /decks/:deckId/cards — body: { cardId, quantity } */
  @Post(':deckId/cards')
  addCard(@Param('deckId') deckId: string, @Body() dto: AddCardToDeckDto) {
    return this.decksService.addCardToDeck(deckId, dto.cardId, dto.quantity);
  }
}
