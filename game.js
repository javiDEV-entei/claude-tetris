'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

// ==================== Skins visuales ====================
// Cada skin define su propia paleta (mismo formato que COLORS, índice 0 =
// null) y una función draw(context, px, py, w, color, alpha) que recibe
// coordenadas de PÍXEL ya calculadas por drawBlock (no de celda).

const NEON_COLORS = [
  null,
  '#00e5ff', // I
  '#ffea00', // O
  '#e040fb', // T
  '#00e676', // S
  '#ff1744', // Z
  '#2979ff', // J
  '#ff9100', // L
];

const PASTEL_COLORS = [
  null,
  '#a8ded8', // I
  '#fff2b2', // O
  '#dcb8e0', // T
  '#bfe6c1', // S
  '#f3b8b8', // Z
  '#b8d4f0', // J
  '#f5d3a8', // L
];

function retroDrawBlock(context, px, py, w, color, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(px, py, w, w);
  context.fillStyle = blockHighlight;
  context.fillRect(px, py, w, 4);
  context.globalAlpha = 1;
}

function neonDrawBlock(context, px, py, w, color, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = '#050505';
  context.fillRect(px, py, w, w);
  context.shadowBlur = 12;
  context.shadowColor = color;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 1, py + 1, w - 2, w - 2);
  context.fillStyle = color;
  context.globalAlpha = (alpha ?? 1) * 0.5;
  context.fillRect(px + 4, py + 4, w - 8, w - 8);
  context.globalAlpha = alpha ?? 1;
  // Reset obligatorio: si no, el glow se filtra a todo lo dibujado después
  // en este mismo contexto (grid, texto flotante, HUD del canvas).
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  context.globalAlpha = 1;
}

function pastelDrawBlock(context, px, py, w, color, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(px, py, w, w, 4);
  context.fill();
  context.fillStyle = 'rgba(255, 255, 255, 0.5)';
  context.beginPath();
  context.roundRect(px, py, w, Math.max(w * 0.35, 3), 4);
  context.fill();
  context.globalAlpha = 1;
}

function pixelDrawBlock(context, px, py, w, color, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(px, py, w, w);
  const cell = w / 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      context.fillStyle = (r + c) % 2 === 0 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.14)';
      context.fillRect(px + c * cell, py + r * cell, cell, cell);
    }
  }
  context.globalAlpha = 1;
}

const SKINS = {
  retro: { colors: COLORS, draw: retroDrawBlock },
  neon: { colors: NEON_COLORS, draw: neonDrawBlock },
  pastel: { colors: PASTEL_COLORS, draw: pastelDrawBlock },
  pixel: { colors: COLORS, draw: pixelDrawBlock },
};

const LINE_SCORES = [0, 100, 300, 500, 800];

// --- Modo combo y multiplicadores ---
const COMBO_MAX_MULTIPLIER = 4;                // x2, x3, x4 y tope
const TSPIN_SCORES = [400, 800, 1200, 1600];   // 0,1,2,3 líneas con T-spin
const MINI_TSPIN_SCORES = [100, 200, 400];     // 0,1,2 líneas con Mini T-spin
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000];
const B2B_MULTIPLIER = 1.5;
const FLASH_MS = 180;
const FLOAT_MS = 900;
const QUEUE_SIZE = 5;

// --- Sistema de habilidades cargables ---
const ENERGY_MAX = 100;
const ENERGY_PER_LINE = 8;      // energía por línea limpiada
const ENERGY_TETRIS_BONUS = 10; // bonus si el clear es de 4 líneas
const ENERGY_TSPIN_BONUS = 12;  // bonus si el clear viene de un T-spin
const ENERGY_COMBO_BONUS = 2;   // × combo activo
const ENERGY_PERFECT_BONUS = 20;
const SLOW_FACTOR = 2.5;        // multiplicador de dropInterval al ralentizar
const SLOW_MS = 10000;
const PEEK_PIECES = 5;          // duración de "ver 5 piezas" en piezas colocadas
const ENERGY_MSG_MS = 1800;     // duración del aviso "¡ENERGÍA LISTA!" (el resto usa FLOAT_MS)

