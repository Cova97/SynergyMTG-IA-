import { EnrichedCandidate } from '@/lib/types';

const CONFIDENCE_COLOR: Record<string, string> = {
  high: 'text-mana-G',
  medium: 'text-mana-W',
  low: 'text-mana-R',
};

export default function CandidateCard({ candidate }: { candidate: EnrichedCandidate }) {
  return (
    <div className="border border-border bg-surface rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            candidate.isLoop ? 'bg-accent/20 text-accent' : 'bg-mana-G/20 text-mana-G'
          }`}
        >
          {candidate.isLoop ? 'LOOP' : 'CADENA'}
        </span>
        {candidate.aiExplanation && (
          <span className={`text-[10px] font-mono ${CONFIDENCE_COLOR[candidate.aiExplanation.confidence]}`}>
            {candidate.aiExplanation.confidence}
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-text-primary mb-1">{candidate.cardNames.join(' + ')}</p>
      {candidate.aiExplanation ? (
        <p className="text-xs text-text-muted leading-relaxed">{candidate.aiExplanation.explanation}</p>
      ) : (
        <p className="text-xs text-text-muted italic">Sin explicación de la IA para este grupo.</p>
      )}
      {candidate.amplifiers.length > 0 && (
        <p className="text-xs text-mana-W mt-2">
          ✦ Se duplica con: {candidate.amplifiers.map((a) => a.cardName).join(', ')}
        </p>
      )}
    </div>
  );
}
