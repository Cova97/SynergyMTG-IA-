import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CardsService } from '../cards/cards.service';
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
  commanderCardId: string | null;
  commanderName: string | null;
  cards: DeckCardEntry[];
}

export interface DeckSummary {
  id: string;
  name: string;
  format: DeckFormat;
  cardCount: number;
}

export interface DeckValidation {
  valid: boolean;
  issues: string[];
}

// Reglas oficiales usadas aqui (Comprehensive Rules):
// CR 100.2a — constructed: minimo 60 cartas, maximo 4 copias de
//             cualquier carta (salvo tierras basicas), sin maximo de deck.
// CR 903.5a — commander: exactamente 100 cartas incluyendo el comandante.
// CR 903.5c — commander: singleton (salvo tierras basicas).
// CR 903.3   — el comandante debe ser legendario (criatura, Vehiculo, o
//              Nave espacial con casillas de poder/resistencia).
const MAX_COPIES_CONSTRUCTED = 4;
const MIN_DECK_SIZE_CONSTRUCTED = 60;
const COMMANDER_DECK_SIZE = 100;
const COMMANDER_NON_COMMANDER_SLOTS = COMMANDER_DECK_SIZE - 1; // 99

@Injectable()
export class DecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cardsService: CardsService,
    private readonly collectionService: CollectionService,
  ) {}

  async createDeck(userId: string, name: string, format: DeckFormat): Promise<DeckSummary> {
    const deck = await this.prisma.deck.create({
      data: { userId, name, format: format as any },
    });
    return { id: deck.id, name: deck.name, format: deck.format as DeckFormat, cardCount: 0 };
  }

  /**
   * Designa el comandante del deck. Debe ser legendario (CR 903.3) y
   * el usuario debe poseerlo. No se cuenta como parte de las cartas
   * del deck (DeckCard) — vive aparte, como en el juego real.
   */
  async setCommander(deckId: string, cardId: string, requestingUserId: string): Promise<DeckDetail> {
    const deck = await this.prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck) throw new NotFoundException(`Deck "${deckId}" no existe`);
    this.assertOwnership(deck.userId, requestingUserId);

    if (deck.format !== 'commander') {
      throw new BadRequestException('Solo los decks de formato Commander tienen comandante');
    }

    const card = await this.cardsService.getById(cardId);
    if (!card) throw new NotFoundException(`Carta "${cardId}" no resuelta todavia`);

    const isLegendary = card.type_line.includes('Legendary');
    const isValidType =
      card.type_line.includes('Creature') ||
      card.type_line.includes('Vehicle') ||
      card.type_line.includes('Spacecraft');

    if (!isLegendary || !isValidType) {
      throw new BadRequestException(
        `"${card.name}" no puede ser comandante — debe ser legendaria y Criatura, Vehiculo o Nave espacial (CR 903.3)`,
      );
    }

    const owned = (await this.collectionService.getCollection(deck.userId)).some(
      (e) => e.card.id === cardId,
    );
    if (!owned) {
      throw new BadRequestException('No puedes usar como comandante una carta que no tienes en tu coleccion');
    }

    await this.prisma.deck.update({ where: { id: deckId }, data: { commanderCardId: cardId } });
    return this.getDeck(deckId, requestingUserId);
  }

  async addCardToDeck(
    deckId: string,
    cardId: string,
    quantity: number,
    requestingUserId: string,
  ): Promise<DeckSummary> {
    const deck = await this.prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck) throw new NotFoundException(`Deck "${deckId}" no existe`);
    this.assertOwnership(deck.userId, requestingUserId);

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
    const isBasicLand = owned.card.type_line.includes('Basic Land');

    if (newTotal > owned.quantity) {
      throw new BadRequestException(
        `Solo tienes ${owned.quantity} copias de "${owned.card.name}", no puedes meter ${newTotal} al deck`,
      );
    }

    if (deck.format === 'commander') {
      await this.validateCommanderCardAdd(deck, owned.card, cardId, newTotal, isBasicLand);
    } else if (!isBasicLand && newTotal > MAX_COPIES_CONSTRUCTED) {
      // CR 100.2a: maximo 4 copias de cualquier carta salvo tierras basicas
      throw new BadRequestException(
        `Maximo ${MAX_COPIES_CONSTRUCTED} copias de "${owned.card.name}" por deck (CR 100.2a) — intentas tener ${newTotal}`,
      );
    }

    await this.prisma.deckCard.upsert({
      where: { deckId_cardId: { deckId, cardId } },
      update: { quantity: newTotal },
      create: { deckId, cardId, quantity: newTotal },
    });

    return this.getSummary(deckId);
  }

  /** Lanza 403 si el deck no le pertenece a quien esta pidiendo la operacion. */
  private assertOwnership(deckOwnerId: string, requestingUserId: string): void {
    if (deckOwnerId !== requestingUserId) {
      throw new ForbiddenException('Este deck no es tuyo');
    }
  }

  private async validateCommanderCardAdd(
    deck: { id: string; commanderCardId: string | null },
    card: { name: string; color_identity: string[] },
    cardId: string,
    newTotal: number,
    isBasicLand: boolean,
  ): Promise<void> {
    // CR 903.5c: singleton, salvo tierras basicas
    if (!isBasicLand && newTotal > 1) {
      throw new BadRequestException(
        `Commander es singleton (CR 903.5c): no puedes tener mas de 1 copia de "${card.name}"`,
      );
    }

    // No dejar que la carta que se agrega SEA el comandante tambien
    // en el mazo de 99 (el comandante vive aparte).
    if (cardId === deck.commanderCardId) {
      throw new BadRequestException('Esa carta ya es tu comandante, no va tambien en las 99');
    }

    // CR 903.5a: exactamente 100 cartas = comandante + 99. No dejar
    // que las 99 se pasen de cupo.
    const currentNonCommanderCount = await this.countNonCommanderCards(deck.id);
    if (currentNonCommanderCount + 1 > COMMANDER_NON_COMMANDER_SLOTS) {
      throw new BadRequestException(
        `Un deck de Commander son exactamente 100 cartas (1 comandante + 99) — ya tienes ${currentNonCommanderCount} y no caben mas (CR 903.5a)`,
      );
    }

    // Identidad de color: cada simbolo de color de la carta debe
    // estar contenido en la identidad de color del comandante.
    if (deck.commanderCardId) {
      const commander = await this.cardsService.getById(deck.commanderCardId);
      if (commander) {
        const outOfIdentity = card.color_identity.filter(
          (c) => !commander.color_identity.includes(c),
        );
        if (outOfIdentity.length > 0) {
          throw new BadRequestException(
            `"${card.name}" tiene identidad de color [${card.color_identity.join(', ') || 'incoloro'}], fuera de la identidad de tu comandante [${commander.color_identity.join(', ') || 'incoloro'}] (CR 903.4)`,
          );
        }
      }
    }
  }

  private async countNonCommanderCards(deckId: string): Promise<number> {
    const entries = await this.prisma.deckCard.findMany({ where: { deckId } });
    return entries.reduce((sum, e) => sum + e.quantity, 0);
  }

  async getDeck(deckId: string, requestingUserId: string): Promise<DeckDetail> {
    const deck = await this.prisma.deck.findUnique({
      where: { id: deckId },
      include: { cards: { include: { card: true } }, commander: true },
    });
    if (!deck) throw new NotFoundException(`Deck "${deckId}" no existe`);
    this.assertOwnership(deck.userId, requestingUserId);

    return {
      id: deck.id,
      userId: deck.userId,
      name: deck.name,
      format: deck.format as DeckFormat,
      commanderCardId: deck.commanderCardId,
      commanderName: deck.commander?.name ?? null,
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

  /**
   * Revisa si el deck cumple los requisitos de tamano de su formato.
   * No bloquea nada al construir — es informativo, para saber si el
   * deck ya esta "completo" y listo para jugar.
   */
  async validateDeck(deckId: string, requestingUserId: string): Promise<DeckValidation> {
    const deck = await this.getDeck(deckId, requestingUserId); // ya valida propiedad adentro
    const totalCards = deck.cards.reduce((sum, c) => sum + c.quantity, 0);
    const issues: string[] = [];

    if (deck.format === 'commander') {
      if (!deck.commanderCardId) {
        issues.push('No tiene comandante designado');
      }
      if (totalCards !== COMMANDER_NON_COMMANDER_SLOTS) {
        issues.push(
          `Debe tener exactamente ${COMMANDER_NON_COMMANDER_SLOTS} cartas fuera del comandante (CR 903.5a) — tiene ${totalCards}`,
        );
      }
    } else {
      if (totalCards < MIN_DECK_SIZE_CONSTRUCTED) {
        issues.push(
          `Minimo ${MIN_DECK_SIZE_CONSTRUCTED} cartas (CR 100.2a) — tiene ${totalCards}`,
        );
      }
    }

    return { valid: issues.length === 0, issues };
  }

  /** Borra el deck completo (las filas de DeckCard se van en cascada por el schema). */
  async deleteDeck(deckId: string, requestingUserId: string): Promise<void> {
    const deck = await this.prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck) throw new NotFoundException(`Deck "${deckId}" no existe`);
    this.assertOwnership(deck.userId, requestingUserId);

    await this.prisma.deck.delete({ where: { id: deckId } });
  }

  /** Quita (o reduce) una carta del deck. Mismo patron que CollectionService.removeCard. */
  async removeCardFromDeck(
    deckId: string,
    cardId: string,
    quantity: number,
    requestingUserId: string,
  ): Promise<DeckSummary> {
    const deck = await this.prisma.deck.findUnique({ where: { id: deckId } });
    if (!deck) throw new NotFoundException(`Deck "${deckId}" no existe`);
    this.assertOwnership(deck.userId, requestingUserId);

    const existing = await this.prisma.deckCard.findUnique({
      where: { deckId_cardId: { deckId, cardId } },
    });
    if (!existing) throw new NotFoundException(`Esa carta no esta en el deck`);

    const newQty = existing.quantity - quantity;
    if (newQty <= 0) {
      await this.prisma.deckCard.delete({ where: { deckId_cardId: { deckId, cardId } } });
    } else {
      await this.prisma.deckCard.update({
        where: { deckId_cardId: { deckId, cardId } },
        data: { quantity: newQty },
      });
    }

    return this.getSummary(deckId);
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