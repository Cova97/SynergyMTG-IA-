# SynergyMTG — Colección, Deckbuilding y Analizador de Combos MTG

App full-stack para gestionar una colección personal de cartas de Magic: The Gathering — registro de cartas, armado de decks por formato, y un motor de análisis de combos (reglas determinísticas + IA complementaria), con un frontend que dibuja el grafo de sinergias en vivo.

## Estado del proyecto

**Backend, base de datos y frontend funcionando de punta a punta.** Backend real de NestJS con Postgres (Docker), motor de reglas de 50+ patrones muy probado, capa de IA endurecida contra fallas reales, reglas de deckbuilding verificadas contra las Comprehensive Rules oficiales, estadísticas de maná (hipergeométrico), y un frontend en Next.js que muestra la colección, arma decks, y dibuja el grafo de combos interactivo con imágenes reales de las cartas.

## Estructura del repo (monorepo, dos carpetas hermanas)

```
SynergyMTG-IA-/
├── backend/          — NestJS + Prisma + PostgreSQL
├── frontend/         — Next.js 16 + React 19 + Tailwind v4
├── .gitignore
└── README.md
```

Cada carpeta tiene su propio `package.json` y `node_modules` — se corren por separado, en dos terminales:
```bash
cd backend && npm run start:dev    # puerto 3001 (o el que configures)
cd frontend && npm run dev         # puerto 3000
```

## 1. Funcionalidades

| # | Funcionalidad | Estado |
|---|---|---|
| 1 | Escaneo de cartas por foto (OCR) | Pendiente |
| 2 | Colección categorizada | ✅ Backend + Frontend |
| 3 | Deckbuilding por formato con reglas oficiales | ✅ Backend + Frontend |
| 4 | Análisis de combos (reglas + IA) | ✅ Backend + Frontend, con grafo visual |
| 5 | Estadísticas de probabilidad de color (hipergeométrico) | ✅ Backend + Frontend |
| 6 | Capa de IA complementaria | ✅ Construida y endurecida |

## 2. Arquitectura de flujo

```
Ingesta (nombre manual; OCR pendiente)
        ↓
Scryfall (fuzzy search)                          [CardsModule]
        ↓
PostgreSQL — Card + UserCollection                [PrismaModule + CardsModule + CollectionModule]
        ↓
Deckbuilding por formato + reglas oficiales (CR)  [DecksModule]
        ↓
Motor de análisis                                  [AnalysisModule]
   ├─ Motor de reglas (determinístico) → grafo de recursos produce/consume
   ├─ Estadísticas (hipergeométrico) → probabilidad de color por turno
   └─ Capa de IA → EXPLICA los grupos que el motor de reglas ya encontró
        ↓
Frontend (Next.js) → dibuja el grafo, muestra la colección y los decks
```

**Principio de diseño central, validado empíricamente todo el proyecto:** la IA nunca *descubre* combos ni decide qué cartas están involucradas — eso lo hace el motor de reglas, de forma determinística. La IA solo *narra en lenguaje natural* la conexión exacta que el motor de reglas ya detectó. Ni siquiera se confía en que la IA repita bien los `card_ids` — se toman directo de lo que el motor de reglas ya sabe.

## 3. APIs externas integradas

### 3.1 Scryfall — datos de cartas
- `GET /cards/named?fuzzy=<nombre>` — tolera errores tipográficos.
- Headers obligatorios: `User-Agent` y `Accept` (si faltan, 400).
- `oracle_text` nunca usa `~` para autorreferencia, siempre el nombre real de la carta.
- `color_identity` se cachea además de `colors` — necesario para validar Commander.

### 3.2 Academy Ruins — Comprehensive Rules oficiales
- `GET https://api.academyruins.com/file/cr/:version` — texto crudo del CR.
- Fuente de verdad para diseñar cada patrón nuevo del diccionario — evitó varios bugs con wording exacto (Persist, Undying, Ninjutsu, Extort, "modified" CR 700.9, "attacks alone" CR 506.5, tamaños de deck CR 100.2a/903.5a, comandante CR 903.3/903.4/903.5c, Sacrificar CR 701.15a, duplicadores de trigger).

## 4. Base de datos (Prisma + PostgreSQL)

**Schema:** `Card` (cache de Scryfall, incluye `colorIdentity`), `UserCollection` (una fila por usuario+carta, cantidad con `upsert`), `Deck` (`format` como enum, `commanderCardId` opcional), `DeckCard`.

**Infraestructura:** `docker-compose.yml` — Postgres 16 en contenedor, puerto host **5433** (no 5432, para evitar chocar con un Postgres nativo de Windows).

