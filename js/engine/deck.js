(function (root) {
  const Poker = (root.Poker = root.Poker || {});

  const SUIT_CHARS = 'shdc';
  const RANK_CHARS = '23456789TJQKA';

  function makeCard(rank, suit) {
    return Object.freeze({ rank, suit });
  }

  function createDeck() {
    const deck = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 2; rank <= 14; rank++) deck.push(makeCard(rank, suit));
    }
    return deck;
  }

  function secureRandomInt(maxExclusive) {
    if (maxExclusive <= 1) return 0;
    const cryptoApi = root.crypto;
    if (!cryptoApi || !cryptoApi.getRandomValues) return Math.floor(Math.random() * maxExclusive);
    const range = 0x100000000;
    const limit = range - (range % maxExclusive);
    const buffer = new Uint32Array(1);
    let value;
    do {
      cryptoApi.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return value % maxExclusive;
  }

  function shuffle(array, randomInt = secureRandomInt) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function parseCard(text) {
    const rank = RANK_CHARS.indexOf(text[0].toUpperCase()) + 2;
    const suit = SUIT_CHARS.indexOf(text[1].toLowerCase());
    if (rank < 2 || suit < 0) throw new Error('Bad card: ' + text);
    return makeCard(rank, suit);
  }

  function parseCards(text) {
    const compact = text.replace(/\s+/g, '');
    const cards = [];
    for (let i = 0; i < compact.length; i += 2) cards.push(parseCard(compact.slice(i, i + 2)));
    return cards;
  }

  function cardToString(card) {
    return RANK_CHARS[card.rank - 2] + SUIT_CHARS[card.suit];
  }

  Poker.Deck = { createDeck, shuffle, secureRandomInt, parseCard, parseCards, cardToString, makeCard, RANK_CHARS, SUIT_CHARS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
