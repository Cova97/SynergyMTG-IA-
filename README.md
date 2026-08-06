# Proyecto: SynergyMTG — Colección y Analizador de Combos MTG

App full-stack para gestionar una colección personal de cartas de Magic: The Gathering — escaneo/registro de cartas, armado de decks por formato, y un motor de análisis de combos (reglas determinísticas + IA complementaria).

## Estado del proyecto

**Backend real de NestJS construido y compilando** — 5 módulos completos (`CardsModule`, `CollectionModule`, `DecksModule`, `AnalysisModule`, `AiModule`) conectados entre sí y probados vía Postman. El almacenamiento de colección/decks todavía es en memoria (marcado con `TODO` en el código) — pendiente de reemplazar por Prisma sin tocar la lógica de negocio. El motor de reglas y la capa de IA están completamente construidos, probados extensamente, y conectados al backend real.

## 1. Funcionalidades objetivo

1. Escanear cartas físicas (foto → OCR → resolución contra base de datos) — *pendiente*
2. Almacenar la colección categorizada — construido (en memoria)
3. Armar decks por formato (casual, competitivo, Commander, experimental) usando solo cartas que el usuario posee — construido, con validación básica de Commander (singleton)
4. Analizar combos y sinergias posibles entre las cartas de la colección — construido y validado extensamente
5. Estadísticas de probabilidad de color (cálculo hipergeométrico) — *pendiente*
6. Capa de IA complementaria para explicar combos — construida

## 2. Arquitectura de flujo

```
Ingesta (escaneo OCR o nombre manual)
        ↓
Resolución contra la API de Scryfall (fuzzy search + autocomplete)  [CardsModule]
        ↓
Base de datos (cache de Card + UserCollection con cantidad)         [CardsModule + CollectionModule]
        ↓
Deckbuilding por formato (filtra solo cartas que el usuario posee)  [DecksModule]
        ↓
Motor de análisis                                                    [AnalysisModule]
   ├─ Motor de reglas (determinístico) → encuentra grupos candidatos de combo
   ├─ Estadísticas (hipergeométrico) → probabilidad de color (pendiente)
   └─ Capa de IA [AiModule] → EXPLICA los grupos que el motor de reglas ya encontró
        ↓
Frontend (Next.js) — pendiente
```

**Principio de diseño central, validado empíricamente:** la IA nunca *descubre* combos buscando entre cartas mezcladas — eso lo hace el motor de reglas, de forma determinística. La IA solo *explica en lenguaje natural* la conexión mecánica exacta que el motor de reglas ya identificó (rol de "narrador", no de "juez" — ver sección 5). Se probó lo contrario (pedirle a un LLM que descubra combos desde ruido, o que decida por sí mismo si hay combo) y falló consistentemente — ver sección 5.

### Stack técnico

- Backend: NestJS + TypeScript (Prisma + PostgreSQL/MySQL pendientes — hoy en memoria)
- Frontend: Next.js (pendiente)
- Infra: Docker (pendiente)
- Testing manual: colección de Postman incluida (`SynergyMTG.postman_collection.json`)

## 3. APIs externas integradas

### 3.1 Scryfall — datos de cartas

Fuente de datos de cartas (gratuita, pública, cubre todo Magic). Usada por `CardsService`.

- **Endpoint usado:** `GET https://api.scryfall.com/cards/named?fuzzy=<nombre>` — tolera errores tipográficos y nombres incompletos.
- **Headers obligatorios** (si faltan, responde 400): `User-Agent: <nombre de tu app>/<version>` y `Accept: */*`.
- **Idioma:** por ahora solo inglés. La API acepta nombres en otros idiomas vía `/cards/search?q=lang:es+NOMBRE`, pendiente para cuando se agregue soporte de español.
- **Puntuación:** la API ignora apóstrofos y puntos — `"Ashnods Altar"` y `"Ashnod's Altar"` resuelven igual. **Ojo:** el `oracle_text` de Scryfall nunca usa el símbolo `~` para autorreferencia — siempre sustituye el nombre real de la carta (ej. "Sacrifice Arid Mesa:" en vez de "Sacrifice this land:"). Esto rompió un patrón del diccionario hasta que se corrigió.
- **Cartas de doble cara** (transform/MDFC): el `oracle_text` no viene en el nivel raíz, hay que leerlo de `card_faces[]`.

### 3.2 Academy Ruins — reglas oficiales (Comprehensive Rules)

