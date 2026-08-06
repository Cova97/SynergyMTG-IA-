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
  | 'flexible_creature_target_enters'
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
  | 'counter_minus1minus1'
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
    // Scryfall NUNCA usa el simbolo "~" en oracle_text, siempre
    // sustituye el nombre real de la carta (ej. "Sacrifice Arid Mesa:"
    // en vez de "Sacrifice this land:"). El patron anterior solo
    // aceptaba "this land" o "~" literal, por lo que fetch lands reales
    // como Arid Mesa y Bloodstained Mire no se detectaban en absoluto.
    regex: /sacrifice [\w\s,'".-]{0,40}[:,][\s\S]{0,80}search your library for [\s\S]{0,80}put it onto the battlefield/is,
    produces: ['land_enters_battlefield', 'land_in_graveyard'],
    // NO consume 'land_on_battlefield' a proposito: a diferencia de
    // Zuran Orb (motor REPETIBLE que si necesita que le "rellenen"
    // tierras), una fetch land se sacrifica a SI MISMA una sola vez —
    // no necesita ayuda de otra carta para activarse. Sin este ajuste,
    // cualquier par de fetch lands se conectaba como [LOOP] falso
    // entre si, sin ninguna interaccion real (encontrado probando
    // Evolving Wilds + Terramorphic Expanse + Prismatic Vista juntas).
    consumes: [],
    description: 'Sacrifica esta tierra para buscar y poner otra en juego (fetch land)',
  },
  {
    id: 'mana_produced_effect',
    regex: /add (one|two|\{[wubrgc]\}|mana of any (color|type))/is,
    produces: ['mana_produced'],
    consumes: [],
    description: 'Genera mana',
  },
  {
    id: 'ramp_land_to_battlefield',
    regex: /search (your|their) library for (up to \w+ )?(a |two |\d+ )?(basic )?land[\s\S]{0,100}put (it|one|them|that card) onto the battlefield/is,
    produces: ['land_enters_battlefield'],
    consumes: [],
    description: 'Rampa: busca una tierra en la biblioteca y la pone directo al campo de batalla (ej. Cultivate)',
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
    // Se EXCLUYE explicitamente "a land" y "(a|another) creature" justo
    // despues de when(ever) — esos casos ya los cubren landfall_trigger
    // y creature_enters_trigger; sin la exclusion, self_etb_trigger
    // matcheaba tambien texto de landfall y generaba conexiones falsas
    // entre cartas que no interactuan de verdad (ej. Scute Swarm y
    // Lotus Cobra aparecian conectadas sin razon real).
    regex: /when(ever)? (?!a land|(a |another )?creature)[\w\s,'".-]{0,60} enters\b/is,
    produces: [],
    // Ahora consume 'flexible_creature_target_enters' en vez del
    // recurso generico — solo se activa por efectos donde el jugador
    // ELIGE que sea esta carta la que entra/regresa (copiar, reanimar,
    // parpadear). Persist/Undying/Ninjutsu NO producen este recurso
    // porque son fijos (siempre la misma carta, sin eleccion) y no
    // deberian disparar el auto-ETB de OTRA carta sin relacion real.
    consumes: ['flexible_creature_target_enters'],
    description: 'Trigger de "cuando ESTA carta entra al campo de batalla" (auto-ETB) — solo se conecta con efectos flexibles (copiar/reanimar/parpadear), no con Persist/Undying/Ninjutsu',
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

  // ---- Persist / Undying (CR 702.79a y 702.93a) ----
  {
    id: 'persist_ability',
    // CR 702.79a: "When this permanent is put into a graveyard from the
    // battlefield, if it had no -1/-1 counters on it, return it to the
    // battlefield under its owner's control with a -1/-1 counter on it."
    // Si produce creature_enters_battlefield: es necesario para conectar
    // con triggers GENERICOS reales como Soul Warden ("cuando entra
    // OTRA criatura, ganas vida") — ese caso es real y hay que
    // conservarlo. El costo conocido: como self_etb_trigger consume
    // ese MISMO recurso generico (no distingue "entro YO" de "entro
    // cualquier criatura"), puede generar conexiones falsas entre dos
    // cartas de auto-ETB sin relacion real (visto con Kitchen Finks +
    // Murderous Redcap). Es un limite real del modelo por tipo de
    // recurso (no rastrea identidad de carta) — sin solucion limpia
    // sin romper alguno de los dos casos reales.
    regex: /\bpersist\b/is,
    produces: ['creature_enters_battlefield', 'counter_minus1minus1'],
    consumes: ['creature_dies'],
    description: 'Persist: al morir (sin contador -1/-1), regresa al campo con un contador -1/-1',
  },
  {
    id: 'undying_ability',
    // CR 702.93a: "When this permanent is put into a graveyard from the
    // battlefield, if it had no +1/+1 counters on it, return it to the
    // battlefield under its owner's control with a +1/+1 counter on it."
    // Mismo trade-off documentado en persist_ability.
    regex: /\bundying\b/is,
    produces: ['creature_enters_battlefield', 'counter_plus1plus1'],
    consumes: ['creature_dies'],
    description: 'Undying: al morir (sin contador +1/+1), regresa al campo con un contador +1/+1',
  },

  // ---- Prevencion de contadores (Melira, Sylvok Outcast / Solemnity) ----
  // LIMITACION CONOCIDA Y DOCUMENTADA: este patron solo ETIQUETA la
  // carta para que no aparezca como "(ninguno)" — nuestro modelo de
  // grafo produce/consume no soporta logica condicional/negacion, asi
  // que NO simula automaticamente que estas cartas "cancelan" el
  // contador -1/-1 de Persist y habilitan el loop infinito real. Esa
  // interpretacion la debe hacer la capa de IA o un humano al ver que
  // esta carta aparece junto a una con persist_ability.
  {
    id: 'counter_prevention_effect',
    regex: /counters? can.?t be put on|can.?t have (-1\/-1 )?counters? put on/is,
    produces: [],
    consumes: [],
    description: 'Previene que se coloquen contadores (ej. Melira, Sylvok Outcast; Solemnity) — no simulado en el grafo, solo etiquetado',
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
    produces: ['creature_copied', 'creature_enters_battlefield', 'flexible_creature_target_enters'],
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
    produces: ['creature_enters_battlefield', 'flexible_creature_target_enters'],
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
    produces: ['creature_enters_battlefield', 'permanent_returned_from_exile', 'flexible_creature_target_enters'],
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
    id: 'life_gain_trigger',
    regex: /whenever you gain life/is,
    // Ampliado: "whenever you gain life" no siempre produce perdida de
    // vida (Sanguine Bond) — tambien puede producir contadores +1/+1
    // (Heliod, Sun-Crowned; Ajani's Pridemate; Archangel of Thune).
    produces: ['life_lost', 'counter_plus1plus1'],
    consumes: ['life_gained'],
    description: 'Reacciona cuando TU ganas vida (ej. Sanguine Bond, Heliod, Ajani\'s Pridemate)',
  },
  {
    id: 'life_loss_trigger',
    regex: /whenever (an? )?opponent[s]? loses? life/is,
    produces: ['life_gained'],
    consumes: ['life_lost'],
    description: 'Reacciona cuando un oponente pierde vida (ej. Exquisite Blood)',
  },
  {
    id: 'grant_lifelink_effect',
    // Aproximacion: otorgar lifelink solo produce vida si la criatura
    // tambien inflige dano — se modela como que CONSUME dano infligido
    // y PRODUCE vida ganada (ej. la habilidad activada de Heliod).
    regex: /gains? lifelink( until end of turn)?/is,
    produces: ['life_gained'],
    consumes: ['damage_dealt'],
    description: 'Otorga lifelink a una criatura (convierte dano infligido en vida ganada)',
  },
  {
    id: 'remove_counter_for_damage',
    regex: /remove a \+1\/\+1 counter from[\s\S]{0,60}deals? \d+ damage/is,
    produces: ['damage_dealt'],
    consumes: ['counter_plus1plus1'],
    description: 'Quita un contador +1/+1 para infligir dano (ej. Walking Ballista)',
  },
  {
    id: 'remove_counter_for_life',
    regex: /remove a \+1\/\+1 counter from[\s\S]{0,60}gain \d+ life/is,
    produces: ['life_gained'],
    consumes: ['counter_plus1plus1'],
    description: 'Quita un contador +1/+1 para ganar vida (ej. Spike Feeder)',
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
    // Excluye "deals damage to you" (habilidades defensivas/castigo,
    // ej. Mikaeus, the Unhallowed: "Whenever a Human deals damage to
    // you, destroy it" — no genera valor combeable). Solo matchea
    // dano OFENSIVO que beneficia a quien lo inflige (ej. Covert
    // Technician: "deals combat damage to a player, you may...").
    regex: /whenever [\w\s,]* deals? (combat )?damage(?! to you\b)/is,
    produces: ['card_drawn', 'life_gained', 'token_created', 'counter_plus1plus1'],
    consumes: ['damage_dealt'],
    description: 'Reacciona cuando una criatura inflige dano (ofensivo, no defensivo)',
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
    regex: /whenever you cast (an? )?(instant|sorcery|noncreature )?spell/is,
    produces: ['life_lost', 'card_drawn', 'token_created', 'damage_dealt', 'life_gained'],
    consumes: ['spell_cast'],
    description: 'Reacciona cuando lanzas un hechizo (instantaneo/conjuro, o cualquier hechizo)',
  },

  // ---- Casteo desde el cementerio (flashback, escape, aftermath, jump-start) ----
  {
    id: 'cast_from_graveyard',
    regex: /(flashback|escape|aftermath|jump-start)[\s\S]{0,30}(you may cast|from your graveyard)|you may cast this card from your graveyard/is,
    produces: ['creature_enters_battlefield', 'spell_cast'],
    consumes: ['creature_in_graveyard'],
    description: 'Permite lanzar esta carta directamente desde el cementerio (flashback/escape/aftermath/jump-start)',
  },
  {
    id: 'unearth_ability',
    // Unearth: devuelve un permanente del cementerio al campo de
    // batalla con prisa, se exilia al siguiente final de turno.
    regex: /unearth [\{\}\dwubrgcx]+/is,
    produces: ['creature_enters_battlefield'],
    consumes: ['creature_in_graveyard'],
    description: 'Unearth: regresa esta criatura del cementerio al campo con prisa (temporal)',
  },
  {
    id: 'embalm_eternalize_ability',
    // Embalm/Eternalize: exilia esta carta del cementerio para crear
    // un token que es una copia de ella.
    regex: /\b(embalm|eternalize)\b\s*[\{\}\dwubrgcx]+/is,
    produces: ['creature_enters_battlefield', 'creature_copied', 'token_created'],
    consumes: ['creature_in_graveyard'],
    description: 'Embalm/Eternalize: exilia esta carta del cementerio para crear un token copia',
  },
  {
    id: 'extort_ability',
    // CR 702.101a: "Whenever you cast a spell, you may pay {W/B}. If
    // you do, each opponent loses 1 life and you gain life equal to
    // the total life lost this way."
    regex: /\bextort\b/is,
    produces: ['life_lost', 'life_gained'],
    consumes: ['spell_cast'],
    description: 'Extort: al lanzar un hechizo, puedes pagar para drenar 1 vida de cada oponente',
  },

  // ---- Ciclismo: descarta esta carta para robar otra ----
  {
    id: 'cycling_effect',
    regex: /cycling [\{\}\dwubrgcx/]+/is,
    produces: ['card_drawn', 'card_discarded'],
    consumes: [],
    description: 'Cycling: descarta esta carta pagando un costo para robar una nueva',
  },

  // ---- Ninjutsu / Channel (Kamigawa) ----
  {
    id: 'ninjutsu_ability',
    // Wording oficial: "Ninjutsu {cost} ({cost}, Return an unblocked
    // attacker you control to hand: Put this card onto the battlefield
    // from your hand tapped and attacking.)" — tambien existe la
    // variante "Commander ninjutsu".
    regex: /(commander )?ninjutsu [\{\}\dwubrgcx]+/is,
    produces: ['creature_enters_battlefield'],
    consumes: ['creature_attacks'],
    description: 'Ninjutsu: regresa un atacante sin bloquear a la mano para poner esta carta en juego atacando',
  },
  {
    id: 'channel_ability',
    // "Channel — {cost}, Discard this card: [efecto]"
    regex: /channel[\s—-]*[\{\}\dwubrgcx]*[,—-]?\s*discard this card/is,
    produces: ['card_discarded'],
    consumes: [],
    description: 'Channel: descarta esta carta de la mano pagando un costo por un efecto',
  },

  // ---- Proliferar: suma otro contador a cada permanente/jugador que ya tenga uno ----
  {
    id: 'proliferate_effect',
    regex: /proliferate/is,
    produces: ['counter_plus1plus1'],
    consumes: ['counter_plus1plus1'],
    description: 'Proliferar: agrega otro contador de cada tipo que ya este presente',
  },

  // ---- Delve: exilia cartas del cementerio para pagar el costo ----
  {
    id: 'delve_effect',
    regex: /delve \(/is,
    produces: ['permanent_exiled'],
    consumes: ['creature_in_graveyard'],
    description: 'Delve: exilia cartas del cementerio para reducir el costo de este hechizo',
  },

  // ---- Populate: copia un token de criatura que ya controles ----
  {
    id: 'populate_effect',
    regex: /populate/is,
    produces: ['creature_copied', 'creature_enters_battlefield', 'flexible_creature_target_enters'],
    consumes: ['token_created'],
    description: 'Populate: crea una copia de un token de criatura que ya controlas',
  },

  // ---- Explorar: revela la carta de arriba, tierra a mano o +1/+1 y opcion de mill ----
  {
    id: 'explore_effect',
    regex: /explores?\b/is,
    produces: ['counter_plus1plus1', 'card_milled', 'card_drawn'],
    consumes: [],
    description: 'Explorar: revela la carta de arriba de la biblioteca (tierra a mano, o +1/+1 y cementerio opcional)',
  },

  // ---- Artefactos desechables (Treasure, Clue, Food): sacrificar por valor ----
  {
    id: 'sacrifice_artifact_for_value',
    regex: /sacrifice (this artifact|a|an|target) (artifact|treasure|clue|food)[:,].*(add|draw|gain \d+ life)/is,
    produces: ['mana_produced', 'card_drawn', 'life_gained'],
    consumes: [],
    description: 'Sacrifica un artefacto desechable (Treasure/Clue/Food) por maná, robo o vida',
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
