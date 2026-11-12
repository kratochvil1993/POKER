(function (root) {
  const Poker = (root.Poker = root.Poker || {});
  const { h, clear } = Poker.Dom;
  const { parseCards } = Poker.Deck;
  const { CATEGORY } = Poker.Evaluator;

  const HAND_GUIDE = [
    { category: CATEGORY.STRAIGHT_FLUSH, name: 'Královská postupka', text: 'Od desítky po eso, všechny karty stejné barvy. Nejlepší možná ruka.', cards: 'As Ks Qs Js Ts' },
    { category: CATEGORY.STRAIGHT_FLUSH, name: 'Postupka v barvě', text: 'Pět karet po sobě ve stejné barvě.', cards: '9h 8h 7h 6h 5h' },
    { category: CATEGORY.QUADS, name: 'Poker (čtveřice)', text: 'Čtyři karty stejné hodnoty a jedna kicker.', cards: 'Kc Kd Kh Ks 4d' },
    { category: CATEGORY.FULL_HOUSE, name: 'Full house', text: 'Trojice a k ní pár.', cards: 'Qc Qd Qh 8s 8d' },
    { category: CATEGORY.FLUSH, name: 'Barva', text: 'Pět karet stejné barvy, ne po sobě.', cards: 'Ad Jd 9d 6d 3d' },
    { category: CATEGORY.STRAIGHT, name: 'Postupka', text: 'Pět karet po sobě v různých barvách. Eso může být i nízké (A-2-3-4-5).', cards: '9c 8d 7h 6s 5c' },
    { category: CATEGORY.TRIPS, name: 'Trojice', text: 'Tři karty stejné hodnoty.', cards: 'Jc Jd Jh 9s 4d' },
    { category: CATEGORY.TWO_PAIR, name: 'Dva páry', text: 'Dva různé páry a kicker.', cards: 'Ac Ad 7h 7s 2d' },
    { category: CATEGORY.PAIR, name: 'Pár', text: 'Dvě karty stejné hodnoty.', cards: 'Tc Td Ah 8s 3d' },
    { category: CATEGORY.HIGH_CARD, name: 'Vysoká karta', text: 'Nic z výše uvedeného, rozhoduje nejvyšší karta.', cards: 'Ac Jd 8h 6s 3d' },
  ];

  const RULES = [
    'Z pěti společných a dvou vlastních karet se počítá nejlepších pět.',
    'Stejné kombinace rozhodují vyšší karty, případně kicker (nejvyšší zbývající karta).',
    'Barvy karet nemají žádnou váhu, při úplné shodě se pot dělí.',
  ];

  function exampleCards(text) {
    const wrapper = h('div', { class: 'help-cards' });
    for (const card of parseCards(text)) {
      const element = Poker.CardView.createCardElement('sm');
      Poker.CardView.setCard(element, card, { faceUp: true });
      wrapper.append(element);
    }
    return wrapper;
  }

  function build(list, currentCategory, currentIsRoyal) {
    clear(list);
    HAND_GUIDE.forEach((entry, index) => {
      const isRoyalRow = index === 0;
      const isCurrent =
        currentCategory === entry.category &&
        (entry.category !== CATEGORY.STRAIGHT_FLUSH || (isRoyalRow ? currentIsRoyal : !currentIsRoyal));
      list.append(
        h(
          'li',
          { class: 'help-row' + (isCurrent ? ' current' : '') },
          h('div', { class: 'help-rank' }, String(index + 1)),
          h(
            'div',
            { class: 'help-body' },
            h('div', { class: 'help-name' }, entry.name, isCurrent ? h('span', { class: 'help-badge' }, 'tohle máš') : null),
            h('div', { class: 'help-text' }, entry.text),
            exampleCards(entry.cards)
          )
        )
      );
    });
  }

  function open(current) {
    const list = document.getElementById('helpList');
    build(list, current ? current.category : -1, current ? current.ranks[0] === 14 : false);
    const rules = document.getElementById('helpRules');
    if (!rules.children.length) for (const rule of RULES) rules.append(h('li', {}, rule));
    const element = document.getElementById('helpModal');
    if (root.bootstrap && root.bootstrap.Modal) root.bootstrap.Modal.getOrCreateInstance(element).show();
    else {
      element.classList.add('show');
      element.style.display = 'block';
    }
  }

  Poker.Help = { open, HAND_GUIDE };
})(typeof globalThis !== 'undefined' ? globalThis : this);
