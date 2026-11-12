(function (root) {
  const { test, assert } = root.TestHarness;
  const { buildPots, awardPots, splitPot } = root.Poker.Pots;

  const contribution = (id, amount, folded = false) => ({ id, amount, folded });

  test('pots: dva hráči se stejným vkladem = jeden pot', () => {
    const pots = buildPots([contribution('a', 100), contribution('b', 100)]);
    assert.deepEqual(pots, [{ amount: 200, eligible: ['a', 'b'] }]);
  });

  test('pots: tři all-iny s různými stacky = hlavní pot + dva side poty', () => {
    const pots = buildPots([contribution('a', 100), contribution('b', 300), contribution('c', 500)]);
    assert.deepEqual(pots, [
      { amount: 300, eligible: ['a', 'b', 'c'] },
      { amount: 400, eligible: ['b', 'c'] },
      { amount: 200, eligible: ['c'] },
    ]);
  });

  test('pots: složený hráč přispěl, ale nemůže vyhrát', () => {
    const pots = buildPots([contribution('a', 50, true), contribution('b', 100), contribution('c', 100)]);
    assert.deepEqual(pots, [{ amount: 250, eligible: ['b', 'c'] }]);
  });

  test('pots: složený hráč s vkladem uprostřed rozdělí side poty správně', () => {
    const pots = buildPots([contribution('a', 100), contribution('b', 200, true), contribution('c', 300), contribution('d', 300)]);
    assert.deepEqual(pots, [
      { amount: 400, eligible: ['a', 'c', 'd'] },
      { amount: 500, eligible: ['c', 'd'] },
    ]);
  });

  test('pots: součet potů se rovná součtu vkladů', () => {
    const input = [contribution('a', 37), contribution('b', 120, true), contribution('c', 250), contribution('d', 250), contribution('e', 90)];
    const total = buildPots(input).reduce((sum, pot) => sum + pot.amount, 0);
    assert.equal(total, input.reduce((sum, c) => sum + c.amount, 0));
  });

  test('pots: remíza dělí pot půl na půl', () => {
    const pots = buildPots([contribution('a', 100), contribution('b', 100)]);
    const { payouts } = awardPots(pots, { a: 5, b: 5 }, ['a', 'b']);
    assert.deepEqual(payouts, { a: 100, b: 100 });
  });

  test('pots: lichý žeton dostane první hráč od buttonu', () => {
    assert.deepEqual(splitPot(101, ['a', 'b'], ['b', 'a']), { a: 50, b: 51 });
    assert.deepEqual(splitPot(5, ['a', 'b', 'c'], ['c', 'a', 'b']), { a: 2, b: 1, c: 2 });
  });

  test('pots: krátký stack vyhrává jen hlavní pot, side pot jde druhému nejlepšímu', () => {
    const pots = buildPots([contribution('a', 100), contribution('b', 300), contribution('c', 300)]);
    const { payouts } = awardPots(pots, { a: 9, b: 5, c: 3 }, ['a', 'b', 'c']);
    assert.deepEqual(payouts, { a: 300, b: 400 });
  });

  test('pots: remíza jen o side pot', () => {
    const pots = buildPots([contribution('a', 100), contribution('b', 300), contribution('c', 300)]);
    const { payouts } = awardPots(pots, { a: 1, b: 7, c: 7 }, ['a', 'b', 'c']);
    assert.deepEqual(payouts, { b: 350, c: 350 });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
