import { getServerToken } from '@/lib/auth-server';
import { getCollection } from '@/lib/api';
import { CardData } from '@/lib/types';
import CardTile from '@/components/CardTile';
import AddCardForm from '@/components/AddCardForm';
import AnalysisPanel from '@/components/AnalysisPanel';
import RemoveCollectionCardButton from '@/components/RemoveCollectionCardButton';

export default async function CollectionPage() {
  const token = (await getServerToken())!; // el layout (app) ya garantiza que existe

  const entries = await getCollection(token).catch((err) => {
    console.error('No se pudo cargar la colección:', err);
    return [];
  });
  const cardsById = new Map<string, CardData>(entries.map((e) => [e.card.id, e.card]));

  return (
    <div className="px-8 py-8 max-w-6xl">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-accent font-mono mb-1">Colección</p>
        <h2 className="font-display text-3xl text-text-primary">
          {entries.length} {entries.length === 1 ? 'carta' : 'cartas'}
        </h2>
      </header>

      <div className="mb-8 relative">
        <AddCardForm />
      </div>

      {entries.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 text-center">
          <p className="text-text-muted text-sm">
            Todavía no tienes cartas. Agrega la primera con el formulario de arriba.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3 mb-10">
            {entries.map((entry) => (
              <div key={entry.card.id} className="relative group">
                <CardTile card={entry.card} quantity={entry.quantity} />
                <RemoveCollectionCardButton cardId={entry.card.id} quantity={entry.quantity} />
              </div>
            ))}
          </div>

          <section>
            <AnalysisPanel mode="collection" cardsById={cardsById} />
          </section>
        </>
      )}
    </div>
  );
}