// Las 4 orientaciones de la pieza T (según rotateCW) con las esquinas
// "frontales" (las adyacentes a la punta) de cada una, en coordenadas
// relativas al bounding box 3x3: [fila, columna].
const T_ORIENTATIONS = [
  { shape: [[0,3,0],[3,3,3],[0,0,0]], front: [[0,0],[0,2]] }, // punta arriba
  { shape: [[0,3,0],[0,3,3],[0,3,0]], front: [[0,2],[2,2]] }, // punta derecha
  { shape: [[0,0,0],[3,3,3],[0,3,0]], front: [[2,0],[2,2]] }, // punta abajo
  { shape: [[0,3,0],[3,3,0],[0,3,0]], front: [[0,0],[2,0]] }, // punta izquierda
];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const holdSection = document.getElementById('hold-section');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const muteToggle = document.getElementById('mute-toggle');
const energySection = document.getElementById('energy-section');
const energyFill = document.getElementById('energy-fill');
const nextSection = document.getElementById('next-section');
const peekSection = document.getElementById('peek-section');
const peekCanvas = document.getElementById('peek-canvas');
const peekCtx = peekCanvas.getContext('2d');
const abilityOverlay = document.getElementById('ability-overlay');
const abilityMainBox = document.getElementById('ability-main');
const abilitySwapBox = document.getElementById('ability-swap');
const ability4Option = document.getElementById('ability-4');
const swapCanvases = Array.from(document.querySelectorAll('.swap-canvas'));
const swapItems = Array.from(document.querySelectorAll('.swap-item'));
const startOverlay = document.getElementById('start-overlay');
const playBtn = document.getElementById('play-btn');
const recordForm = document.getElementById('record-form');
const recordNameInput = document.getElementById('record-name');
const recordsListGameOver = document.getElementById('records-list-gameover');
const recordsListStart = document.getElementById('records-list-start');
const clearRecordsBtn = document.getElementById('clear-records-btn');
const startClearRecordsBtn = document.getElementById('start-clear-records-btn');
const skinSelect = document.getElementById('skin-select');

const pauseOverlay = document.getElementById('pause-overlay');
const pauseMainBox = document.getElementById('pause-main');
const pauseControlsBox = document.getElementById('pause-controls');
const pauseLevelBox = document.getElementById('pause-level');
const pauseResumeEl = document.getElementById('pause-resume');
const pauseRestartEl = document.getElementById('pause-restart');
const pauseViewControlsEl = document.getElementById('pause-view-controls');
const pauseViewLevelEl = document.getElementById('pause-view-level');
const pauseControlsBackEl = document.getElementById('pause-controls-back');
const pauseLevelBackEl = document.getElementById('pause-level-back');
const pauseLevelNumEl = document.getElementById('pause-level-num');
const pauseLevelDecEl = document.getElementById('pause-level-dec');
const pauseLevelIncEl = document.getElementById('pause-level-inc');
const pauseMainOptions = [pauseResumeEl, pauseRestartEl, pauseViewControlsEl, pauseViewLevelEl];
const START_LEVEL_MIN = 1;
const START_LEVEL_MAX = 15;

let board, current, queue, hold, canHold, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor, blockHighlight;
let skin;
let combo, b2b, lastMoveWasRotation, pendingRows, pendingTspin, clearFlash, floatMsgs, muted;
let comboColor, tspinColor, slowColor;
let energy, choosingAbility, abilityMenu, slowTimer, peekLeft, lastSnapshot, swapIndex;
let pauseMenu, pauseIndex, startLevel;
let maxCombo;

function updateThemeColors() {
  const styles = getComputedStyle(document.body);
  gridColor = styles.getPropertyValue('--grid-line').trim();
  blockHighlight = styles.getPropertyValue('--block-highlight').trim();
  comboColor = styles.getPropertyValue('--combo-text').trim();
  tspinColor = styles.getPropertyValue('--tspin-text').trim();
  slowColor = styles.getPropertyValue('--slow-text').trim();
}

function setTheme(light) {
  document.body.classList.toggle('light-mode', light);
  themeToggle.checked = light;
  updateThemeColors();
}

themeToggle.addEventListener('change', () => {
  setTheme(themeToggle.checked);
  localStorage.setItem('theme', themeToggle.checked ? 'light' : 'dark');
});

setTheme(localStorage.getItem('theme') === 'light');

const storedStartLevel = parseInt(localStorage.getItem('startLevel'), 10);
startLevel = Number.isFinite(storedStartLevel)
  ? Math.min(START_LEVEL_MAX, Math.max(START_LEVEL_MIN, storedStartLevel))
  : 1;

