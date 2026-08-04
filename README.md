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
- **Audio sintetizado**: no hay archivos de sonido; `beep()` genera tonos con `OscillatorNode`/`GainNode` de Web Audio API para combo, líneas, T-spin, Perfect Clear y Game Over. El `AudioContext` se crea de forma perezosa en la primera tecla pulsada.

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

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
