'use client';

import { useState } from 'react';
import { analyzeDeck, analyzeCollection } from '@/lib/api';
import { getClientToken } from '@/lib/auth-client';
import { EnrichedCandidate, CardData } from '@/lib/types';
import SynergyGraph from './SynergyGraph';
import CandidateCard from './CandidateCard';

type Props =
  | { mode: 'deck'; deckId: string; cardsById: Map<string, CardData> }
  | { mode: 'collection'; cardsById: Map<string, CardData> };

export default function AnalysisPanel(props: Props) {
  const [candidates, setCandidates] = useState<EnrichedCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    const token = getClientToken();
    if (!token) {
      setError('Tu sesión expiró, inicia sesión de nuevo');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result =
        props.mode === 'deck' ? await analyzeDeck(token, props.deckId) : await analyzeCollection(token);
      setCandidates(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl text-text-primary">Sinergias</h3>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          {loading
            ? 'Analizando… (puede tardar hasta 1-2 min)'
            : candidates
              ? 'Volver a analizar'
              : 'Analizar combos'}
        </button>
      </div>

      {error && <p className="text-sm text-mana-R mb-4">{error}</p>}

      {candidates && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          <SynergyGraph candidates={candidates} cardsById={props.cardsById} />
          <div className="flex flex-col gap-3 max-h-[560px] overflow-y-auto pr-1">
            {candidates.length === 0 ? (
              <p className="text-sm text-text-muted">No se encontraron combos con estas cartas.</p>
            ) : (
              candidates.map((c, i) => <CandidateCard key={i} candidate={c} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}