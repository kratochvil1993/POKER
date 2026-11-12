(function (root) {
  const Poker = (root.Poker = root.Poker || {});
  const { createDeck } = Poker.Deck;
  const { evaluate } = Poker.Evaluator;

  const PERSONALITIES = {
    'tight-passive': {
      key: 'tight-passive',
      label: 'Opatrný',
      names: ['Karel', 'Jarmila', 'Bohouš'],
      playRange: 0.2,
      raiseRange: 0.06,
      pushRange: 0.12,
      aggression: 0.2,
      bluff: 0.02,
      margin: 0.07,
      respect: 1.4,
    },
    'loose-aggressive': {
      key: 'loose-aggressive',
      label: 'Divoch',
      names: ['Venca', 'Dáša', 'Ferda'],
      playRange: 0.5,
      raiseRange: 0.28,
      pushRange: 0.4,
      aggression: 0.75,
      bluff: 0.12,
      margin: -0.05,
      respect: 0.5,
    },
    bluffer: {
      key: 'bluffer',
      label: 'Blafér',
      names: ['Božena', 'Pepa', 'Lojza'],
      playRange: 0.35,
      raiseRange: 0.15,
      pushRange: 0.25,
      aggression: 0.55,
      bluff: 0.3,
      margin: 0.0,
      respect: 0.4,
    },
    calculator: {
      key: 'calculator',
      label: 'Kalkulátor',
      names: ['Ota', 'Marie', 'Standa'],
      playRange: 0.27,
      raiseRange: 0.1,
      pushRange: 0.2,
      aggression: 0.4,
      bluff: 0.04,
      margin: 0.02,
      respect: 1.0,
    },
  };

  const PERSONALITY_ORDER = ['tight-passive', 'loose-aggressive', 'bluffer', 'calculator'];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function chenScore(highRank, lowRank, suited) {
    const base = highRank === 14 ? 10 : highRank === 13 ? 8 : highRank === 12 ? 7 : highRank === 11 ? 6 : highRank / 2;
    if (highRank === lowRank) return Math.max(5, base * 2);
    let score = base;
    if (suited) score += 2;
    const gap = highRank - lowRank - 1;
    if (gap === 1) score -= 1;
    else if (gap === 2) score -= 2;
    else if (gap === 3) score -= 4;
    else if (gap >= 4) score -= 5;
    if (gap <= 1 && highRank < 12) score += 1;
    return Math.ceil(score);
  }

  function handClassKey(highRank, lowRank, suited) {
    return highRank * 100 + lowRank * 2 + (suited ? 1 : 0);
  }

  const PREFLOP_PERCENTILES = (function buildTable() {
    const classes = [];
    for (let high = 2; high <= 14; high++) {
      for (let low = 2; low <= high; low++) {
        if (high === low) {
          classes.push({ high, low, suited: false, combos: 6 });
        } else {
          classes.push({ high, low, suited: true, combos: 4 });
          classes.push({ high, low, suited: false, combos: 12 });
        }
      }
    }
    for (const c of classes) c.score = chenScore(c.high, c.low, c.suited);
    classes.sort((a, b) => b.score - a.score || b.high - a.high || b.low - a.low || Number(b.suited) - Number(a.suited));
    const table = {};
    let seen = 0;
    for (const c of classes) {
      table[handClassKey(c.high, c.low, c.suited)] = (seen + c.combos / 2) / 1326;
      seen += c.combos;
    }
    return table;
  })();

  function preflopPercentile(hole) {
    const high = Math.max(hole[0].rank, hole[1].rank);
    const low = Math.min(hole[0].rank, hole[1].rank);
    const suited = hole[0].suit === hole[1].suit && high !== low;
    return PREFLOP_PERCENTILES[handClassKey(high, low, suited)];
  }

  function preflopEquity(percentile, opponents) {
    const headsUp = 0.34 + 0.5 * Math.pow(1 - percentile, 1.8);
    return Math.pow(headsUp, 1 + 0.55 * (Math.max(1, opponents) - 1));
  }

  function estimateEquity(hole, board, opponents, iterations = 300, rng = Math.random) {
    const known = new Set([...hole, ...board].map((c) => c.rank * 4 + c.suit));
    const remaining = createDeck().filter((c) => !known.has(c.rank * 4 + c.suit));
    const boardNeeded = 5 - board.length;
    const needed = boardNeeded + 2 * opponents;
    let share = 0;
    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < needed; j++) {
        const pick = j + Math.floor(rng() * (remaining.length - j));
        const swap = remaining[j];
        remaining[j] = remaining[pick];
        remaining[pick] = swap;
      }
      const fullBoard = board.concat(remaining.slice(0, boardNeeded));
      const mine = evaluate(hole.concat(fullBoard)).score;
      let beaten = true;
      let tiedWith = 0;
      for (let o = 0; o < opponents && beaten; o++) {
        const start = boardNeeded + 2 * o;
        const theirs = evaluate([remaining[start], remaining[start + 1]].concat(fullBoard)).score;
        if (theirs > mine) beaten = false;
        else if (theirs === mine) tiedWith++;
      }
      if (beaten) share += 1 / (tiedWith + 1);
    }
    return share / iterations;
  }

  function roundChips(value, unit) {
    return Math.max(unit, Math.round(value / unit) * unit);
  }

  function raiseAction(view, target) {
    const legal = view.legal;
    if (!legal.canRaise) return null;
    let raiseTo = clamp(roundChips(target, view.smallBlind), legal.minRaiseTo, legal.maxRaiseTo);
    const committed = raiseTo - view.myBet;
    if (raiseTo >= legal.maxRaiseTo || committed >= 0.7 * view.myStack) {
      return legal.canAllIn ? { type: 'allin' } : { type: 'raise', amount: legal.maxRaiseTo };
    }
    return { type: 'raise', amount: raiseTo };
  }

  function passiveAction(view) {
    return view.legal.canCheck ? { type: 'check' } : { type: 'call' };
  }

  function foldOrCheck(view) {
    return view.legal.canCheck ? { type: 'check' } : { type: 'fold' };
  }

  function decidePreflop(view, persona, rng) {
    const legal = view.legal;
    const bb = view.bigBlind;
    const percentile = preflopPercentile(view.hole);
    const playThreshold = clamp(persona.playRange + (view.lateness - 0.5) * 0.12, 0.03, 0.9);
    const raiseThreshold = clamp(persona.raiseRange + (view.lateness - 0.5) * 0.06, 0.01, 0.6);
    const stackInBlinds = (view.myStack + view.myBet) / bb;
    const betInBlinds = view.currentBet / bb;
    const facingRaise = view.currentBet > bb;
    const roll = rng();

    if (legal.toCall >= view.myStack && view.myStack > 0 && facingRaise) {
      const strength = preflopEquity(percentile, view.opponents) - persona.respect * 0.08;
      const required = legal.toCall / (view.pot + legal.toCall);
      return strength >= required + persona.margin ? { type: 'call' } : { type: 'fold' };
    }

    if (stackInBlinds <= 10 && legal.canAllIn) {
      if (percentile <= persona.pushRange) return { type: 'allin' };
      if (legal.canCheck) return { type: 'check' };
      if (legal.toCall <= bb * 0.5 && percentile <= playThreshold) return { type: 'call' };
      return { type: 'fold' };
    }

    if (!facingRaise) {
      const openSize = bb * (2.5 + rng() * 1.0 + 0.7 * Math.max(0, view.pot / bb - 1.5));
      if (percentile <= raiseThreshold && roll < 0.55 + 0.45 * persona.aggression) {
        return raiseAction(view, openSize) || passiveAction(view);
      }
      if (percentile <= playThreshold) {
        if (roll < persona.aggression * 0.3) return raiseAction(view, openSize) || passiveAction(view);
        return passiveAction(view);
      }
      if (rng() < persona.bluff * (0.4 + view.lateness)) {
        return raiseAction(view, openSize) || foldOrCheck(view);
      }
      if (legal.canCheck) return { type: 'check' };
      if (legal.toCall <= bb * 0.5 && percentile <= playThreshold + 0.15) return { type: 'call' };
      return { type: 'fold' };
    }

    const bettingPressure = clamp((betInBlinds - 2) / 10, 0, 1);
    const strength = preflopEquity(percentile, view.opponents) - persona.respect * 0.1 * bettingPressure;
    const required = legal.toCall / (view.pot + legal.toCall);
    const premium = percentile <= Math.min(0.05, persona.raiseRange);

    if (premium && roll < 0.5 + 0.5 * persona.aggression) {
      return raiseAction(view, view.currentBet * (2.6 + rng() * 0.8)) || { type: 'call' };
    }
    if (percentile <= playThreshold + 0.1 && strength >= required + persona.margin) return { type: 'call' };
    if (rng() < persona.bluff * 0.25 * (0.5 + view.lateness) && percentile > 0.4) {
      return raiseAction(view, view.currentBet * (2.8 + rng())) || { type: 'fold' };
    }
    return { type: 'fold' };
  }

  function decidePostflop(view, persona, rng) {
    const legal = view.legal;
    const opponents = Math.max(1, view.opponents);
    const iterations = opponents > 3 ? 220 : 320;
    const noise = (rng() + rng() - 1) * 0.08;
    const equity = clamp(estimateEquity(view.hole, view.board, opponents, iterations, rng) + noise, 0, 1);
    const roll = rng();
    const potBeforeBet = Math.max(1, view.pot - legal.toCall);
    const sizeFraction = 0.45 + rng() * 0.4 + persona.aggression * 0.15;

    if (legal.toCall === 0) {
      const valueThreshold = 0.62 - 0.06 * persona.aggression;
      const betTarget = view.currentBet + view.pot * sizeFraction;
      if (equity >= valueThreshold) {
        const slowPlay = equity > 0.88 && roll < 0.2 && view.phase !== 'river';
        if (!slowPlay && roll < 0.55 + 0.45 * persona.aggression) return raiseAction(view, betTarget) || { type: 'check' };
        return { type: 'check' };
      }
      if (equity >= 0.45 && roll < persona.aggression * 0.5) {
        return raiseAction(view, view.pot * (0.3 + rng() * 0.2)) || { type: 'check' };
      }
      const bluffChance = (persona.bluff / opponents) * (view.phase === 'river' ? 1.1 : 1.3) * (0.7 + 0.6 * view.lateness);
      if (equity < 0.45 && roll < bluffChance) return raiseAction(view, view.pot * (0.5 + rng() * 0.3)) || { type: 'check' };
      return { type: 'check' };
    }

    const required = legal.toCall / (view.pot + legal.toCall);
    const betPressure = clamp(legal.toCall / potBeforeBet, 0, 1.5);
    const strength = equity - persona.respect * 0.1 * betPressure;
    const raiseThreshold = 0.78 - 0.08 * persona.aggression;

    if (strength >= raiseThreshold && roll < 0.35 + 0.6 * persona.aggression) {
      const action = raiseAction(view, view.currentBet + (view.pot + legal.toCall) * (0.6 + rng() * 0.4));
      if (action) return action;
    }
    if (strength >= required + persona.margin) return { type: 'call' };
    if (legal.canRaise && equity < 0.4 && roll < persona.bluff * 0.35 / opponents) {
      const action = raiseAction(view, view.currentBet + (view.pot + legal.toCall) * (0.7 + rng() * 0.3));
      if (action) return action;
    }
    return { type: 'fold' };
  }

  function decide(view, personalityKey, rng = Math.random) {
    const persona = PERSONALITIES[personalityKey] || PERSONALITIES.calculator;
    const action = view.board.length === 0 ? decidePreflop(view, persona, rng) : decidePostflop(view, persona, rng);
    if (action.type === 'fold' && view.legal.canCheck) return { type: 'check' };
    return action;
  }

  function buildView(game, index) {
    const player = game.players[index];
    const legal = game.legalActions(index);
    const contenders = game.contenders();
    const firstSeat = game.phase === 'preflop' && !game.isHeadsUp ? (game.bbIdx + 1) % game.players.length : game.phase === 'preflop' ? game.dealerIdx : (game.dealerIdx + 1) % game.players.length;
    const ordered = [];
    for (let step = 0; step < game.players.length; step++) {
      const candidate = game.players[(firstSeat + step) % game.players.length];
      if (contenders.includes(candidate)) ordered.push(candidate);
    }
    const position = ordered.indexOf(player);
    return {
      phase: game.phase,
      hole: player.hole,
      board: game.board,
      pot: game.pot,
      currentBet: game.currentBet,
      myBet: player.bet,
      myStack: player.stack,
      bigBlind: game.bigBlind,
      smallBlind: game.smallBlind,
      opponents: contenders.length - 1,
      lateness: ordered.length > 1 ? position / (ordered.length - 1) : 1,
      legal,
    };
  }

  function chooseAction(game, index, rng = Math.random) {
    const player = game.players[index];
    return decide(buildView(game, index), player.personality, rng);
  }

  function thinkingDelay(rng = Math.random) {
    return 500 + Math.floor(rng() * 1000);
  }

  function createBotRoster(count, randomInt, startIndex = 0, takenNames = []) {
    const used = new Set(takenNames.map((n) => n.toLowerCase()));
    const bots = [];
    for (let i = 0; i < count; i++) {
      const key = PERSONALITY_ORDER[(startIndex + i) % PERSONALITY_ORDER.length];
      const persona = PERSONALITIES[key];
      const available = persona.names.filter((n) => !used.has(n.toLowerCase()));
      let name;
      if (available.length) {
        name = available[randomInt(available.length)];
      } else {
        const base = persona.names[randomInt(persona.names.length)];
        name = base + ' II';
      }
      used.add(name.toLowerCase());
      bots.push({ id: 'bot' + (i + 1), name, isBot: true, personality: key });
    }
    return bots;
  }

  Poker.Bots = {
    PERSONALITIES,
    PERSONALITY_ORDER,
    preflopPercentile,
    preflopEquity,
    estimateEquity,
    decide,
    buildView,
    chooseAction,
    thinkingDelay,
    createBotRoster,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
