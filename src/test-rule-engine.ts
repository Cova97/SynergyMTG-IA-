// test-rule-engine.ts
//
// Corre el motor de reglas (sin IA) sobre las mismas 10 cartas que
// usamos para probar el LLM, para comparar resultados.
//
// Uso: npx ts-node src/test-rule-engine.ts "Carta 1" "Carta 2" ...

import 'dotenv/config';
import { tagCard } from './analysis/rules/pattern-dictionary';
import { findComboCandidates } from './analysis/rules/combo-matcher';

const SCRYFALL_HEADERS = {
  'User-Agent': 'MTGComboApp/0.1 (proyecto personal de coleccion MTG)',
  Accept: '*/*',
};

interface CardInput {
  id: string;
  name: string;
  oracle_text: string;
}

async function fetchCardFromScryfall(name: string): Promise<CardInput> {
  const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: SCRYFALL_HEADERS });

  if (!res.ok) {
    throw new Error(`No se encontro la carta "${name}" en Scryfall (${res.status})`);
  }

  const card = await res.json();
  const oracleText =
    card.oracle_text ??
    (card.card_faces ?? [])
      .map((face: any) => `${face.name}: ${face.oracle_text ?? ''}`)
      .join('\n // \n');

  return { id: card.name, name: card.name, oracle_text: oracleText ?? '' };
  // Nota: aqui se usa el NOMBRE como id (no el UUID) solo para que el
  // output de esta prueba sea legible en consola. En el sistema real,
  // el id sigue siendo el UUID de Scryfall.
}

async function main() {
  const cardNames = process.argv.slice(2);
  if (cardNames.length < 2) {
    console.error('Uso: npx ts-node src/test-rule-engine.ts "Carta 1" "Carta 2" ...');
    process.exitCode = 1;
    return;
  }

  const cards: CardInput[] = [];
  const notFound: string[] = [];
  for (const name of cardNames) {
    try {
      cards.push(await fetchCardFromScryfall(name));
    } catch (err) {
      notFound.push(name);
      console.warn(`Advertencia: "${name}" no se pudo resolver — se omite de la prueba.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (notFound.length > 0) {
    console.log(`\nCartas omitidas (no encontradas): ${notFound.join(', ')}`);
  }
  if (cards.length < 2) {
    console.error('\nQuedaron menos de 2 cartas validas, no se puede analizar.');
    process.exitCode = 1;
    return;
  }

  console.log('Cartas cargadas:', cards.map((c) => c.name).join(', '));

  const tagged = cards.map((c) => tagCard(c.id, c.oracle_text));

  console.log('\n--- Patrones detectados por carta ---');
  for (const t of tagged) {
    const patternNames = t.matchedPatterns.map((p) => p.id).join(', ') || '(ninguno)';
    console.log(`${t.cardId}: ${patternNames}`);
  }

  const candidates = findComboCandidates(tagged);

  console.log('\n--- Grupos candidatos encontrados ---');
  if (candidates.length === 0) {
    console.log('Ninguno.');
  }
  for (const group of candidates) {
    console.log(
      `\n${group.isLoop ? '[LOOP]' : '[cadena]'} ${group.cardIds.join(' -> ')}`,
    );
    for (const conn of group.connections) {
      console.log(`   ${conn.from} --(${conn.via})--> ${conn.to}`);
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});