Segunda API integrada al proyecto — `academyruins.com` / `api.academyruins.com`. Sirve las Comprehensive Rules oficiales de Magic en texto estructurado, con diffs entre versiones.

- **Endpoint usado:** `GET https://api.academyruins.com/file/cr/:version` — devuelve el texto crudo completo del CR para una versión dada (el identificador de versión es un código de set, ej. `WOE`, `KLD`).
- **Para qué se usa:** es la fuente de verdad al diseñar un patrón nuevo del diccionario — en vez de buscar el wording de una keyword en la web, se consulta el texto oficial exacto (ej. CR 702.79a para Persist, CR 701.15a para Sacrificar). Esto evitó varios bugs: confirmó que Ninjutsu, Persist, Undying, Extort estaban bien modelados, y confirmó que sacrificar un permanente no depende de ninguna otra carta (CR 701.15a), lo cual respaldó la corrección del falso loop entre fetch lands.
- **Herramienta construida:** `fetch-cr-rule.ts` — consulta una regla específica por número (`npx ts-node src/fetch-cr-rule.ts <version> <numero>`, ej. `WOE 702.79a`).
- **Limitación conocida:** la documentación interactiva (`/docs`) requiere JavaScript para renderizar, así que no se pudo confirmar el endpoint exacto del JSON estructurado que menciona el proyecto — se usa el texto crudo, que sí está confirmado y funcionando.

## 4. Backend NestJS — módulos y cómo se conectan

```
CardsModule <───────────────┐
     ^                      │
     │                      │
CollectionModule <── DecksModule
     ^                      ^
     └───────────┬──────────┘
                 │
          AnalysisModule ── AiModule
```

- **`CardsModule`** (`cards.service.ts`, `cards.controller.ts`) — resuelve cartas contra Scryfall y las cachea en memoria por `id`. Expone `POST /cards/resolve`, `GET /cards/autocomplete`, `GET /cards/:id`. Lo importan `CollectionModule` y `AnalysisModule`.
- **`CollectionModule`** — qué cartas tiene cada usuario y cuántas. `POST /collection/:userId`, `GET /collection/:userId`, `DELETE /collection/:userId/:cardId`. Importa `CardsModule` (para resolver el nombre antes de guardarlo).
- **`DecksModule`** — arma decks **solo con cartas que el usuario ya posee** (`DecksService` valida cantidad contra `CollectionService`), con una regla básica de formato (Commander = singleton, salvo tierras básicas). `POST /decks/:userId`, `GET /decks/user/:userId`, `GET /decks/:deckId`, `POST /decks/:deckId/cards`. Importa `CollectionModule`.
- **`AnalysisModule`** — junta el motor de reglas (`rules/pattern-dictionary.ts` + `rules/combo-matcher.ts`) con la capa de IA (`AiModule`) en `AnalysisService`. Expone `GET /analysis/deck/:deckId` y `GET /analysis/collection/:userId`. Importa `AiModule`, `CardsModule`, `CollectionModule`, `DecksModule`.
- **`AiModule`** — envuelve `ComboAnalysisAiService` (la llamada a NVIDIA NIM). Solo lo usa `AnalysisModule`.

**Todo el almacenamiento de `CollectionModule` y `DecksModule` está en memoria** (`Map` en cada servicio) — se pierde al reiniciar. Cada lugar donde va Prisma está marcado con `// TODO` en el código; la interfaz pública de los servicios no debería cambiar cuando se conecte la base de datos real, solo la implementación interna.

### Cómo probarlo

Colección de Postman incluida: `SynergyMTG.postman_collection.json`. Orden de uso: resolver carta → agregar a colección → crear deck → agregar carta al deck → analizar. Las peticiones de "resolver carta" y "crear deck" guardan automáticamente `cardId`/`deckId` en variables de colección para encadenar las siguientes peticiones sin copiar/pegar nada.

## 5. Capa de IA

### Proveedor y modelo

- **NVIDIA Build** (`build.nvidia.com`) — catálogo de modelos open-weight gratuitos, API compatible con el formato de OpenAI.
- **Modelo elegido: `meta/llama-3.1-8b-instruct`** — no el 70B. Se probaron ambos:
  - El 70B tardó entre 52s y 2 minutos en el free tier compartido, e incluso así **falló en descubrir combos completos** entre cartas mezcladas.
  - El 8B respondió en 1-9 segundos y, cuando se le da un grupo YA filtrado por el motor de reglas, explica correctamente el combo.
