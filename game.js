const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusText = document.getElementById('statusText');
const levelLabel = document.getElementById('levelLabel');
const targetLabel = document.getElementById('targetLabel');
const livesLabel = document.getElementById('livesLabel');
const mobileInput = document.getElementById('mobileInput');
const saveProgressBtn = document.getElementById('saveProgressBtn');

const GRID = 30;
const CELL = canvas.width / GRID;
const MAX_LIVES = 5;
const STORAGE_PREFIX = 'snake_game_progress';
const LAST_MOBILE_KEY = 'snake_last_mobile_number';

const joystickArea = document.getElementById('joystickArea');
const joystickKnob = document.getElementById('joystickKnob');

const state = {
  level: 1,
  lives: MAX_LIVES,
  score: 0,
  target: 1,
  eatenInLevel: 0,
  direction: { x: 1, y: 0 },
  nextDirection: { x: 1, y: 0 },
  snake: [],
  food: { x: 0, y: 0 },
  poisonCells: new Set(),
  enemies: [],
  moveTimer: null,
  isGameOver: false,
  isLevelTransition: false,
  isHard: false,
  joystickActive: false,
  joystickVector: { x: 0, y: 0 },
  lastTimestamp: 0,
};

function normalizeMobileNumber(value) {
  const raw = String(value ?? '').replace(/\D/g, '');
  if (!raw) return '';
  if (raw.length > 10 && raw.startsWith('91')) {
    return raw.slice(2);
  }
  return raw.slice(-10);
}

function buildProgressKey(mobileNumber) {
  const normalized = normalizeMobileNumber(mobileNumber);
  return `${STORAGE_PREFIX}:${normalized}`;
}

function getCurrentMobileNumber() {
  return normalizeMobileNumber(mobileInput.value || localStorage.getItem(LAST_MOBILE_KEY));
}

function loadSavedProgress() {
  const mobileNumber = getCurrentMobileNumber();
  if (!mobileNumber) return null;

  const saved = localStorage.getItem(buildProgressKey(mobileNumber));
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      level: Number(parsed.level) || 1,
      score: Number(parsed.score) || 0,
      lives: Number(parsed.lives) || MAX_LIVES,
    };
  } catch (error) {
    return null;
  }
}

function restoreProgressFromMobileNumber() {
  const mobileNumber = getCurrentMobileNumber();
  if (!mobileNumber) return false;

  const saved = localStorage.getItem(buildProgressKey(mobileNumber));
  if (!saved) return false;

  try {
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return false;

    state.level = Number(parsed.level) || 1;
    state.score = Number(parsed.score) || 0;
    state.lives = Math.min(Number(parsed.lives) || MAX_LIVES, MAX_LIVES);
    localStorage.setItem(LAST_MOBILE_KEY, mobileNumber);
    return true;
  } catch (error) {
    return false;
  }
}

function saveCurrentProgress() {
  const mobileNumber = getCurrentMobileNumber();
  if (!mobileNumber) {
    setStatus('Enter mobile number to save progress');
    return;
  }

  const payload = {
    level: state.level,
    score: state.score,
    lives: state.lives,
  };

  localStorage.setItem(buildProgressKey(mobileNumber), JSON.stringify(payload));
  localStorage.setItem(LAST_MOBILE_KEY, mobileNumber);
  setStatus('Progress saved');
}

function getTargetForLevel(level) {
  return Math.pow(2, level - 1);
}

function isHardLevel(level) {
  return level % 5 === 0;
}

function buildPoisonCells() {
  const cells = new Set();
  for (let x = 0; x < GRID; x++) {
    cells.add(`${x},0`);
    cells.add(`${x},${GRID - 1}`);
  }
  for (let y = 0; y < GRID; y++) {
    cells.add(`0,${y}`);
    cells.add(`${GRID - 1},${y}`);
  }
  return cells;
}

function getSpeedForLevel(level) {
  if (isHardLevel(level)) {
    return Math.max(70, 180 - level * 10);
  }
  return Math.max(100, 190 - level * 8);
}

function setStatus(text) {
  statusText.textContent = text;
}

function updateHud() {
  levelLabel.textContent = state.level;
  targetLabel.textContent = state.target;
  livesLabel.textContent = '♥'.repeat(state.lives).padEnd(MAX_LIVES, '♡');
}

function toKey(x, y) {
  return `${x},${y}`;
}

function createEnemy() {
  const enemy = {
    body: [],
    direction: { x: 1, y: 0 },
    color: '#fbbf24',
  };

  while (true) {
    const x = Math.floor(Math.random() * (GRID - 4)) + 2;
    const y = Math.floor(Math.random() * (GRID - 4)) + 2;
    const start = { x, y };
    if (state.poisonCells.has(toKey(start.x, start.y))) {
      continue;
    }
    if (state.snake.some((seg) => seg.x === start.x && seg.y === start.y)) {
      continue;
    }
    enemy.body = [
      { x, y },
      { x: x - 1, y },
      { x: x - 2, y },
    ];
    enemy.direction = { x: 1, y: 0 };
    return enemy;
  }
}

