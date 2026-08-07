import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CardsService, CardData } from '../cards/cards.service';

export interface CollectionEntry {
  card: CardData;
  quantity: number;
}

@Injectable()
export class CollectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cardsService: CardsService,
  ) {}

  async addCard(userId: string, cardName: string, quantity: number): Promise<CollectionEntry> {
    // Se resuelve primero para garantizar que la carta ya exista en
    // la tabla Card (llave foranea de UserCollection).
    const card = await this.cardsService.resolveByName(cardName);

    const entry = await this.prisma.userCollection.upsert({
      where: { userId_cardId: { userId, cardId: card.id } },
      update: { quantity: { increment: quantity } },
      create: { userId, cardId: card.id, quantity },
    });

    return { card, quantity: entry.quantity };
  }

  async removeCard(userId: string, cardId: string, quantity: number): Promise<void> {
    const existing = await this.prisma.userCollection.findUnique({
      where: { userId_cardId: { userId, cardId } },
    });
    if (!existing) return;

    const newQty = existing.quantity - quantity;

    if (newQty <= 0) {
      await this.prisma.userCollection.delete({
        where: { userId_cardId: { userId, cardId } },
      });
    } else {
      await this.prisma.userCollection.update({
        where: { userId_cardId: { userId, cardId } },
        data: { quantity: newQty },
      });
    }
  }

  async getCollection(userId: string): Promise<CollectionEntry[]> {
    const entries = await this.prisma.userCollection.findMany({
      where: { userId },
      include: { card: true },
    });

    return entries.map((e) => ({
      quantity: e.quantity,
      card: {
        id: e.card.id,
        name: e.card.name,
        oracle_text: e.card.oracleText,
        mana_cost: e.card.manaCost,
        type_line: e.card.typeLine,
        colors: e.card.colors,
        rarity: e.card.rarity,
        set: e.card.set,
        image_uri: e.card.imageUri,
      },
    }));
  }
}