- **Alternativa de respaldo:** Claude Haiku 4.5 (vía API de Anthropic), por si la latencia/confiabilidad del free tier de NVIDIA no alcanza en producción real.

### El rol de la IA cambió de "juez" a "narrador"

En pruebas, dejar que la IA decidiera por sí sola si había combo (`combo_found`) produjo tanto falsos positivos (le creyó a un grupo candidato inventado por el motor de reglas y hasta construyó una explicación falsa para justificarlo) como falsos negativos (dijo que no había combo cuando sí lo había). La solución: el motor de reglas le manda a la IA **la conexión mecánica exacta que ya detectó** (qué carta produce qué recurso que otra consume), y el trabajo de la IA es solo traducir eso a lenguaje humano — nunca juzgar si es correcto ni inventar una conexión distinta. Esto no elimina los falsos positivos del motor de reglas (si el motor se equivoca, la IA lo explica igual), pero sí garantiza que cualquier error quede contenido en el motor de reglas — más fácil de depurar — en vez de que la IA agregue alucinaciones nuevas encima.

### Diseño anti-alucinación (`ComboAnalysisAiService`)

1. **Contexto cerrado** + **la conexión ya detectada**, nunca "¿hay combo aquí?" en abierto.
2. **Salida estructurada forzada** vía `nvext.guided_json` (extensión de NVIDIA NIM — en JS va directo en el objeto de params, no dentro de `extra_body` como en Python).
3. **Validador post-respuesta en código**, que NO confía en que el schema se cumplió de verdad: verifica campos, que los `card_ids` devueltos existan en el input, y que `combo_found: true` tenga al menos 2 cartas.
4. **Parseo defensivo** de fences de markdown que algunos modelos agregan pese a la instrucción de no hacerlo.
5. **Temperatura baja (0.2)**, reintentos con backoff ante 429/5xx, timeout de 2.5 min (por la latencia del free tier), y nunca lanza excepción hacia arriba — si la IA falla, el sistema sigue funcionando solo con el motor de reglas.
6. **Saneamiento de entrada:** máximo 4 cartas y 600 caracteres de `oracle_text` por carta.

## 6. Motor de reglas (`rules/pattern-dictionary.ts` + `rules/combo-matcher.ts`)

El corazón del sistema — descubre combos de forma determinística, sin IA.

### Modelo de datos

Cada patrón se etiqueta con los **recursos de juego** que **produce** (genera al resolverse) y **consume** (necesita para activarse). Ejemplo real: *Zuran Orb* produce `land_in_graveyard`. *Ramunap Excavator* consume eso y produce `land_enters_battlefield`, que Zuran Orb consume de vuelta — cierra el loop.

### Cobertura actual: 50 patrones

Tierras · Criaturas (muerte/entrada/sacrificio) · Copiar/desenderezar · Cementerio/recursión/reanimación (incluye Unearth, Embalm/Eternalize) · Cartas/daño · Turnos/combates extra · Hechizos (incluye Extort) · Vida (ganar/perder) · Persist/Undying (CR 702.79a/702.93a) · Ninjutsu/Channel (Kamigawa) · Economía de recursos (flashback, cycling, proliferar, delve, populate, explorar, Treasure/Clue/Food)

**Deliberadamente fuera de alcance:** keywords de combate estático (Flying, Trample, Vigilance, etc.) — no producen ni consumen recursos encadenables.

### El matcher (`combo-matcher.ts`)

- Construye un **grafo dirigido** carta→carta cruzando recursos producidos/consumidos.
- `findLoops`: DFS que detecta ciclos (candidatos a combo infinito/repetible).
- `findChains`: cadenas lineales sin ciclo.
- **Capa de deduplicación:** descarta cualquier loop que sea superconjunto de un loop más chico ya encontrado.
- `RESOURCE_IMPLICATIONS`: recursos que implican a otros (ej. una tierra que "entra" también está "en el campo de batalla").
- **`flexible_creature_target_enters`**: recurso separado de `creature_enters_battlefield` para resolver el problema de identidad — solo lo producen efectos donde el jugador ELIGE el objetivo (copiar, reanimar, parpadear, populate). Persist/Undying/Ninjutsu NO lo producen porque son fijos (siempre la misma carta), evitando que disparen el auto-ETB de otra carta sin relación real.

### Combos reales validados con este motor