function setSkin(name) {
  skin = SKINS[name] ? name : 'retro';
  document.body.dataset.skin = skin;
  if (skinSelect) skinSelect.value = skin;
  updateThemeColors();
  localStorage.setItem('skin', skin);
  // Guards: al llamarse en la carga inicial (antes de init()), `board` y
  // `queue` todavía no existen — repintar solo lo que ya puede dibujarse sin
  // tronar. drawHold() es segura siempre (drawPreview corta en `!piece`).
  if (typeof board !== 'undefined' && board) draw();
  drawHold();
  if (typeof queue !== 'undefined' && queue) drawNext();
  drawSwapOptions();
}

if (skinSelect) skinSelect.addEventListener('change', () => setSkin(skinSelect.value));

setSkin(localStorage.getItem('skin') || 'retro');

function setMuted(value) {
  muted = value;
  muteToggle.checked = muted;
  localStorage.setItem('muted', muted ? '1' : '0');
}

muteToggle.addEventListener('change', () => setMuted(muteToggle.checked));

// ==================== Audio sintetizado (Web Audio API) ====================

let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep(freq, durationMs, type, startDelayMs, gainValue) {
  if (muted) return;
  const ac = ensureAudio();
  if (!ac) return;
  const startAt = ac.currentTime + (startDelayMs || 0) / 1000;
  const duration = durationMs / 1000;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainValue ?? 0.2, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function playComboSound(comboCount) {
  const freq = 440 + Math.min(comboCount, 10) * 60;
  beep(freq, 120, 'square', 0, 0.15);
}

function playLineClearSound(n) {
  if (n === 4) {
    [523.25, 659.25, 783.99].forEach((f, i) => beep(f, 200, 'triangle', i * 40, 0.18));
  } else {
    beep(392 + n * 60, 130, 'sine', 0, 0.15);
  }
}

function playTspinSound() {
  [349.23, 440, 523.25].forEach((f, i) => beep(f, 180, 'sawtooth', i * 30, 0.15));
}

function playPerfectClearSound() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => beep(f, 220, 'triangle', i * 80, 0.2));
}

function playGameOverSound() {
  beep(440, 500, 'sawtooth', 0, 0.2);
  beep(220, 500, 'sawtooth', 150, 0.15);
}

function playEnergyFullSound() {
  // Fanfarria ascendente de 5 notas con la última sostenida, para distinguirla
  // de los arpegios cortos de Tetris/Perfect Clear.
  [392, 523.25, 659.25, 783.99].forEach((f, i) => beep(f, 130, 'triangle', i * 70, 0.16));
  beep(1046.5, 400, 'triangle', 4 * 70, 0.2);
}

function playAbilitySound() {
  [659.25, 830.61, 987.77].forEach((f, i) => beep(f, 100, 'sine', i * 50, 0.15));
}

// ==================== Lógica del tablero ====================

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function pieceFromType(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  return pieceFromType(Math.floor(Math.random() * 7) + 1);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastMoveWasRotation = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// Detecta T-spin (regla de las 3 esquinas) para la pieza T actual, evaluado
// justo antes del merge, con la posición final ya bloqueada.
function detectTspin() {
  if (current.type !== 3 || !lastMoveWasRotation) return 'none';

  const orientation = T_ORIENTATIONS.find(o => JSON.stringify(o.shape) === JSON.stringify(current.shape));
  if (!orientation) return 'none';

  const isOccupied = (r, c) => {
    const x = current.x + c;
    const y = current.y + r;
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    return board[y][x] !== 0;
  };

  const allCorners = [[0, 0], [0, 2], [2, 0], [2, 2]];
  const occupiedCount = allCorners.filter(([r, c]) => isOccupied(r, c)).length;
  if (occupiedCount < 3) return 'none';

  const frontOccupied = orientation.front.every(([r, c]) => isOccupied(r, c));
  return frontOccupied ? 'full' : 'mini';
}

function findFullRows() {
  const rows = [];
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) rows.push(r);
  }
  return rows;
}

function collapseRows(rows) {
  // Cada splice+unshift dejó intactos los índices de las filas por debajo de
  // la eliminada (se compensan entre sí) pero desplaza +1 las de arriba, así
  // que hay que procesar de arriba hacia abajo (índice ascendente) para que
  // los índices restantes en `rows` sigan siendo válidos en cada iteración.
  const ascending = [...rows].sort((a, b) => a - b);
  for (const r of ascending) {
    board.splice(r, 1);
    board.unshift(new Array(COLS).fill(0));
  }
}

function isBoardEmpty() {
  return board.every(row => row.every(v => v === 0));
}

function pushFloatMsg(text, color, duration = FLOAT_MS) {
  floatMsgs.push({ text, color, life: duration, total: duration });
}

