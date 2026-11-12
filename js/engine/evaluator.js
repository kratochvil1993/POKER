(function (root) {
  const Poker = (root.Poker = root.Poker || {});

  const CATEGORY = {
    HIGH_CARD: 0,
    PAIR: 1,
    TWO_PAIR: 2,
    TRIPS: 3,
    STRAIGHT: 4,
    FLUSH: 5,
    FULL_HOUSE: 6,
    QUADS: 7,
    STRAIGHT_FLUSH: 8,
  };

  const NOMINATIVE_SINGULAR = { 2: 'dvojka', 3: 'trojka', 4: 'čtyřka', 5: 'pětka', 6: 'šestka', 7: 'sedmička', 8: 'osmička', 9: 'devítka', 10: 'desítka', 11: 'kluk', 12: 'dáma', 13: 'král', 14: 'eso' };
  const NOMINATIVE_PLURAL = { 2: 'dvojky', 3: 'trojky', 4: 'čtyřky', 5: 'pětky', 6: 'šestky', 7: 'sedmičky', 8: 'osmičky', 9: 'devítky', 10: 'desítky', 11: 'kluci', 12: 'dámy', 13: 'králové', 14: 'esa' };
  const GENITIVE_PLURAL = { 2: 'dvojek', 3: 'trojek', 4: 'čtyřek', 5: 'pětek', 6: 'šestek', 7: 'sedmiček', 8: 'osmiček', 9: 'devítek', 10: 'desítek', 11: 'kluků', 12: 'dam', 13: 'králů', 14: 'es' };
  const GENITIVE_SINGULAR = { 2: 'dvojky', 3: 'trojky', 4: 'čtyřky', 5: 'pětky', 6: 'šestky', 7: 'sedmičky', 8: 'osmičky', 9: 'devítky', 10: 'desítky', 11: 'kluka', 12: 'dámy', 13: 'krále', 14: 'esa' };
  const LOCATIVE_PLURAL = { 2: 'dvojkách', 3: 'trojkách', 4: 'čtyřkách', 5: 'pětkách', 6: 'šestkách', 7: 'sedmičkách', 8: 'osmičkách', 9: 'devítkách', 10: 'desítkách', 11: 'klucích', 12: 'damách', 13: 'králích', 14: 'esech' };

  function straightHigh(mask) {
    if (mask & (1 << 14)) mask |= 1 << 1;
    for (let high = 14; high >= 5; high--) {
      if (((mask >> (high - 4)) & 31) === 31) return high;
    }
    return 0;
  }

  function packScore(category, ranks) {
    let score = category;
    for (let i = 0; i < 5; i++) score = score * 16 + (ranks[i] || 0);
    return score;
  }

  function buildResult(category, ranks) {
    return { category, ranks, score: packScore(category, ranks) };
  }

  function evaluate(cards) {
    const rankCounts = new Array(15).fill(0);
    const suitCounts = [0, 0, 0, 0];
    const suitMasks = [0, 0, 0, 0];
    let rankMask = 0;
    for (const card of cards) {
      rankCounts[card.rank]++;
      suitCounts[card.suit]++;
      suitMasks[card.suit] |= 1 << card.rank;
      rankMask |= 1 << card.rank;
    }

    let flushSuit = -1;
    for (let suit = 0; suit < 4; suit++) if (suitCounts[suit] >= 5) flushSuit = suit;

    if (flushSuit >= 0) {
      const high = straightHigh(suitMasks[flushSuit]);
      if (high) return buildResult(CATEGORY.STRAIGHT_FLUSH, [high]);
    }

    const quads = [];
    const trips = [];
    const pairs = [];
    for (let rank = 14; rank >= 2; rank--) {
      if (rankCounts[rank] === 4) quads.push(rank);
      else if (rankCounts[rank] === 3) trips.push(rank);
      else if (rankCounts[rank] === 2) pairs.push(rank);
    }

    function topKickers(excluded, count) {
      const kickers = [];
      for (let rank = 14; rank >= 2 && kickers.length < count; rank--) {
        if (rankCounts[rank] > 0 && !excluded.includes(rank)) kickers.push(rank);
      }
      return kickers;
    }

    if (quads.length) {
      return buildResult(CATEGORY.QUADS, [quads[0], ...topKickers([quads[0]], 1)]);
    }

    if (trips.length && (trips.length > 1 || pairs.length)) {
      const pairRank = trips.length > 1 ? Math.max(trips[1], pairs[0] || 0) : pairs[0];
      return buildResult(CATEGORY.FULL_HOUSE, [trips[0], pairRank]);
    }

    if (flushSuit >= 0) {
      const ranks = [];
      for (let rank = 14; rank >= 2 && ranks.length < 5; rank--) {
        if (suitMasks[flushSuit] & (1 << rank)) ranks.push(rank);
      }
      return buildResult(CATEGORY.FLUSH, ranks);
    }

    const high = straightHigh(rankMask);
    if (high) return buildResult(CATEGORY.STRAIGHT, [high]);

    if (trips.length) {
      return buildResult(CATEGORY.TRIPS, [trips[0], ...topKickers([trips[0]], 2)]);
    }
    if (pairs.length >= 2) {
      return buildResult(CATEGORY.TWO_PAIR, [pairs[0], pairs[1], ...topKickers([pairs[0], pairs[1]], 1)]);
    }
    if (pairs.length === 1) {
      return buildResult(CATEGORY.PAIR, [pairs[0], ...topKickers([pairs[0]], 3)]);
    }
    return buildResult(CATEGORY.HIGH_CARD, topKickers([], 5));
  }

  function combinations(items, size) {
    const result = [];
    const current = [];
    (function pick(start) {
      if (current.length === size) {
        result.push(current.slice());
        return;
      }
      for (let i = start; i < items.length; i++) {
        current.push(items[i]);
        pick(i + 1);
        current.pop();
      }
    })(0);
    return result;
  }

  function bestFive(cards) {
    if (cards.length <= 5) return cards.slice();
    let best = null;
    let bestScore = -1;
    for (const combo of combinations(cards, 5)) {
      const { score } = evaluate(combo);
      if (score > bestScore) {
        bestScore = score;
        best = combo;
      }
    }
    return best;
  }

  function handName(result) {
    const r = result.ranks;
    switch (result.category) {
      case CATEGORY.HIGH_CARD:
        return 'Vysoká karta – ' + NOMINATIVE_SINGULAR[r[0]];
      case CATEGORY.PAIR:
        return 'Pár ' + GENITIVE_PLURAL[r[0]];
      case CATEGORY.TWO_PAIR:
        return 'Dva páry (' + NOMINATIVE_PLURAL[r[0]] + ' a ' + NOMINATIVE_PLURAL[r[1]] + ')';
      case CATEGORY.TRIPS:
        return 'Trojice ' + GENITIVE_PLURAL[r[0]];
      case CATEGORY.STRAIGHT:
        return 'Postupka do ' + GENITIVE_SINGULAR[r[0]];
      case CATEGORY.FLUSH:
        return 'Barva do ' + GENITIVE_SINGULAR[r[0]];
      case CATEGORY.FULL_HOUSE:
        return 'Full house (' + NOMINATIVE_PLURAL[r[0]] + ' na ' + LOCATIVE_PLURAL[r[1]] + ')';
      case CATEGORY.QUADS:
        return 'Poker (čtyři ' + NOMINATIVE_PLURAL[r[0]] + ')';
      case CATEGORY.STRAIGHT_FLUSH:
        return r[0] === 14 ? 'Královská postupka' : 'Postupka v barvě do ' + GENITIVE_SINGULAR[r[0]];
      default:
        return '';
    }
  }

  function evaluateWithName(cards) {
    const result = evaluate(cards);
    result.name = handName(result);
    return result;
  }

  const CATEGORY_LABELS = ['Vysoká karta', 'Pár', 'Dva páry', 'Trojice', 'Postupka', 'Barva', 'Full house', 'Poker', 'Postupka v barvě'];

  function categoryLabel(result) {
    return result.category === CATEGORY.STRAIGHT_FLUSH && result.ranks[0] === 14 ? 'Královská postupka' : CATEGORY_LABELS[result.category];
  }

  Poker.Evaluator = { CATEGORY, CATEGORY_LABELS, categoryLabel, evaluate, evaluateWithName, bestFive, handName, straightHigh };
})(typeof globalThis !== 'undefined' ? globalThis : this);
