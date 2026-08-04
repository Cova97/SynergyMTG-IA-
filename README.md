# Proyecto: Colección y Analizador de Combos MTG

App full-stack para gestionar una colección personal de cartas de Magic: The Gathering — escaneo/registro de cartas, armado de decks por formato, y un motor de análisis de combos (reglas determinísticas + IA complementaria).

## Estado del proyecto

Aún en fase de diseño y prototipado de la lógica central (motor de reglas + capa de IA). No hay backend NestJS completo todavía — lo construido hasta ahora son módulos de lógica de negocio probados vía scripts sueltos de TypeScript, listos para integrarse al backend real.

## 1. Funcionalidades objetivo

1. Escanear cartas físicas (foto → OCR → resolución contra base de datos)
2. Almacenar la colección categorizada
3. Armar decks por formato (casual, competitivo, Commander, experimental) usando solo cartas que el usuario posee
4. Analizar combos y sinergias posibles entre las cartas de la colección
5. Estadísticas de probabilidad de color (cálculo hipergeométrico)
6. Capa de IA complementaria para explicar combos

## 2. Arquitectura de flujo

```
Ingesta (escaneo OCR o nombre manual)
        ↓
Resolución contra la API de Scryfall (fuzzy search + autocomplete)
        ↓
Base de datos (cache local de Card + UserCollection con cantidad)
        ↓
Deckbuilding por formato (filtra solo cartas que el usuario posee)
        ↓
Motor de análisis
   ├─ Motor de reglas (determinístico) → encuentra grupos candidatos de combo
   ├─ Estadísticas (hipergeométrico) → probabilidad de color
   └─ Capa de IA → EXPLICA los grupos que el motor de reglas ya encontró
        ↓
Frontend (Next.js)
```

**Principio de diseño central, validado empíricamente:** la IA nunca *descubre* combos buscando entre cartas mezcladas — eso lo hace el motor de reglas, de forma determinística. La IA solo *explica en lenguaje natural* un grupo de cartas que el motor de reglas ya identificó como candidato. Se probó lo contrario (pedirle a un LLM que descubra combos desde ruido) y falló consistentemente con dos modelos distintos — ver sección 5.

### Stack técnico

- Backend: NestJS + Prisma + PostgreSQL/MySQL
- Frontend: Next.js
- Infra: Docker
- Módulos de NestJS propuestos: `CardsModule`, `CollectionModule`, `DecksModule`, `AnalysisModule`, `AiModule`

## 3. Integración con la API de Scryfall

Fuente de datos de cartas (gratuita, pública, cubre todo Magic).

- **Endpoint usado:** `GET https://api.scryfall.com/cards/named?fuzzy=<nombre>` — tolera errores tipográficos y nombres incompletos.
- **Headers obligatorios** (si faltan, responde 400):
  ```
  User-Agent: <nombre de tu app>/<version>
  Accept: */*
  ```
- **Idioma:** por ahora solo inglés. La API acepta nombres en otros idiomas vía `/cards/search?q=lang:es+NOMBRE`, pendiente para cuando se agregue soporte de español.
- **Puntuación:** la API ignora apóstrofos y puntos — `"Ashnods Altar"` y `"Ashnod's Altar"` resuelven igual.
- **Buenas prácticas aplicadas:** resolución secuencial (no `Promise.all`) con ~100ms de pausa entre requests, para no saturar el servidor y evitar un bug de Node en Windows (`UV_HANDLE_CLOSING`) que ocurre al forzar `process.exit()` con fetches concurrentes pendientes.
- **Cartas de doble cara** (transform/MDFC): el `oracle_text` no viene en el nivel raíz, hay que leerlo de `card_faces[]`.

## 4. Capa de IA

### Proveedor y modelo

- **NVIDIA Build** (`build.nvidia.com`) — catálogo de modelos open-weight gratuitos, API compatible con el formato de OpenAI.
- **Modelo elegido: `meta/llama-3.1-8b-instruct`** — no el 70B. Se probaron ambos:
  - El 70B tardó entre 52s y 2 minutos en el free tier compartido, e incluso así **falló en descubrir combos completos** entre cartas mezcladas (encontró piezas parciales o nada).
  - El 8B respondió en 1-9 segundos y, cuando se le da un grupo YA filtrado por el motor de reglas, explica correctamente el combo.
- **Alternativa de respaldo:** Claude Haiku 4.5 (vía API de Anthropic), por si la latencia/confiabilidad del free tier de NVIDIA no alcanza en producción real. Costo estimado a la escala de uso personal: centavos al mes.

### Diseño anti-alucinación (`ComboAnalysisAiService`)

1. **Contexto cerrado:** solo se le manda a la IA el `oracle_text` exacto de las cartas candidatas — nunca se le pide que "recuerde" cartas de Magic de su entrenamiento.
2. **Salida estructurada forzada** vía `nvext.guided_json` (extensión de NVIDIA NIM sobre el SDK de OpenAI — en JS va directo en el objeto de params, no dentro de `extra_body` como en Python).
3. **Validador post-respuesta en código**, que NO confía en que el schema se cumplió de verdad (se comprobó que a veces no se aplica): verifica que existan `combo_found`, `card_ids`, `explanation`, `confidence`, que los `card_ids` devueltos existan en el input, y que un `combo_found: true` tenga al menos 2 cartas.
4. **Parseo defensivo:** algunos modelos (el 70B en pruebas) envuelven el JSON en fences de markdown pese a la instrucción explícita de no hacerlo — se limpia antes de parsear.
5. **Temperatura baja (0.2)** — se prioriza consistencia sobre creatividad.
6. **Reintentos con backoff exponencial** ante 429/5xx, timeout generoso (2.5 min) por la latencia observada en el free tier, y nunca lanza excepción hacia arriba: si la IA falla, el sistema sigue funcionando solo con los resultados del motor de reglas.
7. **Saneamiento de entrada:** máximo 4 cartas y 600 caracteres de `oracle_text` por carta, para controlar tokens.

