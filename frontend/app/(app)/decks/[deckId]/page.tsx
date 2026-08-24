import { getServerToken } from '@/lib/auth-server';
import { getDeck, getCardById, validateDeck, getManaStats } from '@/lib/api';
import { CardData } from '@/lib/types';
import CardTile from '@/components/CardTile';
import DeckFormatBadge from '@/components/DeckFormatBadge';
import AddCardToDeckForm from '@/components/AddCardToDeckForm';
import AnalysisPanel from '@/components/AnalysisPanel';
import ManaStatsPanel from '@/components/ManaStatsPanel';

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const token = (await getServerToken())!;

  const deck = await getDeck(token, deckId);

  const cardIds = [
    ...deck.cards.map((c) => c.cardId),
    ...(deck.commanderCardId ? [deck.commanderCardId] : []),
  ];
  const cardsData = await Promise.all(cardIds.map((id) => getCardById(token, id).catch(() => null)));
  const cardsById = new Map<string, CardData>();
  cardsData.forEach((card) => {
    if (card) cardsById.set(card.id, card);
  });

  const [validation, manaStats] = await Promise.all([
    validateDeck(token, deckId).catch(() => null),
    deck.cards.length > 0 ? getManaStats(token, deckId).catch(() => null) : Promise.resolve(null),
  ]);

  const totalCards = deck.cards.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div className="px-8 py-8 max-w-6xl">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="font-display text-3xl text-text-primary">{deck.name}</h2>
          <DeckFormatBadge format={deck.format} />
        </div>
        {deck.commanderName ? (
          <p className="text-sm text-text-muted">
            Comandante: <span className="text-accent">{deck.commanderName}</span>
          </p>
        ) : deck.format === 'commander' ? (
          <p className="text-sm text-mana-R">Sin comandante designado todavía</p>
        ) : null}
        {validation && !validation.valid && (
          <ul className="mt-2 text-xs text-mana-R space-y-0.5">
            {validation.issues.map((issue) => (
              <li key={issue}>⚠ {issue}</li>
            ))}
          </ul>
        )}
      </header>

      <section className="mb-8">
        <AddCardToDeckForm deckId={deck.id} format={deck.format} />
      </section>

      <section className="mb-10">
        <h3 className="font-display text-xl text-text-primary mb-3">Cartas ({totalCards})</h3>
        {deck.cards.length === 0 ? (
          <p className="text-sm text-text-muted">Todavía no has agregado cartas a este deck.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {deck.cards.map((entry) => {
              const card = cardsById.get(entry.cardId);
              if (!card) return null;
              return <CardTile key={entry.cardId} card={card} quantity={entry.quantity} />;
            })}
          </div>
        )}
      </section>

      {manaStats && manaStats.manaStats.some((s) => s.sourceCount > 0) && (
        <section className="mb-10">
          <ManaStatsPanel stats={manaStats} />
        </section>
      )}

      <section>
        <AnalysisPanel mode="deck" deckId={deck.id} cardsById={cardsById} />
      </section>
    </div>
  );
}
