(function (root) {
  const { test, assert } = root.TestHarness;
  const { Game, Bots } = root.Poker;
  const { parseCards, createDeck, shuffle } = root.Poker.Deck;

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeView(overrides) {
    const legal = {
      canCheck: false,
      canCall: true,
      toCall: 20,
      canRaise: true,
      isBet: false,
      minRaiseTo: 40,
      maxRaiseTo: 1000,
      halfPotTo: 60,
      potTo: 100,
      canAllIn: true,
    };
    return {
      phase: 'preflop',
      hole: parseCards('AsAh'),
      board: [],
      pot: 30,
      currentBet: 20,
      myBet: 0,
      myStack: 1000,
      bigBlind: 20,
      smallBlind: 10,
      opponents: 1,
      lateness: 0.5,
      ...overrides,
      legal: { ...legal, ...(overrides && overrides.legal) },
    };
  }

  test('boti: percentil preflop – AA nejlepší, 72o nejhorší, suited lepší než offsuit', () => {
    const aa = Bots.preflopPercentile(parseCards('AsAh'));
    const aks = Bots.preflopPercentile(parseCards('AsKs'));
    const ako = Bots.preflopPercentile(parseCards('AsKh'));
    const trash = Bots.preflopPercentile(parseCards('7s2h'));
    assert.ok(aa < 0.01, 'AA ' + aa);
    assert.ok(aks < ako, 'AKs < AKo');
    assert.ok(aks < 0.06, 'AKs ' + aks);
    assert.ok(trash > 0.9, '72o ' + trash);
    assert.ok(Bots.preflopPercentile(parseCards('8s7s')) < Bots.preflopPercentile(parseCards('8s7h')));
  });

  test('boti: equity – AA proti jedné náhodné ruce ~85 %, 72o ~35 %', () => {
    const rng = mulberry32(1);
    const aa = Bots.estimateEquity(parseCards('AsAh'), [], 1, 4000, rng);
    const trash = Bots.estimateEquity(parseCards('7s2h'), [], 1, 4000, rng);
    assert.ok(aa > 0.8 && aa < 0.9, 'AA ' + aa);
    assert.ok(trash > 0.3 && trash < 0.4, '72o ' + trash);
  });

  test('boti: equity – nutsy na desce mají ~100 %, proti více soupeřům klesá', () => {
    const rng = mulberry32(2);
    const nuts = Bots.estimateEquity(parseCards('AsKs'), parseCards('QsJsTs2d3c'), 3, 500, rng);
    assert.ok(nuts > 0.99, 'nuts ' + nuts);
    const one = Bots.estimateEquity(parseCards('AsAh'), [], 1, 2000, rng);
    const three = Bots.estimateEquity(parseCards('AsAh'), [], 3, 2000, rng);
    assert.ok(three < one - 0.15, 'více soupeřů');
  });

  test('boti: equity – remíza na desce se dělí', () => {
    const rng = mulberry32(3);
    const eq = Bots.estimateEquity(parseCards('2c3d'), parseCards('AsKsQsJsTs'), 1, 300, rng);
    assert.ok(Math.abs(eq - 0.5) < 0.01, 'eq ' + eq);
  });

  test('boti: AA preflop nikdy nesloží a obvykle přihazuje', () => {
    let raises = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const action = Bots.decide(makeView(), 'calculator', mulberry32(seed));
      assert.ok(action.type !== 'fold', 'AA fold');
      if (action.type === 'raise' || action.type === 'allin') raises++;
    }
    assert.ok(raises > 60, 'raises ' + raises);
  });

  test('boti: opatrný hráč složí slabou ruku proti velkému raisu', () => {
    const view = makeView({
      hole: parseCards('7s2h'),
      pot: 180,
      currentBet: 120,
      legal: { toCall: 120, minRaiseTo: 220 },
    });
    let folds = 0;
    for (let seed = 1; seed <= 100; seed++) {
      if (Bots.decide(view, 'tight-passive', mulberry32(seed)).type === 'fold') folds++;
    }
    assert.ok(folds >= 95, 'folds ' + folds);
  });

  test('boti: když jde zadarmo checknout, nikdy nesloží', () => {
    for (const key of Bots.PERSONALITY_ORDER) {
      for (let seed = 1; seed <= 30; seed++) {
        const view = makeView({
          hole: parseCards('7s2h'),
          phase: 'flop',
          board: parseCards('Ah Kd 9c'),
          pot: 100,
          currentBet: 0,
          legal: { canCheck: true, canCall: false, toCall: 0, isBet: true, minRaiseTo: 20 },
        });
        assert.ok(Bots.decide(view, key, mulberry32(seed)).type !== 'fold');
      }
    }
  });

  test('boti: s nutsy postflop proti sázce nesloží', () => {
    const view = makeView({
      hole: parseCards('AsKs'),
      phase: 'river',
      board: parseCards('QsJsTs2d3c'),
      pot: 300,
      currentBet: 200,
      legal: { toCall: 200, minRaiseTo: 400 },
    });
    for (const key of Bots.PERSONALITY_ORDER) {
      for (let seed = 1; seed <= 20; seed++) {
        assert.ok(Bots.decide(view, key, mulberry32(seed)).type !== 'fold', key);
      }
    }
  });

  test('boti: s úplným odpadem postflop proti velké sázce skládají', () => {
    const view = makeView({
      hole: parseCards('2s3h'),
      phase: 'river',
      board: parseCards('AdKdQc9s8h'),
      pot: 300,
      currentBet: 250,
      legal: { toCall: 250, minRaiseTo: 500 },
    });
    let folds = 0;
    for (let seed = 1; seed <= 60; seed++) {
      if (Bots.decide(view, 'calculator', mulberry32(seed)).type === 'fold') folds++;
    }
    assert.ok(folds >= 55, 'folds ' + folds);
  });

  test('boti: osobnosti se liší – divoch hraje víc rukou než opatrný', () => {
    const rng = mulberry32(99);
    const played = { 'tight-passive': 0, 'loose-aggressive': 0, bluffer: 0, calculator: 0 };
    const trials = 600;
    for (let i = 0; i < trials; i++) {
      const hole = shuffle(createDeck(), (max) => Math.floor(rng() * max)).slice(0, 2);
      for (const key of Object.keys(played)) {
        const action = Bots.decide(makeView({ hole, lateness: 0.5 }), key, rng);
        if (action.type !== 'fold') played[key]++;
      }
    }
    assert.ok(played['loose-aggressive'] > played.calculator, JSON.stringify(played));
    assert.ok(played.calculator > played['tight-passive'], JSON.stringify(played));
    assert.ok(played.bluffer > played['tight-passive'], JSON.stringify(played));
  });

  test('boti: akce vždy v mezích legálních tahů', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 400; i++) {
      const deck = shuffle(createDeck(), (max) => Math.floor(rng() * max));
      const boardSize = [0, 3, 4, 5][Math.floor(rng() * 4)];
      const view = makeView({
        hole: deck.slice(0, 2),
        board: deck.slice(2, 2 + boardSize),
        phase: ['preflop', 'flop', 'turn', 'river'][[0, 3, 4, 5].indexOf(boardSize)],
        opponents: 1 + Math.floor(rng() * 4),
      });
      const action = Bots.decide(view, Bots.PERSONALITY_ORDER[i % 4], rng);
      if (action.type === 'raise') {
        assert.ok(action.amount >= view.legal.minRaiseTo && action.amount <= view.legal.maxRaiseTo, 'raise ' + action.amount);
      }
      assert.ok(['fold', 'check', 'call', 'raise', 'allin'].includes(action.type));
    }
  });

  test('boti: sestava botů střídá osobnosti a jména jsou unikátní', () => {
    const rng = mulberry32(5);
    for (let count = 1; count <= 5; count++) {
      const bots = Bots.createBotRoster(count, (max) => Math.floor(rng() * max));
      assert.equal(bots.length, count);
      assert.equal(new Set(bots.map((b) => b.name)).size, count);
      assert.equal(new Set(bots.map((b) => b.id)).size, count);
      bots.forEach((b, i) => assert.equal(b.personality, Bots.PERSONALITY_ORDER[i % 4]));
    }
  });

  test('boti: doba přemýšlení je 0,5–1,5 s', () => {
    for (let i = 0; i < 200; i++) {
      const delay = Bots.thinkingDelay();
      assert.ok(delay >= 500 && delay <= 1500);
    }
  });

  test('boti: celé hry botů proti sobě (1–5 botů) dohrají bez ilegálního tahu a se zachováním žetonů', () => {
    for (let botCount = 1; botCount <= 5; botCount++) {
      const rng = mulberry32(botCount * 31);
      const randomInt = (max) => Math.floor(rng() * max);
      const bots = Bots.createBotRoster(botCount + 1, randomInt);
      const game = new Game({ players: bots, randomInt, handsPerLevel: 4 });
      const expectedTotal = bots.length * 1000;
      let showdowns = 0;
      for (let hand = 0; hand < 40; hand++) {
        if (game.players.filter((p) => p.stack > 0).length < 2) break;
        game.startHand();
        let steps = 0;
        while (game.stage !== 'finished') {
          if (++steps > 300) throw new Error('hand did not finish');
          if (game.stage === 'advance') game.advance();
          else game.act(Bots.chooseAction(game, game.toActIdx, rng));
        }
        if (game.result.showdown) showdowns++;
        assert.equal(game.players.reduce((sum, p) => sum + p.stack, 0), expectedTotal);
      }
      assert.ok(showdowns > 0, 'žádný showdown při ' + botCount + ' botech');
    }
  });

  test('boti: rozhodnutí postflop trvá rozumně krátce', () => {
    const view = makeView({
      hole: parseCards('AsKd'),
      phase: 'flop',
      board: parseCards('Qh7d2c'),
      opponents: 4,
      pot: 200,
      currentBet: 50,
      legal: { toCall: 50, minRaiseTo: 100 },
    });
    const start = Date.now();
    for (let i = 0; i < 20; i++) Bots.decide(view, 'calculator');
    const perDecision = (Date.now() - start) / 20;
    assert.ok(perDecision < 60, 'ms na rozhodnutí: ' + perDecision);
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