function resetLevel() {
  state.target = getTargetForLevel(state.level);
  state.eatenInLevel = 0;
  state.isHard = isHardLevel(state.level);
  state.poisonCells = buildPoisonCells();
  state.direction = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };

  const centerX = Math.floor(GRID / 2);
  const centerY = Math.floor(GRID / 2);
  state.snake = [
    { x: centerX, y: centerY },
    { x: centerX - 1, y: centerY },
    { x: centerX - 2, y: centerY },
  ];

  state.enemies = [];
  if (state.isHard) {
    state.enemies.push(createEnemy(), createEnemy());
  }

  state.food = findFood();
  updateHud();
  setStatus(state.isHard ? 'HARD LEVEL' : 'Normal level');
  draw();

  clearInterval(state.moveTimer);
  state.moveTimer = setInterval(gameTick, getSpeedForLevel(state.level));
}

function findFood() {
  while (true) {
    const x = Math.floor(Math.random() * (GRID - 2)) + 1;
    const y = Math.floor(Math.random() * (GRID - 2)) + 1;
    const pos = { x, y };

    if (state.poisonCells.has(toKey(x, y))) {
      continue;
    }
    if (state.snake.some((seg) => seg.x === x && seg.y === y)) {
      continue;
    }
    if (state.enemies.some((enemy) => enemy.body.some((seg) => seg.x === x && seg.y === y))) {
      continue;
    }
    return pos;
  }
}

function setDirection(dir) {
  if (!dir) return;
  if (dir.x === -state.direction.x && dir.y === -state.direction.y) return;
  state.nextDirection = dir;
}

function setDirectionFromVector(x, y) {
  const absX = Math.abs(x);
  const absY = Math.abs(y);

  if (absX > absY) {
    setDirection({ x: x > 0 ? 1 : -1, y: 0 });
  } else if (absY > 0) {
    setDirection({ x: 0, y: y > 0 ? 1 : -1 });
  }
}

function handleKey(event) {
  const key = event.key.toLowerCase();
  const dirs = {
    arrowup: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
    d: { x: 1, y: 0 },
  };

  if (dirs[key]) {
    setDirection(dirs[key]);
  }
}

function advanceEnemy(enemy) {
  if (!enemy.body.length) return;

  const head = enemy.body[0];
  const candidates = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  let best = null;
  let bestScore = Infinity;

  for (const dir of candidates) {
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;

    if (nx <= 0 || ny <= 0 || nx >= GRID - 1 || ny >= GRID - 1) continue;
    if (state.poisonCells.has(toKey(nx, ny))) continue;
    if (enemy.body.some((seg) => seg.x === nx && seg.y === ny)) continue;
    if (state.snake.some((seg) => seg.x === nx && seg.y === ny)) continue;

    const score = Math.abs(nx - state.food.x) + Math.abs(ny - state.food.y);
    if (score < bestScore) {
      bestScore = score;
      best = dir;
    }
  }

  if (!best) return;

  enemy.direction = best;
  const newHead = { x: head.x + best.x, y: head.y + best.y };
  enemy.body.unshift(newHead);

  if (newHead.x === state.food.x && newHead.y === state.food.y) {
    state.food = findFood();
  } else {
    enemy.body.pop();
  }

  if (state.snake.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
    handleDeath();
  }
}

function gameTick() {
  if (state.isGameOver || state.isLevelTransition) return;

  state.direction = { ...state.nextDirection };
  const head = state.snake[0];
  const newHead = { x: head.x + state.direction.x, y: head.y + state.direction.y };

  if (
    newHead.x <= 0 || newHead.y <= 0 || newHead.x >= GRID - 1 || newHead.y >= GRID - 1 ||
    state.poisonCells.has(toKey(newHead.x, newHead.y)) ||
    state.snake.some((seg, index) => index < state.snake.length - 1 && seg.x === newHead.x && seg.y === newHead.y)
  ) {
    handleDeath();
    return;
  }

  state.snake.unshift(newHead);

  if (newHead.x === state.food.x && newHead.y === state.food.y) {
    state.eatenInLevel += 1;
    state.score += 1;
    state.food = findFood();

    if (state.eatenInLevel >= state.target) {
      moveToNextLevel();
      return;
    }
  } else {
    state.snake.pop();
  }

  if (state.isHard) {
    for (const enemy of state.enemies) {
      advanceEnemy(enemy);
      if (state.snake.some((seg) => seg.x === enemy.body[0].x && seg.y === enemy.body[0].y)) {
        handleDeath();
        return;
      }
    }
  }

  draw();
  updateHud();
}