**Problemas reales resueltos (referencia para el futuro):**
- Residuos de la guía de "Prisma Postgres" (producto en la nube, no el clásico) mezclados en `tsconfig.json` — revertido a config estándar de NestJS.
- Prisma reciente exige un driver adapter explícito (`@prisma/adapter-pg`) para Postgres.
- Columnas nuevas sin dato histórico (`colorIdentity`) quedan vacías en filas viejas — hay que re-resolver esas cartas o usar `prisma migrate reset`.
- `EADDRINUSE` en el puerto 3000 causado por un contenedor de Docker distinto usándolo — identificado con `sudo ss -tlnp`.
- Tabla faltante (`P2021`) tras cambiar de máquina/entorno — se resuelve con `npx prisma migrate dev` o `migrate reset`.

## 5. Reglas de deckbuilding por formato (`DecksService`)

| Formato | Tamaño | Copias máximas |
|---|---|---|
| Casual / Competitive / Experimental | Mínimo 60, sin máximo (CR 100.2a) | 4, salvo tierras básicas |
| Commander | Exactamente 100 (1 comandante + 99) (CR 903.5a) | 1, salvo tierras básicas (CR 903.5c) |

- `POST /decks/:deckId/commander` — designa comandante explícitamente (debe ser legendario y Criatura/Vehículo/Nave espacial, CR 903.3).
- Identidad de color (CR 903.4) validada en cada carta agregada.
- `GET /decks/:deckId/validate` — completitud del deck, informativo.
- Validado en vivo con un deck real (Raiyuu, Storm's Edge como comandante).

## 6. Capa de IA

**Modelo:** NVIDIA Build, `meta/llama-3.1-8b-instruct` (gratis). El 70B se descartó (mismo tiempo o peor, y fallaba en descubrir combos).

**Rol: "narrador", no "juez".** El motor de reglas le manda la conexión ya detectada; la IA solo la traduce a lenguaje humano.

**Fallas reales encontradas en producción y cómo se endureció:**
- JSON truncado por `max_tokens` bajo → subido a 600 + instrucción de brevedad.
- Nombres de campo variables (`explicacion`, `reason`) → el validador acepta alias conocidos.
- `card_ids` ausente o inválido repetidamente → **se dejó de pedírselo a la IA por completo**, se toma directo de las cartas de entrada (el motor de reglas ya lo sabe).
- `confidence` ausente → default `"medium"` en vez de descartar la respuesta.
- Logging de la respuesta cruda agregado para diagnosticar fallas futuras con datos reales.

## 7. Motor de reglas (`rules/pattern-dictionary.ts` + `rules/combo-matcher.ts`)

**Modelo de datos:** cada patrón produce y/o consume "recursos de juego". Un grafo dirigido conecta cartas cuando lo que una produce es lo que otra consume. `findLoops` detecta ciclos (combo infinito), `findChains` cadenas simples, con deduplicación de loops redundantes.

**Cobertura: 50+ patrones** — tierras, criaturas, copiar/desenderezar, cementerio/reanimación, vida, daño, Persist/Undying, Ninjutsu/Channel, Unearth/Embalm/Eternalize/Extort, "modified" (CR 700.9), y separación "atacar" vs "atacar solo" (CR 506.5).

**Sistema de amplificadores** (`AMPLIFIER_PATTERNS`): cartas que DUPLICAN una habilidad desencadenada (ej. Isshin, Two Heavens as One) no se tratan como nodo normal del grafo — se anotan aparte en cada grupo candidato, evitando que se conecten "por accidente" con el resto.

### Combos reales validados
Zuran Orb+Ramunap Excavator+Scute Swarm+Lotus Cobra · Kiki-Jiki+Zealous Conscripts · Sanguine Bond+Exquisite Blood · Heliod+Walking Ballista · Spike Feeder+Archangel of Thune · Viscera Seer+Persist · Raiyuu+Selfless Samurai (vía `creature_attacks_alone`) · Goro-Goro/Akki Battle Squad+Ancestral Katana (vía "modified") · Isshin duplicando triggers de ataque (vía amplifiers).

### Limitaciones conocidas sin resolver
- **Efectos de prevención** (Melira, Sylvok Outcast; Solemnity) — solo etiquetados, no conectados al grafo (el modelo produce/consume no soporta negación).
- El wording oficial de Magic cambia con el tiempo — revisión periódica apoyada en Academy Ruins.

## 8. Backend NestJS — módulos

```
PrismaModule (global)
CardsModule ←── CollectionModule ←── DecksModule
                                          ↑
                                   AnalysisModule ── AiModule
```

- **`CardsModule`** — `POST /cards/resolve`, `GET /cards/autocomplete`, `GET /cards/:id`.
- **`CollectionModule`** — `POST/GET/DELETE /collection/:userId`.
- **`DecksModule`** — CRUD de decks, comandante, validación.
- **`AnalysisModule`** — `GET /analysis/deck/:deckId`, `GET /analysis/collection/:userId`, `GET /analysis/deck/:deckId/mana-stats`.
- **`AiModule`** — envuelve `ComboAnalysisAiService`.

**CORS habilitado** en `main.ts` (`app.enableCors`) — necesario porque el frontend corre en un puerto distinto al backend.

## 9. Frontend (Next.js 16 + React 19 + Tailwind v4)

### Stack real (no lo que se planeó al inicio — lo que terminó instalado)
- **Next.js 16.3.1** con Turbopack, App Router.
- **React 19.2.8** — esto importa: la librería de grafos tuvo que ser `@xyflow/react` (v12+), no `reactflow` (v11), porque v11 no soporta React 19.
- **Tailwind v4** — configuración basada en CSS (`@theme inline` dentro de `globals.css`), no en `tailwind.config.ts` como en v3. Incompatible con la sintaxis vieja si se mezclan.

### Estructura
```
frontend/
├── app/
│   ├── page.tsx              → "/" — Colección (grid de cartas + análisis)
│   ├── layout.tsx            → fuentes (Fraunces/IBM Plex) + sidebar
│   └── decks/
│       ├── page.tsx          → "/decks" — lista + crear deck
│       └── [deckId]/page.tsx → "/decks/:id" — detalle + maná + grafo
├── components/                (11 componentes)
├── lib/
│   ├── api.ts                 — cliente fetch tipado hacia el backend
│   └── types.ts                — tipos que reflejan las respuestas del backend
```

### El grafo de sinergia (`SynergyGraph.tsx`)
Nodos = cartas con su imagen real de Scryfall. Aristas **violetas animadas** = parte de un `[LOOP]`. Aristas **verdes estáticas** = cadenas. Aristas **punteadas doradas con ×2** = amplificadores (ej. Isshin) — visualmente distintas de una conexión real del combo. Layout circular simple, nodos arrastrables.

`AnalysisPanel.tsx` recibe `mode: 'deck' | 'collection'` (nunca una función como prop — Next.js no permite pasar funciones de un componente de servidor a uno de cliente) y decide internamente si llama a `analyzeDeck` o `analyzeCollection`.

### Diseño visual
Fondo azul-carbón oscuro (`#0F1115`), acento violeta-arcano (`#7C6CFF`), y los 5 colores reales de maná usados funcionalmente (no solo decorativos) en las aristas del grafo y las estadísticas. Tipografía: Fraunces (display) + IBM Plex Sans (cuerpo) + IBM Plex Mono (datos/costos).

### Problemas reales resueltos (referencia para el futuro)
- **`frontend/` anidada dentro de `backend/`** por accidente al correr `create-next-app` — causaba que TypeScript del backend intentara compilar JSX/componentes de Next, tronando con errores confusos. Resuelto moviendo `frontend/` a ser hermana, no hija.
- **CORS bloqueado** entre `localhost:3000` (frontend) y `localhost:3001` (backend) — resuelto con `app.enableCors()` en el backend.
- **`next/image` rechazaba `cards.scryfall.io`** — hay que declarar `remotePatterns` en `next.config.ts` (Next 16 genera `.ts`, no `.js`, por default).
- **Next Image devolvía 400 al optimizar imágenes de Scryfall** — el optimizador server-side de Next chocaba con la CDN de Scryfall. Resuelto con `images.unoptimized: true` (las imágenes ya vienen optimizadas de origen).
- **Runtime error si el backend no manda `connections`/`amplifiers`** — el frontend ahora usa `?? []` defensivamente, para no tronar si el backend corre una versión desactualizada.

## 10. Scripts de prueba sueltos (`backend/`, con `npx ts-node`)
`test-nvidia-connection.ts`, `test-combo-analysis.ts`, `test-combo-real-cards.ts`, `test-rule-engine.ts`, `test-full-pipeline.ts`, `fetch-cr-rule.ts` — para probar piezas del motor de reglas/IA sin levantar el backend completo.

## 11. Próximos pasos

- [ ] Modelar efectos de prevención (Melira/Solemnity) en el grafo, o aceptar la limitación documentada
- [ ] Job/queue en background para el análisis de IA (hoy es síncrono — el request HTTP espera a que NVIDIA responda)
- [ ] Escaneo de cartas por foto (OCR)
- [ ] Soporte de español (segunda fase)
- [ ] Autenticación real (hoy `userId` es un string libre en la URL)
- [ ] Seguir ampliando el diccionario de patrones conforme aparezcan huecos con cartas reales
