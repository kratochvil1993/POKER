const path = require('path');
const root = path.join(__dirname, '..');
const files = [
  'tests/harness.js',
  'js/engine/deck.js',
  'js/engine/evaluator.js',
  'js/engine/pots.js',
  'js/engine/game.js',
  'js/engine/bots.js',
  'tests/evaluator.test.js',
  'tests/pots.test.js',
  'tests/game.test.js',
  'tests/bots.test.js',
];
for (const file of files) {
  try {
    require(path.join(root, file));
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes(file)) continue;
    throw error;
  }
}
const results = globalThis.TestHarness.runAll();
let failed = 0;
for (const r of results) {
  if (r.ok) console.log('  ok   ' + r.name);
  else {
    failed++;
    console.log('  FAIL ' + r.name + '\n         ' + r.error);
  }
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
process.exit(failed ? 1 : 0);
