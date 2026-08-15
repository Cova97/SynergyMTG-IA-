# Proyecto: SynergyMTG — Colección y Analizador de Combos MTG

App full-stack para gestionar una colección personal de cartas de Magic: The Gathering — escaneo/registro de cartas, armado de decks por formato, y un motor de análisis de combos (reglas determinísticas + IA complementaria).

## Estado del proyecto

**Backend real de NestJS con base de datos Postgres real (no en memoria).** 5 módulos completos (`CardsModule`, `CollectionModule`, `DecksModule`, `AnalysisModule`, `AiModule`, más `PrismaModule` global) conectados entre sí, con persistencia real vía Prisma + Postgres (Docker), y probados de punta a punta con Postman contra datos reales. Reglas de deckbuilding por formato implementadas y verificadas contra las Comprehensive Rules oficiales, incluyendo Commander completo (comandante designado, singleton, identidad de color). Motor de reglas y capa de IA construidos, probados extensamente, y hechos más robustos hoy tras encontrar fallas reales en producción.

## 1. Funcionalidades objetivo

1. Escanear cartas físicas (foto → OCR → resolución contra base de datos) — *pendiente*
2. Almacenar la colección categorizada — construido, con Postgres real
3. Armar decks por formato (casual, competitivo, Commander, experimental) usando solo cartas que el usuario posee — construido y validado en vivo, con reglas oficiales completas (ver sección 5)
4. Analizar combos y sinergias posibles entre las cartas de la colección — construido y validado extensamente, incluyendo endurecimiento de la capa de IA contra fallas reales
5. Estadísticas de probabilidad de color (cálculo hipergeométrico) — *pendiente*
6. Capa de IA complementaria para explicar combos — construida y endurecida

## 2. Arquitectura de flujo

```
Ingesta (escaneo OCR o nombre manual)
        ↓
Resolución contra la API de Scryfall (fuzzy search + autocomplete)  [CardsModule]
        ↓
Base de datos Postgres real (Card + UserCollection con cantidad)    [PrismaModule + CardsModule + CollectionModule]
        ↓
Deckbuilding por formato + reglas oficiales (CR)                    [DecksModule]
        ↓
Motor de análisis                                                    [AnalysisModule]
   ├─ Motor de reglas (determinístico) → encuentra grupos candidatos de combo
   ├─ Estadísticas (hipergeométrico) → probabilidad de color (pendiente)
   └─ Capa de IA [AiModule] → EXPLICA los grupos que el motor de reglas ya encontró
        ↓
Frontend (Next.js) — pendiente
```

**Principio de diseño central, validado empíricamente:** la IA nunca *descubre* combos buscando entre cartas mezcladas — eso lo hace el motor de reglas, de forma determinística. La IA solo *explica en lenguaje natural* la conexión mecánica exacta que el motor de reglas ya identificó (rol de "narrador", no de "juez" — ver sección 6). Hoy se llevó este principio un paso más lejos: ni siquiera se confía en que la IA repita correctamente qué cartas están involucradas — eso también se toma directo del motor de reglas.

### Stack técnico

- Backend: NestJS + TypeScript
- Base de datos: **PostgreSQL real, corriendo en Docker**, vía Prisma ORM con driver adapter (`@prisma/adapter-pg` — las versiones recientes de Prisma lo exigen)
- Frontend: Next.js (pendiente)
- Testing manual: colección de Postman incluida (`SynergyMTG.postman_collection.json`), con variables encadenadas automáticamente

## 3. APIs externas integradas

### 3.1 Scryfall — datos de cartas

Fuente de datos de cartas (gratuita, pública, cubre todo Magic). Usada por `CardsService`.

- **Endpoint usado:** `GET https://api.scryfall.com/cards/named?fuzzy=<nombre>` — tolera errores tipográficos y nombres incompletos.
- **Headers obligatorios** (si faltan, responde 400): `User-Agent: <nombre de tu app>/<version>` y `Accept: */*`.
- **Idioma:** por ahora solo inglés.
- **Puntuación:** la API ignora apóstrofos y puntos. El `oracle_text` nunca usa el símbolo `~` — siempre sustituye el nombre real de la carta.
- **`color_identity`** también se cachea desde Scryfall (no solo `colors`) — necesario para validar Commander (ver sección 5).
- **Cartas de doble cara** (transform/MDFC): el `oracle_text` no viene en el nivel raíz, hay que leerlo de `card_faces[]`.

### 3.2 Academy Ruins — reglas oficiales (Comprehensive Rules)

`academyruins.com` / `api.academyruins.com`. Sirve las Comprehensive Rules oficiales de Magic en texto estructurado.

