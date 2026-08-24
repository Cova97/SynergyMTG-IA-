// lib/types.ts

export interface CardData {
  id: string;
  name: string;
  oracle_text: string;
  mana_cost: string | null;
  type_line: string;
  colors: string[];
  color_identity: string[];
  rarity: string;
  set: string;
  image_uri: string | null;
}

export interface CollectionEntry {
  card: CardData;
  quantity: number;
}

export type DeckFormat = 'casual' | 'competitive' | 'commander' | 'experimental';

export interface DeckSummary {
  id: string;
  name: string;
  format: DeckFormat;
  cardCount: number;
}

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

export interface DeckValidation {
  valid: boolean;
  issues: string[];
}

export interface AiExplanation {
  combo_found: boolean;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface CandidateConnection {
  fromCardId: string;
  fromCardName: string;
  toCardId: string;
  toCardName: string;
  via: string;
}

export interface CandidateAmplifier {
  cardId: string;
  cardName: string;
  description: string;
}

export interface EnrichedCandidate {
  cardIds: string[];
  cardNames: string[];
  isLoop: boolean;
  aiExplanation: AiExplanation | null;
  amplifiers: CandidateAmplifier[];
  connections: CandidateConnection[];
}

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';

export interface ManaColorStat {
  color: ManaColor;
  sourceCount: number;
  probabilityOpeningHand: number;
  probabilityByTurn: Array<{ turn: number; probability: number }>;
}

export interface ManaStatsResponse {
  deckSize: number;
  manaStats: ManaColorStat[];
}