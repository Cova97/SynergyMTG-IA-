'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Image from 'next/image';
import { EnrichedCandidate, CardData } from '@/lib/types';

interface Props {
  candidates: EnrichedCandidate[];
  cardsById: Map<string, CardData>;
}

// Traduce los nombres internos de recurso a algo legible en la etiqueta
// de la arista — sin esto, el grafo mostraria "creature_attacks_alone"
// tal cual, que no dice nada a alguien que no vio el codigo.
const RESOURCE_LABELS: Record<string, string> = {
  land_enters_battlefield: 'tierra entra',
  land_in_graveyard: 'tierra al cementerio',
  land_on_battlefield: 'tierra en juego',
  creature_dies: 'criatura muere',
  creature_in_graveyard: 'criatura en cementerio',
  creature_enters_battlefield: 'criatura entra',
  flexible_creature_target_enters: 'criatura elegida entra',
  creature_attacks: 'ataca',
  creature_attacks_alone: 'ataca solo',
  creature_modified: 'queda modificada',
  creature_copied: 'se copia',
  counter_plus1plus1: 'contador +1/+1',
  counter_minus1minus1: 'contador -1/-1',
  life_gained: 'gana vida',
  life_lost: 'pierde vida',
  card_drawn: 'roba carta',
  card_discarded: 'descarta carta',
  card_milled: 'mill',
  token_created: 'crea token',
  mana_produced: 'genera maná',
  damage_dealt: 'inflige daño',
  spell_cast: 'lanza hechizo',
  extra_combat_step: 'combate extra',
  permanent_untapped: 'desendereza',
  permanent_exiled: 'exilia',
  permanent_returned_from_exile: 'regresa del exilio',
  creature_attacks_step: 'ataca',
};

function resourceLabel(via: string): string {
  return RESOURCE_LABELS[via] ?? via.replace(/_/g, ' ');
}

function CardNode({ data }: { data: { name: string; imageUri: string | null; isAmplifier: boolean } }) {
  return (
    <div
      className={`relative rounded-lg overflow-hidden border-2 w-24 bg-surface ${
        data.isAmplifier
          ? 'border-mana-W shadow-[0_0_16px_-2px_rgba(248,246,216,0.5)]'
          : 'border-accent shadow-glow'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />
      <div className="relative aspect-[5/7] bg-surface-raised">
        {data.imageUri ? (
          <Image src={data.imageUri} alt={data.name} fill sizes="96px" className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-1">
            <span className="text-[9px] text-text-muted text-center">{data.name}</span>
          </div>
        )}
      </div>
      <p className="text-[10px] text-center text-text-primary py-1 px-1 truncate font-medium">
        {data.name}
      </p>
      {data.isAmplifier && (
        <span
          title="Duplica habilidades desencadenadas"
          className="absolute -top-2 -right-2 bg-mana-W text-black text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
        >
          ×2
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />
    </div>
  );
}

const nodeTypes = { cardNode: CardNode };

export default function SynergyGraph({ candidates, cardsById }: Props) {
  const { nodes, edges } = useMemo(() => {
    const nodeIds = new Set<string>();
    const amplifierIds = new Set<string>();

    for (const c of candidates) {
      c.cardIds.forEach((id) => nodeIds.add(id));
      c.amplifiers.forEach((a) => {
        nodeIds.add(a.cardId);
        amplifierIds.add(a.cardId);
      });
    }

    // Layout circular simple — sin dependencias de auto-layout extra.
    // El usuario puede arrastrar los nodos despues si quiere acomodarlos distinto.
    const idList = [...nodeIds];
    const radius = Math.max(180, idList.length * 45);
    const center = radius + 80;

    const nodes: Node[] = idList.map((id, i) => {
      const angle = (2 * Math.PI * i) / idList.length;
      const card = cardsById.get(id);
      return {
        id,
        type: 'cardNode',
        position: {
          x: center + radius * Math.cos(angle) - 48,
          y: center + radius * Math.sin(angle) - 60,
        },
        data: {
          name: card?.name ?? id,
          imageUri: card?.image_uri ?? null,
          isAmplifier: amplifierIds.has(id),
        },
      };
    });

    const edges: Edge[] = [];

    candidates.forEach((candidate, ci) => {
      (candidate.connections ?? []).forEach((conn, ei) => {
        edges.push({
          id: `c${ci}-e${ei}`,
          source: conn.fromCardId,
          target: conn.toCardId,
          label: resourceLabel(conn.via),
          animated: candidate.isLoop,
          style: {
            stroke: candidate.isLoop ? '#7C6CFF' : '#5A9B6E',
            strokeWidth: candidate.isLoop ? 2.5 : 1.5,
          },
          labelStyle: { fill: '#9095A3', fontSize: 10 },
          labelBgStyle: { fill: '#171A21' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: candidate.isLoop ? '#7C6CFF' : '#5A9B6E',
          },
        });
      });

      // Aristas punteadas hacia los amplificadores — nunca son parte
      // del combo en si, por eso se dibujan distinto (sin flecha
      // solida, sin animacion de loop).
      (candidate.amplifiers ?? []).forEach((amp, ai) => {
        candidate.cardIds.forEach((targetId, ti) => {
          edges.push({
            id: `c${ci}-amp${ai}-${ti}`,
            source: amp.cardId,
            target: targetId,
            label: 'duplica',
            style: { stroke: '#F8F6D8', strokeWidth: 1, strokeDasharray: '4 3' },
            labelStyle: { fill: '#F8F6D8', fontSize: 9 },
            labelBgStyle: { fill: '#171A21' },
          });
        });
      });
    });

    return { nodes, edges };
  }, [candidates, cardsById]);

  if (candidates.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl py-20 text-center">
        <p className="text-text-muted text-sm">
          No se encontraron combos con las cartas de este deck.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[560px] rounded-xl border border-border bg-surface overflow-hidden">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
        <Background color="#2A2E38" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
