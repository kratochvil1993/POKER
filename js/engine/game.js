(function (root) {
  const Poker = (root.Poker = root.Poker || {});
  const { createDeck, shuffle, secureRandomInt } = Poker.Deck;
  const { evaluateWithName, bestFive } = Poker.Evaluator;
  const { buildPots, awardPots } = Poker.Pots;

  const STREETS = ['preflop', 'flop', 'turn', 'river'];
  const BOARD_SIZE_AFTER = { flop: 3, turn: 4, river: 5 };
  const DEFAULT_BLIND_LEVELS = [
    [10, 20], [15, 30], [25, 50], [50, 100], [75, 150],
    [100, 200], [150, 300], [200, 400], [300, 600], [500, 1000],
  ];

  class Game {
    constructor(options) {
      if (options.players.some((p) => typeof p.id !== 'string')) throw new Error('Player ids must be strings');
      this.startingStack = options.startingStack || 1000;
      this.players = options.players.map((p, seat) => ({
        isBot: false,
        ...p,
        seat,
        stack: p.stack === undefined ? this.startingStack : p.stack,
        hole: [],
        bet: 0,
        totalBet: 0,
        folded: false,
        allIn: false,
        hasActed: false,
        raiseLocked: false,
        inHand: false,
      }));
      this.blindLevels = options.blindLevels || DEFAULT_BLIND_LEVELS;
      this.handsPerLevel = options.handsPerLevel || 8;
      this.randomInt = options.randomInt || secureRandomInt;
      this.createDeck = options.createDeck || (() => shuffle(createDeck(), this.randomInt));
      this.dealerIdx = options.firstDealer === undefined ? -1 : options.firstDealer;

      this.handNumber = 0;
      this.blindLevel = 0;
      this.smallBlind = this.blindLevels[0][0];
      this.bigBlind = this.blindLevels[0][1];
      this.stage = 'idle';
      this.phase = 'none';
      this.board = [];
      this.deck = [];
      this.currentBet = 0;
      this.minRaise = this.bigBlind;
      this.toActIdx = -1;
      this.sbIdx = -1;
      this.bbIdx = -1;
      this.result = null;
      this.events = [];
    }

    get pot() {
      return this.players.reduce((sum, p) => sum + p.totalBet, 0);
    }

    get totalChips() {
      const countBets = this.stage === 'betting' || this.stage === 'advance';
      return this.players.reduce((sum, p) => sum + p.stack + (countBets ? p.totalBet : 0), 0);
    }

    get toAct() {
      return this.toActIdx >= 0 ? this.players[this.toActIdx] : null;
    }

    get isHeadsUp() {
      return this.players.filter((p) => p.inHand).length === 2;
    }

    playerById(id) {
      return this.players.find((p) => p.id === id);
    }

    contenders() {
      return this.players.filter((p) => p.inHand && !p.folded);
    }

    actors() {
      return this.players.filter((p) => p.inHand && !p.folded && !p.allIn);
    }

    seatAfter(index, predicate) {
      const count = this.players.length;
      for (let step = 1; step <= count; step++) {
        const seat = (index + step) % count;
        if (predicate(this.players[seat])) return seat;
      }
      return -1;
    }

    seatFrom(index, predicate) {
      const count = this.players.length;
      for (let step = 0; step < count; step++) {
        const seat = (index + step) % count;
        if (predicate(this.players[seat])) return seat;
      }
      return -1;
    }

    commit(player, amount) {
      const chips = Math.min(amount, player.stack);
      player.stack -= chips;
      player.bet += chips;
      player.totalBet += chips;
      if (player.stack === 0) player.allIn = true;
      return chips;
    }

    startHand() {
      if (this.stage === 'betting' || this.stage === 'advance') throw new Error('Hand already in progress');
      const inGame = this.players.filter((p) => p.stack > 0);
      if (inGame.length < 2) throw new Error('Not enough players with chips');

      this.events = [];
      this.handNumber += 1;
      this.blindLevel = Math.min(Math.floor((this.handNumber - 1) / this.handsPerLevel), this.blindLevels.length - 1);
      [this.smallBlind, this.bigBlind] = this.blindLevels[this.blindLevel];

      for (const p of this.players) {
        p.inHand = p.stack > 0;
        p.hole = [];
        p.bet = 0;
        p.totalBet = 0;
        p.folded = false;
        p.allIn = false;
        p.hasActed = false;
        p.raiseLocked = false;
      }
      this.board = [];
      this.result = null;

      const inHand = (p) => p.inHand;
      if (this.dealerIdx < 0) {
        const candidates = this.players.filter(inHand);
        this.dealerIdx = candidates[this.randomInt(candidates.length)].seat;
      } else if (this.handNumber > 1) {
        this.dealerIdx = this.seatAfter(this.dealerIdx, inHand);
      }
      const headsUp = inGame.length === 2;
      this.sbIdx = headsUp ? this.dealerIdx : this.seatAfter(this.dealerIdx, inHand);
      this.bbIdx = this.seatAfter(this.sbIdx, inHand);

      this.events.push({
        type: 'hand-start',
        handNumber: this.handNumber,
        dealerId: this.players[this.dealerIdx].id,
        smallBlind: this.smallBlind,
        bigBlind: this.bigBlind,
        blindsRaised: this.handNumber > 1 && this.blindLevel > Math.floor((this.handNumber - 2) / this.handsPerLevel),
      });

      const smallPaid = this.commit(this.players[this.sbIdx], this.smallBlind);
      const bigPaid = this.commit(this.players[this.bbIdx], this.bigBlind);
      this.events.push({ type: 'blind', playerId: this.players[this.sbIdx].id, kind: 'small', amount: smallPaid });
      this.events.push({ type: 'blind', playerId: this.players[this.bbIdx].id, kind: 'big', amount: bigPaid });

      this.deck = this.createDeck().slice();
      const dealOrder = [];
      let seat = this.dealerIdx;
      for (let i = 0; i < inGame.length; i++) {
        seat = this.seatAfter(seat, inHand);
        dealOrder.push(seat);
      }
      for (let round = 0; round < 2; round++) {
        for (const s of dealOrder) this.players[s].hole.push(this.deck.shift());
      }
      this.events.push({ type: 'deal-hole' });

      this.phase = 'preflop';
      this.currentBet = Math.max(smallPaid, bigPaid);
      this.minRaise = this.bigBlind;
      this.beginBettingRound(headsUp ? this.dealerIdx : (this.bbIdx + 1) % this.players.length);
      return this.events;
    }

    beginBettingRound(startIdx) {
      this.toActIdx = this.seatFrom(startIdx, (p) => p.inHand && !p.folded && !p.allIn);
      if (this.toActIdx < 0 || this.isRoundComplete()) {
        this.finishBettingRound();
      } else {
        this.stage = 'betting';
      }
    }

    isRoundComplete() {
      const actors = this.actors();
      if (actors.length === 0) return true;
      if (actors.length === 1) return actors[0].bet >= this.currentBet;
      return actors.every((p) => p.hasActed && p.bet === this.currentBet);
    }

    finishBettingRound() {
      this.refundUncalledBet();
      this.toActIdx = -1;
      this.stage = 'advance';
      this.events.push({ type: 'round-complete', phase: this.phase, runout: this.isRunout() });
    }

    isRunout() {
      return this.contenders().length > 1 && this.actors().length <= 1;
    }

    refundUncalledBet() {
      const bettors = this.players.filter((p) => p.bet > 0).sort((a, b) => b.bet - a.bet);
      if (bettors.length === 0) return;
      const top = bettors[0];
      const second = bettors.length > 1 ? bettors[1].bet : 0;
      const excess = top.bet - second;
      if (excess <= 0) return;
      top.bet -= excess;
      top.totalBet -= excess;
      top.stack += excess;
      this.events.push({ type: 'refund', playerId: top.id, amount: excess });
    }

    legalActions(index = this.toActIdx) {
      const p = this.players[index];
      const toCall = Math.min(this.currentBet - p.bet, p.stack);
      const maxRaiseTo = p.bet + p.stack;
      const othersCanAct = this.actors().some((o) => o !== p);
      const canRaise = !p.raiseLocked && othersCanAct && maxRaiseTo > this.currentBet;
      const minRaiseTo = Math.min(this.currentBet + this.minRaise, maxRaiseTo);
      const potAfterCall = this.pot + toCall;
      const clamp = (value) => Math.max(minRaiseTo, Math.min(maxRaiseTo, Math.round(value)));
      return {
        canCheck: this.currentBet === p.bet,
        canCall: this.currentBet > p.bet,
        toCall,
        canRaise,
        isBet: this.currentBet === 0,
        minRaiseTo,
        maxRaiseTo,
        halfPotTo: clamp(this.currentBet + potAfterCall / 2),
        potTo: clamp(this.currentBet + potAfterCall),
        canAllIn: p.stack > 0 && (canRaise || p.stack <= toCall),
      };
    }

    act(action) {
      if (this.stage !== 'betting') throw new Error('No betting in progress');
      this.events = [];
      const index = this.toActIdx;
      const player = this.players[index];
      const legal = this.legalActions(index);
      const chipsBefore = player.bet;
      const wasBet = this.currentBet === 0;
      let kind = action.type;

      if (kind === 'allin') {
        kind = player.bet + player.stack > this.currentBet ? 'raise' : 'call';
        action = { type: kind, amount: player.bet + player.stack };
      }

      switch (kind) {
        case 'fold':
          player.folded = true;
          break;
        case 'check':
          if (!legal.canCheck) throw new Error('Cannot check');
          break;
        case 'call':
          if (!legal.canCall) throw new Error('Nothing to call');
          this.commit(player, legal.toCall);
          break;
        case 'raise': {
          if (!legal.canRaise) throw new Error('Cannot raise');
          const target = action.amount;
          if (!Number.isInteger(target) || target > legal.maxRaiseTo || target <= this.currentBet) throw new Error('Bad raise amount');
          if (target < legal.minRaiseTo) throw new Error('Raise below minimum');
          this.applyRaise(player, target);
          break;
        }
        default:
          throw new Error('Unknown action ' + kind);
      }

      player.hasActed = true;
      player.raiseLocked = false;
      this.events.push({
        type: 'action',
        playerId: player.id,
        action: kind === 'raise' && wasBet ? 'bet' : kind,
        amount: player.bet - chipsBefore,
        total: player.bet,
        allIn: player.allIn,
      });

      this.afterAction(index);
      return this.events;
    }

    applyRaise(player, target) {
      const increment = target - this.currentBet;
      this.commit(player, target - player.bet);
      this.currentBet = target;
      const fullRaise = increment >= this.minRaise;
      if (fullRaise) this.minRaise = increment;
      for (const other of this.actors()) {
        if (other === player) continue;
        if (fullRaise) {
          other.hasActed = false;
          other.raiseLocked = false;
        } else if (other.hasActed) {
          other.hasActed = false;
          other.raiseLocked = true;
        }
      }
    }

    afterAction(index) {
      if (this.contenders().length === 1) {
        this.awardByFold();
        return;
      }
      if (this.isRoundComplete()) {
        this.finishBettingRound();
        return;
      }
      this.toActIdx = this.seatAfter(index, (p) => p.inHand && !p.folded && !p.allIn && (!p.hasActed || p.bet < this.currentBet));
    }

    advance() {
      if (this.stage !== 'advance') throw new Error('Nothing to advance');
      this.events = [];
      if (this.phase === 'river') {
        this.showdown();
        return this.events;
      }
      const next = STREETS[STREETS.indexOf(this.phase) + 1];
      const targetSize = BOARD_SIZE_AFTER[next];
      const dealt = [];
      while (this.board.length < targetSize) {
        const card = this.deck.shift();
        this.board.push(card);
        dealt.push(card);
      }
      this.phase = next;
      this.events.push({ type: 'street', phase: next, cards: dealt });

      for (const p of this.players) {
        p.bet = 0;
        p.hasActed = false;
        p.raiseLocked = false;
      }
      this.currentBet = 0;
      this.minRaise = this.bigBlind;
      this.beginBettingRound((this.dealerIdx + 1) % this.players.length);
      return this.events;
    }

    awardByFold() {
      const winner = this.contenders()[0];
      const amount = this.pot;
      winner.stack += amount;
      this.result = {
        showdown: false,
        board: this.board.slice(),
        payouts: { [winner.id]: amount },
        pots: [{ amount, eligible: [winner.id], winners: [winner.id], shares: { [winner.id]: amount } }],
        hands: {},
        winnerIds: [winner.id],
      };
      this.stage = 'finished';
      this.toActIdx = -1;
      this.events.push({ type: 'hand-end', result: this.result });
    }

    showdown() {
      const contenders = this.contenders();
      const hands = {};
      const scoreById = {};
      for (const p of contenders) {
        const cards = [...p.hole, ...this.board];
        const evaluated = evaluateWithName(cards);
        evaluated.best = bestFive(cards);
        hands[p.id] = evaluated;
        scoreById[p.id] = evaluated.score;
      }
      const pots = buildPots(
        this.players.filter((p) => p.totalBet > 0).map((p) => ({ id: p.id, amount: p.totalBet, folded: p.folded || !p.inHand }))
      );
      const oddChipOrder = [];
      let seat = this.dealerIdx;
      for (let i = 0; i < this.players.length; i++) {
        seat = (seat + 1) % this.players.length;
        oddChipOrder.push(this.players[seat].id);
      }
      const { payouts, results } = awardPots(pots, scoreById, oddChipOrder);
      for (const id of Object.keys(payouts)) this.playerById(id).stack += payouts[id];
      this.result = {
        showdown: true,
        board: this.board.slice(),
        payouts,
        pots: results,
        hands,
        winnerIds: Object.keys(payouts),
      };
      this.phase = 'showdown';
      this.stage = 'finished';
      this.toActIdx = -1;
      this.events.push({ type: 'hand-end', result: this.result });
    }

    bustedPlayers() {
      return this.players.filter((p) => p.stack === 0);
    }

    rebuy(id, amount = this.startingStack) {
      const p = this.playerById(id);
      if (this.stage === 'betting' || this.stage === 'advance') throw new Error('Cannot rebuy during a hand');
      p.stack += amount;
    }
  }

  Poker.Game = Game;
  Poker.DEFAULT_BLIND_LEVELS = DEFAULT_BLIND_LEVELS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
