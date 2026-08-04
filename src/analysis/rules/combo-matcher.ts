// src/analysis/rules/combo-matcher.ts
//
// Construye un grafo dirigido carta -> carta: hay una arista de A a B
// si algun recurso que A PRODUCE es consumido por algun patron que B
// tiene (ya sea un trigger que escucha ese recurso, o un efecto que
// lo necesita como costo). Sobre ese grafo:
//   - findChains: cadenas de cartas conectadas (candidatos a sinergia)
//   - findLoops: ciclos en el grafo (candidatos a combo infinito/repetible)

import { ResourceType, TaggedCard } from './pattern-dictionary';

export interface CandidateGroup {
  cardIds: string[];
  /** true si el grupo forma un ciclo (potencial loop infinito/repetible) */
  isLoop: boolean;
  /** Recursos que conectan cada salto de la cadena, para explicarle a la IA despues */
  connections: Array<{ from: string; to: string; via: ResourceType }>;
}

interface Edge {
  from: string;
  to: string;
  via: ResourceType;
}

function buildResourceGraph(taggedCards: TaggedCard[]): Edge[] {
  const edges: Edge[] = [];

  for (const producer of taggedCards) {
    const producedResources = new Set<ResourceType>(
      producer.matchedPatterns.flatMap((p) => p.produces),
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
    });
  }

  return chains;
}

/**
 * Punto de entrada del motor de reglas: recibe las cartas ya
 * etiquetadas (via tagCard) y regresa los grupos candidatos a
 * sinergia/combo, priorizando loops sobre cadenas simples.
 */
export function findComboCandidates(taggedCards: TaggedCard[]): CandidateGroup[] {
  const edges = buildResourceGraph(taggedCards);
  const loops = findLoops(edges);
  const loopCardIds = new Set(loops.flatMap((l) => l.cardIds));
  const chains = findChains(edges, loopCardIds);

  // Loops primero: son los candidatos mas fuertes (repetibles/infinitos)
  return [...loops, ...chains];
}