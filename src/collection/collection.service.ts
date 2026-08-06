import { Injectable } from '@nestjs/common';
import { CardsService, CardData } from '../cards/cards.service';

export interface CollectionEntry {
  card: CardData;
  quantity: number;
}

// TODO: reemplazar por la tabla UserCollection de Prisma cuando este
// el schema. La interfaz publica (addCard/getCollection/removeCard)
// no deberia cambiar, solo la implementacion interna.
@Injectable()
export class CollectionService {
  // userId -> (cardId -> cantidad)
  private readonly collections = new Map<string, Map<string, number>>();

  constructor(private readonly cardsService: CardsService) {}

  async addCard(userId: string, cardName: string, quantity: number): Promise<CollectionEntry> {
    const card = await this.cardsService.resolveByName(cardName);

    const userCollection = this.getOrCreateUserMap(userId);
    const currentQty = userCollection.get(card.id) ?? 0;
    userCollection.set(card.id, currentQty + quantity);

    return { card, quantity: currentQty + quantity };
  }

  removeCard(userId: string, cardId: string, quantity: number): void {
    const userCollection = this.collections.get(userId);
    if (!userCollection) return;

    const currentQty = userCollection.get(cardId) ?? 0;
    const newQty = currentQty - quantity;

    if (newQty <= 0) {
      userCollection.delete(cardId);
    } else {
      userCollection.set(cardId, newQty);
    }
  }

  getCollection(userId: string): CollectionEntry[] {
    const userCollection = this.collections.get(userId);
    if (!userCollection) return [];

    const entries: CollectionEntry[] = [];
    for (const [cardId, quantity] of userCollection.entries()) {
      const card = this.cardsService.getById(cardId);
      if (card) entries.push({ card, quantity });
    }
    return entries;
  }

  private getOrCreateUserMap(userId: string): Map<string, number> {
    let userCollection = this.collections.get(userId);
    if (!userCollection) {
      userCollection = new Map();
      this.collections.set(userId, userCollection);
    }
    return userCollection;
  }
}