function moveToNextLevel() {
  state.isLevelTransition = true;
  state.level += 1;
  state.lives = MAX_LIVES;
  saveCurrentProgress();
  setStatus('Level cleared!');
  draw();
  setTimeout(() => {
    state.isLevelTransition = false;
    resetLevel();
  }, 700);
}

function handleDeath() {
  state.lives -= 1;
  setStatus('SNAKE TERMINATED');
  draw();

  if (state.lives <= 0) {
    state.isGameOver = true;
    clearInterval(state.moveTimer);
    setStatus('Game over! Restart game?');
    showRestartDialog();
    return;
  }

  state.lives = MAX_LIVES;
  setTimeout(() => {
    resetLevel();
  }, 700);
}

function showRestartDialog() {
  const ok = window.confirm('All 5 lives are used. Restart the game?');
  if (ok) {
    state.isGameOver = false;
    state.level = 1;
    state.score = 0;
    state.lives = MAX_LIVES;
    saveCurrentProgress();
    resetLevel();
  }
}

function saveProgressOnLevelChange() {
  const mobileNumber = normalizeMobileNumber(mobileInput.value || localStorage.getItem('snake_last_mobile_number'));
  if (!mobileNumber) return;

  localStorage.setItem(buildProgressKey(mobileNumber), JSON.stringify({
    level: state.level,
    score: state.score,
    lives: state.lives,
  }));
}

function drawCell(x, y, color, stroke = '#111827') {
  ctx.fillStyle = color;
  ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  ctx.strokeStyle = stroke;
  ctx.strokeRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#020817';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < GRID; x++) {
    for (let y = 0; y < GRID; y++) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      ctx.strokeStyle = '#111827';
      ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  state.poisonCells.forEach((key) => {
    const [x, y] = key.split(',').map(Number);
    drawCell(x, y, '#7c3aed', '#4c1d95');
  });

  drawCell(state.food.x, state.food.y, '#f43f5e', '#be123c');

  state.snake.forEach((segment, index) => {
    drawCell(segment.x, segment.y, index === 0 ? '#22c55e' : '#4ade80', '#166534');
  });

  if (state.isHard) {
    for (const enemy of state.enemies) {
      enemy.body.forEach((segment, index) => {
        drawCell(segment.x, segment.y, index === 0 ? '#f59e0b' : '#fbbf24', '#d97706');
      });
    }
  }

  if (state.isHard) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('HARD LEVEL', canvas.width / 2, 24);
  }
}

function draw() {
  drawBoard();
  updateHud();
}

document.addEventListener('keydown', handleKey);

for (const button of document.querySelectorAll('.control-btn')) {
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const dirMap = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    setDirection(dirMap[button.dataset.dir]);
  });
}

function updateJoystickDisplay(x, y) {
  const maxDist = 32;
  const length = Math.min(Math.hypot(x, y), maxDist);
  const angle = Math.atan2(y, x);
  const px = Math.cos(angle) * length;
  const py = Math.sin(angle) * length;
  joystickKnob.style.transform = `translate(${px}px, ${py}px)`;
  if (length > 0) {
    setDirectionFromVector(x, y);
    state.joystickVector = { x, y };
  }
}

joystickArea.addEventListener('pointerdown', (event) => {
  state.joystickActive = true;
  joystickArea.setPointerCapture(event.pointerId);
  const rect = joystickArea.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  updateJoystickDisplay(dx / 2, dy / 2);
});

joystickArea.addEventListener('pointermove', (event) => {
  if (!state.joystickActive) return;
  const rect = joystickArea.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  updateJoystickDisplay(dx / 2, dy / 2);
});

joystickArea.addEventListener('pointerup', () => {
  state.joystickActive = false;
  joystickKnob.style.transform = 'translate(-50%, -50%)';
  state.joystickVector = { x: 0, y: 0 };
});

joystickArea.addEventListener('pointerleave', () => {
  state.joystickActive = false;
  joystickKnob.style.transform = 'translate(-50%, -50%)';
});

if (mobileInput) {
  const savedMobile = localStorage.getItem(LAST_MOBILE_KEY);
  if (savedMobile) {
    mobileInput.value = normalizeMobileNumber(savedMobile);
  }

  const restored = restoreProgressFromMobileNumber();
  if (restored) {
    setStatus('Saved level loaded');
  }

  mobileInput.addEventListener('input', () => {
    mobileInput.value = normalizeMobileNumber(mobileInput.value);
    const restoredProgress = restoreProgressFromMobileNumber();
    if (restoredProgress) {
      setStatus('Saved level loaded');
      resetLevel();
    }
  });

  saveProgressBtn.addEventListener('click', () => {
    saveCurrentProgress();
  });
}

resetLevel();
