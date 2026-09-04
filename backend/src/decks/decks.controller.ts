import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DecksService } from './decks.service';
import { CreateDeckDto } from './dto/create-deck.dto';
import { AddCardToDeckDto } from './dto/add-card-to-deck.dto';
import { SetCommanderDto } from './dto/set-commander.dto';
import { JwtAuthGuard, AuthenticatedRequest } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('decks')
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  /** POST /decks — body: { name, format } */
  @Post()
  createDeck(@Req() req: AuthenticatedRequest, @Body() dto: CreateDeckDto) {
    return this.decksService.createDeck(req.user!.username, dto.name, dto.format);
  }

  /** GET /decks — mis decks */
  @Get()
  listForUser(@Req() req: AuthenticatedRequest) {
    return this.decksService.listDecksForUser(req.user!.username);
  }

  /** GET /decks/:deckId */
  @Get(':deckId')
  getDeck(@Req() req: AuthenticatedRequest, @Param('deckId') deckId: string) {
    return this.decksService.getDeck(deckId, req.user!.username);
  }

  /** POST /decks/:deckId/cards — body: { cardId, quantity } */
  @Post(':deckId/cards')
  addCard(
    @Req() req: AuthenticatedRequest,
    @Param('deckId') deckId: string,
    @Body() dto: AddCardToDeckDto,
  ) {
    return this.decksService.addCardToDeck(deckId, dto.cardId, dto.quantity, req.user!.username);
  }

  /** POST /decks/:deckId/commander — body: { cardId } (solo formato Commander) */
  @Post(':deckId/commander')
  setCommander(
    @Req() req: AuthenticatedRequest,
    @Param('deckId') deckId: string,
    @Body() dto: SetCommanderDto,
  ) {
    return this.decksService.setCommander(deckId, dto.cardId, req.user!.username);
  }

  /** GET /decks/:deckId/validate — revisa si el deck cumple el tamaño de su formato */
  @Get(':deckId/validate')
  validateDeck(@Req() req: AuthenticatedRequest, @Param('deckId') deckId: string) {
    return this.decksService.validateDeck(deckId, req.user!.username);
  }

  /** DELETE /decks/:deckId — borra el deck completo */
  @Delete(':deckId')
  async deleteDeck(@Req() req: AuthenticatedRequest, @Param('deckId') deckId: string) {
    await this.decksService.deleteDeck(deckId, req.user!.username);
    return { deleted: true };
  }

  /** DELETE /decks/:deckId/cards/:cardId?quantity=N — quita (o reduce) una carta del deck */
  @Delete(':deckId/cards/:cardId')
  removeCard(
    @Req() req: AuthenticatedRequest,
    @Param('deckId') deckId: string,
    @Param('cardId') cardId: string,
    @Query('quantity') quantity: string,
  ) {
    return this.decksService.removeCardFromDeck(
      deckId,
      cardId,
      Number(quantity ?? 1),
      req.user!.username,
    );
  }
}