## 5. Motor de reglas (`pattern-dictionary.ts` + `combo-matcher.ts`)

El corazón del sistema — descubre combos de forma determinística, sin IA.

### Modelo de datos

Cada patrón de Magic se etiqueta con los **recursos de juego** que:
- **produce** (lo que genera al resolverse)
- **consume** (lo que necesita para activarse)

Ejemplo real: *Zuran Orb* produce `land_in_graveyard`. *Ramunap Excavator* consume `land_in_graveyard` y produce `land_enters_battlefield`. Encadenados, forman un loop.

### Cobertura actual: 42 patrones en 9 categorías

Tierras · Criaturas (muerte/entrada/sacrificio) · Copiar/desenderezar · Cementerio/recursión/reanimación · Cartas/daño · Turnos/combates extra · Hechizos · Vida (ganar/perder) · Economía de recursos (flashback, cycling, proliferar, delve, populate, explorar, Treasure/Clue/Food)

**Deliberadamente fuera de alcance:** keywords de combate estático (Flying, Trample, Vigilance, etc.) — no producen ni consumen recursos encadenables, así que no aportan a la detección de combos.

### El matcher (`combo-matcher.ts`)

- Construye un **grafo dirigido** carta→carta cruzando recursos producidos/consumidos.
- `findLoops`: DFS que detecta ciclos (candidatos a combo infinito/repetible).
- `findChains`: cadenas lineales sin ciclo (sinergias sin loop).
- **Capa de deduplicación:** descarta cualquier loop que sea superconjunto de un loop más chico ya encontrado — sin esto, un set de cartas con recursos compartidos genera decenas de variantes redundantes del mismo combo base.
- `RESOURCE_IMPLICATIONS`: recursos que implican a otros (ej. una tierra que "entra" también está "en el campo de batalla") — necesario para que ciclos reales cierren correctamente.

### Combos reales validados con este motor

| Combo | Cartas | Resultado |
|---|---|---|
| Rampa de tierras | Zuran Orb + Ramunap Excavator + Scute Swarm + Lotus Cobra | `[LOOP]` detectado correctamente |
| Copiar/desenderezar | Kiki-Jiki, Mirror Breaker + Zealous Conscripts | `[LOOP]` detectado (tras corregir wording moderno de Oracle) |
| Loop de vida | Sanguine Bond + Exquisite Blood | `[LOOP]` detectado |
| Contadores + lifelink | Heliod, Sun-Crowned + Walking Ballista | `[LOOP]` detectado |
| Contadores + vida | Spike Feeder + Archangel of Thune | `[LOOP]` detectado |

### Huecos conocidos (pendientes)

- **Contadores -1/-1** no modelados (solo se rastrean +1/+1) — bloquea detectar combos de **Persist**.
- **Keywords Persist y Undying** sin patrón propio.
- **Efectos de prevención** (cartas tipo Melira, Sylvok Outcast o Solemnity que impiden colocar contadores) — estructuralmente distintos a "producir/consumir", no modelados aún.
- **Falso positivo detectado y documentado:** el patrón `damage_trigger` matcheó la habilidad defensiva de *Mikaeus, the Unhallowed* ("Whenever a Human deals damage to you, destroy it") como si generara combos, cuando esa habilidad no tiene relación con sinergias — ejemplo de que un regex sintácticamente correcto puede producir una conclusión falsa.
- El wording oficial de Magic cambia con el tiempo (ej. "enters the battlefield" → "enters" en templating reciente) — el diccionario necesita revisión periódica.

## 6. Scripts de prueba construidos

Todos ubicados para correr con `npx ts-node`:

- **`test-nvidia-connection.ts`** — prueba de humo: confirma que la API key de NVIDIA funciona.
- **`test-combo-analysis.ts`** — prueba end-to-end del pipeline de IA con cartas de ejemplo fijas.
- **`test-combo-real-cards.ts`** — igual, pero jala cartas reales de Scryfall por nombre (argumentos de línea de comandos). Soporta elegir modelo vía `MODEL=<nombre> npx ts-node ...`.
- **`test-rule-engine.ts`** — corre el motor de reglas (sin IA) contra cartas reales de Scryfall, muestra patrones detectados por carta y los grupos candidatos encontrados. Maneja cartas no resueltas sin tumbar el batch completo.

### Ejemplo de uso

```bash
# Obtener API key gratis en build.nvidia.com

npx ts-node src/test-rule-engine.ts "Zuran Orb" "Ramunap Excavator" "Scute Swarm" "Lotus Cobra"
```

## 7. Próximos pasos

- [ ] Modelar contadores -1/-1, Persist, Undying y efectos de prevención
- [ ] Corregir el falso positivo de `damage_trigger`
- [ ] Conectar el motor de reglas con el servicio de IA de forma automática (pipeline completo)
- [ ] Backend NestJS real con los módulos propuestos
- [ ] Schema de Prisma (`Card`, `UserCollection`, `Deck`, `DeckCard`)
- [ ] Reglas de validación de deck por formato
- [ ] Soporte de español (segunda fase)
- [ ] Job/queue en background para el análisis de IA (nunca síncrono, dada la latencia del free tier)