- **Endpoint usado:** `GET https://api.academyruins.com/file/cr/:version` — texto crudo del CR (versión = código de set, ej. `WOE`).
- **Herramienta construida:** `fetch-cr-rule.ts` — consulta una regla específica por número.
- **Reglas verificadas hoy para el deckbuilder:** CR 100.2a (tamaño mínimo/copias máximas constructed), CR 903.5a (tamaño exacto Commander), CR 903.5c (singleton Commander), CR 903.3 (qué puede ser comandante), CR 903.4 (identidad de color), CR 701.15a (Sacrificar — usada para validar el fix de fetch lands), CR 903.9a (cómo se comporta el reemplazo a la zona de mando).

## 4. Base de datos (Prisma + PostgreSQL)

### Schema (`prisma/schema.prisma`)

- **`Card`** — cache de Scryfall: `id` (UUID real de Scryfall), `oracleText`, `manaCost`, `typeLine`, `colors`, **`colorIdentity`** (usada para Commander), `rarity`, `set`, `imageUri`.
- **`UserCollection`** — `@@unique([userId, cardId])`: una sola fila por usuario+carta, la cantidad se incrementa con `upsert` en vez de duplicar filas.
- **`Deck`** — `format` como `enum` de Prisma (`casual | competitive | commander | experimental`), más **`commanderCardId`** (relación opcional a `Card`).
- **`DeckCard`** — `@@unique([deckId, cardId])`, mismo patrón que `UserCollection`.

### Infraestructura: Docker + Postgres local

`docker-compose.yml` incluido — Postgres 16 en un contenedor con volumen persistente. **Puerto expuesto en 5433, no 5432** — se cambió a propósito porque chocaba con un Postgres nativo de Windows corriendo en paralelo (dos procesos escuchando el mismo puerto causaban que las conexiones cayeran al Postgres equivocado, con errores de autenticación engañosos).

### Problemas reales resueltos hoy (para referencia futura)

- **Residuos de la guía "Prisma Postgres" de Prisma** (el producto de base de datos administrada en la nube, NO el Postgres clásico) mezclados en `tsconfig.json` tras seguir esa guía por error: `module: "ESNext"`, `moduleResolution: "bundler"`, `ignoreDeprecations: "6.0"`, `resolvePackageJsonExports` — todos incompatibles con NestJS/CommonJS. Se revirtió a la configuración estándar de NestJS.
- **Prisma reciente exige un driver adapter explícito** para Postgres (`@prisma/adapter-pg`) — ya no basta con la `url` en `datasource.db`. `PrismaService` construye el adapter con `DATABASE_URL` y lo pasa al constructor de `PrismaClient`.
- **Columna nueva sin dato histórico:** al agregar `colorIdentity`, las cartas ya guardadas quedan con `[]` (default) hasta que se vuelven a resolver — un array vacío pasa cualquier chequeo de identidad de color por accidente (falso "sí es legal"). Hay que re-resolver cartas viejas tras un cambio de schema así, o usar `npx prisma migrate reset` para empezar limpio.
- No pude validar el schema con `npx prisma validate`/`generate` en mi propio entorno de verificación — `binaries.prisma.sh` está bloqueado ahí. Toda la verificación de este tipo se hizo cruzando nombres de campo a mano contra el schema real.

## 5. Reglas de deckbuilding por formato (`DecksService`)

Verificadas contra las Comprehensive Rules oficiales, no inventadas:

| Formato | Regla de tamaño | Copias máximas |
|---|---|---|
| Casual / Competitive / Experimental | Mínimo 60, sin máximo (CR 100.2a) | 4 copias de cualquier carta, salvo tierras básicas (CR 100.2a) |
| Commander | Exactamente 100 (1 comandante + 99) (CR 903.5a) | 1 copia, salvo tierras básicas (CR 903.5c) |

- **`POST /decks/:deckId/commander`** — designa el comandante explícitamente (no es "la primera carta que metas"). Valida que sea legendaria y Criatura/Vehículo/Nave espacial (CR 903.3), y que el usuario la posea.
- **Identidad de color (CR 903.4):** al agregar una carta a un deck Commander, se compara su `color_identity` contra la del comandante designado — cualquier color fuera de esa identidad rechaza la carta con un mensaje explicando por qué.
- **`GET /decks/:deckId/validate`** — revisa si el deck ya cumple el tamaño de su formato (informativo, no bloquea mientras se construye poco a poco).
- **Validado en vivo:** deck de Commander con Raiyuu, Storm's Edge (R/W) como comandante — Touch the Spirit Realm (W) y Experimental Synthesizer (R) se aceptaron correctamente, Kotose, the Silent Spider (U/B) se rechazó con el mensaje citando CR 903.4.

