/**
 * Password hashing and key derivation: the parameter is the security control.
 *
 * ⚠ TEACHING CODE. Not constant-time, not audited, never for real data.
 *
 * A password hash is deliberately slow, which is the opposite of every other
 * hash requirement in this milestone. The reason is economic rather than
 * mathematical: an attacker who steals a password database runs the same
 * function you do, many times in parallel, so the only defence is to make each
 * guess expensive enough that a billion of them cost more than the accounts are
 * worth.
 *
 * That makes the COST PARAMETER the security control, not the algorithm — and
 * it is a control that decays, because the attacker's hardware improves while
 * your stored hashes do not. Which is why the rehash-on-successful-login path
 * exists, and why most systems that "use bcrypt" have never built it.
 *
 * The second axis is memory. A GPU has thousands of cores and a small amount of
 * memory each, so an algorithm that needs megabytes per guess costs the
 * attacker far more than one that needs kilobytes. PBKDF2 is pure iteration
 * with no memory requirement at all, which is exactly why a GPU runs it orders
 * of magnitude faster than your server does.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Kdf = api;
}(this, function (root) {
  'use strict';

  const Hash = root && root.CryptoHash ? root.CryptoHash : require('./crypto-hash.js');

  const DISCLAIMER = 'Teaching implementation: not constant-time, not audited, never for real data.';

  function xorInto(target, source) {
    for (let i = 0; i < target.length; i += 1) target[i] ^= source[i];
  }

  /* -------------------------------------------------------------- PBKDF2 */

  /**
   * PBKDF2 as RFC 2898 defines it: HMAC applied `iterations` times per output
   * block, with each iteration's output XORed into the accumulator. It has no
   * memory requirement whatever, which is its whole weakness — the attacker's
   * GPU runs the identical loop thousands of times in parallel.
   */
  function pbkdf2(config) {
    const hash = config.hash || 'sha-1';
    const digestSize = Hash.HASHES[hash].digestSize;
    const blocks = Math.ceil(config.length / digestSize);
    const out = [];

    for (let block = 1; block <= blocks; block += 1) {
      const chunk = pbkdf2Block({ password: config.password, salt: config.salt,
        iterations: config.iterations, hash: hash }, block);

      chunk.forEach(function (byte) { out.push(byte); });
    }
    return out.slice(0, config.length);
  }

  function pbkdf2Block(config, index) {
    const counter = [(index >>> 24) & 0xff, (index >>> 16) & 0xff,
      (index >>> 8) & 0xff, index & 0xff];
    let u = Hash.hmac(config.hash, config.password, config.salt.concat(counter));
    const accumulator = u.slice();

    for (let i = 1; i < config.iterations; i += 1) {
      u = Hash.hmac(config.hash, config.password, u);
      xorInto(accumulator, u);
    }
    return accumulator;
  }

  /* --------------------------------------------------- memory-hard sketch */

  /**
   * The memory-hard idea, in its simplest honest form: fill a large array with
   * a hash chain, then read it back in a data-dependent order. Sequential
   * filling means an attacker cannot skip it, and the data-dependent reads mean
   * the whole array has to be RESIDENT — which is what costs a GPU core dear.
   *
   * This is scrypt's ROMix reduced to its essentials, not scrypt. It is here so
   * the memory parameter can be measured rather than described.
   */
  function memoryHard(config) {
    const blocks = config.blocks === undefined ? 256 : config.blocks;
    const table = [];
    let state = Hash.hmac('sha-256', config.password, config.salt);

    for (let i = 0; i < blocks; i += 1) {
      table.push(state);
      state = Hash.sha256(state);
    }
    let reads = 0;

    for (let i = 0; i < blocks; i += 1) {
      const index = (state[state.length - 1] | (state[state.length - 2] << 8)) % blocks;

      state = Hash.sha256(state.concat(table[index]));
      reads += 1;
    }
    return { key: state, blocks: blocks, bytesHeld: blocks * 32, reads: reads };
  }

  /* ------------------------------------------------------- cost modelling */

  /**
   * The attacker's arithmetic, stated as arithmetic. Guesses per second scales
   * with parallelism for a compute-only KDF, and is capped by memory bandwidth
   * and capacity for a memory-hard one — so the memory parameter is the only
   * lever that changes the SHAPE of the attacker's cost rather than its
   * constant.
   */
  function crackingCost(config) {
    const verifyMs = config.verifyMs;
    const memoryKb = config.memoryKb === undefined ? 0 : config.memoryKb;
    const attackerCores = config.attackerCores === undefined ? 4096 : config.attackerCores;
    const attackerMemoryMb = config.attackerMemoryMb === undefined ? 16384
      : config.attackerMemoryMb;
    const speedup = config.speedup === undefined ? 20 : config.speedup;
    const memoryLimited = memoryKb > 0
      ? Math.floor(attackerMemoryMb * 1024 / memoryKb) : attackerCores;
    const effectiveCores = Math.min(attackerCores, memoryLimited);
    const perGuessMs = verifyMs / speedup;
    const guessesPerSecond = effectiveCores * 1000 / perGuessMs;

    return {
      verifyMs: verifyMs, memoryKb: memoryKb,
      effectiveCores: effectiveCores,
      memoryLimited: memoryKb > 0 && memoryLimited < attackerCores,
      guessesPerSecond: guessesPerSecond,
      secondsPerBillion: 1e9 / guessesPerSecond,
      daysForEightChars: Math.pow(62, 8) / guessesPerSecond / 86400
    };
  }

  /** Iterations that fit a verification-time budget, measured rather than
   *  copied from a blog post that was written on different hardware. */
  function tuneIterations(config) {
    const budgetMs = config.budgetMs === undefined ? 250 : config.budgetMs;
    const sample = config.sample === undefined ? 2000 : config.sample;
    const started = config.clock();
    const password = Hash.bytesOf('measurement password');

    pbkdf2({ password: password, salt: Hash.bytesOf('measurement salt'),
      iterations: sample, length: 32, hash: config.hash || 'sha-256' });
    const elapsed = Math.max(0.001, config.clock() - started);
    const perIteration = elapsed / sample;

    return {
      sampleIterations: sample, sampleMs: elapsed,
      perIterationMs: perIteration,
      iterations: Math.max(1, Math.round(budgetMs / perIteration)),
      budgetMs: budgetMs
    };
  }

  /* ------------------------------------------------------ salts and store */

  /**
   * What a stored credential actually is: an algorithm name, the parameters, a
   * per-user salt and the derived key. The parameters travel WITH the hash,
   * which is what makes an upgrade path possible — a verifier reads the stored
   * cost, uses it, and rehashes at the current cost if it is lower.
   */
  function register(config) {
    const record = {
      algorithm: config.algorithm || 'pbkdf2-sha256',
      iterations: config.iterations,
      salt: config.salt,
      key: pbkdf2({ password: config.password, salt: config.salt,
        iterations: config.iterations, length: 32, hash: 'sha-256' })
    };

    return record;
  }

  function verifyPassword(record, password, currentIterations) {
    const derived = pbkdf2({ password: password, salt: record.salt,
      iterations: record.iterations, length: 32, hash: 'sha-256' });
    const ok = derived.every(function (byte, i) { return byte === record.key[i]; });

    return {
      ok: ok,
      needsRehash: ok && record.iterations < currentIterations,
      storedIterations: record.iterations,
      currentIterations: currentIterations
    };
  }

  /** Two users with the same password get different hashes — which is all a
   *  salt does, and it is enough to make a precomputed table worthless. */
  function saltEffect(config) {
    const first = register({ password: config.password, salt: config.saltA,
      iterations: config.iterations });
    const second = register({ password: config.password, salt: config.saltB,
      iterations: config.iterations });

    return {
      identicalPassword: true,
      identicalHash: first.key.every(function (byte, i) { return byte === second.key[i]; }),
      first: first.key, second: second.key
    };
  }

  return {
    DISCLAIMER: DISCLAIMER,
    pbkdf2: pbkdf2, memoryHard: memoryHard,
    crackingCost: crackingCost, tuneIterations: tuneIterations,
    register: register, verifyPassword: verifyPassword, saltEffect: saltEffect
  };
}));
