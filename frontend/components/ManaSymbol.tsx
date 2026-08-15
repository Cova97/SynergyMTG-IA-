const COLOR_MAP: Record<string, string> = {
  W: 'bg-mana-W text-black/70',
  U: 'bg-mana-U text-white',
  B: 'bg-mana-B text-white',
  R: 'bg-mana-R text-white',
  G: 'bg-mana-G text-white',
};

export default function ManaSymbol({ color, size = 'sm' }: { color: string; size?: 'sm' | 'xs' }) {
  const dims = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-4 h-4 text-[9px]';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-mono font-medium ${dims} ${
        COLOR_MAP[color] ?? 'bg-text-muted text-black/70'
      }`}
    >
      {color}
    </span>
  );
}
