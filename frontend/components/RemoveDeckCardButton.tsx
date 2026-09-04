'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { removeCardFromDeck } from '@/lib/api';
import { getClientToken } from '@/lib/auth-client';

export default function RemoveDeckCardButton({
  deckId,
  cardId,
  quantity,
}: {
  deckId: string;
  cardId: string;
  quantity: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const token = getClientToken();
    if (!token) return;

    setLoading(true);
    try {
      await removeCardFromDeck(token, deckId, cardId, quantity);
      router.refresh();
    } catch {
      // silencioso a proposito, mismo criterio que RemoveCollectionCardButton
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title="Quitar del deck"
      className="absolute top-1.5 left-1.5 w-6 h-6 flex items-center justify-center rounded-md bg-bg/85 border border-border text-text-muted opacity-0 group-hover:opacity-100 hover:text-mana-R hover:border-mana-R transition-all disabled:opacity-50"
    >
      ×
    </button>
  );
}
