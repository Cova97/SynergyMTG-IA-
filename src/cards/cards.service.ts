import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Card as PrismaCard } from '@prisma/client';

export interface CardData {
  id: string; // UUID real de Scryfall
  name: string;
  oracle_text: string;
  mana_cost: string | null;
  type_line: string;
  colors: string[];
  rarity: string;
  set: string;
  image_uri: string | null;
}

const SCRYFALL_HEADERS = {
  'User-Agent': 'SynergyMTG/0.1 (proyecto personal de coleccion MTG)',
  Accept: '*/*',
};

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resuelve un nombre de carta: primero busca en Postgres (cache
   * persistente); si no esta, la busca en Scryfall (fuzzy match) y la
   * guarda antes de regresarla. Asi, la segunda vez que alguien pida
   * la misma carta, no se vuelve a llamar a la API externa.
   */
  async resolveByName(name: string): Promise<CardData> {
    const existing = await this.prisma.card.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
    });
    if (existing) return this.fromPrisma(existing);

    const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: SCRYFALL_HEADERS });

    if (!res.ok) {
      throw new NotFoundException(
        `No se encontro la carta "${name}" en Scryfall (${res.status})`,
      );
    }

    const raw = await res.json();
    const cardData = this.mapScryfallCard(raw);

    const saved = await this.prisma.card.upsert({
      where: { id: cardData.id },
      update: {}, // si ya existe (carrera entre requests), no se pisa
      create: {
        id: cardData.id,
        name: cardData.name,
        oracleText: cardData.oracle_text,
        manaCost: cardData.mana_cost,
        typeLine: cardData.type_line,
        colors: cardData.colors,
        rarity: cardData.rarity,
        set: cardData.set,
        imageUri: cardData.image_uri,
      },
    });

    return this.fromPrisma(saved);
  }

  /** Regresa una carta ya guardada en Postgres por su id, o null si nunca se resolvio. */
  async getById(id: string): Promise<CardData | null> {
    const card = await this.prisma.card.findUnique({ where: { id } });
    return card ? this.fromPrisma(card) : null;
  }

  /** Autocomplete para UI de busqueda — no persiste nada, solo sugiere nombres. */
  async autocomplete(query: string): Promise<string[]> {
    const url = `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: SCRYFALL_HEADERS });
    if (!res.ok) return [];

    const data = await res.json();
    return data.data ?? [];
  }

  private fromPrisma(card: PrismaCard): CardData {
    return {
      id: card.id,
      name: card.name,
      oracle_text: card.oracleText,
      mana_cost: card.manaCost,
      type_line: card.typeLine,
      colors: card.colors,
      rarity: card.rarity,
      set: card.set,
      image_uri: card.imageUri,
    };
  }

  private mapScryfallCard(raw: any): CardData {
    // Cartas de doble cara (transform/MDFC): el oracle_text no viene
    // en el nivel raiz, hay que leerlo de card_faces[].
    const oracleText =
      raw.oracle_text ??
      (raw.card_faces ?? [])
        .map((face: any) => `${face.name}: ${face.oracle_text ?? ''}`)
        .join('\n // \n');

    return {
      id: raw.id,
      name: raw.name,
      oracle_text: oracleText ?? '',
      mana_cost: raw.mana_cost ?? null,
      type_line: raw.type_line ?? '',
      colors: raw.colors ?? [],
      rarity: raw.rarity ?? '',
      set: raw.set ?? '',
      image_uri: raw.image_uris?.normal ?? raw.card_faces?.[0]?.image_uris?.normal ?? null,
    };
  }
}
