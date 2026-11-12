(function (root) {
  const Poker = (root.Poker = root.Poker || {});

  function sameMembers(a, b) {
    return a.length === b.length && a.every((id) => b.includes(id));
  }

  function buildPots(contributions) {
    const levels = [...new Set(contributions.filter((c) => c.amount > 0).map((c) => c.amount))].sort((a, b) => a - b);
    const pots = [];
    let previousLevel = 0;
    for (const level of levels) {
      const contributors = contributions.filter((c) => c.amount >= level);
      const amount = (level - previousLevel) * contributors.length;
      const eligible = contributors.filter((c) => !c.folded).map((c) => c.id);
      const last = pots[pots.length - 1];
      if (eligible.length === 0) {
        if (last) last.amount += amount;
      } else if (last && sameMembers(last.eligible, eligible)) {
        last.amount += amount;
      } else {
        pots.push({ amount, eligible });
      }
      previousLevel = level;
    }
    return pots;
  }

  function splitPot(amount, winnerIds, oddChipOrder) {
    const share = Math.floor(amount / winnerIds.length);
    let remainder = amount - share * winnerIds.length;
    const shares = {};
    for (const id of winnerIds) shares[id] = share;
    const ordered = oddChipOrder.filter((id) => winnerIds.includes(id));
    for (let i = 0; remainder > 0; i = (i + 1) % ordered.length) {
      shares[ordered[i]] += 1;
      remainder -= 1;
    }
    return shares;
  }

  function awardPots(pots, scoreById, oddChipOrder) {
    const payouts = {};
    const results = pots.map((pot) => {
      let bestScore = -1;
      for (const id of pot.eligible) bestScore = Math.max(bestScore, scoreById[id]);
      const winners = pot.eligible.filter((id) => scoreById[id] === bestScore);
      const shares = splitPot(pot.amount, winners, oddChipOrder);
      for (const id of winners) payouts[id] = (payouts[id] || 0) + shares[id];
      return { amount: pot.amount, eligible: pot.eligible, winners, shares };
    });
    return { payouts, results };
  }

  Poker.Pots = { buildPots, awardPots, splitPot };
})(typeof globalThis !== 'undefined' ? globalThis : this);
