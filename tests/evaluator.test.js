(function (root) {
  const { test, assert } = root.TestHarness;
  const { parseCards, createDeck, shuffle, secureRandomInt } = root.Poker.Deck;
  const { evaluate, evaluateWithName, bestFive, CATEGORY } = root.Poker.Evaluator;

  const score = (text) => evaluate(parseCards(text)).score;
  const category = (text) => evaluate(parseCards(text)).category;
  const name = (text) => evaluateWithName(parseCards(text)).name;

  function referenceScore(fiveCards) {
    const ranks = fiveCards.map((c) => c.rank).sort((a, b) => b - a);
    const isFlush = fiveCards.every((c) => c.suit === fiveCards[0].suit);
    const unique = [...new Set(ranks)];
    let straightHigh = 0;
    if (unique.length === 5) {
      if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
      else if (ranks.join() === '14,5,4,3,2') straightHigh = 5;
    }
    const groups = unique
      .map((r) => ({ r, n: ranks.filter((x) => x === r).length }))
      .sort((a, b) => b.n - a.n || b.r - a.r);
    const shape = groups.map((g) => g.n).join('');
    const tiebreak = groups.map((g) => g.r);
    let category;
    let key;
    if (straightHigh && isFlush) [category, key] = [8, [straightHigh]];
    else if (shape === '41') [category, key] = [7, tiebreak];
    else if (shape === '32') [category, key] = [6, tiebreak];
    else if (isFlush) [category, key] = [5, tiebreak];
    else if (straightHigh) [category, key] = [4, [straightHigh]];
    else if (shape === '311') [category, key] = [3, tiebreak];
    else if (shape === '221') [category, key] = [2, tiebreak];
    else if (shape === '2111') [category, key] = [1, tiebreak];
    else [category, key] = [0, tiebreak];
    let value = category;
    for (let i = 0; i < 5; i++) value = value * 16 + (key[i] || 0);
    return value;
  }

  function referenceBest(sevenCards) {
    let best = -1;
    for (let a = 0; a < 7; a++) {
      for (let b = a + 1; b < 7; b++) {
        const five = sevenCards.filter((_, i) => i !== a && i !== b);
        best = Math.max(best, referenceScore(five));
      }
    }
    return best;
  }

  test('evaluator: královská postupka', () => {
    const result = evaluateWithName(parseCards('As Ks Qs Js Ts 2d 3c'));
    assert.equal(result.category, CATEGORY.STRAIGHT_FLUSH);
    assert.equal(result.name, 'Královská postupka');
  });

  test('evaluator: postupka v barvě v 7 kartách vyhraje nad pokerem', () => {
    assert.greater(score('9h 8h 7h 6h 5h 2c 2d'), score('Ks Kh Kd Kc 2h 3h 4h'));
    assert.equal(category('9h 8h 7h 6h 5h Ac Ad'), CATEGORY.STRAIGHT_FLUSH);
  });

  test('evaluator: wheel A-2-3-4-5 je postupka do pětky', () => {
    const result = evaluate(parseCards('Ah 2d 3c 4s 5h 9d Kc'));
    assert.equal(result.category, CATEGORY.STRAIGHT);
    assert.equal(result.ranks[0], 5);
  });

  test('evaluator: wheel prohraje se šestkovou postupkou a vyhraje nad trojicí', () => {
    assert.greater(score('2h 3d 4c 5s 6h 9d Kc'), score('Ah 2d 3c 4s 5h 9d Kc'));
    assert.greater(score('Ah 2d 3c 4s 5h 9d Kc'), score('Ah Ad Ac 4s 5h 9d Kc'));
  });

  test('evaluator: wheel v barvě je postupka v barvě do pětky', () => {
    const result = evaluate(parseCards('Ah 2h 3h 4h 5h Kd Qc'));
    assert.equal(result.category, CATEGORY.STRAIGHT_FLUSH);
    assert.equal(result.ranks[0], 5);
  });

  test('evaluator: broadway je nejvyšší běžná postupka', () => {
    assert.greater(score('Ah Kd Qc Js Th 2d 3c'), score('Kh Qd Jc Ts 9h 2d 3c'));
  });

  test('evaluator: postupka nesmí "obtočit" přes eso (Q-K-A-2-3)', () => {
    assert.equal(category('Qh Kd Ac 2s 3h 7d 9c'), CATEGORY.HIGH_CARD);
  });

  test('evaluator: pořadí kategorií', () => {
    const hands = [
      '2h 5d 7c 9s Jh 3d Kc',
      '2h 2d 7c 9s Jh 3d Kc',
      '2h 2d 7c 7s Jh 3d Kc',
      '2h 2d 2c 9s Jh 3d Kc',
      '5h 6d 7c 8s 9h Kd Kc',
      '2h 5h 7h 9h Jh 3d Kc',
      '2h 2d 2c 9s 9h 3d Kc',
      '2h 2d 2c 2s Jh 3d Kc',
      '5h 6h 7h 8h 9h Kd Kc',
    ];
    for (let i = 1; i < hands.length; i++) {
      assert.greater(score(hands[i]), score(hands[i - 1]), 'kategorie ' + i);
    }
  });

  test('evaluator: kickery u páru rozhodují', () => {
    assert.greater(score('Ah Ad Kc 7s 4h 3d 2c'), score('Ah Ad Qc 7s 4h 3d 2c'));
    assert.greater(score('Ah Ad Kc 7s 4h 3d 2c'), score('Ah Ad Kc 6s 5h 3d 2c') - 0);
    assert.equal(score('Ah Ad Kc 7s 4h 3d 2c'), score('As Ac Kd 7h 4d 3c 2h'));
  });

  test('evaluator: kicker u pokeru', () => {
    assert.greater(score('9h 9d 9c 9s Ah 3d 2c'), score('9h 9d 9c 9s Kh Qd Jc'));
  });

  test('evaluator: poker s kickerem z trojice a páru', () => {
    const result = evaluate(parseCards('9h 9d 9c 9s Kh Kd Kc'));
    assert.equal(result.category, CATEGORY.QUADS);
    assert.equal(result.ranks[1], 13);
  });

  test('evaluator: dvě trojice dají full house s vyšší trojicí', () => {
    const result = evaluate(parseCards('Ah Ad Ac Kh Kd Kc 2s'));
    assert.equal(result.category, CATEGORY.FULL_HOUSE);
    assert.deepEqual(result.ranks.slice(0, 2), [14, 13]);
  });

  test('evaluator: full house bere vyšší pár, ne nižší', () => {
    const result = evaluate(parseCards('Ah Ad Ac Kh Kd 9c 9s'));
    assert.deepEqual(result.ranks.slice(0, 2), [14, 13]);
  });

  test('evaluator: tři páry – dva nejvyšší a nejlepší kicker', () => {
    const result = evaluate(parseCards('Ah Ad Kc Ks 7h 7d Qc'));
    assert.equal(result.category, CATEGORY.TWO_PAIR);
    assert.deepEqual(result.ranks.slice(0, 3), [14, 13, 12]);
  });

  test('evaluator: tři páry – kickerem může být karta z nejnižšího páru', () => {
    const result = evaluate(parseCards('Ah Ad Kc Ks Qh Qd 2c'));
    assert.deepEqual(result.ranks.slice(0, 3), [14, 13, 12]);
  });

  test('evaluator: barva v 7 kartách bere nejvyšších pět', () => {
    const result = evaluate(parseCards('Ah 9h 7h 5h 3h 2h Kd'));
    assert.equal(result.category, CATEGORY.FLUSH);
    assert.deepEqual(result.ranks, [14, 9, 7, 5, 3]);
  });

  test('evaluator: barva se porovnává po kartách', () => {
    assert.greater(score('Ah 9h 7h 5h 4h 2d 2c'), score('Ah 9h 7h 5h 3h 2d 2c'));
  });

  test('evaluator: postupka s duplicitami hodnot', () => {
    const result = evaluate(parseCards('5h 6d 7c 8s 9h 9d Kc'));
    assert.equal(result.category, CATEGORY.STRAIGHT);
    assert.equal(result.ranks[0], 9);
  });

  test('evaluator: na desce 7 hodnot vybere nejvyšší postupku', () => {
    const result = evaluate(parseCards('Ah Kd Qc Js Th 9d 8c'));
    assert.equal(result.ranks[0], 14);
  });

  test('evaluator: remíza, když hraje deska', () => {
    const board = 'Ah Kd Qc Js Th';
    assert.equal(score(board + ' 2c 3d'), score(board + ' 4c 5d'));
  });

  test('evaluator: vysoká karta s kickery', () => {
    assert.greater(score('Ah Kd 9c 7s 5h 3d 2c'), score('Ah Kd 9c 7s 4h 3d 2c'));
  });

  test('evaluator: české názvy rukou', () => {
    assert.equal(name('Ah Ad 9c 7s 5h 3d 2c'), 'Pár es');
    assert.equal(name('Kh Kd Qc Qs 5h 3d 2c'), 'Dva páry (králové a dámy)');
    assert.equal(name('7h 7d 7c Qs 5h 3d 2c'), 'Trojice sedmiček');
    assert.equal(name('Ah 2d 3c 4s 5h 9d Kc'), 'Postupka do pětky');
    assert.equal(name('Ah 9h 7h 5h 3h 2d Kc'), 'Barva do esa');
    assert.equal(name('Kh Kd Kc 9s 9h 3d 2c'), 'Full house (králové na devítkách)');
    assert.equal(name('Jh Jd Jc Js 9h 3d 2c'), 'Poker (čtyři kluci)');
    assert.equal(name('9h 8h 7h 6h 5h 3d 2c'), 'Postupka v barvě do devítky');
    assert.equal(name('Ah Kd 9c 7s 5h 3d 2c'), 'Vysoká karta – eso');
  });

  test('evaluator: krátké názvy kategorií', () => {
    const { categoryLabel } = root.Poker.Evaluator;
    assert.equal(categoryLabel(evaluate(parseCards('As Ks Qs Js Ts 2d 3c'))), 'Královská postupka');
    assert.equal(categoryLabel(evaluate(parseCards('9h 8h 7h 6h 5h 2d 3c'))), 'Postupka v barvě');
    assert.equal(categoryLabel(evaluate(parseCards('Ah Ad 9c 7s 5h 3d 2c'))), 'Pár');
    assert.equal(categoryLabel(evaluate(parseCards('Kh Kd Kc 9s 9h 3d 2c'))), 'Full house');
  });

  test('evaluator: bestFive vrátí pět karet se stejným skóre', () => {
    const cards = parseCards('Ah Ad 9c 9s 5h 3d 2c');
    const best = bestFive(cards);
    assert.equal(best.length, 5);
    assert.equal(evaluate(best).score, evaluate(cards).score);
  });

  test('evaluator: shoda s nezávislou referenční implementací (3000 náhodných rukou)', () => {
    for (let i = 0; i < 3000; i++) {
      const hand = shuffle(createDeck()).slice(0, 7);
      assert.equal(evaluate(hand).score, referenceBest(hand), 'ruka ' + hand.map((c) => c.rank + ':' + c.suit).join(' '));
    }
  });

  test('deck: balíček má 52 unikátních karet', () => {
    const deck = createDeck();
    assert.equal(deck.length, 52);
    assert.equal(new Set(deck.map((c) => c.rank * 10 + c.suit)).size, 52);
  });

  test('deck: shuffle zachová karty a používá dodaný generátor', () => {
    const deck = shuffle(createDeck(), () => 0);
    assert.equal(deck.length, 52);
    assert.equal(new Set(deck.map((c) => c.rank * 10 + c.suit)).size, 52);
    const again = shuffle(createDeck(), () => 0);
    assert.deepEqual(deck, again);
  });

  test('deck: secureRandomInt je v rozsahu a rozumně rovnoměrný', () => {
    const buckets = new Array(6).fill(0);
    for (let i = 0; i < 6000; i++) {
      const value = secureRandomInt(6);
      assert.ok(value >= 0 && value < 6);
      buckets[value]++;
    }
    for (const count of buckets) assert.ok(count > 800 && count < 1200, 'bucket ' + count);
  });

  test('deck: shuffle dává každé kartě přibližně stejnou šanci na první místo', () => {
    const first = {};
    for (let i = 0; i < 5200; i++) {
      const card = shuffle(createDeck())[0];
      const key = card.rank * 10 + card.suit;
      first[key] = (first[key] || 0) + 1;
    }
    for (const count of Object.values(first)) assert.ok(count > 50 && count < 160, 'count ' + count);
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
