(function () {
  const STORAGE_PREFIX = 'snake_game_progress';

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

  function readProgress(mobileNumber) {
    const key = buildProgressKey(mobileNumber);
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        level: Number(parsed.level) || 1,
        score: Number(parsed.score) || 0,
        lives: Number(parsed.lives) || 5,
      };
    } catch (error) {
      return null;
    }
  }

  function saveProgress(mobileNumber, progress) {
    const normalized = normalizeMobileNumber(mobileNumber);
    if (!normalized) return false;

    const payload = {
      level: Number(progress.level) || 1,
      score: Number(progress.score) || 0,
      lives: Number(progress.lives) || 5,
    };

    localStorage.setItem(buildProgressKey(normalized), JSON.stringify(payload));
    localStorage.setItem('snake_last_mobile_number', normalized);
    return true;
  }

  function clearProgress(mobileNumber) {
    const normalized = normalizeMobileNumber(mobileNumber);
    if (!normalized) return;
    localStorage.removeItem(buildProgressKey(normalized));
  }

  const api = {
    normalizeMobileNumber,
    buildProgressKey,
    readProgress,
    saveProgress,
    clearProgress,
  };

  if (typeof window !== 'undefined') {
    window.progressStorage = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
