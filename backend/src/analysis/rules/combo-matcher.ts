// src/analysis/rules/combo-matcher.ts
//
// Construye un grafo dirigido carta -> carta: hay una arista de A a B
// si algun recurso que A PRODUCE es consumido por algun patron que B
// tiene (ya sea un trigger que escucha ese recurso, o un efecto que
// lo necesita como costo). Sobre ese grafo:
//   - findChains: cadenas de cartas conectadas (candidatos a sinergia)
//   - findLoops: ciclos en el grafo (candidatos a combo infinito/repetible)

import { ResourceType, TaggedCard, expandWithImplications } from './pattern-dictionary';

export interface CandidateGroup {
  cardIds: string[];
  /** true si el grupo forma un ciclo (potencial loop infinito/repetible) */
  isLoop: boolean;
  /** Recursos que conectan cada salto de la cadena, para explicarle a la IA despues */
  connections: Array<{ from: string; to: string; via: ResourceType }>;
  /**
   * Cartas presentes en el pool (no necesariamente parte del grupo)
   * que DUPLICAN alguna de las conexiones de este grupo — ej. Isshin,
   * Two Heavens as One duplicando un trigger de ataque. No se
   * modelan como nodos normales del grafo porque no producen ni
   * consumen un recurso, solo multiplican una conexion que ya existe.
   */
  amplifiers: Array<{ cardId: string; amplifierId: string; via: ResourceType }>;
}

interface Edge {
  from: string;
  to: string;
  via: ResourceType;
}

function buildResourceGraph(taggedCards: TaggedCard[]): Edge[] {
  const edges: Edge[] = [];

  for (const producer of taggedCards) {
    const producedResources = expandWithImplications(
      new Set<ResourceType>(producer.matchedPatterns.flatMap((p) => p.produces)),
    );
    if (producedResources.size === 0) continue;

    for (const consumer of taggedCards) {
      if (consumer.cardId === producer.cardId) continue;

      const consumedResources = new Set<ResourceType>(
        consumer.matchedPatterns.flatMap((p) => p.consumes),
      );

      for (const resource of producedResources) {
        if (consumedResources.has(resource)) {
          edges.push({ from: producer.cardId, to: consumer.cardId, via: resource });
        }
      }
    }
  }

  return edges;
}

/**
 * Descarta loops que son "superconjunto" de un loop mas chico ya
 * encontrado — es decir, contienen TODAS las cartas de un combo mas
 * simple mas una pieza extra colgada que no aporta un mecanismo
 * nuevo. Sin esto, un set de cartas con varios patrones compartidos
 * (ej. contador <-> vida) genera decenas de variantes redundantes del
 * mismo combo base en vez de mostrar los combos minimos reales.
 */
function dedupeLoops(loops: CandidateGroup[]): CandidateGroup[] {
  return loops.filter((loop) => {
    const cardSet = new Set(loop.cardIds);
    const isSupersetOfSmaller = loops.some((other) => {
      if (other === loop) return false;
      const otherSet = new Set(other.cardIds);
      if (otherSet.size >= cardSet.size) return false; // solo comparar contra loops MAS chicos
      return [...otherSet].every((id) => cardSet.has(id));
    });
    return !isSupersetOfSmaller;
  });
}

/**
 * Busca ciclos en el grafo (A -> B -> C -> A) usando DFS.
 * Un ciclo es un candidato fuerte a "combo infinito o muy repetible" —
 * exactamente el patron del combo de Zuran Orb + Ramunap Excavator +
 * Lotus Cobra + Scute Swarm.
 */
function findLoops(edges: Edge[]): CandidateGroup[] {
  const adjacency = new Map<string, Edge[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge);
  }

  const loops: CandidateGroup[] = [];
  const seenLoopKeys = new Set<string>();

  function dfs(start: string, current: string, path: Edge[], visited: Set<string>) {
    const outgoing = adjacency.get(current) ?? [];

    for (const edge of outgoing) {
      if (edge.to === start && path.length >= 1) {
        const cardIds = [...new Set([start, ...path.map((e) => e.to)])];
        const key = [...cardIds].sort().join('|');
        if (!seenLoopKeys.has(key)) {
          seenLoopKeys.add(key);
          loops.push({
            cardIds,
            isLoop: true,
            connections: [...path, edge],
            amplifiers: [],
          });
        }
        continue;
      }

      if (visited.has(edge.to) || path.length >= 5) continue; // limite razonable de profundidad

      visited.add(edge.to);
      dfs(start, edge.to, [...path, edge], visited);
      visited.delete(edge.to);
    }
  }

  for (const node of adjacency.keys()) {
    dfs(node, node, [], new Set([node]));
  }

  return loops;
}

