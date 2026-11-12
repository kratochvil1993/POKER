(function (root) {
  const Poker = (root.Poker = root.Poker || {});
  const { pick, formatChips } = Poker.Dom;
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

  function cardText(card) {
    return (card.rank <= 10 ? String(card.rank) : RANKS[card.rank]) + SUITS[card.suit];
  }

  function cardsText(cards) {
    return cards.map(cardText).join(' ');
  }

  const WIN_LINES = [
    (n) => `${n}, tohle byla krása! Krupiér už nemá sílu to odpočítávat.`,
    (n) => `${n} sbírá žetony. Boti se tváří, že to měli pod kontrolou.`,
    (n) => `Hezky, ${n}! Karty tě mají rády.`,
    (n) => `${n}, takhle se to dělá. Zapište si to někdo.`,
  ];

  const LOSE_LINES = [
    (n) => `${n}, tentokrát to nevyšlo. Příště to vyjde. Asi.`,
    (n) => `Au. ${n}, to bolelo.`,
    (n) => `${n}, štěstí je dáma vrtkavá (a občas ji vlastní boti).`,
    (n) => `Nevadí, ${n}. Žetony jsou jen kolečka s číslem.`,
  ];

  const FOLD_LINES = [
    (n) => `${n} skládá. Zdravý rozum zvítězil.`,
    (n) => `Opatrnost matkou moudrosti, ${n}.`,
    (n) => `${n} se tváří, že to byl záměr.`,
  ];

  const BLIND_UP_LINES = [
    'Blindy se zvedají. Teď to začne bolet.',
    'Blindy rostou. Čas na odvahu (nebo na kafe).',
    'Vyšší blindy! Krupiér si mne ruce.',
  ];

  const FOLD_LOG = ['%s skládá.', '%s to vzdává.', '%s odhazuje karty.', '%s se na to radši nedívá.'];
  const CHECK_LOG = ['%s čeká.', '%s klepe na stůl.', '%s čeká a sleduje.'];

  function fill(template, name) {
    return template.replace('%s', name);
  }

  function actionLog(name, event) {
    const allIn = event.allIn ? ' – all-in!' : '';
    switch (event.action) {
      case 'fold':
        return fill(pick(FOLD_LOG), name);
      case 'check':
        return fill(pick(CHECK_LOG), name);
      case 'call':
        return `${name} dorovnává ${formatChips(event.amount)}${allIn}`;
      case 'bet':
        return `${name} sází ${formatChips(event.total)}${allIn}`;
      case 'raise':
        return `${name} zvyšuje na ${formatChips(event.total)}${allIn}`;
      default:
        return `${name}: ${event.action}`;
    }
  }

  function actionLabel(event) {
    if (event.allIn && event.action !== 'fold') return 'All-in';
    const labels = { fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise' };
    return labels[event.action] || '';
  }

  function streetLog(event) {
    const titles = { flop: 'Flop', turn: 'Turn', river: 'River' };
    return `${titles[event.phase]}: ${cardsText(event.cards)}`;
  }

  function handStartLog(event, dealerName) {
    return `Ruka č. ${event.handNumber} • blindy ${formatChips(event.smallBlind)}/${formatChips(event.bigBlind)} • dealer: ${dealerName}`;
  }

  function blindsRaisedLog() {
    return pick(BLIND_UP_LINES);
  }

  function resultSummary(result, nameOf) {
    const winners = Object.entries(result.payouts);
    if (!result.showdown) {
      const [id, amount] = winners[0];
      return {
        title: `${nameOf(id)} bere pot ${formatChips(amount)}`,
        detail: 'Všichni ostatní složili.',
      };
    }
    const parts = winners.map(([id, amount]) => `${nameOf(id)} +${formatChips(amount)}`);
    const main = result.pots[0];
    const mainWinners = main.winners;
    const split = mainWinners.length > 1;
    const handName = result.hands[mainWinners[0]].name;
    return {
      title: split ? `Remíza! ${mainWinners.map(nameOf).join(' a ')} si dělí pot` : `${nameOf(mainWinners[0])} vyhrává`,
      detail: `${handName}${winners.length > 1 || split ? ' • ' + parts.join(', ') : ' • +' + formatChips(winners[0][1])}`,
    };
  }

  function humanLine(name, outcome) {
    if (outcome === 'win') return pick(WIN_LINES)(name);
    if (outcome === 'fold') return pick(FOLD_LINES)(name);
    return pick(LOSE_LINES)(name);
  }

  function bustLine(name) {
    return pick([
      `${name}, žetony došly. Krupiér ti vzkazuje, že kredit ti nedá.`,
      `${name}, banka je prázdná. Dáš si rebuy, nebo začneš znova?`,
      `Konec štace, ${name}. Boti ti děkují za příspěvek.`,
    ]);
  }

  function victoryLine(name) {
    return pick([
      `${name}, vyčistil jsi stůl! Boti jdou domů pěšky.`,
      `Všichni boti jsou venku. ${name}, jsi legenda (tohoto stolu).`,
    ]);
  }

  function thinkingLine(name) {
    return pick([`${name} přemýšlí…`, `${name} si drbe bradu…`, `${name} se nervózně dívá na karty…`, `${name} počítá šance…`]);
  }

  Poker.Messages = {
    cardText,
    cardsText,
    actionLog,
    actionLabel,
    streetLog,
    handStartLog,
    blindsRaisedLog,
    resultSummary,
    humanLine,
    bustLine,
    victoryLine,
    thinkingLine,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
