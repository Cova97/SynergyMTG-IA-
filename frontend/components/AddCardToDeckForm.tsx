'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveCard, addCardToDeck, setCommander } from '@/lib/api';
import { DeckFormat } from '@/lib/types';

export default function AddCardToDeckForm({ deckId, format }: { deckId: string; format: DeckFormat }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [asCommander, setAsCommander] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const card = await resolveCard(name.trim());
      if (asCommander) {
        await setCommander(deckId, card.id);
      } else {
        await addCardToDeck(deckId, card.id, quantity);
      }
      setName('');
      setQuantity(1);
      setAsCommander(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la carta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[200px]">
        <label className="text-xs text-text-muted mb-1 block">Nombre de la carta</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ej. Ancestral Katana"
          className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      {!asCommander && (
        <div className="w-20">
          <label className="text-xs text-text-muted mb-1 block">Cantidad</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      )}
      {format === 'commander' && (
        <label className="flex items-center gap-1.5 text-xs text-text-muted pb-2.5">
          <input
            type="checkbox"
            checked={asCommander}
            onChange={(e) => setAsCommander(e.target.checked)}
          />
          es mi comandante
        </label>
      )}
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="bg-accent hover:bg-accent-dim disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
      >
        {loading ? 'Agregando…' : 'Agregar al deck'}
      </button>
      {error && <p className="text-xs text-mana-R w-full">{error}</p>}
    </form>
  );
}
