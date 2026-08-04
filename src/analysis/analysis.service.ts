// src/analysis/analysis.service.ts
//
// Orquesta el pipeline completo: motor de reglas (descubre candidatos)
// -> servicio de IA (explica cada candidato). Nunca al reves — la IA
// jamas recibe la coleccion completa de una vez, solo grupos ya
// filtrados por el motor de reglas.

import { Injectable, Logger } from '@nestjs/common';
import { tagCard } from './rules/pattern-dictionary';
import { findComboCandidates, CandidateGroup } from './rules/combo-matcher';
import { ComboAnalysisAiService } from '../combo-analysis-ai.service';

export interface CardInput {
  id: string;
  name: string;
  oracle_text: string;
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
    const tagged = cards.map((c) => tagCard(c.id, c.oracle_text));
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

      results.push({
        cardIds: candidate.cardIds,
        cardNames: candidateCards.map((c) => c.name),
        isLoop: candidate.isLoop,
        aiExplanation,
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