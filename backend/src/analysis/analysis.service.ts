// src/analysis/analysis.service.ts
//
// Orquesta el pipeline completo: motor de reglas (descubre candidatos)
// -> servicio de IA (explica cada candidato). Nunca al reves — la IA
// jamas recibe la coleccion completa de una vez, solo grupos ya
// filtrados por el motor de reglas.

import { Injectable, Logger } from '@nestjs/common';
import { tagCard, AMPLIFIER_PATTERNS } from './rules/pattern-dictionary';
import { findComboCandidates, CandidateGroup } from './rules/combo-matcher';
import { ComboAnalysisAiService } from './ai/combo-analysis-ai.service';

export interface CardInput {
  id: string;
  name: string;
  oracle_text: string;
  type_line?: string;
}

export interface EnrichedCandidate {
  cardIds: string[];
  cardNames: string[];
  isLoop: boolean;
  /** null si la IA fallo, se descarto por el validador, o no se llego a llamar (limite de candidatos) */
  aiExplanation: {
    combo_found: boolean;
    explanation: string;
    confidence: 'high' | 'medium' | 'low';
  } | null;
  /**
   * Cartas en el pool que DUPLICAN alguna conexion de este grupo
   * (ej. Isshin, Two Heavens as One duplicando un trigger de ataque).
   * No son parte del combo en si — son un plus si tambien las tienes.
   */
  amplifiers: Array<{ cardId: string; cardName: string; description: string }>;
  /**
   * Las conexiones exactas del grafo (que carta produce que recurso
   * que otra consume), con nombres ya resueltos — el frontend las usa
   * para dibujar el grafo real, no solo la lista de cartas del grupo.
   */
  connections: Array<{
    fromCardId: string;
    fromCardName: string;
    toCardId: string;
    toCardName: string;
    via: string;
  }>;
}

// Limite de candidatos que se mandan a la IA por corrida — protege la
// cuota del free tier de NVIDIA (~40 req/min) cuando una coleccion
// grande genera muchos grupos candidatos a la vez.
const MAX_CANDIDATES_TO_EXPLAIN = 10;

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(private readonly aiService: ComboAnalysisAiService) {}

  async analyzeCollection(cards: CardInput[]): Promise<EnrichedCandidate[]> {
    const cardsById = new Map(cards.map((c) => [c.id, c]));

    // 1. Motor de reglas: descubre candidatos de forma deterministica
    const tagged = cards.map((c) => tagCard(c.id, c.oracle_text, c.type_line));
    const candidates = findComboCandidates(tagged);

    if (candidates.length === 0) {
      return [];
    }

    // Los loops ya vienen primero (son los candidatos mas fuertes) —
    // se respeta ese orden al recortar por el limite de cuota.
    const toProcess = candidates.slice(0, MAX_CANDIDATES_TO_EXPLAIN);
    if (candidates.length > MAX_CANDIDATES_TO_EXPLAIN) {
      this.logger.warn(
        `${candidates.length} candidatos encontrados, se explican solo los primeros ${MAX_CANDIDATES_TO_EXPLAIN}`,
      );
    }

    const results: EnrichedCandidate[] = [];

    // 2. Secuencial (no Promise.all): respeta el rate limit del free
    // tier y evita saturar la API con llamadas concurrentes.
    for (const candidate of toProcess) {
      const candidateCards = this.resolveCards(candidate, cardsById);

      let aiExplanation: EnrichedCandidate['aiExplanation'] = null;
      try {
        aiExplanation = await this.aiService.analyzeCombo(candidateCards, candidate.connections);
      } catch (err) {
        this.logger.error(
          `Fallo explicando candidato [${candidate.cardIds.join(', ')}]: ${(err as Error).message}`,
        );
        // No se detiene el resto del pipeline por un fallo puntual de IA
      }

      const amplifierDescriptions = new Map(AMPLIFIER_PATTERNS.map((a) => [a.id, a.description]));
      const uniqueAmplifierCardIds = [...new Set(candidate.amplifiers.map((a) => a.cardId))];
      const amplifiers = uniqueAmplifierCardIds.map((cardId) => {
        const matchingAmp = candidate.amplifiers.find((a) => a.cardId === cardId)!;
        return {
          cardId,
          cardName: cardsById.get(cardId)?.name ?? cardId,
          description: amplifierDescriptions.get(matchingAmp.amplifierId) ?? '',
        };
      });

      const connections = candidate.connections.map((c) => ({
        fromCardId: c.from,
        fromCardName: cardsById.get(c.from)?.name ?? c.from,
        toCardId: c.to,
        toCardName: cardsById.get(c.to)?.name ?? c.to,
        via: c.via,
      }));

      results.push({
        cardIds: candidate.cardIds,
        cardNames: candidateCards.map((c) => c.name),
        isLoop: candidate.isLoop,
        aiExplanation,
        amplifiers,
        connections,
      });
    }

    return results;
  }

  private resolveCards(
    candidate: CandidateGroup,
    cardsById: Map<string, CardInput>,
  ): CardInput[] {
    return candidate.cardIds
      .map((id) => cardsById.get(id))
      .filter((c): c is CardInput => c !== undefined);
  }
}
