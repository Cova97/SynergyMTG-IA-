// src/analysis/stats/stats.service.ts

import { Injectable } from '@nestjs/common';
import { hypergeometricAtLeast } from './hypergeometric';
import { getProducedManaColors, MANA_COLORS, ManaColor } from './mana-sources';

export interface DeckCardForStats {
  typeLine: string;
  oracleText: string;
  quantity: number;
}

export interface ManaColorStat {
  color: ManaColor;
  /** Cuantas copias en el deck pueden producir este color */
  sourceCount: number;
  /** P(al menos 1 fuente de este color) en la mano inicial de 7 */
  probabilityOpeningHand: number;
  /** P(al menos 1 fuente) acumulada turno por turno */
  probabilityByTurn: Array<{ turn: number; probability: number }>;
}

const OPENING_HAND_SIZE = 7;
const MAX_TURN = 10;

@Injectable()
export class StatsService {
  /**
   * deckSize debe ser el tamaño real de la BIBLIOTECA de la que se
   * roba — en Commander son las 99 cartas normales, el comandante NO
   * cuenta (vive en la zona de mando, nunca se mezcla ni se roba).
   */
  calculateManaStats(deckSize: number, cards: DeckCardForStats[]): ManaColorStat[] {
    return MANA_COLORS.map((color) => {
      const sourceCount = cards.reduce((sum, card) => {
        const produced = getProducedManaColors(card.typeLine, card.oracleText);
        return produced.has(color) ? sum + card.quantity : sum;
      }, 0);

      const probabilityByTurn: Array<{ turn: number; probability: number }> = [];

      // Asume que juegas primero: mano de 7 + 1 carta robada por cada
      // turno DESPUES del primero (el jugador que empieza no roba en
      // su propio turno 1). Es una aproximacion — no distingue "en la
      // banca" ni efectos que roban cartas extra.
      for (let turn = 1; turn <= MAX_TURN; turn++) {
        const sampleSize = OPENING_HAND_SIZE + Math.max(turn - 1, 0);
        probabilityByTurn.push({
          turn,
          probability: hypergeometricAtLeast(deckSize, sourceCount, sampleSize, 1),
        });
      }

      return {
        color,
        sourceCount,
        probabilityOpeningHand: hypergeometricAtLeast(deckSize, sourceCount, OPENING_HAND_SIZE, 1),
        probabilityByTurn,
      };
    });
  }
}
