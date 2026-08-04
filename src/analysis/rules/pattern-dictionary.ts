// src/analysis/rules/pattern-dictionary.ts
//
// Cada patron se etiqueta con los "recursos" de juego que PRODUCE y/o
// CONSUME, en vez de solo "trigger" o "efecto" sueltos. Esto permite
// que el matcher siga cadenas completas (A produce lo que B consume,
// B produce lo que C consume...) en vez de solo detectar pares.
//
// Ejemplo real: Zuran Orb produce "land_in_graveyard". Ramunap
// Excavator CONSUME "land_in_graveyard" y PRODUCE
// "land_enters_battlefield". Scute Swarm y Lotus Cobra CONSUMEN
// "land_enters_battlefield". Encadenados, forman un loop.

export type ResourceType =
  | 'land_enters_battlefield'
  | 'land_in_graveyard'
  | 'land_on_battlefield'
  | 'creature_dies'
  | 'creature_enters_battlefield'
  | 'card_drawn'
  | 'token_created'
  | 'life_gained'
  | 'life_lost'
  | 'counter_plus1plus1'
  | 'mana_produced'
  | 'creature_attacks'
  | 'spell_cast'
  | 'permanent_untapped';

export interface Pattern {
  id: string;
  regex: RegExp;
  /** Recursos que esta habilidad genera cuando se resuelve/dispara */
  produces: ResourceType[];
  /** Recursos que esta habilidad necesita para poder activarse */
  consumes: ResourceType[];
  description: string;
}

// No pretende cubrir el 100% de Magic desde el dia uno — arranca con
// los patrones mas comunes en combos reales y se amplia con el tiempo.
export const PATTERN_DICTIONARY: Pattern[] = [
  {
    id: 'landfall_trigger',
    regex: /landfall|whenever a land (you control )?enters/i,
    produces: ['token_created', 'mana_produced'], // efecto tipico, varia por carta
    consumes: ['land_enters_battlefield'],
    description: 'Reacciona cuando entra una tierra al campo de batalla',
  },
  {
    id: 'play_land_from_graveyard',
    regex: /play (a |target )?lands? from your graveyard/i,
    produces: ['land_enters_battlefield'],
    consumes: ['land_in_graveyard'],
    description: 'Permite jugar tierras directamente desde el cementerio',
  },
  {
    id: 'sacrifice_land',
    regex: /sacrifice (a|another|target) land/i,
    produces: ['land_in_graveyard', 'life_gained'],
    consumes: ['land_on_battlefield'],
    description: 'Sacrifica una tierra propia a cambio de un beneficio',
  },
  {
    id: 'fetch_land',
    regex: /sacrifice (this land|~)[:,].*search your library for a( basic)? land/i,
    produces: ['land_enters_battlefield', 'land_in_graveyard'],
    consumes: ['land_on_battlefield'],
    description: 'Sacrifica esta tierra para buscar y poner otra en juego (fetch land)',
  },
  {
    id: 'creature_dies_trigger',
    regex: /whenever [\w\s,]* (dies|is put into a graveyard from the battlefield)/i,
    produces: ['life_gained', 'life_lost', 'card_drawn', 'token_created'],
    consumes: ['creature_dies'],
    description: 'Reacciona cuando una criatura muere',
  },
  {
    id: 'sacrifice_creature',
    regex: /sacrifice (a|another|target) creature/i,
    produces: ['creature_dies'],
    consumes: [],
    description: 'Sacrifica una criatura propia (dispara efectos de "muere")',
  },
  {
    id: 'draw_card_effect',
    regex: /draw (a|one|two|\d+) cards?/i,
    produces: ['card_drawn'],
    consumes: [],
    description: 'Roba una o mas cartas',
  },
  {
    id: 'create_token_effect',
    regex: /create[s]? (a|one|\d+|X) .*(token|copy)/i,
    produces: ['token_created', 'creature_enters_battlefield'],
    consumes: [],
    description: 'Crea uno o mas tokens (usualmente de criatura)',
  },
  {
    id: 'creature_enters_trigger',
    regex: /whenever (a |another )?creature (you control )?enters/i,
    produces: ['card_drawn', 'life_gained', 'token_created'],
    consumes: ['creature_enters_battlefield'],
    description: 'Reacciona cuando entra una criatura al campo de batalla',
  },
  {
    id: 'gain_life_effect',
    regex: /gain[s]? (\d+|X) life/i,
    produces: ['life_gained'],
    consumes: [],
    description: 'Gana vida',
  },
  {
    id: 'counters_plus1plus1_effect',
    regex: /put[s]? (a|one|\d+|X) \+1\/\+1 counters?/i,
    produces: ['counter_plus1plus1'],
    consumes: [],
    description: 'Coloca contadores +1/+1',
  },
  {
    id: 'mana_produced_effect',
    regex: /add (one|two|\{[wubrgc]\}|mana of any (color|type))/i,
    produces: ['mana_produced'],
    consumes: [],
    description: 'Genera mana',
  },
  {
    id: 'attack_trigger',
    regex: /whenever [\w\s,]* attacks/i,
    produces: ['card_drawn', 'token_created', 'life_lost'],
    consumes: ['creature_attacks'],
    description: 'Reacciona cuando una criatura ataca',
  },
  {
    id: 'untap_effect',
    regex: /untap target (permanent|creature|artifact|land)/i,
    produces: ['permanent_untapped'],
    consumes: [],
    description: 'Desendereza un permanente, habilitando reutilizar su habilidad',
  },
  {
    id: 'spell_cast_trigger',
    regex: /whenever you cast (an? )?(instant|sorcery|noncreature) spell/i,
    produces: ['life_lost', 'card_drawn', 'token_created'],
    consumes: ['spell_cast'],
    description: 'Reacciona cuando lanzas un hechizo de instantaneo/conjuro',
  },
];

export interface TaggedCard {
  cardId: string;
  matchedPatterns: Pattern[];
}

// Algunos recursos son distintos conceptualmente pero uno implica al
// otro en terminos de juego: si una tierra ACABA de entrar al campo,
// tambien esta EN el campo de batalla (satisface ambos consumos).
// Sin esto, cadenas como Zuran Orb <-> Ramunap Excavator no cierran
// como loop porque los tags no coinciden exactamente.
export const RESOURCE_IMPLICATIONS: Partial<Record<ResourceType, ResourceType[]>> = {
  land_enters_battlefield: ['land_on_battlefield'],
};

/** Expande un set de recursos producidos con sus implicaciones. */
export function expandWithImplications(resources: Set<ResourceType>): Set<ResourceType> {
  const expanded = new Set(resources);
  for (const resource of resources) {
    for (const implied of RESOURCE_IMPLICATIONS[resource] ?? []) {
      expanded.add(implied);
    }
  }
  return expanded;
}

/** Analiza el oracle_text de una carta y regresa los patrones que matchea. */
export function tagCard(cardId: string, oracleText: string): TaggedCard {
  const matchedPatterns = PATTERN_DICTIONARY.filter((p) => p.regex.test(oracleText));
  return { cardId, matchedPatterns };
}