function finishClear() {
  const rows = pendingRows;
  const n = rows.length;
  const tspin = pendingTspin;
  pendingRows = null;
  pendingTspin = 'none';

  collapseRows(rows);

  let base;
  if (tspin === 'full') base = TSPIN_SCORES[n];
  else if (tspin === 'mini') base = MINI_TSPIN_SCORES[n] ?? MINI_TSPIN_SCORES[MINI_TSPIN_SCORES.length - 1];
  else base = LINE_SCORES[n] || 0;

  const isHard = n === 4 || (tspin !== 'none' && n > 0);
  let total = base;

  if (isHard && b2b) {
    total *= B2B_MULTIPLIER;
    pushFloatMsg('BACK-TO-BACK', comboColor);
  }
  b2b = isHard;

  combo++;
  maxCombo = Math.max(maxCombo, combo);
  const comboMult = Math.min(1 + combo, COMBO_MAX_MULTIPLIER);
  if (combo > 0) {
    total *= comboMult;
    pushFloatMsg(`COMBO x${comboMult}`, comboColor);
    playComboSound(combo);
  }

  if (tspin === 'full') {
    pushFloatMsg(n === 0 ? 'T-SPIN' : `T-SPIN ${['', '', 'DOBLE', 'TRIPLE'][n] || ''}`.trim(), tspinColor);
    playTspinSound();
  } else if (tspin === 'mini') {
    pushFloatMsg('MINI T-SPIN', tspinColor);
    playTspinSound();
  } else if (n > 0) {
    playLineClearSound(n);
  }

  let perfectClear = false;
  if (n > 0 && isBoardEmpty()) {
    total += PERFECT_CLEAR_SCORES[n] || 0;
    perfectClear = true;
    pushFloatMsg('¡TABLERO PERFECTO!', comboColor);
    playPerfectClearSound();
  }

  let gain = n * ENERGY_PER_LINE;
  if (n === 4) gain += ENERGY_TETRIS_BONUS;
  if (tspin !== 'none' && n > 0) gain += ENERGY_TSPIN_BONUS;
  if (combo > 0) gain += combo * ENERGY_COMBO_BONUS;
  if (perfectClear) gain += ENERGY_PERFECT_BONUS;
  const wasFull = energy >= ENERGY_MAX;
  energy = Math.min(ENERGY_MAX, energy + gain);
  if (!wasFull && energy >= ENERGY_MAX) {
    pushFloatMsg('¡ENERGÍA LISTA!', comboColor, ENERGY_MSG_MS);
    playEnergyFullSound();
    updateEnergyUI();
    triggerEnergyFullEffect();
  } else {
    updateEnergyUI();
  }

  lines += n;
  score += Math.round(total * level);
  level = Math.max(startLevel, Math.floor(lines / 10) + 1);
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  updateHUD();

  spawn();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lastMoveWasRotation = false;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    lastMoveWasRotation = false;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  lastSnapshot = {
    board: board.map(row => row.slice()),
    type: current.type,
    score, lines, level, dropInterval,
    combo, b2b, energy,
    hold: hold ? hold.type : null,
    canHold,
    queue: queue.map(p => p.type),
  };

  const tspin = detectTspin();
  merge();
  const rows = findFullRows();

  canHold = true;
  holdSection.classList.remove('locked');

  if (rows.length === 0) {
    combo = -1;
    b2b = false;
    current = null;
    spawn();
    return;
  }

  pendingRows = rows;
  pendingTspin = tspin;
  clearFlash = FLASH_MS;
  current = null;
}

