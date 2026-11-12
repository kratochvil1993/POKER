(function (root) {
  const Poker = root.Poker;
  const { Game, Bots, Storage, Messages, TableView } = Poker;
  const { h, clear, sanitizeName, formatChips } = Poker.Dom;
  const { secureRandomInt } = Poker.Deck;
  const { evaluateWithName } = Poker.Evaluator;

  const STARTING_STACK = 1000;
  const HUMAN_ID = 'human';
  const MAX_LOG_ENTRIES = 150;
  const $ = (id) => document.getElementById(id);

  const app = {
    data: Storage.load(),
    game: null,
    table: null,
    token: 0,
    ui: null,
    raise: { open: false, value: 0 },
  };
  Poker.app = app;

  function freshUi() {
    return { revealIds: new Set(), actionLabels: {}, winnerIds: new Set(), bestKeys: new Set(), dealing: false, runoutAnnounced: false };
  }

  function later(fn, ms) {
    const token = app.token;
    setTimeout(() => {
      if (token === app.token) fn();
    }, ms);
  }

  // ---------- Modaly ----------
  function modalApi(id) {
    const element = $(id);
    if (root.bootstrap && root.bootstrap.Modal) {
      const instance = root.bootstrap.Modal.getOrCreateInstance(element);
      return { show: () => instance.show(), hide: () => instance.hide() };
    }
    return {
      show() {
        element.classList.add('show');
        element.style.display = 'block';
      },
      hide() {
        element.classList.remove('show');
        element.style.display = 'none';
      },
    };
  }

  // ---------- Úvodní obrazovka ----------
  function showScreen(name) {
    $('screenStart').hidden = name !== 'start';
    $('screenGame').hidden = name !== 'game';
    if (name === 'start') renderStartExtras();
  }

  function buildBotCountButtons() {
    const group = $('botCountGroup');
    clear(group);
    for (let count = 1; count <= 5; count++) {
      group.append(
        h('input', { type: 'radio', class: 'btn-check', name: 'botCount', id: 'bots' + count, value: String(count), autocomplete: 'off', checked: count === app.data.botCount }),
        h('label', { class: 'btn btn-outline-light', for: 'bots' + count }, String(count))
      );
    }
  }

  function selectedBotCount() {
    const checked = document.querySelector('input[name="botCount"]:checked');
    return checked ? Number(checked.value) : app.data.botCount;
  }

  function renderStartExtras() {
    app.data = Storage.load();
    const saved = app.data.savedGame;
    const button = $('btnContinue');
    if (saved && saved.players[0].stack + saved.players.slice(1).reduce((sum, p) => sum + p.stack, 0) > 0) {
      const human = saved.players[0];
      clear(button);
      button.append(`Pokračovat: ${human.name}, ${formatChips(human.stack)} žetonů (${saved.players.length - 1} ${saved.players.length === 2 ? 'bot' : 'boti'})`);
      button.hidden = false;
    } else {
      button.hidden = true;
    }
    renderStatsSummary();
  }

  function renderStatsSummary() {
    const stats = app.data.stats;
    const box = $('startStats');
    clear(box);
    if (stats.hands === 0) {
      box.hidden = true;
      return;
    }
    const item = (value, label) => h('div', {}, h('strong', {}, value), label);
    box.append(item(formatChips(stats.hands), 'rukou'), item(formatChips(stats.wins), 'výher'), item(stats.bestHandName || '–', 'nejlepší ruka'));
    box.hidden = false;
  }

  // ---------- Start a pokračování hry ----------
  function createGameFromPlayers(players, extra = {}) {
    const game = new Game({ players, startingStack: STARTING_STACK, randomInt: secureRandomInt });
    if (extra.handNumber !== undefined) game.handNumber = extra.handNumber;
    if (extra.dealerIdx !== undefined) game.dealerIdx = extra.dealerIdx;
    return game;
  }

  function beginSession(game) {
    app.token++;
    app.game = game;
    app.ui = freshUi();
    app.table = app.table || new TableView($('tableArea'), $('banner'));
    app.table.build(game.players, HUMAN_ID);
    clear($('logList'));
    $('ticker').textContent = '';
    showScreen('game');
    startNextHand();
  }

  function startNewGame() {
    const name = sanitizeName($('playerName').value);
    const botCount = selectedBotCount();
    $('playerName').value = name;
    const bots = Bots.createBotRoster(botCount, secureRandomInt, secureRandomInt(Bots.PERSONALITY_ORDER.length), [name]);
    const players = [{ id: HUMAN_ID, name, isBot: false }, ...bots];
    const stats = { ...app.data.stats, games: app.data.stats.games + 1 };
    app.data = Storage.update({ name, botCount, stats });
    const game = createGameFromPlayers(players);
    saveSnapshot(game);
    beginSession(game);
  }

  function continueSavedGame() {
    const saved = app.data.savedGame;
    if (!saved) return;
    const players = saved.players.map((p) => ({ ...p }));
    const game = createGameFromPlayers(players, { handNumber: saved.handNumber, dealerIdx: saved.dealerIdx });
    beginSession(game);
  }

  function saveSnapshot(game) {
    app.data = Storage.update({
      savedGame: {
        players: game.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, personality: p.personality, stack: p.stack })),
        handNumber: game.handNumber,
        dealerIdx: game.dealerIdx,
      },
    });
  }

  // ---------- Průběh ruky ----------
  function startNextHand() {
    const game = app.game;
    app.token++;
    app.ui = freshUi();
    app.table.hideBanner();
    $('logPanel').classList.remove('open');
    setPanelMode('waiting');

    const human = game.playerById(HUMAN_ID);
    if (human.stack === 0) {
      showEndModal('bust');
      return;
    }
    if (!game.players.some((p) => p.isBot && p.stack > 0)) {
      showEndModal('victory');
      return;
    }

    const events = game.startHand();
    app.ui.dealing = true;
    processEvents(events);
    render();
    app.ui.dealing = false;
    later(runLoop, 900);
  }

  function nameOf(id) {
    return app.game.playerById(id).name;
  }

  function processEvents(events) {
    const game = app.game;
    for (const event of events) {
      switch (event.type) {
        case 'hand-start':
          addLog(Messages.handStartLog(event, nameOf(event.dealerId)), 'hand');
          if (event.blindsRaised) addLog(Messages.blindsRaisedLog(), 'humor');
          break;
        case 'blind':
          addLog(`${nameOf(event.playerId)} dává ${event.kind === 'small' ? 'malý' : 'velký'} blind ${formatChips(event.amount)}`, 'blind');
          break;
        case 'action':
          addLog(Messages.actionLog(nameOf(event.playerId), event), 'action');
          app.ui.actionLabels[event.playerId] = Messages.actionLabel(event);
          break;
        case 'street':
          addLog(Messages.streetLog(event), 'street');
          app.ui.actionLabels = {};
          break;
        case 'refund':
          addLog(`${nameOf(event.playerId)} dostává zpět ${formatChips(event.amount)} (nikdo to nedorovnal)`, 'blind');
          break;
        case 'round-complete':
          if (event.runout && !app.ui.runoutAnnounced) {
            app.ui.runoutAnnounced = true;
            app.ui.revealIds = new Set(game.contenders().map((p) => p.id));
            addLog('Všichni jsou all-in. Karty na stůl!', 'humor');
          }
          break;
        default:
          break;
      }
    }
  }

  function render() {
    app.table.update(app.game, app.ui);
    updateBlindInfo();
  }

  function updateBlindInfo() {
    const game = app.game;
    const lastLevel = game.blindLevel >= game.blindLevels.length - 1;
    const untilRaise = game.handsPerLevel - ((game.handNumber - 1) % game.handsPerLevel);
    const suffix = lastLevel ? '' : ` • blindy ↑ za ${untilRaise}`;
    $('blindInfo').textContent = `Ruka č. ${game.handNumber} • blindy ${formatChips(game.smallBlind)}/${formatChips(game.bigBlind)}${suffix}`;
  }

  function botDelay() {
    let delay = Bots.thinkingDelay();
    if (app.data.settings.speed === 'fast') delay *= 0.4;
    const human = app.game.playerById(HUMAN_ID);
    if (human.folded || !human.inHand) delay *= 0.5;
    return delay;
  }

  function runLoop() {
    const game = app.game;
    if (game.stage === 'betting') {
      const player = game.toAct;
      render();
      if (player.isBot) {
        setPanelMode('waiting', player);
        later(() => botAct(), botDelay());
      } else {
        setPanelMode('human');
      }
    } else if (game.stage === 'advance') {
      render();
      setPanelMode('waiting');
      const runout = game.isRunout();
      later(() => {
        processEvents(game.advance());
        render();
        runLoop();
      }, runout ? 1400 : 850);
    } else if (game.stage === 'finished') {
      onHandFinished();
    }
  }

  function safeAct(action) {
    const game = app.game;
    try {
      return game.act(action);
    } catch (error) {
      const legal = game.legalActions();
      return game.act(legal.canCheck ? { type: 'check' } : { type: 'fold' });
    }
  }

  function botAct() {
    const game = app.game;
    if (game.stage !== 'betting' || !game.toAct.isBot) return;
    const action = Bots.chooseAction(game, game.toActIdx);
    processEvents(safeAct(action));
    render();
    runLoop();
  }

  function humanAct(action) {
    const game = app.game;
    if (game.stage !== 'betting' || game.toAct.id !== HUMAN_ID) return;
    closeRaiseBox();
    setPanelMode('waiting');
    processEvents(safeAct(action));
    render();
    later(runLoop, 350);
  }

  function onHandFinished() {
    const game = app.game;
    const result = game.result;
    const human = game.playerById(HUMAN_ID);
    const payoutToHuman = result.payouts[HUMAN_ID] || 0;

    if (result.showdown) app.ui.revealIds = new Set(game.contenders().map((p) => p.id));
    app.ui.winnerIds = new Set(result.winnerIds);
    app.ui.actionLabels = {};
    const spotlightId = payoutToHuman ? HUMAN_ID : result.winnerIds[0];
    if (result.showdown && result.hands[spotlightId]) {
      app.ui.bestKeys = new Set(result.hands[spotlightId].best.map(Poker.TableConsts.cardKey));
    }
    render();

    const summary = Messages.resultSummary(result, nameOf);
    const outcome = payoutToHuman > 0 ? 'win' : human.folded ? 'fold' : 'lose';
    const humorLine = Messages.humanLine(human.name, outcome);
    app.table.showBanner([summary.title, summary.detail, humorLine], outcome === 'win' ? 'win' : outcome === 'lose' ? 'lose' : '');
    addLog(`${summary.title} – ${summary.detail}`, 'result');
    if (result.showdown) {
      for (const player of game.contenders()) {
        const hand = result.hands[player.id];
        addLog(`${player.name}: ${Messages.cardsText(player.hole)} → ${hand.name}`, 'action');
      }
    }
    addLog(humorLine, 'humor');

    updateStats(result, payoutToHuman);
    saveSnapshot(game);
    setPanelMode('next');
    if (app.data.settings.autoNext) later(startNextHand, 4200);
  }

  function updateStats(result, payoutToHuman) {
    const stats = { ...app.data.stats };
    stats.hands += 1;
    if (payoutToHuman > 0) {
      stats.wins += 1;
      stats.biggestWin = Math.max(stats.biggestWin, payoutToHuman);
    }
    const humanHand = result.hands[HUMAN_ID];
    if (humanHand && humanHand.score > stats.bestHandScore) {
      stats.bestHandScore = humanHand.score;
      stats.bestHandName = humanHand.name;
    }
    app.data = Storage.update({ stats });
  }

  // ---------- Panel akcí ----------
  function setPanelMode(mode, botPlayer) {
    const panel = $('actionPanel');
    const status = $('panelStatus');
    const buttons = $('actionButtons');
    panel.classList.toggle('waiting', mode === 'waiting');
    buttons.hidden = mode === 'next';
    $('btnNext').hidden = mode !== 'next';
    if (mode !== 'human') closeRaiseBox();

    status.hidden = mode === 'next';
    if (mode === 'next') {
      status.textContent = '';
    } else if (mode === 'waiting') {
      status.textContent = botPlayer ? Messages.thinkingLine(botPlayer.name) : '';
    } else {
      configureHumanPanel();
    }
  }

  function configureHumanPanel() {
    const game = app.game;
    const human = game.playerById(HUMAN_ID);
    const legal = game.legalActions();

    const status = $('panelStatus');
    clear(status);
    status.append(`Jsi na tahu, ${human.name}. Pot ${formatChips(game.pot)}`);
    if (game.board.length >= 3) {
      const hand = evaluateWithName([...human.hole, ...game.board]);
      status.append(' • ', h('span', { class: 'hint' }, hand.name));
    }

    const callButton = $('btnCall');
    if (legal.canCall) {
      callButton.textContent = legal.toCall >= human.stack ? `All-in ${formatChips(human.stack)}` : `Dorovnat ${formatChips(legal.toCall)}`;
    } else {
      callButton.textContent = 'Čekat';
    }

    const raiseButton = $('btnRaise');
    raiseButton.hidden = !legal.canRaise;
    $('actionButtons').classList.toggle('two', !legal.canRaise);
    updateRaiseButtonLabel();
  }

  function updateRaiseButtonLabel() {
    const game = app.game;
    if (game.stage !== 'betting' || game.toAct.id !== HUMAN_ID) return;
    const legal = game.legalActions();
    const button = $('btnRaise');
    if (legal.minRaiseTo >= legal.maxRaiseTo) {
      button.textContent = `All-in ${formatChips(legal.maxRaiseTo)}`;
    } else if (app.raise.open) {
      const isAllIn = app.raise.value >= legal.maxRaiseTo;
      button.textContent = isAllIn ? `All-in ${formatChips(app.raise.value)}` : `${legal.isBet ? 'Vsadit' : 'Přihodit na'} ${formatChips(app.raise.value)}`;
    } else {
      button.textContent = legal.isBet ? 'Vsadit' : 'Přihodit';
    }
  }

  function openRaiseBox() {
    const legal = app.game.legalActions();
    const slider = $('raiseSlider');
    slider.min = legal.minRaiseTo;
    slider.max = legal.maxRaiseTo;
    app.raise = { open: true, value: legal.minRaiseTo };
    slider.value = legal.minRaiseTo;
    $('raiseBox').hidden = false;
    updateRaiseButtonLabel();
  }

  function closeRaiseBox() {
    app.raise = { open: false, value: 0 };
    $('raiseBox').hidden = true;
  }

  function setRaiseValue(value) {
    const legal = app.game.legalActions();
    const unit = app.game.smallBlind;
    let next = Math.round(value);
    if (next >= legal.maxRaiseTo - unit / 2) next = legal.maxRaiseTo;
    else if (next <= legal.minRaiseTo) next = legal.minRaiseTo;
    else next = Math.round(next / unit) * unit;
    next = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, next));
    app.raise.value = next;
    $('raiseSlider').value = next;
    updateRaiseButtonLabel();
  }

  function onRaiseClick() {
    const game = app.game;
    const legal = game.legalActions();
    if (legal.minRaiseTo >= legal.maxRaiseTo) {
      humanAct({ type: 'allin' });
      return;
    }
    if (!app.raise.open) {
      openRaiseBox();
      return;
    }
    if (app.raise.value >= legal.maxRaiseTo) humanAct({ type: 'allin' });
    else humanAct({ type: 'raise', amount: app.raise.value });
  }

  function bindPanel() {
    $('btnFold').addEventListener('click', () => humanAct({ type: 'fold' }));
    $('btnCall').addEventListener('click', () => {
      const legal = app.game.legalActions();
      humanAct(legal.canCall ? { type: 'call' } : { type: 'check' });
    });
    $('btnRaise').addEventListener('click', onRaiseClick);
    $('btnNext').addEventListener('click', () => startNextHand());
    $('raiseSlider').addEventListener('input', (event) => setRaiseValue(Number(event.target.value)));
    $('btnRaiseMinus').addEventListener('click', () => setRaiseValue(app.raise.value - app.game.bigBlind));
    $('btnRaisePlus').addEventListener('click', () => setRaiseValue(app.raise.value + app.game.bigBlind));
    document.querySelectorAll('[data-preset]').forEach((button) => {
      button.addEventListener('click', () => {
        const legal = app.game.legalActions();
        const presets = { min: legal.minRaiseTo, half: legal.halfPotTo, pot: legal.potTo, allin: legal.maxRaiseTo };
        setRaiseValue(presets[button.dataset.preset]);
      });
    });
  }

  // ---------- Log ----------
  function addLog(text, kind) {
    const list = $('logList');
    list.append(h('li', { class: kind || '' }, text));
    while (list.children.length > MAX_LOG_ENTRIES) list.removeChild(list.firstChild);
    list.scrollTop = list.scrollHeight;
    if (kind !== 'hand' && kind !== 'blind') $('ticker').textContent = text;
  }

  // ---------- Menu a modaly ----------
  function renderMenuStats() {
    const stats = app.data.stats;
    const list = $('statsList');
    clear(list);
    const rows = [
      ['Odehrané ruce', formatChips(stats.hands)],
      ['Výhry', formatChips(stats.wins)],
      ['Nejlepší ruka', stats.bestHandName || '–'],
      ['Největší výhra', stats.biggestWin ? formatChips(stats.biggestWin) : '–'],
      ['Rebuy', formatChips(stats.rebuys)],
      ['Zahájené hry', formatChips(stats.games)],
    ];
    for (const [label, value] of rows) list.append(h('dt', {}, label), h('dd', {}, value));
  }

  function openMenu() {
    app.data = Storage.load();
    $('optFast').checked = app.data.settings.speed === 'fast';
    $('optAutoNext').checked = app.data.settings.autoNext;
    renderMenuStats();
    modalApi('menuModal').show();
  }

  function saveSettings() {
    const settings = { speed: $('optFast').checked ? 'fast' : 'normal', autoNext: $('optAutoNext').checked };
    app.data = Storage.update({ settings });
  }

  function leaveToStart() {
    app.token++;
    modalApi('menuModal').hide();
    modalApi('endModal').hide();
    showScreen('start');
  }

  function showEndModal(kind) {
    const human = app.game.playerById(HUMAN_ID);
    const bust = kind === 'bust';
    $('endEmoji').textContent = bust ? '💸' : '🏆';
    $('endTitle').textContent = bust ? 'Žetony došly' : 'Stůl je tvůj!';
    $('endText').textContent = bust ? Messages.bustLine(human.name) : Messages.victoryLine(human.name);
    $('btnRebuy').hidden = !bust;
    $('btnRebuy').textContent = `Rebuy (+${formatChips(STARTING_STACK)} žetonů)`;
    saveSnapshot(app.game);
    modalApi('endModal').show();
  }

  function rebuy() {
    app.game.rebuy(HUMAN_ID, STARTING_STACK);
    const stats = { ...app.data.stats, rebuys: app.data.stats.rebuys + 1 };
    app.data = Storage.update({ stats });
    saveSnapshot(app.game);
    modalApi('endModal').hide();
    startNextHand();
  }

  function bindShell() {
    $('startForm').addEventListener('submit', (event) => {
      event.preventDefault();
      startNewGame();
    });
    $('playerName').addEventListener('focus', (event) => event.target.select());
    $('btnContinue').addEventListener('click', continueSavedGame);
    $('btnMenu').addEventListener('click', openMenu);
    $('btnNewGame').addEventListener('click', leaveToStart);
    $('btnEndNewGame').addEventListener('click', leaveToStart);
    $('btnRebuy').addEventListener('click', rebuy);
    $('optFast').addEventListener('change', saveSettings);
    $('optAutoNext').addEventListener('change', saveSettings);
    $('btnLog').addEventListener('click', () => $('logPanel').classList.toggle('open'));
    $('btnLogClose').addEventListener('click', () => $('logPanel').classList.remove('open'));
  }

  function init() {
    buildBotCountButtons();
    $('playerName').value = app.data.name || 'Hráč';
    bindShell();
    bindPanel();
    showScreen('start');
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => undefined);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof globalThis !== 'undefined' ? globalThis : this);
