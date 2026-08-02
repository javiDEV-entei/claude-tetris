# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build, no dependencies, no test suite — nothing to install. Two ways to run it:

```bash
start index.html        # Windows, opens the file directly
python3 -m http.server 8000   # or: npx serve .
```

Verification is manual in a browser; there is no test command.

## Architecture

`game.js` is a single non-module script (`<script src="game.js">`, `'use strict'`) with all game state in module-level `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`). `init()` is both first boot and restart — any new state variable must be reset there or it will survive a restart.

- **Board model**: a `ROWS × COLS` matrix of ints. The int is *both* "occupied" and the piece/color id — `PIECES[n]` matrices are filled with the value `n`, which indexes `COLORS[n]`. Adding a new piece type means appending to *both* `PIECES` and `COLORS` at the same index and updating the `Math.floor(Math.random() * 7) + 1` in `randomPiece()`.
- **Rotation**: recomputed geometrically each time (`rotateCW` = transpose + reverse) rather than stored as rotation states. `tryRotate()` tries kick offsets `[0,-1,1,-2,2]` on the x axis only — there's no SRS kick table and no floor kick, so extending rotation behavior means replacing this approach, not adding to it.
- **Game loop**: `loop(ts)` is `requestAnimationFrame`-driven, accumulating `dropAccum` against `dropInterval`, and it also owns all rendering for the frame. Pause/game-over work via `cancelAnimationFrame(animId)`; `togglePause()` resets `lastTime` before resuming so `dt` doesn't spike by the full pause duration.
- **Rendering**: immediate-mode. `draw()` clears and repaints grid → locked board → ghost piece (alpha 0.2, via `drawBlock`'s `alpha` param) → current piece, every frame. The next-piece preview uses a second canvas + `drawNext()`.

## Coupling constraints

- `COLS`/`ROWS`/`BLOCK` in `game.js` must stay in sync with `<canvas id="board" width height>` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK` = 300×600). Nothing computes or asserts this — changing one without the other silently misrenders.
- `drawNext()` hardcodes a 4×4 centering grid and `NB = 30`, matching `#next-canvas` at 120×120.
- `game.js` looks up DOM elements by id at load time (`score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `board`, `next-canvas`) — renaming an id in `index.html` breaks the script immediately on load.
- `spawn()` calls `endGame()` on a spawn collision but execution continues on to `drawNext()` afterward; the loop only actually stops via `cancelAnimationFrame`. Code added after `spawn()` in that call path still runs on game over.

See `README.md` for the full list of tunable constants (`LINE_SCORES`, initial `dropInterval`, etc.) and controls.

## Conventions

- UI-facing strings and code comments are in Spanish (`PAUSA`, `GAME OVER`, `Puntuación`, `Reiniciar`) — keep new user-visible text in Spanish; identifiers stay in English.
- Two-space indent, semicolons, ES6+ browser-native only. Don't introduce a bundler, package manager, or framework unless asked.
