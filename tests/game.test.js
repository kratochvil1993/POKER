(function (root) {
  const { test, assert } = root.TestHarness;
  const { Game } = root.Poker;
  const { createDeck, parseCards, cardToString } = root.Poker.Deck;

  const FLAT_BLINDS = [[10, 20]];

  function makePlayers(stacks) {
    return stacks.map((stack, i) => ({ id: 'p' + i, name: 'Hráč ' + i, stack }));
  }

  function stackedDeck({ dealer, holes, board }) {
    const seatCount = holes.length;
    const order = [];
    for (let i = 1; i <= seatCount; i++) order.push((dealer + i) % seatCount);
    const parsedHoles = holes.map((text) => parseCards(text));
    const cards = [];
    for (let round = 0; round < 2; round++) for (const seat of order) cards.push(parsedHoles[seat][round]);
    cards.push(...parseCards(board));
    const used = new Set(cards.map(cardToString));
    for (const card of createDeck()) if (!used.has(cardToString(card))) cards.push(card);
    return cards;
  }

  function makeStackedGame({ stacks, dealer = 0, holes, board, blindLevels = FLAT_BLINDS, handsPerLevel }) {
    const deck = stackedDeck({ dealer, holes, board });
    return new Game({
      players: makePlayers(stacks),
      firstDealer: dealer,
      blindLevels,
      handsPerLevel,
      createDeck: () => deck,
    });
  }

  function finishHand(game, chooseAction) {
    let guard = 0;
    while (game.stage !== 'finished') {
      if (++guard > 500) throw new Error('hand did not finish');
      if (game.stage === 'advance') game.advance();
      else game.act(chooseAction(game));
    }
  }

  function checkOrCall(game) {
    return game.legalActions().canCheck ? { type: 'check' } : { type: 'call' };
  }

  function stackOf(game, id) {
    return game.playerById(id).stack;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  test('game: heads-up – dealer je malý blind a jedná první preflop', () => {
    const game = makeStackedGame({ stacks: [1000, 1000], holes: ['AsAh', 'KsKh'], board: '2c 7d 9h Jc 4s' });
    game.startHand();
    assert.equal(game.sbIdx, 0);
    assert.equal(game.bbIdx, 1);
    assert.equal(game.toActIdx, 0);
    assert.equal(game.players[0].bet, 10);
    assert.equal(game.players[1].bet, 20);
  });

  test('game: heads-up – postflop jedná první velký blind (ne dealer)', () => {
    const game = makeStackedGame({ stacks: [1000, 1000], holes: ['AsAh', 'KsKh'], board: '2c 7d 9h Jc 4s' });
    game.startHand();
    game.act({ type: 'call' });
    assert.equal(game.toActIdx, 1, 'BB má preflop opci');
    game.act({ type: 'check' });
    assert.equal(game.stage, 'advance');
    game.advance();
    assert.equal(game.phase, 'flop');
    assert.equal(game.board.length, 3);
    assert.equal(game.toActIdx, 1);
  });

  test('game: heads-up – check-down do showdownu, vyhrává lepší ruka, žetony sedí', () => {
    const game = makeStackedGame({ stacks: [1000, 1000], holes: ['AsAh', 'KsKh'], board: '2c 7d 9h Jc 4s' });
    game.startHand();
    finishHand(game, checkOrCall);
    assert.equal(game.result.showdown, true);
    assert.deepEqual(game.result.winnerIds, ['p0']);
    assert.equal(game.result.hands.p0.name, 'Pár es');
    assert.equal(game.result.hands.p1.name, 'Pár králů');
    assert.equal(stackOf(game, 'p0'), 1020);
    assert.equal(stackOf(game, 'p1'), 980);
  });

  test('game: 6 hráčů – SB, BB a UTG jsou správně, postflop začíná SB', () => {
    const game = makeStackedGame({
      stacks: [1000, 1000, 1000, 1000, 1000, 1000],
      holes: ['AsAh', 'KsKh', 'QsQh', 'JsJh', 'TsTh', '9s9h'],
      board: '2c 7d 3h 4c 5s',
    });
    game.startHand();
    assert.equal(game.sbIdx, 1);
    assert.equal(game.bbIdx, 2);
    assert.equal(game.toActIdx, 3);
    for (let i = 0; i < 5; i++) game.act({ type: 'call' });
    assert.equal(game.toActIdx, 2, 'BB má opci');
    game.act({ type: 'check' });
    game.advance();
    assert.equal(game.toActIdx, 1);
  });

  test('game: všichni složí – BB bere blindy bez showdownu', () => {
    const game = makeStackedGame({ stacks: [1000, 1000, 1000], holes: ['AsAh', 'KsKh', '2c3d'], board: '2h 7d 9c Jd 4s' });
    game.startHand();
    game.act({ type: 'fold' });
    game.act({ type: 'fold' });
    assert.equal(game.stage, 'finished');
    assert.equal(game.result.showdown, false);
    assert.deepEqual(game.result.winnerIds, ['p2']);
    assert.equal(stackOf(game, 'p2'), 1010);
    assert.equal(stackOf(game, 'p1'), 990);
    assert.equal(stackOf(game, 'p0'), 1000);
  });

  test('game: čtyři all-iny s různými stacky – každý pot má jiného vítěze', () => {
    const game = makeStackedGame({
      stacks: [100, 250, 500, 1000],
      holes: ['AsAh', 'KsKh', 'QsQh', '8c3d'],
      board: '2h 7d 9c Jd 4s',
    });
    game.startHand();
    game.act({ type: 'allin' });
    game.act({ type: 'allin' });
    game.act({ type: 'allin' });
    game.act({ type: 'allin' });
    assert.equal(game.stage, 'advance');
    assert.equal(game.isRunout(), true);
    finishHand(game, checkOrCall);
    assert.deepEqual(game.result.pots.map((pot) => pot.amount), [400, 450, 500]);
    assert.deepEqual(game.result.pots.map((pot) => pot.winners[0]), ['p0', 'p1', 'p2']);
    assert.equal(stackOf(game, 'p0'), 400);
    assert.equal(stackOf(game, 'p1'), 450);
    assert.equal(stackOf(game, 'p2'), 500);
    assert.equal(stackOf(game, 'p3'), 500, 'nevyrovnaná část sázky se vrací');
    assert.equal(game.players.reduce((sum, p) => sum + p.stack, 0), 1850);
  });

  test('game: nejkratší stack vyhraje jen hlavní pot, ostatní hrají side pot', () => {
    const game = makeStackedGame({
      stacks: [100, 500, 500],
      holes: ['AsAh', 'QsQh', 'KsKh'],
      board: '2h 7d 9c Jd 4s',
    });
    game.startHand();
    game.act({ type: 'allin' });
    game.act({ type: 'allin' });
    game.act({ type: 'allin' });
    finishHand(game, checkOrCall);
    assert.equal(stackOf(game, 'p0'), 300);
    assert.equal(stackOf(game, 'p2'), 800);
    assert.equal(stackOf(game, 'p1'), 0);
  });

  test('game: split pot při remíze, lichý žeton jde hráči nejblíž za dealerem', () => {
    const game = makeStackedGame({
      stacks: [1000, 1000, 1000],
      holes: ['2c3d', '6c7d', '4c5d'],
      board: 'Ah Kd Qc Js Th',
      blindLevels: [[5, 10]],
    });
    game.startHand();
    game.act({ type: 'call' });
    game.act({ type: 'fold' });
    game.act({ type: 'check' });
    finishHand(game, checkOrCall);
    assert.deepEqual(game.result.winnerIds.sort(), ['p0', 'p2']);
    assert.equal(game.result.payouts.p2, 13);
    assert.equal(game.result.payouts.p0, 12);
    assert.equal(game.players.reduce((sum, p) => sum + p.stack, 0), 3000);
  });

  test('game: wheel porazí trojici a vyhraje showdown', () => {
    const game = makeStackedGame({ stacks: [1000, 1000], holes: ['Ad2d', 'KsKh'], board: '3c 4d 5h Kc 9s' });
    game.startHand();
    finishHand(game, checkOrCall);
    assert.equal(game.result.hands.p0.name, 'Postupka do pětky');
    assert.deepEqual(game.result.winnerIds, ['p0']);
  });

  test('game: kicker rozhoduje showdown', () => {
    const game = makeStackedGame({ stacks: [1000, 1000], holes: ['AsKh', 'AdQh'], board: 'Ac 7d 9h 2c 4s' });
    game.startHand();
    finishHand(game, checkOrCall);
    assert.deepEqual(game.result.winnerIds, ['p0']);
  });

  test('game: minimální raise a re-raise', () => {
    const game = makeStackedGame({ stacks: [1000, 1000, 1000], holes: ['AsAh', 'KsKh', 'QsQh'], board: '2h 7d 9c Jd 4s' });
    game.startHand();
    const open = game.legalActions();
    assert.equal(open.minRaiseTo, 40);
    assert.equal(open.potTo, 70);
    assert.throws(() => game.act({ type: 'raise', amount: 30 }));
    game.act({ type: 'raise', amount: 60 });
    const reraise = game.legalActions();
    assert.equal(reraise.minRaiseTo, 100);
    assert.throws(() => game.act({ type: 'raise', amount: 80 }));
    game.act({ type: 'raise', amount: 100 });
    assert.equal(game.legalActions().minRaiseTo, 140);
  });

  test('game: krátký all-in neotevírá akci hráčům, kteří už jednali', () => {
    const game = makeStackedGame({ stacks: [1000, 1000, 130], holes: ['AsAh', 'KsKh', 'QsQh'], board: '2h 7d 9c Jd 4s' });
    game.startHand();
    game.act({ type: 'raise', amount: 100 });
    game.act({ type: 'call' });
    game.act({ type: 'allin' });
    assert.equal(game.currentBet, 130);
    assert.equal(game.toActIdx, 0);
    const legal = game.legalActions();
    assert.equal(legal.canRaise, false);
    assert.equal(legal.canCall, true);
    assert.throws(() => game.act({ type: 'raise', amount: 400 }));
    game.act({ type: 'call' });
    game.act({ type: 'call' });
    assert.equal(game.stage, 'advance');
  });

  test('game: plný raise znovu otevře akci', () => {
    const game = makeStackedGame({ stacks: [1000, 1000, 1000], holes: ['AsAh', 'KsKh', 'QsQh'], board: '2h 7d 9c Jd 4s' });
    game.startHand();
    game.act({ type: 'raise', amount: 60 });
    game.act({ type: 'call' });
    game.act({ type: 'raise', amount: 200 });
    assert.equal(game.toActIdx, 0);
    assert.equal(game.legalActions().canRaise, true);
    assert.equal(game.legalActions().toCall, 140);
  });

  test('game: nevyrovnaná sázka se vrací a pot sedí', () => {
    const game = makeStackedGame({ stacks: [1000, 200], holes: ['AsAh', 'KsKh'], board: '2h 7d 9c Jd 4s' });
    game.startHand();
    game.act({ type: 'raise', amount: 500 });
    game.act({ type: 'allin' });
    assert.equal(game.stage, 'advance');
    assert.equal(game.players[0].stack, 800);
    assert.equal(game.pot, 400);
    finishHand(game, checkOrCall);
    assert.equal(stackOf(game, 'p0'), 1200);
    assert.equal(stackOf(game, 'p1'), 0);
  });

  test('game: proti all-inu nejde přihazovat (nikdo jiný nemůže jednat)', () => {
    const game = makeStackedGame({ stacks: [1000, 5000], holes: ['AsAh', 'KsKh'], board: '2h 7d 9c Jd 4s' });
    game.startHand();
    game.act({ type: 'allin' });
    const legal = game.legalActions();
    assert.equal(legal.canRaise, false);
    assert.equal(legal.canCall, true);
    assert.equal(legal.toCall, 980);
  });

  test('game: all-in preflop přeskočí sázení a vyloží celou desku', () => {
    const game = makeStackedGame({ stacks: [1000, 1000], holes: ['AsAh', 'KsKh'], board: '2h 7d 9c Jd 4s' });
    game.startHand();
    game.act({ type: 'allin' });
    game.act({ type: 'call' });
    const phases = [];
    while (game.stage === 'advance') {
      game.advance();
      phases.push(game.phase);
    }
    assert.deepEqual(phases, ['flop', 'turn', 'river', 'showdown']);
    assert.equal(game.board.length, 5);
    assert.equal(stackOf(game, 'p0'), 2000);
  });

  test('game: ilegální akce se odmítnou', () => {
    const game = makeStackedGame({ stacks: [1000, 1000], holes: ['AsAh', 'KsKh'], board: '2h 7d 9c Jd 4s' });
    game.startHand();
    assert.throws(() => game.act({ type: 'check' }));
    assert.throws(() => game.act({ type: 'raise', amount: 5000 }));
    assert.throws(() => game.act({ type: 'dance' }));
  });

  test('game: blindy rostou po zadaném počtu rukou', () => {
    const game = makeStackedGame({
      stacks: [1000, 1000],
      holes: ['AsAh', 'KsKh'],
      board: '2h 7d 9c Jd 4s',
      blindLevels: [[10, 20], [15, 30], [25, 50]],
      handsPerLevel: 2,
    });
    const seen = [];
    for (let i = 0; i < 5; i++) {
      game.startHand();
      seen.push(game.bigBlind);
      game.act({ type: 'fold' });
    }
    assert.deepEqual(seen, [20, 20, 30, 30, 50]);
  });

  test('game: dealer rotuje a přeskakuje hráče bez žetonů', () => {
    const game = new Game({
      players: makePlayers([1000, 1000, 0, 1000]),
      firstDealer: 0,
      blindLevels: FLAT_BLINDS,
    });
    const dealers = [];
    for (let i = 0; i < 4; i++) {
      game.startHand();
      dealers.push(game.dealerIdx);
      game.act({ type: 'fold' });
      if (game.stage !== 'finished') game.act({ type: 'fold' });
    }
    assert.deepEqual(dealers, [0, 1, 3, 0]);
  });

  test('game: hra odmítne začít s jedním hráčem', () => {
    const game = new Game({ players: makePlayers([1000, 0]), blindLevels: FLAT_BLINDS });
    assert.throws(() => game.startHand());
  });

  test('game: malý stack nemůže zaplatit celý blind a jde all-in', () => {
    const game = makeStackedGame({ stacks: [1000, 1000, 15], holes: ['AsAh', 'KsKh', 'QsQh'], board: '2h 7d 9c Jd 4s' });
    game.startHand();
    assert.equal(game.players[2].bet, 15);
    assert.equal(game.players[2].allIn, true);
    finishHand(game, checkOrCall);
    assert.equal(game.players.reduce((sum, p) => sum + p.stack, 0), 2015);
  });

  test('game: fuzz – náhodné hry 2–6 hráčů zachovávají žetony a vždy skončí', () => {
    for (let playerCount = 2; playerCount <= 6; playerCount++) {
      for (let seed = 1; seed <= 6; seed++) {
        const random = mulberry32(playerCount * 1000 + seed);
        const randomInt = (max) => Math.floor(random() * max);
        const stacks = [];
        for (let i = 0; i < playerCount; i++) stacks.push(100 + randomInt(1900));
        const game = new Game({ players: makePlayers(stacks), randomInt, handsPerLevel: 5 });
        let expectedTotal = stacks.reduce((a, b) => a + b, 0);

        for (let hand = 0; hand < 60; hand++) {
          for (const p of game.players) {
            if (p.stack === 0) {
              game.rebuy(p.id, 500);
              expectedTotal += 500;
            }
          }
          game.startHand();
          let steps = 0;
          while (game.stage !== 'finished') {
            if (++steps > 300) throw new Error('hand did not finish');
            assert.equal(game.totalChips, expectedTotal, 'chips conserved mid-hand');
            if (game.stage === 'advance') {
              game.advance();
              continue;
            }
            const legal = game.legalActions();
            const roll = random();
            if (roll < 0.15) game.act({ type: 'fold' });
            else if (roll < 0.25 && legal.canAllIn) game.act({ type: 'allin' });
            else if (roll < 0.45 && legal.canRaise) {
              const span = legal.maxRaiseTo - legal.minRaiseTo;
              game.act({ type: 'raise', amount: legal.minRaiseTo + randomInt(span + 1) });
            } else game.act(checkOrCall(game));
          }
          assert.equal(game.totalChips, expectedTotal, 'chips conserved after hand');
          assert.equal(game.players.reduce((sum, p) => sum + p.stack, 0), expectedTotal, 'all chips in stacks after hand');
          for (const p of game.players) assert.ok(p.stack >= 0, 'negative stack');
          const payoutTotal = Object.values(game.result.payouts).reduce((a, b) => a + b, 0);
          assert.equal(payoutTotal, game.pot, 'payouts equal pot');
        }
      }
    }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
