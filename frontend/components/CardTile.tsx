import Image from 'next/image';
import { CardData } from '@/lib/types';
import ManaSymbol from './ManaSymbol';

export default function CardTile({
  card,
  quantity,
  highlighted = false,
  onClick,
}: {
  card: CardData;
  quantity?: number;
  highlighted?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full flex-col rounded-xl overflow-hidden border bg-surface text-left transition-all ${
        highlighted
          ? 'border-accent shadow-glow scale-[1.02]'
          : 'border-border hover:border-accent-dim hover:-translate-y-0.5'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="relative aspect-[5/7] bg-surface-raised">
        {card.image_uri ? (
          <Image
            src={card.image_uri}
            alt={card.name}
            fill
            sizes="(max-width: 768px) 45vw, 180px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-3 text-center">
            <span className="font-display italic text-sm text-text-muted">{card.name}</span>
          </div>
        )}
        {quantity !== undefined && quantity > 1 && (
          <span className="absolute top-1.5 right-1.5 bg-bg/85 border border-border text-text-primary text-xs font-mono px-1.5 py-0.5 rounded-md">
            ×{quantity}
          </span>
        )}
      </div>
      <div className="px-2.5 py-2 flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-text-primary truncate">{card.name}</span>
        {card.colors.length > 0 && (
          <div className="flex gap-0.5 shrink-0">
            {card.colors.map((c) => (
              <ManaSymbol key={c} color={c} size="xs" />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
