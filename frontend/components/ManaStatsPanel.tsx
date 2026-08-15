import { ManaStatsResponse } from '@/lib/types';
import ManaSymbol from './ManaSymbol';

const BAR_COLOR: Record<string, string> = {
  W: 'bg-mana-W',
  U: 'bg-mana-U',
  B: 'bg-mana-B',
  R: 'bg-mana-R',
  G: 'bg-mana-G',
};

export default function ManaStatsPanel({ stats }: { stats: ManaStatsResponse }) {
  return (
    <div className="border border-border bg-surface rounded-xl p-4">
      <h3 className="font-display text-lg text-text-primary mb-1">Probabilidad de maná por turno</h3>
      <p className="text-xs text-text-muted mb-4 font-mono">{stats.deckSize} cartas en el mazo (sin contar comandante)</p>
      <div className="flex flex-col gap-4">
        {stats.manaStats
          .filter((s) => s.sourceCount > 0)
          .map((s) => (
            <div key={s.color} className="flex items-center gap-3">
              <ManaSymbol color={s.color} />
              <span className="text-xs text-text-muted font-mono w-16 shrink-0">{s.sourceCount} fuentes</span>
              <div className="flex-1 flex gap-1">
                {s.probabilityByTurn.slice(0, 8).map((t) => (
                  <div key={t.turn} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full h-10 bg-surface-raised rounded-sm overflow-hidden flex items-end">
                      <div
                        className={`w-full ${BAR_COLOR[s.color]}`}
                        style={{ height: `${Math.round(t.probability * 100)}%`, opacity: 0.85 }}
                        title={`${Math.round(t.probability * 100)}%`}
                      />
                    </div>
                    <span className="text-[9px] text-text-muted font-mono">T{t.turn}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
