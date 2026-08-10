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

`game.js` is a single non-module script (`<script src="game.js">`, `'use strict'`) with all game state in module-level `let` globals (`board`, `current`, `queue`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `dropAccum`, `animId`). `init()` is both first boot and restart — any new state variable must be reset there or it will survive a restart.

- **Board model**: a `ROWS × COLS` matrix of ints. The int is *both* "occupied" and the piece/color id — `PIECES[n]` matrices are filled with the value `n`, which indexes `COLORS[n]`. Adding a new piece type means appending to *both* `PIECES` and `COLORS` at the same index and updating the `Math.floor(Math.random() * 7) + 1` in `randomPiece()`.
- **Rotation**: recomputed geometrically each time (`rotateCW` = transpose + reverse) rather than stored as rotation states. `tryRotate()` tries kick offsets `[0,-1,1,-2,2]` on the x axis only — there's no SRS kick table and no floor kick, so extending rotation behavior means replacing this approach, not adding to it.
- **Game loop**: `loop(ts)` is `requestAnimationFrame`-driven, accumulating `dropAccum` against `dropInterval`, and it also owns all rendering for the frame. Pause/game-over work via `cancelAnimationFrame(animId)`; `togglePause()` resets `lastTime` before resuming so `dt` doesn't spike by the full pause duration.
- **Rendering**: immediate-mode. `draw()` clears and repaints grid → locked board → line-clear flash → ghost piece (alpha 0.2, via `drawBlock`'s `alpha` param) → current piece → floating combo/T-spin text, every frame. The next-piece preview uses a second canvas + `drawNext()`.
- **Two-phase line clear (combo system)**: locking a piece no longer clears lines synchronously. `lockPiece()` merges, finds full rows via `findFullRows()`, and if any exist sets `current = null` and `clearFlash = FLASH_MS` instead of spawning — `pendingRows`/`pendingTspin` hold the pending clear. `loop()` counts `clearFlash` down against `dt`; at zero it calls `finishClear()`, which collapses the rows, scores combo/T-spin/B2B/Perfect Clear, pushes floating messages, plays a sound, and only then calls `spawn()`. **`current` can be `null` for the `FLASH_MS` window between lock and the next spawn** — `draw()`, `loop()`'s gravity branch, and the `keydown` handler all guard on it; any new code touching `current` must do the same. `detectTspin()` (piece = T, last input was a successful rotation, ≥3 of the 4 bounding-box corners occupied) must run *before* `merge()`, since it needs `current`'s pre-merge position.
- **Combo/B2B state**: `combo` (−1 = no active combo) increments on every clear and resets to −1 the moment a lock produces zero full rows; `b2b` tracks whether the last "hard" clear (Tetris or T-spin-with-lines) was back-to-back. `lastMoveWasRotation` — set `true` only by a successful `tryRotate()`, cleared by every other move/gravity step — gates T-spin detection and must be updated at every new call site that moves `current`.
- **Audio**: synthesized via Web Audio (`beep()` + `OscillatorNode`/`GainNode`), no audio files. `audioCtx` is created lazily on first keydown (autoplay policies block it before a user gesture). All sound triggers check the `muted` global first.
- **Piece queue**: `next` was replaced by `queue`, an array kept at `QUEUE_SIZE` (5) piece objects. `spawn()` does `current = queue.shift(); queue.push(randomPiece());` instead of swapping a single lookahead — this exists so the "ver 5 piezas" ability just has to render `queue[0..4]` instead of generating anything new.
- **Loadable abilities (energy bar)**: `energy` fills in `finishClear()` from lines cleared plus Tetris/T-spin/combo/Perfect-Clear bonuses, capped at `ENERGY_MAX`. On the not-full→full transition it also fires `triggerEnergyFullEffect()` (removes and re-adds the `just-filled` class with a forced reflow via `energySection.offsetWidth` in between, so the CSS sweep animation can restart even if it was already present) and pushes the "¡ENERGÍA LISTA!" float message with an explicit longer duration. `pushFloatMsg(text, color, duration = FLOAT_MS)` takes an optional per-message duration — `ENERGY_MSG_MS` is the only caller that overrides it; `loop()`/`drawFloatMsgs()` already normalize against each message's own `total`, so no other change was needed to support that. At full bar, `KeyE` → `openAbilityMenu()` sets `choosingAbility = true` and `cancelAnimationFrame(animId)` — **`choosingAbility` stops the rAF loop exactly like `paused`/`gameOver`, and the top-level `keydown` listener special-cases it before every other branch** (numeric keys pick an ability via `handleAbilityKey()`, `Escape` cancels), so any new global key must be added after that early return or it'll leak into the ability menu. `closeAbilityMenu()` resets `lastTime` before calling `loop()` again, same pattern as `togglePause()`, so `dt` doesn't spike. "Cambiar pieza" is a second screen (`abilityMenu = 'swap'`) that only spends the energy once a piece type is chosen; it's navigable with the arrow keys (`swapIndex`, wrapped ±1 on left/right, clamped ±4 on up/down since the grid is 4 columns wide and index 7 doesn't exist) and confirmed with `Enter`/`Space`, with `renderSwapSelection()` toggling a `.selected` class on the matching `.swap-item` — digit keys `1`-`7` still work as a direct shortcut alongside it. "Deshacer" restores a full snapshot (`lastSnapshot`) that `lockPiece()` captures — **before** `detectTspin()`/`merge()` — on every lock, holding `board`, `score`, `lines`, `level`, `dropInterval`, `combo`, `b2b`, `energy`, `hold`, `canHold` and `queue` (as piece type ints, rebuilt with `pieceFromType`). "Ralentizar" just sets `slowTimer`, counted down in `loop()`; it multiplies `dropInterval` locally for the gravity check rather than mutating the global, since level-ups recompute `dropInterval` independently in `finishClear()`. Its remaining time is rendered by `drawSlowTimer()`, called from `draw()` **outside** the `if (current)` guard (right before `drawFloatMsgs()`) since the countdown must stay visible during the line-flash window where `current` is `null`. All of `energy`, `choosingAbility`, `abilityMenu`, `slowTimer`, `peekLeft`, `lastSnapshot`, `swapIndex` are reset in `init()`.

## Coupling constraints

- `COLS`/`ROWS`/`BLOCK` in `game.js` must stay in sync with `<canvas id="board" width height>` in `index.html` (`COLS*BLOCK` × `ROWS*BLOCK` = 300×600). Nothing computes or asserts this — changing one without the other silently misrenders.
- `drawNext()` hardcodes a 4×4 centering grid and `NB = 30`, matching `#next-canvas` at 120×120.
- `game.js` looks up DOM elements by id at load time (`score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`, `board`, `next-canvas`, `next-section`, `hold-canvas`, `hold-section`, `theme-toggle`, `mute-toggle`, `energy-section`, `energy-fill`, `peek-section`, `peek-canvas`, `ability-overlay`, `ability-main`, `ability-swap`, `ability-4`, plus every `.swap-canvas`) — renaming an id in `index.html` breaks the script immediately on load.
- `spawn()` calls `endGame()` on a spawn collision but execution continues on to `drawNext()` afterward; the loop only actually stops via `cancelAnimationFrame`. Code added after `spawn()` in that call path still runs on game over.

See `README.md` for the full list of tunable constants (`LINE_SCORES`, initial `dropInterval`, etc.) and controls.

## Conventions

- UI-facing strings and code comments are in Spanish (`PAUSA`, `GAME OVER`, `Puntuación`, `Reiniciar`) — keep new user-visible text in Spanish; identifiers stay in English.
- Two-space indent, semicolons, ES6+ browser-native only. Don't introduce a bundler, package manager, or framework unless asked.

## Records and the start screen

The page no longer boots straight into `init()`. The script's final block renders the top 5 into `#records-list-start` and unhides `#start-overlay`; only the `#play-btn` click handler (registered with `{ once: true }`, so a second click is a no-op) hides that overlay and calls `init()` — that click is also the user gesture used to `ensureAudio()`.

- **Storage**: `localStorage` key `records`, JSON-encoded: `{ scores: [{ name, score, lines, level }, ...], bestCombo, maxLines }`, `scores` capped at 5 and kept sorted descending by `score`. `loadRecords()`/`saveRecords()` are the only functions touching that key; `loadRecords()` wraps `JSON.parse` in `try/catch` and falls back to `{ scores: [], bestCombo: 0, maxLines: 0 }` on missing or corrupt data.
- `qualifies(score)` and `addRecord(name, score, lines, level)` (insert, sort, slice to 5, update `bestCombo`/`maxLines`, save, return the inserted index) are the only mutation path into the top 5; `renderRecords(container, highlightIndex)` is the only render path, shared by `#records-list-start` and `#records-list-gameover`.
- `maxCombo` (new global, reset to `0` in `init()`) tracks the best `combo` reached in the current run — `finishClear()` updates it with one line (`maxCombo = Math.max(maxCombo, combo);`) right after `combo++`, and `addRecord()` folds it into `bestCombo`.
- `endGame()` — still the sole place that owns `#overlay`'s Game Over content — now also decides between showing `#record-form` (score qualifies) or `renderRecords(recordsListGameOver, null)` directly (it doesn't), and unhides `#clear-records-btn`. Submitting `#record-form` calls `addRecord()` then re-renders with the returned index highlighted. `togglePause()` is guarded by `if (gameOver) return;`, so it can never run after `endGame()` has repurposed `#overlay` — no reset of the records UI was needed in that path.