## 6. Capa de IA

### Proveedor y modelo

NVIDIA Build, `meta/llama-3.1-8b-instruct` (gratis). El 70B se descartó — mismo tiempo o peor, y falló en descubrir combos completos.

### El rol de la IA: "narrador", no "juez"

El motor de reglas le manda a la IA la conexión mecánica exacta ya detectada; la IA solo la traduce a lenguaje humano, nunca decide si hay combo ni inventa una conexión distinta.

### Fallas reales encontradas hoy en producción, y cómo se endureció el sistema

Probando el pipeline completo desde el backend real (no solo scripts sueltos), aparecieron fallas nuevas que no se habían visto antes:

- **JSON truncado a mitad de respuesta** — el modelo se puso verboso (varios párrafos) y chocó contra `max_tokens: 400`, cortando el JSON sin cerrar. **Arreglo:** subido a `600`, más una instrucción explícita en el prompt de mantener `explanation` corta (2-3 oraciones, sin saltos de línea).
- **Nombres de campo distintos cada vez** — el modelo mandó `explicacion` (español) y en otra corrida `reason`, en vez de `explanation`. **Arreglo:** el validador acepta varios alias conocidos (`explanation`, `explicacion`, `reason`, `razon`) en vez de descartar la respuesta por el nombre del campo.
- **`card_ids` ausente o inválido, repetidamente.** **Cambio de diseño, no solo un parche:** como el motor de reglas ya sabe qué cartas está explicando (se las manda él mismo en el prompt), el sistema **dejó de confiar en que la IA los repita** — `card_ids` ahora se toma directo de las cartas de entrada conocidas, nunca de la respuesta de la IA. Esto elimina de raíz toda una categoría de fallos.
- **`confidence` ausente:** ya no descarta la respuesta completa — si falta o viene mal, se usa `"medium"` por default (es informativo, no crítico).
- **Logging agregado:** cuando el parseo o la validación fallan, se loguea la respuesta cruda completa (nivel `DEBUG`) para poder diagnosticar con datos reales en vez de adivinar.

### Diseño anti-alucinación (resumen actualizado)

1. Contexto cerrado + conexión ya detectada por el motor de reglas.
2. Salida estructurada forzada vía `nvext.guided_json`.
3. `card_ids` nunca se toma de la IA — siempre de la entrada conocida.
4. Alias de nombre de campo aceptados para `explanation`; `confidence` con default seguro.
5. Parseo defensivo de fences de markdown.
6. Temperatura baja (0.2), reintentos con backoff, timeout de 2.5 min, nunca lanza excepción hacia arriba.
7. Máximo 4 cartas y 600 caracteres de `oracle_text` por carta.

## 7. Motor de reglas (`rules/pattern-dictionary.ts` + `rules/combo-matcher.ts`)

### Modelo de datos

Cada patrón se etiqueta con los **recursos de juego** que produce y consume. Ejemplo real: *Zuran Orb* produce `land_in_graveyard`, *Ramunap Excavator* lo consume y produce `land_enters_battlefield`, que Zuran Orb consume de vuelta — cierra el loop.

### Cobertura actual: 50 patrones

Tierras · Criaturas (muerte/entrada/sacrificio) · Copiar/desenderezar · Cementerio/recursión/reanimación · Cartas/daño · Turnos/combates extra · Hechizos · Vida · Persist/Undying · Ninjutsu/Channel · Economía de recursos (flashback, cycling, proliferar, delve, populate, explorar, Treasure/Clue/Food)

**Deliberadamente fuera de alcance:** keywords de combate estático (Flying, Trample, Vigilance, etc.).

### Combos reales validados

| Combo | Cartas | Resultado |
|---|---|---|
| Rampa de tierras | Zuran Orb + Ramunap Excavator + Scute Swarm + Lotus Cobra | LOOP |
| Copiar/desenderezar | Kiki-Jiki, Mirror Breaker + Zealous Conscripts | LOOP |
| Loop de vida | Sanguine Bond + Exquisite Blood | LOOP |
| Contadores + lifelink | Heliod, Sun-Crowned + Walking Ballista | LOOP (validado hoy también desde el backend real vía Postman) |
| Contadores + vida | Spike Feeder + Archangel of Thune | LOOP |
| Persist + sacrificio | Viscera Seer + Kitchen Finks / Murderous Redcap | cadenas correctas |

### Limitaciones encontradas y resueltas

