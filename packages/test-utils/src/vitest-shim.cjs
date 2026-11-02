// Minimal fallback shim for Vitest in CommonJS contexts where Vitest cannot be required.
// Delegates to global test runner if present (e.g. Jest, Mocha, or Vitest globals).
module.exports = {
  describe: (...args) => {
    if (typeof globalThis.describe === 'function') {
      return globalThis.describe(...args);
    }
    throw new Error(
      'runAdapterContractTests requires a test runner (Vitest or Jest) with describe/it/expect',
    );
  },
  it: (...args) => {
    if (typeof globalThis.it === 'function') {
      return globalThis.it(...args);
    }
    throw new Error(
      'runAdapterContractTests requires a test runner (Vitest or Jest) with describe/it/expect',
    );
  },
  expect: (...args) => {
    if (typeof globalThis.expect === 'function') {
      return globalThis.expect(...args);
    }
    throw new Error(
      'runAdapterContractTests requires a test runner (Vitest or Jest) with describe/it/expect',
    );
  },
};