function spawn() {
  current = queue.shift();
  queue.push(randomPiece());
  lastMoveWasRotation = false;
  if (peekLeft > 0) {
    peekLeft--;
    if (peekLeft === 0) updatePeekUI();
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function holdPiece() {
  if (!canHold || !current) return;
  const heldType = current.type;
  if (hold === null) {
    hold = pieceFromType(heldType);
    spawn();
  } else {
    const swapped = pieceFromType(hold.type);
    hold = pieceFromType(heldType);
    current = swapped;
    lastMoveWasRotation = false;
    if (collide(current.shape, current.x, current.y)) {
      endGame();
      return;
    }
  }
  canHold = false;
  holdSection.classList.add('locked');
  drawHold();
}

// ==================== Sistema de habilidades cargables ====================

function openAbilityMenu() {
  if (energy < ENERGY_MAX || !current || paused || gameOver || choosingAbility) return;
  choosingAbility = true;
  abilityMenu = 'main';
  cancelAnimationFrame(animId);
  ability4Option.classList.toggle('disabled', lastSnapshot === null);
  abilitySwapBox.classList.add('hidden');
  abilityMainBox.classList.remove('hidden');
  abilityOverlay.classList.remove('hidden');
}

function closeAbilityMenu() {
  abilityOverlay.classList.add('hidden');
  choosingAbility = false;
  abilityMenu = null;
  if (!gameOver) {
    lastTime = performance.now();
    loop(lastTime);
  }
}

function useAbility(n) {
  if (n === 1) {
    peekLeft = PEEK_PIECES;
    updatePeekUI();
    drawNext();
  } else if (n === 2) {
    abilityMenu = 'swap';
    swapIndex = 0;
    abilityMainBox.classList.add('hidden');
    abilitySwapBox.classList.remove('hidden');
    renderSwapSelection();
    return; // se gasta la energía al elegir la pieza, no al entrar al submenú
  } else if (n === 3) {
    slowTimer = SLOW_MS;
  } else if (n === 4) {
    if (lastSnapshot === null) return;
    undoLastPlacement();
  }
  energy = 0;
  updateEnergyUI();
  playAbilitySound();
  closeAbilityMenu();
}

function renderSwapSelection() {
  swapItems.forEach((item, i) => item.classList.toggle('selected', i === swapIndex));
}

function swapToPiece(type) {
  current = pieceFromType(type);
  lastMoveWasRotation = false;
  energy = 0;
  updateEnergyUI();
  const collided = collide(current.shape, current.x, current.y);
  closeAbilityMenu();
  if (collided) {
    endGame();
  } else {
    playAbilitySound();
  }
}

function undoLastPlacement() {
  const snap = lastSnapshot;
  board = snap.board.map(row => row.slice());
  score = snap.score;
  lines = snap.lines;
  level = snap.level;
  dropInterval = snap.dropInterval;
  combo = snap.combo;
  b2b = snap.b2b;
  energy = snap.energy;
  hold = snap.hold === null ? null : pieceFromType(snap.hold);
  canHold = snap.canHold;
  holdSection.classList.toggle('locked', !canHold);
  queue = snap.queue.map(t => pieceFromType(t));
  current = pieceFromType(snap.type);
  lastMoveWasRotation = false;
  lastSnapshot = null;
  updateHUD();
  drawHold();
  drawNext();
}

function handleAbilityKey(e) {
  if (e.code === 'Escape') { closeAbilityMenu(); return; }
  if (abilityMenu === 'main') {
    const map = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };
    const n = map[e.code];
    if (!n) return;
    if (n === 4 && lastSnapshot === null) return;
    useAbility(n);
  } else if (abilityMenu === 'swap') {
    const m = e.code.match(/^Digit([1-7])$/);
    if (m) { swapToPiece(Number(m[1])); return; }
    switch (e.code) {
      case 'ArrowLeft':
        e.preventDefault();
        swapIndex = (swapIndex + 6) % 7; // +6 ≡ -1 (mod 7), evita índices negativos
        renderSwapSelection();
        break;
      case 'ArrowRight':
        e.preventDefault();
        swapIndex = (swapIndex + 1) % 7;
        renderSwapSelection();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (swapIndex - 4 >= 0) { swapIndex -= 4; renderSwapSelection(); }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (swapIndex + 4 <= 6) { swapIndex += 4; renderSwapSelection(); }
        break;
      case 'Enter':
      case 'Space':
        e.preventDefault();
        swapToPiece(swapIndex + 1);
        break;
    }
  }
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const activeSkin = SKINS[skin] || SKINS.retro;
  const color = activeSkin.colors[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const w = size - 2;
  activeSkin.draw(context, px, py, w, color, alpha);
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function drawClearFlash() {
  if (!pendingRows || clearFlash <= 0) return;
  const intensity = clearFlash / FLASH_MS;
  const comboBoost = Math.min(1 + Math.max(combo, 0) * 0.15, 1.8);
  ctx.globalAlpha = Math.min(intensity * comboBoost, 1);
  ctx.fillStyle = '#ffffff';
  for (const r of pendingRows) {
    ctx.fillRect(0, r * BLOCK, COLS * BLOCK, BLOCK);
  }
  ctx.globalAlpha = 1;
}

function drawFloatMsgs() {
  if (!floatMsgs.length) return;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 20px system-ui, sans-serif';
  const baseY = ROWS * BLOCK / 2;
  floatMsgs.forEach((msg, i) => {
    const progress = 1 - msg.life / msg.total;
    const alpha = 1 - progress;
    const yOffset = -progress * 40 - i * 26;
    ctx.globalAlpha = Math.max(alpha, 0);
    ctx.fillStyle = msg.color || '#ffffff';
    ctx.fillText(msg.text, COLS * BLOCK / 2, baseY + yOffset);
  });
  ctx.globalAlpha = 1;
}

// Contador de la ralentización, dibujado en la esquina superior derecha del
// tablero. Se dibuja fuera del guard `if (current)` de draw() porque el
// efecto debe seguir visible durante la ventana de destello de línea, en la
// que `current` es null.
function drawSlowTimer() {
  if (slowTimer <= 0) return;
  const w = 74, h = 30, x = COLS * BLOCK - w - 6, y = 6;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();

  const seconds = (slowTimer / 1000).toFixed(1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillStyle = slowColor;
  ctx.fillText(`⏱ ${seconds}s`, x + w / 2, y + 12);

  const barX = x + 6, barY = y + h - 8, barW = w - 12, barH = 4;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = slowColor;
  ctx.fillRect(barX, barY, barW * (slowTimer / SLOW_MS), barH);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  drawClearFlash();

  if (current) {
    // ghost
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    // current piece
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }

  drawSlowTimer();
  drawFloatMsgs();
}

function drawPreview(context, piece, nb = 30, originX = 0, originY = 0, clear = true) {
  if (clear) context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  if (!piece) return;
  const shape = piece.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, originX + offX + c, originY + offY + r, shape[r][c], nb);
}

function drawNext() {
  drawPreview(nextCtx, queue[0]);
  if (peekLeft > 0) drawPeek();
}

function drawHold() {
  drawPreview(holdCtx, hold);
}

function drawPeek() {
  peekCtx.clearRect(0, 0, peekCanvas.width, peekCanvas.height);
  for (let i = 0; i < PEEK_PIECES; i++) drawPreview(peekCtx, queue[i], 15, 2, i * 4, false);
}

function drawSwapOptions() {
  swapCanvases.forEach(cv => {
    const type = Number(cv.dataset.type);
    drawPreview(cv.getContext('2d'), pieceFromType(type), 15);
  });
}

function updatePeekUI() {
  const active = peekLeft > 0;
  nextSection.classList.toggle('hidden', active);
  peekSection.classList.toggle('hidden', !active);
}

function updateEnergyUI() {
  energyFill.style.width = `${(energy / ENERGY_MAX) * 100}%`;
  energySection.classList.toggle('full', energy >= ENERGY_MAX);
}

// Relanza el destello que recorre la barra al llenarse. Se quita la clase, se
// fuerza un reflow y se vuelve a añadir para poder reiniciar la animación CSS
// aunque ya estuviera presente (p. ej. si se llena dos veces sin gastarla).
function triggerEnergyFullEffect() {
  energySection.classList.remove('just-filled');
  void energySection.offsetWidth;
  energySection.classList.add('just-filled');
}

// ==================== Records (tabla de puntuaciones) ====================

const RECORDS_KEY = 'records';
const MAX_RECORDS = 5;

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return { scores: [], bestCombo: 0, maxLines: 0 };
    const parsed = JSON.parse(raw);
    return {
      scores: Array.isArray(parsed.scores) ? parsed.scores : [],
      bestCombo: Number(parsed.bestCombo) || 0,
      maxLines: Number(parsed.maxLines) || 0,
    };
  } catch {
    return { scores: [], bestCombo: 0, maxLines: 0 };
  }
}

function saveRecords(data) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(data));
}