| Combo | Cartas | Resultado |
|---|---|---|
| Rampa de tierras | Zuran Orb + Ramunap Excavator + Scute Swarm + Lotus Cobra | LOOP |
| Copiar/desenderezar | Kiki-Jiki, Mirror Breaker + Zealous Conscripts | LOOP |
| Loop de vida | Sanguine Bond + Exquisite Blood | LOOP |
| Contadores + lifelink | Heliod, Sun-Crowned + Walking Ballista | LOOP |
| Contadores + vida | Spike Feeder + Archangel of Thune | LOOP |
| Persist + sacrificio | Viscera Seer + Kitchen Finks / Murderous Redcap | cadenas correctas (Melira etiquetada pero sin poder cerrar el loop — ver limitaciones) |

### Limitaciones encontradas y resueltas

Todas las siguientes fueron encontradas con evidencia real (no en teoría) y corregidas, verificando el fix contra el mismo caso que las reveló:

- **Falso positivo de `damage_trigger`** en *Mikaeus, the Unhallowed* ("Whenever a Human deals damage **to you**, destroy it" — habilidad defensiva, no generaba valor). Corregido excluyendo la frase "to you" del regex.
- **Ruido de `self_etb_trigger`** entre cartas de auto-ETB sin relación real (ej. Kitchen Finks + Murderous Redcap, o 5 cartas de Ninjutsu con Kotose/Moonsnare Specialist en Kamigawa). Corregido con el recurso `flexible_creature_target_enters` (ver arriba).
- **Falso loop entre fetch lands** (Evolving Wilds + Terramorphic Expanse + Prismatic Vista se conectaban entre sí sin razón real). Causa: `land_on_battlefield` trataba "hay una tierra en juego" como recurso escaso, cuando en realidad es casi siempre trivial. Corregido quitando ese consumo de `fetch_land` (se queda solo en `sacrifice_land`, que sí representa motores repetibles como Zuran Orb). Verificado contra CR 701.15a.
- **2 bugs de cobertura en `fetch_land`**: el regex exigía "this land" o "~" literal (Scryfall nunca usa `~`) y la palabra "land" (fetch lands que nombran tipos básicos específicos, como Arid Mesa, no la usan).

### Limitación conocida sin resolver

- **Efectos de prevención** (Melira, Sylvok Outcast; Solemnity — impiden colocar contadores) — el patrón `counter_prevention_effect` solo etiqueta la carta, no la conecta al grafo. El modelo produce/consume no soporta lógica de negación/condicional. Cuando el motor de reglas encuentra Persist + sacrificio, Melira no aparece en el grupo — hace falta que la IA o un humano infiera esa pieza adicional viendo el resultado.
- El wording oficial de Magic cambia con el tiempo (ej. "enters the battlefield" → "enters") — el diccionario necesita revisión periódica, ahora apoyada en Academy Ruins.

## 7. Scripts de prueba sueltos (`npx ts-node`)

- **`test-nvidia-connection.ts`** — prueba de humo de la API key de NVIDIA.
- **`test-combo-analysis.ts`** — pipeline de IA con cartas fijas de ejemplo.
- **`test-combo-real-cards.ts`** — igual, pero con cartas reales de Scryfall por nombre. Soporta `MODEL=<nombre> npx ts-node ...` para comparar modelos.
- **`test-rule-engine.ts`** — motor de reglas solo (sin IA) contra cartas reales. Maneja cartas no resueltas sin tumbar el batch.
- **`test-full-pipeline.ts`** — motor de reglas + IA end-to-end, mostrando la conexión detectada y la explicación para cada candidato.
- **`fetch-cr-rule.ts`** — consulta una regla oficial específica en Academy Ruins.

```bash
npx ts-node src/test-full-pipeline.ts "Zuran Orb" "Ramunap Excavator" "Scute Swarm" "Lotus Cobra"
```

## 8. Próximos pasos

- [ ] Schema de Prisma (`Card`, `UserCollection`, `Deck`, `DeckCard`) y reemplazar el almacenamiento en memoria de `CollectionService`/`DecksService`
- [ ] Reglas de validación de deck completas por formato (hoy solo Commander singleton básico)
- [ ] Modelar contadores de prevención (Melira/Solemnity) en el grafo, o documentar que queda a criterio de la IA/usuario
- [ ] Frontend en Next.js
- [ ] Escaneo de cartas por foto (OCR)
- [ ] Estadísticas de probabilidad de color (hipergeométrico)
- [ ] Soporte de español (segunda fase)
- [ ] Job/queue en background para el análisis de IA (nunca síncrono, dada la latencia del free tier)
- [ ] Seguir ampliando el diccionario de patrones conforme aparezcan huecos con cartas reales