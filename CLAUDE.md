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
- **Rendering**: immediate-mode. `draw()` clears and repaints grid → locked board → line-clear flash → ghost piece (alpha 0.2, via `drawBlock`'s `alpha` param) → current piece → floating combo/T-spin text, every frame. The next-piece preview uses a second canvas + `drawNext()`.
- **Two-phase line clear (combo system)**: locking a piece no longer clears lines synchronously. `lockPiece()` merges, finds full rows via `findFullRows()`, and if any exist sets `current = null` and `clearFlash = FLASH_MS` instead of spawning — `pendingRows`/`pendingTspin` hold the pending clear. `loop()` counts `clearFlash` down against `dt`; at zero it calls `finishClear()`, which collapses the rows, scores combo/T-spin/B2B/Perfect Clear, pushes floating messages, plays a sound, and only then calls `spawn()`. **`current` can be `null` for the `FLASH_MS` window between lock and the next spawn** — `draw()`, `loop()`'s gravity branch, and the `keydown` handler all guard on it; any new code touching `current` must do the same. `detectTspin()` (piece = T, last input was a successful rotation, ≥3 of the 4 bounding-box corners occupied) must run *before* `merge()`, since it needs `current`'s pre-merge position.
- **Combo/B2B state**: `combo` (−1 = no active combo) increments on every clear and resets to −1 the moment a lock produces zero full rows; `b2b` tracks whether the last "hard" clear (Tetris or T-spin-with-lines) was back-to-back. `lastMoveWasRotation` — set `true` only by a successful `tryRotate()`, cleared by every other move/gravity step — gates T-spin detection and must be updated at every new call site that moves `current`.
- **Audio**: synthesized via Web Audio (`beep()` + `OscillatorNode`/`GainNode`), no audio files. `audioCtx` is created lazily on first keydown (autoplay policies block it before a user gesture). All sound triggers check the `muted` global first.

## Coupling constraints

- `COLS`/`ROWS`/`BLOCK` in `game.js` must stay in sync with `<canvas id="board" width height>` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK` = 300×600). Nothing computes or asserts this — changing one without the other silently misrenders.
- `drawNext()` hardcodes a 4×4 centering grid and `NB = 30`, matching `#next-canvas` at 120×120.
- `game.js` looks up DOM elements by id at load time (`score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `board`, `next-canvas`, `hold-canvas`, `hold-section`, `theme-toggle`, `mute-toggle`) — renaming an id in `index.html` breaks the script immediately on load.
- `spawn()` calls `endGame()` on a spawn collision but execution continues on to `drawNext()` afterward; the loop only actually stops via `cancelAnimationFrame`. Code added after `spawn()` in that call path still runs on game over.

See `README.md` for the full list of tunable constants (`LINE_SCORES`, initial `dropInterval`, etc.) and controls.

## Conventions

- UI-facing strings and code comments are in Spanish (`PAUSA`, `GAME OVER`, `Puntuación`, `Reiniciar`) — keep new user-visible text in Spanish; identifiers stay in English.
- Two-space indent, semicolons, ES6+ browser-native only. Don't introduce a bundler, package manager, or framework unless asked.