/**
 * Cadenas lineales (sin ciclo) de al menos 2 cartas conectadas — para
 * sinergias que no son loops infinitos pero si combinan bien
 * (ej. "crea tokens" -> "beneficio por cada criatura que entra").
 */
function findChains(edges: Edge[], loopCardIds: Set<string>): CandidateGroup[] {
  const chains: CandidateGroup[] = [];
  const seen = new Set<string>();

  for (const edge of edges) {
    // Evita duplicar pares que ya forman parte de un loop detectado
    if (loopCardIds.has(edge.from) && loopCardIds.has(edge.to)) continue;

    const key = [edge.from, edge.to].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    chains.push({
      cardIds: [edge.from, edge.to],
      isLoop: false,
      connections: [edge],
      amplifiers: [],
    });
  }

  return chains;
}

/**
 * Anota cada grupo candidato con las cartas del pool que DUPLICAN
 * alguna de sus conexiones (ej. Isshin, Two Heavens as One duplicando
 * un trigger de ataque). Recorre TODAS las cartas etiquetadas (no
 * solo las del grupo), porque el amplificador puede ser una carta
 * fuera del combo especifico pero presente en la coleccion/deck.
 */
function attachAmplifiers(candidates: CandidateGroup[], taggedCards: TaggedCard[]): void {
  for (const candidate of candidates) {
    const resourcesInGroup = new Set(candidate.connections.map((c) => c.via));

    for (const card of taggedCards) {
      for (const amp of card.amplifierMatches) {
        const overlap = amp.amplifies.filter((r) => resourcesInGroup.has(r));
        if (overlap.length > 0) {
          for (const via of overlap) {
            candidate.amplifiers.push({ cardId: card.cardId, amplifierId: amp.id, via });
          }
        }
      }
    }
  }
}

/**
 * Descarta cadenas sueltas de 2 cartas cuando la misma informacion ya
 * esta cubierta por un amplifier de otro grupo — ej. si Isshin ya
 * aparece como amplifier del loop Raiyuu+Selfless Samurai, no hace
 * falta ademas mostrar "Isshin + Raiyuu" como cadena suelta aparte,
 * es la misma relacion contada dos veces con dos enfoques distintos.
 */
function filterRedundantAmplifierChains(candidates: CandidateGroup[]): CandidateGroup[] {
  return candidates.filter((candidate) => {
    if (candidate.isLoop || candidate.cardIds.length !== 2) return true;

    const [a, b] = candidate.cardIds;

    const isRedundant = candidates.some((other) => {
      if (other === candidate) return false;
      const otherAmplifierIds = new Set(other.amplifiers.map((amp) => amp.cardId));
      const otherCardIds = new Set(other.cardIds);

      return (
        (otherAmplifierIds.has(a) && otherCardIds.has(b)) ||
        (otherAmplifierIds.has(b) && otherCardIds.has(a))
      );
    });

    return !isRedundant;
  });
}

/**
 * Punto de entrada del motor de reglas: recibe las cartas ya
 * etiquetadas (via tagCard) y regresa los grupos candidatos a
 * sinergia/combo, priorizando loops sobre cadenas simples.
 */
export function findComboCandidates(taggedCards: TaggedCard[]): CandidateGroup[] {
  const edges = buildResourceGraph(taggedCards);
  const rawLoops = findLoops(edges);
  const loops = dedupeLoops(rawLoops);
  const loopCardIds = new Set(loops.flatMap((l) => l.cardIds));
  const chains = findChains(edges, loopCardIds);

  const candidates = [...loops, ...chains];
  attachAmplifiers(candidates, taggedCards);

  // Loops primero: son los candidatos mas fuertes (repetibles/infinitos)
  return filterRedundantAmplifierChains(candidates);
}
