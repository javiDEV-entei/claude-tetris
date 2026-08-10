# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de hold** (reserva de pieza): guarda la pieza activa para usarla más tarde, con un uso permitido por pieza.
- **Sistema de habilidades cargables**: una barra de energía se llena al limpiar líneas (con bonus por Tetris, T-spin, combo y Perfect Clear); al llenarse parpadea con un destello y un sonido de fanfarria, y `E` abre un menú para elegir una de cuatro habilidades: ver las 5 piezas siguientes, cambiar la pieza actual por cualquiera de las 7 (con un selector navegable por flechas), ralentizar la caída 10 s (con un contador en pantalla) o deshacer la última colocación.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Modo combo y multiplicadores**: encadenar líneas en piezas consecutivas multiplica la puntuación (x2, x3, x4...), con bonus adicionales por **T-spin**, **Back-to-Back** (Tetris o T-spin consecutivos) y **Perfect Clear** (tablero vacío). Cada logro se anuncia con texto flotante, un destello en las líneas eliminadas y un efecto de sonido sintetizado.
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Pausa** y **Game Over** con opción de reinicio.
- **Silenciar sonido** con un interruptor en pantalla o la tecla `M`.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `Shift`   | Reservar pieza (hold)             |
| `E`       | Abrir menú de habilidad (barra llena) |
| `1`–`4`   | Elegir habilidad en el menú       |
| `←` / `→` / `↑` / `↓` | Mover el resalte al elegir pieza (submenú) |
| `Enter`   | Confirmar la pieza resaltada (submenú) |
| `1`–`7`   | Elegir pieza directamente (submenú) |
| `Esc`     | Cancelar el menú de habilidad     |
| `P`       | Pausar / reanudar                 |
| `M`       | Silenciar / activar sonido        |

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza y la lista de controles.
- Un overlay para los estados **PAUSA** y **GAME OVER**.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–7) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas en dos fases** (`lockPiece` → `finishClear`): al bloquear una pieza se detectan las filas completas y se guardan como "pendientes"; durante `FLASH_MS` milisegundos el tablero muestra un destello sobre esas filas (sin gravedad ni input) y solo entonces `finishClear()` las colapsa, calcula la puntuación y genera la siguiente pieza.
- **Combo y multiplicadores**: `combo` cuenta las piezas consecutivas que limpian al menos una línea; el multiplicador (`min(1 + combo, COMBO_MAX_MULTIPLIER)`) se aplica a la puntuación base y se reinicia en cuanto una pieza bloquea sin limpiar líneas.
- **T-spin** (`detectTspin`): regla de las 3 esquinas — si la última acción fue una rotación exitosa de una pieza T y al menos 3 de las 4 esquinas del bounding box 3×3 están ocupadas, cuenta como T-spin (completo si ambas esquinas "frontales" —las del lado de la punta— están ocupadas; mini en caso contrario).
- **Back-to-Back**: un Tetris (4 líneas) o un T-spin con líneas consecutivos a otro de la misma categoría aplica `× B2B_MULTIPLIER`.
- **Perfect Clear**: si tras colapsar las líneas el tablero queda completamente vacío, se suma el bonus de `PERFECT_CLEAR_SCORES`.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` (o las tablas de T-spin) multiplicada por combo, B2B y nivel; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.
- **Audio sintetizado**: no hay archivos de sonido; `beep()` genera tonos con `OscillatorNode`/`GainNode` de Web Audio API para combo, líneas, T-spin, Perfect Clear, Game Over, barra llena y uso de habilidad. El `AudioContext` se crea de forma perezosa en la primera tecla pulsada.
- **Cola de piezas** (`queue`): siempre contiene `QUEUE_SIZE` piezas generadas por adelantado; `spawn()` saca la primera y añade una nueva al final, así la habilidad "ver 5 piezas" solo necesita mostrar el contenido de la cola.
- **Sistema de habilidades** (`energy`): gana energía en `finishClear()` según las líneas limpiadas y sus bonus, con tope en `ENERGY_MAX`. Al llenarse dispara un destello y un parpadeo con halo en la barra (`triggerEnergyFullEffect`), un aviso flotante más largo (`ENERGY_MSG_MS`) y una fanfarria distinta al resto de sonidos. `E` (`openAbilityMenu`) pausa el juego y muestra un overlay para elegir una de las 4 habilidades (`useAbility`); "cambiar pieza" abre un segundo submenú con las 7 piezas, navegable con las flechas y confirmable con `Enter` (`swapIndex`, `renderSwapSelection`, `swapToPiece`). "Ralentizar" muestra un contador (`drawSlowTimer`) dibujado sobre el tablero. "Deshacer" restaura una foto del estado (`lastSnapshot`) que `lockPiece()` guarda antes de cada bloqueo. `choosingAbility` detiene el bucle igual que `paused`, y todo el estado se reinicia en `init()`.

### Flujo del juego

```
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ descuenta floatMsgs y clearFlash con dt
     ├─ si hay filas pendientes → al agotarse clearFlash, finishClear()
     ├─ si no, acumula dt y baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + destello + ghost + pieza actual + textos flotantes)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / pausa / silenciar
