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
  | 'creature_in_graveyard'
  | 'creature_enters_battlefield'
  | 'creature_copied'
  | 'permanent_untapped'
  | 'permanent_exiled'
  | 'permanent_returned_from_exile'
  | 'card_drawn'
  | 'card_discarded'
  | 'card_milled'
  | 'card_returned_to_hand'
  | 'token_created'
  | 'life_gained'
  | 'life_lost'
  | 'counter_plus1plus1'
  | 'mana_produced'
  | 'creature_attacks'
  | 'spell_cast'
  | 'damage_dealt'
  | 'extra_combat_step'
  | 'extra_turn';

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
  // ---- Tierras ----
  {
    id: 'landfall_trigger',
    regex: /landfall|whenever a land (you control )?enters/is,
    produces: ['token_created', 'mana_produced'],
    consumes: ['land_enters_battlefield'],
    description: 'Reacciona cuando entra una tierra al campo de batalla',
  },
  {
    id: 'play_land_from_graveyard',
    regex: /play (a |target )?lands? from your graveyard/is,
    produces: ['land_enters_battlefield'],
    consumes: ['land_in_graveyard'],
    description: 'Permite jugar tierras directamente desde el cementerio',
  },
  {
    id: 'sacrifice_land',
    regex: /sacrifice (a|another|target) land/is,
    produces: ['land_in_graveyard', 'life_gained'],
    consumes: ['land_on_battlefield'],
    description: 'Sacrifica una tierra propia a cambio de un beneficio',
  },
  {
    id: 'fetch_land',
    regex: /sacrifice (this land|~)[:,].*search your library for a( basic)? land/is,
    produces: ['land_enters_battlefield', 'land_in_graveyard'],
    consumes: ['land_on_battlefield'],
    description: 'Sacrifica esta tierra para buscar y poner otra en juego (fetch land)',
  },
  {
    id: 'mana_produced_effect',
    regex: /add (one|two|\{[wubrgc]\}|mana of any (color|type))/is,
    produces: ['mana_produced'],
    consumes: [],
    description: 'Genera mana',
  },

  // ---- Criaturas: muerte, entrada, sacrificio ----
  {
    id: 'creature_dies_trigger',
    regex: /whenever [\w\s,]* (dies|is put into a graveyard from the battlefield)/is,
    produces: ['life_gained', 'life_lost', 'card_drawn', 'token_created'],
    consumes: ['creature_dies'],
    description: 'Reacciona cuando una criatura muere',
  },
  {
    id: 'sacrifice_creature',
    regex: /sacrifice (a|another|target) creature/is,
    produces: ['creature_dies'],
    consumes: [],
    description: 'Sacrifica una criatura propia (dispara efectos de "muere")',
  },
  {
    id: 'creature_enters_trigger',
    regex: /whenever (a |another )?creature (you control )?enters/is,
    produces: ['card_drawn', 'life_gained', 'token_created'],
    consumes: ['creature_enters_battlefield'],
    description: 'Reacciona cuando entra una criatura al campo de batalla',
  },
  {
    id: 'self_etb_trigger',
    // Wizards actualizo el wording de Oracle: cartas nuevas/reimpresas
    // dicen "When this creature enters," (sin "the battlefield"), las
    // viejas siguen diciendo "enters the battlefield". Se aceptan ambas.
    regex: /when(ever)? [\w\s,'".-]{0,60} enters\b/is,
    produces: [],
    consumes: ['creature_enters_battlefield'],
    description: 'Trigger de "cuando ESTA carta entra al campo de batalla" (auto-ETB) — distinto del generico que reacciona a cualquier criatura',
  },
  {
    id: 'create_token_effect',
    regex: /create[s]? (a|one|\d+|X) .*(token|copy)/is,
    produces: ['token_created', 'creature_enters_battlefield'],
    consumes: [],
    description: 'Crea uno o mas tokens (usualmente de criatura)',
  },
  {
    id: 'counters_plus1plus1_effect',
    regex: /put[s]? (a|one|\d+|X) \+1\/\+1 counters?/is,
    produces: ['counter_plus1plus1'],
    consumes: [],
    description: 'Coloca contadores +1/+1',
  },

  // ---- Copiar / desenderezar (loops tipo Kiki-Jiki) ----
  {
    id: 'untap_effect',
    regex: /untap (target|that|another target) (permanent|creature|artifact|land)/is,
    produces: ['permanent_untapped'],
    consumes: [],
    description: 'Desendereza un permanente, habilitando reutilizar su habilidad',
  },
  {
    id: 'copy_creature_haste_tap_ability',
    regex: /\{T\}[:,].*create[s]?.*token.*copy.*(nonlegendary )?creature.*haste/is,
    produces: ['creature_copied', 'creature_enters_battlefield'],
    consumes: ['permanent_untapped'],
    description: 'Habilidad de enderezar que copia una criatura con prisa (tipo Kiki-Jiki)',
  },
  {
    id: 'untap_and_haste_steal',
    regex: /untap (target|that|another target) (permanent|creature).{0,150}gains? haste/is,
    produces: ['permanent_untapped'],
    consumes: [],
    description: 'Desendereza una criatura objetivo y le da prisa (habilita reactivar su habilidad de inmediato)',
  },

  // ---- Cementerio / recursion / reanimacion ----
  {
    id: 'discard_effect',
    regex: /discard(s)? (a|one|\d+|your hand)/is,
    produces: ['card_discarded'],
    consumes: [],
    description: 'Descarta una o mas cartas',
  },
  {
    id: 'discard_trigger',
    regex: /whenever you discard/is,
    produces: ['card_drawn', 'token_created', 'life_lost'],
    consumes: ['card_discarded'],
    description: 'Reacciona cuando descartas una carta (madness, hellbent, etc.)',
  },
  {
    id: 'mill_effect',
    regex: /mill(s)? (a|\d+|X) cards?/is,
    produces: ['card_milled'],
    consumes: [],
    description: 'Pone cartas de la biblioteca directo al cementerio',
  },
  {
    id: 'reanimation_effect',
    regex: /return target creature card from (a|your|any) graveyard to the battlefield/is,
    produces: ['creature_enters_battlefield'],
    consumes: ['creature_in_graveyard'],
    description: 'Reanima: pone una criatura del cementerio directo al campo de batalla',
  },
  {
    id: 'return_creature_to_hand_from_graveyard',
    regex: /return target creature card from your graveyard to your hand/is,
    produces: ['card_returned_to_hand'],
    consumes: ['creature_in_graveyard'],
    description: 'Regresa una criatura del cementerio a la mano',
  },
  {
    id: 'flicker_effect',
    regex: /exile target creature.*return (it|that card) to the battlefield/is,
    produces: ['creature_enters_battlefield', 'permanent_returned_from_exile'],
    consumes: ['permanent_exiled'],
    description: 'Exilia una criatura y la regresa al campo de batalla (flicker/parpadeo)',
  },
  {
    id: 'exile_effect',
    regex: /exile target/is,
    produces: ['permanent_exiled'],
    consumes: [],
    description: 'Exilia un permanente objetivo',
  },

  // ---- Cartas, robo, dano ----
  {
    id: 'draw_card_effect',
    regex: /draw (a|one|two|\d+) cards?/is,
    produces: ['card_drawn'],
    consumes: [],
    description: 'Roba una o mas cartas',
  },
  {
    id: 'gain_life_effect',
    regex: /gain[s]? (\d+|X) life/is,
    produces: ['life_gained'],
    consumes: [],
    description: 'Gana vida',
  },
  {
    id: 'damage_dealt_effect',
    regex: /deals? (\d+|X) damage/is,
    produces: ['damage_dealt'],
    consumes: [],
    description: 'Inflige dano directo',
  },
  {
    id: 'damage_trigger',
    regex: /whenever [\w\s,]* deals? (combat )?damage/is,
    produces: ['card_drawn', 'life_gained', 'token_created', 'counter_plus1plus1'],
    consumes: ['damage_dealt'],
    description: 'Reacciona cuando una criatura inflige dano',
  },

  // ---- Ataques, turnos y combates extra ----
  {
    id: 'attack_trigger',
    regex: /whenever [\w\s,]* attacks/is,
    produces: ['card_drawn', 'token_created', 'life_lost'],
    consumes: ['creature_attacks'],
    description: 'Reacciona cuando una criatura ataca',
  },
  {
    id: 'extra_combat_effect',
    regex: /(additional|extra) combat phase/is,
    produces: ['extra_combat_step'],
    consumes: [],
    description: 'Otorga una fase de combate adicional',
  },
  {
    id: 'extra_turn_effect',
    regex: /take an extra turn/is,
    produces: ['extra_turn'],
    consumes: [],
    description: 'Otorga un turno adicional',
  },

  // ---- Hechizos ----
  {
    id: 'spell_cast_trigger',
    regex: /whenever you cast (an? )?(instant|sorcery|noncreature) spell/is,
    produces: ['life_lost', 'card_drawn', 'token_created', 'damage_dealt'],
    consumes: ['spell_cast'],
    description: 'Reacciona cuando lanzas un hechizo de instantaneo/conjuro',
  },
];

export interface TaggedCard {
  cardId: string;
  matchedPatterns: Pattern[];
}

// Algunos recursos son distintos conceptualmente pero uno implica al
// otro en terminos de juego. Sin esto, ciclos reales (como Zuran Orb
// <-> Ramunap Excavator, o creature_dies -> reanimation) no cierran
// como loop porque los tags no coinciden exactamente.
export const RESOURCE_IMPLICATIONS: Partial<Record<ResourceType, ResourceType[]>> = {
  land_enters_battlefield: ['land_on_battlefield'],
  creature_dies: ['creature_in_graveyard'],
  card_milled: ['creature_in_graveyard'], // si lo que se mando al cementerio es una criatura
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