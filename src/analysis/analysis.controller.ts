import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { AnalysisService, CardInput } from './analysis.service';
import { CardsService } from '../cards/cards.service';
import { CollectionService } from '../collection/collection.service';
import { DecksService } from '../decks/decks.service';

@Controller('analysis')
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly cardsService: CardsService,
    private readonly collectionService: CollectionService,
    private readonly decksService: DecksService,
  ) {}

  /** GET /analysis/deck/:deckId — busca combos entre las cartas del deck, incluyendo al comandante */
  @Get('deck/:deckId')
  async analyzeDeck(@Param('deckId') deckId: string) {
    const deck = await this.decksService.getDeck(deckId);

    const cards: CardInput[] = [];
    for (const entry of deck.cards) {
      const card = await this.cardsService.getById(entry.cardId);
      if (card) cards.push({ id: card.id, name: card.name, oracle_text: card.oracle_text });
    }

    // El comandante vive aparte (commanderCardId), no dentro de
    // deck.cards — sin esto, quedaba fuera del analisis por completo
    // (encontrado con un caso real: Raiyuu, Storm's Edge y Asari
    // Captain comparten la misma condicion de disparo, pero Raiyuu
    // nunca llegaba a compararse contra el resto del deck).
    if (deck.commanderCardId) {
      const commander = await this.cardsService.getById(deck.commanderCardId);
      if (commander && !cards.some((c) => c.id === commander.id)) {
        cards.push({ id: commander.id, name: commander.name, oracle_text: commander.oracle_text });
      }
    }

    if (cards.length === 0) {
      throw new NotFoundException('El deck no tiene cartas resueltas para analizar');
    }

    return this.analysisService.analyzeCollection(cards);
  }

  /** GET /analysis/collection/:userId — busca combos en toda la colección del usuario */
  @Get('collection/:userId')
  async analyzeCollection(@Param('userId') userId: string) {
    const entries = await this.collectionService.getCollection(userId);
    const cards: CardInput[] = entries.map((e) => ({
      id: e.card.id,
      name: e.card.name,
      oracle_text: e.card.oracle_text,
    }));

    if (cards.length === 0) {
      throw new NotFoundException('La coleccion esta vacia');
    }

    return this.analysisService.analyzeCollection(cards);
  }
}