function qualifies(scoreValue) {
  if (!(scoreValue > 0)) return false;
  const data = loadRecords();
  if (data.scores.length < MAX_RECORDS) return true;
  const worst = data.scores[data.scores.length - 1];
  return scoreValue > worst.score;
}

function addRecord(name, scoreValue, linesValue, levelValue) {
  const data = loadRecords();
  const record = { name: (name || 'Jugador').slice(0, 12), score: scoreValue, lines: linesValue, level: levelValue };
  data.scores.push(record);
  data.scores.sort((a, b) => b.score - a.score);
  data.scores = data.scores.slice(0, MAX_RECORDS);
  data.bestCombo = Math.max(data.bestCombo, maxCombo);
  data.maxLines = Math.max(data.maxLines, linesValue);
  saveRecords(data);
  return data.scores.indexOf(record);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Pinta el top 5 (nombre + puntuación) dentro de `container`, resaltando la
// fila `highlightIndex` si se pasa. Se reutiliza tanto en el overlay de
// Game Over como en la pantalla de inicio.
function renderRecords(container, highlightIndex) {
  if (!container) return;
  const data = loadRecords();
  container.innerHTML = '';

  const list = document.createElement('ol');
  list.className = 'records-ol';
  if (data.scores.length === 0) {
    const li = document.createElement('li');
    li.className = 'records-empty';
    li.textContent = 'Sin puntuaciones todavía';
    list.appendChild(li);
  } else {
    data.scores.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'records-row' + (i === highlightIndex ? ' highlight' : '');
      li.innerHTML = `<span class="records-name">${escapeHtml(r.name)}</span><span class="records-score">${r.score.toLocaleString()}</span>`;
      list.appendChild(li);
    });
  }
  container.appendChild(list);

  const stats = document.createElement('p');
  stats.className = 'records-stats';
  stats.textContent = `Mejor combo: ${data.bestCombo} · Máx. líneas: ${data.maxLines}`;
  container.appendChild(stats);
}

