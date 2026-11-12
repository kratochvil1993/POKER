(function (root) {
  const tests = [];

  function test(name, fn) {
    tests.push({ name, fn });
  }

  function fail(message) {
    throw new Error(message);
  }

  const assert = {
    ok(value, message) {
      if (!value) fail(message || 'Expected truthy value');
    },
    equal(actual, expected, message) {
      if (actual !== expected) fail((message ? message + ': ' : '') + 'expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
    },
    deepEqual(actual, expected, message) {
      const a = JSON.stringify(actual);
      const e = JSON.stringify(expected);
      if (a !== e) fail((message ? message + ': ' : '') + 'expected ' + e + ' but got ' + a);
    },
    greater(a, b, message) {
      if (!(a > b)) fail((message ? message + ': ' : '') + a + ' is not greater than ' + b);
    },
    throws(fn, message) {
      let threw = false;
      try {
        fn();
      } catch (error) {
        threw = true;
      }
      if (!threw) fail(message || 'Expected function to throw');
    },
  };

  function runAll() {
    const results = [];
    for (const { name, fn } of tests) {
      try {
        fn();
        results.push({ name, ok: true });
      } catch (error) {
        results.push({ name, ok: false, error: error.message });
      }
    }
    return results;
  }

  root.TestHarness = { test, assert, runAll };
})(typeof globalThis !== 'undefined' ? globalThis : this);
