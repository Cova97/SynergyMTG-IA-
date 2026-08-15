// src/analysis/stats/mana-sources.ts
//
// Detecta que colores de mana puede producir una carta. Las tierras
// basicas casi siempre tienen oracle_text VACIO en Scryfall (su
// habilidad de mana es implicita), asi que el color sale de
// type_line en ese caso. Para todo lo demas (tierras no basicas,
// rocas de mana, dorks), se busca en el oracle_text.

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G';

export const MANA_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G'];

const BASIC_LAND_COLORS: Record<string, ManaColor> = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
};

/**
 * Regresa el set de colores que esta carta puede producir. Vacio si
 * no produce mana en absoluto (la mayoria de las cartas).
 */
export function getProducedManaColors(typeLine: string, oracleText: string): Set<ManaColor> {
  const colors = new Set<ManaColor>();

  // "Add mana of any color" (ej. Command Tower, Sol Ring no, pero
  // Command Tower si) — cuenta para los 5 colores de una.
  if (/mana of any color/i.test(oracleText)) {
    return new Set<ManaColor>(MANA_COLORS);
  }

  // Tierras basicas: el color sale del type_line, no del oracle_text
  // (que suele venir vacio para estas).
  for (const [landType, color] of Object.entries(BASIC_LAND_COLORS)) {
    if (typeLine.includes(landType)) colors.add(color);
  }

  // Habilidades "Add {W}", "Add {W}{U}", etc. — cualquier simbolo de
  // color dentro de una oracion que empiece con "add". Se acota a la
  // oracion (hasta el siguiente punto) para no capturar simbolos de
  // costo de otras habilidades de la misma carta por accidente.
  const addSentences = oracleText.match(/add[^.]*\./gi) ?? [];
  for (const sentence of addSentences) {
    const symbols = sentence.match(/\{([WUBRG])\}/g) ?? [];
    for (const symbol of symbols) {
      colors.add(symbol.replace(/[{}]/g, '') as ManaColor);
    }
  }

  return colors;
}
