import { Controller, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { AnalysisService, CardInput } from './analysis.service';
import { CardsService } from '../cards/cards.service';
import { CollectionService } from '../collection/collection.service';
import { DecksService } from '../decks/decks.service';
import { StatsService, DeckCardForStats } from './stats/stats.service';
import { JwtAuthGuard, AuthenticatedRequest } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly cardsService: CardsService,
    private readonly collectionService: CollectionService,
    private readonly decksService: DecksService,
    private readonly statsService: StatsService,
  ) {}

  /** GET /analysis/deck/:deckId — busca combos entre las cartas del deck, incluyendo al comandante */
  @Get('deck/:deckId')
  async analyzeDeck(@Req() req: AuthenticatedRequest, @Param('deckId') deckId: string) {
    const deck = await this.decksService.getDeck(deckId, req.user!.username);

    const cards: CardInput[] = [];
    for (const entry of deck.cards) {
      const card = await this.cardsService.getById(entry.cardId);
      if (card) {
        cards.push({ id: card.id, name: card.name, oracle_text: card.oracle_text, type_line: card.type_line });
      }
    }

    // El comandante vive aparte (commanderCardId), no dentro de
    // deck.cards — sin esto, quedaba fuera del analisis por completo.
    if (deck.commanderCardId) {
      const commander = await this.cardsService.getById(deck.commanderCardId);
      if (commander && !cards.some((c) => c.id === commander.id)) {
        cards.push({
          id: commander.id,
          name: commander.name,
          oracle_text: commander.oracle_text,
          type_line: commander.type_line,
        });
      }
    }

    if (cards.length === 0) {
      throw new NotFoundException('El deck no tiene cartas resueltas para analizar');
    }

    return this.analysisService.analyzeCollection(cards);
  }

  /** GET /analysis/collection — busca combos en toda la colección del usuario autenticado */
  @Get('collection')
  async analyzeCollection(@Req() req: AuthenticatedRequest) {
    const entries = await this.collectionService.getCollection(req.user!.username);
    const cards: CardInput[] = entries.map((e) => ({
      id: e.card.id,
      name: e.card.name,
      oracle_text: e.card.oracle_text,
      type_line: e.card.type_line,
    }));

    if (cards.length === 0) {
      throw new NotFoundException('La coleccion esta vacia');
    }

    return this.analysisService.analyzeCollection(cards);
  }

  /** GET /analysis/deck/:deckId/mana-stats — probabilidad de tener cada color por turno */
  @Get('deck/:deckId/mana-stats')
  async manaStats(@Req() req: AuthenticatedRequest, @Param('deckId') deckId: string) {
    const deck = await this.decksService.getDeck(deckId, req.user!.username);

    const cardsForStats: DeckCardForStats[] = [];
    for (const entry of deck.cards) {
      const card = await this.cardsService.getById(entry.cardId);
      if (card) {
        cardsForStats.push({
          typeLine: card.type_line,
          oracleText: card.oracle_text,
          quantity: entry.quantity,
        });
      }
    }

    // El comandante NO se cuenta aqui a proposito: vive en la zona de
    // mando, nunca se mezcla con el mazo ni se roba de el.
    const deckSize = deck.cards.reduce((sum, c) => sum + c.quantity, 0);

    if (deckSize === 0) {
      throw new NotFoundException('El deck no tiene cartas para calcular estadisticas');
    }

    return {
      deckSize,
      manaStats: this.statsService.calculateManaStats(deckSize, cardsForStats),
    };
  }
}