function clearAllRecords() {
  if (!confirm('¿Borrar todos los records?')) return;
  localStorage.removeItem(RECORDS_KEY);
  renderRecords(recordsListGameOver, null);
  renderRecords(recordsListStart, null);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  playGameOverSound();

  clearRecordsBtn.classList.remove('hidden');

  if (qualifies(score)) {
    recordNameInput.value = 'Jugador';
    recordForm.classList.remove('hidden');
    recordsListGameOver.classList.add('hidden');
  } else {
    recordForm.classList.add('hidden');
    recordsListGameOver.classList.remove('hidden');
    renderRecords(recordsListGameOver, null);
  }
}

// ==================== Menú de pausa ====================

function renderPauseSelection() {
  if (pauseMenu === 'main') {
    pauseMainOptions.forEach((el, i) => el.classList.toggle('selected', i === pauseIndex));
  } else if (pauseMenu === 'controls') {
    pauseControlsBackEl.classList.add('selected');
  } else if (pauseMenu === 'level') {
    pauseLevelBackEl.classList.add('selected');
  }
}

function goPauseMain() {
  pauseMenu = 'main';
  pauseIndex = 0;
  pauseControlsBox.classList.add('hidden');
  pauseLevelBox.classList.add('hidden');
  pauseMainBox.classList.remove('hidden');
  renderPauseSelection();
}

function goPauseControls() {
  pauseMenu = 'controls';
  pauseIndex = 0;
  pauseMainBox.classList.add('hidden');
  pauseLevelBox.classList.add('hidden');
  pauseControlsBox.classList.remove('hidden');
  renderPauseSelection();
}

function goPauseLevel() {
  pauseMenu = 'level';
  pauseIndex = 0;
  pauseMainBox.classList.add('hidden');
  pauseControlsBox.classList.add('hidden');
  pauseLevelBox.classList.remove('hidden');
  pauseLevelNumEl.textContent = startLevel;
  renderPauseSelection();
}

function setStartLevel(value) {
  startLevel = Math.min(START_LEVEL_MAX, Math.max(START_LEVEL_MIN, value));
  pauseLevelNumEl.textContent = startLevel;
  localStorage.setItem('startLevel', String(startLevel));
}

function confirmPauseMain() {
  if (pauseIndex === 0) {
    togglePause();
  } else if (pauseIndex === 1) {
    pauseOverlay.classList.add('hidden');
    pauseMenu = null;
    init();
  } else if (pauseIndex === 2) {
    goPauseControls();
  } else if (pauseIndex === 3) {
    goPauseLevel();
  }
}

function openPauseMenu() {
  pauseMenu = 'main';
  pauseIndex = 0;
  cancelAnimationFrame(animId);
  pauseControlsBox.classList.add('hidden');
  pauseLevelBox.classList.add('hidden');
  pauseMainBox.classList.remove('hidden');
  renderPauseSelection();
  pauseOverlay.classList.remove('hidden');
}

function closePauseMenu() {
  pauseOverlay.classList.add('hidden');
  pauseMenu = null;
  lastTime = performance.now();
  loop(lastTime);
}

