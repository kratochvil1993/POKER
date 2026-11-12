(function (root) {
  const Poker = (root.Poker = root.Poker || {});

  const MAX_NAME_LENGTH = 16;
  const DEFAULT_NAME = 'Hráč';

  function h(tag, props, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') element.className = value;
      else if (key === 'dataset') Object.assign(element.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
      else element.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      element.append(child);
    }
    return element;
  }

  function clear(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function sanitizeName(raw) {
    const cleaned = String(raw === undefined || raw === null ? '' : raw)
      .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const limited = Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join('').trim();
    return limited || DEFAULT_NAME;
  }

  function formatChips(amount) {
    return Math.round(amount).toLocaleString('cs-CZ');
  }

  function pick(list, randomFloat = Math.random) {
    return list[Math.floor(randomFloat() * list.length)];
  }

  Poker.Dom = { h, clear, sanitizeName, formatChips, pick, MAX_NAME_LENGTH, DEFAULT_NAME };
})(typeof globalThis !== 'undefined' ? globalThis : this);
