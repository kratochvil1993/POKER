(function (root) {
  const Poker = (root.Poker = root.Poker || {});
  const { sanitizeName } = Poker.Dom;

  const STORAGE_KEY = 'poker.v1';
  const PERSONALITY_KEYS = ['tight-passive', 'loose-aggressive', 'bluffer', 'calculator'];

  const DEFAULT_STATE = () => ({
    name: '',
    botCount: 3,
    settings: { speed: 'normal', autoNext: false },
    stats: { hands: 0, wins: 0, bestHandName: '', bestHandScore: 0, biggestWin: 0, rebuys: 0, games: 0 },
    savedGame: null,
  });

  function readRaw() {
    try {
      const text = root.localStorage.getItem(STORAGE_KEY);
      return text ? JSON.parse(text) : null;
    } catch (error) {
      return null;
    }
  }

  function writeRaw(data) {
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      return false;
    }
  }

  function toInt(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function validateSavedGame(saved) {
    if (!saved || !Array.isArray(saved.players) || saved.players.length < 2 || saved.players.length > 6) return null;
    const ids = new Set();
    const players = [];
    for (const [index, p] of saved.players.entries()) {
      if (!p || typeof p.id !== 'string' || ids.has(p.id)) return null;
      ids.add(p.id);
      const isBot = index !== 0;
      if (isBot && !PERSONALITY_KEYS.includes(p.personality)) return null;
      players.push({
        id: p.id,
        name: sanitizeName(p.name),
        isBot,
        personality: isBot ? p.personality : undefined,
        stack: toInt(p.stack, 0, 0, 1e9),
      });
    }
    return {
      players,
      handNumber: toInt(saved.handNumber, 0, 0, 1e6),
      dealerIdx: toInt(saved.dealerIdx, -1, -1, players.length - 1),
    };
  }

  function load() {
    const defaults = DEFAULT_STATE();
    const raw = readRaw() || {};
    const stats = { ...defaults.stats, ...(raw.stats || {}) };
    for (const key of ['hands', 'wins', 'bestHandScore', 'biggestWin', 'rebuys', 'games']) {
      stats[key] = toInt(stats[key], 0, 0, 1e12);
    }
    stats.bestHandName = typeof stats.bestHandName === 'string' ? stats.bestHandName.slice(0, 80) : '';
    const settings = { ...defaults.settings, ...(raw.settings || {}) };
    settings.speed = settings.speed === 'fast' ? 'fast' : 'normal';
    settings.autoNext = settings.autoNext === true;
    return {
      name: raw.name ? sanitizeName(raw.name) : '',
      botCount: toInt(raw.botCount, defaults.botCount, 1, 5),
      settings,
      stats,
      savedGame: validateSavedGame(raw.savedGame),
    };
  }

  function update(patch) {
    const current = load();
    const next = { ...current, ...patch };
    writeRaw(next);
    return next;
  }

  function clearAll() {
    try {
      root.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      return;
    }
  }

  Poker.Storage = { load, update, clearAll, validateSavedGame };
})(typeof globalThis !== 'undefined' ? globalThis : this);