```

Mientras hay filas pendientes de colapsar, `current` es `null`: no hay pieza activa en pantalla y el input de movimiento/rotación/hold queda bloqueado hasta que `finishClear()` genera la siguiente pieza.

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme)
├── game.js         # Toda la lógica del Tetris (~300 líneas)
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `COLORS`       | Paleta de colores por tipo de pieza      | 7 colores             |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |
| `COMBO_MAX_MULTIPLIER` | Tope del multiplicador de combo  | `4`                    |
| `TSPIN_SCORES` | Puntos por T-spin (0–3 líneas)           | `[400,800,1200,1600]` |
| `MINI_TSPIN_SCORES` | Puntos por Mini T-spin (0–2 líneas) | `[100,200,400]`       |
| `PERFECT_CLEAR_SCORES` | Bonus por Perfect Clear (0–4 líneas) | `[0,800,1200,1800,2000]` |
| `B2B_MULTIPLIER` | Multiplicador de Back-to-Back          | `1.5`                  |
| `FLASH_MS`     | Duración del destello de líneas en ms    | `180`                  |
| `FLOAT_MS`     | Duración de los textos flotantes en ms   | `900`                  |
| `QUEUE_SIZE`   | Piezas visibles por adelantado en la cola | `5`                    |
| `ENERGY_MAX`   | Energía necesaria para activar una habilidad | `100`              |
| `ENERGY_PER_LINE` | Energía ganada por línea limpiada     | `8`                     |
| `ENERGY_TETRIS_BONUS` | Bonus de energía por Tetris (4 líneas) | `10`               |
| `ENERGY_TSPIN_BONUS` | Bonus de energía por T-spin con líneas | `12`                |
| `ENERGY_COMBO_BONUS` | Bonus de energía por combo activo (× combo) | `2`             |
| `ENERGY_PERFECT_BONUS` | Bonus de energía por Perfect Clear  | `20`                 |
| `SLOW_FACTOR`  | Multiplicador de `dropInterval` al ralentizar | `2.5`              |
| `SLOW_MS`      | Duración de la ralentización en ms       | `10000`                |
| `PEEK_PIECES`  | Piezas colocadas que dura "ver 5 piezas" | `5`                     |
| `ENERGY_MSG_MS` | Duración del aviso "¡ENERGÍA LISTA!" en ms | `1800`               |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.

---

## Menú de pausa

Al pulsar `P` o `Esc` durante la partida se abre un menú de pausa navegable con teclado (`↑`/`↓`/`Enter`) o con clic:

| Opción           | Acción                                                    |
| ---------------- | ---------------------------------------------------------- |
| Reanudar         | Cierra el menú y continúa la partida                        |
| Reiniciar        | Reinicia la partida (equivale a pulsar "Reiniciar" en game over) |
| Ver controles    | Muestra la lista de teclas del juego                        |
| Nivel inicial    | Selector (1–15) del nivel con el que empieza cada partida nueva, ajustable con `←`/`→` |

`Esc` dentro de cualquier submenú vuelve a la pantalla anterior (o reanuda la partida si está en la pantalla principal). El nivel inicial elegido se guarda en `localStorage` (clave `startLevel`) y se aplica automáticamente a la próxima partida — el nivel nunca baja del elegido aunque las líneas acumuladas correspondan a un nivel inferior.

---

## Pantalla de inicio y tabla de records

Al cargar la página se muestra `#start-overlay` en vez de arrancar la partida directamente: un título, el top 5 de puntuaciones guardado localmente, el mejor combo y el máximo de líneas conseguidos, y un botón **Jugar** que oculta la pantalla de inicio y llama a `init()` (el clic también sirve como gesto de usuario para desbloquear el `AudioContext`).

- **Almacenamiento**: `localStorage`, clave `records`, en JSON: `{ scores: [{ name, score, lines, level }, ...], bestCombo, maxLines }`. `scores` guarda como máximo 5 entradas, ordenadas de mayor a menor puntuación.
- **Helpers en `game.js`**: `loadRecords()` (lee y valida el JSON con `try/catch`, con valores por defecto si no hay nada guardado o está corrupto), `saveRecords(data)`, `qualifies(score)` (indica si una puntuación entra en el top 5) y `addRecord(name, score, lines, level)` (inserta, reordena, recorta a 5, actualiza `bestCombo`/`maxLines` y devuelve el índice insertado).
- **`renderRecords(container, highlightIndex)`** pinta el top 5 en cualquier contenedor — se usa tanto en la pantalla de inicio (`#records-list-start`) como en el overlay de Game Over (`#records-list-gameover`), resaltando la fila indicada si se pasa un índice.
- Al perder la partida, si la puntuación entra en el top 5 se muestra un formulario (`#record-form`) para introducir un nombre (`#record-name`, máx. 12 caracteres); al guardar se llama a `addRecord` y se pinta la tabla resaltando la fila nueva. Si no entra en el top 5, se pinta la tabla directamente sin resaltar nada.
- Un botón **Borrar records** (con `confirm()` de por medio) está disponible tanto en la pantalla de inicio como en el overlay de Game Over.
- `maxCombo` es una nueva global que guarda el mejor combo de la partida en curso (actualizada en `finishClear()`, reseteada a `0` en `init()`) y se usa para alimentar `bestCombo` al guardar un record.
---

## Temas visuales (skins)

Un selector `SKIN` en el panel lateral (junto a la barra de energía) permite cambiar la apariencia completa del juego — tablero, next, hold, peek, selector de "cambiar pieza" y toda la interfaz vía variables CSS — sin afectar al interruptor claro/oscuro existente, que sigue funcionando de forma independiente.

Skins disponibles:

- **Retro** — bloques cuadrados y colores planos, el aspecto original del juego.
- **Neon** — fondo negro con efecto de resplandor (`shadowBlur`) alrededor de cada bloque.
- **Pastel** — paleta de colores suaves con esquinas redondeadas.
- **Pixel art** — colores planos con una textura de cuadrícula superpuesta que simula dithering.

La skin elegida se guarda en `localStorage` (`skin`) y persiste entre partidas, igual que el tema claro/oscuro y el silencio de sonido. En `game.js`, la estructura `SKINS` centraliza la paleta y la función de dibujado de cada skin; `drawBlock` delega en `SKINS[skin].draw(...)` para pintar cada bloque en cualquier canvas del juego.
