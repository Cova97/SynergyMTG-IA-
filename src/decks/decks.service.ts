import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionService } from '../collection/collection.service';
import { DeckFormat } from './dto/create-deck.dto';

export interface DeckCardEntry {
  cardId: string;
  cardName: string;
  quantity: number;
}

export interface DeckDetail {
  id: string;
  userId: string;
  name: string;
  format: DeckFormat;
  cards: DeckCardEntry[];
}

export interface DeckSummary {
  id: string;
  name: string;
  format: DeckFormat;
  cardCount: number;
}

@Injectable()
export class DecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collectionService: CollectionService,
  ) {}

  async createDeck(userId: string, name: string, format: DeckFormat): Promise<DeckSummary> {
    const deck = await this.prisma.deck.create({
      data: { userId, name, format: format as any },
    });
    return { id: deck.id, name: deck.name, format: deck.format as DeckFormat, cardCount: 0 };
  }

  async addCardToDeck(deckId: string, cardId: string, quantity: number): Promise<DeckSummary> {
    const deck = await this.prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck) throw new NotFoundException(`Deck "${deckId}" no existe`);

    // Regla central del deckbuilder: solo se puede usar una carta si
    // esta en la coleccion del usuario, y no mas copias de las que
    // realmente posee.
    const owned = (await this.collectionService.getCollection(deck.userId)).find(
      (entry) => entry.card.id === cardId,
    );
    if (!owned) {
      throw new BadRequestException('No puedes agregar una carta que no esta en tu coleccion');
    }

    const currentEntry = await this.prisma.deckCard.findUnique({
      where: { deckId_cardId: { deckId, cardId } },
    });
    const newTotal = (currentEntry?.quantity ?? 0) + quantity;

    if (newTotal > owned.quantity) {
      throw new BadRequestException(
        `Solo tienes ${owned.quantity} copias de "${owned.card.name}", no puedes meter ${newTotal} al deck`,
      );
    }

    // Regla basica de formato: Commander es singleton (salvo tierras
    // basicas). Reglas mas completas por formato quedan pendientes.
    if (
      deck.format === 'commander' &&
      newTotal > 1 &&
      !owned.card.type_line.includes('Basic Land')
    ) {
      throw new BadRequestException(
        `Commander es singleton: no puedes tener mas de 1 copia de "${owned.card.name}"`,
      );
    }

    await this.prisma.deckCard.upsert({
      where: { deckId_cardId: { deckId, cardId } },
      update: { quantity: newTotal },
      create: { deckId, cardId, quantity: newTotal },
    });

    return this.getSummary(deckId);
  }

  async getDeck(deckId: string): Promise<DeckDetail> {
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
      include: { cards: { include: { card: true } } },
    });
    if (!deck) throw new NotFoundException(`Deck "${deckId}" no existe`);

    return {
      id: deck.id,
      userId: deck.userId,
      name: deck.name,
      format: deck.format as DeckFormat,
      cards: deck.cards.map((dc) => ({
        cardId: dc.cardId,
        cardName: dc.card.name,
        quantity: dc.quantity,
      })),
    };
  }

  async listDecksForUser(userId: string): Promise<DeckSummary[]> {
    const decks = await this.prisma.deck.findMany({
      where: { userId },
      include: { cards: true },
    });

    return decks.map((d) => ({
      id: d.id,
      name: d.name,
      format: d.format as DeckFormat,
      cardCount: d.cards.reduce((sum, c) => sum + c.quantity, 0),
    }));
  }

  private async getSummary(deckId: string): Promise<DeckSummary> {
    const deck = await this.prisma.deck.findUniqueOrThrow({
      where: { id: deckId },
      include: { cards: true },
    });
    return {
      id: deck.id,
      name: deck.name,
      format: deck.format as DeckFormat,
      cardCount: deck.cards.reduce((sum, c) => sum + c.quantity, 0),
    };
  }
}
