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

const LINE_SCORES = [0, 100, 300, 500, 800];

// --- Modo combo y multiplicadores ---
const COMBO_MAX_MULTIPLIER = 4;                // x2, x3, x4 y tope
const TSPIN_SCORES = [400, 800, 1200, 1600];   // 0,1,2,3 líneas con T-spin
const MINI_TSPIN_SCORES = [100, 200, 400];     // 0,1,2 líneas con Mini T-spin
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000];
const B2B_MULTIPLIER = 1.5;
const FLASH_MS = 180;
const FLOAT_MS = 900;

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

let board, current, next, hold, canHold, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor, blockHighlight;
let combo, b2b, lastMoveWasRotation, pendingRows, pendingTspin, clearFlash, floatMsgs, muted;
let comboColor, tspinColor;

function updateThemeColors() {
  const styles = getComputedStyle(document.body);
  gridColor = styles.getPropertyValue('--grid-line').trim();
  blockHighlight = styles.getPropertyValue('--block-highlight').trim();
  comboColor = styles.getPropertyValue('--combo-text').trim();
  tspinColor = styles.getPropertyValue('--tspin-text').trim();
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

function pushFloatMsg(text, color) {
  floatMsgs.push({ text, color, life: FLOAT_MS, total: FLOAT_MS });
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

  lines += n;
  score += Math.round(total * level);
  level = Math.floor(lines / 10) + 1;
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
  current = next;
  next = randomPiece();
  lastMoveWasRotation = false;
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

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = blockHighlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
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

  drawFloatMsgs();
}

function drawPreview(context, canvasEl, piece) {
  const NB = 30;
  context.clearRect(0, 0, canvasEl.width, canvasEl.height);
  if (!piece) return;
  const shape = piece.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB);
}

function drawNext() {
  drawPreview(nextCtx, nextCanvas, next);
}

function drawHold() {
  drawPreview(holdCtx, holdCanvas, hold);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  playGameOverSound();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;

  if (floatMsgs.length) {
    for (const msg of floatMsgs) msg.life -= dt;
    floatMsgs = floatMsgs.filter(m => m.life > 0);
  }

  if (pendingRows) {
    clearFlash -= dt;
    if (clearFlash <= 0) {
      clearFlash = 0;
      finishClear();
    }
  } else if (current) {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
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
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
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
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
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
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

setMuted(localStorage.getItem('muted') === '1');
init();
