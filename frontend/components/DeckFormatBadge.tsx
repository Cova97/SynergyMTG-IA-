import { DeckFormat } from '@/lib/types';

const FORMAT_STYLES: Record<DeckFormat, string> = {
  commander: 'bg-accent/15 text-accent border-accent/30',
  casual: 'bg-mana-G/15 text-mana-G border-mana-G/30',
  competitive: 'bg-mana-R/15 text-mana-R border-mana-R/30',
  experimental: 'bg-mana-U/15 text-mana-U border-mana-U/30',
};

const FORMAT_LABELS: Record<DeckFormat, string> = {
  commander: 'Commander',
  casual: 'Casual',
  competitive: 'Competitive',
  experimental: 'Experimental',
};

export default function DeckFormatBadge({ format }: { format: DeckFormat }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono border ${FORMAT_STYLES[format]}`}
    >
      {FORMAT_LABELS[format]}
    </span>
  );
}
