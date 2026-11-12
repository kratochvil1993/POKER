(function (root) {
  const Poker = (root.Poker = root.Poker || {});
  const { h, formatChips } = Poker.Dom;

  const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'];
  const RANK_LABELS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const AVATARS = {
    human: '🙂',
    'tight-passive': '🧐',
    'loose-aggressive': '🔥',
    bluffer: '🎭',
    calculator: '🧮',
  };
  const PERSONALITY_LABELS = {
    'tight-passive': 'Opatrný',
    'loose-aggressive': 'Divoch',
    bluffer: 'Blafér',
    calculator: 'Kalkulátor',
  };

  const SEAT_LAYOUTS = {
    2: [[50, 85], [50, 13]],
    3: [[50, 85], [17, 27], [83, 27]],
    4: [[50, 85], [14, 63], [50, 13], [86, 63]],
    5: [[50, 85], [14, 63], [26, 17], [74, 17], [86, 63]],
    6: [[50, 85], [14, 67], [14, 31], [50, 11], [86, 31], [86, 67]],
  };

  function cardKey(card) {
    return card.rank + '-' + card.suit;
  }

  function rankLabel(rank) {
    return rank <= 10 ? String(rank) : RANK_LABELS[rank];
  }

  function createCardElement(sizeClass) {
    return h(
      'div',
      { class: 'pcard empty ' + sizeClass },
      h(
        'div',
        { class: 'pcard-inner' },
        h('div', { class: 'pcard-face' }, h('span', { class: 'cr' }), h('span', { class: 'cs' }), h('span', { class: 'cc' })),
        h('div', { class: 'pcard-back' })
      )
    );
  }

  function fillCardFace(element, card) {
    const face = element.querySelector('.pcard-face');
    const suit = SUIT_SYMBOLS[card.suit];
    face.classList.toggle('red', card.suit === 1 || card.suit === 2);
    face.querySelector('.cr').textContent = rankLabel(card.rank);
    face.querySelector('.cs').textContent = suit;
    face.querySelector('.cc').textContent = suit;
    element.dataset.key = cardKey(card);
  }

  function emptyCardFace(element) {
    for (const part of ['.cr', '.cs', '.cc']) element.querySelector(part).textContent = '';
    delete element.dataset.key;
  }

  function restartAnimation(element, className, delayMs) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.style.animationDelay = delayMs + 'ms';
    element.classList.add(className);
  }

  function clearCard(element) {
    element.classList.add('empty');
    element.classList.remove('faceup', 'dealt', 'win-card', 'dim-card');
    emptyCardFace(element);
  }

  function setCard(element, card, { faceUp, animate = false, delay = 0, flipDelay = 0 }) {
    if (!card) {
      clearCard(element);
      return;
    }
    const wasEmpty = element.classList.contains('empty');
    element.classList.remove('empty');
    if (animate) restartAnimation(element, 'dealt', delay);
    if (faceUp) {
      const alreadyShown = element.dataset.key === cardKey(card) && element.classList.contains('faceup');
      fillCardFace(element, card);
      if (!alreadyShown) {
        if (flipDelay > 0 || wasEmpty) setTimeout(() => element.classList.add('faceup'), flipDelay);
        else element.classList.add('faceup');
      }
    } else {
      element.classList.remove('faceup');
      emptyCardFace(element);
    }
  }

  class TableView {
    constructor(container, bannerEl) {
      this.container = container;
      this.bannerEl = bannerEl;
      this.seats = new Map();
      this.communityCards = [];
      this.previousBoardSize = 0;
    }

    build(players, humanId) {
      const root = this.container;
      while (root.firstChild) root.removeChild(root.firstChild);
      this.seats.clear();
      this.humanId = humanId;

      this.potEl = h('div', { class: 'pot' }, h('span', { class: 'pot-chip' }), h('span', { class: 'pot-label' }, 'Pot'), h('strong', { class: 'pot-value' }, '0'));
      this.communityEl = h('div', { class: 'community' });
      this.communityCards = [];
      for (let i = 0; i < 5; i++) {
        const card = createCardElement('md');
        this.communityCards.push(card);
        this.communityEl.append(h('div', { class: 'community-slot' }, card));
      }
      root.append(
        h('div', { class: 'felt' }),
        h('div', { class: 'table-center' }, this.potEl, this.communityEl)
      );

      const layout = SEAT_LAYOUTS[players.length];
      players.forEach((player, index) => {
        const [x, y] = layout[index];
        const isHuman = player.id === humanId;
        const cardSize = isHuman ? 'lg' : 'sm';
        const holeCards = [createCardElement(cardSize), createCardElement(cardSize)];
        const nameEl = h('div', { class: 'seat-name' });
        const stackEl = h('div', { class: 'seat-stack' });
        const tagEl = h('div', { class: 'seat-tag', hidden: true });
        const dealerEl = h('div', { class: 'dealer-btn', hidden: true, title: 'Dealer' }, 'D');
        const blindEl = h('div', { class: 'blind-tag', hidden: true });
        const avatarEl = h('div', { class: 'avatar' }, isHuman ? AVATARS.human : AVATARS[player.personality] || '🙂');
        const pill = h('div', { class: 'seat-pill' }, avatarEl, h('div', { class: 'seat-text' }, nameEl, stackEl), tagEl);
        const seatEl = h(
          'div',
          {
            class: 'seat ' + (y < 50 ? 'upper ' : 'lower ') + (isHuman ? 'human' : 'bot'),
            style: `left:${x}%;top:${y}%`,
            dataset: { id: player.id },
          },
          h('div', { class: 'seat-cards' }, holeCards),
          pill,
          dealerEl,
          blindEl
        );
        const pull = isHuman ? 0.52 : 0.46;
        const betEl = h(
          'div',
          { class: 'bet-chip', hidden: true, style: `left:${x + (50 - x) * pull}%;top:${y + (50 - y) * pull}%` },
          h('span', { class: 'bet-act' }),
          h('span', { class: 'bet-amt' })
        );
        root.append(seatEl, betEl);
        this.seats.set(player.id, { seatEl, holeCards, nameEl, stackEl, tagEl, dealerEl, blindEl, betEl, pill, player });
      });
      this.previousBoardSize = 0;
    }

    update(game, ui) {
      const potValue = game.stage === 'finished' ? 0 : game.pot;
      this.potEl.querySelector('.pot-value').textContent = formatChips(potValue);
      this.potEl.classList.toggle('empty', potValue === 0);

      game.players.forEach((player, index) => {
        const seat = this.seats.get(player.id);
        const isHuman = player.id === this.humanId;
        const out = !player.inHand && player.stack === 0;
        const revealed = isHuman || ui.revealIds.has(player.id);
        const handOver = game.stage === 'finished';
        const showCards = player.inHand && !player.folded;

        seat.nameEl.textContent = player.name;
        seat.stackEl.textContent = out ? 'Vyřazen' : formatChips(player.stack);
        seat.seatEl.classList.toggle('active', game.toActIdx === index && game.stage === 'betting');
        seat.seatEl.classList.toggle('folded', player.inHand && player.folded);
        seat.seatEl.classList.toggle('out', out);
        seat.seatEl.classList.toggle('allin', player.inHand && player.allIn && !player.folded);
        seat.seatEl.classList.toggle('winner', ui.winnerIds.has(player.id));
        seat.seatEl.classList.toggle('sitting', !player.inHand && !out);
        seat.dealerEl.hidden = !(game.dealerIdx === index && game.handNumber > 0 && game.stage !== 'idle');

        const blindText = index === game.sbIdx && game.stage !== 'idle' ? 'SB' : index === game.bbIdx && game.stage !== 'idle' ? 'BB' : '';
        seat.blindEl.hidden = !blindText || !player.inHand;
        seat.blindEl.textContent = blindText;

        seat.tagEl.hidden = !(player.inHand && player.allIn && !player.folded);
        seat.tagEl.textContent = 'ALL-IN';

        const label = ui.actionLabels[player.id] || '';
        const hasBet = player.bet > 0 && game.stage !== 'finished';
        seat.betEl.hidden = !(hasBet || label);
        seat.betEl.classList.toggle('only-label', !hasBet);
        seat.betEl.classList.toggle('is-fold', label === 'Fold');
        seat.betEl.querySelector('.bet-act').textContent = label;
        seat.betEl.querySelector('.bet-amt').textContent = hasBet ? formatChips(player.bet) : '';

        seat.holeCards.forEach((cardEl, cardIndex) => {
          if (!showCards || !player.hole[cardIndex]) {
            if (!cardEl.classList.contains('empty')) clearCard(cardEl);
            seat.seatEl.classList.toggle('no-cards', true);
            return;
          }
          seat.seatEl.classList.remove('no-cards');
          const justDealt = ui.dealing && cardEl.classList.contains('empty');
          const card = player.hole[cardIndex];
          const dealDelay = ui.dealing ? (cardIndex * game.players.length + index) * 70 : 0;
          setCard(cardEl, card, { faceUp: revealed, animate: justDealt, delay: dealDelay, flipDelay: isHuman && justDealt ? dealDelay + 350 : 0 });
          const key = cardKey(card);
          const emphasise = handOver && ui.bestKeys.size > 0;
          cardEl.classList.toggle('win-card', emphasise && revealed && ui.bestKeys.has(key));
          cardEl.classList.toggle('dim-card', emphasise && revealed && !ui.bestKeys.has(key));
        });
      });

      this.updateCommunity(game, ui);
    }

    updateCommunity(game, ui) {
      const board = game.board;
      const newCards = board.length - this.previousBoardSize;
      this.communityCards.forEach((cardEl, index) => {
        const card = board[index];
        if (!card) {
          if (!cardEl.classList.contains('empty')) clearCard(cardEl);
          return;
        }
        const isNew = index >= this.previousBoardSize && cardEl.classList.contains('empty');
        const order = Math.max(0, index - this.previousBoardSize);
        setCard(cardEl, card, { faceUp: true, animate: isNew, delay: isNew ? order * 160 : 0, flipDelay: isNew ? order * 160 + 250 : 0 });
        const emphasise = game.stage === 'finished' && ui.bestKeys.size > 0;
        cardEl.classList.toggle('win-card', emphasise && ui.bestKeys.has(cardKey(card)));
        cardEl.classList.toggle('dim-card', emphasise && !ui.bestKeys.has(cardKey(card)));
      });
      this.previousBoardSize = board.length;
      return newCards;
    }

    showBanner(lines, tone) {
      while (this.bannerEl.firstChild) this.bannerEl.removeChild(this.bannerEl.firstChild);
      lines.forEach((line, index) => this.bannerEl.append(h('div', { class: index === 0 ? 'banner-title' : index === 1 ? 'banner-detail' : 'banner-note' }, line)));
      this.bannerEl.className = 'banner ' + (tone || '');
      this.bannerEl.hidden = false;
    }

    hideBanner() {
      this.bannerEl.hidden = true;
    }
  }

  Poker.TableView = TableView;
  Poker.TableConsts = { PERSONALITY_LABELS, AVATARS, cardKey };
})(typeof globalThis !== 'undefined' ? globalThis : this);