- **Falso positivo de `damage_trigger`** en Mikaeus, the Unhallowed — corregido excluyendo "to you" del regex.
- **Ruido de `self_etb_trigger`** entre cartas de auto-ETB sin relación real — corregido con el recurso `flexible_creature_target_enters`, separado del `creature_enters_battlefield` genérico.
- **Falso loop entre fetch lands** — corregido quitando `land_on_battlefield` de `fetch_land` (efecto de un solo uso, no motor repetible). Verificado contra CR 701.15a.
- **2 bugs de cobertura en `fetch_land`**: no aceptaba el nombre propio de la carta (Scryfall nunca usa `~`), ni fetch lands que nombran tipos básicos específicos sin decir la palabra "land".

### Limitaciones conocidas sin resolver

- **Efectos de prevención** (Melira, Sylvok Outcast; Solemnity) — solo etiquetados, no conectados al grafo (el modelo produce/consume no soporta negación).
- **`GET /analysis/deck/:deckId` no incluye al comandante** en el análisis — solo lee `deck.cards` (las 99), el comandante vive aparte en `commanderCardId` y el endpoint no lo toma en cuenta. Encontrado analizando un deck real donde el comandante (Raiyuu, Storm's Edge) y otra carta (Asari Captain) comparten literalmente la misma condición de disparo ("Whenever a Samurai or Warrior you control attacks alone") — una sinergia temática real que el sistema no puede ver porque el comandante nunca entra al análisis.
- **No existe ningún patrón que "produzca" el recurso `creature_attacks`** — atacar se modela solo como algo que se consume, nunca como algo que una carta genera. Esto significa que aunque se arregle el punto anterior, esa sinergia específica seguiría sin cerrar en el grafo.
- El wording oficial de Magic cambia con el tiempo — el diccionario necesita revisión periódica, apoyada en Academy Ruins.

## 8. Backend NestJS — módulos y cómo se conectan

```
PrismaModule (global)
     ↑ usado por todos
CardsModule <───────────────┐
     ^                      │
     │                      │
CollectionModule <── DecksModule
     ^                      ^
     └───────────┬──────────┘
                 │
          AnalysisModule ── AiModule
```

- **`PrismaModule`** — `@Global()`, envuelve `PrismaService` (conexión a Postgres vía driver adapter). Disponible en cualquier módulo sin reimportarlo.
- **`CardsModule`** — resuelve cartas contra Scryfall, las persiste en `Card`. `POST /cards/resolve`, `GET /cards/autocomplete`, `GET /cards/:id`.
- **`CollectionModule`** — `POST /collection/:userId`, `GET /collection/:userId`, `DELETE /collection/:userId/:cardId`.
- **`DecksModule`** — `POST /decks/:userId`, `POST /decks/:deckId/commander`, `POST /decks/:deckId/cards`, `GET /decks/:deckId`, `GET /decks/:deckId/validate`, `GET /decks/user/:userId`. Importa `CardsModule` (identidad de color) y `CollectionModule` (validar posesión).
- **`AnalysisModule`** — `GET /analysis/deck/:deckId`, `GET /analysis/collection/:userId`. Importa `AiModule`, `CardsModule`, `CollectionModule`, `DecksModule`.
- **`AiModule`** — envuelve `ComboAnalysisAiService`.

### Cómo probarlo

Colección de Postman incluida y actualizada: `SynergyMTG.postman_collection.json`, con variables encadenadas automáticamente (`cardId`, `commanderCardId`, `deckId`).

## 9. Scripts de prueba sueltos (`npx ts-node`)

- **`test-nvidia-connection.ts`**, **`test-combo-analysis.ts`**, **`test-combo-real-cards.ts`**, **`test-rule-engine.ts`**, **`test-full-pipeline.ts`**, **`fetch-cr-rule.ts`** — sin cambios respecto a antes, siguen sirviendo para probar piezas sueltas sin levantar el backend completo.

## 10. Próximos pasos

- [ ] Incluir al comandante en `GET /analysis/deck/:deckId` (hoy se ignora por completo)
- [ ] Modelar `creature_attacks` como recurso que también se puede producir, no solo consumir
- [ ] Modelar contadores de prevención (Melira/Solemnity) en el grafo, o documentar que queda a criterio de la IA/usuario
- [ ] Frontend en Next.js
- [ ] Escaneo de cartas por foto (OCR)
- [ ] Estadísticas de probabilidad de color (hipergeométrico)
- [ ] Soporte de español (segunda fase)
- [ ] Job/queue en background para el análisis de IA (nunca síncrono, dada la latencia del free tier)
- [ ] Seguir ampliando el diccionario de patrones conforme aparezcan huecos con cartas reales
