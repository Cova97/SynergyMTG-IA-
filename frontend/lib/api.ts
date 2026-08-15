// lib/api.ts
//
// Cliente delgado hacia el backend de SynergyMTG. Nada de estado ni
// cache aqui — cada funcion es un fetch tipado, simple de leer.

import {
  CardData,
  CollectionEntry,
  DeckDetail,
  DeckSummary,
  DeckValidation,
  DeckFormat,
  EnrichedCandidate,
  ManaStatsResponse,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export const USER_ID = process.env.NEXT_PUBLIC_USER_ID ?? 'cova-test';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? `Error ${res.status}`);
  }

  return res.json();
}

// ---- Cards ----
export function resolveCard(name: string): Promise<CardData> {
  return apiFetch<CardData>('/cards/resolve', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function autocompleteCard(query: string): Promise<string[]> {
  return apiFetch<string[]>(`/cards/autocomplete?q=${encodeURIComponent(query)}`);
}

export function getCardById(cardId: string): Promise<CardData> {
  return apiFetch<CardData>(`/cards/${cardId}`);
}

// ---- Collection ----
export function getCollection(userId: string = USER_ID): Promise<CollectionEntry[]> {
  return apiFetch<CollectionEntry[]>(`/collection/${userId}`);
}

export function addToCollection(
  cardName: string,
  quantity: number,
  userId: string = USER_ID,
): Promise<CollectionEntry> {
  return apiFetch<CollectionEntry>(`/collection/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ cardName, quantity }),
  });
}

// ---- Decks ----
export function listDecks(userId: string = USER_ID): Promise<DeckSummary[]> {
  return apiFetch<DeckSummary[]>(`/decks/user/${userId}`);
}

export function getDeck(deckId: string): Promise<DeckDetail> {
  return apiFetch<DeckDetail>(`/decks/${deckId}`);
}

export function createDeck(
  name: string,
  format: DeckFormat,
  userId: string = USER_ID,
): Promise<DeckSummary> {
  return apiFetch<DeckSummary>(`/decks/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ name, format }),
  });
}

export function addCardToDeck(deckId: string, cardId: string, quantity: number): Promise<DeckSummary> {
  return apiFetch<DeckSummary>(`/decks/${deckId}/cards`, {
    method: 'POST',
    body: JSON.stringify({ cardId, quantity }),
  });
}

export function setCommander(deckId: string, cardId: string): Promise<DeckDetail> {
  return apiFetch<DeckDetail>(`/decks/${deckId}/commander`, {
    method: 'POST',
    body: JSON.stringify({ cardId }),
  });
}

export function validateDeck(deckId: string): Promise<DeckValidation> {
  return apiFetch<DeckValidation>(`/decks/${deckId}/validate`);
}

// ---- Analysis ----
export function analyzeDeck(deckId: string): Promise<EnrichedCandidate[]> {
  return apiFetch<EnrichedCandidate[]>(`/analysis/deck/${deckId}`);
}

export function analyzeCollection(userId: string = USER_ID): Promise<EnrichedCandidate[]> {
  return apiFetch<EnrichedCandidate[]>(`/analysis/collection/${userId}`);
}

export function getManaStats(deckId: string): Promise<ManaStatsResponse> {
  return apiFetch<ManaStatsResponse>(`/analysis/deck/${deckId}/mana-stats`);
}
