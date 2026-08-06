import { Injectable, Logger, NotFoundException } from '@nestjs/common';

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

  // Cache en memoria: id de Scryfall -> datos de la carta. Evita
  // volver a golpear la API por cartas ya resueltas antes. Se pierde
  // al reiniciar el proceso — cuando se conecte Prisma, esto se
  // reemplaza por la tabla Card real (misma interfaz publica, el
  // resto del backend no se entera del cambio).
  private readonly cache = new Map<string, CardData>();

  /**
   * Resuelve un nombre de carta contra Scryfall (fuzzy match — tolera
   * errores tipograficos). Si ya esta en cache por nombre, no vuelve
   * a llamar a la API.
   */
  async resolveByName(name: string): Promise<CardData> {
    const cached = this.findInCacheByName(name);
    if (cached) return cached;

    const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: SCRYFALL_HEADERS });

    if (!res.ok) {
      throw new NotFoundException(
        `No se encontro la carta "${name}" en Scryfall (${res.status})`,
      );
    }

    const raw = await res.json();
    const card = this.mapScryfallCard(raw);
    this.cache.set(card.id, card);
    return card;
  }

  /** Regresa una carta ya cacheada por su id, o null si nunca se resolvio. */
  getById(id: string): CardData | null {
    return this.cache.get(id) ?? null;
  }

  /**
   * Autocomplete para UI de busqueda — no cachea resultados completos,
   * solo regresa nombres sugeridos.
   */
  async autocomplete(query: string): Promise<string[]> {
    const url = `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: SCRYFALL_HEADERS });
    if (!res.ok) return [];

    const data = await res.json();
    return data.data ?? [];
  }

  private findInCacheByName(name: string): CardData | null {
    const normalized = name.trim().toLowerCase();
    for (const card of this.cache.values()) {
      if (card.name.toLowerCase() === normalized) return card;
    }
    return null;
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
