// lib/api.ts
//
// Cliente delgado hacia el backend de SynergyMTG. Ya no maneja
// userId — el backend lo saca del token JWT, asi que cada funcion
// aqui recibe el token como primer argumento.

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

async function apiFetch<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? `Error ${res.status}`);
  }

  return res.json();
}

// ---- Cards ----
export function resolveCard(token: string, name: string): Promise<CardData> {
  return apiFetch<CardData>('/cards/resolve', token, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function autocompleteCard(token: string, query: string): Promise<string[]> {
  return apiFetch<string[]>(`/cards/autocomplete?q=${encodeURIComponent(query)}`, token);
}

export function getCardById(token: string, cardId: string): Promise<CardData> {
  return apiFetch<CardData>(`/cards/${cardId}`, token);
}

// ---- Collection ----
export function getCollection(token: string): Promise<CollectionEntry[]> {
  return apiFetch<CollectionEntry[]>('/collection', token);
}

export function addToCollection(token: string, cardName: string, quantity: number): Promise<CollectionEntry> {
  return apiFetch<CollectionEntry>('/collection', token, {
    method: 'POST',
    body: JSON.stringify({ cardName, quantity }),
  });
}

// ---- Decks ----
export function listDecks(token: string): Promise<DeckSummary[]> {
  return apiFetch<DeckSummary[]>('/decks', token);
}

export function getDeck(token: string, deckId: string): Promise<DeckDetail> {
  return apiFetch<DeckDetail>(`/decks/${deckId}`, token);
}

export function createDeck(token: string, name: string, format: DeckFormat): Promise<DeckSummary> {
  return apiFetch<DeckSummary>('/decks', token, {
    method: 'POST',
    body: JSON.stringify({ name, format }),
  });
}

export function addCardToDeck(
  token: string,
  deckId: string,
  cardId: string,
  quantity: number,
): Promise<DeckSummary> {
  return apiFetch<DeckSummary>(`/decks/${deckId}/cards`, token, {
    method: 'POST',
    body: JSON.stringify({ cardId, quantity }),
  });
}

export function setCommander(token: string, deckId: string, cardId: string): Promise<DeckDetail> {
  return apiFetch<DeckDetail>(`/decks/${deckId}/commander`, token, {
    method: 'POST',
    body: JSON.stringify({ cardId }),
  });
}

export function validateDeck(token: string, deckId: string): Promise<DeckValidation> {
  return apiFetch<DeckValidation>(`/decks/${deckId}/validate`, token);
}

// ---- Analysis ----
export function analyzeDeck(token: string, deckId: string): Promise<EnrichedCandidate[]> {
  return apiFetch<EnrichedCandidate[]>(`/analysis/deck/${deckId}`, token);
}

export function analyzeCollection(token: string): Promise<EnrichedCandidate[]> {
  return apiFetch<EnrichedCandidate[]>('/analysis/collection', token);
}

export function getManaStats(token: string, deckId: string): Promise<ManaStatsResponse> {
  return apiFetch<ManaStatsResponse>(`/analysis/deck/${deckId}/mana-stats`, token);
}