function handlePauseKey(e) {
  if (pauseMenu === 'main') {
    switch (e.code) {
      case 'ArrowUp':
        e.preventDefault();
        pauseIndex = (pauseIndex + pauseMainOptions.length - 1) % pauseMainOptions.length;
        renderPauseSelection();
        break;
      case 'ArrowDown':
        e.preventDefault();
        pauseIndex = (pauseIndex + 1) % pauseMainOptions.length;
        renderPauseSelection();
        break;
      case 'Enter':
      case 'Space':
        e.preventDefault();
        confirmPauseMain();
        break;
      case 'Escape':
        e.preventDefault();
        togglePause();
        break;
    }
  } else if (pauseMenu === 'controls') {
    if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      goPauseMain();
    }
  } else if (pauseMenu === 'level') {
    switch (e.code) {
      case 'ArrowLeft':
        e.preventDefault();
        setStartLevel(startLevel - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        setStartLevel(startLevel + 1);
        break;
      case 'Escape':
      case 'Enter':
      case 'Space':
        e.preventDefault();
        goPauseMain();
        break;
    }
  }
}

pauseResumeEl.addEventListener('click', () => { pauseIndex = 0; confirmPauseMain(); });
pauseRestartEl.addEventListener('click', () => { pauseIndex = 1; confirmPauseMain(); });
pauseViewControlsEl.addEventListener('click', () => { pauseIndex = 2; confirmPauseMain(); });
pauseViewLevelEl.addEventListener('click', () => { pauseIndex = 3; confirmPauseMain(); });
pauseControlsBackEl.addEventListener('click', goPauseMain);
pauseLevelBackEl.addEventListener('click', goPauseMain);
pauseLevelDecEl.addEventListener('click', () => setStartLevel(startLevel - 1));
pauseLevelIncEl.addEventListener('click', () => setStartLevel(startLevel + 1));

function togglePause() {
  if (gameOver || choosingAbility) return;
  paused = !paused;
  if (!paused) {
    closePauseMenu();
  } else {
    openPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;

  if (floatMsgs.length) {
    for (const msg of floatMsgs) msg.life -= dt;
    floatMsgs = floatMsgs.filter(m => m.life > 0);
  }

  if (slowTimer > 0) {
    slowTimer = Math.max(0, slowTimer - dt);
  }

  if (pendingRows) {
    clearFlash -= dt;
    if (clearFlash <= 0) {
      clearFlash = 0;
      finishClear();
    }
  } else if (current) {
    dropAccum += dt;
    const interval = slowTimer > 0 ? dropInterval * SLOW_FACTOR : dropInterval;
    if (dropAccum >= interval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
        lastMoveWasRotation = false;
      } else {
        lockPiece();
      }
    }
  }

  draw();
  if (gameOver || paused) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  hold = null;
  canHold = true;
  holdSection.classList.remove('locked');
  drawHold();
  combo = -1;
  b2b = false;
  lastMoveWasRotation = false;
  pendingRows = null;
  pendingTspin = 'none';
  clearFlash = 0;
  floatMsgs = [];
  energy = 0;
  choosingAbility = false;
  abilityMenu = null;
  slowTimer = 0;
  peekLeft = 0;
  lastSnapshot = null;
  swapIndex = 0;
  pauseMenu = null;
  pauseIndex = 0;
  maxCombo = 0;
  energySection.classList.remove('just-filled');
  updateEnergyUI();
  updatePeekUI();
  abilityOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  queue = [];
  while (queue.length < QUEUE_SIZE) queue.push(randomPiece());
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (choosingAbility) { handleAbilityKey(e); return; }
  if (paused) { handlePauseKey(e); return; }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'Escape' && !gameOver) { togglePause(); return; }
  if (e.code === 'KeyM') { setMuted(!muted); return; }
  ensureAudio();
  if (paused || gameOver || !current) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) {
        current.x--;
        lastMoveWasRotation = false;
      }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) {
        current.x++;
        lastMoveWasRotation = false;
      }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
    case 'KeyE':
      openAbilityMenu();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

recordForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = (recordNameInput.value || '').trim() || 'Jugador';
  const idx = addRecord(name, score, lines, level);
  recordForm.classList.add('hidden');
  recordsListGameOver.classList.remove('hidden');
  renderRecords(recordsListGameOver, idx);
});

clearRecordsBtn.addEventListener('click', clearAllRecords);
startClearRecordsBtn.addEventListener('click', clearAllRecords);

setMuted(localStorage.getItem('muted') === '1');
drawSwapOptions();

renderRecords(recordsListStart, null);
startOverlay.classList.remove('hidden');

playBtn.addEventListener('click', () => {
  ensureAudio();
  startOverlay.classList.add('hidden');
  init();
}, { once: true });
