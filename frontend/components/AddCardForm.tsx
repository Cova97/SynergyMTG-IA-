'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addToCollection } from '@/lib/api';

export default function AddCardForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await addToCollection(name.trim(), quantity);
      setName('');
      setQuantity(1);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la carta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1">
        <label className="text-xs text-text-muted mb-1 block">Nombre de la carta</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ej. Zuran Orb"
          className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
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
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="bg-accent hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
      >
        {loading ? 'Agregando…' : 'Agregar'}
      </button>
      {error && <p className="text-xs text-mana-R absolute mt-14">{error}</p>}
    </form>
  );
}
