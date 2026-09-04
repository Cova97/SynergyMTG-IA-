'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteDeck } from '@/lib/api';
import { getClientToken } from '@/lib/auth-client';

export default function DeleteDeckButton({ deckId }: { deckId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    const token = getClientToken();
    if (!token) return;

    setLoading(true);
    try {
      await deleteDeck(token, deckId);
      router.push('/decks');
      router.refresh();
    } catch {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">¿Borrar este deck?</span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-mana-R text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Borrando…' : 'Sí, borrar'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="text-xs font-medium px-3 py-1.5 rounded-md border border-border text-text-muted hover:text-text-primary transition-colors"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs font-medium px-3 py-1.5 rounded-md border border-border text-text-muted hover:text-mana-R hover:border-mana-R transition-colors"
    >
      Borrar deck
    </button>
  );
}
