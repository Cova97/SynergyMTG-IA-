'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { removeFromCollection } from '@/lib/api';
import { getClientToken } from '@/lib/auth-client';

export default function RemoveCollectionCardButton({
  cardId,
  quantity,
}: {
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
      await removeFromCollection(token, cardId, quantity);
      router.refresh();
    } catch {
      // silencioso a proposito: el boton vuelve a su estado normal y el
      // usuario puede reintentar, no vale la pena un mensaje para esto
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title="Quitar de la colección"
      className="absolute top-1.5 left-1.5 w-6 h-6 flex items-center justify-center rounded-md bg-bg/85 border border-border text-text-muted opacity-0 group-hover:opacity-100 hover:text-mana-R hover:border-mana-R transition-all disabled:opacity-50"
    >
      ×
    </button>
  );
}
