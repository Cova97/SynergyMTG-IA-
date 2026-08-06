import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CollectionService } from '../collection/collection.service';
import { DeckFormat } from './dto/create-deck.dto';

export interface Deck {
  id: string;
  userId: string;
  name: string;
  format: DeckFormat;
  cards: Map<string, number>; // cardId -> cantidad en el deck
}

export interface DeckSummary {
  id: string;
  name: string;
  format: DeckFormat;
  cardCount: number;
}

// TODO: reemplazar por las tablas Deck/DeckCard de Prisma. La logica
// de validacion (solo cartas propias, reglas por formato) se queda
// igual, solo cambia donde se guardan los datos.
@Injectable()
export class DecksService {
  private readonly decks = new Map<string, Deck>();

  constructor(private readonly collectionService: CollectionService) {}

  createDeck(userId: string, name: string, format: DeckFormat): DeckSummary {
    const deck: Deck = {
      id: randomUUID(),
      userId,
      name,
      format,
      cards: new Map(),
    };
    this.decks.set(deck.id, deck);
    return this.toSummary(deck);
  }

  addCardToDeck(deckId: string, cardId: string, quantity: number): DeckSummary {
    const deck = this.getDeckOrThrow(deckId);

    // Regla central del deckbuilder: solo se puede usar una carta si
    // esta en la coleccion del usuario, y no mas copias de las que
    // realmente posee.
    const owned = this.collectionService
      .getCollection(deck.userId)
      .find((entry) => entry.card.id === cardId);

    if (!owned) {
      throw new BadRequestException(
        'No puedes agregar una carta que no esta en tu coleccion',
      );
    }

    const currentInDeck = deck.cards.get(cardId) ?? 0;
    const newTotal = currentInDeck + quantity;

    if (newTotal > owned.quantity) {
      throw new BadRequestException(
        `Solo tienes ${owned.quantity} copias de "${owned.card.name}", no puedes meter ${newTotal} al deck`,
      );
    }

    // Regla basica de formato: Commander es singleton (salvo tierras
    // basicas). Reglas mas completas por formato quedan pendientes.
    if (deck.format === 'commander' && newTotal > 1 && !owned.card.type_line.includes('Basic Land')) {
      throw new BadRequestException(
        `Commander es singleton: no puedes tener mas de 1 copia de "${owned.card.name}"`,
      );
    }

    deck.cards.set(cardId, newTotal);
    return this.toSummary(deck);
  }

  getDeck(deckId: string): Deck {
    return this.getDeckOrThrow(deckId);
  }

  listDecksForUser(userId: string): DeckSummary[] {
    return [...this.decks.values()]
      .filter((d) => d.userId === userId)
      .map((d) => this.toSummary(d));
  }

  private getDeckOrThrow(deckId: string): Deck {
    const deck = this.decks.get(deckId);
    if (!deck) throw new NotFoundException(`Deck "${deckId}" no existe`);
    return deck;
  }

  private toSummary(deck: Deck): DeckSummary {
    const cardCount = [...deck.cards.values()].reduce((sum, qty) => sum + qty, 0);
    return { id: deck.id, name: deck.name, format: deck.format, cardCount };
  }
}
