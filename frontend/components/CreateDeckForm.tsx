'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDeck } from '@/lib/api';
import { getClientToken } from '@/lib/auth-client';
import { DeckFormat } from '@/lib/types';

const FORMATS: { value: DeckFormat; label: string }[] = [
  { value: 'commander', label: 'Commander' },
  { value: 'casual', label: 'Casual' },
  { value: 'competitive', label: 'Competitive' },
  { value: 'experimental', label: 'Experimental' },
];

export default function CreateDeckForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [format, setFormat] = useState<DeckFormat>('commander');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const token = getClientToken();
    if (!token) {
      setError('Tu sesión expiró, inicia sesión de nuevo');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const deck = await createDeck(token, name.trim(), format);
      router.push(`/decks/${deck.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el deck');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1">
        <label className="text-xs text-text-muted mb-1 block">Nombre del deck</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ej. Samurais que atacan solos"
          className="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div>
        <label className="text-xs text-text-muted mb-1 block">Formato</label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as DeckFormat)}
          className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {FORMATS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="bg-accent hover:bg-accent-dim disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
      >
        {loading ? 'Creando…' : 'Crear deck'}
      </button>
      {error && <p className="text-xs text-mana-R w-full">{error}</p>}
    </form>
  );
}