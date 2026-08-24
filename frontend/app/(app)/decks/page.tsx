import { getServerToken } from '@/lib/auth-server';
import { listDecks } from '@/lib/api';
import Link from 'next/link';
import CreateDeckForm from '@/components/CreateDeckForm';
import DeckFormatBadge from '@/components/DeckFormatBadge';

export default async function DecksPage() {
  const token = (await getServerToken())!;
  const decks = await listDecks(token).catch(() => []);

  return (
    <div className="px-8 py-8 max-w-3xl">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-accent font-mono mb-1">Decks</p>
        <h2 className="font-display text-3xl text-text-primary">Tus mazos</h2>
      </header>

      <div className="mb-8">
        <CreateDeckForm />
      </div>

      {decks.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <p className="text-text-muted text-sm">Todavía no tienes decks. Crea el primero arriba.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {decks.map((deck) => (
            <li key={deck.id}>
              <Link
                href={`/decks/${deck.id}`}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-surface hover:border-accent-dim transition-colors"
              >
                <span className="font-display italic text-lg text-text-primary">{deck.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted font-mono">{deck.cardCount} cartas</span>
                  <DeckFormatBadge format={deck.format} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
